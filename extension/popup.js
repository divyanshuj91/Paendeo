/* ═══════════════════════════════════════════════════
   Paendeo – Popup Dashboard Logic
   Reads/writes chrome.storage, renders progress rings,
   handles settings, tier editing, and reset.
   ═══════════════════════════════════════════════════ */

(() => {
  "use strict";

  // ── Constants ──────────────────────────────────────
  const PLATFORMS = ["chatgpt", "claude", "gemini", "grok"];

  const RING_CIRCUMFERENCE = 2 * Math.PI * 28; // ≈175.93

  const DEFAULT_LIMITS = {
    chatgpt: { contextWindow: 128000, dailyMessages: 80, tier: "free" },
    claude:  { contextWindow: 200000, dailyMessages: 45, tier: "free" },
    gemini:  { contextWindow: 1000000, dailyMessages: 50, tier: "free" },
    grok:    { contextWindow: 128000, dailyMessages: 25, tier: "free" },
  };

  const DEFAULT_SETTINGS = {
    petEnabled: true,
    petScale: 1.0,
    petSpeed: 1.0,
    skin: "normal",
    showHUD: true,
  };

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function buildDefaultPlatform(name) {
    return {
      daily: { tokensSent: 0, tokensReceived: 0, messagesCount: 0, date: todayISO() },
      conversation: { totalTokens: 0 },
      limits: { ...DEFAULT_LIMITS[name] },
    };
  }

  function buildDefaults() {
    const platforms = {};
    PLATFORMS.forEach((p) => (platforms[p] = buildDefaultPlatform(p)));
    return { platforms, settings: { ...DEFAULT_SETTINGS } };
  }

  // ── Storage Helpers ────────────────────────────────
  const storage = {
    get(keys) {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys, (data) => resolve(data));
      });
    },
    set(obj) {
      return new Promise((resolve) => {
        chrome.storage.local.set(obj, () => resolve());
      });
    },
  };

  // ── Formatting Helpers ─────────────────────────────
  function fmtTokens(n) {
    if (n >= 1000000) return (n / 1000).toFixed(0) + "K";
    if (n >= 10000) return (n / 1000).toFixed(1) + "K";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return String(n);
  }

  function fmtLimit(n) {
    if (n >= 1000000) return (n / 1000).toFixed(0) + "K";
    if (n >= 1000) return (n / 1000).toFixed(0) + "K";
    return String(n);
  }

  function usagePct(used, limit) {
    if (!limit) return 0;
    return Math.min(100, (used / limit) * 100);
  }

  function statusFromPct(pct) {
    if (pct < 50)  return { label: "Good",    cls: "status-green",  color: "#22c55e" };
    if (pct < 75)  return { label: "Moderate",cls: "status-yellow", color: "#eab308" };
    if (pct < 90)  return { label: "High",    cls: "status-orange", color: "#f97316" };
    return           { label: "Critical",cls: "status-red",    color: "#ef4444" };
  }

  // ── DOM References ─────────────────────────────────
  const $ = (id) => document.getElementById(id);

  // ── Render Platform Card ───────────────────────────
  function renderCard(name, pData) {
    const d = pData.daily || {};
    const c = pData.conversation || {};
    const l = pData.limits || DEFAULT_LIMITS[name];

    const totalDaily = (d.tokensSent || 0) + (d.tokensReceived || 0);
    const convTokens = c.totalTokens || 0;
    const msgCount   = d.messagesCount || 0;

    // Use context-window tokens for ring %
    const pct = usagePct(convTokens, l.contextWindow);
    const st  = statusFromPct(pct);

    // SVG ring
    const ring = $(`ring-${name}`);
    if (ring) {
      const offset = RING_CIRCUMFERENCE - (pct / 100) * RING_CIRCUMFERENCE;
      ring.style.strokeDashoffset = offset;
      ring.style.stroke = st.color;
    }

    // Percentage text
    const pctEl = $(`pct-${name}`);
    if (pctEl) pctEl.textContent = Math.round(pct) + "%";

    // Tokens line
    const tokEl = $(`tokens-${name}`);
    if (tokEl) tokEl.textContent = `${fmtTokens(convTokens)} / ${fmtLimit(l.contextWindow)} tokens`;

    // Messages line
    const msgEl = $(`messages-${name}`);
    if (msgEl) msgEl.textContent = `${msgCount} / ${l.dailyMessages} messages today`;

    // Status badge
    const statEl = $(`status-${name}`);
    if (statEl) {
      statEl.textContent = st.label;
      statEl.className = "card-status " + st.cls;
    }

    // Drawer inputs
    const tierSel = $(`tier-${name}`);
    if (tierSel) tierSel.value = l.tier || "free";

    const ctxInput = $(`limit-context-${name}`);
    if (ctxInput) ctxInput.value = l.contextWindow;

    const msgInput = $(`limit-messages-${name}`);
    if (msgInput) msgInput.value = l.dailyMessages;
  }

  // ── Render Settings ────────────────────────────────
  function renderSettings(s) {
    const settings = { ...DEFAULT_SETTINGS, ...s };

    $("toggle-pet").checked  = settings.petEnabled;
    $("toggle-hud").checked  = settings.showHUD;
    $("slider-scale").value  = settings.petScale;
    $("val-scale").textContent = Number(settings.petScale).toFixed(1);
    $("slider-speed").value  = settings.petSpeed;
    $("val-speed").textContent = Number(settings.petSpeed).toFixed(1);
    $("select-skin").value   = settings.skin;
  }

  // ── Full Render ────────────────────────────────────
  async function render() {
    const data = await storage.get(["platforms", "settings"]);

    // If first install, seed defaults
    if (!data.platforms) {
      const defaults = buildDefaults();
      await storage.set(defaults);
      data.platforms = defaults.platforms;
      data.settings  = defaults.settings;
    }

    // Auto-reset if date changed
    const today = todayISO();
    let needsSave = false;
    PLATFORMS.forEach((p) => {
      if (!data.platforms[p]) {
        data.platforms[p] = buildDefaultPlatform(p);
        needsSave = true;
      }
      if (data.platforms[p].daily && data.platforms[p].daily.date !== today) {
        data.platforms[p].daily = { tokensSent: 0, tokensReceived: 0, messagesCount: 0, date: today };
        needsSave = true;
      }
    });
    if (needsSave) await storage.set({ platforms: data.platforms });

    PLATFORMS.forEach((p) => renderCard(p, data.platforms[p]));
    renderSettings(data.settings || {});
  }

  // ── Card Expand/Collapse ──────────────────────────
  function setupCardToggles() {
    PLATFORMS.forEach((name) => {
      const main = $(`card-main-${name}`);
      const card = $(`card-${name}`);
      if (!main || !card) return;

      main.addEventListener("click", () => {
        // Close other expanded cards
        PLATFORMS.forEach((other) => {
          if (other !== name) $(`card-${other}`)?.classList.remove("expanded");
        });
        card.classList.toggle("expanded");
      });
    });
  }

  // ── Save Drawer (tier + limits) ───────────────────
  function setupDrawerSaves() {
    PLATFORMS.forEach((name) => {
      const btn = $(`save-${name}`);
      if (!btn) return;

      btn.addEventListener("click", async () => {
        const tier      = $(`tier-${name}`).value;
        const ctxVal    = parseInt($(`limit-context-${name}`).value, 10);
        const msgVal    = parseInt($(`limit-messages-${name}`).value, 10);

        if (isNaN(ctxVal) || ctxVal < 1000 || isNaN(msgVal) || msgVal < 1) return;

        const data = await storage.get(["platforms"]);
        if (!data.platforms || !data.platforms[name]) return;

        data.platforms[name].limits = {
          contextWindow: ctxVal,
          dailyMessages: msgVal,
          tier,
        };

        await storage.set({ platforms: data.platforms });

        // Visual feedback
        btn.textContent = "✓ Saved";
        btn.classList.add("saved");
        setTimeout(() => {
          btn.textContent = "Save";
          btn.classList.remove("saved");
        }, 1200);

        renderCard(name, data.platforms[name]);
      });
    });
  }

  // ── Settings Toggle ───────────────────────────────
  function setupSettings() {
    const section = $("settings-section");
    const toggle  = $("settings-toggle");
    if (toggle && section) {
      toggle.addEventListener("click", () => section.classList.toggle("open"));
    }

    // Helper to persist a single setting key
    async function saveSetting(key, value) {
      const data = await storage.get(["settings"]);
      const settings = { ...DEFAULT_SETTINGS, ...data.settings, [key]: value };
      await storage.set({ settings });
    }

    // Pet toggle
    $("toggle-pet")?.addEventListener("change", (e) => {
      saveSetting("petEnabled", e.target.checked);
    });

    // HUD toggle
    $("toggle-hud")?.addEventListener("change", (e) => {
      saveSetting("showHUD", e.target.checked);
    });

    // Scale slider
    $("slider-scale")?.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      $("val-scale").textContent = v.toFixed(1);
      saveSetting("petScale", v);
    });

    // Speed slider
    $("slider-speed")?.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      $("val-speed").textContent = v.toFixed(1);
      saveSetting("petSpeed", v);
    });

    // Skin select
    $("select-skin")?.addEventListener("change", (e) => {
      saveSetting("skin", e.target.value);
    });
  }

  // ── Reset Stats ───────────────────────────────────
  function setupReset() {
    const btn = $("btn-reset");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      const data = await storage.get(["platforms"]);
      if (!data.platforms) return;

      const today = todayISO();
      PLATFORMS.forEach((p) => {
        if (data.platforms[p]) {
          data.platforms[p].daily = {
            tokensSent: 0,
            tokensReceived: 0,
            messagesCount: 0,
            date: today,
          };
          data.platforms[p].conversation = { totalTokens: 0 };
        }
      });

      await storage.set({ platforms: data.platforms });

      // Also notify background script
      try {
        chrome.runtime.sendMessage({ type: "RESET_DAILY" });
      } catch (_) {
        /* background may not be listening yet */
      }

      // Visual feedback
      btn.textContent = "✓ Reset!";
      setTimeout(() => (btn.textContent = "Reset Stats"), 1200);

      render();
    });
  }

  // ── Live Storage Listener ─────────────────────────
  function setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.platforms || changes.settings) {
        render();
      }
    });
  }

  // ── Init ──────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    setupCardToggles();
    setupDrawerSaves();
    setupSettings();
    setupReset();
    setupStorageListener();
    render();
  });
})();
