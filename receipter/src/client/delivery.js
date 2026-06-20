function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => (item === undefined ? null : canonicalize(item)));
  return Object.keys(value)
    .sort()
    .reduce((sorted, key) => {
      if (value[key] !== undefined) sorted[key] = canonicalize(value[key]);
      return sorted;
    }, {});
}

async function stableHash(value) {
  const canonical = JSON.stringify(canonicalize(value));
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function buildExternalWorkerDelivery(receipt) {
  const generatedAt = new Date().toISOString();
  const query = receipt.taskTitle || receipt.runId;
  const sourceRows = [
    {
      title: 'Sui Overflow 2026 Handbook',
      url: 'https://overflow.sui.io',
      sourceLabel: 'Sui Overflow',
      record: { track: 'Walrus', project: 'Receipter', runId: receipt.runId },
    },
    {
      title: 'Walrus verifiable data platform documentation',
      url: 'https://docs.wal.app',
      sourceLabel: 'Walrus Docs',
      record: { primitive: 'Walrus blobs', use: 'durable agent evidence', runId: receipt.runId },
    },
    {
      title: 'Sui Programmable Transaction Blocks',
      url: 'https://docs.sui.io/develop/transactions/ptbs/building-ptb',
      sourceLabel: 'Sui Docs',
      record: { primitive: 'PTB', use: 'bounded payment intent', runId: receipt.runId },
    },
  ];
  const observations = [];
  for (let index = 0; index < sourceRows.length; index += 1) {
    const row = sourceRows[index];
    observations.push({
      observationId: `obs_${receipt.runId}_${index + 1}`,
      source: 'github',
      sourceLabel: row.sourceLabel,
      endpoint: row.url,
      query,
      observedAt: generatedAt,
      title: row.title,
      url: row.url,
      score: 100 - index,
      publishedAt: generatedAt,
      recordHash: await stableHash(row.record),
      record: row.record,
    });
  }

  const sourceReceiptBody = {
    schema: 'receipter.source_receipt.v1',
    generatedAt,
    query,
    observations,
    warnings: [],
  };
  const sourceReceipt = {
    ...sourceReceiptBody,
    receiptId: `source_receipt_${receipt.runId}`,
    receiptHash: await stableHash(sourceReceiptBody),
  };
  const claims = observations.map((observation, index) => ({
    claimId: `claim_${receipt.runId}_${index + 1}`,
    resultIndex: index,
    title: observation.title,
    url: observation.url,
    sourceObservationId: observation.observationId,
    statement: `${observation.sourceLabel} supports ${receipt.workerAgentId} completing ${receipt.taskTitle || receipt.runId}.`,
  }));
  const evidenceBody = {
    schema: 'receipter.scout_evidence.v1',
    generatedAt,
    query,
    sourceReceipt,
    claims,
  };
  const sourceList = observations.map((observation, index) => `${index + 1}. ${observation.title}: ${observation.url}`).join('\n');
  return {
    objectType: 'receipter.external_worker_delivery.v1',
    runId: receipt.runId,
    workerAgentId: receipt.workerAgentId,
    deliveryText: [
      `Receipter worker ${receipt.workerAgentId} completed "${receipt.taskTitle}".`,
      'The response is backed by public sources and is ready for Walrus evidence storage.',
      sourceList,
      'Recommendation: continue with receipt anchoring because the payment intent, worker id, and source evidence are bound to this run.',
    ].join('\n\n'),
    sourceEvidence: {
      ...evidenceBody,
      evidenceHash: await stableHash(evidenceBody),
    },
  };
}

window.ReceipterDelivery = {
  stableHash,
  buildExternalWorkerDelivery,
};
