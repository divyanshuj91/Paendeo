const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setIgnoreMouse: (ignore) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, { forward: true });
  },
  getScreenDimensions: () => {
    return ipcRenderer.invoke('get-screen-dimensions');
  }
});
