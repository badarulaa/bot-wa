require("dotenv").config();

const wppconnect = require("@wppconnect-team/wppconnect");
const axios = require("axios");

// GANTI ini dengan chatId grup kamu
const TARGET_GROUP_ID = process.env.TARGET_GROUP_ID;

wppconnect
  .create({
    session: "keuangan",
    autoClose: false, // Penting agar page tidak ditutup otomatis
    puppeteerOptions: {
      headless: true, // tetap headless
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

    client.onMessage(async (message) => {
      if (!message.isGroupMsg || message.chatId !== TARGET_GROUP_ID) return;

      const text = message.body.trim().toLowerCase();

      try {
        // 🟦 Perintah Rekap
        if (text === "rekap") {
          const res = await axios.get(
            `http://127.0.0.1:${process.env.RECEIVER_PORT}/rekap_today`
          );
          await client.sendText(message.chatId, res.data.text);
          return;
        }

        // 🟩 Input transaksi
        await axios.post(
          `http://127.0.0.1:${process.env.RECEIVER_PORT}/received`,
          {
            text: message.body,
            sender: message.sender?.id || message.from,
          }
        );

        console.log("✔ Data dikirim ke receiver");
      } catch (err) {
        console.log("❌ Error kirim ke receiver:", err.message);
      }
    });
  })
  .catch((err) => {
    console.error("❌ ERROR STARTING BOT:", err);
  });
