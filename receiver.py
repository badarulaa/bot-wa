from flask import Flask, request
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

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

    nominal_raw = (
        nominal_raw.replace("rp", "")
        .replace(".", "")
        .replace(",", "")
        .strip()
    )

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
        return {"status": "ignored"}, 200

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sheet.append_row([timestamp, *parsed])

    return {"status": "saved"}, 200


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
