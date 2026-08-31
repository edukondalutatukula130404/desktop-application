const { initSocketServer, getSocketIO, broadcastEvent } = require('../../socket/socket');

module.exports = {
  initSocket: initSocketServer,
  getIO: getSocketIO,
  emitToCompany: broadcastEvent,
  broadcastEvent
};
