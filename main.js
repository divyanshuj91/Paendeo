const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("node:path");
const { uIOhook } = require("uiohook-napi");

let mainWindow = null;
let dashboardWindow = null;

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

  mainWindow.loadFile("index.html");
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
    if (dashboardWindow) {
      dashboardWindow.close();
    }
  });

  // Create Dashboard Window
  dashboardWindow = new BrowserWindow({
    width: 330,
    height: 500,
    x: primaryDisplay.bounds.width - 350,
    y: 50,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  dashboardWindow.loadFile("dashboard.html");

  dashboardWindow.on("closed", () => {
    dashboardWindow = null;
    if (mainWindow) {
      mainWindow.close();
    }
  });

  // IPC Routing
  ipcMain.on("pet-control", (event, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("pet-control", data);
    }
  });

  ipcMain.on("dashboard-update", (event, data) => {
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send("dashboard-update", data);
    }
  });

  ipcMain.on("minimize-dashboard", () => {
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.minimize();
    }
  });
}

app.disableHardwareAcceleration();

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

uIOhook.on('keydown', (e) => {
  if (mainWindow) {
    mainWindow.webContents.send('global-keydown', e);
  }
});
uIOhook.start();

app.on('before-quit', () => {
  uIOhook.stop();
});
