document.getElementById('minimize-btn').addEventListener('click', () => {
  window.electronAPI.minimizeDashboard();
});

// Typing / Note
const noteInput = document.getElementById("note-input");
noteInput.addEventListener("input", (e) => {
  window.electronAPI.sendPetControl({ type: "note-typing" });
  window.electronAPI.sendPetControl({ type: "set-note", value: e.target.value.trim() });
});

// Name input
document.getElementById("name-input").addEventListener("change", (e) => {
  const name = e.target.value.trim();
  if (name) {
    window.electronAPI.sendPetControl({ type: "show-greeting", text: `Hello, ${name}! 🐼`, duration: 3500 });
    window.electronAPI.sendPetControl({ type: "set-name", value: name });
  }
});

// Skin selection
document.getElementById("skin-select").addEventListener("change", (e) => {
  window.electronAPI.sendPetControl({ type: "set-skin", value: e.target.value });
});

// Action selection
document.getElementById("action-select").addEventListener("change", (e) => {
  window.electronAPI.sendPetControl({ type: "set-action", value: e.target.value });
});

// Gravity toggle
let isAntiGravity = false;
const gravityBtn = document.getElementById("toggle-gravity");

gravityBtn.addEventListener("click", () => {
  isAntiGravity = !isAntiGravity;
  updateGravityUI();
  window.electronAPI.sendPetControl({ type: "toggle-gravity", value: isAntiGravity });
});

function updateGravityUI() {
  gravityBtn.textContent = isAntiGravity ? "Anti-Gravity" : "Gravity Mode";
  gravityBtn.style.background = isAntiGravity
    ? "linear-gradient(135deg, #ec4899 0%, #be185d 100%)"
    : "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)";
}

// Receive dashboard updates from pet
window.electronAPI.onDashboardUpdate((data) => {
  if (data.type === "gravity-toggled") {
    isAntiGravity = data.value;
    updateGravityUI();
  } else if (data.type === "alarm-finished") {
    document.getElementById("alarm-btn").textContent = "Set Alarm";
    document.getElementById("alarm-btn").classList.remove("timer-running");
    activeReminder = null;
  }
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
    
    window.electronAPI.sendPetControl({ type: "show-greeting", text: "Focus session started! 💻", duration: 3000 });
    window.electronAPI.sendPetControl({ type: "set-timer", text: `⏱️ Pomodoro (${formatTime(pomodoroRemaining)})` });

    pomodoroInterval = setInterval(() => {
      if (pomodoroRemaining > 0) {
        pomodoroRemaining--;
        window.electronAPI.sendPetControl({ type: "set-timer", text: `⏱️ Pomodoro (${formatTime(pomodoroRemaining)})` });
      } else {
        clearInterval(pomodoroInterval);
        window.electronAPI.sendPetControl({ type: "pet-hop" });

        if (pomodoroState === "focus") {
          pomodoroState = "break";
          pomodoroRemaining = 5 * 60;
          btn.textContent = "Stop Break";
          window.electronAPI.sendPetControl({ type: "show-greeting", text: "Take a break! ☕ You did great.", duration: 5000 });
          window.electronAPI.sendPetControl({ type: "set-timer", text: `⏱️ Break (${formatTime(pomodoroRemaining)})` });
          
          // Start break interval
          pomodoroInterval = setInterval(() => {
            if (pomodoroRemaining > 0) {
              pomodoroRemaining--;
              window.electronAPI.sendPetControl({ type: "set-timer", text: `⏱️ Break (${formatTime(pomodoroRemaining)})` });
            } else {
              clearInterval(pomodoroInterval);
              window.electronAPI.sendPetControl({ type: "pet-hop" });
              pomodoroState = "none";
              btn.textContent = "Start Pomodoro";
              btn.classList.remove("timer-running");
              window.electronAPI.sendPetControl({ type: "show-greeting", text: "Break over! Let's focus again! 🚀", duration: 5000 });
              window.electronAPI.sendPetControl({ type: "set-timer", text: "" });
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
    window.electronAPI.sendPetControl({ type: "set-timer", text: "" });
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
    window.electronAPI.sendPetControl({ type: "show-greeting", text: `Stretch timer set for ${mins} mins! 🤸`, duration: 3000 });

    stretchIntervalObj = setInterval(() => {
      if (stretchTimerState === "running") {
        if (stretchRemaining > 0) {
          stretchRemaining--;
        } else {
          stretchTimerState = "stretching";
          window.electronAPI.sendPetControl({ type: "show-greeting", text: "Time to stretch! 🤸 Stand up!", duration: 8000 });
          window.electronAPI.sendPetControl({ type: "set-action", value: "stretch" });

          setTimeout(() => {
            if (stretchTimerState === "stretching") {
              stretchTimerState = "running";
              stretchRemaining = mins * 60;
              window.electronAPI.sendPetControl({ type: "set-action", value: "idle" });
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
    window.electronAPI.sendPetControl({ type: "set-action", value: "idle" });
  }
});

// Alarm Timer
let activeReminder = null;

document.getElementById("alarm-btn").addEventListener("click", () => {
  const btn = document.getElementById("alarm-btn");
  if (activeReminder) {
    activeReminder = null;
    btn.textContent = "Set Alarm";
    btn.classList.remove("timer-running");
    window.electronAPI.sendPetControl({ type: "cancel-alarm" });
    window.electronAPI.sendPetControl({ type: "show-greeting", text: "Alarm cancelled. 🔕", duration: 3000 });
    return;
  }

  const timeInput = document.getElementById("alarm-time").value;
  const topicInput = document.getElementById("alarm-topic").value.trim() || "Reminder";

  if (!timeInput) {
    window.electronAPI.sendPetControl({ type: "show-greeting", text: "Please select a time first! 🕒", duration: 3000 });
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
    targetMs: targetDate.getTime()
  };

  btn.textContent = "Cancel Alarm";
  btn.classList.add("timer-running");

  const formattedTime = targetDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  window.electronAPI.sendPetControl({ type: "show-greeting", text: `Alarm set for ${formattedTime}! ⏰`, duration: 4000 });
  
  window.electronAPI.sendPetControl({ type: "set-alarm", topic: topicInput, targetMs: targetDate.getTime() });
});
