try {
  importScripts("env.js");
} catch (e) {
  console.warn("Paendeo: env.js not found, running without environment keys.");
  self.ENV_KEYS = { openai: "", anthropic: "", gemini: "" };
}

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
  
  const existingKeys = data.apiKeys || {};
  const env = self.ENV_KEYS || {};
  await chrome.storage.local.set({
    apiKeys: {
      openai: existingKeys.openai || env.openai || "",
      anthropic: existingKeys.anthropic || env.anthropic || "",
      gemini: existingKeys.gemini || env.gemini || ""
    }
  });
  
  setupDailyReset();
});

chrome.runtime.onStartup.addListener(async () => {
  setupDailyReset();
  checkAndResetDaily();
  
  const data = await chrome.storage.local.get("apiKeys");
  const keys = data.apiKeys || {};
  const env = self.ENV_KEYS || {};
  await chrome.storage.local.set({
    apiKeys: {
      openai: keys.openai || env.openai || "",
      anthropic: keys.anthropic || env.anthropic || "",
      gemini: keys.gemini || env.gemini || ""
    }
  });
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

    case "ENHANCE_PROMPT": {
      const { prompt } = safePayload;
      if (!prompt || prompt.trim().length === 0) {
        return { error: "Empty prompt" };
      }
      return await optimizePromptPipeline(prompt);
    }

    default:
      return { error: "Unknown message type" };
  }
}

async function fetchWithTimeout(url, options, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function optimizePromptPipeline(rawPrompt) {
  const SYSTEM_META = 
    "You are an expert prompt engineer. Take the user's raw input and rewrite it into a world-class, high-performance structured prompt.\n" +
    "Dynamically embed:\n" +
    "- ROLE: A highly specific expert persona.\n" +
    "- CONTEXT: The implicit background reasoning.\n" +
    "- CONSTRAINTS: Formatting boundaries, strict rules, and stylistic tone.\n" +
    "- OUTPUT SCHEMA: Clear layout instructions (e.g., Markdown, tables, bullets).\n\n" +
    "CRITICAL RULE: Do not answer or fulfill the user's request. Output ONLY the raw text of the newly optimized prompt so it can be fed directly to another AI.";

  const storageData = await chrome.storage.local.get(["apiKeys"]);
  const keys = storageData.apiKeys || {};
  const env = self.ENV_KEYS || {};

  const pipeline = [
    { provider: "openai", model: "gpt-4o", apiKey: keys.openai || env.openai || "" },
    { provider: "anthropic", model: "claude-3-5-sonnet-20241022", apiKey: keys.anthropic || env.anthropic || "" },
    { provider: "gemini", model: "gemini-2.5-flash", apiKey: keys.gemini || env.gemini || "" },
    { provider: "openai", model: "gpt-4o-mini", apiKey: keys.openai || env.openai || "" }
  ];

  for (const node of pipeline) {
    if (!node.apiKey) {
      console.log(`[Pipeline Log]: Skipping ${node.model} because its API key is not configured.`);
      continue;
    }

    try {
      let url = "";
      let options = {
        method: "POST",
        headers: {}
      };

      if (node.provider === "openai") {
        url = "https://api.openai.com/v1/chat/completions";
        options.headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${node.apiKey}`
        };
        options.body = JSON.stringify({
          model: node.model,
          messages: [
            { role: "system", content: SYSTEM_META },
            { role: "user", content: `Optimize: ${rawPrompt}` }
          ],
          temperature: 0.4
        });
      } else if (node.provider === "anthropic") {
        url = "https://api.anthropic.com/v1/messages";
        options.headers = {
          "content-type": "application/json",
          "x-api-key": node.apiKey,
          "anthropic-version": "2023-06-01"
        };
        options.body = JSON.stringify({
          model: node.model,
          max_tokens: 4096,
          system: SYSTEM_META,
          messages: [
            { role: "user", content: `Optimize: ${rawPrompt}` }
          ],
          temperature: 0.4
        });
      } else if (node.provider === "gemini") {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${node.model}:generateContent?key=${node.apiKey}`;
        options.headers = {
          "Content-Type": "application/json"
        };
        options.body = JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `Optimize: ${rawPrompt}` }]
            }
          ],
          systemInstruction: {
            parts: [{ text: SYSTEM_META }]
          },
          generationConfig: {
            temperature: 0.4
          }
        });
      }

      console.log(`[Pipeline Log]: Trying ${node.model} via ${node.provider}...`);
      const response = await fetchWithTimeout(url, options, 10000);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const resJson = await response.json();
      let optimizedText = "";

      if (node.provider === "openai") {
        optimizedText = resJson.choices[0].message.content;
      } else if (node.provider === "anthropic") {
        optimizedText = resJson.content[0].text;
      } else if (node.provider === "gemini") {
        optimizedText = resJson.candidates[0].content.parts[0].text;
      }

      if (optimizedText) {
        console.log(`[Pipeline Success]: Successfully optimized prompt using ${node.model}`);
        return { success: true, optimizedPrompt: optimizedText.trim() };
      }
      throw new Error("Empty response received from LLM model");
    } catch (e) {
      console.warn(`[Fallback Log]: ${node.model} failed. Error: ${e.message || e}. Trying next tier...`);
      continue;
    }
  }

  throw new Error("All LLM fallback paths completely exhausted.");
}
