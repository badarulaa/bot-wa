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

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    logger: Pino({ level: "silent" }),
    browser: ["KeuanganBot", "Ubuntu", "1.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("📱 Scan QR berikut:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("✅ WhatsApp Connected");
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut;

      console.log("❌ Koneksi terputus. Reconnect:", shouldReconnect);

      if (shouldReconnect) {
        setTimeout(startBot, 5000); // ⬅️ PENTING
      } else {
        console.log("❌ Logout. Hapus auth_info lalu scan ulang.");
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

    const body = text.trim().toLowerCase();
    console.log("📩 Pesan diterima:", body);

    try {
      // ====== COMMAND REKAP ======
      if (body === "rekap harian") {
        const res = await axios.get(`${RECEIVER_URL}/rekap_today`);
        await sock.sendMessage(from, { text: res.data.text });
        return;
      }

      if (body === "rekap mingguan") {
        const res = await axios.get(`${RECEIVER_URL}/rekap_week`);
        await sock.sendMessage(from, { text: res.data.text });
        return;
      }

      if (body === "rekap bulanan") {
        const res = await axios.get(`${RECEIVER_URL}/rekap_month`);
        await sock.sendMessage(from, { text: res.data.text });
        return;
      }

      // ====== TRANSAKSI ======
      const res = await axios.post(`${RECEIVER_URL}/received`, {
        text: body
      });

      if (res.data?.status === "saved") {
        await sock.sendMessage(from, {
          text: "✅ Transaksi tercatat"
        });
      }

    } catch (err) {
      console.error("❌ Error:", err.message);
      await sock.sendMessage(from, {
        text: "❌ Terjadi error saat memproses data"
      });
    }
  });
}

startBot();
