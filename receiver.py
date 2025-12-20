from flask import Flask, request
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import sys

# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# Load .env
load_dotenv()

app = Flask(__name__)

# Google Sheet auth
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

cred_path = os.getenv("GOOGLE_CREDENTIALS_PATH")
creds = Credentials.from_service_account_file(cred_path, scopes=SCOPES)
client = gspread.authorize(creds)

# Spreadsheet
sheet_id = os.getenv("GOOGLE_SHEET_ID")
sh = client.open_by_key(sheet_id)
sheet = sh.sheet1


# ==================== PARSER ====================
def parse_message(text: str):
    parts = text.strip().split()
    if len(parts) < 3:
        return None

    nama = parts[0]
    ket = " ".join(parts[1:-1])
    nominal_raw = parts[-1].lower()

    # Bersihkan prefix dan separator
    nominal_raw = (
        nominal_raw.replace("rp", "")
        .replace(" ", "")
        .replace(".", "")
        .replace(",", "")
        .strip()
    )

    # Format akhiran "k"
    if nominal_raw.endswith("k"):
        angka = nominal_raw[:-1]
        if angka.isdigit():
            return nama, ket, int(angka) * 1000
        return None

    # Format akhiran "rb" atau "ribu"
    if nominal_raw.endswith("rb") or nominal_raw.endswith("ribu"):
        angka = nominal_raw.replace("rb", "").replace("ribu", "")
        if angka.isdigit():
            return nama, ket, int(angka) * 1000
        return None

    # Format akhiran "jt" atau "juta"
    if nominal_raw.endswith("jt") or nominal_raw.endswith("juta"):
        angka = nominal_raw.replace("jt", "").replace("juta", "")
        if angka.isdigit():
            return nama, ket, int(angka) * 1_000_000
        return None

    # Format angka murni
    if nominal_raw.isdigit():
        return nama, ket, int(nominal_raw)

    return None

# ==================== REKAP ====================
def hitung_rekap(filter_func, header_text):
    data = sheet.get_all_records()
    filtered = [row for row in data if filter_func(row)]

    if not filtered:
        return header_text + "\nTidak ada transaksi."

    total = sum(row["nominal"] for row in filtered)

    return (
        f"{header_text}\n"
        f"Total transaksi: {len(filtered)}\n"
        f"Total nominal: Rp {total:,}"
    ).replace(",", ".")


# ==================== ENDPOINTS ====================
@app.post("/received")
def received():
    data = request.get_json()
    text = data.get("text", "").lower()

    parsed = parse_message(text)
    if not parsed:
        return {
            "ok": False,
            "reply": (
                "❌ Format tidak dikenali\n"
                "Contoh:\n"
                "bca makan siang 25k\n"
                "bca gaji 10jt"
            )
        }, 200

    nama, ket, nominal = parsed
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    sheet.append_row([timestamp, nama, ket, nominal])

    reply_text = (
        "✅ Transaksi tersimpan\n"
        "━━━━━━━━━━━━━━\n"
        f"🏦 Nama: {nama.upper()}\n"
        f"📝 Ket: {ket}\n"
        f"💰 Nominal: Rp {nominal:,}\n"
        f"📅 {timestamp}"
    ).replace(",", ".")

    return {
        "ok": True,
        "reply": reply_text
    }, 200



@app.get("/rekap_today")
def rekap_today():
    today = datetime.now().strftime("%Y-%m-%d")
    return {
        "text": hitung_rekap(
            lambda r: str(r["timestamp"]).startswith(today),
            f"📅 Rekap Hari Ini ({today})"
        )
    }, 200


@app.get("/rekap_week")
def rekap_week():
    now = datetime.now()
    awal = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")
    akhir = now.strftime("%Y-%m-%d")
    return {
        "text": hitung_rekap(
            lambda r: awal <= str(r["timestamp"])[:10] <= akhir,
            f"📆 Rekap Minggu Ini ({awal} → {akhir})"
        )
    }, 200


@app.get("/rekap_month")
def rekap_month():
    now = datetime.now()
    awal = now.strftime("%Y-%m-01")
    akhir = now.strftime("%Y-%m-%d")
    return {
        "text": hitung_rekap(
            lambda r: awal <= str(r["timestamp"])[:10] <= akhir,
            f"🗓 Rekap Bulan Ini ({awal} → {akhir})"
        )
    }, 200


# ==================== RUN APP ====================
if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("RECEIVER_PORT", "5000")),
        debug=True,
    )
