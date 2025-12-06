from flask import Flask, request
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

creds = Credentials.from_service_account_file("credentials.json", scopes=SCOPES)
client = gspread.authorize(creds)

SPREADSHEET_ID = os.getenv("GOOGLE_SHEET_ID")
sheet = client.open_by_key(SPREADSHEET_ID).sheet1


def hitung_rekap(filter_func):
    data = sheet.get_all_records()
    filtered = [row for row in data if filter_func(row)]

    if not filtered:
        return "📄 Belum ada transaksi pada periode ini"

    total = sum(row['nominal'] for row in filtered)
    text = (
        f"📊 Total transaksi: {len(filtered)}\n"
        f"Total saldo: Rp {total:,}".replace(",", ".")
    )
    return text


@app.get("/rekap_today")
def rekap_today():
    today = datetime.now().strftime("%Y-%m-%d")
    text = f"📅 Rekap Hari Ini ({today})\n"
    text += hitung_rekap(lambda r: str(r['timestamp']).startswith(today))
    return {"text": text}, 200


@app.get("/rekap_week")
def rekap_week():
    now = datetime.now()
    minggu_awal = now - timedelta(days=now.weekday())  # Senin minggu ini
    awal_str = minggu_awal.strftime("%Y-%m-%d")
    akhir_str = now.strftime("%Y-%m-%d")

    text = f"📆 Rekap Minggu Ini ({awal_str} → {akhir_str})\n"
    text += hitung_rekap(lambda r: awal_str <= str(r['timestamp'])[:10] <= akhir_str)
    return {"text": text}, 200


@app.get("/rekap_month")
def rekap_month():
    now = datetime.now()
    awal_str = now.strftime("%Y-%m-01")
    akhir_str = now.strftime("%Y-%m-%d")

    text = f"🗓 Rekap Bulan Ini ({awal_str} → {akhir_str})\n"
    text += hitung_rekap(lambda r: awal_str <= str(r['timestamp'])[:10] <= akhir_str)
    return {"text": text}, 200


@app.get("/")
def home():
    return "Receiver is running"
