



const express = require('express');
const { Client,LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();

app.get('/', (req, res) => {
    res.send('WhatsApp Web.js Bot is running.');
});

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: 'SamroN'
    })
});


client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('qr', qr => {
    qrcode.toString(qr, { type: 'terminal', small: true }, (err, url) => {
        if (err) {
            console.error(err);
        } else {
            console.log(url);
        }
    });
});

client.initialize();

client.on('message_create', message => {
    if (message.body === '!ping') {
        client.sendMessage(message.from, 'pong');
    }
});

module.exports = app;


