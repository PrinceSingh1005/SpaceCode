const jwt = require('jsonwebtoken');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Authenticate socket connection
    const token = socket.handshake.auth.token;
    if (!token) {
      console.log('No token provided for socket:', socket.id);
      socket.disconnect();
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { id, role }
      console.log('Authenticated user:', socket.user.id);
    } catch (error) {
      console.error('Socket auth error:', error);
      socket.disconnect();
      return;
    }

    // Join project room
    socket.on('join-room', (projectId) => {
      console.log(`User ${socket.user.id} joined room: ${projectId}`);
      socket.join(projectId);
      socket.to(projectId).emit('user-joined', socket.user.id);
    });

    // Handle code updates
    socket.on('code-update', ({ projectId, fileName, content }) => {
      console.log(`Code update received from user ${socket.user.id} for project ${projectId}, file ${fileName}:`, content);
      socket.to(projectId).emit('code-update', { fileName, content });
    });

    // Handle cursor movement
    socket.on('cursor-move', ({ projectId, userId, position }) => {
      console.log(`Cursor move from user ${userId} in project ${projectId}:`, position);
      socket.to(projectId).emit('cursor-move', { userId, position });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      socket.broadcast.emit('user-disconnected', socket.user.id);
    });

    // Leave project room
    socket.on('leave-room', (projectId) => {
      console.log(`User ${socket.user.id} left room: ${projectId}`);
      socket.leave(projectId);
    });
  });
};