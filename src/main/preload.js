const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  setIgnoreMouse: (ignore) => {
    ipcRenderer.send("set-ignore-mouse-events", ignore, { forward: true });
  },
  getScreenDimensions: () => {
    return ipcRenderer.invoke("get-screen-dimensions");
  },
  onGlobalKeydown: (callback) => {
    ipcRenderer.on('global-keydown', (event, data) => callback(data));
  },
  sendPetControl: (data) => {
    ipcRenderer.send("pet-control", data);
  },
  onPetControl: (callback) => {
    ipcRenderer.on("pet-control", (event, data) => callback(data));
  },
  sendDashboardUpdate: (data) => {
    ipcRenderer.send("dashboard-update", data);
  },
  onDashboardUpdate: (callback) => {
    ipcRenderer.on("dashboard-update", (event, data) => callback(data));
  },
  minimizeDashboard: () => {
    ipcRenderer.send("minimize-dashboard");
  }
});
