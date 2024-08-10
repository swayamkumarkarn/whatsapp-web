require("dotenv").config();
const express = require("express");
const { Client } = require("whatsapp-web.js");
const CustomRemoteAuth = require("./lib/auth/CustomRemoteAuth");
const { MongoStore } = require("wwebjs-mongo");
const mongoose = require("mongoose");

let chrome = {};
let puppeteer;

// Check if running in an AWS Lambda environment
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_VERSION;

if (isLambda) {
  chrome = require("chrome-aws-lambda");
  puppeteer = require("puppeteer-core");
} else {
  puppeteer = require("puppeteer");
}

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000; // Use PORT from env or default to 3000

// Function to configure Puppeteer options based on environment
const getPuppeteerOptions = async () => {
  if (isLambda) {
    return {
      args: [
        ...chrome.args,
        "--hide-scrollbars",
        "--disable-web-security",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
      ],
      defaultViewport: chrome.defaultViewport,
      executablePath: await chrome.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    };
  } else {
    return {
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    };
  }
};

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("[App] Connected to MongoDB server.");

    // Create a new MongoStore instance
    const store = new MongoStore({ mongoose: mongoose });

    // Initialize the CustomRemoteAuth strategy
    const auth = new CustomRemoteAuth({
      clientId: "client-one",
      dataPath: "./sessions",
      store: store,
      backupSyncIntervalMs: 300000, // 5 minutes interval for backup
    });

    // Get Puppeteer options based on environment
    const options = await getPuppeteerOptions();

    // Initialize the WhatsApp client with the custom authentication strategy
    const client = new Client({
      authStrategy: auth,
      puppeteer: options,
    });

    // Event: QR Code generated
    client.on("qr", (qr) => {
      console.log("[App] QR Code generated. Please scan this code with your WhatsApp app.");
      // Uncomment if you want to display the QR code in the terminal
      // qrcode.generate(qr, { small: true });
    });

    // Event: Client is ready
    client.on("ready", () => {
      console.log("[App] WhatsApp client is ready.");
    });

    // Event: Remote session saved
    client.on("remote_session_saved", () => {
      console.log("[App] Session backup completed and stored in the remote store.");
    });

    client.on("message_create", (message) => {
      let response;
      switch (message.body) {
        case "prashant":
          response = "Bhai Mera";
          break;
        case "hi":
          response = "Coyoki this side";
          break;
        case "samron":
          response = "ohh! you know me";
          break;
        default:
          response = null;
      }

      if (response) {
        setTimeout(() => {
          client.sendMessage(message.from, response);
        }, 4000); // Adjust delay if needed
      }
    });

    // Event: Authentication success
    client.on("authenticated", () => {
      console.log("[App] WhatsApp client authenticated successfully.");
    });

    // Event: Authentication failure
    client.on("auth_failure", (msg) => {
      console.error("[App] WhatsApp client authentication failed:", msg);
      // Try to reinitialize on auth failure
      setTimeout(async () => {
        const options = await getPuppeteerOptions();
        client.puppeteer = options;
        await client.initialize();
      }, 5000); // Retry after 5 seconds
    });

    // Event: Disconnected
    client.on("disconnected", (reason) => {
      console.log("[App] WhatsApp client disconnected:", reason);
      // Reinitialize on disconnection
      setTimeout(async () => {
        const options = await getPuppeteerOptions();
        client.puppeteer = options;
        await client.initialize();
      }, 5000); // Retry after 5 seconds
    });

    // Initialize the client
    await client.initialize();
    console.log("[App] WhatsApp client initialized.");
  })
  .catch((err) => {
    console.error("[App] Failed to connect to MongoDB:", err);
  });

// Define a basic route to check if the app is running
app.get("/", (req, res) => {
  res.send("Hello, your WhatsApp bot is running!");
});

// Start the Express server
app.listen(port, () => {
  console.log(`[App] Express server is running on http://localhost:${port}`);
});
