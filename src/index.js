if (require('electron-squirrel-startup')) {
    process.exit(0);
}

const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');

function configureWindowsPaths() {
    if (process.platform !== 'win32') return;

    const appDataPath = process.env.APPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Roaming');
    const customUserDataPath = path.join(appDataPath, 'CheatingBuddy');

    app.setPath('userData', customUserDataPath);
    app.setPath('appData', customUserDataPath);
    app.setPath('userCache', path.join(
        process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local'),
        'CheatingBuddy',
        'Cache'
    ));
    app.setPath('logs', path.join(customUserDataPath, 'logs'));

    console.log('🔧 [Windows] 设置userData路径:', customUserDataPath);
}

configureWindowsPaths();
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
let creatingWindow = false;
const DEFAULT_MODEL_API_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_ASR_API_BASE = 'https://dashscope.aliyuncs.com/api/v1';

// Initialize random process names for stealth
const randomNames = initializeRandomProcessNames();

async function createMainWindow() {
    if (creatingWindow) return mainWindow;
    if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
    creatingWindow = true;
    if (!app.isReady()) {
        await app.whenReady();
    }
    mainWindow = createWindow(sendToRenderer, geminiSessionRef, randomNames);
    creatingWindow = false;
    return mainWindow;
}

app.whenReady().then(async () => {
    // Apply anti-analysis measures with random delay
    await applyAntiAnalysisMeasures();

    await createMainWindow();
    setupGeminiIpcHandlers(geminiSessionRef);
    setupGeneralIpcHandlers();
});

async function transcribeAudio(filePath, apiKey, apiBase = DEFAULT_ASR_API_BASE) {
    const asrBase = String(apiBase || DEFAULT_ASR_API_BASE).replace(/\/$/, '');
    const ext = path.extname(filePath || '').toLowerCase().replace(/^\./, '');
    const format = ext === 'wav' || ext === 'mp3' || ext === 'm4a' ? ext : 'mp3';
    const mimeType =
        format === 'wav'
            ? 'audio/wav'
            : format === 'm4a'
                ? 'audio/mp4'
                : 'audio/mpeg';

    const audioBase64 = fs.readFileSync(filePath).toString('base64');
    const audioDataUrl = `data:${mimeType};base64,${audioBase64}`;

    async function callDashScopeProtocol() {
        const endpoint = `${asrBase}/services/aigc/multimodal-generation/generation`;
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'qwen3-asr-flash',
                input: {
                    messages: [
                        { role: 'system', content: [{ text: '' }] },
                        { role: 'user', content: [{ audio: audioDataUrl }] },
                    ],
                },
                parameters: {
                    asr_options: { enable_itn: false },
                },
            }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const data = await res.json();
        const content = data?.output?.choices?.[0]?.message?.content ?? data?.output?.text ?? '';
        const text =
            typeof content === 'string'
                ? content
                : Array.isArray(content)
                    ? (content.find(x => typeof x?.text === 'string')?.text || '')
                    : '';
        return { success: true, data: { text, raw: data } };
    }

    async function callOpenAICompatible() {
        const endpoint = `${DEFAULT_MODEL_API_BASE.replace(/\/$/, '')}/chat/completions`;
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'qwen3-asr-flash',
                messages: [
                    { role: 'system', content: [{ text: '' }] },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'input_audio',
                                input_audio: { data: audioDataUrl },
                            },
                        ],
                    },
                ],
                stream: false,
                extra_body: { asr_options: { enable_itn: false } },
            }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        const text =
            typeof content === 'string'
                ? content
                : Array.isArray(content)
                    ? (content.find(x => typeof x?.text === 'string')?.text || '')
                    : '';

        return { success: true, data: { text, raw: data } };
    }

    try {
        return await callDashScopeProtocol();
    } catch (e) {
        try {
            return await callOpenAICompatible();
        } catch (e2) {
            throw e2;
        }
    }
}

function clearSensitiveLocalStorage() {
    const windows = BrowserWindow.getAllWindows();
    const keysToRemove = ['apiKey', 'modelApiKey', 'licenseKey'];

    windows.forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.executeJavaScript(`
                try {
                    ${keysToRemove.map(key => `localStorage.removeItem('${key}');`).join('\n                    ')}
                } catch(e) {}
            `).catch(() => {});
        }
    });
}

app.on('window-all-closed', () => {
    stopMacOSAudioCapture();
    app.quit();
});

app.on('before-quit', () => {
    stopMacOSAudioCapture();
    clearSensitiveLocalStorage();
});

app.on('activate', async () => {
    // macOS 上点击 Dock 图标时的行为
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (!mainWindow.isVisible()) {
            mainWindow.showInactive();
        }
        return;
    }
    await createMainWindow();
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
            clearSensitiveLocalStorage();
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

    ipcMain.handle('clear-cheddar-cache', async () => {
        try {
            const fs = require('fs');
            const os = require('os');
            const path = require('path');

            // 清理cheddar目录
            const homeDir = os.homedir();
            const cheddarDir = path.join(homeDir, 'cheddar');

            if (!fs.existsSync(cheddarDir)) {
                return { success: true, deletedFiles: 0, freedSpace: '0 B' };
            }

            let deletedFiles = 0;
            let totalSize = 0;

            // 递归删除目录
            function deleteDirectory(dirPath) {
                const files = fs.readdirSync(dirPath);
                files.forEach(file => {
                    const filePath = path.join(dirPath, file);
                    const stats = fs.statSync(filePath);

                    if (stats.isDirectory()) {
                        deleteDirectory(filePath);
                    } else {
                        totalSize += stats.size;
                        fs.unlinkSync(filePath);
                        deletedFiles++;
                    }
                });

                // 删除空目录
                try {
                    fs.rmdirSync(dirPath);
                } catch (e) {
                    // 目录可能不为空或有其他问题，忽略
                }
            }

            // 清理 data/audio 目录
            const audioDir = path.join(cheddarDir, 'data', 'audio');
            if (fs.existsSync(audioDir)) {
                deleteDirectory(audioDir);
            }

            // 清理 data/screenshots 目录
            const screenshotsDir = path.join(cheddarDir, 'data', 'screenshots');
            if (fs.existsSync(screenshotsDir)) {
                deleteDirectory(screenshotsDir);
            }

            // 清理 data 目录本身（如果为空）
            try {
                const dataDir = path.join(cheddarDir, 'data');
                const remainingFiles = fs.readdirSync(dataDir);
                if (remainingFiles.length === 0) {
                    fs.rmdirSync(dataDir);
                }
            } catch (e) {
                // 忽略
            }

            // 格式化释放的空间
            function formatBytes(bytes) {
                if (bytes === 0) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            }

            const freedSpace = formatBytes(totalSize);
            console.log(`🗑️ [clear-cheddar-cache] 清理完成: ${deletedFiles} 个文件, 释放 ${freedSpace}`);

            return { success: true, deletedFiles, freedSpace };
        } catch (error) {
            console.error('❌ [clear-cheddar-cache] 清理失败:', error);
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
            const { model, apiKey, apiBase, customPrompt, profile, language, maxTokens } = payload || {};
            console.log('🚀 [initialize-model] 初始化模型...');
            console.log('🚀 [initialize-model] Model:', model);
            console.log('🚀 [initialize-model] Profile:', profile);
            console.log('🚀 [initialize-model] Language:', language);

            if (!apiKey) {
                console.log('❌ [initialize-model] No API key provided');
                return false;
            }



            // ✅ Qwen - 使用 DashScope OpenAI 兼容接口
            const selectedModel = (model || '').trim();
            if (selectedModel === 'qwen') {
                console.log('🔵 [initialize-model] 使用 Qwen session...');
                const sysPrompt = getSystemPrompt(profile || 'interview', customPrompt || '', false);
                console.log('🔵 [initialize-model] System prompt length:', sysPrompt.length);

                const session = createQwenSession({
                    apiKey,
                    apiBase: apiBase || DEFAULT_MODEL_API_BASE,
                    systemPrompt: sysPrompt,
                    language: language || 'zh-CN',
                    maxTokens: maxTokens || 4096,
                });

                geminiSessionRef.current = session;
                global.geminiSessionRef = geminiSessionRef;
                sendToRenderer('update-status', 'Qwen session connected');
                console.log('✅ [initialize-model] Qwen session 创建成功');
                return true;
            }

            // ✅ 不需要再次解密，直接使用
            if (typeof model !== 'string' || model.includes('gemini')) {
                const session = await initializeGeminiSession(apiKey, customPrompt || '', profile || 'interview', language || 'zh-CN', maxTokens);
                if (session) {
                    // ✅ 同步到本地与全局引用，确保 IPC 读取到当前会话
                    geminiSessionRef.current = session;
                    global.geminiSessionRef = geminiSessionRef;
                    return true;
                }
                return false;
            }

            // aihubmix and other OpenAI-compatible providers
            console.log('🔵 [initialize-model] 使用 aihubmix session...');
            const sysPrompt = getSystemPrompt(profile || 'interview', customPrompt || '', false);
            const session = createAihubmixSession({
                model: model.startsWith('aihubmix:') ? model.slice('aihubmix:'.length) : model,
                apiKey,  // ✅ 直接使用
                apiBase: apiBase || 'https://aihubmix.com/v1',
                systemPrompt: sysPrompt,
                language: language || 'zh-CN',
                maxTokens: maxTokens,
            });
            const gemRef = global.geminiSessionRef || { current: null };
            gemRef.current = session;
            geminiSessionRef.current = session;
            global.geminiSessionRef = geminiSessionRef;
            sendToRenderer('update-status', '连接成功！');
            console.log('✅ [initialize-model] aihubmix session 创建成功');
            return true;
        } catch (error) {
            console.error('❌ [initialize-model] Error initializing model:', error);
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

            const cleanedKey = licenseKey.trim().replace(/^CD-/, '').replace(/-/g, '');
            const cipherBuf = Buffer.from(cleanedKey, 'base64');

            const key = crypto.scryptSync('CheatingDaddy-2024-Secret-Key-JuliusJu-Version-572', 'salt', 32);
            const iv = Buffer.alloc(16, 0);
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            decipher.setAutoPadding(false);

            const decrypted = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);
            const lastByte = decrypted[decrypted.length - 1];

            if (lastByte < 1 || lastByte > 16) {
                return { success: false, error: 'Invalid padding' };
            }

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
            
            sendToRenderer('update-status', '⏳ 处理音频中...');
            const pcmBuffer = Buffer.from(pcmBase64, 'base64');
            const { audioDir } = ensureDataDirectories();
            const ts = Date.now();
            const path = require('node:path');
            const fs = require('node:fs');
            const isMac = process.platform === 'darwin';
            const wavPath = path.join(audioDir, `audio_${ts}.wav`);
            const mp3Path = path.join(audioDir, `audio_${ts}.mp3`);
            let finalPath = wavPath;

            if (isMac) {
                try {
                    const { spawn } = require('child_process');
                    await new Promise((resolve) => {
                        const ffmpeg = spawn('ffmpeg', [
                            '-y', '-hide_banner', '-loglevel', 'error',
                            '-f', 's16le',
                            '-ar', String(sampleRate || 24000),
                            '-ac', '1',
                            '-i', '-',
                            '-ar', '16000',
                            '-b:a', '128k',
                            mp3Path,
                        ]);
                        let stderr = '';
                        ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });
                        ffmpeg.on('close', (code) => {
                            if (code === 0 && fs.existsSync(mp3Path) && fs.statSync(mp3Path).size > 0) {
                                finalPath = mp3Path;
                                console.log('✅ Audio encoded to MP3 directly:', mp3Path);
                            } else {
                                console.warn('⚠️ MP3 direct encode failed, fallback to WAV. Code:', code, 'Err:', stderr);
                            }
                            resolve();
                        });
                        ffmpeg.on('error', (err) => {
                            console.warn('⚠️ FFmpeg error:', err.message, 'fallback to WAV');
                            resolve();
                        });
                        try { ffmpeg.stdin.write(pcmBuffer); ffmpeg.stdin.end(); } catch (e) { console.warn('⚠️ pipe error:', e.message); }
                    });
                } catch (e) {
                    console.warn('⚠️ Direct MP3 encode failed:', e.message);
                }
            }

            if (finalPath === wavPath) {
                pcmToWav(pcmBuffer, wavPath, sampleRate || 24000, 1, 16);
                console.log('✅ Audio saved to WAV:', wavPath);
                try {
                    const { spawn } = require('child_process');
                    await new Promise((resolve) => {
                        const ffmpeg = spawn('ffmpeg', [
                            '-y', '-hide_banner', '-loglevel', 'error',
                            '-i', wavPath,
                            '-ar', '16000',
                            '-ac', '1', '-b:a', '128k',
                            mp3Path,
                        ]);
                        let stderr = '';
                        ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });
                        ffmpeg.on('close', (code) => {
                            if (code === 0 && fs.existsSync(mp3Path) && fs.statSync(mp3Path).size > 0) {
                                finalPath = mp3Path;
                                console.log('✅ Audio converted to MP3:', mp3Path);
                                try { fs.unlinkSync(wavPath); } catch {}
                            } else {
                                console.warn('⚠️ MP3 conversion failed, using WAV. Code:', code, 'Err:', stderr);
                            }
                            resolve();
                        });
                        ffmpeg.on('error', (err) => { console.warn('⚠️ FFmpeg error:', err.message, 'using WAV'); resolve(); });
                    });
                } catch (convErr) {
                    console.warn('⚠️ MP3 conversion failed, using WAV:', convErr.message);
                }
            }

            if (!fs.existsSync(finalPath)) {
                sendToRenderer('update-status', '出错！');
                return { success: false, error: 'Audio file not found' };
            }
            
            const fileSize = fs.statSync(finalPath).size;
            if (fileSize === 0) {
                sendToRenderer('update-status', '出错！');
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
            const apiKey = await targetWindow.webContents.executeJavaScript(
                `(function(){ try { return localStorage.getItem('apiKey') || ''; } catch(e){ return ''; } })()`
            );

            console.log('🌐 [ASR] Sending transcription request...');
            console.log('📤 [ASR] File:', finalPath, '(', fileSize, 'bytes)');

            const result = await transcribeAudio(finalPath, apiKey, DEFAULT_ASR_API_BASE);

            const text = result.data?.text || '';
            console.log('📝 [ASR] Transcription result:', text);
            
            if (text && geminiSessionRef.current) {
                console.log('🚀 Sending transcription to model:', text);
                sendToRenderer('update-status', '回答中...');
                // 传递 skipFinalStatus: true，让 sendRealtimeInput 不设置最终状态
                // 由这里统一设置 "完成"
                await geminiSessionRef.current.sendRealtimeInput({ text }, { skipFinalStatus: true });
                sendToRenderer('update-status', '完成');
            } else if (!text) {
                sendToRenderer('update-status', '没有检测到语音');
            }
            
            return { success: true, path: finalPath, text };
            
        } catch (error) {
            console.error('❌ save-audio-and-transcribe error:', error);
            sendToRenderer('update-status', 'Error: ' + (error.message || 'Unknown'));
            return { success: false, error: error.message };
        }
    });

}

function createQwenSession({ apiKey, apiBase = DEFAULT_MODEL_API_BASE, systemPrompt, language, maxTokens }) {
    console.log('🔵 [createQwenSession] 创建 Qwen session...');
    console.log('🔵 [createQwenSession] API Key:', apiKey ? '已设置' : '未设置');
    console.log('🔵 [createQwenSession] Max Tokens:', maxTokens);
    console.log('🔵 [createQwenSession] Language:', language);

    const messages = [];
    const endpoint = `${String(apiBase || DEFAULT_MODEL_API_BASE).replace(/\/$/, '')}/chat/completions`;
    const qwenTextModel = 'qwen3-max';
    const qwenVisionModel = 'qwen3-vl-plus';

    if (systemPrompt && systemPrompt.length > 0) {
        messages.push({ role: 'system', content: systemPrompt });
        console.log('🔵 [createQwenSession] System prompt set, length:', systemPrompt.length);
    }

    let closed = false;

    async function callChatCompletions(model, messagesList, options = {}) {
        const { skipFinalStatus = false } = options;

        console.log('📡 [callChatCompletions] 准备调用 API...');
        console.log('📡 [callChatCompletions] Endpoint:', endpoint);
        console.log('📡 [callChatCompletions] Model:', model);
        console.log('📡 [callChatCompletions] Messages count:', messagesList.length);

        sendToRenderer('update-status', '回答中...');

        const headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Bearer ${apiKey}`,
        };

        const body = {
            model,
            messages: messagesList,
            stream: false,
            max_tokens: maxTokens,
        };

        const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        console.log('📡 [callChatCompletions] Response status:', res.status);

        if (!res.ok) {
            const text = await res.text();
            console.error('❌ [callChatCompletions] API Error Response:', text);
            throw new Error(`API error ${res.status}: ${text}`);
        }

        const data = await res.json();
        console.log('✅ [callChatCompletions] Response received');

        const content = data?.choices?.[0]?.message?.content || '';
        messages.push({ role: 'assistant', content });
        sendToRenderer('update-response', content);

        if (!skipFinalStatus) {
            sendToRenderer('update-status', '就绪');
        }

        return content;
    }

    async function sendRealtimeInput(payload, options = {}) {
        const { skipFinalStatus = false } = options;

        console.log('🔵 [sendRealtimeInput] called, closed:', closed);
        console.log('🔵 [sendRealtimeInput] payload keys:', Object.keys(payload || {}));

        if (closed) {
            console.warn('⚠️ [sendRealtimeInput] Session is closed, ignoring input');
            return;
        }

        try {
            if (payload?.text) {
                console.log('📝 [sendRealtimeInput] Processing text message...');
                messages.push({ role: 'user', content: payload.text });
                await callChatCompletions(qwenTextModel, messages, { skipFinalStatus });
                console.log('✅ [sendRealtimeInput] Text message processed');
                return;
            }

            if (payload?.videoUrl) {
                console.log('🎬 [sendRealtimeInput] Processing video URL...');
                const parts = [
                    { type: 'video_url', video_url: { url: payload.videoUrl } },
                    { type: 'text', text: payload.debug || '请结合视频与图片或文本生成回答。' }
                ];

                if (payload?.media?.data) {
                    const dataUrl = `data:${payload.media.mimeType || 'image/jpeg'};base64,${payload.media.data}`;
                    parts.push({ type: 'image_url', image_url: { url: dataUrl } });
                }

                messages.push({ role: 'user', content: parts });
                await callChatCompletions(qwenVisionModel, messages);
                console.log('✅ [sendRealtimeInput] Video URL processed');
                return;
            }

            if (payload?.media?.data) {
                console.log('🖼️ [sendRealtimeInput] Processing image...');
                console.log('🖼️ [sendRealtimeInput] Image data length:', payload.media.data?.length);

                const dataUrl = `data:${payload.media.mimeType || 'image/jpeg'};base64,${payload.media.data}`;
                const text = payload.debug || '这是截图+文本联合测试：请结合图片与这段文字生成回答。';

                messages.push({
                    role: 'user',
                    content: [
                        { type: 'text', text },
                        { type: 'image_url', image_url: { url: dataUrl } },
                    ],
                });

                await callChatCompletions(qwenVisionModel, messages);
                console.log('✅ [sendRealtimeInput] Image processed');
                return;
            }

            if (payload?.audio?.data) {
                console.log('🎤 [sendRealtimeInput] Audio data received, should use ASR endpoint');
                return;
            }

            console.warn('⚠️ [sendRealtimeInput] Unknown payload type');
        } catch (error) {
            console.error('❌ [sendRealtimeInput] Error:', error);
            sendToRenderer('update-status', 'Error: ' + (error?.message || 'Unknown'));
        }
    }

    async function close() {
        console.log('🔴 [close] Closing Qwen session...');
        closed = true;
    }

    function clearHistory() {
        console.log('🧹 [clearHistory] Clearing Qwen session history...');
        messages.length = 0;
        if (systemPrompt && systemPrompt.length > 0) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        console.log('✅ [clearHistory] History cleared, messages count:', messages.length);
    }

    return { sendRealtimeInput, close, clearHistory };
}

function createAihubmixSession({ model, apiKey, apiBase, systemPrompt, language, maxTokens }) {
    console.log('🔵 [createAihubmixSession] 创建 aihubmix session...');
    console.log('🔵 [createAihubmixSession] Model:', model);
    console.log('🔵 [createAihubmixSession] API Base:', apiBase);
    console.log('🔵 [createAihubmixSession] Max Tokens:', maxTokens);

    const messages = [];
    const endpoint = `${apiBase.replace(/\/$/, '')}/chat/completions`;

    if (systemPrompt && systemPrompt.length > 0) {
        messages.push({ role: 'system', content: systemPrompt });
    }

    let closed = false;
    const lowerModel = (model || '').toLowerCase();
    const supportsImage = /gemini.*image|qwen.*vl|qwen2-?vl|qwen.*vision/.test(lowerModel);

    async function callChatCompletions(options = {}) {
        const { skipFinalStatus = false } = options;

        console.log('📡 [callChatCompletions] 准备调用 API...');
        console.log('📡 [callChatCompletions] Endpoint:', endpoint);

        sendToRenderer('update-status', '回答中...');

        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        };

        const body = {
            model,
            messages,
            stream: false,
            max_tokens: maxTokens,
        };

        const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

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

        if (!skipFinalStatus) {
            sendToRenderer('update-status', '就绪');
        }
    }

    async function sendRealtimeInput(payload, options = {}) {
        const { skipFinalStatus = false } = options;

        console.log('🔵 sendRealtimeInput called, closed:', closed);
        console.log('🔵 payload keys:', Object.keys(payload || {}));

        if (closed) return;

        try {
            if (payload?.text) {
                messages.push({ role: 'user', content: payload.text });
                await callChatCompletions({ skipFinalStatus });
                return;
            }

            if (payload?.videoUrl) {
                const parts = [
                    { type: 'video_url', video_url: { url: payload.videoUrl } },
                    { type: 'text', text: payload.debug || '请结合视频与图片或文本生成回答。' }
                ];

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

    function clearHistory() {
        console.log('🧹 Clearing Aihubmix session history...');
        messages.length = 0;
        if (systemPrompt && systemPrompt.length > 0) {
            messages.push({ role: 'system', content: systemPrompt });
        }
    }

    return { sendRealtimeInput, close, clearHistory };
}
