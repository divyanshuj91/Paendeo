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
// PHYSICS CONSTANTS
// ==========================================
const GRAVITY = 0.45;
const BOUNCE_ELASTICITY = -0.55; // Floor bouncing
const AIR_RESISTANCE = 0.99;
const FLOOR_FRICTION = 0.9;
const ANTIGRAVITY_FLOAT_SPEED = 2.5;

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
const keysPressed = {};
let typingHeat = 0;
let mouseIdleTicks = 0;
let pettingMeter = 0;

let currentNote = "";
let currentTimerText = "";
let currentAction = "auto";

window.addEventListener("keydown", (e) => {
  keysPressed[e.key.toLowerCase()] = true;

  // Up/W makes the panda jump if on the floor
  if ((e.key === "ArrowUp" || e.key === "w") && !pet.isDragging) {
    const floorY = screenHeight - pet.height;
    const isOnFloor = Math.abs(pet.y - floorY) < 1;
    if (isOnFloor && !pet.isAntiGravity) {
      pet.vy = -10; // Jump
      pet.state = "run";
    }
  }
});

window.addEventListener("keyup", (e) => {
  keysPressed[e.key.toLowerCase()] = false;
});

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
    this.type = type; // 'heart', 'steam', or 'code'
    this.char = char || "";
    this.vx = type === "code" ? (Math.random() - 0.5) * 2.5 : (Math.random() - 0.5) * 1.5;
    this.vy =
      type === "code"
        ? -2.0 - Math.random() * 2.5
        : (type === "heart"
          ? -1.2 - Math.random() * 1.2
          : -0.8 - Math.random() * 0.8);
    this.life = type === "code" ? 40 + Math.random() * 20 : 60 + Math.random() * 40;
    this.maxLife = this.life;
    this.size =
      type === "code"
        ? 8 + Math.random() * 6
        : (type === "heart" ? 12 : 3 + Math.random() * 4);
    
    const colors = ["#818cf8", "#6366f1", "#4f46e5", "#38bdf8", "#06b6d4", "#a78bfa", "#f43f5e", "#10b981"];
    this.color = colors[Math.floor(Math.random() * colors.length)];
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.type === "code") {
      this.vy += 0.05; // slight deceleration
      this.vx *= 0.98; // horizontal drag
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

    this.state = "idle"; // 'idle', 'walk', 'run', 'float', 'sleep', 'drag', 'knead', 'stretch', 'alarm'
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
  }

  update(mouseX, mouseY) {
    // 1. Dragging physics override (Mochi Stretch)
    if (this.isDragging) {
      this.x = mouseX - this.dragOffsetX;
      this.y = mouseY - this.dragOffsetY;

      this.vx = mouseX - this.prevMouseX;
      this.vy = mouseY - this.prevMouseY;

      this.prevMouseX = mouseX;
      this.prevMouseY = mouseY;

      this.state = "drag";
      this.keepInBounds();
      return;
    }

    const floorY = screenHeight - this.height;
    const isOnFloor = Math.abs(this.y - floorY) < 1;

    // ALARM STATE OVERRIDE (Jumping Alarm Clock)
    if (this.state === "alarm") {
      if (isOnFloor) {
        this.vy = -6; // Hop up and down!
      }
      this.vy += GRAVITY;
      this.y += this.vy;

      if (this.y >= floorY) {
        this.y = floorY;
        this.vy = 0;
      }
      this.keepInBounds();
      this.updateAnimationFrame();
      return;
    }

    // 2. Keyboard Control Mode
    let hasKeyInput = false;
    const isLeft = keysPressed["arrowleft"] || keysPressed["a"];
    const isRight = keysPressed["arrowright"] || keysPressed["d"];
    const isDown = keysPressed["arrowdown"] || keysPressed["s"];

    if (isLeft) {
      this.vx = this.isAntiGravity ? -ANTIGRAVITY_FLOAT_SPEED : -2.0;
      this.state = this.isAntiGravity ? "float" : "run";
      this.facing = "left";
      hasKeyInput = true;
    } else if (isRight) {
      this.vx = this.isAntiGravity ? ANTIGRAVITY_FLOAT_SPEED : 2.0;
      this.state = this.isAntiGravity ? "float" : "run";
      this.facing = "right";
      hasKeyInput = true;
    } else {
      // Decelerate if no movement keys are held
      if (!this.isAntiGravity) {
        this.vx *= FLOOR_FRICTION;
      }
    }

    if (isDown && !hasKeyInput && !this.isAntiGravity && isOnFloor) {
      this.vx = 0;
      this.state = "sleep";
      hasKeyInput = true;
    }

    // Apply movement according to keyboard or physics
    if (hasKeyInput) {
      if (this.isAntiGravity) {
        this.x += this.vx;
        this.y += this.vy;
      } else {
        this.vy += GRAVITY;
        this.x += this.vx;
        this.y += this.vy;
      }
    } else {
      // 3. Mouse chasing / Purring / Kneading / Auto behavior
      const isAutoBehavior = currentAction === "auto";

      if (this.isAntiGravity) {
        // Float mode: DVD Logo Bouncing
        this.x += this.vx;
        this.y += this.vy;
        this.state = "float";

        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (currentSpeed < 1.0) {
          this.vx = (Math.random() > 0.5 ? 1 : -1) * ANTIGRAVITY_FLOAT_SPEED;
          this.vy = (Math.random() > 0.5 ? 1 : -1) * ANTIGRAVITY_FLOAT_SPEED;
        } else if (currentSpeed > ANTIGRAVITY_FLOAT_SPEED) {
          // Slowly dampen velocity back to float speed if thrown
          this.vx *= 0.98;
          this.vy *= 0.98;
        }
      } else {
        // Gravity mode
        this.vy += GRAVITY;
        if (!isOnFloor) {
          this.vx *= AIR_RESISTANCE;
        }
        this.x += this.vx;
        this.y += this.vy;

        if (isOnFloor) {
          if (pettingMeter > 8) {
            // PETTING / PURRING: Happy purr state (Feature 5)
            this.state = "sleep";
            this.vx = 0;
            this.vy = 0;
            if (Math.random() < 0.08) {
              particles.push(
                new Particle(
                  this.x + this.width / 2 + (Math.random() - 0.5) * 10,
                  this.y + 10,
                  "heart",
                ),
              );
            }
          } else if (Date.now() - lastKeystrokeTime < 300) {
            // TYPING / KNEADING Mode (Feature 6 & 7)
            this.state = "knead";
            this.vx = 0;
            this.vy = 0;
          } else if (isAutoBehavior) {
            if (this.state === "knead") {
              this.state = "idle";
              this.behaviorTimer = 120;
            }
            // Cursor Chase (Feature 2 & 4)
            const isMouseClose =
              Math.abs(mouseX - (this.x + this.width / 2)) < 850;
            const isMouseActive = mouseIdleTicks < 180; // Cursor moved in last 3s

            if (isMouseActive && isMouseClose) {
              const dx = mouseX - (this.x + this.width / 2);
              if (Math.abs(dx) > 24) {
                this.facing = dx > 0 ? "right" : "left";
                // Mouse Hunt (Feature 4): sprint if cursor is far, walk if close
                if (Math.abs(dx) > 180) {
                  this.state = "run";
                  this.vx = Math.sign(dx) * 2.2;
                } else {
                  this.state = "walk";
                  this.vx = Math.sign(dx) * 1.2;
                }
                this.walkTargetX = null;
              } else {
                // Reached the mouse
                this.vx = 0;
                this.state = "idle";
              }
            } else {
              // Default autonomous pacing
              this.handleAutoBehavior();
            }
          } else {
            // Manual dropdown state override
            this.state = currentAction;
            if (this.state === "walk" || this.state === "run") {
              if (Math.abs(this.vx) < 0.2) {
                this.vx =
                  (this.facing === "right" ? 1 : -1) *
                  (this.state === "run" ? 2.2 : 1.2);
              }
            } else {
              this.vx = 0;
            }
          }
        }
      }
    }

    // 4. Bouncing off screen bounds
    if (this.isAntiGravity) {
      let bounced = false;
      if (this.x <= 0) {
        this.x = 0;
        this.vx = -this.vx;
        this.facing = "right";
        bounced = true;
      } else if (this.x + this.width >= screenWidth) {
        this.x = screenWidth - this.width;
        this.vx = -this.vx;
        this.facing = "left";
        bounced = true;
      }

      if (this.y <= 0) {
        this.y = 0;
        this.vy = -this.vy;
        bounced = true;
      } else if (this.y + this.height >= screenHeight) {
        this.y = screenHeight - this.height;
        this.vy = -this.vy;
        bounced = true;
      }

      if (bounced) {
        this.onBounce();
      }
    } else {
      if (this.y >= floorY) {
        this.y = floorY;
        this.vy = this.vy * BOUNCE_ELASTICITY;
        if (Math.abs(this.vy) < 0.4) {
          this.vy = 0;
        }
        this.vx *= FLOOR_FRICTION;
      }

      let bounced = false;
      if (this.x <= 0) {
        this.x = 0;
        this.vx = -this.vx * 0.4;
        bounced = true;
      } else if (this.x + this.width >= screenWidth) {
        this.x = screenWidth - this.width;
        this.vx = -this.vx * 0.4;
        bounced = true;
      }

      if (this.y <= 0) {
        this.y = 0;
        this.vy = -this.vy * 0.4;
        bounced = true;
      }

      if (bounced) {
        this.onBounce();
      }
    }

    // Adjust look vector
    if (Math.abs(this.vx) > 0.15 && !this.isDragging && !hasKeyInput) {
      this.facing = this.vx > 0 ? "right" : "left";
    }

    // Scale animation
    const targetScale = this.state === "stretch" ? 2.5 : 1.0;
    this.scaleFactor += (targetScale - this.scaleFactor) * 0.05;

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

    this.keepInBounds();
    this.updateAnimationFrame();
  }

  handleAutoBehavior() {
    this.behaviorTimer--;

    if (this.behaviorTimer <= 0) {
      const rand = Math.random();
      if (rand < 0.35) {
        this.state = "idle";
        this.vx = 0;
        this.walkTargetX = null;
        this.behaviorTimer = 120 + Math.random() * 180;
      } else if (rand < 0.7) {
        this.state = "walk";
        this.walkTargetX = Math.random() * (screenWidth - this.width);
        this.behaviorTimer = 300;
      } else if (rand < 0.85) {
        this.state = "run";
        this.walkTargetX = Math.random() * (screenWidth - this.width);
        this.behaviorTimer = 200;
      } else {
        this.state = "sleep";
        this.vx = 0;
        this.walkTargetX = null;
        this.behaviorTimer = 240 + Math.random() * 300;
      }
    }

    if (this.walkTargetX !== null) {
      const dist = this.walkTargetX - this.x;
      const direction = Math.sign(dist);
      const speed = this.state === "run" ? 2.2 : 1.2;

      this.vx = direction * speed;

      if (Math.abs(dist) < 5) {
        this.vx = 0;
        this.walkTargetX = null;
        this.state = "idle";
        this.behaviorTimer = 60 + Math.random() * 60;
      }
    }
  }

  updateAnimationFrame() {
    const animConfig =
      SPRITE_CONFIG.animations[this.state] || SPRITE_CONFIG.animations.idle;

    this.animTick++;
    if (this.animTick >= animConfig.speed) {
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

  toggleAntiGravity() {
    this.isAntiGravity = !this.isAntiGravity;

    if (this.isAntiGravity) {
      this.vx = (Math.random() > 0.5 ? 1 : -1) * ANTIGRAVITY_FLOAT_SPEED;
      this.vy = (Math.random() > 0.5 ? -0.8 : -1.5) * ANTIGRAVITY_FLOAT_SPEED;
      this.state = "float";
    } else {
      this.vx = 0;
      this.vy = 0;
      this.state = "idle";
    }

    if (window.electronAPI && window.electronAPI.sendDashboardUpdate) {
      window.electronAPI.sendDashboardUpdate({
        type: "gravity-toggled",
        value: this.isAntiGravity,
      });
    }
  }

  onBounce() {
    if (currentSkin === "logo-dvd") {
      const colors = [
        "#ec4899", // Pink
        "#3b82f6", // Blue
        "#10b981", // Green
        "#f59e0b", // Amber/Yellow
        "#8b5cf6", // Purple
        "#ef4444", // Red
        "#06b6d4", // Cyan
      ];
      let nextColor = colors[Math.floor(Math.random() * colors.length)];
      while (nextColor === this.dvdColor) {
        nextColor = colors[Math.floor(Math.random() * colors.length)];
      }
      this.dvdColor = nextColor;
    }
  }

  draw(ctx, skinFilter) {
    ctx.save();

    ctx.filter = currentSkin.startsWith("logo-") ? "none" : (skinFilter || "none");

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

    // Align rendering translation to bottom-center of pet
    ctx.translate(this.x + this.width / 2, this.y + this.height);

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
    }

    ctx.translate(-this.width / 2, -this.height);

    let headTilt = 0;
    const isBlinking = this.isBlinking;

    if (currentSkin.startsWith("logo-")) {
      const s = this.width / 64;
      drawLogo(ctx, currentSkin, this, s);
    } else {
      const s = this.width / 64;
      if (isSpriteSheetLoaded && spriteSheetImage) {
        const animConfig =
          SPRITE_CONFIG.animations[this.state] || SPRITE_CONFIG.animations.idle;
        const row = animConfig.row;
        const col = this.animFrameIndex;

        const sx = col * SPRITE_CONFIG.frameWidth;
        const sy = row * SPRITE_CONFIG.frameHeight;

        ctx.save();
        if (this.facing === "left") {
          ctx.translate(this.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          spriteSheetImage,
          sx,
          sy,
          SPRITE_CONFIG.frameWidth,
          SPRITE_CONFIG.frameHeight,
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
    }

    // Draw Universal Keyboard if typing
    const isTypingActive = Date.now() - lastKeystrokeTime < 300;
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
  if (pet.state === "sleep" || pet.state === "alarm" || pet.state === "float") return;

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
// LOGO VECTOR RENDERER
// ==========================================
function drawLogo(ctx, logoStyle, pet, s) {
  ctx.save();
  const w = pet.width;
  const h = pet.height;
  
  if (pet.state === "float") {
    ctx.translate(w / 2, h / 2);
    ctx.rotate((Date.now() * 0.003) % (Math.PI * 2));
    ctx.translate(-w / 2, -h / 2);
  }
  
  // Base Glow effect (Rich Aesthetics)
  ctx.shadowBlur = 10 * s;
  
  if (logoStyle === "logo-dvd") {
    ctx.fillStyle = pet.dvdColor;
    ctx.shadowColor = pet.dvdColor;
    
    // Draw DVD pill background (oval ellipse)
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2 + 10 * s, 25 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.strokeStyle = pet.dvdColor;
    ctx.lineWidth = 1.8 * s;
    ctx.stroke();
    
    // Draw "DVD" text
    ctx.font = `italic bold ${16 * s}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("DVD", w / 2, h / 2 - 4 * s);
    
    // Draw "VIDEO" text inside the pill
    ctx.font = `bold ${5 * s}px Arial, sans-serif`;
    ctx.fillText("VIDEO", w / 2, h / 2 + 10 * s);
    
  } else if (logoStyle === "logo-gemini") {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#38bdf8"); // Sky blue
    grad.addColorStop(0.3, "#818cf8"); // Indigo
    grad.addColorStop(0.7, "#ec4899"); // Pink
    grad.addColorStop(1, "#f59e0b"); // Amber
    
    ctx.fillStyle = grad;
    ctx.shadowColor = "rgba(236, 72, 153, 0.6)";
    
    // Draw 4-pointed sparkle
    const cx = w / 2;
    const cy = h / 2;
    const size = 22 * s;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.quadraticCurveTo(cx, cy, cx + size, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + size);
    ctx.quadraticCurveTo(cx, cy, cx - size, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - size);
    ctx.closePath();
    ctx.fill();
    
    // Draw a smaller secondary sparkle
    ctx.fillStyle = "#ffffff";
    const scx = cx + 12 * s;
    const scy = cy - 12 * s;
    const ssize = 8 * s;
    ctx.beginPath();
    ctx.moveTo(scx, scy - ssize);
    ctx.quadraticCurveTo(scx, scy, scx + ssize, scy);
    ctx.quadraticCurveTo(scx, scy, scx, scy + ssize);
    ctx.quadraticCurveTo(scx, scy, scx - ssize, scy);
    ctx.quadraticCurveTo(scx, scy, scx, scy - ssize);
    ctx.closePath();
    ctx.fill();
    
  } else if (logoStyle === "logo-electron") {
    const cx = w / 2;
    const cy = h / 2;
    
    // Central Nucleus
    ctx.fillStyle = "#61dafb"; // Electron cyan
    ctx.shadowColor = "#61dafb";
    ctx.beginPath();
    ctx.arc(cx, cy, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    
    // 3 Orbit Ellipses
    ctx.strokeStyle = "rgba(97, 218, 251, 0.45)";
    ctx.lineWidth = 1 * s;
    
    const orbits = [0, Math.PI / 3, -Math.PI / 3];
    // Orbit faster if petted or typing
    const speedMultiplier = pet.state === "knead" ? 0.015 : (pettingMeter > 4 ? 0.008 : 0.003);
    const orbitTime = Date.now() * speedMultiplier;
    
    orbits.forEach((angle, idx) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      
      // Draw ellipse path
      ctx.beginPath();
      ctx.ellipse(0, 0, 24 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw orbiting electron dot
      const eTime = orbitTime + idx * (Math.PI * 2 / 3);
      const ex = 24 * s * Math.cos(eTime);
      const ey = 8 * s * Math.sin(eTime);
      
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#ffffff";
      ctx.beginPath();
      ctx.arc(ex, ey, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
    
  } else if (logoStyle === "logo-paendeo") {
    const cx = w / 2;
    const cy = h / 2;
    
    ctx.shadowColor = "rgba(165, 180, 252, 0.4)";
    
    // Ears
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(cx - 15 * s, cy - 12 * s, 7 * s, 0, Math.PI * 2);
    ctx.arc(cx + 15 * s, cy - 12 * s, 7 * s, 0, Math.PI * 2);
    ctx.fill();
    
    // Face badge
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy, 18 * s, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    
    // Eye Patches
    ctx.fillStyle = "#1e293b";
    ctx.save();
    ctx.translate(cx - 7 * s, cy - 1 * s);
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.ellipse(0, 0, 5 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    ctx.save();
    ctx.translate(cx + 7 * s, cy - 1 * s);
    ctx.rotate(-Math.PI / 6);
    ctx.beginPath();
    ctx.ellipse(0, 0, 5 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // Eyes
    ctx.fillStyle = "#ffffff";
    const isBlushing = pettingMeter > 4 || pet.state === "sleep";
    
    if (isBlushing) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2 * s;
      ctx.lineCap = "round";
      
      ctx.beginPath();
      ctx.arc(cx - 7 * s, cy, 2 * s, Math.PI, 0);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(cx + 7 * s, cy, 2 * s, Math.PI, 0);
      ctx.stroke();
    } else {
      const eyeLookX = (pet.eyeX || 0) * 0.2;
      const eyeLookY = (pet.eyeY || 0) * 0.2;
      ctx.beginPath();
      ctx.arc(cx - 7 * s + eyeLookX, cy - 1 * s + eyeLookY, 1.2 * s, 0, Math.PI * 2);
      ctx.arc(cx + 7 * s + eyeLookX, cy - 1 * s + eyeLookY, 1.2 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Nose
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(cx, cy + 4 * s, 1.8 * s, 0, Math.PI * 2);
    ctx.fill();
    
    // Blush
    if (isBlushing) {
      ctx.fillStyle = "rgba(244, 63, 94, 0.4)";
      ctx.beginPath();
      ctx.arc(cx - 11 * s, cy + 5 * s, 3 * s, 0, Math.PI * 2);
      ctx.arc(cx + 11 * s, cy + 5 * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
}

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
// SPEECH BUBBLE RENDERING SYSTEM (Feature 12, 13, 14, 15)
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

window.addEventListener("mousemove", (e) => {
  currentMouseX = e.clientX;
  currentMouseY = e.clientY;
  mouseIdleTicks = 0; // Reset mouse idle timer on movement

  const isOverPet = pet.containsPoint(currentMouseX, currentMouseY);

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
        pettingMeter += 2.0; // Petting action wiggled
      }
      lastWiggleDirection = currentDirection;
    }
  }

  prevMouseX = currentMouseX;
  prevMouseY = currentMouseY;

  // Throttle / Deduplicate IPC messages to setIgnoreMouse
  const shouldIgnore = !isOverPet;
  if (shouldIgnore !== lastIgnoreMouseState) {
    lastIgnoreMouseState = shouldIgnore;
    window.electronAPI.setIgnoreMouse(shouldIgnore);
  }
});

let prevMouseX = 0;
let prevMouseY = 0;

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
    pet.state = pet.isAntiGravity ? "float" : "idle";
    // Clamp throw velocity to avoid extreme speeds
    const maxThrowSpeed = 25;
    pet.vx = Math.max(-maxThrowSpeed, Math.min(pet.vx, maxThrowSpeed));
    pet.vy = Math.max(-maxThrowSpeed, Math.min(pet.vy, maxThrowSpeed));
  }
});

window.addEventListener("dblclick", (e) => {
  if (pet.containsPoint(e.clientX, e.clientY)) {
    pet.toggleAntiGravity();
  }
});

// ==========================================
// SKIN SELECTION BINDINGS & COLOR MAP
// ==========================================
let currentSkin = "classic";
let currentUserName = "";
let lastKeystrokeTime = 0;
const codeChars = ["{", "}", "(", ")", ";", "<", ">", "/", "+", "=", "-", "*", "&", "|", "!", "[", "]", "0", "1", "a", "c", "x", "y", "z", "f", "p"];

if (window.electronAPI && window.electronAPI.onGlobalKeydown) {
  window.electronAPI.onGlobalKeydown((e) => {
    lastKeystrokeTime = Date.now();
    typingHeat = Math.min(typingHeat + 15, 200);
    if (pet.state !== "knead" && pet.state !== "sleep") {
      pet.state = "knead";
      pet.vx = 0;
      pet.vy = 0;
    }
    // Spawn code character particle
    const char = codeChars[Math.floor(Math.random() * codeChars.length)];
    particles.push(
      new Particle(
        pet.x + pet.width / 2 + (Math.random() - 0.5) * 40,
        pet.y + pet.height - 15,
        "code",
        char
      )
    );
  });
}

let activeReminder = null; // { topic: string, targetMs: number, warningTriggered: boolean, alarmTriggered: boolean }
let alarmResetTimeout = null;

if (window.electronAPI && window.electronAPI.onPetControl) {
  window.electronAPI.onPetControl((data) => {
    switch (data.type) {
      case "toggle-gravity":
        pet.isAntiGravity = data.value;
        if (pet.isAntiGravity) {
          pet.vx = (Math.random() > 0.5 ? 1 : -1) * ANTIGRAVITY_FLOAT_SPEED;
          pet.vy =
            (Math.random() > 0.5 ? -0.8 : -1.5) * ANTIGRAVITY_FLOAT_SPEED;
          pet.state = "float";
        } else {
          pet.vx = 0;
          pet.vy = 0;
          pet.state = "idle";
        }
        break;
      case "set-action":
        currentAction = data.value;
        if (currentAction !== "auto") {
          pet.state = currentAction;
          if (
            currentAction === "idle" ||
            currentAction === "sleep" ||
            currentAction === "stretch"
          ) {
            pet.vx = 0;
            pet.vy = 0;
          }
        }
        break;
      case "set-skin":
        currentSkin = data.value;
        break;
      case "set-name":
        currentUserName = data.value;
        break;
      case "set-note":
        currentNote = data.value;
        break;
      case "note-typing":
        typingHeat = Math.min(typingHeat + 14, 100);
        if (pet.state !== "knead" && pet.state !== "sleep") {
          pet.state = "knead";
          pet.vx = 0;
          pet.vy = 0;
        }
        lastKeystrokeTime = Date.now();
        const nChar = codeChars[Math.floor(Math.random() * codeChars.length)];
        particles.push(
          new Particle(
            pet.x + pet.width / 2 + (Math.random() - 0.5) * 40,
            pet.y + pet.height - 15,
            "code",
            nChar
          )
        );
        break;
      case "show-greeting":
        showGreetingBubble(data.text, data.duration);
        break;
      case "set-timer":
        currentTimerText = data.text;
        break;
      case "pet-hop":
        pet.vy = -12;
        break;
      case "set-alarm":
        activeReminder = {
          topic: data.topic,
          targetMs: data.targetMs,
          warningTriggered: false,
          alarmTriggered: false,
        };
        break;
      case "cancel-alarm":
        activeReminder = null;
        if (pet.state === "alarm") pet.state = "idle";
        clearTimeout(alarmResetTimeout);
        break;
    }
  });
}



// ==========================================
// GAME LOOP
// ==========================================
function gameLoop() {
  ctx.clearRect(0, 0, screenWidth, screenHeight);

  // Ticks and timers
  mouseIdleTicks++;

  if (pettingMeter > 0) {
    pettingMeter -= 0.08;
    if (pettingMeter < 0) pettingMeter = 0;
  }

  if (typingHeat > 0) {
    typingHeat -= 1.2; // 2x faster cooldown so only very fast typing heats up
    if (typingHeat < 0) typingHeat = 0;
  }

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
      }, 10000); // Mild warning for 10 seconds
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
        if (window.electronAPI && window.electronAPI.sendDashboardUpdate) {
          window.electronAPI.sendDashboardUpdate({ type: "alarm-finished" });
        }
        activeReminder = null;
      }, 15000); // Shake and jump for 15 seconds
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
      particles.push(
        new Particle(
          pet.x + pet.width / 2 + (Math.random() - 0.5) * 20,
          pet.y,
          "steam",
        ),
      );
    }
  }

  // Update pet state & coordinates
  pet.update(currentMouseX, currentMouseY);

  // Compute skin CSS canvas filters
  let skinFilter = "none";
  switch (currentSkin) {
    case "ruby":
      skinFilter = "hue-rotate(345deg) saturate(3) brightness(0.9)";
      break;
    case "midnight":
      skinFilter =
        "invert(0.15) sepia(0.8) saturate(2) hue-rotate(220deg) brightness(0.85) contrast(1.15)";
      break;
    case "frost":
      skinFilter = "hue-rotate(185deg) saturate(2.2) brightness(1.15)";
      break;
    case "ghost":
      skinFilter = "invert(0.95) hue-rotate(190deg) opacity(0.6)";
      break;
  }

  // Draw the pet
  pet.draw(ctx, skinFilter);

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

  drawSpeechBubble(ctx, pet, displayedText, currentTimerText, greetingText);

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
