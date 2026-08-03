# LanShare - 局域网文件互传

一款手机和电脑在局域网内互传文件的工具。电脑端封装为 `exe`，手机端封装为 `apk`，无需复杂配置即可使用。

## 功能特性

- 💻 **电脑端（exe）**：
  - 服务器模式：启动 HTTP 文件服务器，供手机/其他电脑连接
  - 客户端模式：输入其他设备 IP，连接后上传/下载文件
  - 支持窗口放大、还原、恢复默认大小
  - 共享文件夹和文件接收目录可自定义，持久化保存
  - 可向已连接的客户端推送文件
- 📱 **手机端（apk）**：
  - 输入服务器 IP 自动连接
  - IP 地址历史记录，支持下拉选择和一键清空
  - 文件接收目录可自定义，持久化保存
  - 支持接收服务器主动推送的文件
  - 多文件上传、文件下载
- 🔌 **默认端口**：`34345`（可在电脑端服务器模式修改）
- 🎨 **界面风格**：参考 iDaily 每日科技 App，简洁、现代、科技感

## 项目结构

```
lan-share/
├── lan-share-desktop/    # Electron 电脑端
├── lan-share-mobile/     # Flutter 手机端
├── README.md
└── DEVELOPMENT_GUIDE.md  # 开发与构建说明
```

## 快速使用

### 电脑端

已打包好的程序：

- **安装版**：`lan-share-desktop/dist/LanShare Setup 1.0.0.exe`（安装后使用）
- **便携版**：`lan-share-desktop/dist/LanShare 1.0.0.exe`（双击直接运行）

#### 服务器模式
1. 运行程序，切换到「服务器模式」
2. 点击「启动」按钮，界面显示本机 IP 和端口号（默认 34345）
3. 点击「更改」可设置共享文件夹和文件接收目录

#### 客户端模式
1. 切换到「客户端模式」
2. 输入服务器 IP 和端口，点击「连接」
3. 可浏览服务器文件列表，下载或上传文件

### 手机端

已打包好的程序：

- `lan-share-mobile/build/app/outputs/flutter-apk/app-release.apk`

1. 安装后打开 App
2. 输入电脑端显示的服务器 IP 和端口 34345（点击历史 IP 可快速填充）
3. 点击「连接服务器」
4. 点击右上角文件夹图标可设置文件接收目录
5. 可上传、下载文件；服务器推送的文件会自动下载到接收目录

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
set PUB_CACHE=D:\04_ProgramFiles\pub-cache
```

然后执行：

```bash
cd lan-share-mobile
flutter pub get
flutter build apk --release
```

> 注意：如果项目与 pub cache 不在同一磁盘，构建时可能出现 Kotlin 增量缓存错误。设置 `PUB_CACHE` 到与项目相同的 D 盘，并在 `android/gradle.properties` 中禁用 Gradle Daemon 可解决。

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

- 电脑端：Electron + Node.js + Express + Socket.IO
- 手机端：Flutter + Dio + file_picker + Socket.IO Client
- 传输协议：HTTP/REST + WebSocket（用于服务器推送通知）

## 注意事项

- 请确保手机和电脑连接在同一局域网（同一 WiFi）下
- 如果无法连接，请检查防火墙是否允许端口号 `34345` 的访问
- 开发环境如需安装新软件，统一安装到 `D:\04_ProgramFiles`
- 打包产物（`dist/`、`build/`）较大，不建议提交到 Git；建议使用 GitHub Releases 分发
