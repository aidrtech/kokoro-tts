(() => {
  // src/content.js
  var MIN_CHARS = 3;
  var MAX_CHARS = 3e3;
  var settings = { enabled: true, voice: "af_heart", speed: 1 };
  function safeSend(msg) {
    try {
      chrome.runtime.sendMessage(msg).catch(() => {
      });
    } catch {
    }
  }
  chrome.storage.local.get(settings).then((stored) => {
    settings = { ...settings, ...stored };
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      settings[key] = newValue;
    }
    if (changes.enabled && changes.enabled.newValue === false) {
      hideButton();
      hideChip();
    }
  });
  var button = null;
  var reading = false;
  function ensureButton() {
    if (button) return button;
    button = document.createElement("button");
    button.id = "kokoro-reader-button";
    button.type = "button";
    button.textContent = "\u25B6 Read";
    button.addEventListener("mousedown", (e) => e.preventDefault());
    button.addEventListener("click", onReadClick);
    document.documentElement.appendChild(button);
    return button;
  }
  function showButtonAt(rect) {
    const btn = ensureButton();
    btn.style.display = "block";
    const top = Math.min(rect.bottom + 8, window.innerHeight - 40);
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - btn.offsetWidth / 2, 8),
      window.innerWidth - btn.offsetWidth - 8
    );
    btn.style.top = `${top}px`;
    btn.style.left = `${left}px`;
  }
  function hideButton() {
    if (button) button.style.display = "none";
  }
  function selectedText() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const text = sel.toString().replace(/\s+/g, " ").trim();
    return text.length >= MIN_CHARS ? text : null;
  }
  function maybeShowButton() {
    if (!settings.enabled) return;
    const text = selectedText();
    if (!text) {
      hideButton();
      return;
    }
    const sel = window.getSelection();
    const rect = sel.getRangeAt(sel.rangeCount - 1).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      hideButton();
      return;
    }
    showButtonAt(rect);
  }
  document.addEventListener("mouseup", (e) => {
    if (button && e.target === button) return;
    setTimeout(maybeShowButton, 0);
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "Shift" || e.key.startsWith("Arrow")) setTimeout(maybeShowButton, 0);
  });
  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) hideButton();
  });
  window.addEventListener("scroll", hideButton, { passive: true, capture: true });
  function onReadClick() {
    const text = selectedText();
    hideButton();
    if (!text) return;
    reading = true;
    showChip("Preparing\u2026");
    safeSend({
      target: "bg",
      type: "speak",
      text: text.slice(0, MAX_CHARS),
      voice: settings.voice,
      speed: settings.speed
    });
  }
  function stopReading() {
    reading = false;
    hideChip();
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (reading) {
        safeSend({ target: "bg", type: "stop" });
        stopReading();
      }
      hideButton();
    }
  });
  window.addEventListener("pagehide", () => {
    if (reading) safeSend({ target: "bg", type: "stop" });
  });
  var chip = null;
  var chipHideTimer = null;
  function showChip(label) {
    if (!chip) {
      chip = document.createElement("div");
      chip.id = "kokoro-reader-chip";
      chip.addEventListener("click", () => {
        if (reading) safeSend({ target: "bg", type: "toggle-pause" });
      });
      document.documentElement.appendChild(chip);
    }
    clearTimeout(chipHideTimer);
    chip.textContent = label;
    chip.style.display = "block";
  }
  function hideChip() {
    if (chip) chip.style.display = "none";
  }
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.target !== "content" || msg.type !== "tts-status") return;
    switch (msg.state) {
      case "download":
        showChip(
          msg.progress != null ? `Downloading Kokoro model\u2026 ${msg.progress}%` : "Downloading Kokoro model\u2026"
        );
        break;
      case "loading":
        showChip("Loading Kokoro model\u2026");
        break;
      case "generating":
        showChip("Generating speech\u2026");
        break;
      case "playing":
        showChip("\u25B6 Reading \u2014 click to pause, Esc to stop");
        break;
      case "paused":
        showChip("\u23F8 Paused \u2014 click to resume");
        break;
      case "done":
      case "stopped":
        stopReading();
        break;
      case "error":
        showChip(`TTS error: ${msg.message || "unknown"}`);
        reading = false;
        chipHideTimer = setTimeout(hideChip, 5e3);
        break;
    }
  });
})();
