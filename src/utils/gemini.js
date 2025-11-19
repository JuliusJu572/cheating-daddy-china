const { ipcMain, BrowserWindow, app } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { spawn } = require('child_process')
let macAudioProcess = null
let macAudioBuffers = []
let macAudioSampleRate = 48000

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
      const candidates = [
        path.join(process.resourcesPath || '', 'SystemAudioDump'),
        path.join(process.resourcesPath || '', 'mac', 'SystemAudioDump'),
        path.join(app.getAppPath(), 'bin', 'mac', 'SystemAudioDump'),
        path.join(app.getAppPath(), 'resources', 'mac', 'SystemAudioDump'),
        path.join(__dirname, '../../bin/mac/SystemAudioDump'),
        path.join(__dirname, '../../resources/mac/SystemAudioDump'),
        path.join(app.getAppPath(), 'src', 'assets', 'SystemAudioDump'),  // ✅ 开发环境
      ].filter(p => !!p)
      let binPath = null
      for (const p of candidates) {
        try { if (fs.existsSync(p)) { binPath = p; break } } catch {}
      }
      if (!binPath) {
        return { success: false, error: 'SystemAudioDump not found' }
      }
      
      // ✅ 验证是否为通用二进制
      const { execSync } = require('child_process')
      try {
          const archInfo = execSync(`lipo -info "${binPath}"`).toString()
          console.log('Binary architectures:', archInfo)
      } catch (e) {
          console.warn('Could not verify binary architecture:', e.message)
      }

      macAudioBuffers = []
        macAudioSampleRate = process.arch === 'x64' ? 24000 : 48000
        const baseArgs = ['--sample-rate', String(macAudioSampleRate), '--channels', '1', '--format', 's16le']
        const spawnOpts = { stdio: ['ignore', 'pipe', 'pipe'] }
        
        // ✅ 不再需要 Rosetta 回退，通用二进制会自动工作
        const proc = spawn(binPath, baseArgs, spawnOpts)
        
        macAudioProcess = proc
        macAudioProcess.stdout.on('data', (chunk) => { 
            if (chunk && chunk.length) macAudioBuffers.push(chunk) 
        })
        macAudioProcess.stderr.on('data', (data) => {
            console.log('SystemAudioDump stderr:', data.toString())
        })
        macAudioProcess.on('close', (code) => {
            console.log('SystemAudioDump exited with code:', code)
        })
        macAudioProcess.on('error', (err) => {
            console.error('SystemAudioDump error:', err)
        })
        
        return { success: true }
    } catch (error) {
        return { success: false, error: error.message }
    }
})

  ipcMain.handle('stop-macos-audio', async () => {
    try {
      if (macAudioProcess) {
        const p = macAudioProcess
        macAudioProcess = null
        try { p.kill('SIGINT') } catch {}
      }
      const buf = macAudioBuffers.length ? Buffer.concat(macAudioBuffers) : Buffer.alloc(0)
      macAudioBuffers = []
      return { success: true, pcmBase64: buf.toString('base64'), sampleRate: macAudioSampleRate }
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

function formatSpeakerResults(results) {
  const names = { 1: 'Interviewer', 2: 'Candidate' }
  return (results || [])
    .map(r => `[${names[r.speakerId] || 'Speaker'}]: ${r.transcript}`)
    .join('\n') + (results && results.length ? '\n' : '')
}

module.exports = {
  setupGeminiIpcHandlers,
  stopMacOSAudioCapture: () => {
    try {
      if (macAudioProcess) {
        const p = macAudioProcess
        macAudioProcess = null
        try { p.kill('SIGINT') } catch {}
      }
      macAudioBuffers = []
    } catch {}
  },
  sendToRenderer,
  initializeGeminiSession,
  initializeNewSession,
  saveConversationTurn,
  getCurrentSessionData,
  formatSpeakerResults,
}
