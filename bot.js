require("dotenv").config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
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

  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    logger: Pino({ level: "silent" }),
    browser: ["Ubuntu", "Chrome", "20.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("📱 Scan QR:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("✅ WhatsApp connected");
      isConnecting = false;
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      console.log("❌ Koneksi terputus:", statusCode);

      isConnecting = false;

      if (statusCode !== DisconnectReason.loggedOut) {
        console.log("⏳ Reconnect 10 detik...");
        setTimeout(startBot, 10000);
      } else {
        console.log("❌ Logged out. Hapus auth_info dan scan ulang.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    if (from !== TARGET_GROUP_ID) return;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!text) return;

    try {
      await axios.post(`${RECEIVER_URL}/received`, { text });
      await sock.sendMessage(from, { text: "✅ Dicatat" });
    } catch {
      await sock.sendMessage(from, { text: "❌ Error sistem" });
    }
  });
}

startBot();
