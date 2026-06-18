let currentRunId = null;
let eventSource = null;

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

  if (config.mode === 'live') {
    el('configText').textContent = config.readyForLive
      ? 'Live setup looks ready. Payment still requires approval.'
      : `Missing live setup: ${config.missingLiveSettings.join(', ')}`;
    return;
  }

  el('configText').textContent = `${config.mode} mode. No real CROO payment will be sent.`;
}

el('taskForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearTimeline();
  setReceiptText('Creating run…');

  const body = {
    title: el('title').value,
    instructions: el('instructions').value,
    privateNotes: el('privateNotes').value,
    maxPayment: { amount: el('amount').value, currency: 'USDC' },
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
    addTimelineEvent({ at: new Date().toISOString(), source: 'app', type: 'event_stream_error', message: 'Live event stream disconnected.' });
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
        `<div class="runRow"><div><strong>${escapeHtml(run.taskTitle)}</strong><div class="small">${escapeHtml(run.runId)}</div></div><div>${escapeHtml(run.status)}</div><div>${escapeHtml(run.mode)}</div><div><button class="secondary" data-run="${escapeHtml(run.runId)}">Open</button> <a href="/api/runs/${encodeURIComponent(run.runId)}/receipt">Receipt</a></div></div>`,
    )
    .join('');
}

function renderReceipt(receipt) {
  const rows = [
    ['Run id', receipt.runId],
    ['Status', receipt.status],
    ['Mode', receipt.mode],
    ['Negotiation id', receipt.negotiationId || 'not created yet'],
    ['Order id', receipt.orderId || 'not created yet'],
    ['Payment tx', receipt.paymentTxHash || 'not paid yet'],
    ['Delivery', receipt.deliveryText || 'not delivered yet'],
  ];

  el('receipt').innerHTML =
    rows.map(([label, value]) => `<div class="receiptRow"><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</div>`).join('') +
    `<div class="receiptRow"><a href="/api/runs/${encodeURIComponent(receipt.runId)}/receipt">Download receipt JSON</a></div>`;
}

function addTimelineEvent(event) {
  const item = document.createElement('li');
  item.innerHTML = `<strong>${escapeHtml(event.message)}</strong><span>${escapeHtml(event.source)} · ${escapeHtml(event.type)} · ${escapeHtml(event.at)}</span>`;
  el('timeline').appendChild(item);
}

function clearTimeline() {
  el('timeline').innerHTML = '';
}

function setReceiptText(text, error = false) {
  el('receipt').innerHTML = `<div class="receiptRow ${error ? 'error' : ''}">${escapeHtml(text)}</div>`;
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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

boot().catch((error) => setReceiptText(error.message, true));
