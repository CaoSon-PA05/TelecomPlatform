import sqlite3
import uuid
import os
from datetime import datetime

DB_PATH = os.environ.get("DB_PATH", "logger.db")


def _conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init():
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tokens (
                token      TEXT PRIMARY KEY,
                label      TEXT,
                mode       TEXT DEFAULT 'gif',
                lat        TEXT DEFAULT '21.0285',
                lng        TEXT DEFAULT '105.8542',
                zoom       TEXT DEFAULT '14',
                gif_source TEXT,
                case_id    TEXT DEFAULT '',
                created_at TEXT
            )
        """)
        # migrate existing databases that lack optional columns
        for col, default in [("gif_source", "TEXT"), ("case_id", "TEXT DEFAULT ''")]:
            try:
                conn.execute(f"ALTER TABLE tokens ADD COLUMN {col} {default}")
            except Exception:
                pass
        conn.execute("""
            CREATE TABLE IF NOT EXISTS hits (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                token            TEXT,
                ip               TEXT,
                user_agent       TEXT,
                referer          TEXT,
                accept_language  TEXT,
                x_forwarded_for  TEXT,
                timestamp        TEXT,
                geo_city         TEXT DEFAULT '',
                geo_isp          TEXT DEFAULT ''
            )
        """)
        for col in [
            "geo_city TEXT DEFAULT ''", "geo_isp TEXT DEFAULT ''",
            "screen_w TEXT DEFAULT ''", "screen_h TEXT DEFAULT ''",
            "tz TEXT DEFAULT ''",       "client_ts TEXT DEFAULT ''",
        ]:
            try:
                conn.execute(f"ALTER TABLE hits ADD COLUMN {col}")
            except Exception:
                pass
        conn.commit()


def create_token(mode="gif", label="", lat="21.0285", lng="105.8542", zoom="14",
                 gif_source="", case_id=""):
    token = uuid.uuid4().hex[:12]
    with _conn() as conn:
        conn.execute(
            """INSERT INTO tokens
               (token, label, mode, lat, lng, zoom, gif_source, case_id, created_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (token, label, mode, lat or "21.0285", lng or "105.8542", zoom or "14",
             gif_source or "", case_id or "",
             datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")),
        )
        conn.commit()
    return token


def get_token(token):
    with _conn() as conn:
        row = conn.execute("SELECT * FROM tokens WHERE token=?", (token,)).fetchone()
        return dict(row) if row else None


def get_all_tokens():
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM tokens ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]


def log_hit(token, ip, user_agent, referer, accept_language, x_forwarded_for):
    with _conn() as conn:
        cur = conn.execute(
            """INSERT INTO hits
               (token, ip, user_agent, referer, accept_language, x_forwarded_for, timestamp)
               VALUES (?,?,?,?,?,?,?)""",
            (token, ip, user_agent, referer, accept_language, x_forwarded_for,
             datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")),
        )
        conn.commit()
        return cur.lastrowid


def update_hit_meta(token, screen_w, screen_h, tz, client_ts):
    """Update the most recent hit for a token with client-side device metadata."""
    with _conn() as conn:
        conn.execute(
            """UPDATE hits SET screen_w=?, screen_h=?, tz=?, client_ts=?
               WHERE id = (SELECT id FROM hits WHERE token=? ORDER BY id DESC LIMIT 1)""",
            (screen_w or "", screen_h or "", tz or "", client_ts or "", token),
        )
        conn.commit()


def update_hit_geo(hit_id, geo_city, geo_isp):
    with _conn() as conn:
        conn.execute(
            "UPDATE hits SET geo_city=?, geo_isp=? WHERE id=?",
            (geo_city or "", geo_isp or "", hit_id),
        )
        conn.commit()


def get_hits_for_token(token):
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM hits WHERE token=? ORDER BY timestamp DESC", (token,)
        ).fetchall()
        return [dict(r) for r in rows]


def get_all_hits():
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM hits ORDER BY timestamp DESC LIMIT 1000"
        ).fetchall()
        return [dict(r) for r in rows]


def delete_token(token):
    with _conn() as conn:
        conn.execute("DELETE FROM hits WHERE token=?", (token,))
        conn.execute("DELETE FROM tokens WHERE token=?", (token,))
        conn.commit()
