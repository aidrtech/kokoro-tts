(() => {
  // src/background.js
  var DEFAULTS = { serverUrl: "http://localhost:8880", voice: "af_heart", speed: 1 };
  var creating = null;
  async function ensureOffscreen() {
    if (await chrome.offscreen.hasDocument()) return;
    if (!creating) {
      creating = chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Plays TTS audio received from the Kokoro server."
      }).finally(() => {
        creating = null;
      });
    }
    await creating;
  }
  async function sendToOffscreen(msg) {
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        await chrome.runtime.sendMessage({ ...msg, target: "offscreen" });
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }
  var activeTabId = null;
  var lastStatus = null;
  async function fetchSpeech({ text, voice, speed }) {
    const { serverUrl } = await chrome.storage.local.get(DEFAULTS);
    const res = await fetch(`${serverUrl}/v1/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "kokoro",
        input: text,
        voice: voice || "af_heart",
        speed: speed || 1,
        response_format: "mp3"
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Server returned ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.blob();
  }
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.target === "bg") {
      if (msg.type === "get-status") {
        sendResponse(lastStatus);
      } else if (msg.type === "speak") {
        if (sender.tab?.id != null) activeTabId = sender.tab.id;
        (async () => {
          try {
            sendStatus("generating");
            const blob = await fetchSpeech(msg);
            const reader = new FileReader();
            const dataUrl = await new Promise((resolve, reject) => {
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            await ensureOffscreen();
            await sendToOffscreen({ type: "play-audio", dataUrl });
          } catch (err) {
            sendStatus("error", { message: String(err?.message || err).slice(0, 200) });
          }
        })();
      } else if (msg.type === "stop" || msg.type === "toggle-pause") {
        chrome.offscreen.hasDocument().then((has) => {
          if (has) sendToOffscreen({ type: msg.type });
        });
      }
    } else if (msg?.target === "content") {
      if (msg.type === "tts-status") lastStatus = msg;
      if (activeTabId != null) {
        chrome.tabs.sendMessage(activeTabId, msg).catch(() => {
        });
      }
    }
  });
  function sendStatus(state, extra = {}) {
    lastStatus = { type: "tts-status", state, ...extra };
    if (activeTabId != null) {
      chrome.tabs.sendMessage(activeTabId, lastStatus).catch(() => {
      });
    }
  }
})();
