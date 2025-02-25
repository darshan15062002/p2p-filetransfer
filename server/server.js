const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Keep track of connected clients
const clients = new Map();

wss.on('connection', (ws) => {


    const clientId = generateClientId();
    clients.set(clientId, ws);

    // Send the client their ID
    ws.send(JSON.stringify({
        type: 'connect',
        clientId: clientId
    }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        console.log("received message", data);


        // Handle signaling messages
        if (data.type === 'signal') {
            const targetClient = clients.get(data.to);
            if (targetClient) {
                targetClient.send(JSON.stringify({
                    type: 'signal',
                    from: clientId,
                    signal: data.signal
                }));
                console.log("forwarded signal to", {
                    type: 'signal',
                    from: clientId,
                    signal: data.signal
                });

            }
        }
    });

    ws.on('close', () => {
        clients.delete(clientId);
    });
});

function generateClientId() {
    return Math.random().toString(36).substr(2, 9);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
});
