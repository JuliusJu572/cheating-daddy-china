if (require('electron-squirrel-startup')) {
    process.exit(0);
}

const { app, BrowserWindow, shell, ipcMain } = require('electron');
const crypto = require('node:crypto');
const { createWindow, updateGlobalShortcuts, ensureDataDirectories } = require('./utils/window');
const { setupGeminiIpcHandlers, stopMacOSAudioCapture, sendToRenderer, initializeGeminiSession } = require('./utils/gemini');
const { getSystemPrompt } = require('./utils/prompts');
const { initializeRandomProcessNames } = require('./utils/processRandomizer');
const { applyAntiAnalysisMeasures } = require('./utils/stealthFeatures');
const { getLocalConfig, writeConfig } = require('./config');
const { pcmToWav } = require('./audioUtils');
const FormData = require('form-data');
const geminiSessionRef = { current: null };
let mainWindow = null;

// Initialize random process names for stealth
const randomNames = initializeRandomProcessNames();

function createMainWindow() {
    mainWindow = createWindow(sendToRenderer, geminiSessionRef, randomNames);
    return mainWindow;
}

app.whenReady().then(async () => {
    // Apply anti-analysis measures with random delay
    await applyAntiAnalysisMeasures();

    createMainWindow();
    setupGeminiIpcHandlers(geminiSessionRef);
    setupGeneralIpcHandlers();
});

app.on('window-all-closed', () => {
    stopMacOSAudioCapture();
    // macOS 上也应该退出，因为这是工具应用而非常规应用
    app.quit();
});

app.on('before-quit', () => {
    stopMacOSAudioCapture();
    
    // ✅ 退出前清空所有窗口的 localStorage
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
        if (!win.isDestroyed()) {
            win.webContents.executeJavaScript(`
                try { 
                    localStorage.removeItem('apiKey');
                    localStorage.removeItem('modelApiKey');
                    localStorage.removeItem('licenseKey');
                } catch(e) {}
            `).catch(() => {});
        }
    }
});

app.on('activate', () => {
    // macOS 上点击 Dock 图标时的行为
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    } else {
        // 如果窗口存在但隐藏，显示它
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0 && !windows[0].isVisible()) {
            windows[0].showInactive();
        }
    }
});

function setupGeneralIpcHandlers() {
    // Config-related IPC handlers
    ipcMain.handle('set-onboarded', async (event) => {
        try {
            const config = getLocalConfig();
            config.onboarded = true;
            writeConfig(config);
            return { success: true, config };
        } catch (error) {
            console.error('Error setting onboarded:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('set-stealth-level', async (event, stealthLevel) => {
        try {
            const validLevels = ['visible', 'balanced', 'ultra'];
            if (!validLevels.includes(stealthLevel)) {
                throw new Error(`Invalid stealth level: ${stealthLevel}. Must be one of: ${validLevels.join(', ')}`);
            }
            
            const config = getLocalConfig();
            config.stealthLevel = stealthLevel;
            writeConfig(config);
            return { success: true, config };
        } catch (error) {
            console.error('Error setting stealth level:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('set-layout', async (event, layout) => {
        try {
            const validLayouts = ['normal', 'compact'];
            if (!validLayouts.includes(layout)) {
                throw new Error(`Invalid layout: ${layout}. Must be one of: ${validLayouts.join(', ')}`);
            }
            
            const config = getLocalConfig();
            config.layout = layout;
            writeConfig(config);
            return { success: true, config };
        } catch (error) {
            console.error('Error setting layout:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-config', async (event) => {
        try {
            const config = getLocalConfig();
            return { success: true, config };
        } catch (error) {
            console.error('Error getting config:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('quit-application', async event => {
        try {
            stopMacOSAudioCapture();
            
            // ✅ 退出前清空所有窗口的 localStorage
            const windows = BrowserWindow.getAllWindows();
            for (const win of windows) {
                if (!win.isDestroyed()) {
                    await win.webContents.executeJavaScript(`
                        try { 
                            localStorage.removeItem('apiKey');
                            localStorage.removeItem('modelApiKey');
                            localStorage.removeItem('licenseKey');
                        } catch(e) {}
                    `).catch(() => {});
                }
            }
            
            app.quit();
            return { success: true };
        } catch (error) {
            console.error('Error quitting application:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('open-external', async (event, url) => {
        try {
            await shell.openExternal(url);
            return { success: true };
        } catch (error) {
            console.error('Error opening external URL:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.on('update-keybinds', (event, newKeybinds) => {
        if (mainWindow) {
            updateGlobalShortcuts(newKeybinds, mainWindow, sendToRenderer, geminiSessionRef);
        }
    });

    ipcMain.handle('update-content-protection', async (event, contentProtection) => {
        try {
            if (mainWindow) {
                if (process.platform === 'darwin') {
                    mainWindow.setContentProtection(true);
                    console.log('Content protection forced ON for macOS update request.');
                } else {
                    const setting = await mainWindow.webContents.executeJavaScript('cheddar.getContentProtection()');
                    mainWindow.setContentProtection(setting);
                    console.log('Content protection updated:', setting);
                }
            }
            return { success: true };
        } catch (error) {
            console.error('Error updating content protection:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-random-display-name', async event => {
        try {
            return randomNames ? randomNames.displayName : 'System Monitor';
        } catch (error) {
            console.error('Error getting random display name:', error);
            return 'System Monitor';
        }
    });

    ipcMain.handle('initialize-model', async (event, payload) => {
        try {
            const { model, apiKey, apiBase, customPrompt, profile, language } = payload || {};
            if (!apiKey) {
                console.log('❌ No API key provided');
                return false;
            }
            
            
            
            // ✅ 不需要再次解密，直接使用
            if (typeof model !== 'string' || model.includes('gemini')) {
                const session = await initializeGeminiSession(apiKey, customPrompt || '', profile || 'interview', language || 'zh-CN');
                if (session) {
                    const gemRef = global.geminiSessionRef || { current: null };
                    gemRef.current = session;
                    global.geminiSessionRef = gemRef;
                    return true;
                }
                return false;
            }
            
            // aihubmix and other OpenAI-compatible providers
            const sysPrompt = getSystemPrompt(profile || 'interview', customPrompt || '', false);
            const session = createAihubmixSession({
                model: model.startsWith('aihubmix:') ? model.slice('aihubmix:'.length) : model,
                apiKey,  // ✅ 直接使用
                apiBase: apiBase || 'https://aihubmix.com/v1',
                systemPrompt: sysPrompt,
                language: language || 'zh-CN',
            });
            const gemRef = global.geminiSessionRef || { current: null };
            gemRef.current = session;
            geminiSessionRef.current = session;
            global.geminiSessionRef = geminiSessionRef;
            sendToRenderer('update-status', 'Live session connected');
            return true;
        } catch (error) {
            console.error('Error initializing model:', error);
            return false;
        }
    });

    ipcMain.handle('test-model-connection', async (event, payload) => {
        try {
            const { apiBase, headers } = payload || {};
            if (!apiBase) {
                return { success: false, error: 'Missing API base' };
            }
            
            console.log('🔍 Testing connection:', apiBase);
            console.log('🔍 Headers:', headers);
            
            // 构建完整的 URL
            const url = apiBase.endsWith('/') ? `${apiBase}models` : `${apiBase}/models`;
            
            const res = await fetch(url, { 
                method: 'GET', 
                headers: headers || {},
                timeout: 10000  // 10秒超时
            });
            
            const ok = res.ok || res.status < 500;
            console.log('🔍 Response status:', res.status, 'OK:', ok);
            
            return { success: ok, status: res.status };
        } catch (error) {
            console.error('❌ Model connection test error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('decrypt-license-key', async (event, licenseKey) => {
        try {
            console.log('🔐 [decrypt-license-key] 开始解密...');
            
            if (!licenseKey || typeof licenseKey !== 'string') {
                return { success: false, error: 'Invalid license' };
            }
            
            let s = licenseKey.trim();
            if (s.startsWith('CD-')) s = s.slice(3);
            s = s.replace(/-/g, '');
            
            const cipherBuf = Buffer.from(s, 'base64');
            
            const key = require('node:crypto').scryptSync(
                'CheatingDaddy-2024-Secret-Key-JuliusJu-Version-572', 
                'salt', 
                32
            );
            const iv = Buffer.alloc(16, 0);
            const decipher = require('node:crypto').createDecipheriv('aes-256-cbc', key, iv);
            decipher.setAutoPadding(false); // ✅ 关闭自动去除 padding
            
            const decrypted = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);
            
            // ✅ 手动去除 PKCS7 padding
            const lastByte = decrypted[decrypted.length - 1];
            
            // 验证 padding 是否有效（必须在 1-16 之间）
            if (lastByte < 1 || lastByte > 16) {
                return { success: false, error: 'Invalid padding' };
            }
            
            // 验证所有 padding 字节是否一致
            for (let i = 0; i < lastByte; i++) {
                if (decrypted[decrypted.length - 1 - i] !== lastByte) {
                    return { success: false, error: 'Invalid padding bytes' };
                }
            }
            
            const plain = decrypted.slice(0, decrypted.length - lastByte).toString('utf8');
            
            
            
            if (plain.length < 10) {
                console.log('❌ 解密后的明文太短');
                return { success: false, error: 'Decrypted text too short' };
            }
            
            return { success: true, apiKey: plain };
        } catch (error) {
            console.error('❌ [decrypt-license-key] 解密失败:', error?.message || error);
            return { success: false, error: 'Decrypt failed' };
        }
    });

    ipcMain.handle('take-desktop-screenshot', async () => {
        try {
            const electron = require('electron');
            const { desktopCapturer, screen } = electron;
            const primary = screen.getPrimaryDisplay();
            const { width, height } = primary.size || primary.workAreaSize || { width: 1920, height: 1080 };
            const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } });
            if (!sources || sources.length === 0) {
                return { success: false, error: 'No screen sources' };
            }
            const png = sources[0].thumbnail.toPNG();
            const base64 = png.toString('base64');
            if (!base64 || base64.length < 1000) {
                return { success: false, error: 'Screenshot too small' };
            }
            return { success: true, data: base64, mimeType: 'image/png' };
        } catch (error) {
            console.error('take-desktop-screenshot error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-screenshot', async (event, { data, mimeType }) => {
        try {
            if (!data || typeof data !== 'string') {
                return { success: false, error: 'Invalid image data' };
            }
            const { imageDir } = ensureDataDirectories();
            const ext = mimeType === 'image/png' ? '.png' : '.jpg';
            const fileName = `screenshot_${Date.now()}${ext}`;
            const filePath = require('node:path').join(imageDir, fileName);
            const buffer = Buffer.from(data, 'base64');
            require('node:fs').writeFileSync(filePath, buffer);
            return { success: true, path: filePath };
        } catch (error) {
            console.error('Error saving screenshot:', error);
            return { success: false, error: error.message };
        }
    });

    

    ipcMain.handle('save-audio-and-transcribe', async (event, payload) => {
        try {
            const { pcmBase64, sampleRate } = payload || {};
            if (!pcmBase64) {
                return { success: false, error: 'missing audio' };
            }
            
            const windows = BrowserWindow.getAllWindows();
            if (windows.length === 0) {
                return { success: false, error: 'No window available' };
            }
            const targetWindow = windows[0];
            
            sendToRenderer('update-status', 'Transcribing...');
            const pcmBuffer = Buffer.from(pcmBase64, 'base64');
            const { audioDir } = ensureDataDirectories();
            const ts = Date.now();
            const wavPath = require('node:path').join(audioDir, `audio_${ts}.wav`);
            pcmToWav(pcmBuffer, wavPath, sampleRate || 16000, 1, 16);
            console.log('✅ Audio saved to:', wavPath);
            
            const mp3Path = require('node:path').join(audioDir, `audio_${ts}.mp3`);
            let finalPath = wavPath;
            
            try {
                const { spawn } = require('child_process');
                await new Promise((resolve) => {
                    const ffmpeg = spawn('ffmpeg', [
                        '-y', '-hide_banner', '-loglevel', 'error', 
                        '-i', wavPath, 
                        '-ar', String(sampleRate || 16000), 
                        '-ac', '1', '-b:a', '128k', 
                        mp3Path
                    ]);
                    
                    let stderr = '';
                    ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });
                    
                    ffmpeg.on('close', (code) => {
                        if (code === 0) {
                            const fs = require('node:fs');
                            if (fs.existsSync(mp3Path) && fs.statSync(mp3Path).size > 0) {
                                finalPath = mp3Path;
                                console.log('✅ Audio converted to MP3:', mp3Path);
                            } else {
                                console.warn('⚠️ MP3 file not created, using WAV');
                            }
                        } else {
                            console.warn('⚠️ FFmpeg failed, using WAV. Error:', stderr);
                        }
                        resolve();
                    });
                    
                    ffmpeg.on('error', (err) => {
                        console.warn('⚠️ FFmpeg error:', err.message, 'using WAV');
                        resolve();
                    });
                });
            } catch (convErr) {
                console.warn('⚠️ MP3 conversion failed, using WAV:', convErr.message);
            }

            const fs = require('node:fs');
            if (!fs.existsSync(finalPath)) {
                sendToRenderer('update-status', 'Error');
                return { success: false, error: 'Audio file not found' };
            }
            
            const fileSize = fs.statSync(finalPath).size;
            if (fileSize === 0) {
                sendToRenderer('update-status', 'Error');
                return { success: false, error: 'Audio file is empty' };
            }
            
            console.log('📁 Using audio file:', finalPath, '(', fileSize, 'bytes)');

            let token = await targetWindow.webContents.executeJavaScript(
                `(function(){ try { return (localStorage.getItem('modelApiKey') || localStorage.getItem('licenseKey') || ''); } catch(e){ return ''; } })()`
            );
            try {
                if (typeof token === 'string' && /^CD-/i.test(token)) {
                    let s = token.trim();
                    if (s.startsWith('CD-')) s = s.slice(3);
                    s = s.replace(/-/g, '');
                    const cipherBuf = Buffer.from(s, 'base64');
                    const keyBuf = require('node:crypto').scryptSync('CheatingDaddy-2024-Secret-Key-JuliusJu-Version-572', 'salt', 32);
                    const iv = Buffer.alloc(16, 0);
                    const decipher = require('node:crypto').createDecipheriv('aes-256-cbc', keyBuf, iv);
                    const decrypted = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);
                    const pad = decrypted[decrypted.length - 1];
                    token = decrypted.slice(0, decrypted.length - pad).toString('utf8');
                }
            } catch (_) {}
            // ✅ 直接读取解密后的 API Key
            const apiKey = await targetWindow.webContents.executeJavaScript(
                `(function(){ try { return localStorage.getItem('apiKey') || ''; } catch(e){ return ''; } })()`
            );
            
            const apiBase = await targetWindow.webContents.executeJavaScript(
                `(function(){ try { return (localStorage.getItem('modelApiBase') || 'https://aihubmix.com/v1').trim(); } catch(e){ return 'https://aihubmix.com/v1'; } })()`
            );
            
            // ✅ 直接使用，不需要解密
            const endpoint = `${(apiBase || 'https://aihubmix.com/v1').replace(/\/$/, '')}/audio/transcriptions`;
            const transcriptionModel = await targetWindow.webContents.executeJavaScript(
                `(function(){ try { return (localStorage.getItem('transcriptionModel') || 'whisper-large-v3'); } catch(e){ return 'whisper-large-v3'; } })()`
            );
            
            // ✅ 使用 FormData 但通过 http/https 模块发送
            const FormData = require('form-data');
            const fd = new FormData();
            const fileStream = fs.createReadStream(finalPath);
            const fileName = finalPath.endsWith('.mp3') ? 'audio.mp3' : 'audio.wav';
            
            fd.append('model', transcriptionModel);
            fd.append('file', fileStream, fileName);
            
            console.log('🌐 Sending transcription request to:', endpoint);
            console.log('📤 File:', fileName, '(', fileSize, 'bytes)');
            
            // ✅ 使用 form-data 的内置 submit 方法
            const result = await new Promise((resolve, reject) => {
                const url = new URL(endpoint);
            const options = {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    ...fd.getHeaders()
                }
            };
                
                fd.submit({
                    protocol: url.protocol,
                    host: url.hostname,
                    port: url.port || (url.protocol === 'https:' ? 443 : 80),
                    path: url.pathname + url.search,
                    ...options
                }, (err, res) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    let data = '';
                    res.on('data', chunk => { data += chunk; });
                    res.on('end', () => {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            try {
                                resolve({ success: true, data: JSON.parse(data) });
                            } catch (parseErr) {
                                reject(new Error('Failed to parse response: ' + data));
                            }
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                        }
                    });
                    res.on('error', reject);
                });
            });
            
            const text = result.data?.text || '';
            console.log('📝 Transcription result:', text);
            
            if (text && geminiSessionRef.current) {
                console.log('🚀 Sending transcription to model:', text);
                sendToRenderer('update-status', 'Answering...');
                await geminiSessionRef.current.sendRealtimeInput({ text });
                sendToRenderer('update-status', 'Done');
            } else if (!text) {
                sendToRenderer('update-status', 'No speech detected');
            }
            
            return { success: true, path: finalPath, text };
            
        } catch (error) {
            console.error('❌ save-audio-and-transcribe error:', error);
            sendToRenderer('update-status', 'Error: ' + (error.message || 'Unknown'));
            return { success: false, error: error.message };
        }
    });

}

function createAihubmixSession({ model, apiKey, apiBase, systemPrompt, language }) {
    console.log('🔵 [createAihubmixSession] 创建 session...');
    console.log('🔵 [createAihubmixSession] Model:', model);
    console.log('🔵 [createAihubmixSession] API Base:', apiBase);
    
    
    const messages = [];
    const endpoint = `${apiBase.replace(/\/$/, '')}/chat/completions`;
    if (systemPrompt && systemPrompt.length > 0) {
        messages.push({ role: 'system', content: systemPrompt });
    }

    let closed = false;
    const lowerModel = (model || '').toLowerCase();
    const supportsImage = /gemini.*image|qwen.*vl|qwen2-?vl|qwen.*vision/.test(lowerModel);

    async function callChatCompletions() {
        console.log('📡 [callChatCompletions] 准备调用 API...');
        console.log('📡 [callChatCompletions] Endpoint:', endpoint);
        
        
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        };
        const body = {
            model,
            messages,
            stream: false,
        };
        
        
        
        const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
        
        console.log('📡 [callChatCompletions] Response status:', res.status);
        
        if (!res.ok) {
            const text = await res.text();
            console.error('❌ [callChatCompletions] API Error Response:', text);
            throw new Error(`aihubmix error ${res.status}: ${text}`);
        }
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content || '';
        messages.push({ role: 'assistant', content });
        sendToRenderer('update-response', content);
        sendToRenderer('update-status', 'Listening...');
    }

    async function sendRealtimeInput(payload) {
        console.log('🔵 sendRealtimeInput called, closed:', closed);
        console.log('🔵 payload keys:', Object.keys(payload || {}));
        if (closed) return;
        try {
            if (payload?.text) {
                messages.push({ role: 'user', content: payload.text });
                await callChatCompletions();
                return;
            }
            if (payload?.videoUrl) {
                const parts = [];
                parts.push({ type: 'video_url', video_url: { url: payload.videoUrl } });
                const text = payload.debug || '请结合视频与图片或文本生成回答。';
                parts.push({ type: 'text', text });
                if (payload?.media?.data && supportsImage) {
                    const dataUrl = `data:${payload.media.mimeType || 'image/jpeg'};base64,${payload.media.data}`;
                    parts.push({ type: 'image_url', image_url: { url: dataUrl } });
                }
                messages.push({ role: 'user', content: parts });
                await callChatCompletions();
                return;
            }
            if (payload?.media?.data) {
                console.log('🔵 Processing image, supportsImage:', supportsImage);
                console.log('🔵 Image data length:', payload.media.data?.length);
                if (supportsImage) {
                    const dataUrl = `data:${payload.media.mimeType || 'image/jpeg'};base64,${payload.media.data}`;
                    const text = payload.debug || '这是截图+文本联合测试：请结合图片与这段文字生成回答。';
                    messages.push({
                        role: 'user',
                        content: [
                            { type: 'text', text },
                            { type: 'image_url', image_url: { url: dataUrl } },
                        ],
                    });
                } else {
                    messages.push({ role: 'user', content: '有截图附加，但当前模型不支持图像输入，请基于文本继续帮助。' });
                }
                await callChatCompletions();
                return;
            }
            if (payload?.audio?.data) {
                // Audio not supported in this adapter; ignore gracefully
                return;
            }
        } catch (error) {
            console.error('Aihubmix sendRealtimeInput error:', error);
            sendToRenderer('update-status', 'Error: ' + (error?.message || 'Unknown'));
        }
    }

    async function close() {
        closed = true;
    }

    return { sendRealtimeInput, close };
}
