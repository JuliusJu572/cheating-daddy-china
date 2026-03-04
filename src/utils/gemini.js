const { ipcMain, BrowserWindow, app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('child_process');

let macAudioProcess = null;
let macAudioBuffers = [];
let macAudioSampleRate = 24000;

function sendToRenderer(channel, payload) {
    try {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0 && !windows[0].isDestroyed()) {
            windows[0].webContents.send(channel, payload);
        }
    } catch (e) {
        console.error('sendToRenderer error:', e);
    }
}

function normalizeAppError(error, fallbackCode = 'UNKNOWN_ERROR') {
    return {
        message: error?.message || '请求失败',
        code: String(error?.code || fallbackCode),
        status: Number(error?.status || 0),
        reason: String(error?.reason || ''),
        requestId: String(error?.requestId || ''),
        retryable: Boolean(error?.retryable),
    };
}

function setupGeminiIpcHandlers(geminiSessionRef) {
    ipcMain.handle('send-image-content', async (event, { data, mimeType, debug }) => {
        try {
            console.log('🖼️ [send-image-content] 收到图片内容...');
            console.log('🖼️ [send-image-content] MIME type:', mimeType);
            console.log('🖼️ [send-image-content] Data length:', data?.length);

            const session = geminiSessionRef?.current;
            if (session && typeof session.sendRealtimeInput === 'function') {
                console.log('✅ [send-image-content] 发送到 session (Qwen Vision)...');
                await session.sendRealtimeInput({ media: { data, mimeType }, debug });
                console.log('✅ [send-image-content] 发送成功');
            } else {
                console.warn('⚠️ [send-image-content] 无有效 session');
                sendToRenderer('update-response', '[Mock] 收到图片，未配置实时模型');
                sendToRenderer('update-status', '正在监听...');
            }
            return { success: true };
        } catch (error) {
            console.error('❌ [send-image-content] error:', error);
            return { success: false, error: normalizeAppError(error, 'SEND_IMAGE_FAILED') };
        }
    });

    ipcMain.handle('send-text-message', async (event, text) => {
        try {
            console.log('📝 [send-text-message] 收到文本消息...');

            const session = geminiSessionRef?.current;
            if (session && typeof session.sendRealtimeInput === 'function') {
                console.log('✅ [send-text-message] 发送到 session (Qwen Text)...');
                await session.sendRealtimeInput({ text });
                console.log('✅ [send-text-message] 发送成功');
            } else {
                console.warn('⚠️ [send-text-message] 无有效 session');
                sendToRenderer('update-response', `[Mock] 文本: ${text}`);
                sendToRenderer('update-status', '正在监听...');
            }
            return { success: true };
        } catch (error) {
            console.error('❌ [send-text-message] error:', error);
            return { success: false, error: normalizeAppError(error, 'SEND_TEXT_FAILED') };
        }
    });

    ipcMain.handle('send-audio-content', async () => {
        return { success: true };
    });

    ipcMain.handle('send-mic-audio-content', async () => {
        return { success: true };
    });

    ipcMain.handle('send-windows-audio-data', async (event, { audioData, sampleRate, mimeType }) => {
        try {
            const session = geminiSessionRef?.current;
            if (session && typeof session.sendRealtimeInput === 'function') {
                await session.sendRealtimeInput({
                    media: {
                        mimeType: mimeType || 'audio/pcm',
                        data: audioData,
                    },
                });
                return { success: true };
            } else {
                console.warn('No active Gemini session to send audio to.');
                return { success: false, error: 'No active session' };
            }
        } catch (error) {
            console.error('Error sending windows audio:', error);
            return { success: false, error: normalizeAppError(error, 'SEND_AUDIO_FAILED') };
        }
    });

    ipcMain.handle('start-macos-audio', async () => {
        try {
            if (process.platform !== 'darwin') {
                return { success: false, error: 'macOS only' };
            }

            if (macAudioProcess) {
                return { success: true };
            }

            const candidates = [
                path.join(process.resourcesPath || '', 'SystemAudioDump'),
                path.join(process.resourcesPath || '', 'mac', 'SystemAudioDump'),
                path.join(app.getAppPath(), 'bin', 'mac', 'SystemAudioDump'),
                path.join(app.getAppPath(), 'resources', 'mac', 'SystemAudioDump'),
                path.join(__dirname, '../../bin/mac/SystemAudioDump'),
                path.join(__dirname, '../../resources/mac/SystemAudioDump'),
                path.join(app.getAppPath(), 'src', 'assets', 'SystemAudioDump'),
            ].filter(p => !!p);

            let binPath = null;
            for (const p of candidates) {
                try {
                    if (fs.existsSync(p)) {
                        binPath = p;
                        break;
                    }
                } catch {}
            }

            if (!binPath) {
                return { success: false, error: 'SystemAudioDump not found' };
            }

            const { execSync } = require('child_process');
            try {
                const archInfo = execSync(`lipo -info "${binPath}"`).toString();
                console.log('Binary architectures:', archInfo);
            } catch (e) {
                console.warn('Could not verify binary architecture:', e.message);
            }

            macAudioBuffers = [];
            macAudioSampleRate = 24000;
            const baseArgs = ['--sample-rate', String(macAudioSampleRate), '--channels', '1', '--format', 's16le'];
            const spawnOpts = { stdio: ['ignore', 'pipe', 'pipe'] };

            const proc = spawn(binPath, baseArgs, spawnOpts);

            macAudioProcess = proc;
            macAudioProcess.stdout.on('data', (chunk) => {
                if (chunk && chunk.length) macAudioBuffers.push(chunk);
            });
            macAudioProcess.stderr.on('data', (data) => {
                console.log('SystemAudioDump stderr:', data.toString());
            });
            macAudioProcess.on('close', (code) => {
                console.log('SystemAudioDump exited with code:', code);
            });
            macAudioProcess.on('error', (err) => {
                console.error('SystemAudioDump error:', err);
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('stop-macos-audio', async () => {
        try {
            if (macAudioProcess) {
                const p = macAudioProcess;
                macAudioProcess = null;
                try { p.kill('SIGINT'); } catch {}
            }

            const buf = macAudioBuffers.length ? Buffer.concat(macAudioBuffers) : Buffer.alloc(0);
            macAudioBuffers = [];

            return { success: true, pcmBase64: buf.toString('base64'), sampleRate: macAudioSampleRate };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('clear-chat-history', async () => {
        try {
            if (geminiSessionRef?.current && typeof geminiSessionRef.current.clearHistory === 'function') {
                geminiSessionRef.current.clearHistory();
            }
            currentSessionData.history = [];
            return { success: true };
        } catch (error) {
            console.error('clear-chat-history error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('close-session', async () => {
        try {
            if (geminiSessionRef?.current && typeof geminiSessionRef.current.close === 'function') {
                await geminiSessionRef.current.close();
                geminiSessionRef.current = null;
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

function initializeGeminiSession(apiKey, prompt, profile, language, maxTokens) {
    const messages = [];

    async function sendRealtimeInput(payload) {
        if (payload?.text) {
            messages.push({ role: 'user', content: payload.text });
            sendToRenderer('update-response', `[Mock Gemini] ${payload.text}`);
            sendToRenderer('update-status', '正在监听...');
            return;
        }

        if (payload?.media?.data) {
            messages.push({ role: 'user', content: '收到图片' });
            sendToRenderer('update-response', '[Mock Gemini] 已接收截图');
            sendToRenderer('update-status', '正在监听...');
            return;
        }
    }

    async function close() {}

    function clearHistory() {
        messages.length = 0;
    }

    return { sendRealtimeInput, close, clearHistory };
}

let currentSessionData = { history: [] };

function initializeNewSession() {
    currentSessionData = { history: [] };
}

function saveConversationTurn(transcription, ai_response) {
    currentSessionData.history.push({ transcription, ai_response });
}

function getCurrentSessionData() {
    return currentSessionData;
}

function formatSpeakerResults(results) {
    const names = { 1: 'Interviewer', 2: 'Candidate' };
    return (results || [])
        .map(r => `[${names[r.speakerId] || 'Speaker'}]: ${r.transcript}`)
        .join('\n') + (results && results.length ? '\n' : '');
}

module.exports = {
    setupGeminiIpcHandlers,
    stopMacOSAudioCapture: () => {
        try {
            if (macAudioProcess) {
                const p = macAudioProcess;
                macAudioProcess = null;
                try { p.kill('SIGINT'); } catch {}
            }
            macAudioBuffers = [];
        } catch {}
    },
    sendToRenderer,
    initializeGeminiSession,
    initializeNewSession,
    saveConversationTurn,
    getCurrentSessionData,
    formatSpeakerResults,
};
