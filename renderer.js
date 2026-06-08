// ==========================================
// SPRITE SHEET CONFIGURATION
// Customize this to match your sprite sheet dimensions and grid layout.
// ==========================================
const SPRITE_CONFIG = {
  filePath: "panda_spritesheet_clean.png", // Reference the cleaned image
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
const uiPanel = document.getElementById("ui-panel");

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

// Typing event listener (Note Pin Input)
document.getElementById("note-input").addEventListener("input", () => {
  typingHeat = Math.min(typingHeat + 14, 100);
});

// Name Input Greeting trigger
document.getElementById("name-input").addEventListener("change", (e) => {
  const name = e.target.value.trim();
  if (name) {
    showGreetingBubble(`Hello, ${name}! 🐼`, 3500);
  }
});

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
// POMODORO FOCUS TIMER SYSTEM
// ==========================================
let pomodoroState = "none"; // 'none', 'focus', 'break'
let pomodoroRemaining = 0;
let pomodoroInterval = null;

function formatTime(secs) {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

document.getElementById("pomodoro-btn").addEventListener("click", () => {
  const btn = document.getElementById("pomodoro-btn");
  if (pomodoroState === "none") {
    pomodoroState = "focus";
    pomodoroRemaining = 25 * 60; // 25 minutes
    btn.textContent = "Stop Focus";
    btn.classList.add("timer-running");
    showGreetingBubble("Focus session started! 💻", 3000);

    pomodoroInterval = setInterval(() => {
      if (pomodoroRemaining > 0) {
        pomodoroRemaining--;
      } else {
        // Pomodoro Cycle Done -> Jump / Hop and switch
        clearInterval(pomodoroInterval);
        pet.vy = -12; // Happy hop

        if (pomodoroState === "focus") {
          pomodoroState = "break";
          pomodoroRemaining = 5 * 60; // 5 mins break
          btn.textContent = "Stop Break";
          showGreetingBubble("Take a break! ☕ You did great.", 5000);
        } else {
          pomodoroState = "none";
          btn.textContent = "Start Pomodoro";
          btn.classList.remove("timer-running");
          showGreetingBubble("Let's focus again! 🚀", 5000);
        }
      }
    }, 1000);
  } else {
    clearInterval(pomodoroInterval);
    pomodoroState = "none";
    pomodoroRemaining = 0;
    btn.textContent = "Start Pomodoro";
    btn.classList.remove("timer-running");
  }
});

// ==========================================
// STRETCH TIMER SYSTEM
// ==========================================
let stretchTimerState = "none"; // 'none', 'running', 'stretching'
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
          // Time to stretch!
          stretchTimerState = "stretching";
          showGreetingBubble("Time to stretch! 🤸 Stand up!", 8000);
          pet.state = "stretch";
          pet.vx = 0;
          pet.vy = 0;
          
          setTimeout(() => {
            if (stretchTimerState === "stretching") {
              stretchTimerState = "running";
              stretchRemaining = mins * 60; // Reset for next cycle
              pet.state = "idle";
            }
          }, 8000); // 8 seconds of stretch
        }
      }
    }, 1000);
  } else {
    // Stop the timer
    stretchTimerState = "none";
    clearInterval(stretchIntervalObj);
    btn.textContent = "Start";
    btn.classList.remove("timer-running");
    if (pet.state === "stretch") {
      pet.state = "idle";
    }
  }
});

// ==========================================
// ALARM REMINDER SYSTEM
// ==========================================
let activeReminder = null; // { topic: string, targetMs: number, warningTriggered: boolean, alarmTriggered: boolean }
let alarmResetTimeout = null;

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
    alarmTriggered: false
  };

  btn.textContent = "Cancel Alarm";
  btn.classList.add("timer-running");

  const formattedTime = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  showGreetingBubble(`Alarm set for ${formattedTime}! ⏰`, 4000);
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
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'heart' or 'steam'
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy =
      type === "heart"
        ? -1.2 - Math.random() * 1.2
        : -0.8 - Math.random() * 0.8;
    this.life = 60 + Math.random() * 40;
    this.maxLife = this.life;
    this.size = type === "heart" ? 12 : 3 + Math.random() * 4;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }

  draw(ctx) {
    const alpha = this.life / this.maxLife;
    ctx.save();
    if (this.type === "heart") {
      ctx.globalAlpha = alpha;
      ctx.font = `${this.size}px Outfit, sans-serif`;
      ctx.fillText("❤️", this.x - this.size / 2, this.y);
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
      const isAutoBehavior =
        document.getElementById("action-select").value === "auto";

      if (this.isAntiGravity) {
        // Float mode: DVD Logo Bouncing
        this.x += this.vx;
        this.y += this.vy;
        this.state = "float";

        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (currentSpeed < 1.0) {
          this.vx = (Math.random() > 0.5 ? 1 : -1) * ANTIGRAVITY_FLOAT_SPEED;
          this.vy = (Math.random() > 0.5 ? 1 : -1) * ANTIGRAVITY_FLOAT_SPEED;
        }
      } else {
        // Gravity mode
        this.vy += GRAVITY;
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
            this.state = document.getElementById("action-select").value;
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
      if (this.x <= 0) {
        this.x = 0;
        this.vx = -this.vx;
        this.facing = "right";
      } else if (this.x + this.width >= screenWidth) {
        this.x = screenWidth - this.width;
        this.vx = -this.vx;
        this.facing = "left";
      }

      if (this.y <= 0) {
        this.y = 0;
        this.vy = -this.vy;
      } else if (this.y + this.height >= screenHeight) {
        this.y = screenHeight - this.height;
        this.vy = -this.vy;
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

      if (this.x <= 0) {
        this.x = 0;
        this.vx = -this.vx * 0.4;
      } else if (this.x + this.width >= screenWidth) {
        this.x = screenWidth - this.width;
        this.vx = -this.vx * 0.4;
      }

      if (this.y <= 0) {
        this.y = 0;
        this.vy = -this.vy * 0.4;
      }
    }

    // Adjust look vector
    if (Math.abs(this.vx) > 0.15 && !this.isDragging && !hasKeyInput) {
      this.facing = this.vx > 0 ? "right" : "left";
    }

    // Scale animation
    const targetScale = this.state === "stretch" ? 2.5 : 1.0;
    this.scaleFactor += (targetScale - this.scaleFactor) * 0.05;

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

    const btn = document.getElementById("toggle-gravity");
    btn.textContent = this.isAntiGravity ? "Anti-Gravity" : "Gravity Mode";
    btn.style.background = this.isAntiGravity
      ? "linear-gradient(135deg, #ec4899 0%, #be185d 100%)"
      : "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)";
  }

  draw(ctx, skinFilter) {
    ctx.save();

    ctx.filter = skinFilter || "none";

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

    // Eye tracking interpolation
    let targetEyeX = 0;
    let targetEyeY = 0;
    let isBlinking = false;
    let headTilt = 0;

    this.eyeX += (targetEyeX - this.eyeX) * 0.15;
    this.eyeY += (targetEyeY - this.eyeY) * 0.15;

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

    // Draw Universal Keyboard if typing
    const isTypingActive = (Date.now() - lastKeystrokeTime) < 300;
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

      ctx.fillStyle = "#1e293b"; // Dark grey chassis (B/W)
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(2 * s, 42 * s + bY, 60 * s, 14 * s, 2 * s);
      } else {
        ctx.fillRect(2 * s, 42 * s + bY, 60 * s, 14 * s);
      }
      ctx.fill();

      const key1Down = leftDown ? 1 * s : 0;
      ctx.fillStyle = leftDown ? "#94a3b8" : "#f8fafc"; // Grey when pressed, white otherwise
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(6 * s, 40 * s + bY + key1Down, 22 * s, 10 * s, 2 * s);
      } else {
        ctx.fillRect(6 * s, 40 * s + bY + key1Down, 22 * s, 10 * s);
      }
      ctx.fill();

      const key2Down = rightDown ? 1 * s : 0;
      ctx.fillStyle = rightDown ? "#94a3b8" : "#f8fafc";
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(36 * s, 40 * s + bY + key2Down, 22 * s, 10 * s, 2 * s);
      } else {
        ctx.fillRect(36 * s, 40 * s + bY + key2Down, 22 * s, 10 * s);
      }
      ctx.fill();
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
         const opacity = 1 - (radius / (40 * s));
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

// Dashboard panel drag state
let isDraggingPanel = false;
let panelStartX = 0;
let panelStartY = 0;
let panelWidth = 0;
let panelHeight = 0;
let mouseStartX = 0;
let mouseStartY = 0;

let lastIgnoreMouseState = null;

window.addEventListener("mousemove", (e) => {
  currentMouseX = e.clientX;
  currentMouseY = e.clientY;
  mouseIdleTicks = 0; // Reset mouse idle timer on movement

  if (isDraggingPanel) {
    const dx = e.clientX - mouseStartX;
    const dy = e.clientY - mouseStartY;

    let newLeft = panelStartX + dx;
    let newTop = panelStartY + dy;

    // Constrain to screen boundaries using cached dimensions to avoid layout thrashing
    const maxLeft = window.innerWidth - panelWidth;
    const maxTop = window.innerHeight - panelHeight;

    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));

    uiPanel.style.left = `${newLeft}px`;
    uiPanel.style.top = `${newTop}px`;
    uiPanel.style.right = "auto";
    uiPanel.style.bottom = "auto";
  }

  const uiRect = uiPanel.getBoundingClientRect();
  const isOverUI =
    currentMouseX >= uiRect.left &&
    currentMouseX <= uiRect.right &&
    currentMouseY >= uiRect.top &&
    currentMouseY <= uiRect.bottom;

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
  const shouldIgnore = !(isOverPet || isOverUI || isDraggingPanel);
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
  }
  isDraggingPanel = false;
  uiPanel.classList.remove("dragging");
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
let lastKeystrokeTime = 0;

if (window.electronAPI && window.electronAPI.onGlobalKeydown) {
  window.electronAPI.onGlobalKeydown((e) => {
    lastKeystrokeTime = Date.now();
    typingHeat = Math.min(typingHeat + 15, 200);
    if (pet.state !== "knead" && pet.state !== "sleep") {
      pet.state = "knead";
      pet.vx = 0;
      pet.vy = 0;
    }
  });
}

document.getElementById("skin-select").addEventListener("change", (e) => {
  currentSkin = e.target.value;
});

document.getElementById("toggle-gravity").addEventListener("click", () => {
  pet.toggleAntiGravity();
});

document.getElementById("action-select").addEventListener("change", (e) => {
  const selectedAction = e.target.value;
  if (selectedAction !== "auto") {
    pet.state = selectedAction;
    if (selectedAction === "idle" || selectedAction === "sleep") {
      pet.vx = 0;
      pet.vy = 0;
    }
  }
});

document.getElementById("minimize-btn").addEventListener("click", () => {
  const isMinimized = uiPanel.classList.toggle("minimized");
  document.getElementById("minimize-btn").title = isMinimized
    ? "Expand Dashboard"
    : "Minimize Dashboard";

  // If expanding, adjust coordinates to prevent the panel from overflowing the screen bounds
  if (!isMinimized) {
    const rect = uiPanel.getBoundingClientRect();
    const expandedWidth = 290;
    const expandedHeight = 350;

    const rectLeft = parseFloat(uiPanel.style.left) || rect.left;
    const rectTop = parseFloat(uiPanel.style.top) || rect.top;

    if (rectLeft + expandedWidth > window.innerWidth) {
      const newLeft = Math.max(0, window.innerWidth - expandedWidth - 20);
      uiPanel.style.left = `${newLeft}px`;
    }
    if (rectTop + expandedHeight > window.innerHeight) {
      const newTop = Math.max(0, window.innerHeight - expandedHeight - 20);
      uiPanel.style.top = `${newTop}px`;
    }
  }
});

// Panel dragging implementation
const panelHeader = document.querySelector(".panel-header");
panelHeader.addEventListener("mousedown", (e) => {
  // Do not drag if user clicked minimize button or its children
  if (e.target.closest("#minimize-btn")) {
    return;
  }

  isDraggingPanel = true;
  mouseStartX = e.clientX;
  mouseStartY = e.clientY;

  const rect = uiPanel.getBoundingClientRect();
  panelStartX = rect.left;
  panelStartY = rect.top;
  panelWidth = rect.width;
  panelHeight = rect.height;

  uiPanel.classList.add("dragging");

  // Prevent default to avoid selection side-effects
  e.preventDefault();
});

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
    const nameInput = document.getElementById("name-input");
    const userName = nameInput ? nameInput.value.trim() : "";
    const greeting = userName ? `Hey ${userName}! ` : "";
    
    // 1-Minute Warning Trigger
    if (msRemaining <= 60000 && msRemaining > 0 && !activeReminder.warningTriggered) {
      activeReminder.warningTriggered = true;
      pet.state = "alarm";
      pet.vx = 0;
      pet.vy = 0;
      
      const formattedTime = new Date(activeReminder.targetMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      showGreetingBubble(`⏰ ${greeting}Upcoming in 1 min: ${activeReminder.topic} (${formattedTime})`, 10000);

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
      showGreetingBubble(`🚨 ${greeting}IT'S TIME FOR: ${activeReminder.topic}! 🚨`, 15000);

      alarmResetTimeout = setTimeout(() => {
        if (pet.state === "alarm") pet.state = "idle";
        document.getElementById("alarm-btn").textContent = "Set Alarm";
        document.getElementById("alarm-btn").classList.remove("timer-running");
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
  if (typingHeat > 85) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
    ctx.fillRect(0, 0, screenWidth, screenHeight);
    ctx.restore();
  }

  // Draw Pinned Note or Timer speech bubbles above head
  const noteText = document.getElementById("note-input").value.trim();
  const timerText =
    pomodoroState !== "none"
      ? `⏱️ Pomodoro (${formatTime(pomodoroRemaining)})`
      : "";

  // Override: show petting feedback
  let displayedText = noteText;
  if (pettingMeter > 8) {
    displayedText = "Purr... ❤️";
  }

  drawSpeechBubble(ctx, pet, displayedText, timerText, greetingText);

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
