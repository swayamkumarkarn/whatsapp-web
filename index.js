const { Client,LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: 'SamroN'
    })
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('qr', qr => {
    // Generate the QR code as a string with more control over the size
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
    setTimeout(() => {
        if (message.body === 'hi') {
            // send back "pong" to the chat the message was sent in
            client.sendMessage(message.from, `${JSON.stringify(message)} `);
        }
        // console.log('message \n',message);
    }, 3000);
});
