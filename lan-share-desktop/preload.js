const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),
  getSharedDir: () => ipcRenderer.invoke('get-shared-dir'),
  openSharedDir: () => ipcRenderer.invoke('open-shared-dir'),
  startServer: (port) => ipcRenderer.invoke('start-server', port),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  getFiles: () => ipcRenderer.invoke('get-files'),
  deleteFile: (fileName) => ipcRenderer.invoke('delete-file', fileName),
  selectFilesToShare: () => ipcRenderer.invoke('select-files-to-share'),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  onRefreshFiles: (callback) => ipcRenderer.on('refresh-files', callback)
});
