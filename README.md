# LanShare - 局域网文件互传

一款手机和电脑在局域网内互传文件的工具。电脑端封装为 `exe`，手机端封装为 `apk`，无需复杂配置即可使用。

## 功能特性

- 💻 **电脑端（exe）**：双击启动，点击「启动」按钮即可作为文件服务器运行
- 📱 **手机端（apk）**：输入电脑 IP 地址，自动连接服务器
- 🔌 **默认端口**：`34345`（可在电脑端修改）
- 📤 **多文件上传**：手机端支持多选文件上传到电脑
- 📥 **文件下载**：手机端可浏览电脑共享文件并下载到本地
- 🎨 **界面风格**：参考 iDaily 每日科技 App，简洁、现代、科技感

## 项目结构

```
lan-share/
├── lan-share-desktop/    # Electron 电脑端
├── lan-share-mobile/     # Flutter 手机端
└── README.md
```

## 快速使用

### 电脑端

已打包好的程序：

- **安装版**：`lan-share-desktop/dist/LanShare Setup 1.0.0.exe`（76 MB，安装后使用）
- **便携版**：`lan-share-desktop/dist/LanShare 1.0.0.exe`（69 MB，双击直接运行）

运行后点击「启动」按钮，界面会显示本机 IP 地址和端口号（默认 34345）。

### 手机端

已打包好的程序：

- `lan-share-mobile/build/app/outputs/flutter-apk/app-release.apk`（48 MB）

安装后打开 App，输入电脑端显示的服务器 IP 地址和端口号（默认 34345），点击「连接服务器」即可上传或下载文件。

## 从源码运行

### 电脑端

```bash
cd lan-share-desktop
npm install
npm start
```

### 手机端

需要配置环境变量（建议加入系统环境变量）：

```bash
set FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn
set PUB_HOSTED_URL=https://pub.flutter-io.cn
set JAVA_HOME=D:\04_ProgramFiles\jdk-17
set FLUTTER_GIT_URL=https://gitee.com/mirrors/Flutter.git
```

然后执行：

```bash
cd lan-share-mobile
flutter pub get
flutter build apk --release
```

## 从源码打包

### 电脑端 exe

```bash
cd lan-share-desktop
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npm run dist        # 安装包
npm run dist:portable  # 便携版
```

### 手机端 apk

```bash
cd lan-share-mobile
flutter build apk --release
```

## 技术栈

- 电脑端：Electron + Node.js + Express
- 手机端：Flutter + Dio + file_picker
- 传输协议：HTTP/REST

## 注意事项

- 请确保手机和电脑连接在同一局域网（同一 WiFi）下
- 如果无法连接，请检查防火墙是否允许端口号 `34345` 的访问
- 开发环境如需安装新软件，统一安装到 `D:\04_ProgramFiles`
