document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy]');
  if (!button) return;
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    button.textContent = 'Copied';
  } catch {
    button.textContent = 'Copy failed';
  }
  setTimeout(() => {
    button.textContent = original;
  }, 1200);
});

let preparedStakeSigning;

async function loadAgentCard() {
  const target = document.getElementById('agentCardPreview');
  if (!target) return;
  try {
    const response = await fetch('/.well-known/agent-card.json');
    const card = await response.json();
    if (!response.ok) throw new Error(card?.error || `HTTP ${response.status}`);
    const tools = card.capabilities || card.tools || [];
    const links = card.links || card.endpoints || {};
    target.innerHTML = `<div class="agentCardGrid">
      <div><span>Agent</span><b>${escapeHtml(card.name || card.workerAgentId || 'Receipter worker')}</b></div>
      <div><span>Protocol</span><b>${escapeHtml(card.protocol || card.objectType || 'agent-card')}</b></div>
      <div><span>Passport</span><b>${escapeHtml(short(card.memoryPassport?.latestWalrusBlobId || card.latestWalrusBlobId || links.memoryPassport || 'advertised'))}</b></div>
      <div><span>Tools</span><b>${escapeHtml(Array.isArray(tools) ? tools.length : Object.keys(tools).length)}</b></div>
    </div>
    <pre><button class="copy" data-copy="${escapeHtml(JSON.stringify(card, null, 2))}">Copy</button><code>${escapeHtml(JSON.stringify(card, null, 2))}</code></pre>`;
  } catch (error) {
    target.textContent = error.message;
  }
}

function short(value, head = 14, tail = 8) {
  const text = String(value ?? '');
  return text.length > head + tail + 3 ? `${text.slice(0, head)}...${text.slice(-tail)}` : text;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

loadAgentCard();

document.getElementById('prepareStakeBtn')?.addEventListener('click', prepareStakeTransaction);
document.getElementById('signStakeBtn')?.addEventListener('click', signPreparedStakeTransaction);

async function prepareStakeTransaction() {
  const target = document.getElementById('stakeResult');
  const signButton = document.getElementById('signStakeBtn');
  target.className = 'stakeResult';
  target.textContent = 'Preparing stake transaction...';
  signButton.disabled = true;
  preparedStakeSigning = undefined;
  try {
    const action = value('stakeAction');
    const signing = await requestStakeSigning(action);
    preparedStakeSigning = signing;
    signButton.disabled = false;
    target.className = 'stakeResult good';
    target.innerHTML = `<strong>${escapeHtml(signing.walletTransactionRequest?.summary || 'Stake transaction prepared')}</strong>
      <span>${escapeHtml(signing.walletTransactionRequest?.kind || action)} / ${escapeHtml(signing.walletTransactionRequest?.expected?.events?.join(', ') || 'expected event')}</span>
      <pre><button class="copy" data-copy="${escapeHtml(JSON.stringify(signing.walletTransactionRequest, null, 2))}">Copy</button><code>${escapeHtml(JSON.stringify(signing.walletTransactionRequest, null, 2))}</code></pre>`;
  } catch (error) {
    target.className = 'stakeResult bad';
    target.textContent = error.message;
  }
}

async function requestStakeSigning(action) {
  if (action === 'oracle') return getJson('/api/stake/oracle-registry-transaction');
  if (action === 'open') return postJson('/api/stake/open-transaction', {
    workerAgentId: value('stakeWorker'),
    amountMist: value('stakeAmount'),
  });
  if (action === 'attach') return postJson('/api/stake/attach-transaction', {
    positionId: value('stakePosition'),
    amountMist: value('stakeAmount'),
  });
  if (action === 'challenge') return postJson('/api/stake/challenge-transaction', {
    oracleRegistryId: value('stakeRegistry'),
    positionId: value('stakePosition'),
    evidenceHash: value('stakeEvidence'),
    reason: value('stakeReason'),
    slashAmountMist: value('stakeAmount'),
  });
  if (action === 'resolve') return postJson('/api/stake/resolve-challenge-transaction', {
    positionId: value('stakePosition'),
    challengeDecisionId: value('stakeDecision'),
  });
  throw new Error(`Unsupported stake action: ${action}`);
}

async function signPreparedStakeTransaction() {
  const target = document.getElementById('stakeResult');
  if (!preparedStakeSigning) {
    target.className = 'stakeResult bad';
    target.textContent = 'Prepare a stake transaction first.';
    return;
  }
  if (!window.ReceipterWallet) {
    target.className = 'stakeResult bad';
    target.textContent = 'Wallet adapter still loading.';
    return;
  }
  target.className = 'stakeResult';
  target.textContent = 'Waiting for wallet signature...';
  try {
    const execution = await window.ReceipterWallet.signAndExecute(preparedStakeSigning.walletTransactionRequest);
    const payload = { ...preparedStakeSigning.executionPayloadTemplate, transaction: execution.digest };
    const verified = await postJson(preparedStakeSigning.verifyEndpoint, payload);
    target.className = 'stakeResult good';
    target.innerHTML = `<strong>Stake transaction verified</strong>
      <span>${escapeHtml(verified.kind)} / ${escapeHtml(verified.network)} / ${escapeHtml(short(verified.transaction, 12, 6))}</span>
      <pre><button class="copy" data-copy="${escapeHtml(JSON.stringify(verified, null, 2))}">Copy</button><code>${escapeHtml(JSON.stringify(verified, null, 2))}</code></pre>`;
  } catch (error) {
    target.className = 'stakeResult bad';
    target.textContent = error.message;
  }
}

async function getJson(path) {
  const response = await fetch(path);
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
  return body;
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
  return parsed;
}

function value(id) {
  return document.getElementById(id)?.value.trim() || '';
}
