const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('laycodeDesktop', {
  pickDirectory: async () => ipcRenderer.invoke('laycode:pick-directory'),
});
