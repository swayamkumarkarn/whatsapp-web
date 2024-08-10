require('dotenv').config();
const express = require('express'); // Import Express
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000; // Use PORT from env or default to 3000

function getRandomValue(min = 4000, max = 9000) {
    let num = Math.floor(Math.random() * (max - min + 1)) + min;
    console.log("Random function executed:", num);
    return num;
}

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB server.');
        const store = new MongoStore({ mongoose: mongoose });
        const client = new Client({
            authStrategy: new RemoteAuth({
                store: store,
                backupSyncIntervalMs: 300000 // Backup every 5 minutes
            })
        });
        
        client.on('qr', qr => {
            qrcode.generate(qr, { small: true });
        });

        client.on('ready', () => {
            console.log('WhatsApp client is ready.');
        });

        client.on('remote_session_saved', () => {
            console.log("Session saved.");
        });

        client.on('authenticated', (session) => {
            console.log('WhatsApp client is authenticated.');
        });

        client.on('auth_failure', msg => {
            console.error('WhatsApp client authentication failure', msg);
        });

        client.on('message_create', message => {
            if (message.body === 'ping') {
                setTimeout(() => {
                    client.sendMessage(message.from, 'pong');
                }, getRandomValue());
            }
            if (message.body === 'hi') {
                setTimeout(() => {
                    client.sendMessage(message.from, 'hello');
                }, getRandomValue());
            }
        });

        client.initialize();
    })
    .catch(err => {
        console.error('Failed to connect to MongoDB', err);
    });

// Define a basic route
app.get('/', (req, res) => {
    res.send('Hello, your WhatsApp bot is running!');
});

// Start Express server
app.listen(port, () => {
    console.log(`Express server is running on http://localhost:${port}`);
});
