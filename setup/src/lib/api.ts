import type { Loadout } from "./types";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function putJson<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function delJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchVideos(): Promise<string[]> {
  const data = await getJson<{ videos: string[] }>("/api/videos");
  return data.videos ?? [];
}

export async function fetchLoadouts(): Promise<string[]> {
  const data = await getJson<{ loadouts: string[] }>("/api/loadouts");
  return data.loadouts ?? [];
}

export async function fetchLoadout(displayName: string): Promise<Loadout> {
  return getJson<Loadout>(`/api/loadouts/${encodeURIComponent(displayName)}`);
}

export async function saveLoadout(displayName: string, loadout: Loadout) {
  return putJson(`/api/loadouts/${encodeURIComponent(displayName)}`, loadout);
}

export async function deleteLoadout(displayName: string) {
  return delJson(`/api/loadouts/${encodeURIComponent(displayName)}`);
}