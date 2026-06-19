module tenderboard::receipts;

use std::string::{Self, String};
use std::vector;
use sui::event;
use sui::object::{Self, UID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};

const E_DUPLICATE_RECEIPT: u64 = 1;

/// Shared anchor registry for TenderBoard proof receipts.
///
/// The full receipt and worker evidence should live in Walrus. Sui stores the
/// durable verification event: hashes, score, checker pack, payment reference,
/// and Walrus blob id.
public struct Registry has key {
    id: UID,
    receipt_count: u64,
    reputation_update_count: u64,
    duplicate_prevention_keys: vector<vector<u8>>,
}

public struct ReceiptAnchored has copy, drop {
    sequence: u64,
    sender: address,
    run_id: vector<u8>,
    spec_hash: vector<u8>,
    evidence_hash: vector<u8>,
    trust_score: u16,
    trust_verdict: vector<u8>,
    checker_pack: vector<u8>,
    payment_reference: vector<u8>,
    walrus_blob_id: vector<u8>,
    payment_nonce: vector<u8>,
    amount_mist: vector<u8>,
    coin_type: vector<u8>,
    receiver: vector<u8>,
    settlement_nonce: vector<u8>,
    duplicate_prevention_key: vector<u8>,
}

public struct WorkerReputationUpdated has copy, drop {
    sequence: u64,
    receipt_sequence: u64,
    sender: address,
    worker_agent_id: vector<u8>,
    anchored_run_count: u64,
    walrus_evidence_count: u64,
    source_evidence_count: u64,
    average_trust_score: u16,
    tier_counts: vector<u8>,
    total_mist_earned: vector<u8>,
    last_run_id: vector<u8>,
    last_walrus_blob_id: vector<u8>,
    last_evidence_hash: vector<u8>,
}

public struct PaymentIntentRecorded has copy, drop {
    sender: address,
    run_id: String,
    resource: String,
    payment_intent_id: String,
    payment_nonce: String,
    settlement_nonce: String,
    amount_mist: String,
    receiver: String,
    worker_agent_id: String,
}

fun init(ctx: &mut TxContext) {
    let registry = Registry {
        id: object::new(ctx),
        receipt_count: 0,
        reputation_update_count: 0,
        duplicate_prevention_keys: vector::empty<vector<u8>>(),
    };
    transfer::share_object(registry);
}

public entry fun anchor_receipt(
    registry: &mut Registry,
    run_id: vector<u8>,
    spec_hash: vector<u8>,
    evidence_hash: vector<u8>,
    trust_score: u16,
    trust_verdict: vector<u8>,
    checker_pack: vector<u8>,
    payment_reference: vector<u8>,
    walrus_blob_id: vector<u8>,
    payment_nonce: vector<u8>,
    amount_mist: vector<u8>,
    coin_type: vector<u8>,
    receiver: vector<u8>,
    settlement_nonce: vector<u8>,
    duplicate_prevention_key: vector<u8>,
    worker_agent_id: vector<u8>,
    anchored_run_count: u64,
    walrus_evidence_count: u64,
    source_evidence_count: u64,
    average_trust_score: u16,
    tier_counts: vector<u8>,
    total_mist_earned: vector<u8>,
    ctx: &mut TxContext,
) {
    assert_new_duplicate_prevention_key(registry, &duplicate_prevention_key);
    vector::push_back(&mut registry.duplicate_prevention_keys, copy duplicate_prevention_key);
    registry.receipt_count = registry.receipt_count + 1;

    event::emit(ReceiptAnchored {
        sequence: registry.receipt_count,
        sender: tx_context::sender(ctx),
        run_id: copy run_id,
        spec_hash,
        evidence_hash: copy evidence_hash,
        trust_score,
        trust_verdict,
        checker_pack,
        payment_reference,
        walrus_blob_id: copy walrus_blob_id,
        payment_nonce,
        amount_mist,
        coin_type,
        receiver,
        settlement_nonce,
        duplicate_prevention_key,
    });

    registry.reputation_update_count = registry.reputation_update_count + 1;
    event::emit(WorkerReputationUpdated {
        sequence: registry.reputation_update_count,
        receipt_sequence: registry.receipt_count,
        sender: tx_context::sender(ctx),
        worker_agent_id,
        anchored_run_count,
        walrus_evidence_count,
        source_evidence_count,
        average_trust_score,
        tier_counts,
        total_mist_earned,
        last_run_id: run_id,
        last_walrus_blob_id: walrus_blob_id,
        last_evidence_hash: evidence_hash,
    });
}

public entry fun record_payment_intent(
    run_id: vector<u8>,
    resource: vector<u8>,
    payment_intent_id: vector<u8>,
    payment_nonce: vector<u8>,
    settlement_nonce: vector<u8>,
    amount_mist: vector<u8>,
    receiver: vector<u8>,
    worker_agent_id: vector<u8>,
    ctx: &mut TxContext,
) {
    event::emit(PaymentIntentRecorded {
        sender: tx_context::sender(ctx),
        run_id: string::utf8(run_id),
        resource: string::utf8(resource),
        payment_intent_id: string::utf8(payment_intent_id),
        payment_nonce: string::utf8(payment_nonce),
        settlement_nonce: string::utf8(settlement_nonce),
        amount_mist: string::utf8(amount_mist),
        receiver: string::utf8(receiver),
        worker_agent_id: string::utf8(worker_agent_id),
    });
}

public fun receipt_count(registry: &Registry): u64 {
    registry.receipt_count
}

public fun reputation_update_count(registry: &Registry): u64 {
    registry.reputation_update_count
}

fun assert_new_duplicate_prevention_key(registry: &Registry, duplicate_prevention_key: &vector<u8>) {
    assert!(
        !vector::contains(&registry.duplicate_prevention_keys, duplicate_prevention_key),
        E_DUPLICATE_RECEIPT,
    );
}
