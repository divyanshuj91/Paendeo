const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("node:path");
const { uIOhook } = require("uiohook-napi");

let mainWindow = null;

// Configure Chromium switches for low memory and program gc exposure
app.commandLine.appendSwitch("js-flags", "--expose-gc --max-old-space-size=48 --max-semi-space-size=1");
app.commandLine.appendSwitch("enable-low-end-device-mode");
app.commandLine.appendSwitch("disable-gpu-process-crash-limit");

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  // Let the window be visible on all workspaces/virtual desktops (for macOS/Linux compat)
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  ipcMain.on("set-ignore-mouse-events", (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && win === mainWindow) {
      win.setIgnoreMouseEvents(ignore, options);
    }
  });

  ipcMain.handle("get-screen-dimensions", () => {
    return { width, height };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Hardware Acceleration is enabled by default in Electron. 
// We removed app.disableHardwareAcceleration() to allow GPU offloading, which saves system RAM.

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

uIOhook.on("keydown", (e) => {
  if (mainWindow) {
    mainWindow.webContents.send("global-keydown", e);
  }
});
uIOhook.start();

app.on("before-quit", () => {
  uIOhook.stop();
});

