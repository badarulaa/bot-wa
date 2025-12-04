require('dotenv').config();

const wppconnect = require('@wppconnect-team/wppconnect');
const axios = require('axios');

// GANTI ini dengan chatId grup kamu
const TARGET_GROUP_ID = process.env.TARGET_GROUP_ID;

wppconnect.create({
  session: 'keuangan',
  autoClose: false, // Penting agar page tidak ditutup otomatis
  puppeteerOptions: {
    headless: true, // tetap headless
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-infobars',
      '--single-process'
    ]
  }
}).then(client => {
  console.log('\n======================================');
  console.log('✅ BOT AKTIF 🚀');
  console.log('🎯 Listen ke grup:', TARGET_GROUP_ID);
  console.log('======================================\n');

  client.onMessage(async (message) => {

    // Filter agar hanya pesan dari grup target yang diproses
    if (!message.isGroupMsg || message.chatId !== TARGET_GROUP_ID) {
      return;
    }

    console.log(`💬 PESAN GRUP TERBACA: ${message.body}`);

    try {
      const res = await axios.post('http://127.0.0.1:5000/received', {
        text: message.body,
        sender: message.sender?.id || message.from
      });

      console.log('📌 Receiver Response:', res.data);

      // OPTIONAL autoresponse:
      // await client.sendText(message.chatId, '📁 Data berhasil dicatat.');

    } catch (err) {
      console.error('❌ ERROR kirim ke receiver:', err.message);
    }
  });

}).catch(err => {
  console.error('❌ ERROR STARTING BOT:', err);
});
