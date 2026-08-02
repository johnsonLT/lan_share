# LanShare 电脑端

基于 Electron + Node.js + Express 的局域网文件共享服务器。

## 运行

```bash
npm install
npm start
```

## 打包 exe

```bash
npm run dist
```

打包输出目录：`dist/`

## 功能

- 启动/停止 HTTP 文件服务器
- 显示本机局域网 IP 与端口号（默认 34345，可修改）
- 添加文件到共享目录
- 删除共享文件
- 手机端通过 IP:端口 连接后上传/下载文件
