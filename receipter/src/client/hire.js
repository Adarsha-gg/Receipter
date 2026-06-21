const $ = (id) => document.getElementById(id);

const state = {
  phase: 'brief',
  runStep: -1,
  run: null,
  selectedBidId: null,
  payDigest: null,
  walrusBlobId: null,
  walrusReadUrl: null,
  anchorDigest: null,
  passportUpdateDigest: null,
  claimSupport: null,
  memoryIndex: null,
  events: [],
  eventSource: null,
  error: null,
};

const AGG = 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/';
const SCAN = 'https://suiscan.xyz/testnet/tx/';

const layers = [
  { id: 'job', kicker: 'Step 1', title: 'Task packet' },
  { id: 'worker', kicker: 'Step 2', title: 'Trusted worker' },
  { id: 'evidence', kicker: 'Step 3', title: 'Evidence and anchor' },
  { id: 'passport', kicker: 'Result', title: 'Agent passport' },
];

const logs = [
  ['Payment intent bound to this run', 'payment'],
  ['Worker delivered evidence', 'delivery'],
  ['Claims checked against sources', 'checks'],
  ['Evidence bundle stored on Walrus', 'walrus'],
  ['Proof anchored on Sui', 'sui'],
  ['Agent passport updated', 'passport'],
];

function value(id) {
  return $(id).value;
}

async function request(path, options = {}) {
  const headers = options.body ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options.headers;
  const res = await fetch(path, { ...options, headers, body: options.body ? JSON.stringify(options.body) : undefined });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const err = new Error((body && body.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function postWithRetry(path, body, attempts = 6) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await request(path, { method: 'POST', body });
    } catch (error) {
      lastError = error;
      const retryable = error.status === 502 || error.status === 503;
      if (!retryable || index === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 900 + index * 700));
    }
  }
  throw lastError;
}

function short(text, head = 10, tail = 6) {
  if (!text) return 'pending';
  const valueText = String(text);
  if (valueText.length <= head + tail + 3) return valueText;
  return `${valueText.slice(0, head)}...${valueText.slice(-tail)}`;
}

function humanError(error) {
  const message = error?.message || String(error);
  if (message.includes('Rate limit exceeded') || message.includes('429')) return 'Walrus is rate limited. Wait a minute, then retry this run.';
  if (message.includes('assert_new_duplicate_prevention_key') || (message.includes('MoveAbort') && message.includes('duplicate'))) return 'This Sui anchor key was already used. Start a fresh run instead of retrying this anchor.';
  if (error?.status === 402) return 'Payment verification failed: the signed Sui payment did not match the bounded x402 intent.';
  return message;
}

function setPhase(phase) {
  state.phase = phase;
  document.querySelectorAll('.phase').forEach((el) => el.classList.remove('visible'));
  $(`phase${phase[0].toUpperCase()}${phase.slice(1)}`).classList.add('visible');
  renderProgress();
  renderCredential();
  renderFooter();
}

function renderProgress() {
  const indexByPhase = { brief: 0, routing: 1, approve: 1, running: 2, done: 2 };
  const current = indexByPhase[state.phase] ?? 0;
  ['brief', 'approve', 'receipt'].forEach((name, index) => {
    const el = document.querySelector(`[data-progress="${name}"]`);
    el.classList.toggle('active', index === current);
    el.classList.toggle('done', index < current || (state.phase === 'done' && index === 2 && Boolean(state.anchorDigest)));
  });
}

function showError(error) {
  state.error = error ? humanError(error) : null;
  $('errorBox').hidden = !state.error;
  $('errorBox').textContent = state.error || '';
  renderFooter();
}

function buildRunBody() {
  return {
    title: value('title'),
    instructions: value('instructions'),
    privateNotes: value('privateNotes'),
    acceptanceCriteria: value('criteria').split('\n').map((line) => line.trim()).filter(Boolean),
    checkerPack: value('checkerPack'),
    requestedDataLabel: value('dataLabel'),
    maxPayment: { amount: value('amount'), currency: 'SUI' },
    preferredBidId: state.selectedBidId || undefined,
  };
}

async function ensureRun() {
  await loadMemoryIndex();
  if (state.run?.paymentIntentPlan) return state.run;
  const created = await request('/api/runs', { method: 'POST', body: buildRunBody() });
  const run = await request(`/api/runs/${encodeURIComponent(created.runId)}`);
  setRun(run);
  return run;
}

async function loadMemoryIndex() {
  if (state.memoryIndex) return state.memoryIndex;
  try {
    state.memoryIndex = await request('/api/walrus/memory');
  } catch {
    state.memoryIndex = { passports: [] };
  }
  return state.memoryIndex;
}

function setRun(run) {
  const manifest = run.verificationManifest || {};
  const claimResults = Array.isArray(manifest.claimResults) ? manifest.claimResults : [];
  state.run = run;
  state.selectedBidId = run.workerBidBoard?.selectedBidId || state.selectedBidId;
  state.payDigest = run.suiPaymentDigest || run.receiptPlan?.paymentDigest || state.payDigest;
  state.walrusBlobId = run.walrusBlobId || state.walrusBlobId;
  state.walrusReadUrl = run.walrusReadUrl || state.walrusReadUrl;
  state.anchorDigest = run.suiAnchorDigest || state.anchorDigest;
  state.passportUpdateDigest = passportUpdateDigestFromRun(run) || state.passportUpdateDigest;
  mergeEvents(run.events || []);
  startEventStream(run.runId);
  state.claimSupport = claimResults.length
    ? Math.round(claimResults.reduce((sum, result) => sum + (Number(result.supportScore) || 0), 0) / claimResults.length)
    : state.claimSupport;
  renderAll();
}

function mergeEvents(events) {
  const seen = new Set(state.events.map(eventKey));
  for (const event of events) {
    const key = eventKey(event);
    if (!seen.has(key)) {
      state.events.push(event);
      seen.add(key);
    }
  }
  state.events = state.events.slice(-24);
}

function eventKey(event) {
  return `${event.at || ''}:${event.type || ''}:${event.message || ''}`;
}

function startEventStream(runId) {
  if (!runId || state.eventSource?.runId === runId || typeof EventSource === 'undefined') return;
  stopEventStream();
  const source = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events`);
  source.runId = runId;
  source.onopen = () => {
    $('eventStatus').textContent = 'live';
  };
  source.onmessage = (message) => {
    try {
      mergeEvents([JSON.parse(message.data)]);
      renderEvents();
    } catch {
      // Ignore malformed event-stream messages.
    }
  };
  source.onerror = () => {
    $('eventStatus').textContent = 'reconnecting';
  };
  state.eventSource = source;
}

function stopEventStream() {
  if (state.eventSource) state.eventSource.close();
  state.eventSource = null;
  const status = $('eventStatus');
  if (status) status.textContent = 'idle';
}

function passportUpdateDigestFromRun(run) {
  const event = [...(run.events || [])].reverse().find((item) => item.type === 'agent_passport_memory_updated');
  return event?.data?.transaction || event?.data?.digest || event?.data?.verification?.transaction;
}

async function executeWalletSigning(signing) {
  if (!window.ReceipterWallet) throw new Error('Wallet adapter still loading.');
  const execution = await window.ReceipterWallet.signAndExecute(signing.walletTransactionRequest);
  if (signing.paymentPayloadTemplate) {
    const payload = { ...signing.paymentPayloadTemplate, transaction: execution.digest };
    return { execution, verified: await postWithRetry(signing.verifyEndpoint, payload, 6) };
  }
  if (signing.anchorPayloadTemplate) {
    const anchorPayload = { ...signing.anchorPayloadTemplate, transaction: execution.digest };
    return { execution, verified: await postWithRetry(signing.verifyEndpoint, { anchorPayload }, 6) };
  }
  if (signing.passportUpdatePayloadTemplate) {
    const payload = { ...signing.passportUpdatePayloadTemplate, transaction: execution.digest };
    return { execution, verified: await postWithRetry(signing.verifyEndpoint, payload, 6) };
  }
  throw new Error('Unsupported Receipter signing request.');
}

async function submitBrief(event) {
  event.preventDefault();
  showError(null);
  setBusy($('briefForm').querySelector('button[type="submit"]'), true);
  try {
    setPhase('routing');
    await ensureRun();
    renderBids();
    setPhase('approve');
  } catch (error) {
    setPhase('brief');
    showError(error);
  } finally {
    setBusy($('briefForm').querySelector('button[type="submit"]'), false);
  }
}

async function approveAndRun() {
  showError(null);
  setBusy($('approveBtn'), true);
  try {
    const run = await ensureRun();
    const signing = await request(`/api/runs/${encodeURIComponent(run.runId)}/payment-transaction`);
    const result = await executeWalletSigning(signing);
    setRun(result.verified.receipt || result.verified);
    state.runStep = 1;
    setPhase('running');
    await buildReceipt(state.run.runId);
  } catch (error) {
    setPhase('approve');
    showError(error);
  } finally {
    setBusy($('approveBtn'), false);
  }
}

async function buildReceipt(runId) {
  try {
    const delivered = await request(`/api/runs/${encodeURIComponent(runId)}/worker-delivery`, {
      method: 'POST',
      body: { objectType: 'receipter.worker_agent_delivery_request.v1', useReceipterWorker: true },
    });
    setRun(delivered);
    state.runStep = 2;
    renderAll();

    await new Promise((resolve) => setTimeout(resolve, 250));
    state.runStep = 3;
    renderAll();

    const stored = await request(`/api/runs/${encodeURIComponent(runId)}/store-evidence`, { method: 'POST', body: {} });
    setRun(stored);
    state.runStep = 4;

    const verdict = stored.clearingDecision?.verdict || stored.verificationManifest?.summary?.admissibility;
    if (!['ready_to_anchor', 'admissible', 'anchored'].includes(verdict)) {
      setPhase('done');
      return;
    }

    const signing = await request(`/api/runs/${encodeURIComponent(runId)}/anchor-transaction`);
    const result = await executeWalletSigning(signing);
    setRun(result.verified.receipt || result.verified);
    state.runStep = 5;
    try {
      const passportSigning = await request(`/api/runs/${encodeURIComponent(runId)}/passport-update-transaction`);
      const passportResult = await executeWalletSigning(passportSigning);
      state.passportUpdateDigest = passportResult.execution?.digest || passportResult.verified?.verification?.transaction || state.passportUpdateDigest;
      setRun(passportResult.verified.receipt || passportResult.verified);
      state.runStep = 6;
    } catch (passportError) {
      showError(`Receipt anchored, but AgentPassport object update needs manual signing: ${humanError(passportError)}`);
      state.runStep = 5;
    }
    setPhase('done');
  } catch (error) {
    showError(error);
    setPhase('done');
  }
}

function setBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  button.dataset.label ??= button.textContent;
  button.textContent = busy ? 'Working...' : button.dataset.label;
}

function selectedWorker() {
  const board = state.run?.workerBidBoard;
  const bid = board?.bids?.find((candidate) => candidate.bidId === board.selectedBidId);
  return bid?.workerAgentId || 'sui_opportunity_scout';
}

function selectedBid() {
  const board = state.run?.workerBidBoard;
  return board?.bids?.find((candidate) => candidate.bidId === board.selectedBidId) || null;
}

function renderBids() {
  const board = state.run?.workerBidBoard;
  const rows = board?.bids?.length ? board.bids : [
    { bidId: 'public_scout_standard', workerAgentId: 'sui_opportunity_scout', verdict: 'available', reason: 'Best verified record for public source scouting - in budget - safe', priceSui: value('amount'), sla: '~6 min' },
    { bidId: 'public_scout_lite', workerAgentId: 'settlement_rails_scout', verdict: 'available', reason: 'Capable, lower track record on this task type', priceSui: '0.045', sla: '~7 min' },
    { bidId: 'blocked', workerAgentId: 'fast_unverified_agent', verdict: 'blocked', reason: 'Requested private data or exceeded policy gates', priceSui: '0.120', sla: '~3 min' },
  ];
  const selected = board?.selectedBidId || state.selectedBidId || rows[0].bidId;
  $('bidList').innerHTML = rows.map((bid, index) => {
    const ok = bid.verdict === 'available';
    const awarded = ok && bid.bidId === selected;
    const badge = awarded ? 'AWARDED' : (ok ? 'in budget' : 'BLOCKED');
    const trust = ok ? Math.max(94 - index * 8, 78) / 100 : 0.4;
    return `<article class="bidRow" style="--bg:${awarded ? '#F4FBF6' : ok ? '#fff' : '#FCF7F7'};--border:${awarded ? '#9BD8B4' : ok ? '#ECEAE3' : '#F0D9D9'};--opacity:${awarded ? '1' : ok ? '.62' : '.5'}">
      <main>
        <strong>${escapeHtml(bid.workerAgentId || bid.bidId)}</strong>
        <span class="badge" style="--badge-color:${awarded ? '#16793B' : ok ? '#5C6470' : '#B23B3B'};--badge-bg:${awarded ? '#E4F4EA' : ok ? '#F1EFE9' : '#FBECEC'}">${badge}</span>
        <p>${escapeHtml(bid.reason || 'Matched against verified receipt history')}</p>
      </main>
      <div class="bidStats"><div><b>${escapeHtml(bid.priceSui || value('amount'))} SUI</b><span>${escapeHtml(bid.sla || '~6 min')}</span></div><div><b>${trust}</b><span>trust</span></div></div>
    </article>`;
  }).join('');
}

function renderPaymentFacts() {
  const run = state.run || {};
  const plan = run.paymentIntentPlan || run.receiptPlan || {};
  const rows = [
    ['Amount max', `${plan.amountSui || value('amount')} SUI`],
    ['Settlement', 'verified delivery'],
    ['Rail', 'x402 / Sui'],
    ['Checker pack', value('checkerPack')],
    ['Run ID', run.runId || 'pending'],
    ['Receiver', short(plan.receiverAddress, 8, 6)],
    ['Agent handoff', run.runId ? 'machine packet' : 'pending', run.runId ? `/api/runs/${encodeURIComponent(run.runId)}/agent-handoff` : null],
    ['Worker task', run.runId ? '402-gated endpoint' : 'pending', run.runId ? `/api/runs/${encodeURIComponent(run.runId)}/worker-task` : null],
  ];
  $('workerName').textContent = selectedWorker();
  $('workerInitials').textContent = selectedWorker().split('_').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  $('workerMeta').textContent = selectedBid()?.reason || 'verified route';
  $('paymentFacts').innerHTML = rows.map(([label, val, url]) => fact(label, val, url)).join('');
  $('approveBtn').textContent = `Approve and hire - ${plan.amountSui || value('amount')} SUI`;
  renderPriorReceipts();
}

function renderPriorReceipts() {
  const container = $('priorReceiptList');
  if (!container) return;
  const worker = selectedWorker();
  const passport = (state.memoryIndex?.passports || []).find((item) => item.workerAgentId === worker);
  const records = (passport?.records || []).filter((record) => record.runId !== state.run?.runId).slice(0, 3);
  if (!records.length) {
    container.innerHTML = `<div class="priorEmpty">
      <strong>No prior Walrus receipts found for ${escapeHtml(worker)}.</strong>
      <span>Receipter will treat this as a cold-start route. The new job only counts after evidence is stored on Walrus and verified.</span>
    </div>`;
    return;
  }
  container.innerHTML = records.map((record) => {
    const support = record.averageClaimSupport ?? 0;
    const walrusUrl = record.walrusReadUrl || (record.walrusBlobId ? AGG + record.walrusBlobId : null);
    const suiUrl = record.suiAnchorDigest ? SCAN + record.suiAnchorDigest : null;
    const status = record.suiAnchorDigest ? 'accepted' : record.verificationAdmissibility === 'requires_review' ? 'review' : (record.verificationAdmissibility || 'pending');
    return `<article class="priorReceipt">
      <div>
        <strong>${escapeHtml(record.taskTitle || record.runId)}</strong>
        <span>${escapeHtml(status)} / ${support}% support / ${record.supportedClaimCount ?? 0}/${record.claimCount ?? 0} claims</span>
      </div>
      <div class="priorLinks">
        ${walrusUrl ? `<a href="${escapeHtml(walrusUrl)}" target="_blank" rel="noreferrer">Walrus blob</a>` : '<b>no blob</b>'}
        ${suiUrl ? `<a href="${escapeHtml(suiUrl)}" target="_blank" rel="noreferrer">Sui anchor</a>` : '<b>no anchor</b>'}
      </div>
    </article>`;
  }).join('');
}

function renderLogs() {
  $('logList').innerHTML = logs.map(([label, key], index) => {
    const status = state.runStep > index ? 'done' : state.runStep === index ? 'running' : 'waiting';
    return `<div class="logRow ${status}"><span class="dot">${status === 'done' ? 'OK' : ''}</span><div><strong>${label}</strong><span>${escapeHtml(logDetail(key))}</span></div></div>`;
  }).join('');
}

function renderEvents() {
  const list = $('eventList');
  if (!list) return;
  if (!state.events.length) {
    list.innerHTML = '<div class="emptyEvents">No backend events yet.</div>';
    return;
  }
  list.innerHTML = [...state.events].reverse().slice(0, 8).map((event) => `<article class="eventRow">
    <strong>${escapeHtml(event.type || 'event')}</strong>
    <span>${escapeHtml(event.message || event.source || '')}</span>
    <b>${escapeHtml(event.at ? new Date(event.at).toLocaleTimeString() : '')}</b>
  </article>`).join('');
}

function logDetail(key) {
  const run = state.run || {};
  const manifest = run.verificationManifest || {};
  const claims = Array.isArray(manifest.claimResults) ? manifest.claimResults : [];
  const supported = claims.filter((claim) => claim.verdict === 'supported').length;
  if (key === 'payment') return state.payDigest ? `digest ${short(state.payDigest, 8, 6)}` : 'waiting for signed payment';
  if (key === 'delivery') return run.workerEvidence ? `${run.workerEvidence.claims?.length || 0} claims drafted` : 'waiting for worker packet';
  if (key === 'checks') return claims.length ? `${supported} / ${claims.length} claims supported` : 'verification manifest pending';
  if (key === 'walrus') return state.walrusBlobId ? `blob ${short(state.walrusBlobId, 8, 6)}` : 'waiting for Walrus publisher';
  if (key === 'sui') return state.anchorDigest ? `tx ${short(state.anchorDigest, 8, 6)}` : 'waiting for Sui anchor signature';
  return state.passportUpdateDigest ? `tx ${short(state.passportUpdateDigest, 8, 6)}` : state.anchorDigest ? 'receipt anchored; waiting for AgentPassport update signature' : 'not written until anchor passes';
}

function renderDone() {
  const anchored = Boolean(state.anchorDigest);
  const passportUpdated = Boolean(state.passportUpdateDigest);
  $('doneBadge').textContent = passportUpdated ? 'Receipt anchored + passport updated' : anchored ? 'Verified receipt anchored' : 'Evidence stored - review required';
  $('doneTitle').textContent = passportUpdated ? 'Done. The passport moved.' : anchored ? 'Receipt anchored. Passport update pending.' : 'Stored. Not reputation yet.';
  $('doneBody').textContent = passportUpdated
    ? 'Your job is complete, the evidence is on Walrus, the receipt is anchored on Sui, and the Sui AgentPassport now points at the latest proof.'
    : anchored
      ? 'Your job is complete and the receipt is anchored on Sui. The AgentPassport object still needs its separate memory pointer update before the passport fully reflects it.'
    : 'Receipter kept the evidence, but the verification gate did not clear it for reputation. Manual review can inspect the Walrus bundle before any passport update.';
  $('receiptTitle').textContent = value('title');
  $('receiptMeta').textContent = `${selectedWorker()} / ${state.run?.runId || 'run pending'}`;
  $('receiptStatus').textContent = anchored ? 'anchored' : 'review';
  const rows = [
    ['Walrus blob', state.walrusBlobId || 'not stored', state.walrusReadUrl || (state.walrusBlobId ? AGG + state.walrusBlobId : null)],
    ['Sui anchor tx', state.anchorDigest || 'not anchored', state.anchorDigest ? SCAN + state.anchorDigest : null],
    ['Passport update tx', state.passportUpdateDigest || 'not updated', state.passportUpdateDigest ? SCAN + state.passportUpdateDigest : null],
    ['Claim support', state.claimSupport == null ? 'pending' : `${state.claimSupport}%`, null],
    ['Run ID', state.run?.runId || 'pending', state.run?.runId ? `/api/runs/${encodeURIComponent(state.run.runId)}` : null],
  ];
  $('proofFacts').innerHTML = rows.map(([label, val, url]) => fact(label, val, url)).join('');
  $('passportLink').href = selectedWorker() ? `/api/walrus/memory/${encodeURIComponent(selectedWorker())}` : '/api/walrus/memory';
}

function renderCredential() {
  const activeIndex = state.phase === 'brief' ? 0 : state.phase === 'routing' || state.phase === 'approve' ? 1 : state.phase === 'running' ? 2 : 3;
  $('layerList').innerHTML = layers.map((layer, index) => {
    const done = index < activeIndex || (index === 3 && Boolean(state.anchorDigest));
    const running = index === activeIndex && !done;
    return `<article class="layer ${done ? 'done' : running ? 'running' : ''}">
      <div class="layerTop"><span class="layerIcon">${done ? 'OK' : index + 1}</span><div><small>${layer.kicker}</small><strong>${layer.title}</strong></div></div>
      ${layerDetail(layer.id)}
    </article>`;
  }).join('');
  const status = $('credentialStatus');
  status.textContent = state.phase === 'done' ? (state.passportUpdateDigest ? 'passport updated' : state.anchorDigest ? 'anchor only' : 'review') : state.phase;
  status.style.color = state.passportUpdateDigest ? '#16793b' : '#b6831c';
  status.style.background = state.passportUpdateDigest ? '#e4f4ea' : '#f6ecd6';
}

function layerDetail(id) {
  const run = state.run || {};
  const rows = {
    job: [['worker sees', value('title') || 'draft'], ['private notes', state.phase === 'brief' ? 'withheld' : 'stripped / clean']],
    worker: [['agent', selectedWorker()], ['route', state.selectedBidId || 'pending']],
    evidence: [['walrus', short(state.walrusBlobId)], ['sui tx', short(state.anchorDigest)]],
    passport: [['status', state.passportUpdateDigest ? 'updated' : state.anchorDigest ? 'anchor only' : 'pending'], ['run', short(run.runId, 8, 5)]],
  }[id];
  return `<div class="layerDetail">${rows.map(([k, v]) => `<div><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`).join('')}</div>`;
}

function renderFooter() {
  const text = state.error || {
    brief: 'Private content never leaves your browser unsanitized.',
    routing: 'Unsafe and over-budget routes are auto-blocked.',
    approve: 'Wallet opens for one bounded Sui payment.',
    running: 'Storing on Walrus and anchoring on Sui.',
    done: state.passportUpdateDigest ? 'Independently verifiable, passport updated.' : state.anchorDigest ? 'Receipt anchored; passport update is a separate Sui write.' : 'Manual review required before reputation writeback.',
  }[state.phase];
  $('footNote').textContent = text;
}

function fact(label, val, url) {
  const escaped = escapeHtml(val || 'pending');
  return `<div class="fact"><span>${escapeHtml(label)}</span>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escaped}</a>` : `<b>${escaped}</b>`}</div>`;
}

function renderAll() {
  renderBids();
  renderPaymentFacts();
  renderLogs();
  renderDone();
  renderCredential();
  renderEvents();
  renderFooter();
}

function escapeHtml(valueText) {
  return String(valueText ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

function bind() {
  $('briefForm').addEventListener('submit', submitBrief);
  $('advancedToggle').addEventListener('click', () => {
    $('advancedPanel').hidden = !$('advancedPanel').hidden;
  });
  $('approveBtn').addEventListener('click', approveAndRun);
  $('editBtn').addEventListener('click', () => setPhase('brief'));
  $('restartBtn').addEventListener('click', () => {
    stopEventStream();
    Object.assign(state, { phase: 'brief', runStep: -1, run: null, selectedBidId: null, payDigest: null, walrusBlobId: null, walrusReadUrl: null, anchorDigest: null, passportUpdateDigest: null, claimSupport: null, events: [], error: null });
    showError(null);
    setPhase('brief');
    renderAll();
  });
  $('closeBtn').addEventListener('click', () => { window.location.href = '/'; });
  ['title', 'instructions', 'privateNotes'].forEach((id) => $(id).addEventListener('input', renderCredential));
}

bind();
renderAll();
