process.env.TENDERBOARD_MODE = process.env.TENDERBOARD_MODE ?? 'live';
await import('../agents/workerAgent.js');
