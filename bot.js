require("dotenv").config();

const wppconnect = require("@wppconnect-team/wppconnect");
const axios = require("axios");

const TARGET_GROUP_ID = process.env.TARGET_GROUP_ID;
const RECEIVER_URL = `http://127.0.0.1:${process.env.RECEIVER_PORT}`;

wppconnect
  .create({
    session: "keuangan",
    autoClose: false,
    waitForLogin: true,
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
    disableWelcome: true
  })
  .then((client) => {
    console.log("\n======================================");
    console.log("✅ BOT AKTIF 🚀");
    console.log("🎯 Listen ke grup:", TARGET_GROUP_ID);
    console.log("======================================\n");

    setInterval(async () => {
      try {
        await client.getHostDevice();
        console.log("🔄 Koneksi aktif");
      } catch (err) {
        console.log("❌ Koneksi putus, mencoba menyambung ulang...", err.message);
      }
    }, 60 * 1000);

    client.onMessage(async (message) => {
      if (!message.isGroupMsg || message.chatId !== TARGET_GROUP_ID) {
        return;
      }

      const text = message.body.trim().toLowerCase();

      try {
        // 📅 Rekap Hari Ini
        if (text === "rekap harian") {
          const res = await axios.get(`${RECEIVER_URL}/rekap_today`);
          await client.sendText(message.chatId, res.data.text);
          return;
        }

        // 📆 Rekap Mingguan
        if (text === "rekap mingguan") {
          const res = await axios.get(`${RECEIVER_URL}/rekap_week`);
          await client.sendText(message.chatId, res.data.text);
          return;
        }

        // 🗓 Rekap Bulanan
        if (text === "rekap bulanan") {
          const res = await axios.get(`${RECEIVER_URL}/rekap_month`);
          await client.sendText(message.chatId, res.data.text);
          return;
        }

        // Kirim transaksi ke receiver
        await axios.post(`${RECEIVER_URL}/received`, {
          text: message.body,
          sender: message.sender?.id || message.from,
        });

        console.log("✔ Data dikirim ke receiver");
      } catch (err) {
        console.log("❌ Error kirim ke receiver:", err.message);
      }
    });
  })
  .catch((err) => {
    console.error("❌ ERROR STARTING BOT:", err);
  });
