# app.py  (PostgreSQL version, auto-create table)
from __future__ import annotations
import os
import mimetypes
import pathlib
import logging
from datetime import datetime
from typing import Optional

from flask import Flask, request, jsonify, send_file
from dotenv import load_dotenv

# PostgreSQL driver
import psycopg2
from psycopg2 import OperationalError

# Load .env
load_dotenv()

# ---------- Config ----------
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 5000))
DEBUG = os.getenv("DEBUG", "false").strip().lower() in ("1", "true", "yes")

# ---------- PostgreSQL connection info ----------
DB_HOST = os.getenv("DB_HOST")          # e.g. dpg-d4skbvumcj7s73c29e00-a (internal)
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS", "")
DB_NAME = os.getenv("DB_NAME")

logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

logging.info(
    "DB config: host=%r port=%r user=%r db=%r",
    DB_HOST, DB_PORT, DB_USER, DB_NAME
)

# Where PDFs are stored
BASE_DIR = pathlib.Path(__file__).resolve().parent
ASSETS_DIR = BASE_DIR / "assets"

# Map keys -> filenames (exact file names inside assets/)
PDF_KEY_MAP = {
    "air-cool": "Air-Cool .pdf",
    "cutter-compactor": "Cutter compactor.pdf",
    "force-feeder": "Force Feeder GE-RE-V Series .pdf",
    "dry-wash": "DRY WASH .pdf",
    "size-reduction": "Size reduction Equipments.pdf",
    "palletizing": "Palletizing Equipement  .pdf",
}

ALLOWED_PDF_EXTS = {".pdf", ".PDF"}
MAX_FIELD_LEN = 300

app = Flask(__name__, static_folder=".", static_url_path="/")


# ---------- Utilities ----------
def safe_str(s: Optional[str]) -> str:
    return (s or "").strip()


def validate_submission(name: str, email: str, mobile: str) -> Optional[str]:
    if not name:
        return "Name is required."
    if not email:
        return "Email is required."
    if not mobile:
        return "Mobile number is required."
    if len(name) > MAX_FIELD_LEN or len(email) > MAX_FIELD_LEN or len(mobile) > MAX_FIELD_LEN:
        return "One or more fields too long."
    return None


def find_pdf_by_key(key: Optional[str] = None) -> Optional[pathlib.Path]:
    """
    Find a PDF file in assets/ using:
    - exact key mapping (PDF_KEY_MAP)
    - substring search
    - fallback keywords
    """
    if not ASSETS_DIR.exists():
        logging.error("Assets directory %s does not exist", ASSETS_DIR)
        return None

    wanted = (key or "").strip().lower()
    pdf_files = [p for p in ASSETS_DIR.iterdir()
                 if p.is_file() and p.suffix.lower() in ALLOWED_PDF_EXTS]

    if not pdf_files:
        logging.warning("No PDF files found in assets directory.")
        return None

    # 1) direct mapping
    if wanted:
        mapped = PDF_KEY_MAP.get(wanted)
        if mapped:
            candidate = ASSETS_DIR / mapped
            if candidate.exists():
                return candidate

    # 2) substring match
    if wanted:
        for p in pdf_files:
            if wanted in p.name.lower():
                return p

    # 3) generic fallback terms
    fallback_terms = ["air", "cutter", "compactor", "force", "feeder", "dry", "wash", "size", "pallet"]
    for term in fallback_terms:
        for p in pdf_files:
            if term in p.name.lower():
                return p

    # 4) any PDF as last resort
    return pdf_files[0]


# ---------- DB helpers ----------
def get_db_connection():
    """
    Returns a PostgreSQL connection or None if not available.
    Uses Render's internal hostname (DB_HOST).
    """
    if not DB_HOST or not DB_USER or not DB_NAME:
        logging.warning("DB not configured properly (DB_HOST/DB_USER/DB_NAME missing)")
        return None

    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASS,
            dbname=DB_NAME,
            connect_timeout=10,
        )
        conn.autocommit = True
        return conn
    except OperationalError as e:
        logging.error("Failed to connect to PostgreSQL: %s", e)
        return None


def ensure_submissions_table():
    """
    Create the submissions table if it does not exist.
    Safe to call multiple times.
    """
    conn = get_db_connection()
    if not conn:
        logging.error("Cannot ensure table; no DB connection.")
        return False

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS submissions (
                    id SERIAL PRIMARY KEY,
                    timestamp_utc TIMESTAMPTZ NOT NULL,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    mobile TEXT NOT NULL,
                    pdf_requested TEXT NOT NULL
                );
                """
            )
        conn.close()
        logging.info("Ensured submissions table exists.")
        return True
    except Exception as e:
        logging.exception("Failed to ensure submissions table: %s", e)
        try:
            conn.close()
        except Exception:
            pass
        return False


def save_submission_pg(name: str, email: str, mobile: str, pdf_name: Optional[str]) -> bool:
    """
    Insert submission into `submissions` table. Returns True on success.
    """
    conn = get_db_connection()
    if not conn:
        logging.error("No DB connection available")
        return False

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO submissions (timestamp_utc, name, email, mobile, pdf_requested)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (datetime.utcnow(), name, email, mobile, pdf_name or ""),
            )
        conn.close()
        logging.info("Saved submission for %s <%s>", name, email)
        return True
    except Exception as e:
        logging.exception("Failed to insert submission into DB: %s", e)
        try:
            conn.close()
        except Exception:
            pass
        return False


# ---------- Call table creation at import ----------
# This runs once when app.py is imported by gunicorn
ensure_submissions_table()


# ---------- Routes ----------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "time": datetime.utcnow().isoformat()}), 200


@app.route("/db-check", methods=["GET"])
def db_check():
    """
    Quick check: can the app reach Postgres and see the submissions table?
    """
    conn = get_db_connection()
    if not conn:
        return jsonify({"ok": False, "message": "no DB connection"}), 200

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM submissions")
            count = cur.fetchone()[0]
        conn.close()
        return jsonify({"ok": True, "rows": count}), 200
    except Exception as e:
        logging.exception("DB check failed")
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/download", methods=["POST"])
def download():
    if not request.is_json:
        return jsonify({"message": "Expected JSON body"}), 400
    payload = request.get_json() or {}

    name = safe_str(payload.get("name"))
    email_addr = safe_str(payload.get("email"))
    mobile = safe_str(payload.get("mobile"))
    pdf_key = safe_str(payload.get("pdf"))

    logging.info(
        "Download request: name=%s email=%s mobile=%s pdf_key=%s",
        name, email_addr, mobile, pdf_key or "(empty)"
    )

    err = validate_submission(name, email_addr, mobile)
    if err:
        logging.info("Validation failed: %s", err)
        return jsonify({"message": err}), 400

    pdf_path = find_pdf_by_key(pdf_key)
    if not pdf_path or not pdf_path.exists():
        logging.error("PDF not found for key=%s", pdf_key)
        return jsonify({"message": "Requested PDF not found on server."}), 404

    # save to PostgreSQL (best-effort)
    try:
        ok = save_submission_pg(name, email_addr, mobile, pdf_path.name)
        if not ok:
            logging.warning("Failed to save submission to DB.")
    except Exception:
        logging.exception("Exception while saving to DB")

    # send file
    try:
        mimetype, _ = mimetypes.guess_type(str(pdf_path))
        logging.info("Serving file: %s", pdf_path.name)
        return send_file(
            path_or_file=str(pdf_path),
            as_attachment=True,
            download_name=pdf_path.name,
            mimetype=mimetype or "application/pdf",
        )
    except Exception:
        logging.exception("Failed to send file")
        return jsonify({"message": "Internal server error while sending file."}), 500


# ---------- Run ----------
if __name__ == "__main__":
    logging.info("Starting app on %s:%s  DEBUG=%s", HOST, PORT, DEBUG)
    app.run(host=HOST, port=PORT, debug=DEBUG)
