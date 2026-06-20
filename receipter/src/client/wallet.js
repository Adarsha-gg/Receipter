const SUI_SDK_TRANSACTIONS_URL = 'https://esm.sh/@mysten/sui@2.19.0/transactions';
const SUI_WALLET_STANDARD_URL = 'https://esm.sh/@mysten/wallet-standard@0.21.1';

let sdkPromise;
let selectedWallet;
let selectedAccount;

async function loadSuiSdk() {
  sdkPromise ??= Promise.all([import(SUI_SDK_TRANSACTIONS_URL), import(SUI_WALLET_STANDARD_URL)]).then(
    ([transactions, walletStandard]) => ({
      Transaction: transactions.Transaction,
      getWallets: walletStandard.getWallets,
      signAndExecuteTransaction: walletStandard.signAndExecuteTransaction,
    }),
  );
  return sdkPromise;
}

async function listWallets(chain = 'sui:testnet') {
  const { getWallets } = await loadSuiSdk();
  const walletApi = getWallets();
  return walletApi
    .get()
    .filter((wallet) => supportsChain(wallet, chain) && supportsSignAndExecute(wallet));
}

async function connect(options = {}) {
  const chain = options.chain || 'sui:testnet';
  const wallets = await listWallets(chain);
  if (!wallets.length) {
    throw new Error('No Sui Wallet Standard wallet found. Install or unlock a Sui wallet extension.');
  }

  const wallet = options.walletName
    ? wallets.find((candidate) => candidate.name === options.walletName)
    : selectedWallet && wallets.find((candidate) => candidate.name === selectedWallet.name) || wallets[0];
  if (!wallet) {
    throw new Error(`Sui wallet not found: ${options.walletName}`);
  }

  const connectFeature = wallet.features['standard:connect'];
  if (!connectFeature) {
    throw new Error(`${wallet.name} does not expose standard:connect.`);
  }

  await connectFeature.connect();
  const account = chooseAccount(wallet, chain);
  if (!account) {
    throw new Error(`${wallet.name} has no account for ${chain}.`);
  }

  selectedWallet = wallet;
  selectedAccount = account;
  return walletStatus(chain);
}

async function walletStatus(chain = 'sui:testnet') {
  const wallets = await listWallets(chain);
  const wallet = selectedWallet && wallets.find((candidate) => candidate.name === selectedWallet.name);
  const account = wallet ? chooseAccount(wallet, chain) : undefined;
  if (wallet && account) {
    selectedWallet = wallet;
    selectedAccount = account;
  }
  return {
    connected: Boolean(wallet && account),
    walletName: wallet?.name,
    address: account?.address,
    chain,
    wallets: wallets.map((candidate) => candidate.name),
  };
}

async function signAndExecute(request, options = {}) {
  const chain = request.chain || `sui:${request.network || 'testnet'}`;
  if (!selectedWallet || !selectedAccount || !accountSupportsChain(selectedAccount, chain)) {
    await connect({ chain, walletName: options.walletName });
  }

  const wallet = selectedWallet;
  const account = selectedAccount;
  if (!wallet || !account) throw new Error('Sui wallet is not connected.');

  const { signAndExecuteTransaction } = await loadSuiSdk();
  const transaction = await buildTransaction(request);
  const output = signAndExecuteTransaction
    ? await signAndExecuteTransaction(wallet, { transaction, account, chain })
    : await wallet.features['sui:signAndExecuteTransaction'].signAndExecuteTransaction({ transaction, account, chain });
  const digest = output?.digest || output?.effects?.transactionDigest;
  if (!digest) {
    throw new Error('Wallet execution finished without a transaction digest.');
  }
  return { digest, output, walletName: wallet.name, address: account.address, chain };
}

async function buildTransaction(request) {
  if (!request || request.objectType !== 'receipter.sui_wallet_transaction_request.v1') {
    throw new Error('Unsupported Receipter wallet transaction request.');
  }
  const { Transaction } = await loadSuiSdk();
  const tx = new Transaction();
  if (request.gasBudgetMist) tx.setGasBudget(Number(request.gasBudgetMist));

  const assigned = new Map();
  for (const command of request.commands || []) {
    if (command.kind === 'splitCoins') {
      const coins = tx.splitCoins(
        command.source === 'gas' ? tx.gas : resolveAssigned(command.source, assigned),
        command.amountsMist.map((amount) => pure(tx, { kind: 'pure', type: 'u64', value: amount })),
      );
      assigned.set(command.assign, Array.isArray(coins) ? coins : [coins]);
      continue;
    }
    if (command.kind === 'transferObjects') {
      tx.transferObjects(
        command.objects.map((name) => resolveAssigned(name, assigned)),
        tx.pure.address(command.recipient),
      );
      continue;
    }
    if (command.kind === 'moveCall') {
      tx.moveCall({
        target: command.target,
        arguments: command.arguments.map((argument) => moveArgument(tx, argument)),
      });
      continue;
    }
    throw new Error(`Unsupported Sui wallet command: ${command.kind}`);
  }

  return tx;
}

function moveArgument(tx, argument) {
  if (argument.kind === 'object') return tx.object(argument.objectId);
  return pure(tx, argument);
}

function pure(tx, argument) {
  if (argument.type === 'u64') {
    return typeof tx.pure.u64 === 'function' ? tx.pure.u64(argument.value) : tx.pure('u64', argument.value);
  }
  if (argument.type === 'u16') {
    return typeof tx.pure.u16 === 'function' ? tx.pure.u16(Number(argument.value)) : tx.pure('u16', Number(argument.value));
  }
  if (argument.type === 'vector<u8>') {
    const bytes = argument.bytes || Array.from(new TextEncoder().encode(argument.value || ''));
    return typeof tx.pure.vector === 'function' ? tx.pure.vector('u8', bytes) : tx.pure(Uint8Array.from(bytes));
  }
  throw new Error(`Unsupported Sui pure argument type: ${argument.type}`);
}

function resolveAssigned(name, assigned) {
  const match = /^([A-Za-z_][\w-]*)(?:\.(\d+))?$/.exec(name);
  if (!match) throw new Error(`Invalid transaction result reference: ${name}`);
  const values = assigned.get(match[1]);
  if (!values) throw new Error(`Unknown transaction result reference: ${name}`);
  const index = match[2] === undefined ? 0 : Number(match[2]);
  if (!values[index]) throw new Error(`Transaction result reference is out of range: ${name}`);
  return values[index];
}

function supportsChain(wallet, chain) {
  return Array.isArray(wallet.chains) && wallet.chains.includes(chain);
}

function supportsSignAndExecute(wallet) {
  return Boolean(wallet.features?.['standard:connect'] && wallet.features?.['sui:signAndExecuteTransaction']);
}

function chooseAccount(wallet, chain) {
  return (wallet.accounts || []).find((account) => accountSupportsChain(account, chain));
}

function accountSupportsChain(account, chain) {
  return Array.isArray(account.chains) && account.chains.includes(chain);
}

window.ReceipterWallet = {
  listWallets,
  connect,
  status: walletStatus,
  signAndExecute,
  buildTransaction,
};
