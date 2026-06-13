// ==========================================
// SPRITE SHEET CONFIGURATION
// Customize this to match your sprite sheet dimensions and grid layout.
// ==========================================
const SPRITE_CONFIG = {
  filePath: "../assets/panda_spritesheet_clean.png", // Reference the cleaned image
  frameWidth: 128, // 1024 / 8 columns = 128
  frameHeight: 128, // 1024 / 8 rows = 128
  renderWidth: 64, // Size lowered to 64px for a cute desktop scale
  renderHeight: 64, // Size lowered to 64px for a cute desktop scale

  // Grid coordinates for animation cycles.
  // The generated sheet is 8x8 with: 0=Idle, 1=Walk, 2=Run, 6=Float/Tumble, 7=Sleep
  animations: {
    idle: { row: 0, frameCount: 8, speed: 10 },
    walk: { row: 1, frameCount: 8, speed: 8 },
    run: { row: 2, frameCount: 8, speed: 6 },
    float: { row: 6, frameCount: 8, speed: 8 },
    sleep: { row: 7, frameCount: 8, speed: 12 },
    knead: { row: 1, frameCount: 8, speed: 4 }, // Knead cycle maps to fast walk coordinates
  },
};


// ==========================================
// INITIAL SETUP
// ==========================================
const canvas = document.getElementById("petCanvas");
const ctx = canvas.getContext("2d");

// Screen bounds (updated dynamically)
let screenWidth = window.innerWidth;
let screenHeight = window.innerHeight;

function resizeCanvas() {
  screenWidth = window.innerWidth;
  screenHeight = window.innerHeight;
  canvas.width = screenWidth;
  canvas.height = screenHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ==========================================
// SPRITE SHEET LOADER
// ==========================================
let spriteSheetImage = new Image();
let isSpriteSheetLoaded = false;

spriteSheetImage.src = SPRITE_CONFIG.filePath;
spriteSheetImage.onload = () => {
  isSpriteSheetLoaded = true;
  console.log("Cleaned sprite sheet loaded successfully.");
};

spriteSheetImage.onerror = () => {
  console.warn("Sprite sheet not found. Falling back to dynamic vectors.");
};

// ==========================================
// KEYBOARD & USER INPUT STATE
// ==========================================
let typingHeat = 0;
let mouseIdleTicks = 0;
let pettingMeter = 0;

let currentNote = "";
let currentTimerText = "";
let currentAction = "auto";

// Desktop Pet Engine configurations
let currentSkin = "normal";
let isCustomLoaded = false;
let customSpriteImage = null;
let petScale = 1.0;
let petSpeedFactor = 1.0;

// Stat tracking counters
let totalClicks = 0;
let clickTimestamps = [];
let keyTimestamps = [];


// ==========================================
// SPEECH BUBBLE & GREETINGS STATE
// ==========================================
let greetingText = "";
let greetingTimer = 0;

function showGreetingBubble(text, durationMs) {
  greetingText = text;
  greetingTimer = Math.round(durationMs / 16.7); // frame ticks approx
}

// ==========================================
// PARTICLE SYSTEM (HEARTS & STEAM)
// ==========================================
const particles = [];

class Particle {
  constructor(x, y, type, char) {
    this.x = x;
    this.y = y;
    this.type = type; // 'heart', 'steam', 'code', 'leaf', or 'water'
    this.char = char || "";
    
    if (type === "code") {
      this.vx = (Math.random() - 0.5) * 2.5;
      this.vy = -2.0 - Math.random() * 2.5;
      this.life = 40 + Math.random() * 20;
      this.size = 8 + Math.random() * 6;
    } else if (type === "leaf") {
      this.vx = (Math.random() - 0.5) * 1.5;
      this.vy = 0.4 + Math.random() * 0.8; // falls down slowly
      this.life = 50 + Math.random() * 30;
      this.size = 5 + Math.random() * 3;
    } else if (type === "water") {
      this.vx = (Math.random() - 0.5) * 3.0;
      this.vy = -1.5 - Math.random() * 2.5;
      this.life = 35 + Math.random() * 20;
      this.size = 2.5 + Math.random() * 3;
    } else {
      this.vx = (Math.random() - 0.5) * 1.5;
      this.vy =
        type === "heart"
          ? -1.2 - Math.random() * 1.2
          : -0.8 - Math.random() * 0.8;
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
      this.vy += 0.05; // slight deceleration
      this.vx *= 0.98; // horizontal drag
    } else if (this.type === "leaf") {
      // Leaf flutter effect (wind sway)
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
      ctx.font = `${this.size}px Outfit, sans-serif`;
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
      ctx.fillStyle = "#22c55e"; // Vibrant green
      ctx.strokeStyle = "#15803d"; // Dark green border
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Draw a rotated leaf shape using ellipse
      const rotationAngle = Math.PI / 4 + Math.sin(Date.now() * 0.02 + this.life) * 0.3;
      ctx.ellipse(this.x, this.y, this.size, this.size * 0.5, rotationAngle, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (this.type === "water") {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#38bdf8"; // Water blue
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

// ==========================================
// PARTICLE UTILS
// ==========================================
function spawnParticle(x, y, type, char) {
  particles.push(new Particle(x, y, type, char));
  if (particles.length > 50) {
    particles.shift();
  }
}

// ==========================================
// DESKTOP PET CLASS
// ==========================================
class DesktopPet {
  constructor() {
    this.width = SPRITE_CONFIG.renderWidth;
    this.height = SPRITE_CONFIG.renderHeight;
    this.x = screenWidth / 2 - this.width / 2;
    this.y = screenHeight - this.height - 100;
    this.vx = 0;
    this.vy = 0;
    this.eyeX = 0;
    this.eyeY = 0;
    this.scaleFactor = 1.0;

    this.anchorX = this.x;
    this.anchorY = this.y;
    this.afkSleepActive = false;

    this.state = "idle"; // 'idle', 'walk', 'run', 'float', 'sleep', 'drag', 'knead', 'stretch', 'alarm', 'climb'
    this.facing = "right"; // 'left', 'right'
    this.isAntiGravity = false;

    // Animation frame tracking
    this.animFrameIndex = 0;
    this.animTick = 0;

    // AI/Auto Behavior variables
    this.behaviorTimer = 0;
    this.walkTargetX = null;

    // Drag state variables
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.prevMouseX = 0;
    this.prevMouseY = 0;

    // Blinking & color states
    this.blinkTimer = 200 + Math.random() * 150;
    this.isBlinking = false;
    this.dvdColor = "#ec4899"; // Initial DVD color (magenta)

    // Hop animation offsets (pinned movement)
    this.hopOffset = 0;
    this.hopVelocity = 0;

    // Twitch Override and Physics variables
    this.twitchOverrideState = null;
    this.twitchOverrideTimer = 0;
    this.climbSpeed = 1.0;
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

    // ALARM STATE OVERRIDE (Wobbles in place instead of hopping)
    if (this.state === "alarm") {
      this.keepInBounds();
      this.updateAnimationFrame();
      return;
    }

    // 2. Falling / Gravity physics (if in mid-air and not climbing)
    const isFalling = this.y < (screenHeight - this.height) && this.state !== "climb";
    if (isFalling) {
      this.vy += 0.55; // Gravity
      this.vx *= 0.98; // Air resistance
      
      this.x += this.vx;
      this.y += this.vy;
      this.state = "float";

      // Bounce/Land check
      if (this.y >= screenHeight - this.height) {
        this.y = screenHeight - this.height;
        if (Math.abs(this.vy) > 3.0) {
          this.vy = -this.vy * 0.32; // Bounce back up
          this.vx *= 0.6;
          // Spawn landing impact smoke particles
          for (let i = 0; i < 4; i++) {
            spawnParticle(this.x + this.width / 2 + (Math.random() - 0.5) * 10, this.y + this.height, "steam");
          }
        } else {
          this.vy = 0;
          this.vx = 0;
          this.state = "idle";
          this.anchorX = this.x; // reset walking anchor
        }
      }

      // Wall bounce
      if (this.x <= 0) {
        this.x = 0;
        this.vx = -this.vx * 0.45;
      } else if (this.x >= screenWidth - this.width) {
        this.x = screenWidth - this.width;
        this.vx = -this.vx * 0.45;
      }

      this.updateAnimationFrame();
      return;
    }

    // 3. Wall Climbing logic
    if (this.state === "climb") {
      this.y -= this.climbSpeed;
      this.facing = this.x < screenWidth / 2 ? "left" : "right";
      
      // Check climb boundaries
      if (this.y < screenHeight * 0.35 || Math.random() < 0.007) {
        // Drop off wall!
        this.state = "float";
        this.vy = 0.5;
        this.vx = this.x < screenWidth / 2 ? 2.5 : -2.5; // kick off from wall
      }
      this.updateAnimationFrame();
      return;
    }

    // 4. Twitch Command Override
    if (this.twitchOverrideTimer > 0) {
      this.twitchOverrideTimer--;
      this.state = this.twitchOverrideState;
      if (this.twitchOverrideTimer === 0) {
        this.twitchOverrideState = null;
      }
    }

    // 5. AFK Auto-Sleep detection
    const isAFK = (mouseIdleTicks > 1800) && (Date.now() - lastKeystrokeTime > 30000);
    if (isAFK && !this.twitchOverrideState) {
      if (!this.afkSleepActive) {
        this.afkSleepActive = true;
        this.state = "sleep";
      }
    } else {
      if (this.afkSleepActive) {
        this.afkSleepActive = false;
        this.state = currentAction === "auto" ? "idle" : currentAction;
      }
    }

    if (this.afkSleepActive) {
      this.keepInBounds();
      this.updateAnimationFrame();
      return;
    }

    // React to petting/kneading (if not overridden by Twitch)
    if (!this.twitchOverrideState) {
      if (pettingMeter > 8) {
        this.state = "sleep";
        if (Math.random() < 0.08) {
          spawnParticle(
            this.x + this.width / 2 + (Math.random() - 0.5) * 10,
            this.y + 10,
            "heart"
          );
        }
      } else if (Date.now() - lastKeystrokeTime < 500) {
        this.state = "knead";
      } else {
        if (this.state === "knead") {
          this.state = currentAction === "auto" ? "idle" : currentAction;
          this.behaviorTimer = 40 + Math.random() * 60;
        }
        if (currentAction === "auto") {
          this.behaviorTimer--;
          
          if (this.state === "walk" && this.walkTargetX !== null) {
            const dx = this.walkTargetX - this.x;
            if (Math.abs(dx) > 1) {
              const speed = 0.8 * this.petSpeedFactor;
              this.x += Math.sign(dx) * speed;
              this.facing = dx > 0 ? "right" : "left";
              
              // Wall climbing trigger: if we hit a wall while walking
              if ((this.x <= 0 || this.x >= screenWidth - this.width) && Math.random() < 0.22) {
                this.state = "climb";
                this.climbSpeed = (0.6 + Math.random() * 0.7) * this.petSpeedFactor;
                this.walkTargetX = null;
              }
            } else {
              this.walkTargetX = null;
              this.state = "idle";
              this.behaviorTimer = 100 + Math.random() * 100;
            }
          }
          
          if (this.behaviorTimer <= 0) {
            const r = Math.random();
            if (r < 0.35) {
              this.state = "walk";
              const offset = (Math.random() - 0.5) * 140;
              this.walkTargetX = Math.max(0, Math.min(screenWidth - this.width, this.anchorX + offset));
              this.behaviorTimer = 150 + Math.random() * 100;
            } else if (r < 0.65) {
              this.state = "idle";
              this.behaviorTimer = 120 + Math.random() * 120;
            } else if (r < 0.80) {
              this.state = "think";
              this.behaviorTimer = 180 + Math.random() * 100;
            } else if (r < 0.95) {
              this.state = "eat";
              this.behaviorTimer = 200 + Math.random() * 100;
            } else {
              this.state = "sleep";
              this.behaviorTimer = 250 + Math.random() * 150;
            }
          }
        } else {
          this.state = currentAction;
        }
      }
    }

    // Animate hop offset (pseudo-gravity in place)
    if (this.hopOffset < 0 || this.hopVelocity !== 0) {
      this.hopOffset += this.hopVelocity;
      this.hopVelocity += 0.5;
      if (this.hopOffset >= 0) {
        this.hopOffset = 0;
        this.hopVelocity = 0;
      }
    }

    // Eye look-at tracking (target is relative to pet head center)
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

    // Flip horizontal eye offset if facing left
    if (this.facing === "left") {
      targetEyeX = -targetEyeX;
    }

    this.eyeX += (targetEyeX - this.eyeX) * 0.15;
    this.eyeY += (targetEyeY - this.eyeY) * 0.15;

    // Blinking logic
    this.blinkTimer--;
    if (this.blinkTimer <= 0) {
      if (this.blinkTimer === 0) {
        this.isBlinking = true;
      }
      if (this.blinkTimer < -6) {
        this.isBlinking = false;
        this.blinkTimer = 200 + Math.random() * 200;
      }
    }

    // Adjust facing direction based on cursor position when active
    if (mouseIdleTicks < 300 && this.state !== "sleep" && this.state !== "climb") {
      const dx = mouseX - (this.x + this.width / 2);
      if (Math.abs(dx) > 10) {
        this.facing = dx > 0 ? "right" : "left";
      }
    }

    // Scale animation (stretch timer)
    const targetScale = this.state === "stretch" ? 2.5 : 1.0;
    this.scaleFactor += (targetScale - this.scaleFactor) * 0.05;

    this.keepInBounds();
    this.updateAnimationFrame();
  }

  updateAnimationFrame() {
    const animConfig =
      SPRITE_CONFIG.animations[this.state] || SPRITE_CONFIG.animations.idle;

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
    if (this.y + this.height > screenHeight)
      this.y = screenHeight - this.height;
  }

  containsPoint(px, py) {
    return (
      px >= this.x &&
      px <= this.x + this.width &&
      py >= this.y &&
      py <= this.y + this.height
    );
  }


  draw(ctx) {
    ctx.save();

    // Skin filters based on selected skin
    if (currentSkin === "cyber") {
      ctx.filter = "hue-rotate(120deg) saturate(220%) brightness(120%)";
    } else if (currentSkin === "ghost") {
      ctx.filter = "invert(0.9) opacity(0.65) drop-shadow(0px 0px 4px rgba(56, 189, 248, 0.8))";
    } else if (currentSkin === "gold") {
      ctx.filter = "sepia(1) saturate(550%) hue-rotate(5deg) brightness(1.05) contrast(1.2)";
    } else {
      ctx.filter = "none";
    }

    // Wobble Kneading Animation
    let kneadAngle = 0;
    if (this.state === "knead") {
      kneadAngle = Math.sin(Date.now() * 0.03) * 0.08;
    }

    // Elastic Drag Scale & Wobble
    let stretchY = 1.0;
    let stretchX = 1.0;
    let wobbleAngle = 0;

    if (this.isDragging) {
      stretchY = 1.0 + Math.min(Math.abs(this.vy) * 0.04, 0.45);
      stretchX = 1.0 / stretchY;
      wobbleAngle =
        Math.sin(Date.now() * 0.055) *
        Math.min(Math.abs(this.vx) * 0.018, 0.22);
    }

    // Align rendering translation to bottom-center of pet including hopOffset and chewBob
    const s = this.width / 64;
    let chewBob = 0;
    if (this.state === "eat") {
      const timeInCycle = Date.now() % 3000;
      if (timeInCycle < 2250 && (timeInCycle % 300 < 150)) {
        chewBob = 1.0 * s;
      }
    }

    ctx.translate(this.x + this.width / 2, this.y + this.height + this.hopOffset + chewBob);

    if (this.scaleFactor !== 1.0) {
      ctx.scale(this.scaleFactor, this.scaleFactor);
    }

    if (this.isDragging) {
      ctx.scale(stretchX, stretchY);
      ctx.rotate(wobbleAngle);
    } else if (this.state === "knead") {
      ctx.rotate(kneadAngle);
    } else if (this.state === "alarm") {
      const shakeAngle = Math.sin(Date.now() * 0.1) * 0.15;
      ctx.rotate(shakeAngle);
    } else if (pettingMeter > 8) {
      const purrWiggle = Math.sin(Date.now() * 0.05) * 0.05;
      ctx.rotate(purrWiggle);
    } else if (this.state === "think") {
      const tilt = 0.08 + Math.sin(Date.now() * 0.003) * 0.03;
      ctx.rotate(this.facing === "right" ? tilt : -tilt);
    } else if (this.state === "climb") {
      const angle = this.x < screenWidth / 2 ? Math.PI / 2 : -Math.PI / 2;
      ctx.rotate(angle);
      ctx.translate(this.x < screenWidth / 2 ? -this.width * 0.4 : this.width * 0.4, 0);
    }

    ctx.translate(-this.width / 2, -this.height);

    let headTilt = 0;
    const isBlinking = this.isBlinking;

    if (isSpriteSheetLoaded && spriteSheetImage) {
      const animConfig =
        SPRITE_CONFIG.animations[this.state] || SPRITE_CONFIG.animations.idle;
      const row = animConfig.row;
      const col = this.animFrameIndex;

      let activeImage = spriteSheetImage;
      let fWidth = SPRITE_CONFIG.frameWidth;
      let fHeight = SPRITE_CONFIG.frameHeight;
      let rowVal = row;

      if (currentSkin === "custom" && isCustomLoaded && customSpriteImage) {
        activeImage = customSpriteImage;
        const cRows = parseInt(document.getElementById("custom-rows").value) || 8;
        const cCols = parseInt(document.getElementById("custom-cols").value) || 8;
        fWidth = customSpriteImage.width / cCols;
        fHeight = customSpriteImage.height / cRows;
        rowVal = Math.min(row, cRows - 1);
      }

      ctx.save();
      if (this.facing === "left") {
        ctx.translate(this.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        activeImage,
        col * fWidth,
        rowVal * fHeight,
        fWidth,
        fHeight,
        0,
        0,
        this.width,
        this.height,
      );
      ctx.restore();

      // Draw spritesheet eyes overlay so the eyes follow the cursor
      drawSpritesheetEyes(ctx, this, s);
    } else {
      // Fallback Vector Drawing
      drawFallbackPanda(
        ctx,
        0,
        0,
        this.width,
        this.height,
        this.state,
        this.facing,
        this.animFrameIndex + this.animTick,
        false,
        this.eyeX,
        this.eyeY,
        isBlinking,
        headTilt,
        typingHeat,
      );
    }

    // Draw cheeks blush overlay on standard panda if petted / sleeping
    const isPandaBlushing = pettingMeter > 4 || this.state === "sleep";
    if (isPandaBlushing) {
      ctx.save();
      if (this.facing === "left") {
        ctx.translate(this.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.fillStyle = "rgba(244, 63, 94, 0.35)"; // Soft rose blush
      ctx.beginPath();
      ctx.arc(23 * s, 23 * s, 4 * s, 0, Math.PI * 2);
      ctx.arc(41 * s, 23 * s, 4 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw overheat sweat teardrop on forehead if typing heat is high
    if (typingHeat > 120) {
      ctx.save();
      if (this.facing === "left") {
        ctx.translate(this.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.fillStyle = "#38bdf8"; // Light blue sweat drop
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

    // Draw Bamboo stick if eating
    if (this.state === "eat") {
      const s = this.width / 64;
      ctx.save();
      if (this.facing === "left") {
        ctx.translate(this.width, 0);
        ctx.scale(-1, 1);
      }
      
      const timeInCycle = Date.now() % 3000;
      const segmentsVisible = Math.max(0, 3 - Math.floor(timeInCycle / 750));
      if (segmentsVisible > 0) {
        ctx.strokeStyle = "#4ade80"; // Bright green
        ctx.lineWidth = 3.5 * s;
        ctx.lineCap = "round";
        
        // Stalk coordinates: from hand to mouth
        const handX = 24 * s;
        const handY = 38 * s;
        const mouthX = 32 * s;
        const mouthY = 26 * s;
        
        const dx = mouthX - handX;
        const dy = mouthY - handY;
        
        ctx.beginPath();
        // Start slightly below hand
        ctx.moveTo(handX - dx * 0.15, handY - dy * 0.15);
        
        // Only draw up to the active segments
        const endRatio = 0.15 + 0.85 * (segmentsVisible / 3);
        ctx.lineTo(handX + dx * endRatio, handY + dy * endRatio);
        ctx.stroke();
        
        // Draw bamboo joints (rings)
        ctx.strokeStyle = "#16a34a"; // Darker green
        ctx.lineWidth = 4.5 * s;
        for (let i = 0; i <= segmentsVisible; i++) {
          const ratio = 0.15 + 0.85 * (i / 3);
          const rx = handX + dx * ratio;
          const ry = handY + dy * ratio;
          
          // Perpendicular vector for the ring line
          const len = Math.sqrt(dx*dx + dy*dy);
          const px = (-dy / len) * 2 * s;
          const py = (dx / len) * 2 * s;
          
          ctx.beginPath();
          ctx.moveTo(rx - px, ry - py);
          ctx.lineTo(rx + px, ry + py);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Draw Universal Keyboard if typing
    const isTypingActive = Date.now() - lastKeystrokeTime < 500;
    if (this.state === "knead" && isTypingActive) {
      const s = this.width / 64;
      let bY = 0;
      if (this.state === "idle") {
        bY = Math.sin((this.animFrameIndex + this.animTick) * 0.15) * 1 * s;
      }

      let leftDown = false;
      let rightDown = false;

      if (typingHeat > 85) {
        leftDown = Math.sin(Date.now() * 0.08) > 0;
        rightDown = Math.sin(Date.now() * 0.08 + Math.PI) > 0;
      } else {
        leftDown = Math.sin(Date.now() * 0.04) > 0;
        rightDown = Math.sin(Date.now() * 0.04 + Math.PI) > 0;
      }

      // Keyboard base / chassis with RGB underglow
      ctx.save();
      ctx.shadowBlur = 8 * s;
      const neonHue = (Date.now() * 0.2) % 360;
      ctx.shadowColor = `hsla(${neonHue}, 80%, 60%, 0.65)`;
      
      ctx.fillStyle = "#1e1e2e"; // Premium dark bezel
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(2 * s, 42 * s + bY, 60 * s, 14 * s, 3 * s);
      } else {
        ctx.fillRect(2 * s, 42 * s + bY, 60 * s, 14 * s);
      }
      ctx.fill();
      
      ctx.strokeStyle = `hsla(${neonHue}, 70%, 50%, 0.8)`;
      ctx.lineWidth = 1 * s;
      ctx.stroke();
      ctx.restore();

      // Keycap 1 (Left hand)
      const key1Down = leftDown ? 1.5 * s : 0;
      ctx.save();
      ctx.shadowBlur = leftDown ? 6 * s : 0;
      ctx.shadowColor = "#38bdf8"; // cyan glow
      ctx.fillStyle = leftDown ? "#38bdf8" : "#2e3047";
      ctx.strokeStyle = leftDown ? "#0284c7" : "#434664";
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(6 * s, 40 * s + bY + key1Down, 22 * s, 10 * s, 2 * s);
      } else {
        ctx.fillRect(6 * s, 40 * s + bY + key1Down, 22 * s, 10 * s);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Keycap 2 (Right hand)
      const key2Down = rightDown ? 1.5 * s : 0;
      ctx.save();
      ctx.shadowBlur = rightDown ? 6 * s : 0;
      ctx.shadowColor = "#ec4899"; // pink glow
      ctx.fillStyle = rightDown ? "#ec4899" : "#2e3047";
      ctx.strokeStyle = rightDown ? "#be185d" : "#434664";
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(36 * s, 40 * s + bY + key2Down, 22 * s, 10 * s, 2 * s);
      } else {
        ctx.fillRect(36 * s, 40 * s + bY + key2Down, 22 * s, 10 * s);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Draw Alarm Rings
    if (this.state === "alarm") {
      const s = this.width / 64;
      ctx.strokeStyle = "#eab308"; // Yellow rings
      ctx.lineWidth = 2 * s;
      ctx.lineCap = "round";

      const timeOffset = Date.now() * 0.005;
      for (let i = 0; i < 3; i++) {
        const radius = 10 * s + ((timeOffset + i * 10) % 30) * s;
        const opacity = 1 - radius / (40 * s);
        ctx.globalAlpha = Math.max(0, opacity);

        // Left rings
        ctx.beginPath();
        ctx.arc(10 * s, 20 * s, radius, Math.PI * 0.7, Math.PI * 1.3);
        ctx.stroke();

        // Right rings
        ctx.beginPath();
        ctx.arc(54 * s, 20 * s, radius, -Math.PI * 0.3, Math.PI * 0.3);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    }

    ctx.restore();
  }
}

const pet = new DesktopPet();

// ==========================================
// SPRITESHEET EYES OVERLAY RENDERER
// ==========================================
function drawSpritesheetEyes(ctx, pet, s) {
  // If sleeping or alarm, eyes are closed or rings are active, so don't draw open eyes
  if (pet.state === "sleep" || pet.state === "alarm") return;

  ctx.save();
  if (pet.facing === "left") {
    ctx.translate(pet.width, 0);
    ctx.scale(-1, 1);
  }

  // Head bobbing offsets based on state and frame
  let ox = 0;
  let oy = 0;
  const frame = pet.animFrameIndex;

  if (pet.state === "idle") {
    // breathing bob
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

  // 1. Black out the static white eyes of the sprite sheet using the eye patch color
  ctx.fillStyle = "#202020";
  ctx.beginPath();
  ctx.arc(lx, ey, 2.5 * s, 0, Math.PI * 2);
  ctx.arc(rx, ey, 2.5 * s, 0, Math.PI * 2);
  ctx.fill();

  // 2. Draw the new white eyeball slightly offset by eyeX/eyeY
  const isBlinking = pet.isBlinking;
  const squint = pet.state === "knead" || pet.state === "stretch";

  ctx.fillStyle = "#ffffff";
  const eyeLookX = pet.eyeX * 0.35;
  const eyeLookY = pet.eyeY * 0.35;

  if (isBlinking || squint) {
    // Draw closed/squinting eyes (lines)
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.2 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lx - 2 * s, ey);
    ctx.lineTo(lx + 2 * s, ey);
    ctx.moveTo(rx - 2 * s, ey);
    ctx.lineTo(rx + 2 * s, ey);
    ctx.stroke();
  } else {
    // Draw eyeballs
    ctx.beginPath();
    ctx.arc(lx + eyeLookX, ey + eyeLookY, 1.4 * s, 0, Math.PI * 2);
    ctx.arc(rx + eyeLookX, ey + eyeLookY, 1.4 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ==========================================
// Logo Vector Renderer removed to optimize RAM

// ==========================================
// FALLBACK VECTOR RENDERER
// ==========================================
function drawFallbackPanda(
  ctx,
  x,
  y,
  width,
  height,
  state,
  facing,
  frame,
  isPlayMode = false,
  eyeX = 0,
  eyeY = 0,
  isBlinking = false,
  headTilt = 0,
  heat = 0,
) {
  ctx.save();

  if (facing === "left") {
    ctx.translate(x + width, y);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(x, y);
  }

  ctx.imageSmoothingEnabled = false;
  const s = width / 64;

  let leftPawY = 0;
  let rightPawY = 0;
  let squint = false;
  let bodyBounce = 0;

  if (state === "knead" && heat > 0) {
    if (heat > 85) {
      leftPawY = Math.sin(Date.now() * 0.08) * 6 * s;
      rightPawY = Math.sin(Date.now() * 0.08 + Math.PI) * 6 * s;
      bodyBounce = Math.sin(Date.now() * 0.08) * 2 * s;
      squint = true;
    } else {
      leftPawY = Math.sin(Date.now() * 0.04) * 5 * s;
      rightPawY = Math.sin(Date.now() * 0.04 + Math.PI) * 5 * s;
      bodyBounce = Math.sin(Date.now() * 0.04) * 1 * s;
      squint = true;
    }
  } else if (state === "stretch") {
    leftPawY = -28 * s + Math.sin(Date.now() * 0.003) * 3 * s;
    rightPawY = -28 * s + Math.sin(Date.now() * 0.003 + Math.PI) * 3 * s;
    bodyBounce = -8 * s + Math.sin(Date.now() * 0.003) * 2 * s;
    squint = true;
  } else if (state === "alarm") {
    bodyBounce = Math.sin(Date.now() * 0.1) * 2 * s;
    // Paws trembling
    leftPawY = Math.sin(Date.now() * 0.2) * 2 * s;
    rightPawY = Math.cos(Date.now() * 0.2) * 2 * s;
  }

  if (state === "float") {
    ctx.translate(32 * s, 32 * s);
    ctx.rotate((frame * 0.05) % (Math.PI * 2));
    ctx.translate(-32 * s, -32 * s);
  }

  let breathY = 0;
  if (state === "idle") {
    breathY = Math.sin(frame * 0.15) * 1 * s;
  }

  const bY = breathY + bodyBounce;

  ctx.fillStyle = "#1e293b";
  if (state === "sleep") {
    ctx.fillRect(16 * s, 44 * s, 10 * s, 10 * s);
    ctx.fillRect(38 * s, 44 * s, 10 * s, 10 * s);
  } else {
    ctx.fillRect(12 * s, 46 * s, 12 * s, 10 * s);
    ctx.fillRect(40 * s, 46 * s, 12 * s, 10 * s);
  }

  ctx.fillStyle = "#0f172a";
  if (state === "run") {
    ctx.fillRect(4 * s, 24 * s, 14 * s, 12 * s);
  } else if (state === "knead") {
    ctx.fillRect(4 * s, 26 * s + leftPawY, 14 * s, 12 * s);
  } else {
    ctx.fillRect(6 * s, 28 * s + bY, 12 * s, 16 * s);
  }

  if (state === "run") {
    ctx.fillRect(46 * s, 22 * s, 14 * s, 12 * s);
  } else if (state === "knead") {
    ctx.fillRect(46 * s, 26 * s + rightPawY, 14 * s, 12 * s);
  } else {
    ctx.fillRect(46 * s, 28 * s + bY, 12 * s, 16 * s);
  }

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(14 * s, 26 * s + bY, 36 * s, 22 * s - bY);

  ctx.fillStyle = "#1e293b";
  ctx.fillRect(10 * s, 4 * s + bY * 0.5, 12 * s, 12 * s);
  ctx.fillRect(42 * s, 4 * s + bY * 0.5, 12 * s, 12 * s);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(14 * s, 10 * s + bY * 0.5, 36 * s, 22 * s);

  ctx.fillStyle = "#1e293b";
  ctx.fillRect(18 * s, 18 * s + bY * 0.5, 8 * s, 8 * s);
  ctx.fillRect(38 * s, 18 * s + bY * 0.5, 8 * s, 8 * s);

  if (state === "float") {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(20 * s, 20 * s + bY * 0.5);
    ctx.lineTo(24 * s, 24 * s + bY * 0.5);
    ctx.moveTo(24 * s, 20 * s + bY * 0.5);
    ctx.lineTo(20 * s, 24 * s + bY * 0.5);
    ctx.moveTo(40 * s, 20 * s + bY * 0.5);
    ctx.lineTo(44 * s, 24 * s + bY * 0.5);
    ctx.moveTo(44 * s, 20 * s + bY * 0.5);
    ctx.lineTo(40 * s, 24 * s + bY * 0.5);
    ctx.stroke();
  } else if (state === "sleep") {
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(19 * s, 22 * s + bY * 0.5);
    ctx.lineTo(25 * s, 22 * s + bY * 0.5);
    ctx.moveTo(39 * s, 22 * s + bY * 0.5);
    ctx.lineTo(45 * s, 22 * s + bY * 0.5);
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

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(29 * s, 23 * s + breathY * 0.5, 6 * s, 4 * s);
  // No ribbon or logo details for standard biological panda fallback

  if (state === "sleep") {
    ctx.fillStyle = "#38bdf8";
    ctx.font = `bold ${12 * s}px Outfit, monospace`;
    ctx.fillText("Zz", 48 * s, 6 * s - ((frame * 2) % 24) * 0.5 * s);
  }

  ctx.restore();
}

// ==========================================
// THOUGHT & SNOOZE BUBBLE RENDERING SYSTEMS
// ==========================================
function drawThoughtBubble(ctx, pet) {
  if (pet.state !== "think") return;
  
  ctx.save();
  const s = pet.width / 64;
  ctx.font = "bold 14px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // Cycle symbols: ..., ?, 💡
  const symbols = ["...", "?", "💡"];
  const symbolIdx = Math.floor((Date.now() / 2000) % 3);
  const text = symbols[symbolIdx];
  
  // Connecting bubbles
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.5 * s;
  
  // Small dot
  ctx.beginPath();
  ctx.arc(pet.x + pet.width / 2, pet.y - 4 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Medium dot
  ctx.beginPath();
  ctx.arc(pet.x + pet.width / 2 + 6 * s, pet.y - 10 * s, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Main thought cloud / bubble
  const bubbleW = 42 * s;
  const bubbleH = 28 * s;
  const bx = pet.x + pet.width / 2 + 10 * s - bubbleW / 2;
  const by = pet.y - bubbleH - 18 * s;
  
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(bx, by, bubbleW, bubbleH, 8 * s);
  } else {
    ctx.fillRect(bx, by, bubbleW, bubbleH);
  }
  ctx.fill();
  ctx.stroke();
  
  // Text
  ctx.fillStyle = "#0f172a";
  ctx.fillText(text, bx + bubbleW / 2, by + bubbleH / 2);
  
  ctx.restore();
}

function drawSnoozeBubble(ctx, pet) {
  if (pet.state !== "sleep") return;
  
  ctx.save();
  const s = pet.width / 64;
  
  // Connect bubbles
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.5 * s;
  
  // Small dot
  ctx.beginPath();
  ctx.arc(pet.x + pet.width / 2 + 10 * s, pet.y - 4 * s, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Medium dot
  ctx.beginPath();
  ctx.arc(pet.x + pet.width / 2 + 16 * s, pet.y - 8 * s, 3.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Main snooze bubble
  const bubbleW = 32 * s;
  const bubbleH = 22 * s;
  const bx = pet.x + pet.width / 2 + 20 * s - bubbleW / 2;
  const by = pet.y - bubbleH - 14 * s;
  
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(bx, by, bubbleW, bubbleH, 6 * s);
  } else {
    ctx.fillRect(bx, by, bubbleW, bubbleH);
  }
  ctx.fill();
  ctx.stroke();
  
  // "Zz" text inside bubble
  ctx.fillStyle = "#3b82f6"; // Cute blue snooze color
  ctx.font = `bold ${11 * s}px Outfit, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // Slight floating wobble
  const wobbleY = Math.sin(Date.now() * 0.003) * 1.5 * s;
  ctx.fillText("Zz", bx + bubbleW / 2, by + bubbleH / 2 + wobbleY);
  
  ctx.restore();
}

// ==========================================
// SPEECH BUBBLE RENDERING SYSTEM
// ==========================================
function drawSpeechBubble(ctx, pet, noteText, timerText, greetingText) {
  // Determine if we have anything to render in the bubble
  const text = greetingText || noteText;
  if (!text && !timerText) return;

  ctx.save();
  ctx.font = "bold 11px Outfit, monospace";

  const padding = 8;
  const lineSpacing = 4;
  let bubbleWidth = 60;
  let bubbleHeight = 16;

  const hasTimer = !!timerText;
  const hasText = !!text;

  const timerWidth = hasTimer ? ctx.measureText(timerText).width + 6 : 0;
  const textWidth = hasText ? ctx.measureText(text).width : 0;

  bubbleWidth = Math.max(timerWidth, textWidth) + padding * 2;

  let lines = 0;
  if (hasTimer) lines++;
  if (hasText) lines++;

  bubbleHeight = lines * 12 + (lines - 1) * lineSpacing + padding * 2;

  const bx = pet.x + pet.width / 2 - bubbleWidth / 2;
  const by = pet.y - bubbleHeight - 12;

  // Draw bubble backing
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.roundRect(bx, by, bubbleWidth, bubbleHeight, 8);
  ctx.fill();
  ctx.stroke();

  // Pointer pointing to head
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(pet.x + pet.width / 2 - 6, by + bubbleHeight);
  ctx.lineTo(pet.x + pet.width / 2 + 6, by + bubbleHeight);
  ctx.lineTo(pet.x + pet.width / 2, by + bubbleHeight + 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cover the bottom border line of pointer
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(pet.x + pet.width / 2 - 5, by + bubbleHeight - 1);
  ctx.lineTo(pet.x + pet.width / 2 + 5, by + bubbleHeight - 1);
  ctx.lineTo(pet.x + pet.width / 2, by + bubbleHeight + 4);
  ctx.closePath();
  ctx.fill();

  // Render text inside bubble
  let currentY = by + padding + 9;

  if (hasTimer) {
    ctx.fillStyle = "#059669"; // Green timer
    ctx.fillText(timerText, bx + padding, currentY);
    currentY += 12 + lineSpacing;
  }

  if (hasText) {
    ctx.fillStyle = "#0f172a"; // Black body
    ctx.fillText(text, bx + padding, currentY);
  }

  ctx.restore();
}

// ==========================================
// MOUSE AND CLICK-THROUGH COORDINATION
// ==========================================
let currentMouseX = 0;
let currentMouseY = 0;
let lastWiggleDirection = 0;
let lastIgnoreMouseState = null;
let prevMouseX = 0;
let prevMouseY = 0;

window.addEventListener("mousemove", (e) => {
  currentMouseX = e.clientX;
  currentMouseY = e.clientY;
  mouseIdleTicks = 0;

  const isOverPet = pet.containsPoint(currentMouseX, currentMouseY);
  const isOverPanel = isMouseOverPanel(currentMouseX, currentMouseY);

  // Petting detection: horizontal wiggle on panda's head (top 60% of body)
  const isOverPetHead = isOverPet && currentMouseY < pet.y + pet.height * 0.6;
  if (isOverPetHead && !pet.isDragging) {
    const dx = currentMouseX - prevMouseX;
    if (Math.abs(dx) > 3) {
      const currentDirection = Math.sign(dx);
      if (
        currentDirection !== lastWiggleDirection &&
        lastWiggleDirection !== 0
      ) {
        pettingMeter += 2.0;
      }
      lastWiggleDirection = currentDirection;
    }
  }

  prevMouseX = currentMouseX;
  prevMouseY = currentMouseY;

  // Set ignore mouse event if mouse is not over pet or dashboard panel, and no dragging is active
  const shouldIgnore = !isOverPet && !isOverPanel && !isPanelDragging && !pet.isDragging;
  if (shouldIgnore !== lastIgnoreMouseState) {
    lastIgnoreMouseState = shouldIgnore;
    window.electronAPI.setIgnoreMouse(shouldIgnore);
  }
});

// Drag handlers
window.addEventListener("mousedown", (e) => {
  if (pet.containsPoint(e.clientX, e.clientY)) {
    pet.isDragging = true;
    pet.dragOffsetX = e.clientX - pet.x;
    pet.dragOffsetY = e.clientY - pet.y;
    pet.prevMouseX = e.clientX;
    pet.prevMouseY = e.clientY;
  }
});

window.addEventListener("mouseup", () => {
  if (pet.isDragging) {
    pet.isDragging = false;
    pet.state = "idle";
    pet.anchorX = pet.x;
    pet.anchorY = pet.y;
  }

  // Re-evaluate ignore mouse events immediately on mouse release
  const isOverPet = pet.containsPoint(currentMouseX, currentMouseY);
  const isOverPanel = isMouseOverPanel(currentMouseX, currentMouseY);
  const shouldIgnore = !isOverPet && !isOverPanel && !isPanelDragging && !pet.isDragging;
  if (shouldIgnore !== lastIgnoreMouseState) {
    lastIgnoreMouseState = shouldIgnore;
    window.electronAPI.setIgnoreMouse(shouldIgnore);
  }
});

window.addEventListener("dblclick", (e) => {
  if (pet.containsPoint(e.clientX, e.clientY)) {
    pet.hopVelocity = -8;
  }
});

// ==========================================
// SKIN SELECTION & USER STATE (Classic Panda Only)
// ==========================================
let currentUserName = "";
let lastKeystrokeTime = 0;
const codeChars = ["{", "}", "(", ")", ";", "<", ">", "/", "+", "=", "-", "*", "&", "|", "!", "[", "]", "0", "1", "a", "c", "x", "y", "z", "f", "p"];

if (window.electronAPI && window.electronAPI.onGlobalKeydown) {
  window.electronAPI.onGlobalKeydown((e) => {
    lastKeystrokeTime = Date.now();
    keyTimestamps.push(Date.now()); // Record keystroke for KPM calculation
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
}

// Track click rate
window.addEventListener("click", () => {
  totalClicks++;
  clickTimestamps.push(Date.now());
});

let activeReminder = null;
let alarmResetTimeout = null;

// ==========================================
// MERGED LOCAL DASHBOARD CONTROLLER
// ==========================================
const uiPanel = document.getElementById("ui-panel");
const minimizeBtn = document.getElementById("minimize-btn");
const closeBtn = document.getElementById("close-btn");

minimizeBtn.addEventListener("click", () => {
  uiPanel.classList.toggle("minimized");
});

if (closeBtn) {
  closeBtn.addEventListener("click", () => {
    if (window.electronAPI && window.electronAPI.closeApp) {
      window.electronAPI.closeApp();
    }
  });
}

const panelHeader = uiPanel.querySelector(".panel-header");
let isPanelDragging = false;
let panelStartX = 0;
let panelStartY = 0;
let panelStartLeft = 0;
let panelStartTop = 0;

panelHeader.addEventListener("mousedown", (e) => {
  if (e.target.closest("button") || e.target.closest("svg")) return;
  isPanelDragging = true;
  uiPanel.classList.add("dragging");
  panelStartX = e.clientX;
  panelStartY = e.clientY;
  const rect = uiPanel.getBoundingClientRect();
  panelStartLeft = rect.left;
  panelStartTop = rect.top;
  e.preventDefault();
});

window.addEventListener("mousemove", (e) => {
  if (!isPanelDragging) return;
  const dx = e.clientX - panelStartX;
  const dy = e.clientY - panelStartY;
  let newLeft = panelStartLeft + dx;
  let newTop = panelStartTop + dy;

  // Clamp within screen bounds (with 10px margins)
  newLeft = Math.max(10, Math.min(window.innerWidth - uiPanel.offsetWidth - 10, newLeft));
  newTop = Math.max(10, Math.min(window.innerHeight - uiPanel.offsetHeight - 10, newTop));

  uiPanel.style.left = `${newLeft}px`;
  uiPanel.style.top = `${newTop}px`;
  uiPanel.style.right = "auto";
});

window.addEventListener("mouseup", () => {
  if (isPanelDragging) {
    isPanelDragging = false;
    uiPanel.classList.remove("dragging");
  }
});

// UI Inputs & Controls
document.getElementById("action-select").addEventListener("change", (e) => {
  currentAction = e.target.value;
  if (currentAction !== "auto") {
    pet.state = currentAction;
  }
});

document.getElementById("name-input").addEventListener("change", (e) => {
  const name = e.target.value.trim();
  if (name) {
    showGreetingBubble(`Hello, ${name}! 🐼`, 3500);
    currentUserName = name;
  }
});

const noteInput = document.getElementById("note-input");
noteInput.addEventListener("input", (e) => {
  typingHeat = Math.min(typingHeat + 14, 100);
  if (pet.state !== "knead" && pet.state !== "sleep") {
    pet.state = "knead";
  }
  lastKeystrokeTime = Date.now();
  const nChar = codeChars[Math.floor(Math.random() * codeChars.length)];
  spawnParticle(
    pet.x + pet.width / 2 + (Math.random() - 0.5) * 40,
    pet.y + pet.height - 15,
    "code",
    nChar
  );
  currentNote = e.target.value.trim();
});

// Pomodoro Timer
let pomodoroState = "none";
let pomodoroRemaining = 0;
let pomodoroInterval = null;

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

document.getElementById("pomodoro-btn").addEventListener("click", () => {
  const btn = document.getElementById("pomodoro-btn");
  if (pomodoroState === "none") {
    pomodoroState = "focus";
    pomodoroRemaining = 25 * 60;
    btn.textContent = "Stop Focus";
    btn.classList.add("timer-running");
    
    showGreetingBubble("Focus session started! 💻", 3000);
    currentTimerText = `⏱️ Pomodoro (${formatTime(pomodoroRemaining)})`;

    pomodoroInterval = setInterval(() => {
      if (pomodoroRemaining > 0) {
        pomodoroRemaining--;
        currentTimerText = `⏱️ Pomodoro (${formatTime(pomodoroRemaining)})`;
      } else {
        clearInterval(pomodoroInterval);
        pet.hopVelocity = -8;

        if (pomodoroState === "focus") {
          pomodoroState = "break";
          pomodoroRemaining = 5 * 60;
          btn.textContent = "Stop Break";
          showGreetingBubble("Take a break! ☕ You did great.", 5000);
          currentTimerText = `⏱️ Break (${formatTime(pomodoroRemaining)})`;
          
          // Start break interval
          pomodoroInterval = setInterval(() => {
            if (pomodoroRemaining > 0) {
              pomodoroRemaining--;
              currentTimerText = `⏱️ Break (${formatTime(pomodoroRemaining)})`;
            } else {
              clearInterval(pomodoroInterval);
              pet.hopVelocity = -8;
              pomodoroState = "none";
              btn.textContent = "Start Pomodoro";
              btn.classList.remove("timer-running");
              showGreetingBubble("Break over! Let's focus again! 🚀", 5000);
              currentTimerText = "";
            }
          }, 1000);
        }
      }
    }, 1000);
  } else {
    clearInterval(pomodoroInterval);
    pomodoroState = "none";
    pomodoroRemaining = 0;
    btn.textContent = "Start Pomodoro";
    btn.classList.remove("timer-running");
    currentTimerText = "";
  }
});

// Stretch Timer
let stretchTimerState = "none";
let stretchRemaining = 0;
let stretchIntervalObj = null;

document.getElementById("stretch-timer-btn").addEventListener("click", () => {
  const btn = document.getElementById("stretch-timer-btn");
  if (stretchTimerState === "none") {
    const inputVal = parseInt(document.getElementById("stretch-input").value, 10);
    const mins = isNaN(inputVal) || inputVal < 1 ? 30 : inputVal;

    stretchTimerState = "running";
    stretchRemaining = mins * 60;
    btn.textContent = "Stop";
    btn.classList.add("timer-running");
    showGreetingBubble(`Stretch timer set for ${mins} mins! 🤸`, 3000);

    stretchIntervalObj = setInterval(() => {
      if (stretchTimerState === "running") {
        if (stretchRemaining > 0) {
          stretchRemaining--;
        } else {
          stretchTimerState = "stretching";
          showGreetingBubble("Time to stretch! 🤸 Stand up!", 8000);
          pet.state = "stretch";

          setTimeout(() => {
            if (stretchTimerState === "stretching") {
              stretchTimerState = "running";
              stretchRemaining = mins * 60;
              pet.state = "idle";
            }
          }, 8000);
        }
      }
    }, 1000);
  } else {
    stretchTimerState = "none";
    clearInterval(stretchIntervalObj);
    btn.textContent = "Start";
    btn.classList.remove("timer-running");
    pet.state = "idle";
  }
});

// Alarm Timer
document.getElementById("alarm-btn").addEventListener("click", () => {
  const btn = document.getElementById("alarm-btn");
  if (activeReminder) {
    activeReminder = null;
    btn.textContent = "Set Alarm";
    btn.classList.remove("timer-running");
    if (pet.state === "alarm") pet.state = "idle";
    clearTimeout(alarmResetTimeout);
    showGreetingBubble("Alarm cancelled. 🔕", 3000);
    return;
  }

  const timeInput = document.getElementById("alarm-time").value;
  const topicInput = document.getElementById("alarm-topic").value.trim() || "Reminder";

  if (!timeInput) {
    showGreetingBubble("Please select a time first! 🕒", 3000);
    return;
  }

  const [hours, minutes] = timeInput.split(":").map(Number);
  const now = new Date();
  let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);

  if (targetDate.getTime() <= now.getTime()) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  activeReminder = {
    topic: topicInput,
    targetMs: targetDate.getTime(),
    warningTriggered: false,
    alarmTriggered: false,
  };

  btn.textContent = "Cancel Alarm";
  btn.classList.add("timer-running");

  const formattedTime = targetDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  showGreetingBubble(`Alarm set for ${formattedTime}! ⏰`, 4000);
});

// Hydration / Water Reminder
let waterInterval = null;
let waterRemaining = 0;
let waterTimerState = "none";

document.getElementById("water-timer-btn").addEventListener("click", () => {
  const btn = document.getElementById("water-timer-btn");
  const select = document.getElementById("water-input");
  
  if (waterTimerState === "none") {
    const mins = parseInt(select.value, 10) || 30;
    waterTimerState = "running";
    waterRemaining = mins * 60;
    btn.textContent = "Stop";
    btn.classList.add("timer-running");
    showGreetingBubble(`Drink water set for ${mins} mins! 💧`, 3500);
    
    waterInterval = setInterval(() => {
      if (waterRemaining > 0) {
        waterRemaining--;
      } else {
        showGreetingBubble("💧 Hydration Time! Drink water! 💧", 10000);
        pet.twitchOverrideState = "stretch";
        pet.twitchOverrideTimer = 200;
        
        for (let i = 0; i < 25; i++) {
          spawnParticle(
            pet.x + pet.width / 2 + (Math.random() - 0.5) * 20,
            pet.y + 10,
            "water"
          );
        }
        waterRemaining = mins * 60;
      }
    }, 1000);
  } else {
    clearInterval(waterInterval);
    waterTimerState = "none";
    btn.textContent = "Start";
    btn.classList.remove("timer-running");
    showGreetingBubble("Water timer stopped. 🔕", 3000);
  }
});

// Tab Switching
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const tabName = btn.getAttribute("data-tab");
    
    tabButtons.forEach(b => b.classList.remove("active"));
    tabContents.forEach(c => c.classList.remove("active"));
    
    btn.classList.add("active");
    const activeTab = document.getElementById(`${tabName}-tab`);
    if (activeTab) activeTab.classList.add("active");
  });
});

// Mascot Settings Scale & Speed Sliders
document.getElementById("pet-scale").addEventListener("input", (e) => {
  const val = parseFloat(e.target.value);
  petScale = val;
  pet.width = SPRITE_CONFIG.renderWidth * val;
  pet.height = SPRITE_CONFIG.renderHeight * val;
  document.getElementById("scale-val").textContent = `${val.toFixed(1)}x`;
});

document.getElementById("pet-speed").addEventListener("input", (e) => {
  const val = parseFloat(e.target.value);
  petSpeedFactor = val;
  document.getElementById("speed-val").textContent = `${val.toFixed(1)}x`;
});

// Skin Selection Custom File Loader
const skinSelect = document.getElementById("skin-select");
const customSkinContainer = document.getElementById("custom-skin-container");

skinSelect.addEventListener("change", (e) => {
  currentSkin = e.target.value;
  if (currentSkin === "custom") {
    customSkinContainer.style.display = "flex";
  } else {
    customSkinContainer.style.display = "none";
  }
});

const customSkinFile = document.getElementById("custom-skin-file");
customSkinFile.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      customSpriteImage = new Image();
      customSpriteImage.onload = () => {
        isCustomLoaded = true;
        showGreetingBubble("Custom sprite sheet loaded! 🎨", 3500);
      };
      customSpriteImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
});

// Todo List Persistence
let todos = [];

function loadTodos() {
  try {
    const stored = localStorage.getItem("paendeo_todos");
    if (stored) todos = JSON.parse(stored);
  } catch (err) {
    todos = [];
  }
  renderTodos();
}

function saveTodos() {
  localStorage.setItem("paendeo_todos", JSON.stringify(todos));
}

function renderTodos() {
  const todoListContainer = document.getElementById("todo-list");
  todoListContainer.innerHTML = "";
  
  todos.forEach((todo, idx) => {
    const item = document.createElement("div");
    item.className = "todo-item";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todo-checkbox";
    checkbox.checked = todo.completed;
    checkbox.addEventListener("change", () => {
      todo.completed = checkbox.checked;
      saveTodos();
      renderTodos();
    });
    
    const textSpan = document.createElement("span");
    textSpan.textContent = todo.text;
    if (todo.completed) textSpan.className = "completed";
    
    const delBtn = document.createElement("button");
    delBtn.className = "todo-del-btn";
    delBtn.innerHTML = "&times;";
    delBtn.addEventListener("click", () => {
      todos.splice(idx, 1);
      saveTodos();
      renderTodos();
    });
    
    item.appendChild(checkbox);
    item.appendChild(textSpan);
    item.appendChild(delBtn);
    todoListContainer.appendChild(item);
  });
}

document.getElementById("todo-add-btn").addEventListener("click", () => {
  const input = document.getElementById("todo-input");
  const text = input.value.trim();
  if (text) {
    todos.push({ text, completed: false });
    saveTodos();
    renderTodos();
    input.value = "";
  }
});

document.getElementById("todo-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    document.getElementById("todo-add-btn").click();
  }
});

// Notepad Scratchpad Persistence
const scratchpad = document.getElementById("scratchpad");

function loadNotepad() {
  scratchpad.value = localStorage.getItem("paendeo_notepad") || "";
}

scratchpad.addEventListener("input", () => {
  localStorage.setItem("paendeo_notepad", scratchpad.value);
});

// Twitch IRC WS Client
let twitchSocket = null;
let isTwitchConnected = false;

function connectToTwitch(channelName) {
  if (twitchSocket) twitchSocket.close();
  
  channelName = channelName.toLowerCase().trim();
  if (!channelName) return;

  const statusEl = document.getElementById("twitch-status");
  statusEl.textContent = "Connecting...";
  statusEl.style.color = "#fbbf24";

  twitchSocket = new WebSocket("wss://irc-ws.chat.twitch.tv:443");

  twitchSocket.onopen = () => {
    twitchSocket.send("PASS oauth:987654321");
    twitchSocket.send("NICK justinfan9876");
    twitchSocket.send(`JOIN #${channelName}`);
  };

  twitchSocket.onmessage = (event) => {
    const data = event.data;
    if (data.startsWith("PING")) {
      twitchSocket.send("PONG :tmi.twitch.tv");
      return;
    }
    
    const match = data.match(/:([^!]+)![^ ]+ PRIVMSG #[^ ]+ :(.+)/);
    if (match) {
      const username = match[1];
      const message = match[2].trim();
      handleTwitchMessage(username, message);
    }
  };

  twitchSocket.onclose = () => {
    isTwitchConnected = false;
    statusEl.textContent = "Disconnected";
    statusEl.style.color = "#ef4444";
    document.getElementById("twitch-connect-btn").textContent = "Connect";
  };

  twitchSocket.onerror = (error) => {
    console.error("Twitch WS Error:", error);
    twitchSocket.close();
  };
  
  isTwitchConnected = true;
  statusEl.textContent = "Connected";
  statusEl.style.color = "#10b981";
  document.getElementById("twitch-connect-btn").textContent = "Disconnect";
  showGreetingBubble(`Joined Twitch channel #${channelName}! 📡`, 4000);
}

function handleTwitchMessage(username, message) {
  showGreetingBubble(`${username}: ${message}`, 7000);

  const cleanMsg = message.toLowerCase().trim();
  if (cleanMsg.startsWith("!")) {
    const cmd = cleanMsg.split(" ")[0];
    
    if (cmd === "!eat") {
      pet.twitchOverrideState = "eat";
      pet.twitchOverrideTimer = 180;
      showGreetingBubble(`🐼 Mascot eating bamboo for ${username}!`, 4000);
    } else if (cmd === "!sleep") {
      pet.twitchOverrideState = "sleep";
      pet.twitchOverrideTimer = 240;
      showGreetingBubble(`💤 Mascot going to sleep for ${username}...`, 4000);
    } else if (cmd === "!jump" || cmd === "!hop") {
      pet.hopVelocity = -9.5;
      showGreetingBubble(`🚀 Jump! Thanks ${username}!`, 3000);
    } else if (cmd === "!pet") {
      pettingMeter = 10;
      pet.twitchOverrideState = "sleep";
      pet.twitchOverrideTimer = 120;
      for (let i = 0; i < 6; i++) {
        spawnParticle(
          pet.x + pet.width / 2 + (Math.random() - 0.5) * 15,
          pet.y + 10,
          "heart"
        );
      }
      showGreetingBubble(`❤️ Petting mascot from ${username}!`, 4000);
    } else if (cmd === "!think") {
      pet.twitchOverrideState = "think";
      pet.twitchOverrideTimer = 150;
    }
  }
}

document.getElementById("sim-send-btn").addEventListener("click", () => {
  const username = document.getElementById("sim-user").value.trim() || "MascotFan";
  const message = document.getElementById("sim-msg").value.trim();
  if (message) {
    handleTwitchMessage(username, message);
    document.getElementById("sim-msg").value = "";
  }
});

document.getElementById("sim-msg").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    document.getElementById("sim-send-btn").click();
  }
});

document.getElementById("twitch-connect-btn").addEventListener("click", () => {
  const channelInput = document.getElementById("twitch-channel");
  const channelName = channelInput.value.trim();
  
  if (isTwitchConnected) {
    if (twitchSocket) twitchSocket.close();
  } else {
    if (!channelName) {
      showGreetingBubble("Please enter channel name! 📡", 3000);
      return;
    }
    connectToTwitch(channelName);
  }
});

// Load Todo & Scratchpad
loadTodos();
loadNotepad();

// Periodic programmatic V8 garbage collection to optimize RAM
setInterval(() => {
  if (window.gc) {
    window.gc();
  }
}, 15000);

function isMouseOverPanel(mx, my) {
  if (!uiPanel) return false;
  const rect = uiPanel.getBoundingClientRect();
  return (
    mx >= rect.left &&
    mx <= rect.right &&
    my >= rect.top &&
    my <= rect.bottom
  );
}

// ==========================================
// GAME LOOP (Capped at 30 FPS for major CPU/GPU & RAM savings)
// ==========================================
let lastFrameTime = 0;
const fps = 30;
const frameDelay = 1000 / fps;

function gameLoop(timestamp) {
  if (!timestamp) timestamp = performance.now();
  const elapsed = timestamp - lastFrameTime;
  if (elapsed < frameDelay) {
    requestAnimationFrame(gameLoop);
    return;
  }
  lastFrameTime = timestamp - (elapsed % frameDelay);
  ctx.clearRect(0, 0, screenWidth, screenHeight);

  // Ticks and timers
  mouseIdleTicks++;

  if (pettingMeter > 0) {
    pettingMeter -= 0.08;
    if (pettingMeter < 0) pettingMeter = 0;
  }

  if (typingHeat > 0) {
    typingHeat -= 1.2;
    if (typingHeat < 0) typingHeat = 0;
  }

  // Real-time Stats update
  const nowMs = Date.now();
  clickTimestamps = clickTimestamps.filter(t => nowMs - t < 60000);
  keyTimestamps = keyTimestamps.filter(t => nowMs - t < 60000);
  
  const cpm = clickTimestamps.length;
  const kpm = keyTimestamps.length;
  
  const statKpmEl = document.getElementById("stat-kpm");
  if (statKpmEl) statKpmEl.textContent = `${kpm} KPM`;
  
  const statCpmEl = document.getElementById("stat-cpm");
  if (statCpmEl) statCpmEl.textContent = `${cpm} CPM`;
  
  const statClicksEl = document.getElementById("stat-clicks");
  if (statClicksEl) statClicksEl.textContent = totalClicks;
  
  const statStateEl = document.getElementById("stat-state");
  if (statStateEl) statStateEl.textContent = pet.state;

  // 1-Minute Warning & Alarm Check
  if (activeReminder) {
    const msRemaining = activeReminder.targetMs - Date.now();
    const greeting = currentUserName ? `Hey ${currentUserName}! ` : "";

    // 1-Minute Warning Trigger
    if (
      msRemaining <= 60000 &&
      msRemaining > 0 &&
      !activeReminder.warningTriggered
    ) {
      activeReminder.warningTriggered = true;
      pet.state = "alarm";
      pet.vx = 0;
      pet.vy = 0;

      const formattedTime = new Date(
        activeReminder.targetMs,
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      showGreetingBubble(
        `⏰ ${greeting}Upcoming in 1 min: ${activeReminder.topic} (${formattedTime})`,
        10000,
      );

      alarmResetTimeout = setTimeout(() => {
        if (pet.state === "alarm") pet.state = "idle";
      }, 10000);
    }

    // Actual Alarm Trigger
    if (msRemaining <= 0 && !activeReminder.alarmTriggered) {
      activeReminder.alarmTriggered = true;
      pet.state = "alarm";
      pet.vx = 0;
      pet.vy = 0;

      clearTimeout(alarmResetTimeout);
      showGreetingBubble(
        `🚨 ${greeting}IT'S TIME FOR: ${activeReminder.topic}! 🚨`,
        15000,
      );

      alarmResetTimeout = setTimeout(() => {
        if (pet.state === "alarm") pet.state = "idle";
        const alarmBtn = document.getElementById("alarm-btn");
        if (alarmBtn) {
          alarmBtn.textContent = "Set Alarm";
          alarmBtn.classList.remove("timer-running");
        }
        activeReminder = null;
      }, 15000);
    }
  }

  if (greetingTimer > 0) {
    greetingTimer--;
    if (greetingTimer === 0) {
      greetingText = "";
    }
  }

  // Steam particle emitter for typing Overheat Mode
  if (typingHeat > 150) {
    if (Math.random() < 0.15) {
      spawnParticle(
        pet.x + pet.width / 2 + (Math.random() - 0.5) * 20,
        pet.y,
        "steam"
      );
    }
  }

  // Leaf particle emitter for eating bamboo
  if (pet.state === "eat") {
    const s = pet.width / 64;
    const timeInCycle = Date.now() % 3000;
    if (timeInCycle < 2250 && Math.random() < 0.1) {
      const mouthX = isSpriteSheetLoaded && spriteSheetImage
        ? (pet.facing === "right" ? pet.x + 40 * s : pet.x + 24 * s)
        : pet.x + 32 * s;
      const leafX = mouthX + (Math.random() - 0.5) * 8 * s;
      const leafY = pet.y + 26 * s + pet.hopOffset;
      spawnParticle(leafX, leafY, "leaf");
    }
  }

  // Update pet state & coordinates
  pet.update(currentMouseX, currentMouseY);

  // Draw the pet directly
  pet.draw(ctx);

  // Fast Overheat Tint
  if (typingHeat > 130) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
    ctx.fillRect(0, 0, screenWidth, screenHeight);
    ctx.restore();
  }

  // Override: show petting feedback
  let displayedText = currentNote;
  if (pettingMeter > 8) {
    displayedText = "Purr... ❤️";
  }

  const hasSpeech = !!greetingText || !!currentNote || !!currentTimerText || pettingMeter > 8;
  if (hasSpeech) {
    drawSpeechBubble(ctx, pet, displayedText, currentTimerText, greetingText);
  } else if (pet.state === "think") {
    drawThoughtBubble(ctx, pet);
  } else if (pet.state === "sleep") {
    drawSnoozeBubble(ctx, pet);
  }

  // Update & Draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].draw(ctx);
    if (particles[i].life <= 0) {
      particles.splice(i, 1);
    }
  }

  requestAnimationFrame(gameLoop);
}

// Start Game Loop
gameLoop();
