require("dotenv").config();

const wppconnect = require("@wppconnect-team/wppconnect");
const axios = require("axios");

// ENV
const TARGET_GROUP_ID = process.env.TARGET_GROUP_ID;
const RECEIVER_URL = `http://127.0.0.1:${process.env.RECEIVER_PORT}`;

console.log("🚀 Starting WhatsApp Bot...");
console.log("🎯 Target Group:", TARGET_GROUP_ID);
console.log("🔗 Receiver URL:", RECEIVER_URL);

wppconnect
  .create({
    session: "keuangan",
    autoClose: false,
    waitForLogin: true,
    disableWelcome: true,

    puppeteerOptions: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-infobars",
        "--single-process",
      ],
    },
  })

  .then((client) => {
    console.log("\n======================================");
    console.log("✅ BOT AKTIF 🚀");
    console.log("🎯 Listen ke grup:", TARGET_GROUP_ID);
    console.log("======================================\n");

    /**
     * ===============================
     * WA STATE MONITOR (PENTING)
     * ===============================
     */
    client.onStateChange((state) => {
      console.log("🔄 WA State:", state);

      if (
        state === "CONFLICT" ||
        state === "UNPAIRED" ||
        state === "UNLAUNCHED"
      ) {
        console.log("♻️ State error terdeteksi, restart via PM2...");
        process.exit(1); // PM2 akan restart otomatis
      }
    });

    /**
     * ===============================
     * MESSAGE HANDLER
     * ===============================
     */
    client.onMessage(async (message) => {
      try {
        // Hanya listen grup target
        if (!message.isGroupMsg || message.chatId !== TARGET_GROUP_ID) {
          return;
        }

        const text = message.body.trim().toLowerCase();
        console.log("📩 Pesan diterima:", text);

        // ====== REKAP ======
        if (text === "rekap harian") {
          const res = await axios.get(`${RECEIVER_URL}/rekap_today`);
          await client.sendText(message.chatId, res.data.text);
          return;
        }

        if (text === "rekap mingguan") {
          const res = await axios.get(`${RECEIVER_URL}/rekap_week`);
          await client.sendText(message.chatId, res.data.text);
          return;
        }

        if (text === "rekap bulanan") {
          const res = await axios.get(`${RECEIVER_URL}/rekap_month`);
          await client.sendText(message.chatId, res.data.text);
          return;
        }

        // ====== TRANSAKSI ======
        const res = await axios.post(`${RECEIVER_URL}/received`, {
          text: message.body,
          sender: message.sender?.id || message.from,
        });

        if (res.data?.reply) {
          await client.sendText(message.chatId, res.data.reply);
        }

        console.log("✔ Data dikirim & dibalas");
      } catch (err) {
        console.log("❌ Error kirim ke receiver:", err.message);
      }
    });
  })

  .catch((err) => {
    console.error("❌ ERROR STARTING BOT:", err);
    process.exit(1); // biar PM2 restart
  });
