// js/config-client.js

async function apiGetJson(path) {
  const res = await fetch(path, { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} failed: ${res.status} ${text}`);
  }
  return await res.json();
}

async function apiPutJson(path, payload) {
  const res = await fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT ${path} failed: ${res.status} ${text}`);
  }
  return await res.json();
}

async function apiDelete(path) {
  const res = await fetch(path, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DELETE ${path} failed: ${res.status} ${text}`);
  }
  return await res.json();
}

async function fetchVideos() {
  const data = await apiGetJson("/api/videos");
  return data.videos || [];
}

async function fetchLoadouts() {
  const data = await apiGetJson("/api/loadouts");
  return data.loadouts || [];
}

async function fetchLoadout(name) {
  return await apiGetJson(`/api/loadouts/${encodeURIComponent(name)}`);
}

async function saveLoadout(name, loadoutObj) {
  return await apiPutJson(`/api/loadouts/${encodeURIComponent(name)}`, loadoutObj);
}

async function deleteLoadout(name) {
  return await apiDelete(`/api/loadouts/${encodeURIComponent(name)}`);
}

// Key normalization shared by runtime + setup
function normalizeKeyFromEvent(e) {
  // Special case: Spacebar
  if (e.key === " " || e.code === "Space") return "Space";

  // Printable single char (letters/numbers/symbols)
  if (typeof e.key === "string" && e.key.length === 1) {
    return e.key.toLowerCase();
  }

  // For special keys, keep event.key (ArrowUp, Enter, Escape, etc.)
  return e.key;
}