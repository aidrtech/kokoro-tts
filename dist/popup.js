(() => {
  // src/popup.js
  var VOICES = [
    ["af_heart", "Heart (US female)"],
    ["af_bella", "Bella (US female)"],
    ["af_nicole", "Nicole (US female)"],
    ["af_sarah", "Sarah (US female)"],
    ["af_sky", "Sky (US female)"],
    ["am_adam", "Adam (US male)"],
    ["am_michael", "Michael (US male)"],
    ["am_puck", "Puck (US male)"],
    ["bf_emma", "Emma (UK female)"],
    ["bf_isabella", "Isabella (UK female)"],
    ["bm_george", "George (UK male)"],
    ["bm_lewis", "Lewis (UK male)"]
  ];
  var DEFAULTS = { enabled: true, serverUrl: "http://localhost:8880", voice: "af_heart", speed: 1 };
  var enabledEl = document.getElementById("enabled");
  var serverEl = document.getElementById("server");
  var voiceEl = document.getElementById("voice");
  var speedEl = document.getElementById("speed");
  var speedValEl = document.getElementById("speedVal");
  var pauseEl = document.getElementById("pause");
  var stopEl = document.getElementById("stop");
  var statusEl = document.getElementById("status");
  for (const [id, label] of VOICES) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = label;
    voiceEl.appendChild(opt);
  }
  chrome.storage.local.get(DEFAULTS).then((s) => {
    enabledEl.checked = s.enabled;
    serverEl.value = s.serverUrl;
    voiceEl.value = s.voice;
    speedEl.value = s.speed;
    speedValEl.textContent = `${Number(s.speed).toFixed(1)}x`;
  });
  enabledEl.addEventListener("change", () => {
    chrome.storage.local.set({ enabled: enabledEl.checked });
    if (!enabledEl.checked) {
      chrome.runtime.sendMessage({ target: "bg", type: "stop" }).catch(() => {
      });
    }
  });
  serverEl.addEventListener("change", () => {
    const url = serverEl.value.replace(/\/+$/, "");
    serverEl.value = url;
    chrome.storage.local.set({ serverUrl: url });
  });
  voiceEl.addEventListener("change", () => {
    chrome.storage.local.set({ voice: voiceEl.value });
  });
  speedEl.addEventListener("input", () => {
    speedValEl.textContent = `${Number(speedEl.value).toFixed(1)}x`;
    chrome.storage.local.set({ speed: Number(speedEl.value) });
  });
  var ACTIVE_STATES = ["generating", "playing", "paused"];
  function renderPlayback(state) {
    pauseEl.disabled = state !== "playing" && state !== "paused";
    stopEl.disabled = !ACTIVE_STATES.includes(state);
    pauseEl.textContent = state === "paused" ? "Resume" : "Pause";
  }
  chrome.runtime.sendMessage({ target: "bg", type: "get-status" }).then((s) => renderPlayback(s?.state)).catch(() => {
  });
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.target === "content" && msg.type === "tts-status") {
      renderPlayback(msg.state);
      statusEl.textContent = msg.state === "error" ? `Error: ${msg.message || "unknown"}` : msg.state === "generating" ? "Generating speech..." : msg.state === "playing" ? "Playing..." : "";
    }
  });
  pauseEl.addEventListener("click", () => {
    chrome.runtime.sendMessage({ target: "bg", type: "toggle-pause" }).catch(() => {
    });
  });
  stopEl.addEventListener("click", () => {
    chrome.runtime.sendMessage({ target: "bg", type: "stop" }).catch(() => {
    });
  });
})();
