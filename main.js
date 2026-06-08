const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('node:path');

let mainWindow = null;

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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');

  // Let the window be visible on all workspaces/virtual desktops (for macOS/Linux compat)
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Set initial window behavior to click-through
  // Using forward: true enables the renderer to still receive mousemove events
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Handle click-through toggle via IPC from renderer
  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setIgnoreMouseEvents(ignore, options);
    }
  });

  // Allow requesting the primary screen's dimensions
  ipcMain.handle('get-screen-dimensions', () => {
    return { width, height };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Ensure transparent window works properly on Linux/Windows
app.disableHardwareAcceleration(); // Sometimes helps with transparency rendering glitches

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
