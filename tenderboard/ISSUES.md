# TenderBoard Issues Log

This file tracks concrete issues encountered during implementation. Do not use it as a task wishlist.

## Open

None.

## Closed

### TB-ISSUE-001 - npm audit reported one low-severity vulnerability

- Found during: initial dependency install.
- Symptom: npm reported one low-severity advisory through the test toolchain.
- Fix: upgraded Vitest to `4.1.9`.
- Verification: `npm test`, `npm run typecheck`, and `npm audit --audit-level=low` passed after the fix.

### TB-ISSUE-002 - public demo export leaked internal request fields

- Found during: early generated-artifact verification.
- Symptom: a JSON export contained internal request fields that should not be worker-visible.
- Root cause: the export wrote the internal workflow object directly.
- Fix: added an export-safe representation and kept worker-visible packets separate from local/private data.
- Current relevance: the Sui product keeps this rule by storing sanitized task text in receipts and excluding private notes.

### TB-ISSUE-003 - product server did not start on Windows

- Found during: local server smoke test.
- Symptom: `npm start` exited and `http://127.0.0.1:4174` refused connections.
- Root cause: the server entrypoint check compared URL strings in a way that was not reliable for Windows paths under `tsx`.
- Fix: compare `fileURLToPath(import.meta.url)` to `path.resolve(process.argv[1])`.
- Verification: `npm test`, `npm run typecheck`, and local API smoke tests passed.

### TB-ISSUE-004 - receipt JSON could be corrupted by concurrent events

- Found during integration testing around receipt updates.
- Symptom: reading a receipt could fail with invalid JSON when several async updates wrote the same file quickly.
- Root cause: concurrent write operations used the same temp path.
- Fix: serialized `RunStore` mutations through an internal promise queue.
- Verification: receipt tests, product server tests, `npm test`, and `npm run typecheck` passed.

### TB-ISSUE-005 - generated frontend was not a real product

- Found during product review.
- Symptom: generated HTML was presentation-heavy and not a working operator flow.
- Fix: replaced generated static artifacts with a browser console backed by the local API server.
- Current state: the app now supports task creation, safe preview, trust proof, verification manifest, timeline, receipt download, Walrus evidence storage, and Sui receipt anchoring.
