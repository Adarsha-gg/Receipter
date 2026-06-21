const $ = (id) => document.getElementById(id);

const state = {
  index: null,
  passports: [],
  runs: new Map(),
  selected: null,
  query: '',
  category: 'all',
  sort: 'best',
  openRecords: new Set(),
  stakeSigningRequests: new Map(),
};

const AGG = 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/';
const SCAN = 'https://suiscan.xyz/testnet/tx/';

async function request(path, options) {
  const headers = options?.body ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options?.headers;
  const res = await fetch(path, { ...options, headers, body: options?.body ? JSON.stringify(options.body) : undefined });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error((body && body.error) || `HTTP ${res.status}`);
  return body;
}

async function load() {
  $('agentList').innerHTML = '<div class="empty">Loading passports...</div>';
  const index = await request('/api/walrus/memory');
  const passports = [...(index.passports || [])].sort((a, b) => scorePassport(b) - scorePassport(a));
  state.index = index;
  state.passports = passports;
  await loadRuns(passports);
  state.selected ||= passports[0]?.workerAgentId || null;
  render();
}

async function loadRuns(passports) {
  const ids = [...new Set(passports.flatMap((passport) => (passport.records || []).map((record) => record.runId)).filter(Boolean))];
  await Promise.all(ids.map(async (runId) => {
    if (state.runs.has(runId)) return;
    try {
      state.runs.set(runId, await request(`/api/runs/${encodeURIComponent(runId)}`));
    } catch {
      state.runs.set(runId, null);
    }
  }));
}

function scorePassport(passport) {
  return ((passport.anchoredMemoryCount || 0) * 1000)
    + ((passport.walrusMemoryCount || 0) * 100)
    + (passport.averageClaimSupport || 0)
    + ((passport.records || []).length * 10);
}

function render() {
  renderStats();
  renderAgents();
  renderDetail();
}

function renderStats() {
  const index = state.index || {};
  const passports = state.passports;
  const records = passports.flatMap((passport) => passport.records || []);
  const avg = records.length
    ? Math.round(records.reduce((sum, record) => sum + (record.averageClaimSupport || 0), 0) / records.length)
    : 0;
  $('stats').innerHTML = [
    ['Agents', passports.length],
    ['Walrus receipts', index.walrusEvidenceCount ?? records.filter((record) => record.walrusBlobId).length],
    ['Sui-anchored', index.suiAnchoredRecords ?? records.filter((record) => record.suiAnchorDigest).length],
    ['Avg support', `${avg}%`],
  ].map(([label, value]) => `<div class="stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join('');
}

function renderAgents() {
  const query = state.query.toLowerCase();
  const filtered = state.passports.filter((passport) => {
    const offer = agentOffer(passport);
    const haystack = [
      passport.workerAgentId,
      passport.ownerAddress,
      offer.title,
      offer.category,
      ...(passport.records || []).flatMap((record) => [record.runId, record.taskTitle, record.status]),
    ].join(' ').toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesCategory = state.category === 'all'
      || offer.category === state.category
      || (state.category === 'verified' && (passport.anchoredMemoryCount || 0) > 0);
    return matchesQuery && matchesCategory;
  }).sort(sortPassports);
  $('agentList').innerHTML = filtered.map((passport) => {
    const offer = agentOffer(passport);
    const active = passport.workerAgentId === state.selected;
    const records = passport.records || [];
    const initials = offer.name.split(/[_.\s-]+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
    const support = passport.averageClaimSupport ?? 0;
    const anchors = passport.anchoredMemoryCount || 0;
    const walrus = passport.walrusMemoryCount || 0;
    return `<button class="agentCard ${active ? 'active' : ''}" type="button" data-worker="${escapeHtml(passport.workerAgentId)}">
      <span class="sellerTop">
        <i class="avatar">${escapeHtml(initials || 'RA')}</i>
        <span><b>${escapeHtml(offer.name)}</b><em>${escapeHtml(offer.level)}</em></span>
      </span>
      <strong>${escapeHtml(offer.title)}</strong>
      <span class="sellerMeta">
        <b>${escapeHtml(support)}% support</b>
        <span>${escapeHtml(records.length)} jobs</span>
        <span>${escapeHtml(walrus)} Walrus</span>
        <span>${escapeHtml(anchors)} Sui</span>
      </span>
      <span class="sellerBottom">
        <em>${escapeHtml(offer.delivery)}</em>
        <b>From ${escapeHtml(offer.price)} SUI</b>
      </span>
    </button>`;
  }).join('') || '<div class="empty">No matching agents.</div>';
}

function sortPassports(a, b) {
  if (state.sort === 'support') return (b.averageClaimSupport || 0) - (a.averageClaimSupport || 0);
  if (state.sort === 'anchors') return (b.anchoredMemoryCount || 0) - (a.anchoredMemoryCount || 0);
  if (state.sort === 'walrus') return (b.walrusMemoryCount || 0) - (a.walrusMemoryCount || 0);
  return scorePassport(b) - scorePassport(a);
}

function agentOffer(passport) {
  const id = passport.workerAgentId || 'receipter.agent';
  const lower = id.toLowerCase();
  const records = passport.records || [];
  const latestTitle = records[0]?.taskTitle || 'public-source research task';
  if (lower.includes('deep')) {
    return {
      name: readableAgentName(id),
      title: `I will produce deep source-backed research with Walrus proof receipts`,
      category: 'deep',
      level: 'L3 verified specialist',
      delivery: '48h delivery',
      price: '0.045',
    };
  }
  if (lower.includes('expedited') || lower.includes('fast')) {
    return {
      name: readableAgentName(id),
      title: `I will run fast public-source research with receipt-grade evidence`,
      category: 'fast',
      level: 'Fast-response worker',
      delivery: '4h delivery',
      price: '0.075',
    };
  }
  if (lower.includes('lite')) {
    return {
      name: readableAgentName(id),
      title: `I will scout lightweight public sources and return verifiable links`,
      category: 'research',
      level: 'Budget verified worker',
      delivery: '36h delivery',
      price: '0.020',
    };
  }
  return {
    name: readableAgentName(id),
    title: `I will complete public-source agent research with Walrus-backed receipts`,
    category: 'research',
    level: (passport.anchoredMemoryCount || 0) > 0 ? 'Sui-anchored worker' : 'Walrus-backed worker',
    delivery: '24h delivery',
    price: '0.035',
  };
}

function readableAgentName(id) {
  return String(id || 'Receipter Agent')
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderDetail() {
  const passport = state.passports.find((item) => item.workerAgentId === state.selected);
  $('detailEmpty').hidden = Boolean(passport);
  $('detail').hidden = !passport;
  if (!passport) return;

  $('agentName').textContent = passport.workerAgentId;
  $('agentOwner').textContent = short(passport.ownerAddress || passport.ownership?.address || 'owner unbound', 14, 8);
  $('scoreBadge').textContent = `${passport.averageClaimSupport ?? 0}%`;
  $('agentCardLink').href = `/api/agents/${encodeURIComponent(passport.workerAgentId)}/card`;
  $('passportVerifyResult').hidden = true;
  $('passportStats').innerHTML = [
    ['Verified jobs', (passport.records || []).length],
    ['Walrus artifacts', passport.walrusMemoryCount || 0],
    ['Sui anchors', passport.anchoredMemoryCount || 0],
    ['Latest status', passport.latestStatus || 'unknown'],
  ].map(([label, value]) => `<div class="stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join('');

  $('receiptList').innerHTML = (passport.records || []).map((record) => receiptCard(passport, record)).join('')
    || '<div class="empty">This passport has no records yet.</div>';
}

async function verifySelectedPassport() {
  const workerAgentId = state.selected;
  const target = $('passportVerifyResult');
  target.hidden = false;
  target.className = 'passportVerifyResult';
  if (!workerAgentId) {
    target.textContent = 'Select an agent first.';
    return;
  }
  target.textContent = 'Verifying full passport from receipt artifacts...';
  try {
    const result = await request(`/api/oracle/passports/${encodeURIComponent(workerAgentId)}/verify`);
    const records = result.recordVerifications || [];
    const failedRecords = records.filter((record) => !record.verified);
    const walrusFailures = records.flatMap((record) => (record.checks || [])
      .filter((check) => check.id === 'walrus_readback' && check.status === 'failed')
      .map((check) => ({ runId: record.runId, detail: check.detail })));
    target.className = `passportVerifyResult ${result.verified ? 'good' : 'bad'}`;
    target.innerHTML = `<strong>${result.verified ? 'Passport verified' : 'Passport needs review'}</strong>
      <span>${escapeHtml(result.verifiedRecordCount || 0)} verified receipt(s), ${escapeHtml(result.failedRecordCount || 0)} failed receipt(s), ${escapeHtml(walrusFailures.length)} Walrus readback failure(s).</span>
      ${failedRecords.length ? `<div class="passportFailureList">${failedRecords.slice(0, 5).map((record) => `<div><b>${escapeHtml(record.runId)}</b><span>${escapeHtml(record.checks?.find((check) => check.status === 'failed')?.detail || 'One or more checks failed.')}</span></div>`).join('')}</div>` : ''}
      <details class="rawChecks"><summary>Show passport oracle JSON</summary><pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre></details>`;
  } catch (error) {
    target.className = 'passportVerifyResult bad';
    target.textContent = error.message;
  }
}

function receiptCard(passport, record) {
  const run = state.runs.get(record.runId) || {};
  const anchored = Boolean(record.suiAnchorDigest);
  const walrus = record.walrusBlobId || run.walrusBlobId;
  const anchor = record.suiAnchorDigest || run.suiAnchorDigest;
  const support = record.averageClaimSupport ?? record.claimSupport ?? 0;
  const open = state.openRecords.has(record.runId);
  const claimCount = record.claimCount ?? run.workerEvidence?.claims?.length ?? 0;
  const sourceCount = record.sourceObservationCount ?? run.workerEvidence?.sourceReceipt?.observations?.length ?? 0;
  return `<article class="receipt ${open ? 'open' : ''}">
    <button class="receiptTop" type="button" data-toggle-record="${escapeHtml(record.runId)}" aria-expanded="${open ? 'true' : 'false'}">
      <div class="taskTitle">
        <h3>${escapeHtml(record.taskTitle || run.taskTitle || record.runId)}</h3>
        <small>${escapeHtml(record.runId)} / ${claimCount} claims / ${sourceCount} sources</small>
      </div>
      <div class="taskMeta">
        <span class="support">${support}% support</span>
        <span class="pill ${anchored ? 'good' : ''}">${anchored ? 'anchored' : 'review'}</span>
        <span class="chevron">${open ? 'Hide' : 'Open'}</span>
      </div>
    </button>
    <div class="receiptDrawer" ${open ? '' : 'hidden'}>
      <div class="proofSummary">
        <div><strong>Walrus evidence</strong><span>${walrus ? 'Raw receipt artifact recorded on Walrus and used as the portable proof bundle.' : 'No Walrus blob bound yet.'}</span></div>
        <div><strong>Sui anchor</strong><span>${anchor ? 'Compact receipt digest anchored on Sui.' : 'No Sui anchor recorded yet.'}</span></div>
        <div><strong>Source claims</strong><span>${claimCount} claim(s), ${sourceCount} source observation(s).</span></div>
      </div>
      <div class="facts">
        ${fact('Claim support', `${support}%`)}
        ${fact('Evidence', record.evidenceStrength || 'pending')}
        ${fact('Walrus blob', short(walrus, 12, 6), walrus ? (run.walrusReadUrl || `${AGG}${walrus}`) : null)}
        ${fact('Sui anchor', short(anchor, 12, 6), anchor ? `${SCAN}${anchor}` : null)}
        ${fact('Payment digest', short(record.paymentDigest || run.suiPaymentDigest, 12, 6))}
        ${fact('Artifact hash', short(record.memoryHash, 12, 6))}
        ${fact('Evidence hash', short(record.evidenceHash || run.evidenceHash, 12, 6))}
        ${fact('Source receipt hash', short(run.workerEvidence?.sourceReceipt?.receiptHash, 12, 6))}
      </div>
      <div class="receiptActions">
        <button type="button" data-verify="${escapeHtml(record.runId)}" data-verify-kind="full">Verify full receipt</button>
        <button type="button" data-verify="${escapeHtml(record.runId)}" data-verify-kind="walrus">Verify Walrus readback</button>
        <button type="button" data-verify="${escapeHtml(record.runId)}" data-verify-kind="sui">Check Sui anchor</button>
        <button type="button" data-verify="${escapeHtml(record.runId)}" data-verify-kind="sources">Check source claims</button>
        <button type="button" data-verify="${escapeHtml(record.runId)}" data-verify-kind="memory">Check memory hash</button>
        <button type="button" data-challenge="${escapeHtml(record.runId)}">Assess dispute</button>
        ${walrus ? `<a class="actionLink" href="${escapeHtml(run.walrusReadUrl || `${AGG}${walrus}`)}" target="_blank" rel="noreferrer">Open raw Walrus receipt</a>` : ''}
        ${anchor ? `<a class="actionLink" href="${escapeHtml(`${SCAN}${anchor}`)}" target="_blank" rel="noreferrer">Open Sui tx</a>` : ''}
        <a class="actionLink" href="/api/runs/${encodeURIComponent(record.runId)}/receipt" target="_blank" rel="noreferrer">Download receipt proof</a>
        <a class="actionLink" href="/api/runs/${encodeURIComponent(record.runId)}" target="_blank" rel="noreferrer">Run JSON</a>
        <a class="actionLink" href="/api/runs/${encodeURIComponent(record.runId)}/memory" target="_blank" rel="noreferrer">Receipt artifact JSON</a>
      </div>
      <div class="stakeBuilder">
        <label><span>Stake position object</span><input data-stake-position="${escapeHtml(record.runId)}" placeholder="0x...StakePosition"></label>
        <label><span>Slash amount (MIST)</span><input data-slash-amount="${escapeHtml(record.runId)}" value="10000000" inputmode="numeric"></label>
        <button type="button" data-prepare-slash="${escapeHtml(record.runId)}">Prepare slash tx</button>
      </div>
      <div class="verifyResult" id="verify-${escapeHtml(record.runId)}">Open a check above. Nothing here relies on a hidden database verdict.</div>
      <div class="challengeResult" id="challenge-${escapeHtml(record.runId)}" hidden></div>
    </div>
  </article>`;
}

function fact(label, value, url) {
  const inner = url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(value || 'pending')}</a>`
    : `<b>${escapeHtml(value || 'pending')}</b>`;
  return `<div class="fact"><span>${escapeHtml(label)}</span>${inner}</div>`;
}

async function verify(runId, kind = 'full') {
  const target = $(`verify-${runId}`);
  target.className = 'verifyResult';
  target.textContent = `Running ${kind} check...`;
  try {
    const result = await request(`/api/oracle/records/${encodeURIComponent(runId)}/verify`);
    const checks = checksForKind(result.checks || [], kind);
    const passed = checks.length > 0 && checks.every((check) => check.status === 'passed' || check.status === 'skipped');
    const failedChecks = checks.filter((check) => check.status !== 'passed' && check.status !== 'skipped');
    const skipped = checks.filter((check) => check.status === 'skipped').map((check) => check.id);
    target.className = `verifyResult ${passed ? 'good' : 'bad'}`;
    target.innerHTML = friendlyVerificationMarkup(kind, passed, checks, failedChecks, skipped);
  } catch (error) {
    target.className = 'verifyResult bad';
    target.textContent = error.message;
  }
}

async function assessChallenge(runId) {
  const target = $(`challenge-${runId}`);
  target.hidden = false;
  target.className = 'challengeResult';
  target.textContent = 'Asking the challenge oracle...';
  try {
    const result = await request(`/api/oracle/records/${encodeURIComponent(runId)}/challenges/assess`, {
      method: 'POST',
      body: {
        stakePositionId: challengeInput(runId).stakePositionId || '0x0000000000000000000000000000000000000000000000000000000000000000',
        reason: 'Explorer dispute preview: assess whether verifier failures or weak claims make this receipt challenge-admissible.',
        slashAmountMist: challengeInput(runId).slashAmountMist || undefined,
      },
    });
    target.className = `challengeResult ${result.admissible ? 'bad' : 'good'}`;
    target.innerHTML = challengeMarkup(result);
  } catch (error) {
    target.className = 'challengeResult bad';
    target.textContent = error.message;
  }
}

async function prepareSlash(runId) {
  const target = $(`challenge-${runId}`);
  target.hidden = false;
  target.className = 'challengeResult';
  const input = challengeInput(runId);
  if (!input.stakePositionId || !/^0x[0-9a-fA-F]{1,64}$/.test(input.stakePositionId)) {
    target.className = 'challengeResult bad';
    target.textContent = 'Enter a real Sui StakePosition object id before preparing a slash transaction.';
    return;
  }
  if (!input.slashAmountMist || !/^[0-9]+$/.test(input.slashAmountMist)) {
    target.className = 'challengeResult bad';
    target.textContent = 'Enter a slash amount in MIST.';
    return;
  }
  target.textContent = 'Assessing dispute before preparing slash transaction...';
  try {
    const assessment = await request(`/api/oracle/records/${encodeURIComponent(runId)}/challenges/assess`, {
      method: 'POST',
      body: {
        stakePositionId: input.stakePositionId,
        slashAmountMist: input.slashAmountMist,
        reason: 'Explorer slash flow: verifier failures or weak claims were reviewed before signing.',
      },
    });
    if (!assessment.admissible) {
      target.className = 'challengeResult good';
      target.innerHTML = `${challengeMarkup(assessment)}<div class="slashNotice">No slash transaction prepared because the oracle did not mark this receipt challenge-admissible.</div>`;
      return;
    }
    const signing = await request('/api/stake/slash-transaction', {
      method: 'POST',
      body: {
        positionId: input.stakePositionId,
        evidenceHash: assessment.evidenceHash,
        reason: `oracle-admissible:${runId}:Explorer slash flow`,
        slashAmountMist: input.slashAmountMist,
      },
    });
    state.stakeSigningRequests.set(runId, signing);
    target.className = 'challengeResult bad';
    target.innerHTML = `${challengeMarkup(assessment)}
      <div class="slashNotice">Signer-ready slash transaction prepared. This is the actual stake path; signing may slash the worker stake.</div>
      <button type="button" data-sign-slash="${escapeHtml(runId)}">Sign slash transaction</button>
      <details class="rawChecks"><summary>Show wallet transaction request</summary><pre>${escapeHtml(JSON.stringify(signing.walletTransactionRequest, null, 2))}</pre></details>`;
  } catch (error) {
    target.className = 'challengeResult bad';
    target.textContent = error.message;
  }
}

async function signSlash(runId) {
  const target = $(`challenge-${runId}`);
  const signing = state.stakeSigningRequests.get(runId);
  if (!signing) {
    target.textContent = 'Prepare a slash transaction first.';
    return;
  }
  if (!window.ReceipterWallet) {
    target.textContent = 'Wallet adapter still loading.';
    return;
  }
  target.className = 'challengeResult bad';
  target.textContent = 'Waiting for wallet signature...';
  try {
    const execution = await window.ReceipterWallet.signAndExecute(signing.walletTransactionRequest);
    const payload = { ...signing.executionPayloadTemplate, transaction: execution.digest };
    const verified = await request(signing.verifyEndpoint, { method: 'POST', body: payload });
    target.className = 'challengeResult bad';
    target.innerHTML = `<strong>Stake slash transaction verified</strong>
      <span>Receipter verified the signed Sui stake transaction and expected stake event.</span>
      <div class="challengeFacts"><div><b>${escapeHtml(short(verified.transaction, 12, 6))}</b><span>transaction</span></div><div><b>${escapeHtml(verified.kind)}</b><span>kind</span></div><div><b>${escapeHtml(verified.network)}</b><span>network</span></div></div>`;
  } catch (error) {
    target.className = 'challengeResult bad';
    target.textContent = error.message;
  }
}

function challengeInput(runId) {
  return {
    stakePositionId: document.querySelector(`[data-stake-position="${CSS.escape(runId)}"]`)?.value.trim(),
    slashAmountMist: document.querySelector(`[data-slash-amount="${CSS.escape(runId)}"]`)?.value.trim(),
  };
}

function challengeMarkup(result) {
  const failures = result.verifierFailures || [];
  const weakClaims = result.weakClaims || [];
  const checks = result.checks || [];
  return `<strong>${result.admissible ? 'Challenge-admissible' : 'Not slash-admissible right now'}</strong>
    <span>${result.admissible
      ? 'The backend found an anchored receipt plus verifier failures or weak claims. A real challenger could use the stake transaction endpoints.'
      : 'The receipt can still be reviewed, but the oracle does not see enough conditions for slashing from this preview.'}</span>
    <div class="challengeFacts">
      <div><b>${escapeHtml(failures.length)}</b><span>verifier failure(s)</span></div>
      <div><b>${escapeHtml(weakClaims.length)}</b><span>weak claim(s)</span></div>
      <div><b>${escapeHtml(result.evidenceHash || 'pending')}</b><span>evidence hash</span></div>
    </div>
    <details class="rawChecks"><summary>Show challenge oracle checks</summary>
      <div class="checkGrid">${checks.map((check) => `<div class="${escapeHtml(check.status)}"><b>${escapeHtml(check.id)}</b><span>${escapeHtml(check.detail)}</span></div>`).join('')}</div>
    </details>`;
}

async function verifyOwnerAddress() {
  const input = $('ownerAddress');
  const target = $('ownerResult');
  const address = input.value.trim();
  target.hidden = false;
  target.className = 'ownerResult';
  if (!address) {
    target.textContent = 'Enter a Sui owner address.';
    return;
  }
  target.textContent = 'Verifying owner passport...';
  try {
    const result = await request(`/api/oracle/owners/${encodeURIComponent(address)}/passport/verify`);
    const passport = result.passport || {};
    target.className = `ownerResult ${result.verified ? 'good' : 'bad'}`;
    target.innerHTML = `<strong>${result.verified ? 'Owner passport verified' : 'Owner passport needs review'}</strong>
      <span>${escapeHtml(passport.workerAgentId || 'unknown worker')} / ${escapeHtml(passport.memoryCount || 0)} receipt(s) / ${escapeHtml(passport.walrusMemoryCount || 0)} Walrus artifact(s)</span>`;
    if (passport.workerAgentId) {
      state.selected = passport.workerAgentId;
      render();
    }
  } catch (error) {
    target.className = 'ownerResult bad';
    target.textContent = error.message;
  }
}

function checksForKind(checks, kind) {
  const map = {
    full: checks,
    walrus: checks.filter((check) => ['walrus_binding', 'walrus_readback', 'evidence_bundle_hash', 'worker_evidence_hash'].includes(check.id)),
    sui: checks.filter((check) => ['sui_anchor_binding'].includes(check.id)),
    sources: checks.filter((check) => ['source_claims', 'source_receipt_hash'].includes(check.id)),
    memory: checks.filter((check) => ['memory_hash'].includes(check.id)),
  };
  return map[kind] || checks;
}

function labelForKind(kind) {
  return {
    full: 'Full receipt oracle',
    walrus: 'Walrus blob/readback',
    sui: 'Sui anchor binding',
    sources: 'Source claim binding',
    memory: 'Receipt artifact hash recompute',
  }[kind] || 'Receipt check';
}

function summarizePassed(kind, skipped) {
  const base = {
    full: 'All required receipt checks passed or were explicitly skipped by policy.',
    walrus: 'Walrus blob binding/readback and evidence hashes are consistent.',
    sui: 'The receipt is bound to the expected Sui anchor when an anchor exists.',
    sources: 'Source receipt and claim bindings are consistent with worker evidence.',
    memory: 'The receipt artifact hash recomputes from the stored record.',
  }[kind] || 'Selected checks passed.';
  return skipped.length ? `${base} Skipped: ${skipped.join(', ')}.` : base;
}

function friendlyVerificationMarkup(kind, passed, checks, failedChecks, skipped) {
  if (passed) {
    return `<strong>${escapeHtml(labelForKind(kind))}: passed</strong>
      <span>${escapeHtml(summarizePassed(kind, skipped))}</span>
      ${rawDetails(checks)}`;
  }

  const primary = failureSummary(kind, failedChecks);
  return `<strong>${escapeHtml(labelForKind(kind))}: needs review</strong>
    <div class="plainVerdict">
      <b>${escapeHtml(primary.title)}</b>
      <span>${escapeHtml(primary.body)}</span>
      <em>${escapeHtml(primary.reputation)}</em>
    </div>
    ${friendlyFailedList(failedChecks)}
    ${rawDetails(checks)}`;
}

function failureSummary(kind, failedChecks) {
  const ids = new Set(failedChecks.map((check) => check.id));
  if (ids.has('verification_completeness')) {
    return {
      title: 'The receipt artifact is stored, but not complete enough for clean reputation.',
      body: 'The lower-level hashes may pass, but at least one required proof family is missing. Usually this means source claims are not structured, or the Sui anchor has not been recorded yet.',
      reputation: 'Keep it as an auditable Walrus receipt, but do not let it improve the agent passport until the missing proof is fixed.',
    };
  }
  if (kind === 'sources' || ids.has('source_receipt_hash') || ids.has('source_claims')) {
    return {
      title: 'The source proof is not clean yet.',
      body: 'Receipter found a mismatch between the saved source receipt and what it recomputed, or the worker did not attach structured source-backed claims.',
      reputation: 'This can stay stored on Walrus, but it should not count as clean agent reputation until the source packet is fixed.',
    };
  }
  if (kind === 'walrus' || ids.has('walrus_readback') || ids.has('walrus_binding') || ids.has('worker_evidence_hash')) {
    return {
      title: 'The Walrus evidence bundle is not fully verified.',
      body: 'The blob may be missing, unreadable, or its recomputed evidence hash does not match the receipt.',
      reputation: 'Do not anchor or boost the passport from this receipt until Walrus readback and hashes pass.',
    };
  }
  if (kind === 'sui' || ids.has('sui_anchor_binding')) {
    return {
      title: 'The Sui anchor is missing or does not match.',
      body: 'The compact on-chain receipt pointer is not bound to this exact Walrus evidence artifact yet.',
      reputation: 'The record can be reviewed, but it is not final portable reputation until the Sui anchor binds.',
    };
  }
  if (kind === 'memory' || ids.has('memory_hash')) {
    return {
      title: 'The receipt artifact hash does not recompute.',
      body: 'The passport receipt entry differs from the hash stored with the receipt.',
      reputation: 'Treat this passport entry as untrusted until the receipt artifact is rebuilt or corrected.',
    };
  }
  return {
    title: 'One or more proof checks failed.',
    body: 'Receipter could not prove every required part of this receipt from the stored evidence.',
    reputation: 'The record should require manual review before it improves the agent passport.',
  };
}

function friendlyFailedList(failedChecks) {
  if (!failedChecks.length) return '';
  return `<div class="failedExplain">${failedChecks.map((check) => {
    const friendly = friendlyCheck(check);
    return `<div><b>${escapeHtml(friendly.title)}</b><span>${escapeHtml(friendly.body)}</span></div>`;
  }).join('')}</div>`;
}

function friendlyCheck(check) {
  if (check.id === 'source_receipt_hash') {
    return {
      title: 'Source receipt changed or was built differently',
      body: 'The source receipt hash on the record does not match the hash Receipter recomputed from the attached source observations.',
    };
  }
  if (check.id === 'source_claims') {
    return {
      title: 'No structured source-backed claims',
      body: 'The worker output did not include claim objects that point to specific source observations.',
    };
  }
  if (check.id === 'walrus_readback') {
    return {
      title: 'Walrus readback failed',
      body: 'Receipter could not read the blob back from the Walrus aggregator and match it to the receipt.',
    };
  }
  if (check.id === 'walrus_binding') {
    return {
      title: 'Walrus blob is not bound',
      body: 'The receipt does not point to a usable Walrus blob id.',
    };
  }
  if (check.id === 'worker_evidence_hash') {
    return {
      title: 'Worker evidence hash mismatch',
      body: 'The worker evidence recomputed in the browser/server does not match the stored receipt hash.',
    };
  }
  if (check.id === 'sui_anchor_binding') {
    return {
      title: 'Sui anchor missing or mismatched',
      body: 'The on-chain receipt event is not bound to this record yet.',
    };
  }
  if (check.id === 'memory_hash') {
    return {
      title: 'Memory hash mismatch',
      body: 'The passport receipt entry does not recompute to the recorded artifact hash.',
    };
  }
  if (check.id === 'verification_completeness') {
    return {
      title: 'Proof packet is incomplete',
      body: 'A required proof family is missing or failed, so the receipt cannot become clean reputation yet.',
    };
  }
  return {
    title: check.id.replaceAll('_', ' '),
    body: check.detail || 'This check did not pass.',
  };
}

function rawDetails(checks) {
  return `<details class="rawChecks"><summary>Show raw check details</summary>${checksMarkup(checks)}</details>`;
}

function checksMarkup(checks) {
  return `<div class="checkGrid">${checks.map((check) => {
    const friendly = friendlyCheck(check);
    return `<div class="${escapeHtml(check.status)}">
      <b>${escapeHtml(friendly.title)}</b>
      <span>${escapeHtml(check.detail || friendly.body || check.status)}</span>
      <code>${escapeHtml(check.id)} / ${escapeHtml(check.status)}</code>
    </div>`;
  }).join('')}</div>`;
}

function short(text, head = 10, tail = 6) {
  if (!text) return 'pending';
  const str = String(text);
  if (str.length <= head + tail + 3) return str;
  return `${str.slice(0, head)}...${str.slice(-tail)}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

$('search').addEventListener('input', (event) => {
  state.query = event.target.value;
  renderAgents();
});
$('sortSelect').addEventListener('change', (event) => {
  state.sort = event.target.value;
  renderAgents();
});
$('categoryChips').addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  state.category = button.dataset.category;
  document.querySelectorAll('[data-category]').forEach((item) => item.classList.toggle('active', item === button));
  renderAgents();
});
$('refreshBtn').addEventListener('click', load);
$('passportVerifyBtn').addEventListener('click', verifySelectedPassport);
$('agentList').addEventListener('click', (event) => {
  const card = event.target.closest('[data-worker]');
  if (!card) return;
  state.selected = card.dataset.worker;
  render();
});
$('receiptList').addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-toggle-record]');
  if (toggle) {
    const runId = toggle.dataset.toggleRecord;
    if (state.openRecords.has(runId)) state.openRecords.delete(runId);
    else state.openRecords.add(runId);
    renderDetail();
    return;
  }
  const button = event.target.closest('[data-verify]');
  if (button) {
    verify(button.dataset.verify, button.dataset.verifyKind || 'full');
    return;
  }
  const challenge = event.target.closest('[data-challenge]');
  if (challenge) {
    assessChallenge(challenge.dataset.challenge);
    return;
  }
  const prepareSlashButton = event.target.closest('[data-prepare-slash]');
  if (prepareSlashButton) {
    prepareSlash(prepareSlashButton.dataset.prepareSlash);
    return;
  }
  const signSlashButton = event.target.closest('[data-sign-slash]');
  if (signSlashButton) signSlash(signSlashButton.dataset.signSlash);
});
$('ownerVerifyBtn').addEventListener('click', verifyOwnerAddress);
$('ownerAddress').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') verifyOwnerAddress();
});

load().catch((error) => {
  $('agentList').innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
});
