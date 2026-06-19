module tenderboard::reputation_stake;

use std::string::{Self, String};
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::event;
use sui::object::{Self, ID, UID};
use sui::sui::SUI;
use sui::transfer;
use sui::tx_context::{Self, TxContext};

const E_NOT_OWNER: u64 = 1;
const E_ZERO_STAKE: u64 = 2;
const E_INSUFFICIENT_STAKE: u64 = 3;
const E_DECISION_POSITION_MISMATCH: u64 = 4;
const E_NOT_ORACLE_ADMIN: u64 = 5;

/// Owner-held economic bond for a worker passport.
///
/// The Walrus/Sui receipt proves work happened. This object makes reputation
/// economically accountable: challenges can burn/reward real SUI against a
/// specific worker identity and evidence hash.
public struct StakePosition has key {
    id: UID,
    owner: address,
    worker_agent_id: String,
    staked: Balance<SUI>,
    slash_count: u64,
    total_slashed_mist: u64,
}

/// Owned object for the oracle operator that issues slash decisions.
///
/// This is deliberately separate from the stake object: off-chain verification
/// decides whether a challenge is admissible, then Sui makes that decision an
/// inspectable object before slashing.
public struct OracleRegistry has key {
    id: UID,
    admin: address,
    decision_count: u64,
}

/// One-time oracle decision consumed by `slash_with_decision`.
public struct ChallengeDecision has key {
    id: UID,
    issuer: address,
    position_id: ID,
    worker_agent_id: String,
    evidence_hash: String,
    reason: String,
    slash_amount_mist: u64,
    sequence: u64,
}

public struct StakeOpened has copy, drop {
    sender: address,
    position_id: ID,
    worker_agent_id: String,
    amount_mist: u64,
}

public struct StakeAdded has copy, drop {
    sender: address,
    position_id: ID,
    worker_agent_id: String,
    amount_mist: u64,
    total_staked_mist: u64,
}

public struct StakeSlashed has copy, drop {
    challenger: address,
    position_id: ID,
    owner: address,
    worker_agent_id: String,
    evidence_hash: String,
    reason: String,
    slash_amount_mist: u64,
    remaining_stake_mist: u64,
    slash_count: u64,
}

public struct OracleRegistryCreated has copy, drop {
    sender: address,
    registry_id: ID,
}

public struct ChallengeDecisionIssued has copy, drop {
    issuer: address,
    registry_id: ID,
    decision_id: ID,
    position_id: ID,
    worker_agent_id: String,
    evidence_hash: String,
    reason: String,
    slash_amount_mist: u64,
    sequence: u64,
}

public entry fun create_oracle_registry(ctx: &mut TxContext) {
    let registry = OracleRegistry {
        id: object::new(ctx),
        admin: tx_context::sender(ctx),
        decision_count: 0,
    };
    let registry_id = object::id(&registry);
    event::emit(OracleRegistryCreated {
        sender: tx_context::sender(ctx),
        registry_id,
    });
    transfer::transfer(registry, tx_context::sender(ctx));
}

public entry fun open_position(
    worker_agent_id: vector<u8>,
    stake: Coin<SUI>,
    ctx: &mut TxContext,
) {
    let amount = coin::value(&stake);
    assert!(amount > 0, E_ZERO_STAKE);

    let position = StakePosition {
        id: object::new(ctx),
        owner: tx_context::sender(ctx),
        worker_agent_id: string::utf8(worker_agent_id),
        staked: coin::into_balance(stake),
        slash_count: 0,
        total_slashed_mist: 0,
    };
    let position_id = object::id(&position);
    event::emit(StakeOpened {
        sender: tx_context::sender(ctx),
        position_id,
        worker_agent_id: position.worker_agent_id,
        amount_mist: amount,
    });
    transfer::transfer(position, tx_context::sender(ctx));
}

public entry fun add_stake(
    position: &mut StakePosition,
    stake: Coin<SUI>,
    ctx: &mut TxContext,
) {
    assert!(position.owner == tx_context::sender(ctx), E_NOT_OWNER);

    let amount = coin::value(&stake);
    assert!(amount > 0, E_ZERO_STAKE);
    balance::join(&mut position.staked, coin::into_balance(stake));

    event::emit(StakeAdded {
        sender: tx_context::sender(ctx),
        position_id: object::id(position),
        worker_agent_id: position.worker_agent_id,
        amount_mist: amount,
        total_staked_mist: balance::value(&position.staked),
    });
}

public entry fun challenge_and_slash(
    position: &mut StakePosition,
    evidence_hash: vector<u8>,
    reason: vector<u8>,
    slash_amount_mist: u64,
    ctx: &mut TxContext,
) {
    slash_internal(position, string::utf8(evidence_hash), string::utf8(reason), slash_amount_mist, ctx);
}

public entry fun issue_challenge_decision(
    registry: &mut OracleRegistry,
    position: &StakePosition,
    evidence_hash: vector<u8>,
    reason: vector<u8>,
    slash_amount_mist: u64,
    ctx: &mut TxContext,
) {
    assert!(registry.admin == tx_context::sender(ctx), E_NOT_ORACLE_ADMIN);
    assert!(slash_amount_mist > 0, E_ZERO_STAKE);

    registry.decision_count = registry.decision_count + 1;
    let decision = ChallengeDecision {
        id: object::new(ctx),
        issuer: tx_context::sender(ctx),
        position_id: object::id(position),
        worker_agent_id: position.worker_agent_id,
        evidence_hash: string::utf8(evidence_hash),
        reason: string::utf8(reason),
        slash_amount_mist,
        sequence: registry.decision_count,
    };
    let decision_id = object::id(&decision);
    event::emit(ChallengeDecisionIssued {
        issuer: tx_context::sender(ctx),
        registry_id: object::id(registry),
        decision_id,
        position_id: decision.position_id,
        worker_agent_id: decision.worker_agent_id,
        evidence_hash: decision.evidence_hash,
        reason: decision.reason,
        slash_amount_mist,
        sequence: registry.decision_count,
    });
    transfer::transfer(decision, tx_context::sender(ctx));
}

public entry fun slash_with_decision(
    position: &mut StakePosition,
    decision: ChallengeDecision,
    ctx: &mut TxContext,
) {
    let ChallengeDecision {
        id,
        issuer: _,
        position_id,
        worker_agent_id: _,
        evidence_hash,
        reason,
        slash_amount_mist,
        sequence: _,
    } = decision;

    assert!(position_id == object::id(position), E_DECISION_POSITION_MISMATCH);
    object::delete(id);
    slash_internal(position, evidence_hash, reason, slash_amount_mist, ctx);
}

public fun owner(position: &StakePosition): address {
    position.owner
}

public fun worker_agent_id(position: &StakePosition): String {
    position.worker_agent_id
}

public fun staked_mist(position: &StakePosition): u64 {
    balance::value(&position.staked)
}

public fun slash_count(position: &StakePosition): u64 {
    position.slash_count
}

public fun total_slashed_mist(position: &StakePosition): u64 {
    position.total_slashed_mist
}

public fun oracle_admin(registry: &OracleRegistry): address {
    registry.admin
}

public fun oracle_decision_count(registry: &OracleRegistry): u64 {
    registry.decision_count
}

fun slash_internal(
    position: &mut StakePosition,
    evidence_hash: String,
    reason: String,
    slash_amount_mist: u64,
    ctx: &mut TxContext,
) {
    assert!(slash_amount_mist > 0, E_ZERO_STAKE);
    assert!(balance::value(&position.staked) >= slash_amount_mist, E_INSUFFICIENT_STAKE);

    let slashed = balance::split(&mut position.staked, slash_amount_mist);
    position.slash_count = position.slash_count + 1;
    position.total_slashed_mist = position.total_slashed_mist + slash_amount_mist;

    event::emit(StakeSlashed {
        challenger: tx_context::sender(ctx),
        position_id: object::id(position),
        owner: position.owner,
        worker_agent_id: position.worker_agent_id,
        evidence_hash,
        reason,
        slash_amount_mist,
        remaining_stake_mist: balance::value(&position.staked),
        slash_count: position.slash_count,
    });

    transfer::public_transfer(coin::from_balance(slashed, ctx), tx_context::sender(ctx));
}
