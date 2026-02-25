# server.py
from __future__ import annotations

import json
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
VIDEOS_DIR = os.path.join(ROOT_DIR, "videos")
LOADOUTS_DIR = os.path.join(ROOT_DIR, "loadouts")
SETUP_DIST_DIR = os.path.join(ROOT_DIR, "setup-dist")

VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v"}


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
    """
    Convert a display name (may contain spaces) into a safe filename slug.
    Examples:
      "Emerald Street" -> "emerald-street"
      "Set 01 (Full)"  -> "set-01-full"
    """
    name = display_name.strip()
    if not name:
        raise ValueError("Loadout name required")

    if len(name) > 64:
        raise ValueError("Loadout name too long (max 64 chars)")

    # allow letters/numbers/spaces/_-(). in names
    if not re.fullmatch(r"[A-Za-z0-9 _\-\(\)\.]{1,64}", name):
        raise ValueError("Invalid loadout name (use letters/numbers/spaces/_-().)")

    slug = name.lower()
    slug = re.sub(r"\s+", "-", slug)              # spaces -> dashes
    slug = re.sub(r"[^a-z0-9\-\._()]", "", slug)  # strip anything else
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
            rel_path = os.path.relpath(abs_path, ROOT_DIR).replace("\\", "/")
            if rel_path.startswith("videos/"):
                items.append(rel_path)
    items.sort(key=lambda s: s.lower())
    return items


def list_loadout_display_names() -> list[str]:
    """
    Return display names from each JSON's "name" field.
    Falls back to filename slug if JSON doesn't include a name.
    """
    names: list[str] = []
    for fn in sorted(os.listdir(LOADOUTS_DIR)):
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

    # unique, preserving order
    out: list[str] = []
    seen = set()
    for n in names:
        if n not in seen:
            seen.add(n)
            out.append(n)
    return out


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        # Serve built React setup UI from /setup/ (setup-dist/)
        parsed_path = urlparse(path).path
        parsed_path = unquote(parsed_path)

        if parsed_path == "/setup" or parsed_path == "/setup/":
            return os.path.join(SETUP_DIST_DIR, "index.html")

        if parsed_path.startswith("/setup/"):
            sub = parsed_path[len("/setup/") :]
            return os.path.join(SETUP_DIST_DIR, sub)

        # Default: serve from project root
        parsed_path = parsed_path.lstrip("/")
        return os.path.join(ROOT_DIR, parsed_path)

    def _send_json(self, obj, status=200):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
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

    def do_PUT(self):
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

    def do_DELETE(self):
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


def main():
    ensure_dirs()
    host = "127.0.0.1"
    port = 8000
    print(f"Serving on http://{host}:{port}")
    print("Setup page:       http://127.0.0.1:8000/setup/   (requires setup-dist build)")
    print("Performance page: http://127.0.0.1:8000/index.html")
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()