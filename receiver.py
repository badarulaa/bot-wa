from flask import Flask, request
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime
import re
from dotenv import load_dotenv

load_dotenv()

import os

app = Flask(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

CRED_PATH = os.getenv("GOOGLE_CREDENTIALS_PATH")
if not CRED_PATH or not os.path.exists(CRED_PATH):
    raise FileNotFoundError(f"Google credentials file not found: {CRED_PATH}")

creds = Credentials.from_service_account_file(CRED_PATH, scopes=SCOPES)
client = gspread.authorize(creds)

SPREADSHEET_ID = os.getenv("GOOGLE_SHEET_ID")
sh = client.open_by_key(SPREADSHEET_ID)
sheet = sh.sheet1

def parse(text: str):
    print("RAW TEXT:", repr(text))

    # Pisahkan text berdasarkan spasi
    parts = text.strip().split()

    if len(parts) < 3:
        return None  # minimal: nama ket nominal

    nama = parts[0]

    # Ambil kandidat nominal (kata terakhir)
    nominal_raw = parts[-1].lower()

    # Gabungkan sisanya jadi keterangan
    ket = " ".join(parts[1:-1])

    # Bersihkan angka
    nominal_raw = nominal_raw.replace("rp", "")
    nominal_raw = nominal_raw.replace(".", "")
    nominal_raw = nominal_raw.replace(",", "").strip()

    # Format "12k"
    if nominal_raw.endswith("k"):
        angka = nominal_raw[:-1]
        if angka.isdigit():
            nominal = int(angka) * 1000
            return nama, ket, nominal
        return None

    # Format angka biasa
    if nominal_raw.isdigit():
        nominal = int(nominal_raw)
        return nama, ket, nominal

    return None

@app.get("/")
def home():
    return "Receiver is running ✅"

@app.post("/received")
def received():
    data = request.get_json()
    text = data.get("text", "")

    parsed = parse(text)
    if parsed:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        sheet.append_row([timestamp, *parsed])
        print("✔ Tersimpan:", parsed)
        return {"status": "saved"}, 200

    print("⏭ Format tidak cocok:", text)
    return {"status": "ignored"}, 200

@app.post("/rekap_today")
def rekap_today():
    data = sheet.get_all_records()

    today = datetime.now().strftime("%Y-%m-%d")
    filtered = [row for row in data if str(row["timestamp"]).startswith(today)]

    if not filtered:
        return {"text": "Belum ada transaksi hari ini."}, 200

    total = sum(row["nominal"] for row in filtered)

    pesan = f"📊 Rekap Hari Ini ({today})\n"
    pesan += f"Total transaksi: {len(filtered)}\n"
    pesan += f"Total saldo: Rp {total:,}".replace(",", ".")
    return {"text": pesan}, 200


app.run(host="0.0.0.0", port=int(os.getenv("RECEIVER_PORT",5000)))
