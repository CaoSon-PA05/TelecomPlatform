import io
import os
import base64
import mimetypes
import threading
from functools import wraps

import requests
from werkzeug.utils import secure_filename
from flask import (
    Flask, abort, jsonify, make_response, redirect, render_template,
    request, send_file, url_for
)

import db

app = Flask(__name__)

# Upload size limit — 10 MB (protects against DoS via large file uploads)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

# ---------------------------------------------------------------------------
# Database init — must run at module load so Gunicorn workers find the tables.
# init() is idempotent: CREATE TABLE IF NOT EXISTS + safe ALTER migrations.
# ---------------------------------------------------------------------------
import db as _db
_db.init()

# ---------------------------------------------------------------------------
# CORS manual — xử lý được Origin: null từ file://
# ---------------------------------------------------------------------------

def _cors_headers(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "X-API-Key, Content-Type, ngrok-skip-browser-warning"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    return response


@app.after_request
def after_request(response):
    if request.path.startswith("/api/"):
        _cors_headers(response)
    return response


@app.route("/api/", defaults={"path": ""}, methods=["OPTIONS"])
@app.route("/api/<path:path>",              methods=["OPTIONS"])
def api_preflight(path=""):
    """Xử lý preflight OPTIONS — browser gửi trước POST/DELETE"""
    response = make_response("", 204)
    _cors_headers(response)
    return response


ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
API_KEY = os.environ.get("API_KEY", "sentinel-dev-key")
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".gif", ".png", ".jpg", ".jpeg", ".webp"}

# Transparent 1×1 GIF
_PIXEL = base64.b64decode(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
)


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization
        if not auth or auth.password != ADMIN_PASSWORD:
            return (
                "Cần đăng nhập / Unauthorized",
                401,
                {"WWW-Authenticate": 'Basic realm="Admin"'},
            )
        return f(*args, **kwargs)
    return decorated


def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        key = request.headers.get("X-API-Key", "")
        if key != API_KEY:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


# ---------------------------------------------------------------------------
# IP Geolocation helper (async, fire-and-forget)
# ---------------------------------------------------------------------------

_PRIVATE_PREFIXES = ("127.", "10.", "192.168.", "172.", "::1", "localhost")

def _fetch_geo(hit_id, ip):
    if any(ip.startswith(p) for p in _PRIVATE_PREFIXES):
        return  # skip private / loopback IPs
    try:
        resp = requests.get(
            f"http://ip-api.com/json/{ip}?fields=status,city,isp",
            timeout=5,
        )
        data = resp.json()
        if data.get("status") == "success":
            db.update_hit_geo(hit_id, data.get("city", ""), data.get("isp", ""))
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Tracking endpoint  –  the URL sent to the target
# ---------------------------------------------------------------------------

@app.route("/t/<token>")
def track(token):
    row = db.get_token(token)
    if not row:
        abort(404)

    # Collect visitor info
    xff = request.headers.get("X-Forwarded-For", "")
    ip = xff.split(",")[0].strip() if xff else request.remote_addr

    hit_id = db.log_hit(
        token=token,
        ip=ip,
        user_agent=request.headers.get("User-Agent", ""),
        referer=request.headers.get("Referer", ""),
        accept_language=request.headers.get("Accept-Language", ""),
        x_forwarded_for=xff,
    )
    threading.Thread(target=_fetch_geo, args=(hit_id, ip), daemon=True).start()

    mode = row["mode"]

    if mode == "map":
        lat  = row.get("lat")  or "21.0285"
        lng  = row.get("lng")  or "105.8542"
        zoom = row.get("zoom") or "14"
        map_url = (
            f"https://staticmap.openstreetmap.de/staticmap.php"
            f"?center={lat},{lng}&zoom={zoom}&size=600x400&maptype=mapnik"
        )
        try:
            resp = requests.get(map_url, timeout=8)
            if resp.status_code == 200:
                return send_file(
                    io.BytesIO(resp.content),
                    mimetype=resp.headers.get("Content-Type", "image/png"),
                    max_age=0,
                )
        except Exception:
            pass

    elif mode == "custom_gif":
        source = row.get("gif_source") or ""
        # Build the absolute URL for the GIF so OG tags can reference it
        if source and not source.startswith("http"):
            gif_img_url = request.host_url.rstrip("/") + url_for("serve_upload", filename=source)
        else:
            gif_img_url = source
        return render_template(
            "gif_page.html",
            gif_url=gif_img_url,
            page_url=request.url,
            decoy_title=row.get("label") or "Xem ảnh",
            token=token,
        )

    # default / fallback: invisible pixel
    return send_file(io.BytesIO(_PIXEL), mimetype="image/gif", max_age=0)


# ---------------------------------------------------------------------------
# Serve uploaded GIF files (no tracking — just the raw image)
# ---------------------------------------------------------------------------

@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    safe = secure_filename(filename)
    file_path = os.path.join(UPLOAD_DIR, safe)
    if not os.path.isfile(file_path):
        abort(404)
    mime = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
    return send_file(file_path, mimetype=mime, max_age=3600)


# ---------------------------------------------------------------------------
# Admin – generate new tracking link
# ---------------------------------------------------------------------------

@app.route("/admin/generate", methods=["GET", "POST"])
@require_auth
def generate():
    url = None
    token = None
    error = None
    if request.method == "POST":
        mode       = request.form.get("mode", "gif")
        label      = request.form.get("label", "")
        lat        = request.form.get("lat", "21.0285")
        lng        = request.form.get("lng", "105.8542")
        zoom       = request.form.get("zoom", "14")
        gif_url    = request.form.get("gif_url", "").strip()
        gif_source = ""

        if mode == "custom_gif":
            uploaded = request.files.get("gif_file")
            if uploaded and uploaded.filename:
                ext = os.path.splitext(uploaded.filename)[1].lower()
                if ext not in ALLOWED_EXTENSIONS:
                    error = f"Định dạng không hỗ trợ: {ext}. Chỉ dùng GIF, PNG, JPG, WEBP."
                else:
                    fname = secure_filename(uploaded.filename)
                    # prefix with a uuid chunk to avoid name collisions
                    fname = f"{os.urandom(4).hex()}_{fname}"
                    uploaded.save(os.path.join(UPLOAD_DIR, fname))
                    gif_source = fname
            elif gif_url:
                gif_source = gif_url
            else:
                error = "Vui lòng upload file GIF hoặc nhập URL ảnh GIF."

        if not error:
            token = db.create_token(
                mode=mode, label=label, lat=lat, lng=lng, zoom=zoom,
                gif_source=gif_source,
            )
            url = request.host_url.rstrip("/") + url_for("track", token=token)

    return render_template("generate.html", url=url, token=token, error=error)


# ---------------------------------------------------------------------------
# Admin – dashboard
# ---------------------------------------------------------------------------

@app.route("/admin")
@require_auth
def admin():
    tokens = db.get_all_tokens()
    # attach hit count per token
    all_hits = db.get_all_hits()
    hit_count = {}
    for h in all_hits:
        hit_count[h["token"]] = hit_count.get(h["token"], 0) + 1
    for t in tokens:
        t["hit_count"] = hit_count.get(t["token"], 0)
    base = request.host_url.rstrip("/")
    for t in tokens:
        t["track_url"] = f"{base}/t/{t['token']}"
    return render_template("admin.html", tokens=tokens)


# ---------------------------------------------------------------------------
# Admin – hits detail for one token
# ---------------------------------------------------------------------------

@app.route("/admin/hits/<token>")
@require_auth
def hits(token):
    row = db.get_token(token)
    if not row:
        abort(404)
    hit_list = db.get_hits_for_token(token)
    track_url = request.host_url.rstrip("/") + f"/t/{token}"
    return render_template("hits.html", token=row, hits=hit_list, track_url=track_url)


# ---------------------------------------------------------------------------
# Admin – delete token
# ---------------------------------------------------------------------------

@app.route("/admin/delete/<token>", methods=["POST"])
@require_auth
def delete(token):
    db.delete_token(token)
    return redirect(url_for("admin"))


# ---------------------------------------------------------------------------
# Beacon metadata endpoint — gọi bởi JS snippet trong gif_page.html
# Không cần auth vì target's browser gọi trực tiếp
# ---------------------------------------------------------------------------

@app.route("/beacon/meta/<token>")
def beacon_meta(token):
    screen_w  = request.args.get("w", "")
    screen_h  = request.args.get("h", "")
    tz        = request.args.get("tz", "")
    client_ts = request.args.get("t", "")
    if db.get_token(token):
        db.update_hit_meta(token, screen_w, screen_h, tz, client_ts)
    return send_file(io.BytesIO(_PIXEL), mimetype="image/gif", max_age=0)


# ---------------------------------------------------------------------------
# REST API — dành cho TelecomPlatform (xác thực bằng X-API-Key)
# ---------------------------------------------------------------------------

@app.route("/api/tokens", methods=["GET"])
@require_api_key
def api_get_tokens():
    tokens = db.get_all_tokens()
    all_hits = db.get_all_hits()
    hit_count = {}
    for h in all_hits:
        hit_count[h["token"]] = hit_count.get(h["token"], 0) + 1

    case_id_filter = request.args.get("case_id")
    base = request.host_url.rstrip("/")
    result = []
    for t in tokens:
        if case_id_filter and t.get("case_id", "") != case_id_filter:
            continue
        result.append({
            **t,
            "hit_count": hit_count.get(t["token"], 0),
            "track_url": f"{base}/t/{t['token']}",
        })
    return jsonify(result)


@app.route("/api/tokens", methods=["POST"])
@require_api_key
def api_create_token():
    data = request.get_json(force=True) or {}
    token = db.create_token(
        mode=data.get("mode", "gif"),
        label=data.get("label", ""),
        lat=data.get("lat", "21.0285"),
        lng=data.get("lng", "105.8542"),
        zoom=data.get("zoom", "14"),
        gif_source=data.get("gif_source", ""),
        case_id=data.get("case_id", ""),
    )
    track_url = request.host_url.rstrip("/") + f"/t/{token}"
    return jsonify({"token": token, "track_url": track_url}), 201


@app.route("/api/hits/<token>", methods=["GET"])
@require_api_key
def api_get_hits(token):
    row = db.get_token(token)
    if not row:
        return jsonify({"error": "Token not found"}), 404
    hits = db.get_hits_for_token(token)
    return jsonify(hits)


@app.route("/api/tokens/<token>", methods=["DELETE"])
@require_api_key
def api_delete_token(token):
    row = db.get_token(token)
    if not row:
        return jsonify({"error": "Token not found"}), 404
    db.delete_token(token)
    return jsonify({"deleted": token})


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    db.init()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
