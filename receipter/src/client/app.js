let currentRunId = null;
let eventSource = null;
let timelineEvents = 0;
let currentConfig = null;
let selectedPassportWorkerId = null;
let walletStatus = null;

const el = (id) => document.getElementById(id);

async function boot() {
  ensureReputationPanel();
  const config = await request('/api/config');
  currentConfig = config;
  renderConfig(config);
  await loadMemoryDirectory();
  await loadRunHistory();
}

function renderConfig(config) {
  const badge = el('modeBadge');
  badge.textContent = config.mode;
  badge.className = `badge ${config.mode}`;
  el('paymentCap').textContent = `${config.maxPaymentSui} SUI`;
  renderSuiConfig(config.sui);
  awaitRefreshWalletStatus();

  if (config.mode === 'sui') {
    el('liveReadiness').textContent = config.sui.readyForSui ? 'ready' : 'blocked';
    el('configText').textContent = config.sui.readyForSui
      ? 'Walrus publisher/aggregator and Sui finality settings are configured.'
      : `Missing: ${config.sui.missingSuiSettings.join(', ')}`;
    return;
  }

  el('liveReadiness').textContent = 'sui-dev';
  el('configText').textContent = 'Sui-dev mode creates deterministic Walrus memory ids and Sui finality digests for local demos.';
}

function renderSuiConfig(sui) {
  if (!sui) {
    el('suiReadiness').textContent = 'not configured';
    el('suiConfigText').textContent = 'No Sui settings were returned by the server.';
    return;
  }

  el('suiReadiness').textContent = sui.readyForSui ? 'ready' : 'blocked';
  el('suiConfigText').textContent = sui.readyForSui
    ? `${sui.network} Walrus memory storage and Sui receipt finality are configured.`
    : `Missing: ${sui.missingSuiSettings.join(', ')}`;
}

el('taskForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearTimeline();
  setReceiptText('Creating run...');
  el('receiptStatus').textContent = 'creating';

  const body = {
    title: el('title').value,
    instructions: el('instructions').value,
    privateNotes: el('privateNotes').value,
    acceptanceCriteria: splitLines(el('acceptanceCriteria').value),
    checkerPack: el('checkerPack').value,
    requestedDataLabel: el('requestedDataLabel').value,
    maxPayment: { amount: el('amount').value, currency: 'SUI' },
  };

  try {
    const created = await request('/api/runs', { method: 'POST', body });
    currentRunId = created.runId;
    el('sanitizedPreview').textContent = created.sanitizedTask;
    el('paymentBox').classList.remove('hidden');
    openEvents(created.runId);
    await refreshReceipt();
    await loadMemoryDirectory();
    await loadRunHistory();
  } catch (error) {
    setReceiptText(error.message, true);
  }
});

el('approveBtn').addEventListener('click', async () => {
  if (!currentRunId) return;
  el('approveBtn').disabled = true;
  try {
    const body = {};
    if (currentConfig?.mode === 'sui') {
      const signing = await request(`/api/runs/${currentRunId}/payment-transaction`);
      const { verified } = await executeWalletSigning(signing);
      renderWalletStatus();
      renderReceipt(verified.receipt || verified);
      await loadMemoryDirectory();
      await loadRunHistory();
      return;
    }
    await request(`/api/runs/${currentRunId}/approve-payment`, { method: 'POST', body });
    await refreshReceipt();
    await loadMemoryDirectory();
    await loadRunHistory();
  } catch (error) {
    setReceiptText(error.message, true);
  } finally {
    el('approveBtn').disabled = false;
  }
});

el('submitDeliveryBtn').addEventListener('click', async () => {
  if (!currentRunId) return;
  el('submitDeliveryBtn').disabled = true;
  try {
    await request(`/api/runs/${currentRunId}/worker-delivery`, { method: 'POST', body: {} });
    await refreshReceipt();
    await loadMemoryDirectory();
    await loadRunHistory();
  } catch (error) {
    setReceiptText(error.message, true);
  } finally {
    el('submitDeliveryBtn').disabled = false;
  }
});

el('storeEvidenceBtn').addEventListener('click', async () => {
  if (!currentRunId) return;
  el('storeEvidenceBtn').disabled = true;
  try {
    await request(`/api/runs/${currentRunId}/store-evidence`, { method: 'POST' });
    await refreshReceipt();
    await loadMemoryDirectory();
    await loadRunHistory();
  } catch (error) {
    setReceiptText(error.message, true);
  } finally {
    el('storeEvidenceBtn').disabled = false;
  }
});

el('anchorReceiptBtn').addEventListener('click', async () => {
  if (!currentRunId) return;
  el('anchorReceiptBtn').disabled = true;
  try {
    const body = {};
    if (currentConfig?.mode === 'sui') {
      const signing = await request(`/api/runs/${currentRunId}/anchor-transaction`);
      const { verified } = await executeWalletSigning(signing);
      renderWalletStatus();
      renderReceipt(verified.receipt || verified);
      await loadMemoryDirectory();
      await loadRunHistory();
      return;
    }
    await request(`/api/runs/${currentRunId}/anchor-receipt`, { method: 'POST', body });
    await refreshReceipt();
    await loadMemoryDirectory();
    await loadRunHistory();
  } catch (error) {
    setReceiptText(error.message, true);
  } finally {
    el('anchorReceiptBtn').disabled = false;
  }
});

el('cancelBtn').addEventListener('click', async () => {
  if (!currentRunId) return;
  try {
    await request(`/api/runs/${currentRunId}/cancel`, { method: 'POST' });
    await refreshReceipt();
    await loadMemoryDirectory();
    await loadRunHistory();
  } catch (error) {
    setReceiptText(error.message, true);
  }
});

el('refreshRunsBtn').addEventListener('click', () => {
  loadRunHistory().catch((error) => setReceiptText(error.message, true));
});

el('refreshMemoryBtn').addEventListener('click', () => {
  loadMemoryDirectory().catch((error) => setPassportError(error.message));
});

el('runHistory').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-run]');
  if (!button) return;
  currentRunId = button.dataset.run;
  clearTimeline();
  openEvents(currentRunId);
  await refreshReceipt();
});

el('passportDirectory').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-worker]');
  if (!button) return;
  selectedPassportWorkerId = button.dataset.worker;
  await openPassport(selectedPassportWorkerId);
});

el('passportInspector').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-verify-run]');
  if (!button) return;
  const runId = button.dataset.verifyRun;
  button.disabled = true;
  button.textContent = 'Verifying';
  try {
    const result = await request(`/api/oracle/records/${encodeURIComponent(runId)}/verify`);
    renderRecordVerification(runId, result);
  } catch (error) {
    renderRecordVerification(runId, { verified: false, error: error.message, checks: [] });
  } finally {
    button.disabled = false;
    button.textContent = 'Verify';
  }
});

function openEvents(runId) {
  if (eventSource) eventSource.close();
  eventSource = new EventSource(`/api/runs/${runId}/events`);
  eventSource.addEventListener('update', (message) => {
    const event = JSON.parse(message.data);
    addTimelineEvent(event);
    refreshReceipt().catch(() => {});
  });
  eventSource.onerror = () => {
    addTimelineEvent({
      at: new Date().toISOString(),
      source: 'app',
      type: 'event_stream_error',
      message: 'Live event stream disconnected.',
    });
  };
}

async function refreshReceipt() {
  if (!currentRunId) return;
  const receipt = await request(`/api/runs/${currentRunId}`);
  renderReceipt(receipt);
}

async function loadRunHistory() {
  const runs = await request('/api/runs');
  if (!runs.length) {
    el('runHistory').textContent = 'No runs yet.';
    return;
  }

  el('runHistory').innerHTML = runs
    .map(
      (run) =>
        `<div class="runRow">
          <div>
            <strong>${escapeHtml(run.taskTitle)}</strong>
            <div class="small">${escapeHtml(run.runId)}</div>
          </div>
          <span class="rowBadge">${escapeHtml(run.status)}</span>
          <span>${escapeHtml(run.mode)}</span>
          <div class="runActions">
            <button class="secondary compact" data-run="${escapeHtml(run.runId)}">Open</button>
            <a href="/api/runs/${encodeURIComponent(run.runId)}/receipt">Receipt</a>
          </div>
        </div>`,
    )
    .join('');
}

async function loadMemoryDirectory() {
  const index = await request('/api/walrus/memory');
  const nextWorkerId = selectedPassportWorkerId || index.passports?.[0]?.workerAgentId;
  selectedPassportWorkerId = nextWorkerId || null;
  renderMemoryIndex(index);
  if (nextWorkerId) {
    await openPassport(nextWorkerId);
  } else {
    el('passportInspector').textContent = 'No memory records yet. Create and anchor a run to populate worker passports.';
  }
}

function renderMemoryIndex(index) {
  el('memoryIndexStats').innerHTML = `
    <div><strong>${escapeHtml(index.workerCount)}</strong><span>workers</span></div>
    <div><strong>${escapeHtml(index.totalMemoryRecords)}</strong><span>records</span></div>
    <div><strong>${escapeHtml(index.walrusBackedRecords)}</strong><span>Walrus-backed</span></div>
    <div><strong>${escapeHtml(index.suiAnchoredRecords)}</strong><span>Sui-anchored</span></div>
    <div><strong>${escapeHtml(index.averageClaimSupport ?? 'none')}</strong><span>avg support</span></div>`;

  const passports = index.passports || [];
  if (!passports.length) {
    el('passportDirectory').textContent = 'No worker passports yet.';
    return;
  }

  el('passportDirectory').innerHTML = passports
    .map(
      (passport) => `<button class="passportDirectoryCard ${passport.workerAgentId === selectedPassportWorkerId ? 'selected' : ''}" type="button" data-worker="${escapeHtml(passport.workerAgentId)}">
        <span>${escapeHtml(passport.workerAgentId)}</span>
        <strong>${escapeHtml(passport.memoryCount)} records</strong>
        <small>${escapeHtml(passport.walrusMemoryCount)} Walrus / ${escapeHtml(passport.anchoredMemoryCount)} Sui / ${escapeHtml(passport.averageClaimSupport ?? 'no score')} support</small>
      </button>`,
    )
    .join('');
}

async function openPassport(workerAgentId) {
  const passport = await request(`/api/walrus/memory/${encodeURIComponent(workerAgentId)}`);
  renderPassportInspector(passport);
}

function renderPassportInspector(passport) {
  const records = passport.records || [];
  el('passportInspector').innerHTML = `
    <div class="passportInspectorHeader">
      <div>
        <strong>${escapeHtml(passport.workerAgentId)}</strong>
        <small>${escapeHtml(passport.ownerAddress || 'unbound owner')} / ${escapeHtml(passport.ownership?.proof || 'unbound')}</small>
      </div>
      <div>
        <strong>${escapeHtml(passport.averageClaimSupport ?? 'none')}</strong>
        <small>average claim support</small>
      </div>
    </div>
    <div class="passportRecordList">
      ${
        records.length
          ? records.map((record) => renderPassportRecord(record)).join('')
          : '<div class="passportRecord">This worker has no records yet.</div>'
      }
    </div>`;
}

function renderPassportRecord(record) {
  const walrusLink = record.walrusReadUrl
    ? `<a href="${escapeHtml(record.walrusReadUrl)}" target="_blank" rel="noreferrer">Open on Walrus</a>`
    : '<span>Walrus link pending</span>';
  return `<article class="passportRecord" data-record-run="${escapeHtml(record.runId)}">
    <div class="passportRecordTop">
      <div>
        <strong>${escapeHtml(record.taskTitle)}</strong>
        <small>${escapeHtml(record.runId)} / ${escapeHtml(record.memoryId)}</small>
      </div>
      <span class="rowBadge">${escapeHtml(record.evidenceStrength)}</span>
    </div>
    <div class="passportRecordGrid">
      <div><strong>Claim support</strong><span>${escapeHtml(record.averageClaimSupport ?? 'none')}</span></div>
      <div><strong>Supported</strong><span>${escapeHtml(record.supportedClaimCount)}/${escapeHtml(record.claimCount)}</span></div>
      <div><strong>Walrus blob</strong><span>${escapeHtml(record.walrusBlobId || 'pending')}</span></div>
      <div><strong>Sui anchor</strong><span>${escapeHtml(record.suiAnchorDigest || 'pending')}</span></div>
      <div><strong>Memory hash</strong><span>${escapeHtml(record.memoryHash)}</span></div>
    </div>
    <div class="passportRecordActions">
      ${walrusLink}
      <a href="/api/runs/${encodeURIComponent(record.runId)}/memory">Memory JSON</a>
      <button class="secondary compact" type="button" data-verify-run="${escapeHtml(record.runId)}">Verify</button>
    </div>
    <div id="verify-${escapeHtml(record.runId)}" class="recordVerification">Not verified in this browser session.</div>
  </article>`;
}

function renderRecordVerification(runId, result) {
  const target = el(`verify-${runId}`);
  if (!target) return;
  const checks = result.checks || [];
  target.innerHTML = `
    <div class="verificationSummary ${result.verified ? 'passed' : 'failed'}">
      <strong>${result.verified ? 'Verified' : 'Not verified'}</strong>
      <span>${escapeHtml(result.error || result.memoryHash || 'record verification complete')}</span>
    </div>
    ${
      checks.length
        ? `<div class="verificationChecks">${checks
            .map((check) => `<span class="${escapeHtml(check.status)}">${escapeHtml(check.id)}: ${escapeHtml(check.status)}</span>`)
            .join('')}</div>`
        : ''
    }`;
}

function setPassportError(message) {
  el('passportInspector').innerHTML = `<div class="receiptRow error">${escapeHtml(message)}</div>`;
}

function renderReceipt(receipt) {
  el('receiptStatus').textContent = receipt.status;
  el('paymentBox').classList.toggle('hidden', receipt.status !== 'awaiting_payment_approval');
  el('workerDeliveryBox').classList.toggle('hidden', receipt.status !== 'working');
  const canFinalize = ['delivered', 'anchoring', 'anchored'].includes(receipt.status);
  el('finalizationBox').classList.toggle('hidden', !canFinalize);
  el('submitDeliveryBtn').disabled = receipt.status !== 'working';
  el('storeEvidenceBtn').disabled = receipt.status !== 'delivered';
  el('anchorReceiptBtn').disabled = receipt.status !== 'anchoring' || !receipt.walrusBlobId;
  renderWorkerBidBoard(receipt);
  renderTrustProof(receipt);
  renderSuiRail(receipt);
  renderAgentPair(receipt);
  renderReputationPassport(receipt);

  const rows = [
    ['Run id', receipt.runId],
    ['Status', receipt.status],
    ['Mode', receipt.mode],
    ['Worker agent', receipt.workerAgentId || 'not configured'],
    ['Requested data label', receipt.privacy?.requestedDataLabel || receipt.workerBidBoard?.requestedDataLabel || 'public'],
    ['Selected bid', receipt.workerBidBoard?.selectedBidId || 'none'],
    ['Sui network', receipt.suiNetwork || 'not configured'],
    ['Sui package', receipt.suiPackageId || 'not configured'],
    ['Receipt registry', receipt.suiReceiptRegistryId || 'not configured'],
    ['Payment URI', receipt.paymentIntentPlan?.paymentUri || receipt.receiptPlan?.paymentUri || 'not planned'],
    ['PaymentKit mode', receipt.paymentIntentPlan?.paymentKitMode || receipt.receiptPlan?.paymentKitMode || 'not planned'],
    ['Work order object', receipt.suiWorkOrderObjectId || 'pending real Sui tx'],
    ['Escrow object', receipt.suiEscrowObjectId || 'pending real Sui tx'],
    ['Trust tier', receipt.trustDecision ? `${receipt.trustDecision.tier} / ${receipt.trustDecision.score}` : 'not evaluated'],
    ['Spec hash', receipt.verificationManifest?.specHash || 'not anchored'],
    ['Evidence hash', receipt.verificationManifest?.evidenceHash || 'not finalized'],
    ['Sui anchor plan', receipt.verificationManifest?.evidenceHash && receipt.walrusBlobId ? `npm run sui:anchor-plan ${receipt.runId}` : 'store Walrus evidence first'],
    ['Sui work order', receipt.workOrderId || 'not created yet'],
    ['Sui payment digest', receipt.suiPaymentDigest || 'not paid yet'],
    ['Walrus blob', receipt.walrusBlobId || 'not uploaded yet'],
    ['Walrus blob object', receipt.walrusBlobObjectId || 'not uploaded yet'],
    ['Walrus read URL', receipt.walrusReadUrl || 'not uploaded yet'],
    ['Walrus end epoch', receipt.walrusEndEpoch ?? 'not uploaded yet'],
    ['Agent memory', receipt.memoryRecord?.memoryId || 'not recorded yet'],
    ['Memory evidence strength', receipt.memoryRecord?.evidenceStrength || 'not recorded yet'],
    ['Memory settlement action', receipt.memoryRecord?.settlementAction || 'not recorded yet'],
    ['Sui anchor digest', receipt.suiAnchorDigest || 'not anchored yet'],
    ['Delivery', receipt.deliveryText || 'not delivered yet'],
  ];

  const receiptLink = `<div class="receiptRow receiptDownload"><a href="/api/runs/${encodeURIComponent(receipt.runId)}/receipt">Download receipt JSON</a> <a href="/api/runs/${encodeURIComponent(receipt.runId)}/memory">Memory record JSON</a> <a href="/api/walrus/memory/${encodeURIComponent(receipt.workerAgentId)}">Worker memory passport</a></div>`;
  el('receipt').innerHTML =
    rows.map(([label, value]) => `<div class="receiptRow"><strong>${escapeHtml(label)}</strong><span>${formatReceiptValue(value)}</span></div>`).join('') +
    receiptLink;
}

function ensureReputationPanel() {
  if (el('reputationPassport')) return;
  const panel = document.createElement('section');
  panel.className = 'panel reputationPanel';
  panel.setAttribute('aria-label', 'Worker reputation passport');
  panel.innerHTML = `
    <div class="panelHeader">
      <div>
        <p class="eyebrow">Walrus Memory Passport</p>
        <h2>Durable worker memory</h2>
      </div>
      <span id="reputationStatus" class="statusPill">waiting</span>
    </div>
    <div id="reputationPassport" class="reputationPassport">Create a run to view the selected worker memory passport.</div>`;
  const bidPanel = document.querySelector('.bidBoardPanel');
  bidPanel?.parentNode?.insertBefore(panel, bidPanel);
}

function renderAgentPair(receipt) {
  const status = el('agentPairStatus');
  const target = el('agentPair');
  if (!status || !target) return;
  if (!receipt.hirerAgent || !receipt.workerAgent || !receipt.agentHandoff) {
    status.textContent = 'waiting';
    status.className = 'statusPill';
    target.textContent = 'Create a run to see the hirer/worker handoff.';
    return;
  }

  status.textContent = receipt.agentHandoff.status;
  status.className = `statusPill ${receipt.agentHandoff.status === 'anchored' ? 'verdict-allow' : ''}`;
  target.innerHTML = `
    <div class="agentPairGrid">
      ${renderAgentCard(receipt.hirerAgent)}
      <div class="handoffCard">
        <strong>Handoff</strong>
        <span>${escapeHtml(receipt.agentHandoff.selectedBidId || 'none')}</span>
        <small>${escapeHtml(receipt.agentHandoff.safePacketHash)}</small>
      </div>
      ${renderAgentCard(receipt.workerAgent)}
    </div>
    <div class="agentControls">
      <div><strong>Spec</strong><span>${escapeHtml(receipt.agentHandoff.specHash)}</span></div>
      <div><strong>Payment intent</strong><span>${escapeHtml(receipt.agentHandoff.paymentIntentId || 'not planned')}</span></div>
    </div>`;
}

function renderAgentCard(agent) {
  return `<article class="agentCard ${escapeHtml(agent.role)}">
    <span>${escapeHtml(agent.role)}</span>
    <strong>${escapeHtml(agent.displayName)}</strong>
    <small>${escapeHtml(agent.agentId)}</small>
    <div class="agentMeta">
      <em>${agent.budgetSui ? `${escapeHtml(agent.budgetSui)} SUI budget` : `${escapeHtml(agent.priceSui || '0')} SUI bid`}</em>
      <em>${escapeHtml(agent.requestedDataLabel)} data</em>
    </div>
    <ul>${(agent.responsibilities || []).slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
  </article>`;
}

function renderWorkerBidBoard(receipt) {
  const board = receipt.workerBidBoard;
  if (!board) {
    el('bidBoardStatus').textContent = 'legacy';
    el('bidBoardStatus').className = 'statusPill';
    el('bidBoard').textContent = 'This older receipt was created before worker bid boards were stored.';
    return;
  }

  const availableCount = (board.bids || []).filter((bid) => bid.verdict === 'available').length;
  const blockedCount = (board.bids || []).filter((bid) => bid.verdict === 'blocked').length;
  el('bidBoardStatus').textContent = `${availableCount} available / ${blockedCount} blocked`;
  el('bidBoardStatus').className = availableCount > 0 ? 'statusPill verdict-allow' : 'statusPill verdict-block';

  el('bidBoard').innerHTML = `
    <div class="bidSummary">
      <div><strong>Buyer max</strong><span>${escapeHtml(board.buyerMaxPayment.amount)} ${escapeHtml(board.buyerMaxPayment.currency)}</span></div>
      <div><strong>Task label</strong><span>${escapeHtml(board.requestedDataLabel)}</span></div>
      <div><strong>Selected bid</strong><span>${escapeHtml(board.selectedBidId || 'none')}</span></div>
      <div><strong>Boundary</strong><span>${escapeHtml(receipt.privacy?.workerDataBoundary || 'Public worker packet only.')}</span></div>
    </div>
    <div class="bidRows">
      ${(board.bids || [])
        .map(
          (bid) => `<div class="bidRow ${escapeHtml(bid.verdict)}">
            <div>
              <strong>${escapeHtml(bid.workerAgentId)}</strong>
              <small>${escapeHtml(bid.bidId)}</small>
            </div>
            <span>${escapeHtml(bid.priceSui)} SUI</span>
            <span>${escapeHtml(bid.sla)}</span>
            <span>${escapeHtml(bid.requestedDataLabel)}</span>
            <span class="rowBadge">${escapeHtml(bid.verdict)}</span>
            <div>
              <strong>${escapeHtml((bid.riskFlags || []).join(', ') || 'none')}</strong>
              <small>${escapeHtml(bid.reason)}</small>
            </div>
          </div>`,
        )
        .join('')}
    </div>`;
}

function renderSuiRail(receipt) {
  const paymentPlan = receipt.paymentIntentPlan || receipt.receiptPlan;
  const steps = [
    {
      label: 'Work order object',
      done: Boolean(receipt.workOrderId),
      detail: receipt.suiWorkOrderObjectId || receipt.workOrderId || 'pending',
    },
    {
      label: 'SUI approval',
      done: Boolean(receipt.suiPaymentDigest),
      detail: receipt.suiPaymentDigest || 'waiting for operator approval',
    },
    {
      label: 'Walrus memory blob',
      done: Boolean(receipt.walrusBlobId),
      detail: receipt.walrusBlobId || 'waiting for memory storage',
    },
    {
      label: 'Sui receipt registry',
      done: Boolean(receipt.suiAnchorDigest),
      detail: receipt.suiAnchorDigest || 'waiting for anchor transaction',
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  el('chainStatus').textContent = `${doneCount}/4 memory steps`;
  const paymentCard = paymentPlan
    ? `<div class="paymentIntentCard">
        <div>
          <strong>PaymentKit-compatible URI</strong>
          <small>${escapeHtml(paymentPlan.paymentKitMode || 'metadata only')}</small>
        </div>
        <code>${escapeHtml(paymentPlan.paymentUri || 'not planned')}</code>
        <div class="paymentMeta">
          <span>${escapeHtml(paymentPlan.amountMist || '0')} MIST</span>
          <span>${escapeHtml(paymentPlan.coinType || '0x2::sui::SUI')}</span>
          <span>${escapeHtml(paymentPlan.expectedNetwork || receipt.suiNetwork || 'testnet')}</span>
        </div>
      </div>`
    : '';

  el('suiRail').innerHTML = steps
    .map(
      (step, index) => `<div class="railStep ${step.done ? 'done' : 'pending'}">
        <span class="railIndex">${index + 1}</span>
        <strong>${escapeHtml(step.label)}</strong>
        <small>${escapeHtml(step.detail)}</small>
      </div>`,
    )
    .join('') + paymentCard;
}

function renderReputationPassport(receipt) {
  const status = el('reputationStatus');
  const target = el('reputationPassport');
  if (!status || !target) return;
  const snapshot = receipt.reputationSnapshot;
  if (!snapshot) {
    status.textContent = 'legacy';
    status.className = 'statusPill';
    target.textContent = 'This receipt does not include a worker reputation snapshot.';
    return;
  }

  status.textContent = receipt.status === 'anchored' ? 'updated' : 'pre-run';
  status.className = `statusPill ${receipt.status === 'anchored' ? 'verdict-allow' : ''}`;
  target.innerHTML = `
    <div class="passportHero">
      <div>
        <strong>${escapeHtml(snapshot.workerAgentId)}</strong>
        <small>${escapeHtml(snapshot.memoryCount ?? 0)} memory record${snapshot.memoryCount === 1 ? '' : 's'} / ${escapeHtml(snapshot.anchoredRunCount)} Sui anchored</small>
      </div>
      <div>
        <strong>${escapeHtml(snapshot.averageTrustScore ?? 'none')}</strong>
        <small>average trust</small>
      </div>
    </div>
    <div class="passportGrid">
      <div><strong>Memory records</strong><span>${escapeHtml(snapshot.memoryCount ?? 0)}</span></div>
      <div><strong>Walrus proofs</strong><span>${escapeHtml(snapshot.walrusEvidenceCount)}</span></div>
      <div><strong>Claim support</strong><span>${escapeHtml(snapshot.averageClaimSupport ?? 'none')}</span></div>
      <div><strong>Source observations</strong><span>${escapeHtml(snapshot.sourceEvidenceCount)}</span></div>
      <div><strong>Tier counts</strong><span>AAA ${escapeHtml(snapshot.tierCounts.AAA)} / AA ${escapeHtml(snapshot.tierCounts.AA)} / A ${escapeHtml(snapshot.tierCounts.A)}</span></div>
      <div><strong>Last run</strong><span>${escapeHtml(snapshot.lastAnchoredRunId || 'none')}</span></div>
      <div><strong>Last memory</strong><span>${escapeHtml(snapshot.lastMemoryId || 'none')}</span></div>
      <div><strong>Last blob</strong><span>${escapeHtml(snapshot.lastWalrusBlobId || 'none')}</span></div>
      <div><strong>Last evidence hash</strong><span>${escapeHtml(snapshot.lastEvidenceHash || 'none')}</span></div>
    </div>`;
}

function renderTrustProof(receipt) {
  if (!receipt.trustDecision || !receipt.verificationManifest) {
    el('trustVerdict').textContent = 'legacy';
    el('trustVerdict').className = 'statusPill';
    el('trustDecision').textContent = 'This older receipt was created before trust decisions were stored.';
    el('manifestHash').textContent = 'legacy';
    el('manifestChecks').textContent = 'This older receipt was created before verification manifests were stored.';
    return;
  }

  const trust = receipt.trustDecision;
  el('trustVerdict').textContent = `${trust.verdict} / ${trust.tier}`;
  el('trustVerdict').className = `statusPill verdict-${trust.verdict}`;
  el('trustDecision').innerHTML = `
    <div class="scoreBlock">
      <strong>${escapeHtml(trust.score)}/100</strong>
      <span>${escapeHtml(trust.workerAgentId)} / price x${escapeHtml(trust.pricedMultiplier)}</span>
    </div>
    <div class="proofColumns">
      <div>
        <h3>Reasons</h3>
        <ul>${trust.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>
      </div>
      <div>
        <h3>Controls</h3>
        <ul>${trust.controls.map((control) => `<li>${escapeHtml(control)}</li>`).join('')}</ul>
      </div>
    </div>`;

  const manifest = receipt.verificationManifest;
  const memory = manifest.workerMemory;
  const memoryBlock = memory
    ? `<div class="hashLine"><strong>Worker memory</strong><span>${escapeHtml(memory.memoryCount)} records / ${escapeHtml(memory.walrusMemoryCount)} Walrus / ${escapeHtml(memory.anchoredMemoryCount)} Sui anchored / ${escapeHtml(memory.averageClaimSupport ?? 'no claim score')} avg claim support</span></div>`
    : '';
  el('manifestHash').textContent = manifest.evidenceHash ? 'finalized' : 'pending';
  el('manifestChecks').innerHTML = `
    <div class="hashLine"><strong>Checker pack</strong><span>${escapeHtml(manifest.checkerPack || 'research')}</span></div>
    <div class="hashLine"><strong>Spec</strong><span>${escapeHtml(manifest.specHash)}</span></div>
    <div class="hashLine"><strong>Evidence</strong><span>${escapeHtml(manifest.evidenceHash || 'waiting for delivery')}</span></div>
    ${memoryBlock}
    <div class="criteriaList">
      <strong>Acceptance criteria</strong>
      <ol>${(manifest.acceptanceCriteria || []).map((criterion) => `<li>${escapeHtml(criterion)}</li>`).join('')}</ol>
    </div>
    <div class="checkList">
      ${manifest.requiredChecks
        .map(
          (check) => `<div class="checkRow ${escapeHtml(check.status)}">
            <span>${escapeHtml(check.status)}</span>
            <div><strong>${escapeHtml(check.label)}</strong><small>${escapeHtml(check.detail)}</small></div>
          </div>`,
        )
        .join('')}
    </div>`;
}

function addTimelineEvent(event) {
  timelineEvents += 1;
  el('timelineCount').textContent = `${timelineEvents} event${timelineEvents === 1 ? '' : 's'}`;

  const item = document.createElement('li');
  item.className = `eventItem ${escapeHtml(event.source)}`;
  item.innerHTML = `
    <span class="eventDot"></span>
    <div>
      <strong>${escapeHtml(event.message)}</strong>
      <span>${escapeHtml(event.source)} / ${escapeHtml(event.type)} / ${escapeHtml(event.at)}</span>
    </div>`;
  el('timeline').appendChild(item);
}

function clearTimeline() {
  timelineEvents = 0;
  el('timeline').innerHTML = '';
  el('timelineCount').textContent = '0 events';
}

function setReceiptText(text, error = false) {
  el('receipt').innerHTML = `<div class="receiptRow ${error ? 'error' : ''}">${escapeHtml(text)}</div>`;
  el('receiptStatus').textContent = error ? 'error' : 'waiting';
  if (error) {
    el('trustVerdict').textContent = 'error';
    el('manifestHash').textContent = 'error';
    el('bidBoardStatus').textContent = 'error';
    if (el('reputationStatus')) el('reputationStatus').textContent = 'error';
  }
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || `Request failed: ${response.status}`);
  return json;
}

async function awaitRefreshWalletStatus() {
  if (!window.ReceipterWallet) return;
  try {
    walletStatus = await window.ReceipterWallet.status('sui:testnet');
    renderWalletStatus();
  } catch {
    walletStatus = null;
  }
}

async function executeWalletSigning(signing) {
  if (!window.ReceipterWallet) throw new Error('Wallet adapter still loading.');
  const execution = await window.ReceipterWallet.signAndExecute(signing.walletTransactionRequest);
  walletStatus = { connected: true, walletName: execution.walletName, address: execution.address, chain: execution.chain };
  if (signing.paymentPayloadTemplate) {
    const payload = { ...signing.paymentPayloadTemplate, transaction: execution.digest };
    return { execution, verified: await request(signing.verifyEndpoint, { method: 'POST', body: payload }) };
  }
  if (signing.anchorPayloadTemplate) {
    const anchorPayload = { ...signing.anchorPayloadTemplate, transaction: execution.digest };
    return { execution, verified: await request(signing.verifyEndpoint, { method: 'POST', body: { anchorPayload } }) };
  }
  throw new Error('Unsupported Receipter signing request.');
}

function renderWalletStatus() {
  const target = el('walletStatus');
  if (!target || !walletStatus?.address) return;
  target.textContent = `${walletStatus.walletName || 'Sui wallet'} / ${formatReceiptValue(walletStatus.address)}`;
}

function formatReceiptValue(value) {
  const escaped = escapeHtml(value);
  if (escaped.length < 220) return escaped;
  return `${escaped.slice(0, 220)}...`;
}

function splitLines(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

boot().catch((error) => setReceiptText(error.message, true));
