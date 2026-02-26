# server.py
from __future__ import annotations

import json
import os
import re
import traceback
import webbrowser
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

SERVER_VERSION = "dev-batch-reqlog-500-1"

VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v"}

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
VIDEOS_DIR = os.path.join(ROOT_DIR, "videos")
LOADOUTS_DIR = os.path.join(ROOT_DIR, "loadouts")
SETUP_DIST_DIR = os.path.join(ROOT_DIR, "setup-dist")


def log_line(msg: str):
    log_path = os.path.join(ROOT_DIR, "server.log")
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{ts}] {msg}\n")
    except Exception:
        pass


def ensure_dirs():
    os.makedirs(VIDEOS_DIR, exist_ok=True)
    os.makedirs(LOADOUTS_DIR, exist_ok=True)

    default_path = os.path.join(LOADOUTS_DIR, "default.json")
    if not os.path.exists(default_path):
        with open(default_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "name": "Default",
                    "version": 1,
                    "initial": {"type": "video", "src": ""},
                    "bindings": {"c": {"type": "webcam", "label": "Webcam"}},
                },
                f,
                indent=2,
            )


def slugify_display_name(display_name: str) -> str:
    name = display_name.strip()
    if not name:
        raise ValueError("Loadout name required")
    if len(name) > 64:
        raise ValueError("Loadout name too long (max 64 chars)")
    if not re.fullmatch(r"[A-Za-z0-9 _\-\(\)\.]{1,64}", name):
        raise ValueError("Invalid loadout name (use letters/numbers/spaces/_-().)")
    slug = name.lower()
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"[^a-z0-9\-\._()]", "", slug)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    if not slug:
        raise ValueError("Invalid loadout name after normalization")
    return slug


def loadout_path_for_display_name(display_name: str) -> str:
    slug = slugify_display_name(display_name)
    return os.path.join(LOADOUTS_DIR, f"{slug}.json")


def list_videos_recursive() -> list[str]:
    items: list[str] = []
    for root, _, files in os.walk(VIDEOS_DIR):
        for fn in files:
            ext = os.path.splitext(fn)[1].lower()
            if ext not in VIDEO_EXTS:
                continue
            abs_path = os.path.join(root, fn)
            rel_under_videos = os.path.relpath(abs_path, VIDEOS_DIR).replace("\\", "/")
            items.append(f"videos/{rel_under_videos}")
    items.sort(key=lambda s: s.lower())
    return items


def list_loadout_display_names() -> list[str]:
    names: list[str] = []
    try:
        filenames = sorted(os.listdir(LOADOUTS_DIR))
    except FileNotFoundError:
        filenames = []

    for fn in filenames:
        if not fn.lower().endswith(".json"):
            continue
        p = os.path.join(LOADOUTS_DIR, fn)
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
            display = data.get("name")
            if isinstance(display, str) and display.strip():
                names.append(display.strip())
            else:
                names.append(os.path.splitext(fn)[0])
        except Exception:
            names.append(os.path.splitext(fn)[0])

    out: list[str] = []
    seen = set()
    for n in names:
        if n not in seen:
            seen.add(n)
            out.append(n)
    return out


class Handler(SimpleHTTPRequestHandler):
    # Log requests immediately (before response), and catch any handler crashes.
    def handle_one_request(self) -> None:
        try:
            return super().handle_one_request()
        except Exception:
            tb = traceback.format_exc()
            try:
                log_line(f"FATAL during request handling path={getattr(self, 'path', '(unknown)')}:\n{tb}")
            except Exception:
                pass

            # Try to respond 500 instead of silent close
            try:
                body = b"Internal Server Error (see server.log)\n"
                self.send_response(500)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception:
                pass

    def end_headers(self):
        # Avoid caching setup assets while iterating
        try:
            path = urlparse(self.path).path
            if path.startswith("/setup"):
                self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
                self.send_header("Pragma", "no-cache")
                self.send_header("Expires", "0")
        except Exception:
            pass
        super().end_headers()

    def log_message(self, format: str, *args) -> None:
        # This is called for default handler logs, but not always if we crash early.
        try:
            msg = format % args
        except Exception:
            msg = format
        log_line(f"LOG {self.client_address[0]} {self.command} {self.path} :: {msg}")

    def do_GET(self):
        # Log at the *start* so we see it even if response crashes
        log_line(f"REQ {self.client_address[0]} GET {self.path}")

        try:
            path = urlparse(self.path).path

            if path == "/api/videos":
                return self._send_json({"videos": list_videos_recursive()})

            if path == "/api/loadouts":
                return self._send_json({"loadouts": list_loadout_display_names()})

            if path.startswith("/api/loadouts/"):
                display_name = unquote(path[len("/api/loadouts/") :])
                try:
                    p = loadout_path_for_display_name(display_name)
                except ValueError as e:
                    return self._send_json({"error": str(e)}, status=400)

                if not os.path.exists(p):
                    return self._send_json({"error": "Not found"}, status=404)

                with open(p, "r", encoding="utf-8") as f:
                    return self._send_json(json.load(f))

            return super().do_GET()

        except Exception:
            tb = traceback.format_exc()
            log_line(f"ERROR in do_GET path={self.path}:\n{tb}")
            return self._send_text("Internal Server Error (see server.log)\n", status=500)

    def do_PUT(self):
        log_line(f"REQ {self.client_address[0]} PUT {self.path}")

        try:
            path = urlparse(self.path).path
            if not path.startswith("/api/loadouts/"):
                return self._send_json({"error": "Not found"}, status=404)

            display_name = unquote(path[len("/api/loadouts/") :])

            try:
                p = loadout_path_for_display_name(display_name)
                normalized_display = display_name.strip()
            except ValueError as e:
                return self._send_json({"error": str(e)}, status=400)

            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length > 0 else b"{}"

            try:
                payload = json.loads(raw.decode("utf-8"))
            except Exception:
                return self._send_json({"error": "Invalid JSON"}, status=400)

            if "bindings" not in payload or not isinstance(payload["bindings"], dict):
                return self._send_json({"error": "Payload must include bindings {}"}, status=400)

            payload["name"] = normalized_display
            payload.setdefault("version", 1)
            payload.setdefault("initial", {"type": "video", "src": ""})

            with open(p, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)

            return self._send_json({"ok": True})

        except Exception:
            tb = traceback.format_exc()
            log_line(f"ERROR in do_PUT path={self.path}:\n{tb}")
            return self._send_text("Internal Server Error (see server.log)\n", status=500)

    def do_DELETE(self):
        log_line(f"REQ {self.client_address[0]} DELETE {self.path}")

        try:
            path = urlparse(self.path).path
            if not path.startswith("/api/loadouts/"):
                return self._send_json({"error": "Not found"}, status=404)

            display_name = unquote(path[len("/api/loadouts/") :])
            try:
                p = loadout_path_for_display_name(display_name)
            except ValueError as e:
                return self._send_json({"error": str(e)}, status=400)

            if not os.path.exists(p):
                return self._send_json({"error": "Not found"}, status=404)

            os.remove(p)
            return self._send_json({"ok": True})

        except Exception:
            tb = traceback.format_exc()
            log_line(f"ERROR in do_DELETE path={self.path}:\n{tb}")
            return self._send_text("Internal Server Error (see server.log)\n", status=500)

    def translate_path(self, path: str) -> str:
        parsed_path = urlparse(path).path
        parsed_path = unquote(parsed_path).replace("\\", "/")

        # /setup routes
        if parsed_path == "/setup" or parsed_path == "/setup/":
            return os.path.join(SETUP_DIST_DIR, "index.html")

        if parsed_path.startswith("/setup/"):
            sub = parsed_path[len("/setup/") :].lstrip("/")
            if ".." in sub.split("/"):
                return os.path.join(SETUP_DIST_DIR, "index.html")

            candidate = os.path.join(SETUP_DIST_DIR, sub)
            if os.path.isdir(candidate):
                candidate = os.path.join(candidate, "index.html")
            if not os.path.exists(candidate):
                return os.path.join(SETUP_DIST_DIR, "index.html")
            return candidate

        # /videos routes
        if parsed_path.startswith("/videos/"):
            sub = parsed_path[len("/videos/") :].lstrip("/")
            if ".." in sub.split("/"):
                sub = ""
            return os.path.join(VIDEOS_DIR, sub)

        # default
        rel = parsed_path.lstrip("/")
        if ".." in rel.split("/"):
            rel = ""
        return os.path.join(ROOT_DIR, rel)

    def _send_json(self, obj, status=200):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_text(self, text: str, status=200):
        data = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    ensure_dirs()

    host = "127.0.0.1"
    port = 8000
    httpd = ThreadingHTTPServer((host, port), Handler)

    setup_index = os.path.join(SETUP_DIST_DIR, "index.html")
    log_line(f"SERVER_VERSION: {SERVER_VERSION}")
    log_line(f"setup UI exists: {os.path.exists(setup_index)} :: {setup_index}")
    log_line(f"Serving on {host}:{port}")
    log_line(f"Performance: http://{host}:{port}/index.html")
    log_line(f"Setup: http://{host}:{port}/setup/")
    log_line(f"ROOT_DIR: {ROOT_DIR}")
    log_line(f"VIDEOS_DIR: {VIDEOS_DIR}")
    log_line(f"LOADOUTS_DIR: {LOADOUTS_DIR}")
    log_line(f"SETUP_DIST_DIR: {SETUP_DIST_DIR}")

    try:
        webbrowser.open(f"http://{host}:{port}/index.html")
    except Exception:
        pass

    httpd.serve_forever()


if __name__ == "__main__":
    main()