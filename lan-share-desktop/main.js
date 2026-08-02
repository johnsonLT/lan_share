const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const cors = require('cors');
const multer = require('multer');

let mainWindow;
let server = null;
let serverPort = 34345;

const appDataPath = app.getPath('userData');
const sharedDir = path.join(appDataPath, 'LanShare', 'shared');
if (!fs.existsSync(sharedDir)) {
  fs.mkdirSync(sharedDir, { recursive: true });
}

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
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
    transparent: true,
    backgroundColor: '#00000000'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (server) {
    server.close();
  }
  if (process.platform !== 'darwin') app.quit();
});

function getFileList() {
  try {
    const files = fs.readdirSync(sharedDir);
    return files
      .filter((f) => fs.statSync(path.join(sharedDir, f)).isFile())
      .map((f) => {
        const stat = fs.statSync(path.join(sharedDir, f));
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

function startServer(port) {
  return new Promise((resolve, reject) => {
    if (server) {
      server.close();
      server = null;
    }

    const appExpress = express();
    appExpress.use(cors());
    appExpress.use(express.json());

    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, sharedDir),
      filename: (req, file, cb) => {
        let name = Buffer.from(file.originalname, 'latin1').toString('utf8');
        let dest = path.join(sharedDir, name);
        let counter = 1;
        let finalName = name;
        while (fs.existsSync(dest)) {
          const ext = path.extname(name);
          const base = path.basename(name, ext);
          finalName = `${base} (${counter})${ext}`;
          dest = path.join(sharedDir, finalName);
          counter++;
        }
        cb(null, finalName);
      }
    });
    const upload = multer({ storage });

    appExpress.get('/api/files', (req, res) => {
      const list = getFileList().map((f) => ({ ...f, sizeText: formatSize(f.size) }));
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

    appExpress.use(express.static(path.join(__dirname, 'public')));

    server = appExpress.listen(port, () => {
      serverPort = port;
      resolve({ success: true, port, ip: getLocalIP() });
    });

    server.on('error', (err) => {
      reject({ success: false, message: err.message });
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        resolve({ success: true });
      });
    } else {
      resolve({ success: true });
    }
  });
}

ipcMain.handle('get-local-ip', () => getLocalIP());
ipcMain.handle('get-shared-dir', () => sharedDir);
ipcMain.handle('open-shared-dir', () => shell.openPath(sharedDir));
ipcMain.handle('start-server', async (event, port) => {
  try {
    const result = await startServer(port);
    return result;
  } catch (err) {
    return err;
  }
});
ipcMain.handle('stop-server', () => stopServer());
ipcMain.handle('get-files', () => getFileList().map((f) => ({ ...f, sizeText: formatSize(f.size) })));
ipcMain.handle('delete-file', (event, fileName) => {
  const filePath = path.join(sharedDir, fileName);
  if (filePath.startsWith(sharedDir) && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return { success: true };
  }
  return { success: false, message: '文件不存在' };
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
    let destName = baseName;
    let destPath = path.join(sharedDir, destName);
    let counter = 1;
    while (fs.existsSync(destPath)) {
      const ext = path.extname(baseName);
      const name = path.basename(baseName, ext);
      destName = `${name} (${counter})${ext}`;
      destPath = path.join(sharedDir, destName);
      counter++;
    }
    fs.copyFileSync(src, destPath);
    copied.push(destName);
  }
  return { success: true, files: copied };
});
