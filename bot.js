require("dotenv").config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

const Pino = require("pino");
const qrcode = require("qrcode-terminal");
const axios = require("axios");

const TARGET_GROUP_ID = process.env.TARGET_GROUP_ID;
const RECEIVER_URL = `http://127.0.0.1:${process.env.RECEIVER_PORT}`;

let isConnecting = false;

async function startBot() {
  if (isConnecting) return;
  isConnecting = true;

  console.log("🚀 Starting WhatsApp bot...");

  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    logger: Pino({ level: "silent" }),
    browser: ["Ubuntu", "Chrome", "20.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  // ================= CONNECTION =================
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📱 Scan QR Code:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("✅ WhatsApp connected");
      isConnecting = false;
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      console.log("❌ Connection closed:", statusCode ?? "unknown");

      isConnecting = false;

      if (statusCode !== DisconnectReason.loggedOut) {
        console.log("⏳ Reconnecting in 10 seconds...");
        setTimeout(startBot, 10000);
      } else {
        console.log("❌ Logged out. Delete 'auth_info' and scan QR again.");
      }
    }
  });

  // ================= MESSAGE HANDLER =================
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg || !msg.message) return;

    const from = msg.key.remoteJid;
    if (from !== TARGET_GROUP_ID) return;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!text) return;

    console.log("📩 Pesan diterima:", text);

    try {
      await axios.post(`${RECEIVER_URL}/received`, { text });
      console.log("✔ Terkirim ke receiver");
    } catch (err) {
      console.error(
        "❌ Gagal kirim ke receiver:",
        err.response?.status || err.message
      );
    }
  });
}

// ================= START =================
startBot();
