import React, { useEffect, useMemo, useState } from "react";
import type { Binding, Loadout } from "../lib/types";
import {
  fetchLoadout,
  fetchLoadouts,
  fetchVideos,
  saveLoadout,
  deleteLoadout,
} from "../lib/api";
import { normalizeKeyFromEvent } from "../lib/key";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

const RESERVED_KEYS = new Set(["h"]); // HUD toggle

type Row = {
  id: string;
  keyId: string;
  type: "video" | "webcam";
  src: string;
  label: string;
};

function toRows(bindings: Record<string, Binding> | undefined): Row[] {
  const entries = Object.entries(bindings ?? {});
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([keyId, b], idx) => ({
    id: `${keyId}-${idx}-${cryptoRandom()}`,
    keyId,
    type: b.type,
    src: b.type === "video" ? b.src : "",
    label: b.label ?? "",
  }));
}

function fromRow(r: Row): [string, Binding] | null {
  const keyId = r.keyId.trim();
  if (!keyId) return null;

  // enforce reserved key policy
  if (RESERVED_KEYS.has(keyId)) return null;

  if (r.type === "webcam") {
    return [keyId, { type: "webcam", label: r.label.trim() || undefined }];
  }

  return [
    keyId,
    { type: "video", src: r.src || "", label: r.label.trim() || undefined },
  ];
}

function emptyLoadout(name: string): Loadout {
  return {
    name,
    version: 1,
    initial: { type: "video", src: "" },
    bindings: { c: { type: "webcam", label: "Webcam" } },
  };
}

function cryptoRandom() {
  // safe enough for UI keys without adding deps
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
  } catch {
    return Math.random().toString(16).slice(2);
  }
}

export default function SetupPage() {
  const [videos, setVideos] = useState<string[]>([]);
  const [loadouts, setLoadouts] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("Default");
  const [newName, setNewName] = useState<string>("");
  const [toast, setToast] = useState<string>("");

  const [initialSrc, setInitialSrc] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  const videoOptions = useMemo(() => ["", ...videos], [videos]);

  async function refreshLists(preserveSelected?: string) {
    const [v, l] = await Promise.all([fetchVideos(), fetchLoadouts()]);
    setVideos(v);
    setLoadouts(Array.from(new Set(["Default", ...l])));
    if (preserveSelected) setSelected(preserveSelected);
  }

  async function loadSelected(name: string) {
    setIsBusy(true);
    try {
      const data = await fetchLoadout(name);
      setSelected(data.name);
      setInitialSrc(data.initial?.src ?? "");
      setRows(toRows(data.bindings));
      setToast(`Loaded "${data.name}"`);
    } catch (e) {
      console.error(e);
      setToast(`Failed to load "${name}"`);
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    (async () => {
      await refreshLists("Default");
      await loadSelected("Default");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate() {
    const name = newName.trim();
    if (!name) return setToast("Enter a loadout name.");
    setIsBusy(true);
    try {
      const payload = emptyLoadout(name);
      await saveLoadout(name, payload);
      setToast(`Created "${name}"`);
      setNewName("");
      await refreshLists(name);
      await loadSelected(name);
    } catch (e: any) {
      console.error(e);
      setToast(`Create failed: ${String(e?.message ?? e)}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function onDelete() {
    if (selected === "Default") return setToast("Cannot delete Default.");
    if (!confirm(`Delete "${selected}"? This cannot be undone.`)) return;

    setIsBusy(true);
    try {
      await deleteLoadout(selected);
      setToast(`Deleted "${selected}"`);
      await refreshLists("Default");
      await loadSelected("Default");
    } catch (e: any) {
      console.error(e);
      setToast(`Delete failed: ${String(e?.message ?? e)}`);
    } finally {
      setIsBusy(false);
    }
  }

  function addRow(type: Row["type"] = "video") {
    setRows((r) => [
      ...r,
      {
        id: `new-${cryptoRandom()}`,
        keyId: "",
        type,
        src: "",
        label: "",
      },
    ]);
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    setRows((r) => r.filter((row) => row.id !== id));
  }

  function captureKey(id: string, e: React.KeyboardEvent<HTMLInputElement>) {
    e.preventDefault();
    e.stopPropagation();
    const keyId = normalizeKeyFromEvent(e.nativeEvent);
    updateRow(id, { keyId });
    if (RESERVED_KEYS.has(keyId)) {
      setToast(`"${keyId}" is reserved for the performance HUD toggle.`);
    }
  }

  // --- Duplicate key detection (computed) ---
  const keyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const k = r.keyId.trim();
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  const duplicateKeys = useMemo(() => {
    const dups: string[] = [];
    for (const [k, n] of keyCounts.entries()) {
      if (n > 1) dups.push(k);
    }
    dups.sort((a, b) => a.localeCompare(b));
    return dups;
  }, [keyCounts]);

  function rowKeyStatus(r: Row): { kind: "ok" | "warn" | "error"; msg?: string } {
    const k = r.keyId.trim();
    if (!k) return { kind: "warn", msg: "Key is required." };
    if (RESERVED_KEYS.has(k)) return { kind: "error", msg: `"${k}" is reserved for the HUD toggle.` };
    const count = keyCounts.get(k) ?? 0;
    if (count > 1) return { kind: "error", msg: `Duplicate key "${k}" — each key must be unique.` };
    return { kind: "ok" };
  }

  function rowContentStatus(r: Row): { kind: "ok" | "warn"; msg?: string } {
    if (r.type === "video" && !r.src) return { kind: "warn", msg: "Pick a video." };
    return { kind: "ok" };
  }

  function buildPayload(): Loadout {
    const bindings: Record<string, Binding> = {};
    for (const r of rows) {
      const entry = fromRow(r);
      if (!entry) continue;
      const [keyId, binding] = entry;
      bindings[keyId] = binding;
    }

    // keep webcam convenience unless user intentionally removes it
    if (!bindings["c"]) bindings["c"] = { type: "webcam", label: "Webcam" };

    return {
      name: selected,
      version: 1,
      initial: { type: "video", src: initialSrc || "" },
      bindings,
    };
  }

  async function onSave() {
    // block save if duplicates or reserved key present
    if (duplicateKeys.length > 0) {
      setToast(`Fix duplicate keys: ${duplicateKeys.join(", ")}`);
      return;
    }
    if (rows.some((r) => RESERVED_KEYS.has(r.keyId.trim()))) {
      setToast(`Fix reserved key usage (h).`);
      return;
    }

    setIsBusy(true);
    try {
      const payload = buildPayload();
      await saveLoadout(selected, payload);
      setToast(`Saved "${selected}"`);
      await refreshLists(selected);
      await loadSelected(selected);
    } catch (e: any) {
      console.error(e);
      setToast(`Save failed: ${String(e?.message ?? e)}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="h1">Video Switcher — Setup</div>
          <div className="sub">
            Bind keys to videos in <span className="kbd">videos/</span>. Reserved key:{" "}
            <span className="kbd">h</span> (performance HUD).
          </div>
        </div>

        <div className="actions">
          <Button
            variant="secondary"
            onClick={() => (window.location.href = "/index.html")}
            title="Go to performance page"
          >
            Performance
          </Button>
        </div>
      </div>

      <Card>
        <div className="grid">
          <div className="row">
            <div className="sub">Loadout</div>
            <div className="stack">
              <div className="grid3">
                <div className="grow">
                  <Select
                    value={selected}
                    onChange={(e) => loadSelected(e.target.value)}
                    disabled={isBusy}
                  >
                    {loadouts.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                </div>

                <Button onClick={onSave} disabled={isBusy}>
                  Save
                </Button>

                <Button variant="destructive" onClick={onDelete} disabled={isBusy}>
                  Delete
                </Button>
              </div>

              <div className="grid2">
                <div className="grow">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder='New loadout name'
                    disabled={isBusy}
                  />
                </div>

                <Button onClick={onCreate} disabled={isBusy}>
                  Create
                </Button>
              </div>
            </div>
          </div>

          <hr className="sep" />

          <div className="row">
            <div className="sub">Initial video</div>
            <div className="grid2">
              <div className="grow">
                <Select
                  value={initialSrc}
                  onChange={(e) => setInitialSrc(e.target.value)}
                  disabled={isBusy}
                >
                  {videoOptions.map((v) => (
                    <option key={v} value={v}>
                      {v ? v : "(none)"}
                    </option>
                  ))}
                </Select>
              </div>
              <Button variant="secondary" onClick={() => setInitialSrc("")} disabled={isBusy}>
                Clear
              </Button>
            </div>
          </div>

          <div className="inline tight">
            <Button variant="secondary" onClick={() => addRow("video")} disabled={isBusy}>
              Add video binding
            </Button>
            <Button variant="secondary" onClick={() => addRow("webcam")} disabled={isBusy}>
              Add webcam binding
            </Button>
            <span className="toast">{toast}</span>
          </div>

          {duplicateKeys.length > 0 && (
            <div className="notice notice--error">
              Duplicate keys detected: <b>{duplicateKeys.join(", ")}</b>. Each key must be unique.
            </div>
          )}
        </div>
      </Card>

      <div className="bindings">
        {rows.map((r) => {
          const keyStatus = rowKeyStatus(r);
          const contentStatus = rowContentStatus(r);

          return (
            <Card key={r.id}>
              <div className="bindingCard">
                <div className="bindingCard__top">
                  <div className="bindingCard__title">
                    <span className="bindingCard__badge">{r.type}</span>
                    <span className="bindingCard__meta">
                      {r.keyId.trim() ? (
                        <>
                          Key: <span className="kbd">{r.keyId.trim()}</span>
                        </>
                      ) : (
                        "Unassigned key"
                      )}
                    </span>
                  </div>

                  <Button
                    variant="secondary"
                    onClick={() => removeRow(r.id)}
                    disabled={isBusy}
                    title="Remove binding"
                  >
                    Remove
                  </Button>
                </div>

                <div className="bindingCard__grid">
                  {/* Key */}
                  <div className="field">
                    <div className="field__label">Key</div>
                    <Input
                      value={r.keyId}
                      placeholder="Click, press a key…"
                      onKeyDown={(e) => captureKey(r.id, e)}
                      onChange={(e) => updateRow(r.id, { keyId: e.target.value })}
                      disabled={isBusy}
                    />
                    {keyStatus.kind !== "ok" && (
                      <div className={`field__hint ${keyStatus.kind === "error" ? "hint--error" : "hint--warn"}`}>
                        {keyStatus.msg}
                      </div>
                    )}
                  </div>

                  {/* Type */}
                  <div className="field">
                    <div className="field__label">Type</div>
                    <Select
                      value={r.type}
                      onChange={(e) => {
                        const next = e.target.value as Row["type"];
                        updateRow(r.id, { type: next, src: next === "webcam" ? "" : r.src });
                      }}
                      disabled={isBusy}
                    >
                      <option value="video">video</option>
                      <option value="webcam">webcam</option>
                    </Select>
                   
                  </div>

                  {/* Video */}
                  <div className="field field--wide">
                    <div className="field__label">Video</div>
                    <Select
                      value={r.src}
                      onChange={(e) => updateRow(r.id, { src: e.target.value })}
                      disabled={isBusy || r.type === "webcam"}
                    >
                      {videoOptions.map((v) => (
                        <option key={v} value={v}>
                          {v ? v : "(none)"}
                        </option>
                      ))}
                    </Select>
                    {r.type === "video" && contentStatus.kind !== "ok" && (
                      <div className="field__hint hint--warn">{contentStatus.msg}</div>
                    )}
                  </div>

                  {/* Label */}
                  <div className="field">
                    <div className="field__label">Label</div>
                    <Input
                      value={r.label}
                      placeholder="Optional label (for readability)"
                      onChange={(e) => updateRow(r.id, { label: e.target.value })}
                      disabled={isBusy}
                    />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}