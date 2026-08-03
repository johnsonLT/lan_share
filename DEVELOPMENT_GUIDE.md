# LanShare 开发过程与工程说明

> 本文档重点记录本项目的工程结构、开发环境、构建过程以及容易出错/耗时较长的环节，方便后续维护或复现。

---

## 一、项目概述

| 项目 | 说明 |
|------|------|
| 名称 | LanShare - 局域网文件互传 |
| 电脑端 | Electron + Node.js + Express |
| 手机端 | Flutter + Dio + file_picker |
| 传输协议 | HTTP/REST，默认端口 **34345** |
| 界面风格 | 参考 iDaily 每日科技 App，深色科技感 |

---

## 二、软件工程结构

```
lan-share/
├── README.md                     # 用户快速使用说明
├── DEVELOPMENT_GUIDE.md          # 本开发说明文档
│
├── lan-share-desktop/            # 电脑端（Electron）
│   ├── main.js                   # Electron 主进程 + Express 文件服务器
│   ├── preload.js                # 渲染进程与主进程安全桥接
│   ├── renderer.js               # 前端界面逻辑
│   ├── index.html                # 主界面
│   ├── style.css                 # iDaily 风格样式
│   ├── package.json              # 依赖与 electron-builder 打包配置
│   ├── shared/                   # 共享文件目录（运行时创建）
│   └── dist/                     # 打包输出目录
│       ├── LanShare Setup 1.0.0.exe   # 安装版
│       └── LanShare 1.0.0.exe         # 便携版
│
└── lan-share-mobile/             # 手机端（Flutter）
    ├── pubspec.yaml              # Flutter 依赖配置
    ├── lib/main.dart             # 完整 App 代码（连接页 + 文件列表页）
    ├── android/
    │   ├── build.gradle.kts      # 根构建脚本，含 compileSdk=36 强制覆盖
    │   ├── app/build.gradle.kts  # App 模块构建脚本
    │   ├── app/src/main/AndroidManifest.xml  # 权限声明
    │   └── gradle/wrapper/gradle-wrapper.properties  # Gradle 分发配置
    └── build/app/outputs/flutter-apk/app-release.apk   # Release APK
```

---

## 三、必须安装的软件清单

所有新安装软件均位于 `D:\04_ProgramFiles`。

| 软件 | 路径 | 版本 | 用途 | 备注 |
|------|------|------|------|------|
| Node.js | `C:\Program Files\nodejs` | v24.18.0 | 电脑端运行/打包 | 系统已预装 |
| Flutter SDK | `D:\04_ProgramFiles\flutter` | 3.44.8 | 手机端构建 | 从 Gitee 镜像克隆 |
| Android SDK | `D:\04_ProgramFiles\android-sdk` | API 36 / Build Tools 36 | 编译 Android APK | 通过 cmdline-tools 安装 |
| JDK | `D:\04_ProgramFiles\jdk-17` | 17.0.19+10 | Android 构建必需 | 从 Tuna 镜像下载 |

> ⚠️ **注意**：系统原有 Java 8（`C:\Program Files (x86)\Java\jdk1.8.0_144`）无法用于 Flutter/Android 构建，必须单独安装 JDK 17 并在构建时显式设置 `JAVA_HOME`。

---

## 四、开发过程重点

### 4.1 电脑端（Electron）

1. 初始化 Node.js 项目，安装 `electron`、`express`、`multer`、`cors`。
2. `main.js` 中同时负责：
   - Electron 窗口创建（无边框、自定义标题栏）
   - Express HTTP 文件服务（`/api/files`、`/api/upload`、`/api/download`）
   - 本机 IP 获取、共享目录管理
3. 使用 `electron-builder` 打包为 `exe`。

**关键配置**：

```json
// package.json build 字段
"build": {
  "appId": "com.lanshare.desktop",
  "productName": "LanShare",
  "win": {
    "target": [{ "target": "nsis", "arch": ["x64"] }]
  }
}
```

### 4.2 手机端（Flutter）

1. 使用 `flutter create --org com.hirain --platforms android lan-share-mobile` 生成项目。
2. 替换 `pubspec.yaml` 与 `lib/main.dart`。
3. 修改 Android 配置：
   - `android/app/build.gradle.kts`：`compileSdk = 36`，`minSdk = 21`
   - `android/build.gradle.kts`：添加 `subprojects { afterEvaluate { ... compileSdk = 36 } }` 强制所有插件使用 API 36
   - `AndroidManifest.xml`：声明 `INTERNET`、存储读写等权限
4. 执行 `flutter build apk --release`。

---

## 五、⚠️ 容易出错 / 耗时较长的环节（重点）

### 5.1 Flutter SDK 安装与初始化（耗时 10~30 分钟）

- **问题 1：从 GitHub 直接克隆 Flutter 经常中断。**
  - 解决：使用 Gitee 镜像
    ```bash
    git clone https://gitee.com/mirrors/Flutter.git -b stable --depth 1 D:\04_ProgramFiles\flutter
    ```

- **问题 2：Flutter 首次运行会下载 Dart SDK，PowerShell 下载极慢或卡死。**
  - 解决：手动下载 Dart SDK 并解压到 `flutter/bin/cache/dart-sdk`
    ```bash
    curl -L -o dart-sdk.zip https://storage.flutter-io.cn/flutter_infra_release/flutter/<engine>/dart-sdk-windows-x64.zip
    unzip dart-sdk.zip -d flutter/bin/cache/
    echo "<engine>" > flutter/bin/cache/engine-dart-sdk.stamp
    ```
  - 然后在 `flutter/bin/flutter` 中注释掉 Windows 下调用 `flutter.bat` 的逻辑，强制走 bash 脚本，避免 PowerShell。
  - 在 `flutter/bin/internal/shared.sh` 中将 `_lock` 函数改为 `mkdir` 锁，避免 `flock` 在 MSYS2 中失败导致无限等待。

- **问题 3：`.upgrade_lock` 锁文件被残留进程占用。**
  - 解决：使用 Windows `taskkill` 彻底结束 `flutter.bat`、`dart.exe`、`powershell.exe`、`java.exe` 后，再删除 `flutter/bin/cache/.upgrade_lock`。

### 5.2 Android SDK 与 JDK 配置（耗时 30~60 分钟）

- **问题 1：`sdkmanager` 报 `JAVA_HOME is set to an invalid directory`。**
  - 原因：系统 `JAVA_HOME` 指向了 `...\jdk1.8.0_144\bin`（多了 `\bin`），且 Java 8 太旧。
  - 解决：安装 JDK 17，每次构建时显式设置
    ```bash
    export JAVA_HOME=/d/04_ProgramFiles/jdk-17
    ```

- **问题 2：Android SDK 许可未接受导致组件安装失败。**
  - 解决：
    ```batch
    @echo off
    set JAVA_HOME=D:\04_ProgramFiles\jdk-17
    set ANDROID_HOME=D:\04_ProgramFiles\android-sdk
    echo y | sdkmanager.bat --licenses
    sdkmanager.bat platform-tools "build-tools;36.0.0" "platforms;android-36"
    ```

- **问题 3：Flutter 默认需要 API 35/36，首次构建会自动下载 NDK、CMake、Platform 35。**
  - 这是正常现象，但首次构建会因此增加十几分钟。
  - 建议保持网络畅通，或提前用 `sdkmanager` 安装好 `ndk;28.2.13676358`、`cmake;3.22.1`、`platforms;android-35`。

### 5.3 Gradle Wrapper 下载（非常耗时，首次 10~20 分钟）

- **问题 1：Gradle 官方地址下载极慢或超时。**
  - 解决：修改 `android/gradle/wrapper/gradle-wrapper.properties`
    ```properties
    distributionUrl=https\://mirrors.aliyun.com/gradle/distributions/v9.1.0/gradle-9.1.0-all.zip
    ```

- **问题 2：下载中断后残留 `.lck` / `.part` 文件，导致后续构建一直提示超时。**
  - 解决：结束所有 Java 进程，删除 `C:\Users\<用户名>\.gradle\wrapper\dists\gradle-9.1.0-all\` 下对应的失败目录。

- **问题 3：即使使用镜像，也可能因缓存不一致重新下载。**
  - 最稳妥方案：手动下载 `gradle-9.1.0-all.zip`，然后在 `gradle-wrapper.properties` 中改为 `file\:///C:/.../gradle-9.1.0-all.zip` 本地文件路径。

### 5.4 Flutter 引擎/依赖下载（耗时 5~15 分钟）

- **问题：`storage.flutter-io.cn` 偶发返回 HTML 错误页，导致 Gradle 解析 POM 失败。**
  - 错误示例：
    ```
    [Fatal Error] arm64_v8a_release-...pom:2:10: 已经禁止 doctype
    Could not parse POM https://storage.flutter-io.cn/...
    ```
  - 解决：删除 Gradle 缓存中的错误文件
    ```bash
    rm -rf /c/Users/<用户名>/.gradle/caches/modules-2/files-2.1/io.flutter
    ```
    然后重新构建。

### 5.5 `file_picker` 插件的 compileSdk 冲突

- **问题：构建时报 `file_picker is currently compiled against android-34`。**
  - 原因：插件默认使用较低的 `compileSdk`，但 Flutter 环境要求 36。
  - 解决：在 `android/build.gradle.kts` 中统一强制所有子项目使用 `compileSdk = 36`
    ```kotlin
    subprojects {
        afterEvaluate {
            val android = project.extensions.findByType(com.android.build.api.dsl.CommonExtension::class.java)
            android?.compileSdk = 36
        }
        project.evaluationDependsOn(":app")
    }
    ```
  - ⚠️ 注意：必须放在同一个 `subprojects` 块中，且使用 `CommonExtension`，否则会出现 `afterEvaluate already evaluated` 或类型不匹配错误。

### 5.6 Flutter ThemeData API 变更

- **问题：`CardTheme` 无法赋值给 `CardThemeData?`。**
  - 原因：Flutter 3.44 中 `ThemeData.cardTheme` 类型变为 `CardThemeData?`。
  - 解决：将 `CardTheme(...)` 改为 `CardThemeData(...)`。

### 5.7 Electron 打包下载慢

- **问题：`electron-builder` 默认从 GitHub 下载 Electron 与签名工具，容易失败。**
  - 解决：设置镜像环境变量
    ```bash
    export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
    npm run dist
    ```

---

## 六、推荐构建环境变量

在 Windows Git Bash 中执行构建前，建议统一设置：

```bash
export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn
export PUB_HOSTED_URL=https://pub.flutter-io.cn
export JAVA_HOME=/d/04_ProgramFiles/jdk-17
export FLUTTER_GIT_URL=https://gitee.com/mirrors/Flutter.git
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
```

---

## 七、常用构建命令

```bash
# 电脑端开发运行
cd lan-share-desktop
npm install
npm start

# 电脑端打包
cd lan-share-desktop
npm run dist          # 安装包
npm run dist:portable # 便携版

# 手机端打包
cd lan-share-mobile
/d/04_ProgramFiles/flutter/bin/flutter pub get
/d/04_ProgramFiles/flutter/bin/flutter build apk --release
```

---

## 八、v2 新增功能实现要点

### 8.1 手机端 IP 历史记录

- 使用 `shared_preferences` 存储历史 IP 列表
- 连接页提供下拉菜单（PopupMenuButton）和历史 Chip
- 支持一键清空

### 8.2 手机端文件接收目录持久化

- 使用 `shared_preferences` 存储用户选择的目录路径
- 默认路径为 `Downloads/LanShare`
- 通过 `file_picker` 的 `getDirectoryPath()` 让用户选择目录

### 8.3 电脑端客户端模式

- Electron 渲染进程提供「服务器模式 / 客户端模式」切换
- 客户端模式通过 HTTP 连接远端服务器
- 支持浏览服务器文件、上传、下载
- 使用 `localStorage` 生成并持久化 `clientId`

### 8.4 服务器向客户端推送文件

- 服务器集成 `socket.io`，客户端连接后发送 `register` 事件
- 服务器 UI 显示已连接客户端列表
- 选择文件和客户端后，服务器发送 `push_file` 事件
- 移动端通过 Socket.IO 监听并自动下载
- 桌面客户端通过 HTTP 轮询 `/api/pending/:clientId` 获取待接收文件

### 8.5 文件接收地址

- 电脑端：`electron-store` 持久化 `receiveDir`，默认在 `%appdata%/LanShare/received`
- 手机端：`shared_preferences` 持久化接收目录

### 8.6 窗口大小持久化与恢复

- `electron-store` 保存窗口 `bounds`
- 新增「恢复默认大小」按钮，将窗口设为 900×680 并居中

### 8.7 共享文件夹自定义

- 电脑端通过对话框选择目录
- `electron-store` 持久化 `sharedDir`
- 下次启动自动加载上次选择的目录

---

## 九、⚠️ 新增坑点

### 9.1 项目与 pub cache 不在同一磁盘导致 Kotlin 编译失败

**现象**：
```
Could not close incremental caches ... class-fq-name-to-source.tab
this and base files have different roots: C:\...\pub.cache\... and D:\...
```

**解决**：
1. 设置 `PUB_CACHE=D:\04_ProgramFiles\pub-cache`
2. 在 `android/gradle.properties` 中添加：
   ```properties
   org.gradle.daemon=false
   kotlin.incremental=false
   ```
3. 构建前结束所有 `java.exe` 进程

### 9.2 `CardTheme` 类型变更

Flutter 3.44 中 `ThemeData.cardTheme` 需要 `CardThemeData`，不是 `CardTheme`。

### 9.3 `file_picker` 与 `compileSdk` 冲突

`file_picker` 依赖的库要求 `compileSdk` 至少 36，需在 `android/build.gradle.kts` 中统一强制所有子项目 `compileSdk = 36`。

---

## 十、后续维护建议

1. **不要随意升级 Flutter 版本**：每个新版本可能伴随 Gradle/AGP/compileSdk 要求变化，容易重新触发 5.5、5.6、9.1 类问题。
2. **保留本地 Gradle zip 缓存**：首次下载成功后，备份 `gradle-9.1.0-all.zip`，后续可改为 `file:///` 路径避免网络问题。
3. **构建前检查环境变量**：特别是 `JAVA_HOME` 和 `PUB_CACHE`。
4. **清理缓存要谨慎**：删除 `.gradle/caches` 会丢失大量已下载依赖，首次重新构建会非常慢。
5. **Git 忽略打包产物**：`dist/`、`build/`、`.dart_tool/`、`node_modules/` 等不要提交到仓库。
