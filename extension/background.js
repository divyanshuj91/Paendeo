const DEFAULT_STORAGE = {
  platforms: {
    chatgpt: {
      daily: { tokensSent: 0, tokensReceived: 0, messagesCount: 0, date: null },
      conversation: { totalTokens: 0, messageCount: 0 },
      limits: { contextWindow: 128000, dailyMessages: 80, tier: "free" }
    },
    claude: {
      daily: { tokensSent: 0, tokensReceived: 0, messagesCount: 0, date: null },
      conversation: { totalTokens: 0, messageCount: 0 },
      limits: { contextWindow: 200000, dailyMessages: 45, tier: "free" }
    },
    gemini: {
      daily: { tokensSent: 0, tokensReceived: 0, messagesCount: 0, date: null },
      conversation: { totalTokens: 0, messageCount: 0 },
      limits: { contextWindow: 1000000, dailyMessages: 50, tier: "free" }
    },
    grok: {
      daily: { tokensSent: 0, tokensReceived: 0, messagesCount: 0, date: null },
      conversation: { totalTokens: 0, messageCount: 0 },
      limits: { contextWindow: 128000, dailyMessages: 25, tier: "free" }
    }
  },
  settings: {
    petEnabled: true,
    petScale: 1.0,
    petSpeed: 1.0,
    skin: "normal",
    showHUD: true,
    hudPosition: null,
    hudCollapsed: false
  },
  lastResetDate: null
};

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(null);
  if (!data.platforms) {
    await chrome.storage.local.set(DEFAULT_STORAGE);
  }
  setupDailyReset();
});

chrome.runtime.onStartup.addListener(() => {
  setupDailyReset();
  checkAndResetDaily();
});

function setupDailyReset() {
  chrome.alarms.create("dailyReset", {
    periodInMinutes: 60
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "dailyReset") {
    checkAndResetDaily();
  }
});

async function checkAndResetDaily() {
  const today = new Date().toISOString().split("T")[0];
  const data = await chrome.storage.local.get(["platforms", "lastResetDate"]);

  if (data.lastResetDate === today) return;

  const platforms = JSON.parse(JSON.stringify(data.platforms || DEFAULT_STORAGE.platforms));
  for (const key of Object.keys(platforms)) {
    platforms[key].daily = {
      tokensSent: 0,
      tokensReceived: 0,
      messagesCount: 0,
      date: today
    };
    platforms[key].conversation = { totalTokens: 0, messageCount: 0 };
  }

  await chrome.storage.local.set({ platforms, lastResetDate: today });
}

const TIER_LIMITS = {
  chatgpt: {
    free:  { contextWindow: 128000, dailyMessages: 80 },
    plus:  { contextWindow: 128000, dailyMessages: 160 },
    pro:   { contextWindow: 128000, dailyMessages: 999 },
    team:  { contextWindow: 128000, dailyMessages: 200 }
  },
  claude: {
    free:  { contextWindow: 200000, dailyMessages: 30 },
    pro:   { contextWindow: 200000, dailyMessages: 100 },
    team:  { contextWindow: 200000, dailyMessages: 150 }
  },
  gemini: {
    free:  { contextWindow: 1000000, dailyMessages: 25 },
    pro:   { contextWindow: 1000000, dailyMessages: 150 },
    ultra: { contextWindow: 1000000, dailyMessages: 300 }
  },
  grok: {
    free:  { contextWindow: 128000, dailyMessages: 10 },
    premium: { contextWindow: 128000, dailyMessages: 30 },
    premiumPlus: { contextWindow: 128000, dailyMessages: 100 }
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((response) => {
      sendResponse(response || { success: true });
    })
    .catch((error) => {
      console.error("Error handling message:", error);
      sendResponse({ error: error.message || String(error) });
    });
  return true;
});

async function handleMessage(message, sender) {
  if (!message) {
    return { error: "Empty message" };
  }

  const { type, payload } = message;
  const safePayload = payload || {};

  switch (type) {
    case "INCREMENT_TOKENS": {
      const { platform, tokensSent, tokensReceived } = safePayload;
      const data = await chrome.storage.local.get(["platforms", "lastResetDate"]);
      const platforms = JSON.parse(JSON.stringify(data.platforms || DEFAULT_STORAGE.platforms));
      const today = new Date().toISOString().split("T")[0];

      if (data.lastResetDate !== today) {
        await checkAndResetDaily();
        return { success: true };
      }

      if (platforms[platform]) {
        platforms[platform].daily.tokensSent += tokensSent || 0;
        platforms[platform].daily.tokensReceived += tokensReceived || 0;
        platforms[platform].daily.messagesCount += 1;
        platforms[platform].daily.date = today;
        await chrome.storage.local.set({ platforms });
      }

      return { success: true, usage: platforms[platform]?.daily };
    }

    case "UPDATE_CONVERSATION": {
      const { platform, totalTokens, messageCount } = safePayload;
      const data = await chrome.storage.local.get(["platforms"]);
      const platforms = JSON.parse(JSON.stringify(data.platforms || DEFAULT_STORAGE.platforms));

      if (platforms[platform]) {
        platforms[platform].conversation = { totalTokens, messageCount };
        await chrome.storage.local.set({ platforms });
      }

      return { success: true };
    }

    case "GET_USAGE": {
      const data = await chrome.storage.local.get(["platforms", "settings"]);
      return {
        platforms: data.platforms || DEFAULT_STORAGE.platforms,
        settings: data.settings || DEFAULT_STORAGE.settings
      };
    }

    case "UPDATE_SETTINGS": {
      const { settings } = safePayload;
      await chrome.storage.local.set({ settings });
      return { success: true };
    }

    case "UPDATE_LIMITS": {
      const { platform, limits } = safePayload;
      const data = await chrome.storage.local.get(["platforms"]);
      const platforms = JSON.parse(JSON.stringify(data.platforms || DEFAULT_STORAGE.platforms));

      if (platforms[platform]) {
        platforms[platform].limits = { ...platforms[platform].limits, ...limits };
        await chrome.storage.local.set({ platforms });
      }

      return { success: true };
    }

    case "UPDATE_TIER": {
      const { platform, tier } = safePayload;
      const data = await chrome.storage.local.get(["platforms"]);
      const platforms = JSON.parse(JSON.stringify(data.platforms || DEFAULT_STORAGE.platforms));

      if (platforms[platform] && TIER_LIMITS[platform]?.[tier]) {
        platforms[platform].limits = {
          ...TIER_LIMITS[platform][tier],
          tier
        };
        await chrome.storage.local.set({ platforms });
      }

      return { success: true, limits: platforms[platform]?.limits };
    }

    case "RESET_DAILY": {
      const data = await chrome.storage.local.get(["platforms"]);
      const platforms = JSON.parse(JSON.stringify(data.platforms || DEFAULT_STORAGE.platforms));
      const today = new Date().toISOString().split("T")[0];

      for (const key of Object.keys(platforms)) {
        platforms[key].daily = { tokensSent: 0, tokensReceived: 0, messagesCount: 0, date: today };
        platforms[key].conversation = { totalTokens: 0, messageCount: 0 };
      }

      await chrome.storage.local.set({ platforms, lastResetDate: today });
      return { success: true };
    }

    default:
      return { error: "Unknown message type" };
  }
}
