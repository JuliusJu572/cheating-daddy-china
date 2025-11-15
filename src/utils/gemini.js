const { ipcMain, BrowserWindow } = require('electron')
let macAudioProcess = null

function sendToRenderer(channel, payload) {
  try {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0 && !windows[0].isDestroyed()) {
      windows[0].webContents.send(channel, payload)
    }
  } catch (e) {
    console.error('sendToRenderer error:', e)
  }
}

function setupGeminiIpcHandlers(geminiSessionRef) {
  ipcMain.handle('send-image-content', async (event, { data, mimeType, debug }) => {
    try {
      const session = geminiSessionRef?.current
      if (session && typeof session.sendRealtimeInput === 'function') {
        await session.sendRealtimeInput({ media: { data, mimeType }, debug })
      } else {
        sendToRenderer('update-response', '[Mock] 收到图片，未配置实时模型')
        sendToRenderer('update-status', 'Listening...')
      }
      return { success: true }
    } catch (error) {
      console.error('send-image-content error:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('send-text-message', async (event, text) => {
    try {
      const session = geminiSessionRef?.current
      if (session && typeof session.sendRealtimeInput === 'function') {
        await session.sendRealtimeInput({ text })
      } else {
        sendToRenderer('update-response', `[Mock] 文本: ${text}`)
        sendToRenderer('update-status', 'Listening...')
      }
      return { success: true }
    } catch (error) {
      console.error('send-text-message error:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('send-audio-content', async () => {
    return { success: true }
  })

  ipcMain.handle('send-mic-audio-content', async () => {
    return { success: true }
  })

  ipcMain.handle('start-macos-audio', async () => {
    try {
      if (process.platform !== 'darwin') {
        return { success: false, error: 'macOS only' }
      }
      if (macAudioProcess) {
        return { success: true }
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('stop-macos-audio', async () => {
    try {
      if (macAudioProcess) {
        macAudioProcess.kill()
        macAudioProcess = null
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('close-session', async () => {
    try {
      if (geminiSessionRef?.current && typeof geminiSessionRef.current.close === 'function') {
        await geminiSessionRef.current.close()
        geminiSessionRef.current = null
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })
}

function initializeGeminiSession(apiKey, prompt, profile, language) {
  const messages = []
  async function sendRealtimeInput(payload) {
    if (payload?.text) {
      messages.push({ role: 'user', content: payload.text })
      sendToRenderer('update-response', `[Mock Gemini] ${payload.text}`)
      sendToRenderer('update-status', 'Listening...')
      return
    }
    if (payload?.media?.data) {
      messages.push({ role: 'user', content: '收到图片' })
      sendToRenderer('update-response', '[Mock Gemini] 已接收截图')
      sendToRenderer('update-status', 'Listening...')
      return
    }
  }
  async function close() {}
  return { sendRealtimeInput, close }
}

let currentSessionData = { history: [] }
function initializeNewSession() {
  currentSessionData = { history: [] }
}
function saveConversationTurn(transcription, ai_response) {
  currentSessionData.history.push({ transcription, ai_response })
}
function getCurrentSessionData() {
  return currentSessionData
}

module.exports = {
  setupGeminiIpcHandlers,
  stopMacOSAudioCapture: () => {},
  sendToRenderer,
  initializeGeminiSession,
  initializeNewSession,
  saveConversationTurn,
  getCurrentSessionData,
}
