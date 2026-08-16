const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const Store = require('electron-store');

const store = new Store();

let mainWindow;
let server = null;
let io = null;
let serverPort = 34345;
let httpServerInstance = null;

const appDataPath = app.getPath('userData');
let sharedDir = store.get('sharedDir') || path.join(appDataPath, 'LanShare', 'shared');
let receiveDir = store.get('receiveDir') || path.join(appDataPath, 'LanShare', 'received');

function ensureDirs() {
  if (!fs.existsSync(sharedDir)) fs.mkdirSync(sharedDir, { recursive: true });
  if (!fs.existsSync(receiveDir)) fs.mkdirSync(receiveDir, { recursive: true });
}
ensureDirs();

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function getLocalIPs() {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

function addIpToHistory(key, ip) {
  if (!ip || ip.trim() === '') return;
  const value = ip.trim();
  const list = store.get(key) || [];
  const filtered = list.filter((item) => item !== value);
  filtered.unshift(value);
  store.set(key, filtered.slice(0, 20));
}

function createWindow() {
  const savedBounds = store.get('windowBounds');
  const defaultWidth = 900;
  const defaultHeight = 680;

  mainWindow = new BrowserWindow({
    width: savedBounds?.width || defaultWidth,
    height: savedBounds?.height || defaultHeight,
    minWidth: 720,
    minHeight: 560,
    title: 'LanShare - 局域网文件互传',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#0f1115'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('resize', () => {
    store.set('windowBounds', mainWindow.getBounds());
  });

  mainWindow.on('move', () => {
    store.set('windowBounds', mainWindow.getBounds());
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') app.quit();
});

function getFileList(dir) {
  try {
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir);
    return files
      .filter((f) => fs.statSync(path.join(dir, f)).isFile())
      .map((f) => {
        const stat = fs.statSync(path.join(dir, f));
        return {
          name: f,
          size: stat.size,
          modified: stat.mtime.getTime()
        };
      })
      .sort((a, b) => b.modified - a.modified);
  } catch (err) {
    return [];
  }
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function safeFileName(fileName) {
  return Buffer.from(fileName, 'latin1').toString('utf8');
}

function makeUniquePath(dir, name) {
  let dest = path.join(dir, name);
  let counter = 1;
  let finalName = name;
  while (fs.existsSync(dest)) {
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    finalName = `${base} (${counter})${ext}`;
    dest = path.join(dir, finalName);
    counter++;
  }
  return { finalName, dest };
}

const clients = new Map();

function startServer(port, bindIp) {
  return new Promise((resolve, reject) => {
    stopServer().then(() => {
      const host = (bindIp && bindIp.trim()) ? bindIp.trim() : '0.0.0.0';
      const displayIp = host === '0.0.0.0' ? getLocalIP() : host;

      const appExpress = express();
      appExpress.use(cors());
      appExpress.use(express.json());

      const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, sharedDir),
        filename: (req, file, cb) => {
          const name = safeFileName(file.originalname);
          const { finalName } = makeUniquePath(sharedDir, name);
          cb(null, finalName);
        }
      });
      const upload = multer({ storage });

      appExpress.get('/api/files', (req, res) => {
        const list = getFileList(sharedDir).map((f) => ({ ...f, sizeText: formatSize(f.size) }));
        res.json({ success: true, files: list });
      });

      appExpress.post('/api/upload', upload.array('files'), (req, res) => {
        res.json({ success: true, count: req.files ? req.files.length : 0 });
      });

      appExpress.get('/api/download/:name', (req, res) => {
        const fileName = decodeURIComponent(req.params.name);
        const filePath = path.join(sharedDir, fileName);
        if (!filePath.startsWith(sharedDir) || !fs.existsSync(filePath)) {
          return res.status(404).json({ success: false, message: '文件不存在' });
        }
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.sendFile(filePath);
      });

      appExpress.delete('/api/files/:name', (req, res) => {
        const fileName = decodeURIComponent(req.params.name);
        const filePath = path.join(sharedDir, fileName);
        if (!filePath.startsWith(sharedDir) || !fs.existsSync(filePath)) {
          return res.status(404).json({ success: false, message: '文件不存在' });
        }
        fs.unlinkSync(filePath);
        res.json({ success: true });
      });

      appExpress.get('/api/status', (req, res) => {
        res.json({ success: true, status: 'running', port: serverPort });
      });

      appExpress.get('/api/clients', (req, res) => {
        const list = Array.from(clients.values()).map(c => ({ id: c.id, name: c.name, platform: c.platform }));
        res.json({ success: true, clients: list });
      });

      appExpress.post('/api/register', (req, res) => {
        const { clientId, name, platform } = req.body;
        if (!clientId) return res.status(400).json({ success: false, message: 'clientId required' });
        clients.set(clientId, {
          id: clientId,
          name: name || '未知设备',
          platform: platform || 'unknown',
          socketId: null,
          pendingFiles: []
        });
        notifyClientsChanged();
        res.json({ success: true });
      });

      appExpress.post('/api/heartbeat/:clientId', (req, res) => {
        const clientId = req.params.clientId;
        const client = clients.get(clientId);
        if (client) {
          client.lastSeen = Date.now();
        }
        res.json({ success: true });
      });

      appExpress.get('/api/pending/:clientId', (req, res) => {
        const clientId = req.params.clientId;
        const client = clients.get(clientId);
        if (!client) return res.json({ success: true, files: [] });
        res.json({ success: true, files: client.pendingFiles || [] });
      });

      httpServerInstance = appExpress.listen(port, host, () => {
        serverPort = port;
        io = new Server(httpServerInstance, { cors: { origin: '*' } });

        io.on('connection', (socket) => {
          socket.on('register', (data) => {
            const clientId = data.clientId || uuidv4();
            clients.set(clientId, {
              id: clientId,
              name: data.name || '未知设备',
              platform: data.platform || 'unknown',
              socketId: socket.id,
              pendingFiles: []
            });
            socket.clientId = clientId;
            notifyClientsChanged();
          });

          socket.on('disconnect', () => {
            if (socket.clientId) {
              clients.delete(socket.clientId);
              notifyClientsChanged();
            }
          });
        });

        resolve({ success: true, port, ip: displayIp, host });
      });

      httpServerInstance.on('error', (err) => {
        reject({ success: false, message: err.message });
      });
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (io) {
      io.close();
      io = null;
    }
    if (httpServerInstance) {
      httpServerInstance.close(() => {
        httpServerInstance = null;
        server = null;
        resolve({ success: true });
      });
    } else {
      resolve({ success: true });
    }
  });
}

function notifyClientsChanged() {
  if (mainWindow) {
    mainWindow.webContents.send('clients-changed', Array.from(clients.values()).map(c => ({ id: c.id, name: c.name, platform: c.platform })));
  }
}

function pushFileToClient(clientId, fileName) {
  const client = clients.get(clientId);
  if (!client) return { success: false, message: '客户端不在线' };

  const filePath = path.join(sharedDir, fileName);
  if (!filePath.startsWith(sharedDir) || !fs.existsSync(filePath)) {
    return { success: false, message: '文件不存在' };
  }

  client.pendingFiles = client.pendingFiles || [];
  client.pendingFiles.push({ name: fileName, size: fs.statSync(filePath).size, time: Date.now() });

  if (io) {
    io.to(client.socketId).emit('push_file', { name: fileName, size: fs.statSync(filePath).size });
  }
  return { success: true };
}

ipcMain.handle('get-settings', () => {
  return {
    sharedDir,
    receiveDir,
    defaultPort: store.get('defaultPort') || 34345,
    serverBindIpHistory: store.get('serverBindIpHistory') || [],
    selectedServerBindIp: store.get('selectedServerBindIp') || '',
    localIPs: getLocalIPs(),
    clientServerIpHistory: store.get('clientServerIpHistory') || [],
    selectedClientServerIp: store.get('selectedClientServerIp') || ''
  };
});

ipcMain.handle('set-shared-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择共享文件夹'
  });
  if (result.canceled || !result.filePaths.length) return { success: false };
  sharedDir = result.filePaths[0];
  store.set('sharedDir', sharedDir);
  ensureDirs();
  return { success: true, path: sharedDir };
});

ipcMain.handle('set-receive-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择文件接收目录'
  });
  if (result.canceled || !result.filePaths.length) return { success: false };
  receiveDir = result.filePaths[0];
  store.set('receiveDir', receiveDir);
  ensureDirs();
  return { success: true, path: receiveDir };
});

ipcMain.handle('get-local-ip', () => getLocalIP());
ipcMain.handle('get-local-ips', () => getLocalIPs());

ipcMain.handle('add-server-bind-ip-history', (event, ip) => {
  addIpToHistory('serverBindIpHistory', ip);
  store.set('selectedServerBindIp', ip);
});
ipcMain.handle('clear-server-bind-ip-history', () => {
  store.set('serverBindIpHistory', []);
});
ipcMain.handle('set-selected-server-bind-ip', (event, ip) => {
  store.set('selectedServerBindIp', ip);
});

ipcMain.handle('add-client-server-ip-history', (event, ip) => {
  addIpToHistory('clientServerIpHistory', ip);
  store.set('selectedClientServerIp', ip);
});
ipcMain.handle('clear-client-server-ip-history', () => {
  store.set('clientServerIpHistory', []);
});
ipcMain.handle('set-selected-client-server-ip', (event, ip) => {
  store.set('selectedClientServerIp', ip);
});

ipcMain.handle('get-shared-dir', () => sharedDir);
ipcMain.handle('get-receive-dir', () => receiveDir);
ipcMain.handle('open-shared-dir', () => shell.openPath(sharedDir));
ipcMain.handle('open-receive-dir', () => shell.openPath(receiveDir));

ipcMain.handle('start-server', async (event, port, bindIp) => {
  try {
    const result = await startServer(port, bindIp);
    server = httpServerInstance;
    return result;
  } catch (err) {
    return err;
  }
});

ipcMain.handle('stop-server', () => stopServer());
ipcMain.handle('get-files', () => getFileList(sharedDir).map((f) => ({ ...f, sizeText: formatSize(f.size) })));
ipcMain.handle('get-receive-files', () => getFileList(receiveDir).map((f) => ({ ...f, sizeText: formatSize(f.size) })));

ipcMain.handle('delete-file', (event, fileName) => {
  const filePath = path.join(sharedDir, fileName);
  if (filePath.startsWith(sharedDir) && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return { success: true };
  }
  return { success: false, message: '文件不存在' };
});

ipcMain.handle('push-file', (event, clientId, fileName) => {
  return pushFileToClient(clientId, fileName);
});

ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-restore-default', () => {
  if (mainWindow) {
    mainWindow.setSize(900, 680);
    mainWindow.center();
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('select-files-to-share', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    title: '选择要分享的文件'
  });
  if (result.canceled || !result.filePaths.length) return { success: false };
  const copied = [];
  for (const src of result.filePaths) {
    const baseName = path.basename(src);
    const { finalName, dest } = makeUniquePath(sharedDir, baseName);
    fs.copyFileSync(src, dest);
    copied.push(finalName);
  }
  return { success: true, files: copied };
});

ipcMain.handle('download-from-server', async (event, baseUrl, fileName) => {
  try {
    const url = `${baseUrl}/api/download/${encodeURIComponent(fileName)}`;
    const { finalName, dest } = makeUniquePath(receiveDir, fileName);

    const response = await fetch(url);
    if (!response.ok) throw new Error('下载失败');
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(dest, buffer);

    return { success: true, fileName: finalName, path: dest };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('upload-to-server', async (event, baseUrl, filePaths) => {
  try {
    const FormData = require('form-data');
    const axios = require('axios');
    const form = new FormData();

    for (const src of filePaths) {
      const name = path.basename(src);
      form.append('files', fs.createReadStream(src), name);
    }

    const response = await axios.post(`${baseUrl}/api/upload`, form, {
      headers: form.getHeaders()
    });

    return response.data;
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('select-files-for-upload', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    title: '选择要上传的文件'
  });
  if (result.canceled || !result.filePaths.length) return { success: false };
  return { success: true, files: result.filePaths };
});
