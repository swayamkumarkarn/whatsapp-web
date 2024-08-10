require('dotenv').config();
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal'); // Import qrcode-terminal

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
            console.log("session saved ");
        });


        client.on('authenticated', (session) => {
            console.log('WhatsApp client is authenticated.');
        });

        client.on('auth_failure', msg => {
            console.error('WhatsApp client authentication failure', msg);
        });

        client.on('message_create', message => {
            if (message.body === 'ping') {
                // send back "pong" to the chat the message was sent in
                client.sendMessage(message.from, 'pong');
            }
        });

        client.initialize();
    })
    .catch(err => {
        console.error('Failed to connect to MongoDB', err);
    });
