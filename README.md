<div align="center">

<img width="1299" height="424" alt="cheating-daddy" src="https://github.com/user-attachments/assets/b25fff4d-043d-4f38-9985-f832ae0d0f6e" />

# Cheating Buddy - AI 面试助手

[![Version](https://img.shields.io/badge/version-v1.2.0-blue.svg)](https://github.com/JuliusJu572/cheating-daddy-china/releases/tag/v1.2.0)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

一个实时 AI 助手，通过屏幕截图与音频分析，在视频通话、面试、演示与会议中提供上下文辅助。

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [安装教程](#-下载与安装教程) • [使用说明](#-使用说明) • [常见问题](#-常见问题排查)

</div>

---

> [!NOTE]
> 请使用最新的 macOS 与 Windows 版本，旧版本系统支持有限

> [!NOTE]
> 测试时如果你直接向它发问可能不会回复，需要模拟"面试官提问"的场景，它会对最后一个问题进行回答

---

## 功能特性

### AI 模型
- **智谱 AI (GLM-4.7)**：强大的文本对话能力
- **GLM-4.6V (视觉模型)**：支持截图识别与图像理解
- **GLM-ASR-2512**：高精度语音识别模型

### 核心功能
- **实时 AI 辅助**：智能分析屏幕内容与音频，提供上下文建议
- **屏幕与音频捕获**：结合屏幕内容与系统/麦克风音频进行多模态分析
- **多档案配置**：内置面试、销售电话、商务会议、演示、谈判等使用档案
- **透明悬浮窗**：窗口始终置顶，可自由移动定位
- **点击穿透模式**：需要时可让窗口对鼠标点击透明
- **内容保护**：防止屏幕录制软件捕获窗口内容
- **跨平台支持**：支持 macOS 与 Windows

### License Key 管理
- 首次使用输入 License Key 后自动保存
- 每次启动自动验证已保存的 Key
- Key 过期时提示重新配置
- 可在设置中随时更新或清除

---

## 快速开始

### 最简安装（推荐）

1. **下载应用**
   - 访问 [Releases 页面](https://github.com/JuliusJu572/cheating-daddy-china/releases)
   - 下载对应系统的安装包

2. **安装 ffmpeg**
   - Windows: [下载 ffmpeg](https://ffmpeg.org/download.html#build-windows)
   - macOS: `brew install ffmpeg`

3. **启动应用**
   - 输入您的 License Key
   - 选择使用场景（面试/销售/会议等）
   - 开始使用！

---

## 下载与安装教程

### 第一步：下载安装包

1. 访问 [Releases 页面](https://github.com/JuliusJu572/cheating-daddy-china/releases/tag/v1.2.0)
2. 根据你的操作系统选择对应的安装包：
   - **Windows 用户**：下载 `.exe` 文件
   - **macOS 用户**：下载 `.dmg` 文件

---

## Windows 详细安装教程

### 步骤 1：安装应用程序

1. 双击下载的 `.exe` 文件
2. 如果出现"Windows 保护了你的电脑"提示：
   - 点击 **"更多信息"**
   - 然后点击 **"仍要运行"**
3. 按照安装向导完成安装

### 步骤 2：安装 ffmpeg

#### 方法一：使用包管理器（推荐）

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

#### 方法二：手动安装

1. 访问 [ffmpeg 官网](https://ffmpeg.org/download.html#build-windows)
2. 下载 **"ffmpeg-release-essentials.zip"**
3. 解压到 `C:\ffmpeg`
4. 将 `C:\ffmpeg\bin` 添加到系统环境变量 PATH
5. 验证安装：`ffmpeg -version`

### 步骤 3：配置应用权限

1. 打开应用程序
2. 允许麦克风/屏幕录制权限
3. Windows 10/11 可能需要在 **设置 → 隐私** 中手动授权

### 步骤 4：开始使用

1. 打开应用程序
2. 输入您的 License Key（首次使用）
3. 在设置中选择使用档案（面试、销售、会议等）
4. 选择语言
5. 点击 **"开始会话"**

---

## macOS 详细安装教程

### 步骤 1：安装应用程序

1. 双击下载的 `.dmg` 文件
2. 将应用图标拖拽到 **"应用程序"** 文件夹

### 步骤 2：移除隔离属性（必须操作！）

由于应用未经 Apple 公证，需要手动移除隔离属性：

```bash
# 移除隔离属性
sudo xattr -cr /Applications/Cheating\ Buddy.app

# 验证是否成功（应该没有输出）
xattr -l /Applications/Cheating\ Buddy.app
```

### 步骤 3：安装 ffmpeg

```bash
# 使用 Homebrew 安装（推荐）
brew install ffmpeg

# 验证安装
ffmpeg -version
```

### 步骤 4：配置系统权限

#### 屏幕录制权限
1. 打开 **"系统设置"** → **"隐私与安全性"** → **"屏幕录制"**
2. 点击左下角的 **锁图标** 解锁
3. 找到 **"Cheating Buddy"** 并勾选

#### 麦克风权限
1. 在 **"系统设置"** → **"隐私与安全性"** → **"麦克风"**
2. 找到 **"Cheating Buddy"** 并勾选

> **⚠️ 重要提示**：设置权限后需要 **完全退出** 应用，然后重新打开才能生效。

### 步骤 5：首次启动应用

1. 打开 **"应用程序"** 文件夹，双击 **"Cheating Buddy"**
2. 如果出现 **"无法打开"** 提示：
   - **右键点击** 应用图标
   - 按住 **Option** 键，选择 **"打开"**
3. 输入您的 License Key
4. 在设置中选择使用档案和语言
5. 点击 **"开始会话"**

---

## 键盘快捷键

| 功能 | Windows | macOS |
|------|---------|-------|
| 窗口移动 | `Ctrl + 方向键` | `Cmd + 方向键` |
| 点击穿透 | `Ctrl + M` | `Cmd + M` |
| 关闭/返回 | `Ctrl + \` | `Cmd + \` |
| 系统音频录制 | `Ctrl + L` | `Cmd + L` |
| 麦克风录制 | `Ctrl + K` | 暂不支持 |
| 截屏提问 | `Ctrl + Enter` | `Cmd + Enter` |
| 发送文本消息 | `Enter` | `Enter` |
| 删除历史对话 | `Ctrl + '` | `Cmd + '` |

---

## 使用说明

### 基本使用流程

1. **启动应用**后，窗口会悬浮在所有窗口之上
2. **按住窗口顶部** 可以拖动位置，或使用快捷键 `Ctrl/Cmd + 方向键` 微调
3. **开启点击穿透**（`Ctrl/Cmd + M`）后，可以点击窗口下方的内容
4. **开始会话**后，AI 会自动：
   - 定期截取屏幕内容
   - 录制系统音频和麦克风音频
   - 分析面试官的提问
   - 提供实时建议
5. **查看 AI 回复**在悬浮窗中显示

### 使用场景档案说明

- **面试助手**：适用于技术面试、HR 面试
- **销售电话**：帮助销售沟通、客户谈判
- **商务会议**：会议记录、要点提醒
- **演示辅助**：演讲提词、问答支持
- **谈判助手**：商务谈判策略建议

### License Key 管理

- **首次使用**：在主界面输入 License Key，系统会自动验证并保存
- **后续使用**：应用会自动验证已保存的 Key，验证成功直接进入
- **Key 过期**：如果验证失败，会提示重新配置
- **设置管理**：可在"高级设置"中更新或清除已保存的 Key

---

## 常见问题排查

### Windows 常见问题

**Q: 提示"找不到 ffmpeg"**
- A: 使用 Scoop/Chocolatey 安装，或检查环境变量 PATH

**Q: 应用无法启动**
- A: 右键应用 → 属性 → 兼容性 → 勾选"以管理员身份运行"

**Q: 录制不到系统声音**
- A: 检查系统声音设置，确保立体声混音已启用

### macOS 常见问题

**Q: 提示"已损坏，无法打开"**
- A: 执行 `sudo xattr -cr /Applications/Cheating\ Buddy.app`

**Q: ffmpeg 命令找不到**
- A: 使用 Homebrew 安装：`brew install ffmpeg`

**Q: 屏幕录制权限已授予但仍无法截图**
- A: 完全退出应用（Cmd + Q），然后重新打开

**Q: 音频录制失败**
- A:
  1. 检查麦克风权限
  2. 确保 `SystemAudioDump` 有执行权限
  3. 重启应用

### License Key 相关问题

**Q: License Key 验证失败**
- A: 检查 Key 格式是否正确（应为 CD-xxxxx 格式）

**Q: 已保存的 Key 提示过期**
- A: 在"高级设置"中重新输入新的 License Key

---

## 技术架构

- **前端框架**：LitElement
- **桌面框架**：Electron
- **AI 模型**：智谱 AI (GLM-4.7 / GLM-4.6V / GLM-ASR-2512)
- **音频处理**：ffmpeg
- **系统音频**：SystemAudioDump (macOS) / WASAPI (Windows)

---

## 版本历史

### v1.2.0 (2024-01-13)
- **新功能**：
  - 全面切换至智谱 AI 模型（GLM-4.7/GLM-4.6V/GLM-ASR-2512）
  - 新增 License Key 管理功能，支持自动保存和验证
  - 优化状态显示和汉化支持
  - 在设置中可直接管理 API Key

### v1.1.0
- 新增麦克风录制功能（Windows）
- 新增删除历史对话快捷键
- 优化用户界面和体验

---

## 隐私与安全

- 所有数据仅用于实时 AI 分析
- 不会存储或上传您的屏幕截图和音频文件
- License Key 采用加密存储
- 支持内容保护模式，防止屏幕录制

---

## 开源协议

本项目采用 MIT 协议开源

---

## 技术支持

如遇到问题，请：
1. 查看上方常见问题排查
2. 在 [Issues](https://github.com/JuliusJu572/cheating-daddy-china/issues) 中搜索类似问题
3. 提交新的 Issue（请附上操作系统版本、错误截图等信息）

---

<div align="center">

**祝你使用愉快！ 🎉**

[![Star History Chart](https://api.star-history.com/svg?repos=JuliusJu572/cheating-daddy-china&type=Date)](https://star-history.com/#JuliusJu572/cheating-daddy-china&Date)

</div>
