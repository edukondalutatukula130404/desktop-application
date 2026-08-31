const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

function initSocketServer(httpServer) {
  const clientUrl = process.env.CLIENT_URL || '*';

  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    },
    transports: ['websocket', 'polling']
  });

  // Socket Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const companyIdQuery = socket.handshake.auth?.companyId || socket.handshake.query?.companyId;

    if (companyIdQuery) {
      socket.companyId = companyIdQuery;
    }

    if (token) {
      try {
        const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_vexastyle_2026_auth_page';
        const decoded = jwt.verify(token, secret);
        socket.user = decoded;
        socket.companyId = decoded.companyId || socket.companyId || `shop_${decoded.id}`;
      } catch (err) {
        // Fallback for dev / offline tokens
      }
    }

    if (!socket.companyId) {
      socket.companyId = 'shop_default';
    }

    next();
  });

  io.on('connection', (socket) => {
    const companyId = socket.companyId || 'shop_default';
    const deviceId = socket.handshake.query?.deviceId || socket.id;

    socket.join(companyId);
    console.log(`🔌 [Socket.IO] Multi-Device Client Connected (${deviceId}) in Room: ${companyId}`);

    socket.on('join_company', (targetCompanyId) => {
      if (targetCompanyId) {
        socket.leave(socket.companyId);
        socket.companyId = targetCompanyId;
        socket.join(targetCompanyId);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 [Socket.IO] Client Disconnected (${socket.id}): ${reason}`);
    });
  });

  return io;
}

function getSocketIO() {
  return io;
}

function broadcastEvent(companyId, eventName, payload = {}) {
  if (!io) return;

  const room = companyId || 'shop_default';
  const eventData = {
    event: eventName,
    companyId: room,
    timestamp: new Date().toISOString(),
    ...payload
  };

  console.log(`⚡ [Socket.IO Broadcast] Emitting '${eventName}' to room '${room}'`);
  io.to(room).emit(eventName, eventData);

  // Fallback broadcast to shop_default room for single-tenant / dev devices
  if (room !== 'shop_default') {
    io.to('shop_default').emit(eventName, eventData);
  }
}

module.exports = {
  initSocketServer,
  getSocketIO,
  broadcastEvent
};
