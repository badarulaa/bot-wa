require("dotenv").config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const axios = require("axios");
const P = require("pino");

const RECEIVER_URL = process.env.RECEIVER_URL;
let TARGET_GROUP_ID = process.env.TARGET_GROUP_ID || null;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

  const sock = makeWASocket({
    logger: P({ level: "silent" }),
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log("❌ Koneksi terputus. Reconnect:", shouldReconnect);
      if (shouldReconnect) startBot();
    }

    if (connection === "open") {
      console.log("✅ Bot WhatsApp terhubung");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const chatId = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!text) return;

    // Auto-detect group pertama (sekali saja)
    if (!TARGET_GROUP_ID && chatId.endsWith("@g.us")) {
      TARGET_GROUP_ID = chatId;
      console.log("🎯 TARGET_GROUP_ID:", TARGET_GROUP_ID);
    }

    // Filter grup
    if (chatId !== TARGET_GROUP_ID) return;

    console.log("📩 Pesan:", text);

    try {
      // Rekap command
      if (text.toLowerCase() === "rekap harian") {
        const res = await axios.get(`${RECEIVER_URL}/rekap_today`);
        await sock.sendMessage(chatId, { text: res.data.text });
        return;
      }

      if (text.toLowerCase() === "rekap mingguan") {
        const res = await axios.get(`${RECEIVER_URL}/rekap_week`);
        await sock.sendMessage(chatId, { text: res.data.text });
        return;
      }

      if (text.toLowerCase() === "rekap bulanan") {
        const res = await axios.get(`${RECEIVER_URL}/rekap_month`);
        await sock.sendMessage(chatId, { text: res.data.text });
        return;
      }

      // Kirim transaksi ke receiver
      const res = await axios.post(`${RECEIVER_URL}/received`, {
        text,
        sender: msg.key.participant || msg.key.remoteJid
      });

      // Auto-reply sukses
      if (res.data?.status === "saved") {
        await sock.sendMessage(chatId, {
          text: "✅ Transaksi dicatat"
        });
      }
    } catch (err) {
      console.log("❌ Error:", err.message);
      await sock.sendMessage(chatId, {
        text: "❌ Gagal memproses pesan"
      });
    }
  });
}

startBot();
