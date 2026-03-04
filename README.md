<div align="center">

<img width="1299" height="424" alt="cheating-daddy" src="https://github.com/user-attachments/assets/b25fff4d-043d-4f38-9985-f832ae0d0f6e" />

# Cheating Buddy - AI 面试辅助神器

[![Version](https://img.shields.io/badge/version-v2.3.0-blue.svg)](https://github.com/JuliusJu572/cheating-daddy-china/releases/tag/v2.3.0)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)]()

**你的实时 AI 僚机** — 通过屏幕捕捉与音频分析，在视频面试、会议、谈判中提供隐蔽且强大的实时辅助。

[功能特性](#-功能特性) • [下载安装](#-下载与安装) • [使用指南](#-使用指南) • [快捷键](#-键盘快捷键) • [常见问题](#-常见问题) • [开发者文档](#-开发者文档)

</div>

---

> [!IMPORTANT]
> **v2.3.0 重大更新**：新增多模型切换（Qwen3.5-Plus/Qwen3-Max）、上下文记忆开关、配置持久化等功能。请务必更新至最新版以获得最佳体验。

---

## ✨ 功能特性

### 🧠 强大的 AI 内核
- **多模型支持**：
  - **文本模型**：默认搭载 **Qwen3.5-Plus**，可切换至更强大的 **Qwen3-Max**。
  - **视觉模型**：集成 **Qwen3-VL-Plus**，精准识别屏幕代码与图表。
  - **语音识别**：采用 **Qwen3-ASR-Flash**，毫秒级实时语音转文字。
- **智能上下文管理**：
  - **多轮对话**：支持连续追问，AI 记住上下文。
  - **单轮模式**：可关闭上下文记忆（Enable Context），解决 Token 消耗过快或消息累积问题。

### 🛡️ 隐蔽与安全
- **透明悬浮窗**：窗口始终置顶，背景透明度可调，完美融入桌面。
- **点击穿透 (Click-through)**：一键让鼠标穿透窗口，不影响底层操作。
- **防录屏保护 (Stealth Mode)**：
  - 开启内容保护后，直播软件（如 OBS、腾讯会议、飞书）无法捕获悬浮窗内容。
  - **隐身模式**：窗口在截图/录屏中完全不可见。

### ⚙️ 便捷管理
- **配置持久化**：模型选择、Token 限制、API Key 等设置自动保存，重启无需重配。
- **License Key 系统**：一次激活，自动验证，支持在线更新。
- **多场景预设**：内置面试、销售、会议、演示等 Prompt 模板，一键切换 AI 人设。

---

## 📥 下载与安装

### Windows 详细安装教程

#### 步骤 1：安装应用程序

1. 访问 [Releases 页面](https://github.com/JuliusJu572/cheating-daddy-china/releases/tag/v2.3.0)
2. 下载对应的 `.exe` 安装包
3. 双击下载的文件
4. 如果出现"Windows 保护了你的电脑"提示：
   - 点击 **"更多信息"**
   - 然后点击 **"仍要运行"**
5. 按照安装向导完成安装

#### 步骤 2：安装 ffmpeg（必须）

**方法一：使用包管理器（推荐）**

**使用 Scoop（推荐）**
```powershell
# 安装 Scoop
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

# 安装 ffmpeg
scoop install ffmpeg
```

**使用 Chocolatey**
```powershell
# 先安装 Chocolatey，然后
choco install ffmpeg
```

**方法二：手动安装**

1. 访问 [ffmpeg 官网](https://ffmpeg.org/download.html#build-windows)
2. 下载 **"ffmpeg-release-essentials.zip"**
3. 解压到 `C:\ffmpeg`
4. 将 `C:\ffmpeg\bin` 添加到系统环境变量 PATH
5. 验证安装：打开新的终端输入 `ffmpeg -version`

#### 步骤 3：配置应用权限

1. 打开应用程序
2. 允许麦克风/屏幕录制权限
3. Windows 10/11 可能需要在 **设置 → 隐私** 中手动授权

#### 步骤 4：开始使用

1. 打开应用程序
2. 输入您的 License Key（首次使用）
3. 在设置中选择使用档案（面试、销售、会议等）
4. 点击 **"Start Session"**

---

### macOS 详细安装教程

#### 步骤 1：安装应用程序

1. 访问 [Releases 页面](https://github.com/JuliusJu572/cheating-daddy-china/releases/tag/v2.3.0)
2. 下载对应的 `.dmg` 安装包
3. 双击打开，将应用图标拖拽到 **"应用程序"** 文件夹

#### 步骤 2：移除隔离属性（必须操作！）

由于应用未经 Apple 公证，需要手动移除隔离属性：

```bash
# 移除隔离属性
sudo xattr -cr /Applications/Cheating\ Buddy.app

# 验证是否成功（应该没有输出）
xattr -l /Applications/Cheating\ Buddy.app
```

#### 步骤 3：安装 ffmpeg

```bash
# 使用 Homebrew 安装（推荐）
brew install ffmpeg

# 验证安装
ffmpeg -version
```

#### 步骤 4：配置系统权限

**屏幕录制权限**
1. 打开 **"系统设置"** → **"隐私与安全性"** → **"屏幕录制"**
2. 点击左下角的 **锁图标** 解锁
3. 找到 **"Cheating Buddy"** 并勾选

**麦克风权限**
1. 在 **"系统设置"** → **"隐私与安全性"** → **"麦克风"**
2. 找到 **"Cheating Buddy"** 并勾选

> **⚠️ 重要提示**：设置权限后需要 **完全退出** 应用，然后重新打开才能生效。

#### 步骤 5：首次启动应用

1. 打开 **"应用程序"** 文件夹，双击 **"Cheating Buddy"**
2. 如果出现 **"无法打开"** 提示：
   - **右键点击** 应用图标
   - 按住 **Option** 键，选择 **"打开"**
3. 输入您的 License Key
4. 开始使用

---

## 🚀 使用指南

### 1. 初始化设置
- 启动应用后，输入 **License Key** 进行激活。
- 进入设置页面（点击齿轮图标），根据需要选择：
  - **文本模型**：推荐日常使用 `qwen3.5-plus`，高难度问题切换 `qwen3-max`。
  - **启用上下文**：默认开启。若发现回答变慢或消息数异常，可关闭此选项。

### 2. 开始辅助
- 点击 **"Start Session"** 开启会话。
- **面试/会议中**：
  - AI 会自动监听麦克风和系统音频，实时转写并生成建议。
  - 若需要针对屏幕特定内容提问，使用快捷键截图。

### 3. 隐身操作
- 使用 `Ctrl + M` (Windows) / `Cmd + M` (macOS) 开启点击穿透，此时鼠标可直接操作悬浮窗下方的文件。
- 再次按下快捷键即可恢复对悬浮窗的操作。

---

## ⌨️ 键盘快捷键

| 功能 | Windows | macOS | 说明 |
|------|---------|-------|------|
| **移动窗口** | `Ctrl + 方向键` | `Cmd + 方向键` | 微调悬浮窗位置 |
| **点击穿透** | `Ctrl + M` | `Cmd + M` | 鼠标穿透开关 |
| **隐藏/显示** | `Ctrl + \` | `Cmd + \` | 快速老板键 |
| **系统录音** | `Ctrl + L` | `Cmd + L` | 开关系统音频捕获 |
| **麦克风录音** | `Ctrl + K` | 暂不支持 | 开关麦克风捕获 |
| **截屏提问** | `Ctrl + Enter` | `Cmd + Enter` | 截取当前屏幕并发送给 AI |
| **发送消息** | `Enter` | `Enter` | 发送文本框内容 |
| **清空对话** | `Ctrl + '` | `Cmd + '` | 清除当前屏幕的历史记录 |

---

## ❓ 常见问题

**Q: 设置里的模型修改后为什么没变？**
A: v2.3.0 已修复此问题。现在所有设置（包括模型选择、Token 数）都会自动保存到本地配置文件 `config.json` 中。

**Q: 为什么消息数会自己增加 (2->4->6)？**
A: 这是因为开启了上下文记忆。AI 会把历史对话带入下一次请求。如果不需要此功能，请在设置中关闭 **"启用上下文 (Enable Context)"**。

**Q: 提示 "ffmpeg not found"？**
A: 请确保已安装 ffmpeg 并将其加入到了系统的环境变量 PATH 中。安装后尝试重启电脑。

**Q: macOS 提示文件损坏？**
A: 请务必在终端执行 `sudo xattr -cr /Applications/Cheating\ Buddy.app` 来移除安全隔离属性。

---

## 📚 开发者文档

项目技术文档位于 `docs/` 目录，包含功能实现说明、技术路线图及关键实现细节：

| 文档 | 说明 |
|------|------|
| [软件端功能实现](docs/software-flow-20260304-143204.md) | Electron 桌面应用功能、IPC 通道、数据流、本地存储 |
| [后端管理界面实现](docs/backend-admin-flow-20260304-143204.md) | API 接口、鉴权、管理页面、AI 代理计费、关键实现细节 |
| [数据库设计与实现](docs/database-flow-20260304-143204.md) | 表结构、迁移流程、token 监控、资源隔离、索引策略 |

---

## 🛠 技术栈

- **Frontend**: LitElement, Web Components
- **Electron**: IPC, System Integration
- **AI Core**: Alibaba Qwen (Tongyi Qianwen) API
- **Audio/Video**: FFmpeg, WASAPI, CoreAudio

---

<div align="center">

**Disclaimer**
本项目仅供学习与辅助使用，请勿用于违反法律法规或作弊等不道德用途。
开发者不对使用者的行为承担任何责任。

[![Star History Chart](https://api.star-history.com/svg?repos=JuliusJu572/cheating-daddy-china&type=Date)](https://star-history.com/#JuliusJu572/cheating-daddy-china&Date)

</div>
