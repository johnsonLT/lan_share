let isRunning = false;
let refreshInterval = null;
let clientRefreshInterval = null;
let currentMode = 'server';
let isClientConnected = false;
let clientBaseUrl = '';
let clients = [];
let clientId = localStorage.getItem('lanshare_client_id') || ('desktop-' + Math.random().toString(36).substr(2, 9));
localStorage.setItem('lanshare_client_id', clientId);
let clientPollInterval = null;

const portInput = document.getElementById('port');
const serverBindIpInput = document.getElementById('serverBindIp');
const serverBindIpListEl = document.getElementById('serverBindIpList');
const refreshServerIpBtn = document.getElementById('refreshServerIp');
const clearServerIpHistoryBtn = document.getElementById('clearServerIpHistory');
const toggleBtn = document.getElementById('toggleServer');
const toggleIcon = document.getElementById('toggleIcon');
const toggleText = document.getElementById('toggleText');
const statusDot = document.getElementById('statusDot');
const ipText = document.getElementById('ipText');
const fileListEl = document.getElementById('fileList');
const dropZone = document.getElementById('dropZone');
const toastEl = document.getElementById('toast');
const statusLeft = document.getElementById('statusLeft');
const statusRight = document.getElementById('statusRight');
const sharedDirPathEl = document.getElementById('sharedDirPath');
const receiveDirPathEl = document.getElementById('receiveDirPath');
const clientsListEl = document.getElementById('clientsList');
const serverLogListEl = document.getElementById('serverLogList');

const serverIpInput = document.getElementById('serverIp');
const clientServerIpListEl = document.getElementById('clientServerIpList');
const clearClientIpHistoryBtn = document.getElementById('clearClientIpHistory');
const serverPortInput = document.getElementById('serverPort');
const connectBtn = document.getElementById('connectServer');
const disconnectBtn = document.getElementById('disconnectServer');
const serverFileListEl = document.getElementById('serverFileList');
const clientUploadZone = document.getElementById('clientUploadZone');
const receiveFileListEl = document.getElementById('receiveFileList');
const clientReceiveDirPathEl = document.getElementById('clientReceiveDirPath');
const clientLogListEl = document.getElementById('clientLogList');

let localIPs = [];
let serverBindIpHistory = [];
let clientServerIpHistory = [];

// Window controls
document.querySelector('.btn-min').addEventListener('click', () => window.electronAPI.minimizeWindow());
document.querySelector('.btn-max').addEventListener('click', () => window.electronAPI.maximizeWindow());
document.querySelector('.btn-restore').addEventListener('click', () => window.electronAPI.restoreDefaultWindow());
document.querySelector('.btn-close').addEventListener('click', () => window.electronAPI.closeWindow());

// Mode tabs
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const mode = tab.dataset.mode;
    switchMode(mode);
  });
});

function switchMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  document.getElementById('serverPanel').classList.toggle('active', mode === 'server');
  document.getElementById('clientPanel').classList.toggle('active', mode === 'client');
  statusRight.textContent = `模式: ${mode === 'server' ? '服务器' : '客户端'}`;
}

async function init() {
  const settings = await window.electronAPI.getSettings();
  sharedDirPathEl.textContent = settings.sharedDir;
  receiveDirPathEl.textContent = settings.receiveDir;
  clientReceiveDirPathEl.textContent = settings.receiveDir;
  portInput.value = settings.defaultPort || 34345;

  localIPs = settings.localIPs || [];
  serverBindIpHistory = settings.serverBindIpHistory || [];
  clientServerIpHistory = settings.clientServerIpHistory || [];

  serverBindIpInput.value = settings.selectedServerBindIp || '';
  serverIpInput.value = settings.selectedClientServerIp || '';

  renderServerBindIpOptions();
  renderClientServerIpOptions();

  addLog(serverLogListEl, '应用初始化完成', 'info');
  addLog(clientLogListEl, '应用初始化完成', 'info');

  refreshFiles();
  refreshReceiveFiles();
}

function renderServerBindIpOptions() {
  const seen = new Set();
  const options = [];
  for (const ip of localIPs) {
    if (!seen.has(ip)) {
      seen.add(ip);
      options.push({ value: ip, label: `${ip} (本机)` });
    }
  }
  for (const ip of serverBindIpHistory) {
    if (!seen.has(ip)) {
      seen.add(ip);
      options.push({ value: ip, label: ip });
    }
  }
  serverBindIpListEl.innerHTML = options.map((o) => `<option value="${o.value}" label="${o.label}"></option>`).join('');
}

function renderClientServerIpOptions() {
  clientServerIpListEl.innerHTML = clientServerIpHistory.map((ip) => `<option value="${ip}"></option>`).join('');
}

// Server mode
toggleBtn.addEventListener('click', async () => {
  if (isRunning) {
    await stopServer();
  } else {
    await startServer();
  }
});

document.getElementById('changeSharedDir').addEventListener('click', async () => {
  const result = await window.electronAPI.setSharedDir();
  if (result.success) {
    sharedDirPathEl.textContent = result.path;
    addLog(serverLogListEl, '共享文件夹已更改: ' + result.path, 'info');
    showToast('共享文件夹已更改');
    refreshFiles();
  }
});

document.getElementById('openSharedDir').addEventListener('click', () => {
  window.electronAPI.openSharedDir();
  addLog(serverLogListEl, '打开共享文件夹', 'info');
});

document.getElementById('changeReceiveDir').addEventListener('click', async () => {
  const result = await window.electronAPI.setReceiveDir();
  if (result.success) {
    receiveDirPathEl.textContent = result.path;
    clientReceiveDirPathEl.textContent = result.path;
    addLog(serverLogListEl, '接收目录已更改: ' + result.path, 'info');
    addLog(clientLogListEl, '接收目录已更改: ' + result.path, 'info');
    showToast('接收目录已更改');
    refreshReceiveFiles();
  }
});

document.getElementById('openReceiveDir').addEventListener('click', () => {
  window.electronAPI.openReceiveDir();
  addLog(serverLogListEl, '打开接收目录', 'info');
  addLog(clientLogListEl, '打开接收目录', 'info');
});

async function startServer() {
  const port = parseInt(portInput.value, 10);
  if (isNaN(port) || port < 1024 || port > 65535) {
    showToast('请输入 1024-65535 之间的有效端口');
    return;
  }

  const bindIp = serverBindIpInput.value.trim();
  toggleBtn.disabled = true;
  const result = await window.electronAPI.startServer(port, bindIp);
  toggleBtn.disabled = false;

  if (result.success) {
    isRunning = true;
    updateServerUI(result.ip, result.port);
    if (bindIp) {
      await window.electronAPI.addServerBindIpHistory(bindIp);
      serverBindIpHistory = serverBindIpHistory.filter((ip) => ip !== bindIp);
      serverBindIpHistory.unshift(bindIp);
      renderServerBindIpOptions();
    }
    const bindInfo = bindIp || '0.0.0.0';
    addLog(serverLogListEl, `服务器已启动: ${result.ip}:${result.port} (绑定 ${bindInfo})`, 'success');
    showToast(`服务器已启动: ${result.ip}:${result.port}`);
    refreshInterval = setInterval(refreshFiles, 2000);
  } else {
    addLog(serverLogListEl, '启动失败: ' + result.message, 'error');
    showToast('启动失败: ' + result.message);
  }
}

async function stopServer() {
  toggleBtn.disabled = true;
  await window.electronAPI.stopServer();
  toggleBtn.disabled = false;
  isRunning = false;
  updateServerUI(null, null);
  addLog(serverLogListEl, '服务器已停止', 'warn');
  showToast('服务器已停止');
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

function updateServerUI(ip, port) {
  if (isRunning) {
    toggleIcon.textContent = '■';
    toggleText.textContent = '停止';
    toggleBtn.classList.remove('btn-primary');
    toggleBtn.classList.add('btn-danger');
    statusDot.classList.remove('off');
    ipText.textContent = `${ip}:${port}`;
    statusLeft.innerHTML = '<span class="status-running">● 服务运行中</span>';
  } else {
    toggleIcon.textContent = '▶';
    toggleText.textContent = '启动';
    toggleBtn.classList.remove('btn-danger');
    toggleBtn.classList.add('btn-primary');
    statusDot.classList.add('off');
    ipText.textContent = '服务器未启动';
    statusLeft.innerHTML = '<span class="status-stopped">● 服务未启动</span>';
  }
}

async function refreshFiles() {
  const files = await window.electronAPI.getFiles();
  renderFileList(fileListEl, files, 'server');
}

async function refreshReceiveFiles() {
  const files = await window.electronAPI.getReceiveFiles();
  renderFileList(receiveFileListEl, files, 'receive');
}

function renderFileList(container, files, context) {
  if (!files || files.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📂</div>
        <span>暂无文件</span>
      </div>
    `;
    return;
  }

  container.innerHTML = files.map((f) => `
    <div class="file-item">
      <div class="file-icon">${getFileIcon(f.name)}</div>
      <div class="file-info">
        <div class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
        <div class="file-meta">${f.sizeText} · ${formatDate(f.modified)}</div>
      </div>
      <div class="file-actions">
        ${context === 'server' ? `<button onclick="deleteFile('${escapeHtml(f.name)}')">删除</button>` : ''}
        ${context === 'client' ? `<button onclick="downloadFromServer('${escapeHtml(f.name)}')">下载</button>` : ''}
        ${context === 'receive' ? `<button onclick="openReceiveFile('${escapeHtml(f.name)}')">打开</button>` : ''}
      </div>
    </div>
  `).join('');
}

window.deleteFile = async (fileName) => {
  const result = await window.electronAPI.deleteFile(fileName);
  if (result.success) {
    addLog(serverLogListEl, '已删除文件: ' + fileName, 'warn');
    showToast('已删除: ' + fileName);
    refreshFiles();
  }
};

window.openReceiveFile = async (fileName) => {
  await window.electronAPI.openReceiveDir();
};

// Client mode
connectBtn.addEventListener('click', async () => {
  const ip = serverIpInput.value.trim();
  const port = serverPortInput.value.trim();
  if (!ip) {
    showToast('请输入服务器 IP');
    return;
  }
  clientBaseUrl = `http://${ip}:${port}`;
  connectBtn.disabled = true;
  try {
    const res = await fetch(`${clientBaseUrl}/api/status`);
    const data = await res.json();
    if (data.success) {
      await fetch(`${clientBaseUrl}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, name: 'Windows 电脑', platform: 'desktop' })
      });
      isClientConnected = true;
      disconnectBtn.disabled = false;
      connectBtn.textContent = '已连接';
      await window.electronAPI.addClientServerIpHistory(ip);
      clientServerIpHistory = clientServerIpHistory.filter((item) => item !== ip);
      clientServerIpHistory.unshift(ip);
      renderClientServerIpOptions();
      addLog(clientLogListEl, `已连接到服务器: ${clientBaseUrl}`, 'success');
      showToast('连接服务器成功');
      refreshServerFiles();
      clientRefreshInterval = setInterval(refreshServerFiles, 3000);
      clientPollInterval = setInterval(pollPendingFiles, 3000);
    } else {
      throw new Error('响应异常');
    }
  } catch (e) {
    addLog(clientLogListEl, '连接失败: ' + e.message, 'error');
    showToast('连接失败: ' + e.message);
    connectBtn.disabled = false;
  }
});

disconnectBtn.addEventListener('click', () => {
  isClientConnected = false;
  addLog(clientLogListEl, '已断开服务器连接', 'warn');
  clientBaseUrl = '';
  disconnectBtn.disabled = true;
  connectBtn.disabled = false;
  connectBtn.textContent = '连接';
  serverFileListEl.innerHTML = `
    <div class="empty-state">
      <div class="icon">📂</div>
      <span>未连接服务器</span>
    </div>
  `;
  if (clientRefreshInterval) {
    clearInterval(clientRefreshInterval);
    clientRefreshInterval = null;
  }
  if (clientPollInterval) {
    clearInterval(clientPollInterval);
    clientPollInterval = null;
  }
  showToast('已断开连接');
});

async function refreshServerFiles() {
  if (!isClientConnected) return;
  try {
    const res = await fetch(`${clientBaseUrl}/api/files`);
    const data = await res.json();
    renderFileList(serverFileListEl, data.files.map(f => ({ ...f, sizeText: f.sizeText || formatBytes(f.size) })), 'client');
  } catch (e) {
    showToast('获取服务器文件失败');
  }
}

window.downloadFromServer = async (fileName) => {
  showToast('开始下载: ' + fileName);
  addLog(clientLogListEl, '开始下载: ' + fileName, 'info');
  const result = await window.electronAPI.downloadFromServer(clientBaseUrl, fileName);
  if (result.success) {
    addLog(clientLogListEl, '下载完成: ' + result.fileName, 'success');
    showToast('下载完成: ' + result.fileName);
    refreshReceiveFiles();
  } else {
    addLog(clientLogListEl, '下载失败: ' + result.message, 'error');
    showToast('下载失败: ' + result.message);
  }
};

async function pollPendingFiles() {
  if (!isClientConnected) return;
  try {
    const res = await fetch(`${clientBaseUrl}/api/pending/${clientId}`);
    const data = await res.json();
    if (data.success && data.files && data.files.length > 0) {
      for (const file of data.files) {
        addLog(clientLogListEl, '服务器发送文件: ' + file.name, 'info');
        showToast('服务器发送文件: ' + file.name);
        await window.electronAPI.downloadFromServer(clientBaseUrl, file.name);
      }
      refreshReceiveFiles();
    }
  } catch (e) {
    // ignore polling errors
  }
}

clientUploadZone.addEventListener('click', async () => {
  const result = await window.electronAPI.selectFilesForUpload();
  if (!result.success) return;
  addLog(clientLogListEl, `正在上传 ${result.files.length} 个文件...`, 'info');
  showToast(`正在上传 ${result.files.length} 个文件...`);
  const uploadResult = await window.electronAPI.uploadToServer(clientBaseUrl, result.files);
  if (uploadResult.success) {
    addLog(clientLogListEl, '上传成功', 'success');
    showToast('上传成功');
    refreshServerFiles();
  } else {
    addLog(clientLogListEl, '上传失败: ' + uploadResult.message, 'error');
    showToast('上传失败: ' + uploadResult.message);
  }
});

document.getElementById('clientChangeReceiveDir').addEventListener('click', async () => {
  const result = await window.electronAPI.setReceiveDir();
  if (result.success) {
    receiveDirPathEl.textContent = result.path;
    clientReceiveDirPathEl.textContent = result.path;
    addLog(clientLogListEl, '接收目录已更改: ' + result.path, 'info');
    showToast('接收目录已更改');
    refreshReceiveFiles();
  }
});

document.getElementById('clientOpenReceiveDir').addEventListener('click', () => window.electronAPI.openReceiveDir());

clearServerIpHistoryBtn.addEventListener('click', async () => {
  await window.electronAPI.clearServerBindIpHistory();
  serverBindIpHistory = [];
  renderServerBindIpOptions();
  showToast('已清除 IP 历史');
});

refreshServerIpBtn.addEventListener('click', async () => {
  localIPs = await window.electronAPI.getLocalIPs();
  renderServerBindIpOptions();
  showToast('本机 IP 已刷新');
});

clearClientIpHistoryBtn.addEventListener('click', async () => {
  await window.electronAPI.clearClientServerIpHistory();
  clientServerIpHistory = [];
  renderClientServerIpOptions();
  showToast('已清除 IP 历史');
});

serverBindIpInput.addEventListener('change', () => {
  window.electronAPI.setSelectedServerBindIp(serverBindIpInput.value.trim());
});

serverIpInput.addEventListener('change', () => {
  window.electronAPI.setSelectedClientServerIp(serverIpInput.value.trim());
});

// Drag and drop server
dropZone.addEventListener('click', async () => {
  const result = await window.electronAPI.selectFilesToShare();
  if (result.success) {
    addLog(serverLogListEl, `已添加 ${result.files.length} 个文件到共享`, 'success');
    showToast(`已添加 ${result.files.length} 个文件`);
    refreshFiles();
  }
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  });
});

dropZone.addEventListener('drop', async (e) => {
  const files = Array.from(e.dataTransfer.files);
  if (files.length === 0) return;
  showToast('请使用「点击选择文件」按钮添加文件');
});

// Clients handling
window.electronAPI.onClientsChanged((event, data) => {
  clients = data || [];
  renderClients();
});

function renderClients() {
  if (!clients || clients.length === 0) {
    clientsListEl.innerHTML = `
      <div class="empty-state small">
        <span>暂无客户端连接</span>
      </div>
    `;
    return;
  }

  clientsListEl.innerHTML = clients.map(c => `
    <div class="client-card">
      <div class="client-name">${escapeHtml(c.name)}</div>
      <div class="client-meta">${escapeHtml(c.platform)} · ${c.id.substring(0, 8)}</div>
      <div class="push-files">
        <select id="pushSelect-${c.id}">
          <option value="">选择要发送的文件</option>
          ${Array.from(fileListEl.querySelectorAll('.file-name')).map(el => `<option value="${escapeHtml(el.title)}">${escapeHtml(el.textContent)}</option>`).join('')}
        </select>
        <button class="btn btn-primary" onclick="pushFileToClient('${c.id}')">发送文件</button>
      </div>
    </div>
  `).join('');
}

window.pushFileToClient = async (clientId) => {
  const select = document.getElementById(`pushSelect-${clientId}`);
  const fileName = select.value;
  if (!fileName) {
    showToast('请选择要发送的文件');
    return;
  }
  const result = await window.electronAPI.pushFile(clientId, fileName);
  if (result.success) {
    addLog(serverLogListEl, `已向客户端发送文件: ${fileName}`, 'success');
    showToast('已发送: ' + fileName);
  } else {
    addLog(serverLogListEl, '发送失败: ' + result.message, 'error');
    showToast('发送失败: ' + result.message);
  }
};

// Utilities
function addLog(container, message, type = 'info') {
  if (!container) return;
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  entry.innerHTML = `<span class="log-time">[${time}]</span>${escapeHtml(message)}`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

function getFileIcon(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const map = {
    jpg: '🖼', jpeg: '🖼', png: '🖼', gif: '🖼', webp: '🖼',
    mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬',
    mp3: '🎵', wav: '🎵', flac: '🎵',
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📊', pptx: '📊',
    zip: '📦', rar: '📦', '7z': '📦',
    apk: '📱', exe: '💻'
  };
  return map[ext] || '📄';
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

let toastTimer = null;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 3000);
}

init();
