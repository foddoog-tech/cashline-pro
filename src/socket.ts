import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from './utils/jwt';
import { handleDriverTracking } from './socket/handlers/driverTracking';

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST']
        }
    });

    // Socket Auth Middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
            const errLog = `[${new Date().toISOString()}] ❌ Auth Error: Token missing for socket ${socket.id}\n`;
            require('fs').appendFileSync(require('path').join(__dirname, '../server_socket_debug.log'), errLog);
            return next(new Error('Authentication error: Token missing'));
        }

        try {
            const decoded = verifyAccessToken(token);
            socket.data.user = decoded;
            next();
        } catch (err) {
            const errLog = `[${new Date().toISOString()}] ❌ Auth Error: Invalid token for socket ${socket.id}\n`;
            require('fs').appendFileSync(require('path').join(__dirname, '../server_socket_debug.log'), errLog);
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const userLog = `[${new Date().toISOString()}] 🔌 Connection: ${socket.id}, User Data: ${JSON.stringify((socket as any).user)}\n`;
        console.log(userLog);
        const fs = require('fs');
        const path = require('path');
        fs.appendFileSync(path.join(__dirname, '../server_socket_debug.log'), userLog);

        // Join personal room using userId
        if ((socket as any).user?.userId) {
            socket.join((socket as any).user.userId);
            const logMsg = `[${new Date().toISOString()}] 🔌 Socket joined room: ${(socket as any).user.userId}\n`;
            console.log(logMsg);

            // Write to file for debug visibility
            const fs = require('fs');
            const path = require('path');
            fs.appendFileSync(path.join(__dirname, '../server_socket_debug.log'), logMsg);
        }

        // Register Handlers
        handleDriverTracking(io, socket);

        socket.on('disconnect', () => {
            console.log(`❌ Client disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};
