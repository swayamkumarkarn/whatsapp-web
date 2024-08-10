const chromium = require('chrome-aws-lambda');
const { Client } = require('whatsapp-web.js');
const CustomRemoteAuth = require('./lib/auth/CustomRemoteAuth');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');
const express = require('express');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000; // Use PORT from env or default to 3000

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log('[App] Connected to MongoDB server.');

        // Create a new MongoStore instance
        const store = new MongoStore({ mongoose: mongoose });

        // Initialize the CustomRemoteAuth strategy
        const auth = new CustomRemoteAuth({
            clientId: 'client-one',
            dataPath: '/tmp/sessions',  // Use Vercel's /tmp directory
            store: store,
            backupSyncIntervalMs: 300000, // 5 minutes interval for backup
        });

        // Initialize the WhatsApp client with the custom authentication strategy
        const client = new Client({
            authStrategy: auth,
            puppeteer: {
                headless: true,
                executablePath: await chromium.executablePath,
                args: chromium.args,
                defaultViewport: chromium.defaultViewport,
            }
        });

        // Event: QR Code generated
        client.on('qr', qr => {
            console.log('[App] QR Code generated. Please scan this code with your WhatsApp app:');
            qrcode.generate(qr, { small: true });
        });

        // Event: Client is ready
        client.on('ready', () => {
            console.log('[App] WhatsApp client is ready.');
        });

        // Event: Remote session saved
        client.on('remote_session_saved', () => {
            console.log('[App] Session backup completed and stored in the remote store.');
        });

        client.on('message_create', message => {
            if (message.body === 'prashant') {
                setTimeout(() => {
                    client.sendMessage(message.from, 'Bhai Mera');
                }, 4000);
            }
            if (message.body === 'hi') {
                setTimeout(() => {
                    client.sendMessage(message.from, 'Coyoki this side');
                }, 6000);
            }
            if (message.body === 'samron') {
                setTimeout(() => {
                    client.sendMessage(message.from, 'ohh! you know me');
                }, 9000);
            }
        });

        // Event: Authentication success
        client.on('authenticated', () => {
            console.log('[App] WhatsApp client authenticated successfully.');
        });

        // Event: Authentication failure
        client.on('auth_failure', msg => {
            console.error('[App] WhatsApp client authentication failed:', msg);
        });

        // Event: Disconnected
        client.on('disconnected', reason => {
            console.log('[App] WhatsApp client disconnected:', reason);
        });

        // Initialize the client
        await client.initialize();

        console.log('[App] WhatsApp client initialized.');

    })
    .catch(err => {
        console.error('[App] Failed to connect to MongoDB:', err);
    });

// Define a basic route to check if the app is running
app.get('/', (req, res) => {
    res.send('Hello, your WhatsApp bot is running!');
});

// Start the Express server
app.listen(port, () => {
    console.log(`[App] Express server is running on http://localhost:${port}`);
});
