let isRunning = false;
let refreshInterval = null;

const portInput = document.getElementById('port');
const toggleBtn = document.getElementById('toggleServer');
const toggleIcon = document.getElementById('toggleIcon');
const toggleText = document.getElementById('toggleText');
const openDirBtn = document.getElementById('openDir');
const statusDot = document.getElementById('statusDot');
const ipText = document.getElementById('ipText');
const fileListEl = document.getElementById('fileList');
const dropZone = document.getElementById('dropZone');
const toastEl = document.getElementById('toast');
const statusLeft = document.getElementById('statusLeft');
const sharedDirEl = document.getElementById('sharedDir');

document.querySelector('.btn-min').addEventListener('click', () => window.electronAPI.minimizeWindow());
document.querySelector('.btn-max').addEventListener('click', () => window.electronAPI.maximizeWindow());
document.querySelector('.btn-close').addEventListener('click', () => window.electronAPI.closeWindow());

async function init() {
  const sharedDir = await window.electronAPI.getSharedDir();
  sharedDirEl.textContent = sharedDir;
  refreshFiles();
}

toggleBtn.addEventListener('click', async () => {
  if (isRunning) {
    await stopServer();
  } else {
    await startServer();
  }
});

openDirBtn.addEventListener('click', () => window.electronAPI.openSharedDir());

async function startServer() {
  const port = parseInt(portInput.value, 10);
  if (isNaN(port) || port < 1024 || port > 65535) {
    showToast('请输入 1024-65535 之间的有效端口');
    return;
  }

  toggleBtn.disabled = true;
  const result = await window.electronAPI.startServer(port);
  toggleBtn.disabled = false;

  if (result.success) {
    isRunning = true;
    updateUI(result.ip, result.port);
    showToast(`服务器已启动: ${result.ip}:${result.port}`);
    refreshInterval = setInterval(refreshFiles, 2000);
  } else {
    showToast('启动失败: ' + result.message);
  }
}

async function stopServer() {
  toggleBtn.disabled = true;
  await window.electronAPI.stopServer();
  toggleBtn.disabled = false;
  isRunning = false;
  updateUI(null, null);
  showToast('服务器已停止');
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

function updateUI(ip, port) {
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
  renderFileList(files);
}

function renderFileList(files) {
  if (!files || files.length === 0) {
    fileListEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">📂</div>
        <span>暂无共享文件</span>
      </div>
    `;
    return;
  }

  fileListEl.innerHTML = files.map((f) => `
    <div class="file-item">
      <div class="file-icon">${getFileIcon(f.name)}</div>
      <div class="file-info">
        <div class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
        <div class="file-meta">${f.sizeText} · ${formatDate(f.modified)}</div>
      </div>
      <div class="file-actions">
        <button onclick="deleteFile('${escapeHtml(f.name)}')">删除</button>
      </div>
    </div>
  `).join('');
}

window.deleteFile = async (fileName) => {
  const result = await window.electronAPI.deleteFile(fileName);
  if (result.success) {
    showToast('已删除: ' + fileName);
    refreshFiles();
  }
};

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

// Drag and drop
dropZone.addEventListener('click', async () => {
  const result = await window.electronAPI.selectFilesToShare();
  if (result.success) {
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
  // Electron drag-drop from OS is handled in main process; here we just prompt user to use select button
  showToast('请使用「点击选择文件」按钮添加文件');
});

init();
