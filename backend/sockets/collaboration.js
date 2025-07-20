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

        socket.on('joinRoom', async ({ projectId, username }) => {
            if (!projectId) return;
            socket.join(projectId);
            console.log(`${socket.user.username} (ID: ${socket.user.id}) joined room ${projectId}`);

            // Emit to others that the user has joined
            socket.to(projectId).emit('userJoined', { id: socket.user.id, username: socket.user.username });

            // Fetch and send initial state (current collaborators excluding self)
            const socketsInRoom = await io.in(projectId).fetchSockets();
            const initialCollaborators = {};
            for (const s of socketsInRoom) {
                if (s.id !== socket.id) {
                    initialCollaborators[s.user.id] = { username: s.user.username };
                }
            }
            socket.emit('initialState', initialCollaborators);
        });

        socket.on('leaveRoom', ({ projectId }) => {
            if (!projectId) return;
            socket.leave(projectId);
            console.log(`${socket.user.username} (ID: ${socket.user.id}) left room ${projectId}`);
            // Notify others of the departure
            socket.to(projectId).emit('userLeft', socket.user.id);
        });

        socket.on('codeChange', ({ projectId, fileName, content }) => {
            console.log(`Code change from ${socket.user.id} for ${projectId}/${fileName}`);
            socket.to(projectId).emit('codeChange', {
                projectId,
                fileName,
                content,
                senderId: socket.user.id,
            });
        });

        socket.on('cursorMove', ({ projectId, position }) => {
            console.log(`Cursor move from ${socket.user.id} in ${projectId}:`, position);
            socket.to(projectId).emit('cursorMove', {
                userId: socket.user.id,
                username: socket.user.username,
                position,
            });
        });

        socket.on('projectUpdate', (project) => {
            console.log('Broadcasted project update for room:', project._id);
            socket.to(project._id).emit('projectUpdate', project);
        });

        socket.on('meetingUpdate', (meeting) => {
            console.log('Broadcasted meeting update for room:', meeting.projectId);
            socket.to(meeting.projectId).emit('meetingUpdate', meeting);
        });

        socket.on('disconnect', async () => {
            console.log('User disconnected:', socket.user.id);
            // Notify all rooms the user was in
            const rooms = Array.from(socket.rooms).filter((room) => room !== socket.id);
            for (const room of rooms) {
                socket.to(room).emit('userLeft', socket.user.id);
            }
        });
    });
};
