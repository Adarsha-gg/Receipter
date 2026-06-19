let currentRunId = null;
let eventSource = null;
let timelineEvents = 0;

const el = (id) => document.getElementById(id);

async function boot() {
  const config = await request('/api/config');
  renderConfig(config);
  await loadRunHistory();
}

function renderConfig(config) {
  const badge = el('modeBadge');
  badge.textContent = config.mode;
  badge.className = `badge ${config.mode}`;
  el('paymentCap').textContent = `${config.maxPaymentSui} SUI`;
  renderSuiConfig(config.sui);

  if (config.mode === 'sui') {
    el('liveReadiness').textContent = config.sui.readyForSui ? 'ready' : 'blocked';
    el('configText').textContent = config.sui.readyForSui
      ? 'Sui package, registry, operator, and Walrus endpoints are configured.'
      : `Missing: ${config.sui.missingSuiSettings.join(', ')}`;
    return;
  }

  el('liveReadiness').textContent = 'sui-dev';
  el('configText').textContent = 'Sui-dev mode keeps the Sui work-order and receipt shape without sending real transactions.';
}

function renderSuiConfig(sui) {
  if (!sui) {
    el('suiReadiness').textContent = 'not configured';
    el('suiConfigText').textContent = 'No Sui settings were returned by the server.';
    return;
  }

  el('suiReadiness').textContent = sui.readyForSui ? 'ready' : 'blocked';
  el('suiConfigText').textContent = sui.readyForSui
    ? `${sui.network} package, registry, operator, and Walrus endpoints are configured.`
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
    maxPayment: { amount: el('amount').value, currency: 'SUI' },
  };

  try {
    const created = await request('/api/runs', { method: 'POST', body });
    currentRunId = created.runId;
    el('sanitizedPreview').textContent = created.sanitizedTask;
    el('paymentBox').classList.remove('hidden');
    openEvents(created.runId);
    await refreshReceipt();
    await loadRunHistory();
  } catch (error) {
    setReceiptText(error.message, true);
  }
});

el('approveBtn').addEventListener('click', async () => {
  if (!currentRunId) return;
  el('approveBtn').disabled = true;
  try {
    await request(`/api/runs/${currentRunId}/approve-payment`, { method: 'POST' });
    await refreshReceipt();
    await loadRunHistory();
  } catch (error) {
    setReceiptText(error.message, true);
  } finally {
    el('approveBtn').disabled = false;
  }
});

el('cancelBtn').addEventListener('click', async () => {
  if (!currentRunId) return;
  try {
    await request(`/api/runs/${currentRunId}/cancel`, { method: 'POST' });
    await refreshReceipt();
    await loadRunHistory();
  } catch (error) {
    setReceiptText(error.message, true);
  }
});

el('refreshRunsBtn').addEventListener('click', () => {
  loadRunHistory().catch((error) => setReceiptText(error.message, true));
});

el('runHistory').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-run]');
  if (!button) return;
  currentRunId = button.dataset.run;
  clearTimeline();
  openEvents(currentRunId);
  await refreshReceipt();
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

function renderReceipt(receipt) {
  el('receiptStatus').textContent = receipt.status;
  el('paymentBox').classList.toggle('hidden', receipt.status === 'delivered' || receipt.status === 'cancelled' || receipt.status === 'failed');
  renderTrustProof(receipt);

  const rows = [
    ['Run id', receipt.runId],
    ['Status', receipt.status],
    ['Mode', receipt.mode],
    ['Worker agent', receipt.workerAgentId || 'not configured'],
    ['Sui network', receipt.suiNetwork || 'not configured'],
    ['Sui package', receipt.suiPackageId || 'not configured'],
    ['Receipt registry', receipt.suiReceiptRegistryId || 'not configured'],
    ['Trust tier', receipt.trustDecision ? `${receipt.trustDecision.tier} / ${receipt.trustDecision.score}` : 'not evaluated'],
    ['Spec hash', receipt.verificationManifest?.specHash || 'not anchored'],
    ['Evidence hash', receipt.verificationManifest?.evidenceHash || 'not finalized'],
    ['Sui anchor plan', receipt.verificationManifest?.evidenceHash ? `npm run sui:anchor-plan ${receipt.runId} <walrus_blob_id>` : 'finalize delivery first'],
    ['Sui work order', receipt.workOrderId || 'not created yet'],
    ['Sui payment digest', receipt.suiPaymentDigest || 'not paid yet'],
    ['Walrus blob', receipt.walrusBlobId || 'not uploaded yet'],
    ['Sui anchor digest', receipt.suiAnchorDigest || 'not anchored yet'],
    ['Delivery', receipt.deliveryText || 'not delivered yet'],
  ];

  const receiptLink = `<div class="receiptRow receiptDownload"><a href="/api/runs/${encodeURIComponent(receipt.runId)}/receipt">Download receipt JSON</a></div>`;
  el('receipt').innerHTML =
    rows.map(([label, value]) => `<div class="receiptRow"><strong>${escapeHtml(label)}</strong><span>${formatReceiptValue(value)}</span></div>`).join('') +
    receiptLink;
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
  el('manifestHash').textContent = manifest.evidenceHash ? 'finalized' : 'anchored';
  el('manifestChecks').innerHTML = `
    <div class="hashLine"><strong>Checker pack</strong><span>${escapeHtml(manifest.checkerPack || 'research')}</span></div>
    <div class="hashLine"><strong>Spec</strong><span>${escapeHtml(manifest.specHash)}</span></div>
    <div class="hashLine"><strong>Evidence</strong><span>${escapeHtml(manifest.evidenceHash || 'waiting for delivery')}</span></div>
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
