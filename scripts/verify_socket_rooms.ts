
import { io } from 'socket.io-client';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const DRIVER_TOKEN = process.env.DRIVER_TOKEN || ''; // Needs a valid token to test

async function main() {
    console.log(`Connecting to ${SERVER_URL}...`);

    // 1. Connect as Driver
    const socket = io(SERVER_URL, {
        auth: { token: DRIVER_TOKEN },
        transports: ['websocket']
    });

    socket.on('connect', () => {
        console.log('✅ Driver Socket Connected:', socket.id);
        // We can't easily "list rooms" from client side without server help.
        // But we can check if we receive events.
    });

    socket.on('connect_error', (err) => {
        console.error('❌ Connection Error:', err.message);
    });

    socket.on('order:assigned', (data) => {
        console.log('📩 Received order:assigned event:', data);
    });

    // Keep alive for a bit
    setTimeout(() => {
        console.log('Closing socket...');
        socket.disconnect();
    }, 5000);
}

// main();
console.log("This script is a template. Real verification needs server-side access or a valid token.");
