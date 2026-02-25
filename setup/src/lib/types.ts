export type Binding =
  | { type: "video"; src: string; label?: string }
  | { type: "webcam"; label?: string };

export type Loadout = {
  name: string;          // display name (spaces allowed)
  version: 1;
  initial: { type: "video"; src: string };
  bindings: Record<string, Binding>; // keyId -> binding
};