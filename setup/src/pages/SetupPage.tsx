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
import { Table, Th, Td } from "../components/ui/table";

const RESERVED_KEYS = new Set(["h"]); // HUD toggle

type Row = {
  keyId: string;
  type: "video" | "webcam";
  src: string;
  label: string;
};

function toRow(keyId: string, b: Binding): Row {
  return {
    keyId,
    type: b.type,
    src: b.type === "video" ? b.src : "",
    label: b.label ?? "",
  };
}

function fromRow(r: Row): [string, Binding] | null {
  const keyId = r.keyId.trim();
  if (!keyId) return null;
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
      const entries = Object.entries(data.bindings ?? {});
      entries.sort((a, b) => a[0].localeCompare(b[0]));
      setRows(entries.map(([k, b]) => toRow(k, b)));
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

  function addRow() {
    setRows((r) => [...r, { keyId: "", type: "video", src: "", label: "" }]);
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  function captureKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    e.preventDefault();
    e.stopPropagation();
    const keyId = normalizeKeyFromEvent(e.nativeEvent);
    updateRow(i, { keyId });
    if (RESERVED_KEYS.has(keyId)) {
      setToast(`"${keyId}" is reserved for the performance HUD toggle.`);
    }
  }

  function buildPayload(): Loadout {
    const bindings: Record<string, Binding> = {};
    for (const r of rows) {
      const entry = fromRow(r);
      if (!entry) continue;
      const [keyId, binding] = entry;
      bindings[keyId] = binding;
    }

    if (!bindings["c"]) bindings["c"] = { type: "webcam", label: "Webcam" };

    return {
      name: selected,
      version: 1,
      initial: { type: "video", src: initialSrc || "" },
      bindings,
    };
  }

  async function onSave() {
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
              {/* ✅ Use CSS grid for reliable spacing */}
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

              {/* ✅ grid prevents input/button collision */}
              <div className="grid2">
                <div className="grow">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder='New loadout name (e.g. "Emerald Street Set")'
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
            {/* ✅ use grid2 here as well to avoid overlap */}
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
            <Button variant="secondary" onClick={addRow} disabled={isBusy}>
              Add binding
            </Button>
            <span className="toast">{toast}</span>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          {/* ✅ fixed table model so columns don’t visually bleed into each other */}
          <colgroup>
            <col style={{ width: 180 }} />
            <col style={{ width: 140 }} />
            <col /> {/* video column flexes */}
            <col style={{ width: 220 }} />
            <col style={{ width: 120 }} />
          </colgroup>

          <thead>
            <tr>
              <Th>Key</Th>
              <Th>Type</Th>
              <Th>Video</Th>
              <Th>Label</Th>
              <Th style={{ width: 130 }}>&nbsp;</Th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <Td>
                  <div className="table-controls">
                    <Input
                      value={r.keyId}
                      placeholder="Click, press a key…"
                      onKeyDown={(e) => captureKey(i, e)}
                      onChange={(e) => updateRow(i, { keyId: e.target.value })}
                      disabled={isBusy}
                    />
                  </div>
                </Td>

                <Td>
                  <div className="table-controls">
                    <Select
                      value={r.type}
                      onChange={(e) =>
                        updateRow(i, {
                          type: e.target.value as Row["type"],
                          src: e.target.value === "webcam" ? "" : r.src,
                        })
                      }
                      disabled={isBusy}
                    >
                      <option value="video">video</option>
                      <option value="webcam">webcam</option>
                    </Select>
                  </div>
                </Td>

                <Td>
                  <div className="table-controls">
                    <Select
                      value={r.src}
                      onChange={(e) => updateRow(i, { src: e.target.value })}
                      disabled={isBusy || r.type === "webcam"}
                    >
                      {videoOptions.map((v) => (
                        <option key={v} value={v}>
                          {v ? v : "(none)"}
                        </option>
                      ))}
                    </Select>
                  </div>
                </Td>

                <Td>
                  <div className="table-controls">
                    <Input
                      value={r.label}
                      placeholder="Optional label"
                      onChange={(e) => updateRow(i, { label: e.target.value })}
                      disabled={isBusy}
                    />
                  </div>
                </Td>

                <Td>
                  <Button variant="secondary" onClick={() => removeRow(i)} disabled={isBusy}>
                    Remove
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        <div className="sub" style={{ marginTop: 10 }}>
          Tip: special keys include <span className="kbd">ArrowUp</span>,{" "}
          <span className="kbd">Enter</span>, <span className="kbd">Escape</span>,{" "}
          <span className="kbd">Space</span>.
        </div>
      </Card>
    </div>
  );
}