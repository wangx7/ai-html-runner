# AI HTML Runner 🚀
> 专为移动端打造的 AI HTML 产物秒级沙箱运行器 · 100% 支持 Vue / React / Element UI / Canvas / CSS 动画

在 AI 时代，Claude Artifacts、ChatGPT、DeepSeek、v0 等工具经常产出包含动态框架、复杂 CSS、交互状态机的单文件 HTML。由于移动端微信生态及微信个人小程序的沙箱限制，在手机上运行这些动态应用常常出现语法报错、模板裸露 `{{...}}` 或白屏。

**AI HTML Runner** 运行在真实的移动浏览器（Safari / Chrome / 微信外部浏览器）中，通过纯前端 `Blob URL` 沙箱技术，**让所有前端框架和动态特效 100% 满血复活运行**！

---

## ✨ 核心特性

- 📋 **一键从剪贴板粘贴并运行**：针对手机触控优化，点击按钮直接调用系统剪贴板并立即加载，省去长按全选的繁琐。
- ⚡ **100% 动态运行时支持**：原生支持 Vue 2/3、React、Element UI、Tailwind、ECharts、Three.js、Canvas 动画及各种点击弹窗交互。
- 🇨🇳 **国内 CDN 镜像自动替换**：自动将 `unpkg.com`、`jsdelivr` 镜像重写为 `npm.elemecdn.com`，解决国内访问白屏、卡死问题。
- 📱 **智能 Viewport 注入**：AI 经常遗漏 `<meta name="viewport">`，导致手机端变成 980px 微缩字体；本工具自动探测并注入视口补丁。
- 🎯 **手机原型脱壳自适应**：自动剥离电脑端原型模拟外壳（如 `.stage`、`.phone-frame`），让界面满屏贴合真机。
- 🛠️ **移动端悬浮胶囊 (FAB) 与控制台**：预览时随时一键返回编辑、强制重载，并能打开控制台抽屉捕获报错日志。
- 🔒 **100% 纯本地离线沙箱**：零服务器成本、零后端接口、零数据上传，彻底保护代码与数据隐私。

---

## 🚀 部署至 GitHub Pages 指南

你可以选择以下任意一种方式将本项目发布上线：

### 方式 A：新建独立 GitHub 仓库（推荐）

1. 在 GitHub 上新建一个公开仓库（例如命名为 `ai-html-runner`）。
2. 将本目录（`html-runner`）中的文件推送到新仓库：
   ```bash
   cd html-runner
   git init
   git add .
   git commit -m "feat: initial commit of ai-html-runner"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/ai-html-runner.git
   git push -u origin main
   ```
3. 在 GitHub 仓库页面中点击 **Settings -> Pages**：
   - **Source** 选择 `Deploy from a branch`；
   - **Branch** 选择 `main`，目录选择 `/ (root)`，点击 **Save**。
4. 约 1 分钟后，即可获得专属访问链接：
   `https://<你的用户名>.github.io/ai-html-runner/`

---

### 方式 B：直接使用现有仓库的 `/docs` 目录

如果你想直接复用现有的仓库：
1. 将 `html-runner/` 目录中的 `index.html`、`style.css`、`app.js` 复制到仓库根目录的 `docs/` 文件夹中。
2. 在仓库的 **Settings -> Pages** 中：
   - **Branch** 选择 `main`，目录选择 `/docs`，点击 **Save**。
3. 访问链接为：
   `https://<你的用户名>.github.io/<仓库名>/`

---

## 📱 手机端使用小技巧

1. **添加到主屏幕（变成独立 App）**：
   - 在 iPhone Safari 中打开页面，点击底部分享按钮 -> **「添加到主屏幕」**；
   - 在 Android Chrome 中点击右上角菜单 -> **「添加到主屏幕」**。
   - 之后即可像原生 App 一样全屏打开，随时随地粘贴并运行 AI 产出的任何 HTML！
2. **极速流转工作流**：
   - 在微信聊天或文档中长按复制 HTML 代码；
   - 打开本应用，点击顶部的 **「📋 粘贴并运行」**；
   - 界面瞬间满血运行呈现！
