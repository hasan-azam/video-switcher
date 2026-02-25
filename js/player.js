// js/player.js

function createPlayer(videoEl, statusEl) {
  let currentStream = null;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function stopWebcam() {
    if (!currentStream) return;
    try {
      currentStream.getTracks().forEach((t) => t.stop());
    } catch (_) {
      // ignore
    }
    currentStream = null;
  }

  async function switchToVideo(src) {
    stopWebcam();
    videoEl.srcObject = null;

    // Loop is default behavior
    videoEl.loop = true;

    // If src is empty, just clear and pause
    if (!src) {
      videoEl.removeAttribute("src");
      videoEl.load();
      setStatus("Cleared video");
      return;
    }

    // Reassign and play
    videoEl.src = src;
    videoEl.load();

    try {
      await videoEl.play();
      setStatus(`Playing: ${src}`);
    } catch (err) {
      setStatus(`Play failed: ${String(err)}`);
      console.error(err);
    }
  }

  async function switchToWebcam() {
    stopWebcam();

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Webcam not supported in this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      currentStream = stream;
      videoEl.src = "";
      videoEl.srcObject = stream;
      videoEl.loop = false; // irrelevant for live stream

      await videoEl.play();
      setStatus("Webcam active");
    } catch (err) {
      setStatus(`Webcam failed: ${String(err)}`);
      console.error(err);
    }
  }

  return {
    switchToVideo,
    switchToWebcam,
    stopWebcam,
  };
}