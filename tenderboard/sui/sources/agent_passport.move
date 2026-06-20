module tenderboard::agent_passport;

use std::string::{Self, String};
use sui::event;
use sui::object::{Self, ID, UID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};

const E_NOT_OWNER: u64 = 1;

/// Owner-held Sui identity object for a WalrusProof worker agent.
///
/// Walrus stores the full memory/evidence set. This object makes the agent's
/// passport Sui-native: transferable by the owner, inspectable by other apps,
/// and linkable to receipt anchors, stake positions, and challenge history.
public struct AgentPassport has key {
    id: UID,
    owner: address,
    agent_id: String,
    display_name: String,
    metadata_blob_id: String,
    metadata_hash: String,
    memory_index_blob_id: String,
    latest_record_hash: String,
    latest_walrus_blob_id: String,
    latest_sui_anchor_digest: String,
    stake_position_id: String,
    record_count: u64,
    walrus_record_count: u64,
    anchored_record_count: u64,
    challenge_count: u64,
    slash_count: u64,
}

public struct AgentPassportMinted has copy, drop {
    sender: address,
    owner: address,
    passport_id: ID,
    agent_id: String,
    display_name: String,
    metadata_blob_id: String,
    metadata_hash: String,
}

public struct AgentPassportMemoryUpdated has copy, drop {
    sender: address,
    owner: address,
    passport_id: ID,
    agent_id: String,
    memory_index_blob_id: String,
    latest_record_hash: String,
    latest_walrus_blob_id: String,
    latest_sui_anchor_digest: String,
    record_count: u64,
    walrus_record_count: u64,
    anchored_record_count: u64,
}

public struct AgentPassportStakeAttached has copy, drop {
    sender: address,
    passport_id: ID,
    agent_id: String,
    stake_position_id: String,
}

public struct AgentPassportChallengeRecorded has copy, drop {
    sender: address,
    passport_id: ID,
    agent_id: String,
    evidence_hash: String,
    challenge_count: u64,
    slash_count: u64,
}

public entry fun mint_passport(
    agent_id: vector<u8>,
    display_name: vector<u8>,
    metadata_blob_id: vector<u8>,
    metadata_hash: vector<u8>,
    memory_index_blob_id: vector<u8>,
    ctx: &mut TxContext,
) {
    let passport = AgentPassport {
        id: object::new(ctx),
        owner: tx_context::sender(ctx),
        agent_id: string::utf8(agent_id),
        display_name: string::utf8(display_name),
        metadata_blob_id: string::utf8(metadata_blob_id),
        metadata_hash: string::utf8(metadata_hash),
        memory_index_blob_id: string::utf8(memory_index_blob_id),
        latest_record_hash: string::utf8(b""),
        latest_walrus_blob_id: string::utf8(b""),
        latest_sui_anchor_digest: string::utf8(b""),
        stake_position_id: string::utf8(b""),
        record_count: 0,
        walrus_record_count: 0,
        anchored_record_count: 0,
        challenge_count: 0,
        slash_count: 0,
    };
    let passport_id = object::id(&passport);
    event::emit(AgentPassportMinted {
        sender: tx_context::sender(ctx),
        owner: tx_context::sender(ctx),
        passport_id,
        agent_id: passport.agent_id,
        display_name: passport.display_name,
        metadata_blob_id: passport.metadata_blob_id,
        metadata_hash: passport.metadata_hash,
    });
    transfer::transfer(passport, tx_context::sender(ctx));
}

public entry fun update_memory_pointer(
    passport: &mut AgentPassport,
    memory_index_blob_id: vector<u8>,
    latest_record_hash: vector<u8>,
    latest_walrus_blob_id: vector<u8>,
    latest_sui_anchor_digest: vector<u8>,
    record_count: u64,
    walrus_record_count: u64,
    anchored_record_count: u64,
    ctx: &mut TxContext,
) {
    assert_owner(passport, ctx);

    passport.memory_index_blob_id = string::utf8(memory_index_blob_id);
    passport.latest_record_hash = string::utf8(latest_record_hash);
    passport.latest_walrus_blob_id = string::utf8(latest_walrus_blob_id);
    passport.latest_sui_anchor_digest = string::utf8(latest_sui_anchor_digest);
    passport.record_count = record_count;
    passport.walrus_record_count = walrus_record_count;
    passport.anchored_record_count = anchored_record_count;

    event::emit(AgentPassportMemoryUpdated {
        sender: tx_context::sender(ctx),
        owner: passport.owner,
        passport_id: object::id(passport),
        agent_id: passport.agent_id,
        memory_index_blob_id: passport.memory_index_blob_id,
        latest_record_hash: passport.latest_record_hash,
        latest_walrus_blob_id: passport.latest_walrus_blob_id,
        latest_sui_anchor_digest: passport.latest_sui_anchor_digest,
        record_count,
        walrus_record_count,
        anchored_record_count,
    });
}

public entry fun update_metadata(
    passport: &mut AgentPassport,
    display_name: vector<u8>,
    metadata_blob_id: vector<u8>,
    metadata_hash: vector<u8>,
    ctx: &mut TxContext,
) {
    assert_owner(passport, ctx);

    passport.display_name = string::utf8(display_name);
    passport.metadata_blob_id = string::utf8(metadata_blob_id);
    passport.metadata_hash = string::utf8(metadata_hash);
}

public entry fun attach_stake_position(
    passport: &mut AgentPassport,
    stake_position_id: vector<u8>,
    ctx: &mut TxContext,
) {
    assert_owner(passport, ctx);

    passport.stake_position_id = string::utf8(stake_position_id);
    event::emit(AgentPassportStakeAttached {
        sender: tx_context::sender(ctx),
        passport_id: object::id(passport),
        agent_id: passport.agent_id,
        stake_position_id: passport.stake_position_id,
    });
}

public entry fun record_challenge(
    passport: &mut AgentPassport,
    evidence_hash: vector<u8>,
    slashed: bool,
    ctx: &mut TxContext,
) {
    passport.challenge_count = passport.challenge_count + 1;
    if (slashed) {
        passport.slash_count = passport.slash_count + 1;
    };

    event::emit(AgentPassportChallengeRecorded {
        sender: tx_context::sender(ctx),
        passport_id: object::id(passport),
        agent_id: passport.agent_id,
        evidence_hash: string::utf8(evidence_hash),
        challenge_count: passport.challenge_count,
        slash_count: passport.slash_count,
    });
}

public fun owner(passport: &AgentPassport): address {
    passport.owner
}

public fun agent_id(passport: &AgentPassport): String {
    passport.agent_id
}

public fun memory_index_blob_id(passport: &AgentPassport): String {
    passport.memory_index_blob_id
}

public fun latest_record_hash(passport: &AgentPassport): String {
    passport.latest_record_hash
}

public fun latest_walrus_blob_id(passport: &AgentPassport): String {
    passport.latest_walrus_blob_id
}

public fun latest_sui_anchor_digest(passport: &AgentPassport): String {
    passport.latest_sui_anchor_digest
}

public fun stake_position_id(passport: &AgentPassport): String {
    passport.stake_position_id
}

public fun record_count(passport: &AgentPassport): u64 {
    passport.record_count
}

public fun walrus_record_count(passport: &AgentPassport): u64 {
    passport.walrus_record_count
}

public fun anchored_record_count(passport: &AgentPassport): u64 {
    passport.anchored_record_count
}

public fun challenge_count(passport: &AgentPassport): u64 {
    passport.challenge_count
}

public fun slash_count(passport: &AgentPassport): u64 {
    passport.slash_count
}

fun assert_owner(passport: &AgentPassport, ctx: &TxContext) {
    assert!(passport.owner == tx_context::sender(ctx), E_NOT_OWNER);
}
