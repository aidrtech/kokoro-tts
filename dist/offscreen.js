(() => {
  // src/offscreen.js
  var currentAudio = null;
  var currentUrl = null;
  var paused = false;
  function stopPlayback() {
    if (currentAudio) {
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.pause();
      currentAudio = null;
    }
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      currentUrl = null;
    }
  }
  function sendStatus(state, extra = {}) {
    chrome.runtime.sendMessage({ target: "content", type: "tts-status", state, ...extra }).catch(() => {
    });
  }
  function playAudio(dataUrl) {
    return new Promise((resolve, reject) => {
      stopPlayback();
      currentUrl = dataUrl;
      currentAudio = new Audio(dataUrl);
      currentAudio.onended = () => resolve();
      currentAudio.onerror = () => reject(new Error("audio playback failed"));
      if (!paused) {
        currentAudio.play().then(() => sendStatus("playing")).catch(reject);
      }
    });
  }
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.target !== "offscreen") return;
    if (msg.type === "play-audio") {
      playAudio(msg.dataUrl).then(() => sendStatus("done")).catch((err) => sendStatus("error", { message: String(err?.message || err) }));
    } else if (msg.type === "stop") {
      stopPlayback();
      sendStatus("stopped");
    } else if (msg.type === "toggle-pause") {
      if (!currentAudio) return;
      paused = !paused;
      if (paused) {
        currentAudio.pause();
        sendStatus("paused");
      } else {
        currentAudio.play().then(() => sendStatus("playing")).catch(() => {
        });
      }
    }
  });
})();
