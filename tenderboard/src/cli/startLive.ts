process.env.TENDERBOARD_MODE = process.env.TENDERBOARD_MODE ?? 'live';
const { startTenderBoardServer } = await import('../server/httpServer.js');
startTenderBoardServer();
