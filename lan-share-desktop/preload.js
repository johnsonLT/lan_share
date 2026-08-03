const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSharedDir: () => ipcRenderer.invoke('set-shared-dir'),
  setReceiveDir: () => ipcRenderer.invoke('set-receive-dir'),
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),
  getSharedDir: () => ipcRenderer.invoke('get-shared-dir'),
  getReceiveDir: () => ipcRenderer.invoke('get-receive-dir'),
  openSharedDir: () => ipcRenderer.invoke('open-shared-dir'),
  openReceiveDir: () => ipcRenderer.invoke('open-receive-dir'),
  startServer: (port) => ipcRenderer.invoke('start-server', port),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  getFiles: () => ipcRenderer.invoke('get-files'),
  getReceiveFiles: () => ipcRenderer.invoke('get-receive-files'),
  deleteFile: (fileName) => ipcRenderer.invoke('delete-file', fileName),
  pushFile: (clientId, fileName) => ipcRenderer.invoke('push-file', clientId, fileName),
  selectFilesToShare: () => ipcRenderer.invoke('select-files-to-share'),
  selectFilesForUpload: () => ipcRenderer.invoke('select-files-for-upload'),
  downloadFromServer: (baseUrl, fileName) => ipcRenderer.invoke('download-from-server', baseUrl, fileName),
  uploadToServer: (baseUrl, filePaths) => ipcRenderer.invoke('upload-to-server', baseUrl, filePaths),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  restoreDefaultWindow: () => ipcRenderer.invoke('window-restore-default'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  onRefreshFiles: (callback) => ipcRenderer.on('refresh-files', callback),
  onClientsChanged: (callback) => ipcRenderer.on('clients-changed', callback)
});
