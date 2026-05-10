// js/runtime.js

(function () {
  const videoEl = document.getElementById("myVideo");
  const loadoutSelect = document.getElementById("loadoutSelect");
  const statusText = document.getElementById("statusText");
  const openSetupBtn = document.getElementById("openSetup");
  const hudEl = document.getElementById("hud");

  const player = createPlayer(videoEl, statusText);

  const STORAGE_LAST_LOADOUT = "video_switcher:last_loadout";

  let currentLoadout = null;

  function setStatus(msg) {
    if (statusText) statusText.textContent = msg || "";
  }

  function setHudVisible(visible) {
    if (!hudEl) return;
    hudEl.classList.toggle("hud--hidden", !visible);
  }

  function isHudVisible() {
    return hudEl && !hudEl.classList.contains("hud--hidden");
  }

  function getSelectedLoadoutName() {
    return loadoutSelect.value || "Default";
  }

  async function populateLoadouts() {
    const loadouts = await fetchLoadouts();
    loadoutSelect.innerHTML = "";

    // Ensure Default exists in UI
    const unique = Array.from(new Set(["Default", ...loadouts]));

    for (const name of unique) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      loadoutSelect.appendChild(opt);
    }

    const last = localStorage.getItem(STORAGE_LAST_LOADOUT);
    if (last && unique.includes(last)) {
      loadoutSelect.value = last;
    } else {
      loadoutSelect.value = "Default";
    }
  }

  async function loadLoadout(name) {
    try {
      const data = await fetchLoadout(name);
      currentLoadout = data;
      localStorage.setItem(STORAGE_LAST_LOADOUT, name);

      setStatus(`Loaded loadout: ${name}`);

      const initial = data?.initial;
      if (initial && initial.type === "video" && typeof initial.src === "string" && initial.src.length > 0) {
        await player.switchToVideo(initial.src);
      }
    } catch (err) {
      console.error(err);
      setStatus(`Failed to load loadout: ${name}`);
      currentLoadout = null;
    }
  }

  function getBindingForKey(keyId) {
    const bindings = currentLoadout?.bindings;
    if (!bindings) return null;
    return bindings[keyId] || null;
  }

  async function handleKeydown(e) {
    if (e.repeat) return;

    const keyId = normalizeKeyFromEvent(e);

    // Reserve 'h' (lowercase) for HUD toggle
    if (keyId === "h") {
      setHudVisible(!isHudVisible());
      return;
    }

    if (keyId === "Escape") {
      setHudVisible(false);
      return;
    }

    const binding = getBindingForKey(keyId);
    if (!binding) return;

    // Prevent browser defaults for some special keys
    if (keyId === "Space" || (typeof keyId === "string" && keyId.startsWith("Arrow")) || keyId === "Enter") {
      e.preventDefault();
    }

    if (binding.type === "webcam") {
      await player.switchToWebcam();
      return;
    }

    if (binding.type === "video") {
      await player.switchToVideo(binding.src || "");
      return;
    }

    console.warn("Unknown binding type:", binding.type, binding);
  }

  async function init() {
    // Stage defaults
    videoEl.muted = true;
    videoEl.autoplay = true;
    videoEl.loop = true;

    // HUD hidden by default (your requirement)
    setHudVisible(false);

    await populateLoadouts();
    await loadLoadout(getSelectedLoadoutName());

    loadoutSelect.addEventListener("change", async () => {
      await loadLoadout(getSelectedLoadoutName());
    });

    document.addEventListener("keydown", handleKeydown, { passive: false });

    openSetupBtn.addEventListener("click", () => {
      window.location.href = "/setup/";
    });
  }

  init().catch((e) => {
    console.error(e);
    setStatus("Init failed. Check console.");
  });
})();
