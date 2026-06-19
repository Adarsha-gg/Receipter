module tenderboard::receipts;

use sui::event;
use sui::object::{Self, UID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};

/// Shared anchor registry for TenderBoard proof receipts.
///
/// The full receipt and worker evidence should live in Walrus. Sui stores the
/// durable verification event: hashes, score, checker pack, payment reference,
/// and Walrus blob id.
public struct Registry has key {
    id: UID,
    receipt_count: u64,
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
}

fun init(ctx: &mut TxContext) {
    let registry = Registry {
        id: object::new(ctx),
        receipt_count: 0,
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
    ctx: &mut TxContext,
) {
    registry.receipt_count = registry.receipt_count + 1;

    event::emit(ReceiptAnchored {
        sequence: registry.receipt_count,
        sender: tx_context::sender(ctx),
        run_id,
        spec_hash,
        evidence_hash,
        trust_score,
        trust_verdict,
        checker_pack,
        payment_reference,
        walrus_blob_id,
    });
}

public fun receipt_count(registry: &Registry): u64 {
    registry.receipt_count
}
