// renderer.js
const nodeRequire =
    typeof require === 'function'
        ? require
        : typeof window !== 'undefined' && typeof window.require === 'function'
          ? window.require
          : null;

const electron = nodeRequire ? nodeRequire('electron') : null;
const realIpcRenderer = electron?.ipcRenderer || null;
const ipcRenderer =
    realIpcRenderer ||
    ({
        invoke: async () => {
            throw new Error('ipcRenderer is not available');
        },
        on: () => {},
        send: () => {},
        removeAllListeners: () => {},
    });

let createPcmRecorder = null;
try {
    if (nodeRequire) {
        ({ createPcmRecorder } = nodeRequire('./utils/pcmRecorder'));
    }
} catch (e) {}

const platform = typeof process !== 'undefined' ? process.platform : 'browser';
const isElectron = !!(typeof process !== 'undefined' && process.versions?.electron && realIpcRenderer);

// Initialize Windows Audio Recorder (if on Windows)
if (isElectron && platform === 'win32') {
    try {
        const { initialize } = nodeRequire('./utils/windowsAudioRecorder');
        initialize();
        console.log('Windows Audio Recorder initialized');
    } catch (e) {
        console.error('Failed to initialize Windows Audio Recorder:', e);
    }
}

// Initialize random display name for UI components
window.randomDisplayName = null;

// Request random display name from main process
if (isElectron) {
    ipcRenderer
        .invoke('get-random-display-name')
        .then(name => {
            window.randomDisplayName = name;
            console.log('Set random display name:', name);
        })
        .catch(err => {
            console.warn('Could not get random display name:', err);
            window.randomDisplayName = 'System Monitor';
        });
} else {
    window.randomDisplayName = 'System Monitor';
}

let mediaStream = null;
let screenshotInterval = null;
let audioContext = null;
let audioProcessor = null;
let micAudioProcessor = null;
let audioBuffer = [];
const SAMPLE_RATE = 24000;
const AUDIO_CHUNK_DURATION = 0.1; // seconds
const BUFFER_SIZE = 4096; // Increased buffer size for smoother audio

let hiddenVideo = null;
let offscreenCanvas = null;
let offscreenContext = null;
let currentImageQuality = (typeof localStorage !== 'undefined' && localStorage.getItem('selectedImageQuality')) || 'medium'; // Store current image quality for manual screenshots

let isQuickRecording = false;
let quickRecordStream = null;
let quickRecorder = null;
let quickRecordChunks = [];
let quickRecordStartTime = null;
let quickRecordStallCount = 0;

const isLinux = platform === 'linux';
const isMacOS = platform === 'darwin';

// Token tracking system for rate limiting
let tokenTracker = {
    tokens: [], // Array of {timestamp, count, type} objects
    audioStartTime: null,

    // Add tokens to the tracker
    addTokens(count, type = 'image') {
        const now = Date.now();
        this.tokens.push({
            timestamp: now,
            count: count,
            type: type,
        });

        // Clean old tokens (older than 1 minute)
        this.cleanOldTokens();
    },

    // Calculate image tokens based on Gemini 2.0 rules
    calculateImageTokens(width, height) {
        // Images ≤384px in both dimensions = 258 tokens
        if (width <= 384 && height <= 384) {
            return 258;
        }

        // Larger images are tiled into 768x768 chunks, each = 258 tokens
        const tilesX = Math.ceil(width / 768);
        const tilesY = Math.ceil(height / 768);
        const totalTiles = tilesX * tilesY;

        return totalTiles * 258;
    },

    // Track audio tokens continuously
    trackAudioTokens() {
        if (!this.audioStartTime) {
            this.audioStartTime = Date.now();
            return;
        }

        const now = Date.now();
        const elapsedSeconds = (now - this.audioStartTime) / 1000;

        // Audio = 32 tokens per second
        const audioTokens = Math.floor(elapsedSeconds * 32);

        if (audioTokens > 0) {
            this.addTokens(audioTokens, 'audio');
            this.audioStartTime = now;
        }
    },

    // Clean tokens older than 1 minute
    cleanOldTokens() {
        const oneMinuteAgo = Date.now() - 60 * 1000;
        this.tokens = this.tokens.filter(token => token.timestamp > oneMinuteAgo);
    },

    // Get total tokens in the last minute
    getTokensInLastMinute() {
        this.cleanOldTokens();
        return this.tokens.reduce((total, token) => total + token.count, 0);
    },

    // Check if we should throttle based on settings
    shouldThrottle() {
        // Get rate limiting settings from localStorage
        const throttleEnabled = localStorage.getItem('throttleTokens') === 'true';
        if (!throttleEnabled) {
            return false;
        }

        const maxTokensPerMin = parseInt(localStorage.getItem('maxTokensPerMin') || '1000000', 10);
        const throttleAtPercent = parseInt(localStorage.getItem('throttleAtPercent') || '75', 10);

        const currentTokens = this.getTokensInLastMinute();
        const throttleThreshold = Math.floor((maxTokensPerMin * throttleAtPercent) / 100);

        console.log(`Token check: ${currentTokens}/${maxTokensPerMin} (throttle at ${throttleThreshold})`);

        return currentTokens >= throttleThreshold;
    },

    // Reset the tracker
    reset() {
        this.tokens = [];
        this.audioStartTime = null;
    },
};

// Track audio tokens every few seconds
setInterval(() => {
    tokenTracker.trackAudioTokens();
}, 2000);

function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        // Improved scaling to prevent clipping
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
}

function arrayBufferToBase64(buffer) {
    return Buffer.from(new Uint8Array(buffer)).toString('base64');
}

async function initializeGemini(profile = 'interview', language = 'zh-CN') {
    const selectedModel = 'qwen';

    console.log('🚀 [renderer] initializeGemini 开始...');
    console.log('🚀 [renderer] 使用 Qwen 模型');

    const apiKey = (localStorage.getItem('apiKey') || '').trim();
    const apiBase = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

    console.log('🚀 [renderer] Model:', selectedModel);
    console.log('🚀 [renderer] Profile:', profile);
    console.log('🚀 [renderer] Language:', language);

    if (apiKey) {
        console.log('🚀 [renderer] 调用 initialize-model...');
        const success = await ipcRenderer.invoke('initialize-model', {
            model: selectedModel,
            apiKey,
            apiBase,
            customPrompt: localStorage.getItem('customPrompt') || '',
            maxTokens: parseInt(localStorage.getItem('maxTokens') || '4096', 10),
            profile,
            language,
        });

        console.log('🚀 [renderer] initialize-model 结果:', success);

        if (success) {
            cheddar.setStatus('就绪');
        } else {
            cheddar.setStatus('初始化失败');
        }
        return success;
    }

    console.log('❌ [renderer] No API Key found');
    return false;
}
// Listen for status updates
ipcRenderer.on('update-status', (event, status) => {
    console.log('Status update:', status);
    cheddar.setStatus(status);
});

// Listen for responses - REMOVED: This is handled in CheatingDaddyApp.js to avoid duplicates
// ipcRenderer.on('update-response', (event, response) => {
//     console.log('Gemini response:', response);
//     cheddar.e().setResponse(response);
//     // You can add UI elements to display the response if needed
// });

async function startCapture(screenshotIntervalSeconds = 5, imageQuality = 'medium') {
    // Store the image quality for manual screenshots
    currentImageQuality = imageQuality;

    // Reset token tracker when starting new capture session
    tokenTracker.reset();
    console.log('🎯 Token tracker reset for new capture session');

    const audioMode = localStorage.getItem('audioMode') || 'speaker_only';
    // ✅ 使用 Qwen，不禁用音频
    const disableAudio = localStorage.getItem('disableAudio') === 'true';

    try {
        if (isMacOS) {
            // On macOS, use SystemAudioDump for audio and getDisplayMedia for screen
            console.log('Starting macOS capture with SystemAudioDump...');

            // 先获取屏幕捕获
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false, // macOS 不使用浏览器音频
            });
            
            // 然后启动系统音频（如果未禁用）
            if (!disableAudio) {
                try {
                    const audioResult = await ipcRenderer.invoke('start-macos-audio');
                    if (!audioResult.success) {
                        console.warn('Failed to start macOS audio capture:', audioResult.error);
                        // 不抛出错误，允许继续只使用视频
                    }
                } catch (err) {
                    console.warn('Error starting macOS audio:', err);
                }
            }

            console.log('macOS screen capture started - audio handled by SystemAudioDump');

            if (!disableAudio && (audioMode === 'mic_only' || audioMode === 'both')) {
                let micStream = null;
                try {
                    micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });
                    console.log('macOS microphone capture started');
                    await setupLinuxMicProcessing(micStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on macOS:', micError);
                }
            }
        } else if (isLinux) {
            // Linux - use display media for screen capture and try to get system audio
            try {
                // First try to get system audio via getDisplayMedia (works on newer browsers)
                mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: 1,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: disableAudio
                        ? false
                        : {
                              channelCount: 2,
                              echoCancellation: false, // Don't cancel system audio
                              noiseSuppression: false,
                              autoGainControl: false,
                          },
                });

                console.log('Linux system audio capture via getDisplayMedia succeeded');

                // Setup audio processing for Linux system audio
                if (!disableAudio) {
                    await setupLinuxSystemAudioProcessing();
                }
            } catch (systemAudioError) {
                console.warn('System audio via getDisplayMedia failed, trying screen-only capture:', systemAudioError);

                // Fallback to screen-only capture
                mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: 1,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: false,
                });
            }

            // Additionally get microphone input for Linux based on audio mode
            if (!disableAudio && (audioMode === 'mic_only' || audioMode === 'both')) {
                let micStream = null;
                try {
                    micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });

                    console.log('Linux microphone capture started');

                    // Setup audio processing for microphone on Linux
                    await setupLinuxMicProcessing(micStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on Linux:', micError);
                    // Continue without microphone if permission denied
                }
            }

            console.log('Linux capture started - system audio:', mediaStream.getAudioTracks().length > 0, 'microphone mode:', audioMode);
        } else {
            // Windows - use display media with loopback for system audio
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: disableAudio
                    ? false
                    : {
                        channelCount: 2,
                        echoCancellation: false,  // ✅ 改为 false
                        noiseSuppression: false,  // ✅ 改为 false
                        autoGainControl: false,   // ✅ 改为 false
                    },
            });

            console.log('Windows capture started with loopback audio');

            // Setup audio processing for Windows loopback audio only
            if (!disableAudio) {
                await setupWindowsLoopbackProcessing();
            }

            if (!disableAudio && (audioMode === 'mic_only' || audioMode === 'both')) {
                let micStream = null;
                try {
                    micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });
                    console.log('Windows microphone capture started');
                    await setupLinuxMicProcessing(micStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on Windows:', micError);
                }
            }
        }

        console.log('MediaStream obtained:', {
            hasVideo: mediaStream.getVideoTracks().length > 0,
            hasAudio: mediaStream.getAudioTracks().length > 0,
            videoTrack: mediaStream.getVideoTracks()[0]?.getSettings(),
        });

        // ✅ 添加详细的音频轨道信息
        if (mediaStream.getAudioTracks().length > 0) {
            const audioTrack = mediaStream.getAudioTracks()[0];
            console.log('✅ System audio track found:', {
                label: audioTrack.label,
                enabled: audioTrack.enabled,
                muted: audioTrack.muted,
                settings: audioTrack.getSettings()
            });
        } else {
            console.warn('⚠️ No audio tracks in mediaStream! System audio capture may have failed.');
        }

        // Start capturing screenshots - check if manual mode
        if (screenshotIntervalSeconds === 'manual' || screenshotIntervalSeconds === 'Manual') {
            console.log('Manual mode enabled - screenshots will be captured on demand only');
            // Don't start automatic capture in manual mode
        } else {
            const intervalMilliseconds = parseInt(screenshotIntervalSeconds) * 1000;
            screenshotInterval = setInterval(() => captureScreenshot(imageQuality), intervalMilliseconds);

            // Capture first screenshot immediately
            setTimeout(() => captureScreenshot(imageQuality), 100);
        }
    } catch (err) {
        console.error('Error starting capture:', err);
        if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
            cheddar.setStatus('⚠️ 未授权屏幕捕获');
        } else {
            cheddar.setStatus('⚠️ 捕获启动失败');
        }
    }
}

let systemAudioRecorder = null;
let micRecorder = null;

function createIpcChunkSender(ipcChannel, mimeType) {
    const queue = [];
    let inflight = 0;
    let dropped = 0;
    const maxQueue = 12;
    const maxInflight = 2;

    const pump = () => {
        while (inflight < maxInflight && queue.length > 0) {
            const payload = queue.shift();
            inflight++;
            ipcRenderer
                .invoke(ipcChannel, payload)
                .catch(() => {})
                .finally(() => {
                    inflight--;
                    pump();
                });
        }
    };

    return {
        send: base64Data => {
            if (queue.length >= maxQueue) {
                queue.shift();
                dropped++;
            }
            queue.push({ data: base64Data, mimeType });
            pump();
        },
        getDropped: () => dropped,
    };
}

async function setupLinuxMicProcessing(micStream) {
    if (!micStream || micStream.getAudioTracks().length === 0) return;
    if (micRecorder) await micRecorder.stop().catch(() => {});

    const sender = createIpcChunkSender('send-mic-audio-content', `audio/pcm;rate=${SAMPLE_RATE}`);
    const audioOnlyStream = new MediaStream([micStream.getAudioTracks()[0]]);

    micRecorder = await createPcmRecorder({
        stream: audioOnlyStream,
        targetSampleRate: SAMPLE_RATE,
        chunkDurationSec: AUDIO_CHUNK_DURATION,
        onChunk: msg => {
            const base64Data = arrayBufferToBase64(msg.buffer);
            sender.send(base64Data);
        },
        onStats: stats => {
            const droppedChunks = sender.getDropped();
            if (droppedChunks > 0) console.warn('[audio] mic chunks dropped:', droppedChunks, stats);
        },
    });
}

async function setupLinuxSystemAudioProcessing() {
    if (!mediaStream || mediaStream.getAudioTracks().length === 0) return;
    if (systemAudioRecorder) await systemAudioRecorder.stop().catch(() => {});

    const sender = createIpcChunkSender('send-audio-content', `audio/pcm;rate=${SAMPLE_RATE}`);
    const audioOnlyStream = new MediaStream([mediaStream.getAudioTracks()[0]]);

    systemAudioRecorder = await createPcmRecorder({
        stream: audioOnlyStream,
        targetSampleRate: SAMPLE_RATE,
        chunkDurationSec: AUDIO_CHUNK_DURATION,
        onChunk: msg => {
            const base64Data = arrayBufferToBase64(msg.buffer);
            sender.send(base64Data);
        },
        onStats: stats => {
            const droppedChunks = sender.getDropped();
            if (droppedChunks > 0) console.warn('[audio] system chunks dropped:', droppedChunks, stats);
        },
    });
}

async function setupWindowsLoopbackProcessing() {
    return setupLinuxSystemAudioProcessing();
}

async function captureScreenshot(imageQuality = 'medium', isManual = false) {
    console.log(`Capturing ${isManual ? 'manual' : 'automated'} screenshot...`);
    if (!mediaStream) {
        console.error('❌ mediaStream is null - capture not started yet!');
        return;
    }

    // Skip automated screenshots when recording audio or throttled
    if (!isManual && (isQuickRecording || tokenTracker.shouldThrottle())) {
        console.log('⚠️ Automated screenshot skipped due to rate limiting');
        return;
    }

    // Lazy init of video element
    if (!hiddenVideo) {
        hiddenVideo = document.createElement('video');
        hiddenVideo.srcObject = mediaStream;
        hiddenVideo.muted = true;
        hiddenVideo.playsInline = true;
        await hiddenVideo.play();

        await new Promise(resolve => {
            if (hiddenVideo.readyState >= 2) return resolve();
            hiddenVideo.onloadedmetadata = () => resolve();
        });

        // Lazy init of canvas based on video dimensions
        // ✅ 限制图片尺寸以兼容视觉模型输入
        const maxWidth = 1280;
        const maxHeight = 1280;
        let width = hiddenVideo.videoWidth;
        let height = hiddenVideo.videoHeight;

        // 计算缩放比例
        const scale = Math.min(maxWidth / width, maxHeight / height, 1);
        const scaledWidth = Math.floor(width * scale);
        const scaledHeight = Math.floor(height * scale);

        console.log(`📐 原始尺寸: ${width}x${height}, 缩放后: ${scaledWidth}x${scaledHeight}`);

        offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = scaledWidth;
        offscreenCanvas.height = scaledHeight;
        offscreenContext = offscreenCanvas.getContext('2d');
    }

    // Check if video is ready
    if (hiddenVideo.readyState < 2) {
        console.warn('Video not ready yet, skipping screenshot');
        return;
    }

    offscreenContext.drawImage(hiddenVideo, 0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // Check if image was drawn properly by sampling a pixel
    const imageData = offscreenContext.getImageData(0, 0, 1, 1);
    const isBlank = imageData.data.every((value, index) => {
        // Check if all pixels are black (0,0,0) or transparent
        return index === 3 ? true : value === 0;
    });

    if (isBlank) {
        console.warn('Screenshot appears to be blank/black');
        try {
            const shot = await ipcRenderer.invoke('take-desktop-screenshot');
            if (shot && shot.success && shot.data) {
                console.log(`Fallback desktopCapturer image length: ${shot.data.length}`);
                await ipcRenderer.invoke('save-screenshot', { data: shot.data, mimeType: shot.mimeType || 'image/png' });
                const result = await ipcRenderer.invoke('send-image-content', {
                    data: shot.data,
                    mimeType: shot.mimeType || 'image/png',
                    debug: localStorage.getItem('screenshotPromptText') || '这是截图+文本联合测试：请结合图片与这段文字生成回答。'
                });
                console.log('send-image-content (fallback) result:', result);
            } else {
                console.error('Fallback desktop screenshot failed:', shot?.error || 'unknown');
            }
        } catch (e) {
            console.error('Fallback desktop screenshot error:', e);
        }
        return;
    }

    let qualityValue;
    switch (imageQuality) {
        case 'high':
            qualityValue = 0.9;
            break;
        case 'medium':
            qualityValue = 0.7;
            break;
        case 'low':
            qualityValue = 0.5;
            break;
        default:
            qualityValue = 0.7; // Default to medium
    }

    offscreenCanvas.toBlob(
        async blob => {
            if (!blob) {
                console.error('Failed to create blob from canvas');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64data = reader.result.split(',')[1];

                // Validate base64 data
                if (!base64data || base64data.length < 100) {
                    console.error('Invalid base64 data generated');
                    return;
                }

                const mimeType = 'image/jpeg';
                await ipcRenderer.invoke('save-screenshot', { data: base64data, mimeType });
                console.log(`Sending image to model, base64 length: ${base64data.length}`);
                const result = await ipcRenderer.invoke('send-image-content', {
                    data: base64data,
                    mimeType,
                    debug: localStorage.getItem('screenshotPromptText') || '这是截图+文本联合测试：请结合图片与这段文字生成回答。'
                });

                console.log('send-image-content result:', result);
                if (result.success) {
                    // Track image tokens after successful send
                    const imageTokens = tokenTracker.calculateImageTokens(offscreenCanvas.width, offscreenCanvas.height);
                    tokenTracker.addTokens(imageTokens, 'image');
                    console.log(`📊 Image sent successfully - ${imageTokens} tokens used (${offscreenCanvas.width}x${offscreenCanvas.height})`);
                } else {
                    console.error('Failed to send image:', result.error);
                }
            };
            reader.readAsDataURL(blob);
        },
        'image/jpeg',
        qualityValue
    );
}

async function captureManualScreenshot(imageQuality = null) {
    console.log('🎯 Manual screenshot triggered');
    console.log('📊 mediaStream status:', mediaStream ? 'initialized' : 'NULL');
    console.log('📊 hiddenVideo status:', hiddenVideo ? 'exists' : 'NULL');
    
    // Check if capture has started
    if (!mediaStream) {
        const quality = imageQuality || currentImageQuality;
        try {
            await startCapture('manual', quality);
        } catch (e) {
            return;
        }
    }
    
    const quality = imageQuality || currentImageQuality;
    console.log('📸 Taking manual screenshot with quality:', quality);
    await captureScreenshot(quality, true);
}

// Expose functions to global scope for external access
window.captureManualScreenshot = captureManualScreenshot;

async function startQuickAudioCapture() {
    // 如果正在录音，则停止录音
    if (isQuickRecording) {
        try {
            if (isMacOS) {
                const stopRes = await ipcRenderer.invoke('stop-macos-audio');
                if (stopRes && stopRes.success) {
                    const base64 = stopRes.pcmBase64 || '';
                    const sr = stopRes.sampleRate || 16000;
                    if (base64 && base64.length > 0) {
                        cheddar.setStatus('🔊 转写系统音频中...');
                        const result = await ipcRenderer.invoke('save-audio-and-transcribe', { pcmBase64: base64, sampleRate: sr });
                        if (!result || !result.success) {
                            cheddar.setStatus('Error: ' + (result?.error || 'Unknown'));
                        }
                    } else {
                        cheddar.setStatus('未录制到音频');
                    }
                } else {
                    cheddar.setStatus('Error: ' + (stopRes?.error || 'Stop failed'));
                }
                isQuickRecording = false;
                quickRecordStream = null;
                quickRecorder = null;
                quickRecordChunks = [];
                quickRecordStartTime = null;
                quickRecordStallCount = 0;
                return;
            }
            if (quickRecorder) await quickRecorder.stop().catch(() => {});
            if (quickRecordStream) quickRecordStream.getTracks().forEach(track => track.stop());

            if (quickRecordChunks.length > 0) {
                const targetSampleRate = 16000;
                const durationSec = quickRecordStartTime ? (Date.now() - quickRecordStartTime) / 1000 : 0;
                const expectedSamples = durationSec > 0 ? Math.round(durationSec * targetSampleRate) : 0;

                let fullBuffer = Buffer.concat(quickRecordChunks);
                const actualSamples = Math.floor(fullBuffer.length / 2);
                let compensated = false;
                if (expectedSamples > 0) {
                    if (actualSamples < expectedSamples * 0.97) {
                        const missing = expectedSamples - actualSamples;
                        if (missing > 0) {
                            fullBuffer = Buffer.concat([fullBuffer, Buffer.alloc(missing * 2)]);
                            compensated = true;
                        }
                    } else if (actualSamples > expectedSamples * 1.03) {
                        fullBuffer = fullBuffer.subarray(0, expectedSamples * 2);
                        compensated = true;
                    }
                }
                if (compensated || quickRecordStallCount > 0) console.warn('[quick-audio] compensated:', compensated, 'stalls:', quickRecordStallCount);

                const base64 = fullBuffer.toString('base64');
                cheddar.setStatus('🔊 转写系统音频中...');
                const result = await ipcRenderer.invoke('save-audio-and-transcribe', { pcmBase64: base64, sampleRate: targetSampleRate });
                if (!result || !result.success) {
                    cheddar.setStatus('Error: ' + (result?.error || 'Unknown'));
                }
            } else {
                cheddar.setStatus('未录制到音频');
            }

            isQuickRecording = false;
            quickRecordStream = null;
            quickRecorder = null;
            quickRecordChunks = [];
            quickRecordStartTime = null;
            quickRecordStallCount = 0;

        } catch (error) {
            cheddar.setStatus('Error: ' + error.message);
            isQuickRecording = false;
        }
        return;
    }

    // 开始新的录音 - 系统音频
    try {
        if (typeof createPcmRecorder !== 'function' && nodeRequire) {
            try {
                ({ createPcmRecorder } = nodeRequire('./utils/pcmRecorder'));
            } catch (e) {}
        }
        if (typeof createPcmRecorder !== 'function') {
            cheddar.setStatus('⚠️ 音频模块未就绪，请重启应用');
            return;
        }

        if (isMacOS) {
            const startRes = await ipcRenderer.invoke('start-macos-audio');
            if (!startRes || !startRes.success) {
                cheddar.setStatus('Error: ' + (startRes?.error || 'Start failed'));
                return;
            }
            isQuickRecording = true;
            quickRecordStartTime = Date.now();
            const stopKey = 'Cmd+L';
            cheddar.setStatus(`🔊 录制系统音频... (${stopKey} 停止)`);
            return;
        }

        // Windows/Linux - 获取系统音频
        let streamToUse = null;

        // 检查是否有现成的 mediaStream (系统音频)
        if (mediaStream && mediaStream.getAudioTracks().length > 0) {
            streamToUse = new MediaStream([mediaStream.getAudioTracks()[0]]);
            console.log('✅ 使用现有系统音频流');
        } else {
            // 尝试获取系统音频
            try {
                quickRecordStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: 1,
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: {
                        channelCount: 2,
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                    },
                });

                const audioTracks = quickRecordStream.getAudioTracks();
                if (audioTracks.length === 0) {
                    // 没有系统音频，清理并提示用户
                    quickRecordStream.getTracks().forEach(track => track.stop());
                    quickRecordStream = null;
                    cheddar.setStatus('⚠️ 未获取到系统音频（分享窗口时请勾选“共享音频”）');
                    return;
                }
                streamToUse = new MediaStream([audioTracks[0]]);
                console.log('✅ 获取到新的系统音频流');
            } catch (getErr) {
                cheddar.setStatus('⚠️ 无法获取系统音频: ' + getErr.message);
                return;
            }
        }

        if (!streamToUse) {
            cheddar.setStatus('⚠️ 无系统音频流');
            return;
        }

        const stopKey = platform === 'darwin' ? 'Cmd+L' : 'Ctrl+L';

        quickRecordChunks = [];
        quickRecordStartTime = Date.now();
        quickRecordStallCount = 0;
        isQuickRecording = true;
        quickRecorder = await createPcmRecorder({
            stream: streamToUse,
            targetSampleRate: 16000,
            chunkDurationSec: 0.25,
            onChunk: msg => {
                if (!isQuickRecording) return;
                quickRecordChunks.push(Buffer.from(msg.buffer));
            },
            onEvent: ev => {
                if (ev && ev.type === 'stall') quickRecordStallCount++;
            },
        });
        cheddar.setStatus(`🔊 录制系统音频... (${stopKey} 停止)`);

    } catch (error) {
        cheddar.setStatus('Error: ' + error.message);
        isQuickRecording = false;
    }
}

window.startQuickAudioCapture = startQuickAudioCapture;

function stopCapture() {
    if (screenshotInterval) {
        clearInterval(screenshotInterval);
        screenshotInterval = null;
    }

    if (systemAudioRecorder) {
        systemAudioRecorder.stop().catch(() => {});
        systemAudioRecorder = null;
    }
    if (micRecorder) {
        micRecorder.stop().catch(() => {});
        micRecorder = null;
    }
    if (quickRecorder) {
        quickRecorder.stop().catch(() => {});
        quickRecorder = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    // Stop macOS audio capture if running
    if (isMacOS) {
        ipcRenderer.invoke('stop-macos-audio').catch(err => {
            console.error('Error stopping macOS audio:', err);
        });
    }

    // Clean up hidden elements
    if (hiddenVideo) {
        hiddenVideo.pause();
        hiddenVideo.srcObject = null;
        hiddenVideo = null;
    }
    offscreenCanvas = null;
    offscreenContext = null;
}

// Send text message to Gemini
async function sendTextMessage(text) {
    if (!text || text.trim().length === 0) {
        console.warn('Cannot send empty text message');
        return { success: false, error: 'Empty message' };
    }

    try {
        const result = await ipcRenderer.invoke('send-text-message', text);
        if (result.success) {
            console.log('Text message sent successfully');
        } else {
            console.error('Failed to send text message:', result.error);
        }
        return result;
    } catch (error) {
        console.error('Error sending text message:', error);
        return { success: false, error: error.message };
    }
}

// Conversation storage functions using IndexedDB
let conversationDB = null;

async function initConversationStorage() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ConversationHistory', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            conversationDB = request.result;
            resolve(conversationDB);
        };

        request.onupgradeneeded = event => {
            const db = event.target.result;

            // Create sessions store
            if (!db.objectStoreNames.contains('sessions')) {
                const sessionStore = db.createObjectStore('sessions', { keyPath: 'sessionId' });
                sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

async function saveConversationSession(sessionId, conversationHistory) {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');

    const sessionData = {
        sessionId: sessionId,
        timestamp: parseInt(sessionId),
        conversationHistory: conversationHistory,
        lastUpdated: Date.now(),
    };

    return new Promise((resolve, reject) => {
        const request = store.put(sessionData);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getConversationSession(sessionId) {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');

    return new Promise((resolve, reject) => {
        const request = store.get(sessionId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getAllConversationSessions() {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    const index = store.index('timestamp');

    return new Promise((resolve, reject) => {
        const request = index.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            // Sort by timestamp descending (newest first)
            const sessions = request.result.sort((a, b) => b.timestamp - a.timestamp);
            resolve(sessions);
        };
    });
}

// Listen for conversation data from main process
ipcRenderer.on('save-conversation-turn', async (event, data) => {
    try {
        await saveConversationSession(data.sessionId, data.fullHistory);
        console.log('Conversation session saved:', data.sessionId);
    } catch (error) {
        console.error('Error saving conversation session:', error);
    }
});

// Initialize conversation storage when renderer loads
if (typeof indexedDB !== 'undefined') {
    initConversationStorage().catch(console.error);
}

// Listen for emergency erase command from main process
ipcRenderer.on('clear-sensitive-data', () => {
    console.log('Clearing renderer-side sensitive data...');
    localStorage.removeItem('apiKey');
    localStorage.removeItem('customPrompt');
    localStorage.removeItem('licenseKey');
    localStorage.removeItem('modelApiKey');
    // Consider clearing IndexedDB as well for full erasure
});

// Handle shortcuts based on current view
function handleShortcut(shortcutKey) {
    const currentView = cheddar.getCurrentView();

    if (shortcutKey === 'ctrl+enter' || shortcutKey === 'cmd+enter') {
        if (currentView === 'main') {
            cheddar.element().handleStart();
        } else {
            captureManualScreenshot();
        }
    }
}

// Create reference to the main app element
const cheatingDaddyApp = document.querySelector('cheating-daddy-app');

// Consolidated cheddar object - all functions in one place
const cheddar = {
    // Element access
    element: () => cheatingDaddyApp,
    e: () => cheatingDaddyApp,

    // App state functions - access properties directly from the app element
    getCurrentView: () => cheatingDaddyApp.currentView,
    getLayoutMode: () => cheatingDaddyApp.layoutMode,

    // Status and response functions
    setStatus: text => cheatingDaddyApp.setStatus(text),
    setResponse: response => cheatingDaddyApp.setResponse(response),

    // Core functionality
    initializeGemini,
    startCapture,
    stopCapture,
    sendTextMessage,
    handleShortcut,

    // Conversation history functions
    getAllConversationSessions,
    getConversationSession,
    initConversationStorage,

    // Content protection function
    getContentProtection: () => {
        const contentProtection = localStorage.getItem('contentProtection');
        return contentProtection !== null ? contentProtection === 'true' : true;
    },

    // Platform detection
    isLinux: isLinux,
    isMacOS: isMacOS,
};

// Make it globally available
window.cheddar = cheddar;
