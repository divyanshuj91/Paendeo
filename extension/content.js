// ==========================================
// PAENDEO BROWSER EXTENSION — CONTENT SCRIPT
// Full pet engine + AI token tracker + Usage HUD
// Ported from the Electron desktop app renderer.js
// ==========================================

(function () {
  "use strict";

  // Prevent double-injection
  if (window.__paendeoInjected) return;
  window.__paendeoInjected = true;

  // ==========================================
  // PLATFORM DETECTION
  // ==========================================
  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) return "chatgpt";
    if (host.includes("claude.ai")) return "claude";
    if (host.includes("gemini.google.com")) return "gemini";
    if (host.includes("grok.com")) return "grok";
    if (host.includes("x.com") && window.location.pathname.includes("grok")) return "grok";
    return null;
  }

  const PLATFORM = detectPlatform();
  if (!PLATFORM) return;

  const PLATFORM_DISPLAY = {
    chatgpt: { name: "ChatGPT", icon: "🤖", accent: "#10a37f" },
    claude: { name: "Claude", icon: "🟣", accent: "#d97706" },
    gemini: { name: "Gemini", icon: "✨", accent: "#4285f4" },
    grok: { name: "Grok", icon: "⚡", accent: "#1da1f2" }
  };

  // ==========================================
  // SPRITE SHEET CONFIGURATION
  // ==========================================
  const SPRITE_CONFIG = {
    frameWidth: 128,
    frameHeight: 128,
    renderWidth: 64,
    renderHeight: 64,
    animations: {
      idle:  { row: 0, frameCount: 8, speed: 10 },
      walk:  { row: 1, frameCount: 8, speed: 8 },
      run:   { row: 2, frameCount: 8, speed: 6 },
      float: { row: 6, frameCount: 8, speed: 8 },
      sleep: { row: 7, frameCount: 8, speed: 12 },
      knead: { row: 1, frameCount: 8, speed: 4 },
    },
  };

  // ==========================================
  // CANVAS & DOM INJECTION
  // ==========================================
  let canvas = document.getElementById("paendeo-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "paendeo-canvas";
    document.body.appendChild(canvas);
  }
  const ctx = canvas.getContext("2d");

  let hitArea = document.getElementById("paendeo-hit-area");
  if (!hitArea) {
    hitArea = document.createElement("div");
    hitArea.id = "paendeo-hit-area";
    document.body.appendChild(hitArea);
  }

  let screenWidth = window.innerWidth;
  let screenHeight = window.innerHeight;

  function resizeCanvas() {
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;
    canvas.width = screenWidth;
    canvas.height = screenHeight;

    // Reposition pet based on screen ratios if we have them
    if (typeof pet !== "undefined" && pet) {
      if (pet.anchorXRatio !== undefined && pet.anchorYRatio !== undefined) {
        pet.x = pet.anchorXRatio * screenWidth;
        pet.y = pet.anchorYRatio * screenHeight;
        pet.keepInBounds();
        pet.anchorX = pet.x;
        pet.anchorY = pet.y;
      }
    }
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // ==========================================
  // SPRITE SHEET LOADER
  // ==========================================
  let spriteSheetImage = new Image();
  let isSpriteSheetLoaded = false;

  try {
    spriteSheetImage.src = chrome.runtime.getURL("assets/panda_spritesheet_clean.png");
  } catch (e) {
    spriteSheetImage.src = "";
  }
  spriteSheetImage.onload = () => { isSpriteSheetLoaded = true; };
  spriteSheetImage.onerror = () => { console.warn("Paendeo: Sprite sheet not found, using fallback."); };

  // ==========================================
  // GLOBAL STATE
  // ==========================================
  let typingHeat = 0;
  let mouseIdleTicks = 0;
  let pettingMeter = 0;
  let lastKeystrokeTime = 0;
  let currentSkin = "normal";
  let petScale = 1.0;
  let petSpeedFactor = 1.0;
  let petEnabled = true;
  let showHUD = true;

  // Speech bubble state
  let greetingText = "";
  let greetingTimer = 0;

  function showGreetingBubble(text, durationMs) {
    greetingText = text;
    greetingTimer = Math.round(durationMs / 33.3); // 30fps ticks
  }

  // ==========================================
  // TOKEN TRACKING STATE
  // ==========================================
  let conversationTokens = 0;
  let conversationMessageCount = 0;
  let dailyUsage = { tokensSent: 0, tokensReceived: 0, messagesCount: 0 };
  let platformLimits = { contextWindow: 128000, dailyMessages: 80, tier: "free" };
  let detectedModel = "";
  let lastMessageCount = 0;
  let lastObservedTexts = new Set();

  // Token usage reaction thresholds (already shown)
  let shownThresholds = new Set();

  function estimateTokens(text) {
    if (!text) return 0;
    const charEstimate = Math.ceil(text.length / 4);
    const words = text.split(/\s+/).filter(Boolean);
    const wordEstimate = Math.ceil(words.length * 1.3);
    return Math.round((charEstimate + wordEstimate) / 2);
  }

  function formatTokens(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  }

  // ==========================================
  // PARTICLE SYSTEM
  // ==========================================
  const particles = [];

  class Particle {
    constructor(x, y, type, char) {
      this.x = x;
      this.y = y;
      this.type = type;
      this.char = char || "";

      if (type === "code") {
        this.vx = (Math.random() - 0.5) * 2.5;
        this.vy = -2.0 - Math.random() * 2.5;
        this.life = 40 + Math.random() * 20;
        this.size = 8 + Math.random() * 6;
      } else if (type === "leaf") {
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = 0.4 + Math.random() * 0.8;
        this.life = 50 + Math.random() * 30;
        this.size = 5 + Math.random() * 3;
      } else if (type === "water") {
        this.vx = (Math.random() - 0.5) * 3.0;
        this.vy = -1.5 - Math.random() * 2.5;
        this.life = 35 + Math.random() * 20;
        this.size = 2.5 + Math.random() * 3;
      } else {
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = type === "heart" ? -1.2 - Math.random() * 1.2 : -0.8 - Math.random() * 0.8;
        this.life = 60 + Math.random() * 40;
        this.size = type === "heart" ? 12 : 3 + Math.random() * 4;
      }
      this.maxLife = this.life;

      const colors = ["#818cf8", "#6366f1", "#4f46e5", "#38bdf8", "#06b6d4", "#a78bfa", "#f43f5e", "#10b981"];
      this.color = colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.type === "code") {
        this.vy += 0.05;
        this.vx *= 0.98;
      } else if (this.type === "leaf") {
        this.vx += Math.sin(Date.now() * 0.03 + this.life) * 0.08;
        this.vx *= 0.98;
      }
      this.life--;
    }

    draw(ctx) {
      const alpha = this.life / this.maxLife;
      ctx.save();
      if (this.type === "heart") {
        ctx.globalAlpha = alpha;
        ctx.font = `${this.size}px sans-serif`;
        ctx.fillText("❤️", this.x - this.size / 2, this.y);
      } else if (this.type === "code") {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 4;
        ctx.font = `bold ${this.size}px monospace`;
        ctx.fillText(this.char, this.x, this.y);
      } else if (this.type === "leaf") {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#22c55e";
        ctx.strokeStyle = "#15803d";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const rotationAngle = Math.PI / 4 + Math.sin(Date.now() * 0.02 + this.life) * 0.3;
        ctx.ellipse(this.x, this.y, this.size, this.size * 0.5, rotationAngle, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (this.type === "water") {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#38bdf8";
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(226, 232, 240, ${alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function spawnParticle(x, y, type, char) {
    particles.push(new Particle(x, y, type, char));
    if (particles.length > 50) particles.shift();
  }

  // ==========================================
  // DESKTOP PET CLASS (Full physics port)
  // ==========================================
  class DesktopPet {
    constructor() {
      this.width = SPRITE_CONFIG.renderWidth;
      this.height = SPRITE_CONFIG.renderHeight;
      this.x = screenWidth - this.width - 60;
      this.y = screenHeight - this.height - 20;
      this.vx = 0;
      this.vy = 0;
      this.eyeX = 0;
      this.eyeY = 0;
      this.scaleFactor = 1.0;

      this.anchorX = this.x;
      this.anchorY = this.y;
      this.anchorXRatio = this.anchorX / screenWidth;
      this.anchorYRatio = this.anchorY / screenHeight;
      this.afkSleepActive = false;

      this.state = "idle";
      this.facing = "right";

      this.animFrameIndex = 0;
      this.animTick = 0;
      this.behaviorTimer = 0;
      this.walkTargetX = null;

      this.isDragging = false;
      this.dragOffsetX = 0;
      this.dragOffsetY = 0;
      this.prevMouseX = 0;
      this.prevMouseY = 0;

      this.blinkTimer = 200 + Math.random() * 150;
      this.isBlinking = false;

      this.hopOffset = 0;
      this.hopVelocity = 0;

      this.twitchOverrideState = null;
      this.twitchOverrideTimer = 0;
      this.climbSpeed = 1.0;

      // Token reaction override
      this.tokenReactionState = null;
      this.tokenReactionTimer = 0;
    }

    update(mouseX, mouseY) {
      // 1. Dragging physics override
      if (this.isDragging) {
        this.vx = mouseX - this.prevMouseX;
        this.vy = mouseY - this.prevMouseY;
        this.prevMouseX = mouseX;
        this.prevMouseY = mouseY;
        this.x = mouseX - this.dragOffsetX;
        this.y = mouseY - this.dragOffsetY;
        this.state = "drag";
        this.keepInBounds();
        return;
      }

      // Token reaction override
      if (this.tokenReactionTimer > 0) {
        this.tokenReactionTimer--;
        this.state = this.tokenReactionState;
        if (this.tokenReactionTimer === 0) {
          this.tokenReactionState = null;
        }
      }

      // ALARM STATE
      if (this.state === "alarm") {
        this.keepInBounds();
        this.updateAnimationFrame();
        return;
      }

      // 2. Falling / Gravity physics (Disabled for pinned widget mode)
      // 3. Wall Climbing (Disabled for pinned widget mode)

      // 4. AFK Auto-Sleep detection
      const isAFK = (mouseIdleTicks > 1800) && (Date.now() - lastKeystrokeTime > 30000);
      if (isAFK && !this.tokenReactionState) {
        if (!this.afkSleepActive) {
          this.afkSleepActive = true;
          this.state = "sleep";
        }
      } else {
        if (this.afkSleepActive) {
          this.afkSleepActive = false;
          this.state = "idle";
        }
      }

      if (this.afkSleepActive) {
        this.keepInBounds();
        this.updateAnimationFrame();
        return;
      }

      // Petting / kneading reactions
      if (!this.tokenReactionState) {
        if (pettingMeter > 8) {
          this.state = "sleep";
          if (Math.random() < 0.08) {
            spawnParticle(this.x + this.width / 2 + (Math.random() - 0.5) * 10, this.y + 10, "heart");
          }
        } else if (Date.now() - lastKeystrokeTime < 500) {
          this.state = "knead";
        } else {
          if (this.state === "knead") {
            this.state = "idle";
            this.behaviorTimer = 40 + Math.random() * 60;
          }
          // Auto behavior AI (Pinned widget: no walking, only idle/think/eat/sleep at place)
          this.behaviorTimer--;

          if (this.state === "walk") {
            this.state = "idle";
            this.walkTargetX = null;
          }

          if (this.behaviorTimer <= 0) {
            const r = Math.random();
            if (r < 0.60) {
              this.state = "idle";
              this.behaviorTimer = 120 + Math.random() * 120;
            } else if (r < 0.80) {
              this.state = "think";
              this.behaviorTimer = 180 + Math.random() * 100;
            } else if (r < 0.93) {
              this.state = "eat";
              this.behaviorTimer = 200 + Math.random() * 100;
            } else {
              this.state = "sleep";
              this.behaviorTimer = 250 + Math.random() * 150;
            }
          }
        }
      }

      // Hop animation
      if (this.hopOffset < 0 || this.hopVelocity !== 0) {
        this.hopOffset += this.hopVelocity;
        this.hopVelocity += 0.5;
        if (this.hopOffset >= 0) {
          this.hopOffset = 0;
          this.hopVelocity = 0;
        }
      }

      // Eye tracking
      let targetEyeX = 0;
      let targetEyeY = 0;
      if (mouseIdleTicks < 300) {
        const dx = mouseX - (this.x + this.width / 2);
        const dy = mouseY - (this.y + this.height * 0.3);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 10) {
          targetEyeX = (dx / dist) * 3.5;
          targetEyeY = (dy / dist) * 2.5;
        }
      }
      if (this.facing === "left") targetEyeX = -targetEyeX;
      this.eyeX += (targetEyeX - this.eyeX) * 0.15;
      this.eyeY += (targetEyeY - this.eyeY) * 0.15;

      // Blinking
      this.blinkTimer--;
      if (this.blinkTimer <= 0) {
        if (this.blinkTimer === 0) this.isBlinking = true;
        if (this.blinkTimer < -6) {
          this.isBlinking = false;
          this.blinkTimer = 200 + Math.random() * 200;
        }
      }

      // Facing direction
      if (mouseIdleTicks < 300 && this.state !== "sleep" && this.state !== "climb") {
        const dx = mouseX - (this.x + this.width / 2);
        if (Math.abs(dx) > 10) {
          this.facing = dx > 0 ? "right" : "left";
        }
      }

      // Scale animation
      const targetScale = this.state === "stretch" ? 2.5 : 1.0;
      this.scaleFactor += (targetScale - this.scaleFactor) * 0.05;

      this.keepInBounds();
      this.updateAnimationFrame();
    }

    updateAnimationFrame() {
      const animConfig = SPRITE_CONFIG.animations[this.state] || SPRITE_CONFIG.animations.idle;
      this.animTick++;
      const effectiveSpeed = Math.max(1, Math.round(animConfig.speed / petSpeedFactor));
      if (this.animTick >= effectiveSpeed) {
        this.animTick = 0;
        this.animFrameIndex = (this.animFrameIndex + 1) % animConfig.frameCount;
      }
    }

    keepInBounds() {
      if (this.x < 0) this.x = 0;
      if (this.x + this.width > screenWidth) this.x = screenWidth - this.width;
      if (this.y < 0) this.y = 0;
      if (this.y + this.height > screenHeight) this.y = screenHeight - this.height;
    }

    containsPoint(px, py) {
      return px >= this.x && px <= this.x + this.width && py >= this.y && py <= this.y + this.height;
    }

    draw(ctx) {
      ctx.save();

      // Skin filters
      if (currentSkin === "cyber") {
        ctx.filter = "hue-rotate(120deg) saturate(220%) brightness(120%)";
      } else if (currentSkin === "ghost") {
        ctx.filter = "invert(0.9) opacity(0.65) drop-shadow(0px 0px 4px rgba(56, 189, 248, 0.8))";
      } else if (currentSkin === "gold") {
        ctx.filter = "sepia(1) saturate(550%) hue-rotate(5deg) brightness(1.05) contrast(1.2)";
      } else {
        ctx.filter = "none";
      }

      let kneadAngle = 0;
      if (this.state === "knead") kneadAngle = Math.sin(Date.now() * 0.03) * 0.08;

      let stretchY = 1.0, stretchX = 1.0, wobbleAngle = 0;
      if (this.isDragging) {
        stretchY = 1.0 + Math.min(Math.abs(this.vy) * 0.04, 0.45);
        stretchX = 1.0 / stretchY;
        wobbleAngle = Math.sin(Date.now() * 0.055) * Math.min(Math.abs(this.vx) * 0.018, 0.22);
      }

      const s = this.width / 64;
      let chewBob = 0;
      if (this.state === "eat") {
        const timeInCycle = Date.now() % 3000;
        if (timeInCycle < 2250 && (timeInCycle % 300 < 150)) chewBob = 1.0 * s;
      }

      ctx.translate(this.x + this.width / 2, this.y + this.height + this.hopOffset + chewBob);

      if (this.scaleFactor !== 1.0) ctx.scale(this.scaleFactor, this.scaleFactor);

      if (this.isDragging) {
        ctx.scale(stretchX, stretchY);
        ctx.rotate(wobbleAngle);
      } else if (this.state === "knead") {
        ctx.rotate(kneadAngle);
      } else if (this.state === "alarm") {
        ctx.rotate(Math.sin(Date.now() * 0.1) * 0.15);
      } else if (pettingMeter > 8) {
        ctx.rotate(Math.sin(Date.now() * 0.05) * 0.05);
      } else if (this.state === "think") {
        const tilt = 0.08 + Math.sin(Date.now() * 0.003) * 0.03;
        ctx.rotate(this.facing === "right" ? tilt : -tilt);
      } else if (this.state === "climb") {
        const angle = this.x < screenWidth / 2 ? Math.PI / 2 : -Math.PI / 2;
        ctx.rotate(angle);
        ctx.translate(this.x < screenWidth / 2 ? -this.width * 0.4 : this.width * 0.4, 0);
      }

      ctx.translate(-this.width / 2, -this.height);

      if (isSpriteSheetLoaded && spriteSheetImage) {
        const animConfig = SPRITE_CONFIG.animations[this.state] || SPRITE_CONFIG.animations.idle;
        const row = animConfig.row;
        const col = this.animFrameIndex;

        ctx.save();
        if (this.facing === "left") {
          ctx.translate(this.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          spriteSheetImage,
          col * SPRITE_CONFIG.frameWidth,
          row * SPRITE_CONFIG.frameHeight,
          SPRITE_CONFIG.frameWidth,
          SPRITE_CONFIG.frameHeight,
          0, 0, this.width, this.height
        );
        ctx.restore();

        drawSpritesheetEyes(ctx, this, s);
      } else {
        drawFallbackPanda(ctx, 0, 0, this.width, this.height, this.state, this.facing,
          this.animFrameIndex + this.animTick, this.eyeX, this.eyeY, this.isBlinking, typingHeat);
      }

      // Blush cheeks
      const isPandaBlushing = pettingMeter > 4 || this.state === "sleep";
      if (isPandaBlushing) {
        ctx.save();
        if (this.facing === "left") { ctx.translate(this.width, 0); ctx.scale(-1, 1); }
        ctx.fillStyle = "rgba(244, 63, 94, 0.35)";
        ctx.beginPath();
        ctx.arc(23 * s, 23 * s, 4 * s, 0, Math.PI * 2);
        ctx.arc(41 * s, 23 * s, 4 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Sweat drop when typing hot
      if (typingHeat > 120) {
        ctx.save();
        if (this.facing === "left") { ctx.translate(this.width, 0); ctx.scale(-1, 1); }
        ctx.fillStyle = "#38bdf8";
        const sx = 20 * s;
        const sy = 10 * s + Math.sin(Date.now() * 0.01) * 2 * s;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx - 2 * s, sy + 4 * s, sx, sy + 4 * s);
        ctx.arc(sx, sy + 4 * s, 2 * s, 0, Math.PI);
        ctx.quadraticCurveTo(sx + 2 * s, sy + 4 * s, sx, sy);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Bamboo stick when eating
      if (this.state === "eat") {
        ctx.save();
        if (this.facing === "left") { ctx.translate(this.width, 0); ctx.scale(-1, 1); }
        const timeInCycle = Date.now() % 3000;
        const segmentsVisible = Math.max(0, 3 - Math.floor(timeInCycle / 750));
        if (segmentsVisible > 0) {
          ctx.strokeStyle = "#4ade80";
          ctx.lineWidth = 3.5 * s;
          ctx.lineCap = "round";
          const handX = 24 * s, handY = 38 * s, mouthX = 32 * s, mouthY = 26 * s;
          const dx = mouthX - handX, dy = mouthY - handY;
          ctx.beginPath();
          ctx.moveTo(handX - dx * 0.15, handY - dy * 0.15);
          const endRatio = 0.15 + 0.85 * (segmentsVisible / 3);
          ctx.lineTo(handX + dx * endRatio, handY + dy * endRatio);
          ctx.stroke();
          ctx.strokeStyle = "#16a34a";
          ctx.lineWidth = 4.5 * s;
          const len = Math.sqrt(dx * dx + dy * dy);
          for (let i = 0; i <= segmentsVisible; i++) {
            const ratio = 0.15 + 0.85 * (i / 3);
            const rx = handX + dx * ratio, ry = handY + dy * ratio;
            const px = (-dy / len) * 2 * s, py = (dx / len) * 2 * s;
            ctx.beginPath();
            ctx.moveTo(rx - px, ry - py);
            ctx.lineTo(rx + px, ry + py);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // Keyboard when typing
      const isTypingActive = Date.now() - lastKeystrokeTime < 500;
      if (this.state === "knead" && isTypingActive) {
        const bY = 0;
        let leftDown = Math.sin(Date.now() * (typingHeat > 85 ? 0.08 : 0.04)) > 0;
        let rightDown = Math.sin(Date.now() * (typingHeat > 85 ? 0.08 : 0.04) + Math.PI) > 0;

        ctx.save();
        ctx.shadowBlur = 8 * s;
        const neonHue = (Date.now() * 0.2) % 360;
        ctx.shadowColor = `hsla(${neonHue}, 80%, 60%, 0.65)`;
        ctx.fillStyle = "#1e1e2e";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(2 * s, 42 * s + bY, 60 * s, 14 * s, 3 * s);
        else ctx.fillRect(2 * s, 42 * s + bY, 60 * s, 14 * s);
        ctx.fill();
        ctx.strokeStyle = `hsla(${neonHue}, 70%, 50%, 0.8)`;
        ctx.lineWidth = 1 * s;
        ctx.stroke();
        ctx.restore();

        // Left keycap
        const key1Down = leftDown ? 1.5 * s : 0;
        ctx.save();
        ctx.shadowBlur = leftDown ? 6 * s : 0;
        ctx.shadowColor = "#38bdf8";
        ctx.fillStyle = leftDown ? "#38bdf8" : "#2e3047";
        ctx.strokeStyle = leftDown ? "#0284c7" : "#434664";
        ctx.lineWidth = 1 * s;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(6 * s, 40 * s + bY + key1Down, 22 * s, 10 * s, 2 * s);
        else ctx.fillRect(6 * s, 40 * s + bY + key1Down, 22 * s, 10 * s);
        ctx.fill(); ctx.stroke();
        ctx.restore();

        // Right keycap
        const key2Down = rightDown ? 1.5 * s : 0;
        ctx.save();
        ctx.shadowBlur = rightDown ? 6 * s : 0;
        ctx.shadowColor = "#ec4899";
        ctx.fillStyle = rightDown ? "#ec4899" : "#2e3047";
        ctx.strokeStyle = rightDown ? "#be185d" : "#434664";
        ctx.lineWidth = 1 * s;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(36 * s, 40 * s + bY + key2Down, 22 * s, 10 * s, 2 * s);
        else ctx.fillRect(36 * s, 40 * s + bY + key2Down, 22 * s, 10 * s);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }

      // Alarm rings
      if (this.state === "alarm") {
        ctx.strokeStyle = "#eab308";
        ctx.lineWidth = 2 * s;
        ctx.lineCap = "round";
        const timeOffset = Date.now() * 0.005;
        for (let i = 0; i < 3; i++) {
          const radius = 10 * s + ((timeOffset + i * 10) % 30) * s;
          const opacity = 1 - radius / (40 * s);
          ctx.globalAlpha = Math.max(0, opacity);
          ctx.beginPath();
          ctx.arc(10 * s, 20 * s, radius, Math.PI * 0.7, Math.PI * 1.3);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(54 * s, 20 * s, radius, -Math.PI * 0.3, Math.PI * 0.3);
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
      }

      ctx.restore();
    }
  }

  // ==========================================
  // SPRITESHEET EYES OVERLAY
  // ==========================================
  function drawSpritesheetEyes(ctx, pet, s) {
    if (pet.state === "sleep" || pet.state === "alarm") return;

    ctx.save();
    if (pet.facing === "left") { ctx.translate(pet.width, 0); ctx.scale(-1, 1); }

    let ox = 0, oy = 0;
    const frame = pet.animFrameIndex;
    if (pet.state === "idle") {
      oy = [0, 0, 0.5, 1, 1, 1, 0.5, 0][frame] || 0;
    } else if (pet.state === "walk" || pet.state === "knead") {
      oy = [0, 0.5, 1, 0.5, 0, -0.5, -1, -0.5][frame] || 0;
    } else if (pet.state === "run") {
      oy = [0.5, 1, 0.5, 0, 0.5, 1, 0.5, 0][frame] || 0;
      ox = [0, 0.5, 1, 0.5, 0, -0.5, -1, -0.5][frame] || 0;
    }

    const lx = (34.8 + ox) * s;
    const rx = (45.2 + ox) * s;
    const ey = (20.5 + oy) * s;

    ctx.fillStyle = "#202020";
    ctx.beginPath();
    ctx.arc(lx, ey, 2.5 * s, 0, Math.PI * 2);
    ctx.arc(rx, ey, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();

    const squint = pet.state === "knead" || pet.state === "stretch";
    ctx.fillStyle = "#ffffff";
    const eyeLookX = pet.eyeX * 0.35;
    const eyeLookY = pet.eyeY * 0.35;

    if (pet.isBlinking || squint) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2 * s;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(lx - 2 * s, ey); ctx.lineTo(lx + 2 * s, ey);
      ctx.moveTo(rx - 2 * s, ey); ctx.lineTo(rx + 2 * s, ey);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(lx + eyeLookX, ey + eyeLookY, 1.4 * s, 0, Math.PI * 2);
      ctx.arc(rx + eyeLookX, ey + eyeLookY, 1.4 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ==========================================
  // FALLBACK VECTOR RENDERER
  // ==========================================
  function drawFallbackPanda(ctx, x, y, width, height, state, facing, frame, eyeX, eyeY, isBlinking, heat) {
    ctx.save();
    if (facing === "left") { ctx.translate(x + width, y); ctx.scale(-1, 1); }
    else { ctx.translate(x, y); }

    ctx.imageSmoothingEnabled = false;
    const s = width / 64;

    let leftPawY = 0, rightPawY = 0, squint = false, bodyBounce = 0;

    if (state === "knead" && heat > 0) {
      const spd = heat > 85 ? 0.08 : 0.04;
      leftPawY = Math.sin(Date.now() * spd) * (heat > 85 ? 6 : 5) * s;
      rightPawY = Math.sin(Date.now() * spd + Math.PI) * (heat > 85 ? 6 : 5) * s;
      bodyBounce = Math.sin(Date.now() * spd) * (heat > 85 ? 2 : 1) * s;
      squint = true;
    } else if (state === "alarm") {
      bodyBounce = Math.sin(Date.now() * 0.1) * 2 * s;
      leftPawY = Math.sin(Date.now() * 0.2) * 2 * s;
      rightPawY = Math.cos(Date.now() * 0.2) * 2 * s;
    }

    if (state === "float") {
      ctx.translate(32 * s, 32 * s);
      ctx.rotate((frame * 0.05) % (Math.PI * 2));
      ctx.translate(-32 * s, -32 * s);
    }

    let breathY = state === "idle" ? Math.sin(frame * 0.15) * 1 * s : 0;
    const bY = breathY + bodyBounce;

    // Feet
    ctx.fillStyle = "#1e293b";
    if (state === "sleep") {
      ctx.fillRect(16 * s, 44 * s, 10 * s, 10 * s);
      ctx.fillRect(38 * s, 44 * s, 10 * s, 10 * s);
    } else {
      ctx.fillRect(12 * s, 46 * s, 12 * s, 10 * s);
      ctx.fillRect(40 * s, 46 * s, 12 * s, 10 * s);
    }

    // Arms
    ctx.fillStyle = "#0f172a";
    if (state === "knead") {
      ctx.fillRect(4 * s, 26 * s + leftPawY, 14 * s, 12 * s);
      ctx.fillRect(46 * s, 26 * s + rightPawY, 14 * s, 12 * s);
    } else {
      ctx.fillRect(6 * s, 28 * s + bY, 12 * s, 16 * s);
      ctx.fillRect(46 * s, 28 * s + bY, 12 * s, 16 * s);
    }

    // Body
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(14 * s, 26 * s + bY, 36 * s, 22 * s - bY);

    // Ears
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(10 * s, 4 * s + bY * 0.5, 12 * s, 12 * s);
    ctx.fillRect(42 * s, 4 * s + bY * 0.5, 12 * s, 12 * s);

    // Head
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(14 * s, 10 * s + bY * 0.5, 36 * s, 22 * s);

    // Eye patches
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(18 * s, 18 * s + bY * 0.5, 8 * s, 8 * s);
    ctx.fillRect(38 * s, 18 * s + bY * 0.5, 8 * s, 8 * s);

    // Eyes
    if (state === "float") {
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(20 * s, 20 * s + bY * 0.5); ctx.lineTo(24 * s, 24 * s + bY * 0.5);
      ctx.moveTo(24 * s, 20 * s + bY * 0.5); ctx.lineTo(20 * s, 24 * s + bY * 0.5);
      ctx.moveTo(40 * s, 20 * s + bY * 0.5); ctx.lineTo(44 * s, 24 * s + bY * 0.5);
      ctx.moveTo(44 * s, 20 * s + bY * 0.5); ctx.lineTo(40 * s, 24 * s + bY * 0.5);
      ctx.stroke();
    } else if (state === "sleep") {
      ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(19 * s, 22 * s + bY * 0.5); ctx.lineTo(25 * s, 22 * s + bY * 0.5);
      ctx.moveTo(39 * s, 22 * s + bY * 0.5); ctx.lineTo(45 * s, 22 * s + bY * 0.5);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#ffffff";
      if (isBlinking || squint) {
        ctx.fillRect(21 * s + eyeX, 20 * s + bY * 0.5 + eyeY, 3 * s, 1 * s);
        ctx.fillRect(41 * s + eyeX, 20 * s + bY * 0.5 + eyeY, 3 * s, 1 * s);
      } else {
        ctx.fillRect(21 * s + eyeX, 19 * s + bY * 0.5 + eyeY, 3 * s, 3 * s);
        ctx.fillRect(41 * s + eyeX, 19 * s + bY * 0.5 + eyeY, 3 * s, 3 * s);
      }
    }

    // Nose
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(29 * s, 23 * s + breathY * 0.5, 6 * s, 4 * s);

    // Zzz for sleep
    if (state === "sleep") {
      ctx.fillStyle = "#38bdf8";
      ctx.font = `bold ${12 * s}px sans-serif`;
      ctx.fillText("Zz", 48 * s, 6 * s - ((frame * 2) % 24) * 0.5 * s);
    }

    ctx.restore();
  }

  // ==========================================
  // BUBBLE RENDERERS
  // ==========================================
  function drawThoughtBubble(ctx, pet) {
    if (pet.state !== "think") return;
    ctx.save();
    const s = pet.width / 64;
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const symbols = ["...", "?", "💡"];
    const symbolIdx = Math.floor((Date.now() / 2000) % 3);
    const text = symbols[symbolIdx];

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.5 * s;

    ctx.beginPath();
    ctx.arc(pet.x + pet.width / 2, pet.y - 4 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.beginPath();
    ctx.arc(pet.x + pet.width / 2 + 6 * s, pet.y - 10 * s, 5 * s, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    const bubbleW = 42 * s, bubbleH = 28 * s;
    const bx = pet.x + pet.width / 2 + 10 * s - bubbleW / 2;
    const by = pet.y - bubbleH - 18 * s;

    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bubbleW, bubbleH, 8 * s);
    else ctx.fillRect(bx, by, bubbleW, bubbleH);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.fillText(text, bx + bubbleW / 2, by + bubbleH / 2);
    ctx.restore();
  }

  function drawSnoozeBubble(ctx, pet) {
    if (pet.state !== "sleep") return;
    ctx.save();
    const s = pet.width / 64;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.5 * s;

    ctx.beginPath();
    ctx.arc(pet.x + pet.width / 2 + 10 * s, pet.y - 4 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.beginPath();
    ctx.arc(pet.x + pet.width / 2 + 16 * s, pet.y - 8 * s, 3.5 * s, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    const bubbleW = 32 * s, bubbleH = 22 * s;
    const bx = pet.x + pet.width / 2 + 20 * s - bubbleW / 2;
    const by = pet.y - bubbleH - 14 * s;

    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bubbleW, bubbleH, 6 * s);
    else ctx.fillRect(bx, by, bubbleW, bubbleH);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = "#3b82f6";
    ctx.font = `bold ${11 * s}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const wobbleY = Math.sin(Date.now() * 0.003) * 1.5 * s;
    ctx.fillText("Zz", bx + bubbleW / 2, by + bubbleH / 2 + wobbleY);
    ctx.restore();
  }

  function drawSpeechBubble(ctx, pet, text) {
    if (!text) return;
    ctx.save();
    ctx.font = "bold 11px sans-serif";
    const padding = 8;
    const bubbleWidth = ctx.measureText(text).width + padding * 2;
    const bubbleHeight = 12 + padding * 2;
    const bx = pet.x + pet.width / 2 - bubbleWidth / 2;
    const by = pet.y - bubbleHeight - 12;

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bubbleWidth, bubbleHeight, 8);
    else ctx.fillRect(bx, by, bubbleWidth, bubbleHeight);
    ctx.fill(); ctx.stroke();

    // Pointer triangle
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(pet.x + pet.width / 2 - 6, by + bubbleHeight);
    ctx.lineTo(pet.x + pet.width / 2 + 6, by + bubbleHeight);
    ctx.lineTo(pet.x + pet.width / 2, by + bubbleHeight + 6);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(pet.x + pet.width / 2 - 5, by + bubbleHeight - 1);
    ctx.lineTo(pet.x + pet.width / 2 + 5, by + bubbleHeight - 1);
    ctx.lineTo(pet.x + pet.width / 2, by + bubbleHeight + 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#0f172a";
    ctx.fillText(text, bx + padding, by + padding + 9);
    ctx.restore();
  }

  // ==========================================
  // PET INSTANCE
  // ==========================================
  const pet = new DesktopPet();

  // ==========================================
  // MOUSE & INTERACTION HANDLERS
  // ==========================================
  let currentMouseX = 0, currentMouseY = 0;
  let lastWiggleDirection = 0;
  let prevMouseXGlobal = 0, prevMouseYGlobal = 0;
  const codeChars = ["{", "}", "(", ")", ";", "<", ">", "/", "+", "=", "-", "*", "&", "|", "!", "[", "]", "0", "1"];

  function updateHitArea() {
    const margin = 10;
    hitArea.style.left = (pet.x - margin) + "px";
    hitArea.style.top = (pet.y - margin) + "px";
    hitArea.style.width = (pet.width + margin * 2) + "px";
    hitArea.style.height = (pet.height + margin * 2) + "px";
  }

  document.addEventListener("mousemove", (e) => {
    currentMouseX = e.clientX;
    currentMouseY = e.clientY;
    mouseIdleTicks = 0;

    // Petting detection
    const isOverPetHead = pet.containsPoint(currentMouseX, currentMouseY) &&
      currentMouseY < pet.y + pet.height * 0.6;
    if (isOverPetHead && !pet.isDragging) {
      const dx = currentMouseX - prevMouseXGlobal;
      if (Math.abs(dx) > 3) {
        const dir = Math.sign(dx);
        if (dir !== lastWiggleDirection && lastWiggleDirection !== 0) pettingMeter += 2.0;
        lastWiggleDirection = dir;
      }
    }
    prevMouseXGlobal = currentMouseX;
    prevMouseYGlobal = currentMouseY;

    if (pet.isDragging) {
      e.preventDefault();
    }
  });

  hitArea.addEventListener("mousedown", (e) => {
    if (pet.containsPoint(e.clientX, e.clientY)) {
      pet.isDragging = true;
      pet.dragOffsetX = e.clientX - pet.x;
      pet.dragOffsetY = e.clientY - pet.y;
      pet.prevMouseX = e.clientX;
      pet.prevMouseY = e.clientY;
      e.preventDefault();
      e.stopPropagation();
    }
  });

  document.addEventListener("mouseup", () => {
    if (pet.isDragging) {
      pet.isDragging = false;
      pet.state = "idle";
      pet.anchorX = pet.x;
      pet.anchorY = pet.y;
      pet.anchorXRatio = pet.x / screenWidth;
      pet.anchorYRatio = pet.y / screenHeight;

      // Save position to chrome.storage.local settings
      chrome.storage.local.get(["settings"], (data) => {
        const settings = data.settings || {};
        settings.petPosition = {
          xRatio: pet.anchorXRatio,
          yRatio: pet.anchorYRatio
        };
        chrome.storage.local.set({ settings });
      });
    }
  });

  hitArea.addEventListener("dblclick", (e) => {
    if (pet.containsPoint(e.clientX, e.clientY)) {
      pet.hopVelocity = -8;
      e.preventDefault();
      e.stopPropagation();
    }
  });

  // Keyboard handler — captures typing in the AI chat
  document.addEventListener("keydown", (e) => {
    // Only react to actual typing keys, not modifiers
    if (e.key.length > 1 && !["Enter", "Backspace", "Delete", "Tab"].includes(e.key)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    lastKeystrokeTime = Date.now();
    typingHeat = Math.min(typingHeat + 15, 200);

    if (pet.state !== "knead" && pet.state !== "sleep" && pet.state !== "climb" && pet.state !== "drag") {
      pet.state = "knead";
      pet.vx = 0;
      pet.vy = 0;
    }

    const char = codeChars[Math.floor(Math.random() * codeChars.length)];
    spawnParticle(
      pet.x + pet.width / 2 + (Math.random() - 0.5) * 40,
      pet.y + pet.height - 15,
      "code",
      char
    );
  });

  // ==========================================
  // USAGE HUD — DOM CREATION
  // ==========================================
  function createHUD() {
    const info = PLATFORM_DISPLAY[PLATFORM];
    const hud = document.createElement("div");
    hud.id = "paendeo-hud";
    hud.innerHTML = `
      <div class="paendeo-hud-header" id="paendeo-hud-header">
        <div class="paendeo-hud-title">
          <span class="platform-icon">${info.icon}</span>
          <span>${info.name}</span>
          <span class="model-name" id="paendeo-model-name"></span>
          <span class="paendeo-hud-pill" id="paendeo-hud-pill"></span>
        </div>
        <div class="paendeo-hud-controls">
          <button class="paendeo-hud-btn" id="paendeo-hud-collapse" title="Collapse">─</button>
          <button class="paendeo-hud-btn" id="paendeo-hud-close" title="Hide">✕</button>
        </div>
      </div>
      <div class="paendeo-hud-body">
        <div class="paendeo-token-row">
          <div class="paendeo-token-label">
            <span>Conversation</span>
            <span class="value" id="paendeo-conv-tokens">0 / 128K</span>
          </div>
          <div class="paendeo-token-bar-track">
            <div class="paendeo-token-bar-fill status-green" id="paendeo-conv-bar" style="width:0%"></div>
          </div>
        </div>
        <div class="paendeo-token-row">
          <div class="paendeo-token-label">
            <span>Daily Usage</span>
            <span class="value" id="paendeo-daily-tokens">0 / 80 msgs</span>
          </div>
          <div class="paendeo-token-bar-track">
            <div class="paendeo-token-bar-fill status-green" id="paendeo-daily-bar" style="width:0%"></div>
          </div>
        </div>
        <div class="paendeo-status-line status-green" id="paendeo-status">
          <span>🟢</span>
          <span id="paendeo-status-text">Plenty of room</span>
        </div>
      </div>
    `;
    document.body.appendChild(hud);

    // Collapse toggle
    document.getElementById("paendeo-hud-collapse").addEventListener("click", () => {
      hud.classList.toggle("collapsed");
    });

    // Close/hide
    document.getElementById("paendeo-hud-close").addEventListener("click", () => {
      hud.classList.add("hidden");
    });

    // Draggable HUD header
    let hudDragging = false, hudStartX = 0, hudStartY = 0, hudLeft = 0, hudTop = 0;
    const header = document.getElementById("paendeo-hud-header");
    header.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      hudDragging = true;
      hud.classList.add("dragging");
      hudStartX = e.clientX;
      hudStartY = e.clientY;
      const rect = hud.getBoundingClientRect();
      hudLeft = rect.left;
      hudTop = rect.top;
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!hudDragging) return;
      const dx = e.clientX - hudStartX, dy = e.clientY - hudStartY;
      let newLeft = Math.max(8, Math.min(window.innerWidth - hud.offsetWidth - 8, hudLeft + dx));
      let newTop = Math.max(8, Math.min(window.innerHeight - hud.offsetHeight - 8, hudTop + dy));
      hud.style.left = newLeft + "px";
      hud.style.top = newTop + "px";
      hud.style.right = "auto";
    });
    document.addEventListener("mouseup", () => {
      if (hudDragging) {
        hudDragging = false;
        hud.classList.remove("dragging");
      }
    });
  }

  createHUD();

  function getStatusForPercent(pct) {
    if (pct >= 100) return { cls: "status-critical", icon: "⛔", text: "Limit reached!" };
    if (pct >= 90) return { cls: "status-red", icon: "🔴", text: "Almost at limit!" };
    if (pct >= 75) return { cls: "status-orange", icon: "🟠", text: "Running low!" };
    if (pct >= 50) return { cls: "status-yellow", icon: "🟡", text: "Getting warm..." };
    return { cls: "status-green", icon: "🟢", text: "Plenty of room" };
  }

  function updateHUD() {
    const convPct = platformLimits.contextWindow > 0
      ? Math.min(100, (conversationTokens / platformLimits.contextWindow) * 100)
      : 0;
    const dailyPct = platformLimits.dailyMessages > 0
      ? Math.min(100, (dailyUsage.messagesCount / platformLimits.dailyMessages) * 100)
      : 0;

    const worstPct = Math.max(convPct, dailyPct);
    const status = getStatusForPercent(worstPct);

    // Update conversation bar
    const convEl = document.getElementById("paendeo-conv-tokens");
    const convBar = document.getElementById("paendeo-conv-bar");
    if (convEl) convEl.textContent = `${formatTokens(conversationTokens)} / ${formatTokens(platformLimits.contextWindow)}`;
    if (convBar) {
      convBar.style.width = Math.min(100, convPct) + "%";
      convBar.className = "paendeo-token-bar-fill " + getStatusForPercent(convPct).cls;
    }

    // Update daily bar
    const dailyEl = document.getElementById("paendeo-daily-tokens");
    const dailyBar = document.getElementById("paendeo-daily-bar");
    if (dailyEl) dailyEl.textContent = `${dailyUsage.messagesCount} / ${platformLimits.dailyMessages} msgs`;
    if (dailyBar) {
      dailyBar.style.width = Math.min(100, dailyPct) + "%";
      dailyBar.className = "paendeo-token-bar-fill " + getStatusForPercent(dailyPct).cls;
    }

    // Update status line
    const statusLine = document.getElementById("paendeo-status");
    const statusText = document.getElementById("paendeo-status-text");
    if (statusLine) statusLine.className = "paendeo-status-line " + status.cls;
    if (statusText) statusText.textContent = status.text;

    // Update pill (collapsed view)
    const pill = document.getElementById("paendeo-hud-pill");
    if (pill) pill.textContent = `${status.icon} ${Math.round(worstPct)}%`;

    // Update model name
    const modelEl = document.getElementById("paendeo-model-name");
    if (modelEl && detectedModel) modelEl.textContent = `· ${detectedModel}`;

    // Trigger panda reactions based on usage
    triggerTokenReactions(worstPct);
  }

  function triggerTokenReactions(pct) {
    const thresholds = [
      { at: 50,  state: "think", msg: "Halfway through! 🤔", dur: 3000, timer: 90 },
      { at: 75,  state: "eat",   msg: "Getting close... 🎋", dur: 3000, timer: 120 },
      { at: 90,  state: "alarm", msg: "Running low! ⚠️", dur: 4000, timer: 150 },
      { at: 100, state: "sleep", msg: "Time to rest... 😴💤", dur: 5000, timer: 300 }
    ];

    for (const t of thresholds) {
      if (pct >= t.at && !shownThresholds.has(t.at)) {
        shownThresholds.add(t.at);
        pet.tokenReactionState = t.state;
        pet.tokenReactionTimer = t.timer;
        showGreetingBubble(t.msg, t.dur);

        if (t.state === "alarm") {
          for (let i = 0; i < 3; i++) {
            spawnParticle(pet.x + pet.width / 2 + (Math.random() - 0.5) * 20, pet.y, "steam");
          }
        }
        if (t.state === "sleep") {
          for (let i = 0; i < 5; i++) {
            spawnParticle(pet.x + pet.width / 2 + (Math.random() - 0.5) * 15, pet.y + 10, "heart");
          }
        }
        break;
      }
    }
  }

  // ==========================================
  // MESSAGE DETECTION — MUTATION OBSERVER
  // ==========================================
  const MESSAGE_SELECTORS = {
    chatgpt: {
      container: 'main',
      userMsg: '[data-message-author-role="user"]',
      aiMsg: '[data-message-author-role="assistant"]',
      modelDetect: '[class*="model"], button[aria-haspopup] span'
    },
    claude: {
      container: '[class*="conversation"], [class*="chat"], main',
      userMsg: '[data-is-streaming="false"] .font-user-message, .font-user-message, [class*="human-message"], [class*="user-message"]',
      aiMsg: '.font-claude-message, [class*="assistant-message"], [class*="ai-message"]',
      modelDetect: '[class*="model-selector"], [class*="model-name"]'
    },
    gemini: {
      container: 'main, [class*="conversation"]',
      userMsg: '[class*="user-message"], [class*="query-content"], message-content[data-role="user"]',
      aiMsg: '[class*="model-response"], [class*="response-content"], message-content[data-role="model"]',
      modelDetect: '[class*="model-selector"], [class*="model-pill"]'
    },
    grok: {
      container: 'main, [class*="conversation"]',
      userMsg: '[class*="user-message"], [class*="human"]',
      aiMsg: '[class*="grok-message"], [class*="assistant"]',
      modelDetect: '[class*="model"]'
    }
  };

  function scanConversation() {
    const selectors = MESSAGE_SELECTORS[PLATFORM];
    if (!selectors) return;

    let totalTokens = 0;
    let messageCount = 0;

    // Scan user messages
    const userMsgs = document.querySelectorAll(selectors.userMsg);
    userMsgs.forEach(el => {
      const text = el.innerText || el.textContent || "";
      totalTokens += estimateTokens(text);
      messageCount++;
    });

    // Scan AI messages
    const aiMsgs = document.querySelectorAll(selectors.aiMsg);
    aiMsgs.forEach(el => {
      const text = el.innerText || el.textContent || "";
      totalTokens += estimateTokens(text);
    });

    conversationTokens = totalTokens;
    conversationMessageCount = messageCount;

    // Detect new messages vs. last scan
    if (messageCount > lastMessageCount && lastMessageCount > 0) {
      const newMessages = messageCount - lastMessageCount;
      // Count tokens from the newest user messages
      const latestUserMsgs = Array.from(userMsgs).slice(-newMessages);
      let newTokensSent = 0;
      latestUserMsgs.forEach(el => {
        newTokensSent += estimateTokens(el.innerText || el.textContent || "");
      });

      // Report to background
      chrome.runtime.sendMessage({
        type: "INCREMENT_TOKENS",
        payload: {
          platform: PLATFORM,
          tokensSent: newTokensSent,
          tokensReceived: 0
        }
      }).catch(() => {});
    }

    lastMessageCount = messageCount;

    // Update conversation in background
    chrome.runtime.sendMessage({
      type: "UPDATE_CONVERSATION",
      payload: { platform: PLATFORM, totalTokens, messageCount }
    }).catch(() => {});

    // Detect model
    try {
      const modelEl = document.querySelector(selectors.modelDetect);
      if (modelEl) {
        const modelText = (modelEl.innerText || modelEl.textContent || "").trim();
        if (modelText && modelText.length < 40) detectedModel = modelText;
      }
    } catch (e) {}
  }

  // Set up MutationObserver to watch for new messages
  let observer = null;
  let observerDebounce = null;

  function setupObserver(container) {
    if (!container) return;

    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
      let hasRelevant = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0 || mutation.type === "characterData") {
          hasRelevant = true;
          break;
        }
      }
      if (hasRelevant) {
        // Debounce scans
        clearTimeout(observerDebounce);
        observerDebounce = setTimeout(() => {
          scanConversation();
          updateHUD();
        }, 800);
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  // Retry setup for SPAs that load content dynamically
  let setupAttempts = 0;
  let isSuccessfullySetup = false;

  function trySetup() {
    scanConversation();

    // Find the container to observe
    const selectors = MESSAGE_SELECTORS[PLATFORM];
    if (selectors) {
      let container = null;
      const containerSels = selectors.container.split(",").map(s => s.trim());
      for (const sel of containerSels) {
        container = document.querySelector(sel);
        if (container) break;
      }

      if (container) {
        setupObserver(container);
        isSuccessfullySetup = true;
      } else {
        // Fallback to body for now
        setupObserver(document.body);
      }
    }

    setupAttempts++;
    if (!isSuccessfullySetup && setupAttempts < 10) {
      setTimeout(trySetup, 2000);
    }
  }

  // ==========================================
  // LOAD SETTINGS FROM STORAGE
  // ==========================================
  async function loadSettings() {
    try {
      const data = await chrome.runtime.sendMessage({ type: "GET_USAGE", payload: {} });
      if (data?.platforms?.[PLATFORM]) {
        dailyUsage = data.platforms[PLATFORM].daily || dailyUsage;
        platformLimits = data.platforms[PLATFORM].limits || platformLimits;
      }
      if (data?.settings) {
        petEnabled = data.settings.petEnabled !== false;
        petScale = data.settings.petScale || 1.0;
        petSpeedFactor = data.settings.petSpeed || 1.0;
        currentSkin = data.settings.skin || "normal";
        showHUD = data.settings.showHUD !== false;

        // Apply scale
        pet.width = SPRITE_CONFIG.renderWidth * petScale;
        pet.height = SPRITE_CONFIG.renderHeight * petScale;

        // Apply position
        if (data.settings.petPosition) {
          pet.anchorXRatio = data.settings.petPosition.xRatio;
          pet.anchorYRatio = data.settings.petPosition.yRatio;
          pet.x = pet.anchorXRatio * screenWidth;
          pet.y = pet.anchorYRatio * screenHeight;
          pet.keepInBounds();
          pet.anchorX = pet.x;
          pet.anchorY = pet.y;
        }

        // Show/hide elements
        if (!petEnabled) {
          canvas.style.display = "none";
          hitArea.style.display = "none";
        }
        const hud = document.getElementById("paendeo-hud");
        if (hud && !showHUD) hud.classList.add("hidden");
      }
      updateHUD();
    } catch (e) {
      // Extension context might not be ready yet
    }
  }

  // Listen for storage changes (from popup)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.settings) {
      const s = changes.settings.newValue;
      if (s) {
        petEnabled = s.petEnabled !== false;
        petScale = s.petScale || 1.0;
        petSpeedFactor = s.petSpeed || 1.0;
        currentSkin = s.skin || "normal";
        showHUD = s.showHUD !== false;

        pet.width = SPRITE_CONFIG.renderWidth * petScale;
        pet.height = SPRITE_CONFIG.renderHeight * petScale;

        // Apply position
        if (s.petPosition) {
          pet.anchorXRatio = s.petPosition.xRatio;
          pet.anchorYRatio = s.petPosition.yRatio;
          pet.x = pet.anchorXRatio * screenWidth;
          pet.y = pet.anchorYRatio * screenHeight;
          pet.keepInBounds();
          pet.anchorX = pet.x;
          pet.anchorY = pet.y;
        }

        canvas.style.display = petEnabled ? "" : "none";
        hitArea.style.display = petEnabled ? "" : "none";
        const hud = document.getElementById("paendeo-hud");
        if (hud) {
          if (showHUD) hud.classList.remove("hidden");
          else hud.classList.add("hidden");
        }
      }
    }
    if (changes.platforms) {
      const p = changes.platforms.newValue;
      if (p?.[PLATFORM]) {
        dailyUsage = p[PLATFORM].daily || dailyUsage;
        platformLimits = p[PLATFORM].limits || platformLimits;
        updateHUD();
      }
    }
  });

  // ==========================================
  // GAME LOOP (30 FPS)
  // ==========================================
  let lastFrameTime = 0;
  const fps = 30;
  const frameDelay = 1000 / fps;

  function gameLoop(timestamp) {
    if (!petEnabled) {
      requestAnimationFrame(gameLoop);
      return;
    }

    if (!timestamp) timestamp = performance.now();
    const elapsed = timestamp - lastFrameTime;
    if (elapsed < frameDelay) {
      requestAnimationFrame(gameLoop);
      return;
    }
    lastFrameTime = timestamp - (elapsed % frameDelay);

    ctx.clearRect(0, 0, screenWidth, screenHeight);

    // Tick counters
    mouseIdleTicks++;
    if (pettingMeter > 0) { pettingMeter -= 0.08; if (pettingMeter < 0) pettingMeter = 0; }
    if (typingHeat > 0) { typingHeat -= 1.2; if (typingHeat < 0) typingHeat = 0; }

    // Greeting timer
    if (greetingTimer > 0) {
      greetingTimer--;
      if (greetingTimer === 0) greetingText = "";
    }

    // Steam particles when overheating
    if (typingHeat > 150 && Math.random() < 0.15) {
      spawnParticle(pet.x + pet.width / 2 + (Math.random() - 0.5) * 20, pet.y, "steam");
    }

    // Leaf particles when eating
    if (pet.state === "eat") {
      const s = pet.width / 64;
      const timeInCycle = Date.now() % 3000;
      if (timeInCycle < 2250 && Math.random() < 0.1) {
        const mouthX = isSpriteSheetLoaded
          ? (pet.facing === "right" ? pet.x + 40 * s : pet.x + 24 * s)
          : pet.x + 32 * s;
        spawnParticle(mouthX + (Math.random() - 0.5) * 8 * s, pet.y + 26 * s + pet.hopOffset, "leaf");
      }
    }

    // Update pet
    pet.update(currentMouseX, currentMouseY);

    // Draw pet
    pet.draw(ctx);

    // Overheat tint
    if (typingHeat > 130) {
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
      ctx.fillRect(0, 0, screenWidth, screenHeight);
      ctx.restore();
    }

    // Petting text override
    let displayedText = "";
    if (pettingMeter > 8) displayedText = "Purr... ❤️";

    // Bubble rendering priority: speech > thought > snooze
    if (greetingText) {
      drawSpeechBubble(ctx, pet, greetingText);
    } else if (displayedText) {
      drawSpeechBubble(ctx, pet, displayedText);
    } else if (pet.state === "think") {
      drawThoughtBubble(ctx, pet);
    } else if (pet.state === "sleep") {
      drawSnoozeBubble(ctx, pet);
    }

    // Update & draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      particles[i].draw(ctx);
      if (particles[i].life <= 0) particles.splice(i, 1);
    }

    // Update hit area position
    updateHitArea();

    requestAnimationFrame(gameLoop);
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================
  loadSettings();
  setTimeout(trySetup, 1500); // Delay to let SPA content load
  gameLoop();

  // Periodic rescan every 10 seconds for streaming responses
  setInterval(() => {
    scanConversation();
    updateHUD();
  }, 10000);

  // Periodic daily usage sync every 30 seconds
  setInterval(async () => {
    try {
      const data = await chrome.runtime.sendMessage({ type: "GET_USAGE", payload: {} });
      if (data?.platforms?.[PLATFORM]) {
        dailyUsage = data.platforms[PLATFORM].daily || dailyUsage;
        platformLimits = data.platforms[PLATFORM].limits || platformLimits;
        updateHUD();
      }
    } catch (e) {}
  }, 30000);

})();
