# 修改说明

本文档记录基于原 [cheating-daddy-china](https://github.com/JuliusJu572/cheating-daddy-china) 项目所做的功能调整与 Bug 修复。

---

## 一、实时转写功能重构

### 1.1 交互逻辑统一为 Ctrl+L

- **第一次 Ctrl+L**：开始实时语音转写，转写内容实时显示在转写框
- **第二次 Ctrl+L**：停止转写 → 自动将全部转写内容提交给 AI → 流式回复显示在回复区
- **Enter**（输入框为空时）：仍可手动增量提交上次 Enter 后新增的转写

### 1.2 移除旧录音功能

- 移除 **Ctrl+K**（Windows 音频录制）快捷键及相关逻辑
- 从 `window.js` 默认 keybinds 中删除 `windowsAudioCapture`
- 从设置页快捷键自定义列表中移除该条目
- 从 `strings.js` 中移除 `keybind_windows_audio_capture` 相关文案

---

## 二、清空转写

- **按钮**：有转写内容时，转写框右上角显示「✕ 清空」按钮
- **快捷键**：`Ctrl+Shift+L` 随时清空转写显示（不停止识别）
- **主进程同步**：清空时调用 `clear-live-transcript` IPC，同步清空主进程 `session.transcriptPieces`，避免旧文本在下次推送时回流

---

## 三、UI 与文案修复

### 3.1 状态栏

- 移除 `window.js` 中提前发送的「正在录音...」，避免覆盖正确状态
- 修正「回答中」不消失：删除 `submitLiveTranscriptDelta` 中 AI 回复完成后再设「回答中...」的逻辑，由 Qwen session 流式结束后自行设为「就绪」

### 3.2 转写区动态显示

- 转写框标题根据 `isLiveAsrRunning` 动态显示：
  - 未录音：`按 Ctrl+L 开始实时识别`
  - 录音中：`🔴 实时识别中  再按 Ctrl+L 停止并提交给 AI`，容器边框变红
- 占位文字同步：录音中显示「等待语音输入...」，未录音显示「按 Ctrl+L 开始实时识别」

### 3.3 帮助与设置页文案

- 帮助页快捷键：`开始音频录制（转写）` → `开始实时转写（再按停止并提交 AI）`，新增「清空转写 Ctrl+Shift+L」
- 帮助页使用步骤与音频输入说明统一为实时转写逻辑
- 设置页 AI 模型：`语音转写模型` → `实时转写模型`，描述改为「用于 Ctrl+L 实时语音识别，当前仅支持 qwen3-asr-flash」
- 模型摘要：`语音：xxx` → `实时转写：xxx`
- 引导页：`开始/结束录音并自动转写` → `开始实时转写，再按停止并提交 AI`

---

## 四、Prompt 调整

- 在 system prompt 中新增 **输入说明**：告知模型用户输入来自实时语音转写，约每秒刷新，可能断断续续、词语被截断或顺序错乱，需结合上下文理解完整语义后作答。
- 修改文件：`src/utils/prompts.js` 的 `buildSystemPrompt`

---

## 五、开发模式

- 新增 `npm run dev`：以 `NODE_ENV=development` 启动，启用 `electron-reload`
- 修改 `src/` 下文件后自动刷新渲染进程（主进程修改需重启）

---

## 六、Bug 修复

| 问题 | 根因 | 修复 |
|------|------|------|
| 清空后 Ctrl+L 旧文本复现 | 渲染进程清空了，主进程 session 未清空 | 新增 `clear-live-transcript` IPC，同步清空主进程累积 |
| 按 Enter 无 AI 回复 | `send-text-message` 已由 `gemini.js` 实现 | 移除在 `index.js` 中的重复注册，避免 handler 链崩溃 |
| 状态栏显示「正在录音」 | `audioCapture` 快捷键 handler 提前发错误状态 | 删除该行，由 `startQuickAudioCapture` 统一管理状态 |
| 「回答中」不消失 | `submitLiveTranscriptDelta` 在 AI 回复完成后覆写状态 | 删除覆写逻辑 |
| nextStep 快捷键误用「正在录音」 | 通用处理流程用了录音文案 | 改为「正在处理...」 |
| 流式输出问题数飙升 | `response-animation-complete` 每 chunk 动画结束即触发，将 `_currentResponseIsComplete` 设为 true，下一 chunk 被误追加为新回复 | 移除该处赋值，改为仅在 `setStatus('就绪')` 时标记完成 |

---

## 七、转写区条件显示

- **条件**：仅在 `isLiveAsrRunning || liveTranscript` 时渲染转写区
- **效果**：无转录且未识别时，转写区完全不显示，不占用布局空间

---

## 八、模型兼容性测试（qwen3.5-plus 流式）

**验证步骤**：

1. 打开设置页，将「文本对话模型」切换为 `qwen3.5-plus`
2. 保存后重启应用或刷新
3. Ctrl+L 开始实时识别，再按 Ctrl+L 停止并提交
4. 观察回复是否流式输出、问题数是否稳定为 1/1、无报错

若通过，则 qwen3.5-plus 流式输出兼容。

---

## 九、涉及文件

- `src/index.js`：`clear-live-transcript` IPC、dev 热重载
- `src/utils/renderer.js`：`clearLiveTranscript`、`setLiveAsrRunning`、Ctrl+L 提交逻辑、状态文案
- `src/utils/window.js`：移除 `windowsAudioCapture`、修正状态文案
- `src/components/app/CheatingDaddyApp.js`：`isLiveAsrRunning`、`setLiveAsrRunning`、`handleClearLiveTranscript`、流式完成态逻辑（`setStatus` 识别「就绪」、`response-animation-complete` 不再设 `_currentResponseIsComplete`）
- `src/components/views/AssistantView.js`：转写区动态标题、条件渲染（`isLiveAsrRunning || liveTranscript`）、清空按钮、`Ctrl+Shift+L` 快捷键
- `src/components/views/HelpView.js`：快捷键说明与使用步骤
- `src/components/views/CustomizeView.js`：移除 `windowsAudioCapture`、模型设置文案
- `src/components/views/OnboardingView.js`：引导文案
- `src/i18n/strings.js`：`audio_capture` 描述、移除 `windows_audio_capture`
- `src/utils/prompts.js`：实时转写输入说明
- `package.json`：`dev` script、`electron-reload`、`cross-env`

---

*最后更新：2026-03-02*
