const jwt = require('jsonwebtoken');

module.exports = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      console.log('Socket auth failed: No token provided');
      return next(new Error('Authentication error'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      console.log('Socket authenticated:', decoded.id);
      next();
    } catch (error) {
      console.error('Socket auth error:', error.message, { stack: error.stack });
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.user.id);

    socket.on('joinRoom', (projectId) => {
      socket.join(projectId);
      console.log(`${socket.user.id} joined room ${projectId}`);
      socket.to(projectId).emit('userJoined', socket.user.id);
    });

    socket.on('leaveRoom', (projectId) => {
      socket.leave(projectId);
      console.log(`${socket.user.id} left room ${projectId}`);
      socket.to(projectId).emit('userDisconnected', socket.user.id);
    });

    socket.on('codeChange', ({ projectId, fileName, content }) => {
      console.log(`Code change from ${socket.user.id} for ${projectId}/${fileName}:`, content);
      socket.to(projectId).emit('codeChange', { projectId, fileName, content, senderId: socket.user.id });
    });

    socket.on('cursorMove', ({ projectId, userId, position }) => {
      console.log(`Cursor move from ${userId} in ${projectId}:`, position);
      socket.to(projectId).emit('cursorMove', { projectId, userId, position });
    });

    socket.on('projectUpdate', (project) => {
      console.log('Broadcasted project update for room:', project._id);
      socket.to(project._id).emit('projectUpdate', project);
    });

    socket.on('meetingUpdate', (meeting) => {
      console.log('Broadcasted meeting update for room:', meeting.projectId);
      socket.to(meeting.projectId).emit('meetingUpdate', meeting);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.user.id);
      const rooms = Object.keys(socket.rooms).filter((room) => room !== socket.id);
      rooms.forEach((room) => socket.to(room).emit('userDisconnected', socket.user.id));
    });
  });
};