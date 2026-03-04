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

async function hydrateLocalStorageFromConfig() {
    if (!isElectron) return;
    if (typeof localStorage === 'undefined') return;
    try {
        const res = await ipcRenderer.invoke('get-config');
        if (!res?.success || !res?.config) return;
        const cfg = res.config;

        if (typeof cfg.modelApiBase === 'string' && cfg.modelApiBase.trim()) {
            localStorage.setItem('modelApiBase', cfg.modelApiBase.trim());
        }
        if (typeof cfg.maxTokens === 'number' && Number.isFinite(cfg.maxTokens)) {
            localStorage.setItem('maxTokens', String(Math.max(1, Math.floor(cfg.maxTokens))));
        }
        if (typeof cfg.qwenTextModel === 'string' && cfg.qwenTextModel.trim()) {
            localStorage.setItem('qwenTextModel', cfg.qwenTextModel.trim());
        }
        if (typeof cfg.qwenVisionModel === 'string' && cfg.qwenVisionModel.trim()) {
            localStorage.setItem('qwenVisionModel', cfg.qwenVisionModel.trim());
        }
        if (typeof cfg.transcriptionModel === 'string' && cfg.transcriptionModel.trim()) {
            localStorage.setItem('transcriptionModel', cfg.transcriptionModel.trim());
        }
        if (typeof cfg.licenseKey === 'string') {
            const v = cfg.licenseKey.trim();
            if (v) localStorage.setItem('licenseKey', v);
        }
        if (typeof cfg.apiKey === 'string') {
            const v = cfg.apiKey.trim();
            if (v) localStorage.setItem('apiKey', v);
        }
        if (typeof cfg.enableEnrichment === 'boolean') {
            localStorage.setItem('enableEnrichment', String(cfg.enableEnrichment));
        }
        if (typeof cfg.asrChunkDurationSec === 'number' && Number.isFinite(cfg.asrChunkDurationSec)) {
            const v = Math.max(0, Math.min(10, cfg.asrChunkDurationSec));
            localStorage.setItem('asrChunkDurationSec', String(v));
        }
    } catch (e) {}
}

window.__configHydrated = hydrateLocalStorageFromConfig();

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
let isLiveAsrRunning = false;
let liveAsrNoChunking = false;
let liveAsrBufferedChunks = [];
let liveTranscriptBuffer = '';
let lastSubmittedOffset = 0;
let liveAsrSampleRate = 16000;
let lastIntentPredictAt = 0;
let lastIntentPredictLen = 0;
let cleanedTranscriptDisplay = '';
let committedDisplay = '';
let committedRawLength = 0;
let commitTimer = null;
let refineIntervalId = null;
let currentSegmentCleaned = '';
let isCommitting = false;
const INTENT_PREDICT_MIN_CHARS = 8;
const INTENT_PREDICT_MIN_INTERVAL_MS = 2000;
const COMMIT_SILENCE_MS = 800;
const REFINE_INTERVAL_MS = 2000;
const COMMIT_MIN_CHARS = 4;

const isLinux = platform === 'linux';
const isMacOS = platform === 'darwin';

async function getCurrentUserScope() {
    if (!isElectron) return '';
    try {
        const authRes = await ipcRenderer.invoke('get-user-auth');
        if (!authRes?.hasUserAuthToken) return '';
        const profileRes = await Promise.race([
            ipcRenderer.invoke('user-get-profile'),
            new Promise(resolve => setTimeout(() => resolve({ success: false, timeout: true }), 1200)),
        ]);
        const profile = profileRes?.profile || {};
        const uid = Number(profile?.id);
        const email = String(profile?.email || '').trim().toLowerCase();
        if (Number.isFinite(uid)) return `uid:${uid}`;
        if (email) return `email:${email}`;
    } catch (_) {}
    return '';
}

function readScopedLocal(baseKey, scope) {
    const scopedKey = scope ? `${baseKey}::${scope}` : baseKey;
    const scopedVal = localStorage.getItem(scopedKey);
    if (scopedVal !== null) return scopedVal;
    return localStorage.getItem(baseKey) || '';
}

function readRuntimeFallback(baseKey) {
    if (baseKey === 'localResumeContext') {
        const runtime = String(window.__runtimeLocalResumeContext || '');
        if (runtime) return runtime;
        // 未登录时从 sessionStorage 临时缓存读取（关闭窗口后自动清除）
        try {
            return String(sessionStorage?.getItem?.('localResumeContext') || '');
        } catch (_) { return ''; }
    }
    if (baseKey === 'jdContext') return String(window.__runtimeJdContext || '');
    if (baseKey === 'asrHotwords') {
        const arr = Array.isArray(window.__runtimeAsrHotwords) ? window.__runtimeAsrHotwords : [];
        if (arr.length) return arr.join(',');
        try {
            return String(sessionStorage?.getItem?.('asrHotwords') || '');
        } catch (_) { return ''; }
    }
    return '';
}

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
    const apiBase = (localStorage.getItem('modelApiBase') || 'https://dashscope.aliyuncs.com/compatible-mode/v1').trim();

    console.log('🚀 [renderer] Model:', selectedModel);
    console.log('🚀 [renderer] Profile:', profile);
    console.log('🚀 [renderer] Language:', language);

    if (apiKey) {
        const userScope = await getCurrentUserScope();
        let scopedResumeContext = readScopedLocal('localResumeContext', userScope);
        let scopedJdContext = readScopedLocal('jdContext', userScope);
        // 未登录用户不缓存：使用运行期内存上下文
        if (!userScope) {
            if (!scopedResumeContext) scopedResumeContext = readRuntimeFallback('localResumeContext');
            if (!scopedJdContext) scopedJdContext = readRuntimeFallback('jdContext');
        }
        console.log('🚀 [renderer] 调用 initialize-model...');
        const success = await ipcRenderer.invoke('initialize-model', {
            model: selectedModel,
            apiKey,
            apiBase,
            customPrompt: localStorage.getItem('customPrompt') || '',
            localResumeContext: scopedResumeContext,
            jdContext: scopedJdContext,
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

function refreshTranscriptDisplay() {
    const currentSegmentRaw = liveTranscriptBuffer.substring(committedRawLength);
    const currentDisplay = currentSegmentCleaned || currentSegmentRaw;
    const display = committedDisplay + currentDisplay;
    if (typeof cheddar?.setLiveTranscript === 'function') {
        cheddar.setLiveTranscript(display);
    }
}

function getDisplayTranscriptForSubmit() {
    const currentSegmentRaw = liveTranscriptBuffer.substring(committedRawLength);
    const currentDisplay = currentSegmentCleaned || currentSegmentRaw;
    return committedDisplay + currentDisplay;
}

async function refineCurrentSegment() {
    if (isCommitting) return;
    const currentSegmentRaw = liveTranscriptBuffer.substring(committedRawLength).trim();
    if (!currentSegmentRaw || currentSegmentRaw.length < COMMIT_MIN_CHARS) return;
    const committedRawLengthAtRequest = committedRawLength;
    try {
        const result = await ipcRenderer.invoke('commit-transcript-segment', { transcript: currentSegmentRaw });
        if (committedRawLength !== committedRawLengthAtRequest) return;
        if (result?.success && result.cleaned) {
            currentSegmentCleaned = result.cleaned;
        }
    } catch (e) {
        console.warn('[refine-segment]', e);
    }
    refreshTranscriptDisplay();
}

function stopRefineInterval() {
    if (refineIntervalId) {
        clearInterval(refineIntervalId);
        refineIntervalId = null;
    }
}

async function doCommitSegment() {
    if (commitTimer) {
        clearTimeout(commitTimer);
        commitTimer = null;
    }
    stopRefineInterval();
    if (isCommitting) return;
    const currentSegmentRaw = liveTranscriptBuffer.substring(committedRawLength).trim();
    if (!currentSegmentRaw || currentSegmentRaw.length < COMMIT_MIN_CHARS) return;
    isCommitting = true;
    const committedRawLengthAtRequest = liveTranscriptBuffer.length;
    try {
        const result = await ipcRenderer.invoke('commit-transcript-segment', { transcript: currentSegmentRaw });
        if (result?.success && result.cleaned) {
            committedDisplay += (committedDisplay ? ' ' : '') + result.cleaned;
            committedRawLength = committedRawLengthAtRequest;
            currentSegmentCleaned = '';
        }
    } catch (e) {
        console.warn('[commit-segment]', e);
    } finally {
        isCommitting = false;
    }
    refreshTranscriptDisplay();
}

ipcRenderer.on('update-live-transcript', (_event, payload) => {
    const nextText = typeof payload?.text === 'string' ? payload.text : '';
    liveTranscriptBuffer = nextText;
    if (lastSubmittedOffset > liveTranscriptBuffer.length) {
        lastSubmittedOffset = liveTranscriptBuffer.length;
    }
    if (commitTimer) {
        clearTimeout(commitTimer);
        commitTimer = null;
    }
    const currentSegmentRaw = liveTranscriptBuffer.substring(committedRawLength);
    refreshTranscriptDisplay();
    if (isLiveAsrRunning && currentSegmentRaw.length >= COMMIT_MIN_CHARS) {
        commitTimer = setTimeout(doCommitSegment, COMMIT_SILENCE_MS);
        if (!refineIntervalId) {
            refineIntervalId = setInterval(refineCurrentSegment, REFINE_INTERVAL_MS);
        }
    } else {
        stopRefineInterval();
    }
});

ipcRenderer.on('update-cleaned-transcript', (_event, payload) => {
    const text = typeof payload?.text === 'string' ? payload.text : '';
    cleanedTranscriptDisplay = text;
    if (text && !committedDisplay) {
        refreshTranscriptDisplay();
    }
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
    }

    const width = hiddenVideo.videoWidth || 0;
    const height = hiddenVideo.videoHeight || 0;
    if (width <= 0 || height <= 0) {
        console.warn('Video dimensions not available yet, skipping screenshot');
        return;
    }

    let dimensionScale;
    switch (imageQuality) {
        case 'high':
            dimensionScale = 1;
            break;
        case 'medium':
            dimensionScale = 0.5;
            break;
        case 'low':
            dimensionScale = 0.25;
            break;
        default:
            dimensionScale = 0.5;
    }

    const scaledWidth = Math.max(1, Math.floor(width * dimensionScale));
    const scaledHeight = Math.max(1, Math.floor(height * dimensionScale));

    if (!offscreenCanvas || offscreenCanvas.width !== scaledWidth || offscreenCanvas.height !== scaledHeight) {
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

function resetLiveTranscriptState() {
    liveAsrNoChunking = false;
    liveAsrBufferedChunks = [];
    liveTranscriptBuffer = '';
    cleanedTranscriptDisplay = '';
    committedDisplay = '';
    committedRawLength = 0;
    currentSegmentCleaned = '';
    if (commitTimer) {
        clearTimeout(commitTimer);
        commitTimer = null;
    }
    stopRefineInterval();
    lastSubmittedOffset = 0;
    lastIntentPredictAt = 0;
    lastIntentPredictLen = 0;
    cheddar.setLiveTranscript('');
}

async function clearLiveTranscript() {
    liveTranscriptBuffer = '';
    cleanedTranscriptDisplay = '';
    committedDisplay = '';
    committedRawLength = 0;
    currentSegmentCleaned = '';
    if (commitTimer) {
        clearTimeout(commitTimer);
        commitTimer = null;
    }
    stopRefineInterval();
    lastSubmittedOffset = 0;
    cheddar.setLiveTranscript('');
    cheddar.setStatus('转写已清空');
    // 同步清空主进程 session 中的累积文本，否则下次推送仍会带回旧内容
    try {
        await ipcRenderer.invoke('clear-live-transcript');
    } catch (e) {
        console.warn('[clearLiveTranscript] main process clear failed:', e);
    }
}

async function stopRealtimeAsrCapture() {
    try {
        if (quickRecorder) {
            await quickRecorder.stop().catch(() => {});
            quickRecorder = null;
        }
        if (liveAsrNoChunking && liveAsrBufferedChunks.length > 0) {
            const totalLength = liveAsrBufferedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
            if (totalLength > 0) {
                const merged = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of liveAsrBufferedChunks) {
                    merged.set(chunk, offset);
                    offset += chunk.length;
                }
                await ipcRenderer.invoke('push-live-audio-chunk', {
                    pcmBase64: arrayBufferToBase64(merged.buffer),
                    sampleRate: liveAsrSampleRate,
                });
            }
        }
        if (quickRecordStream) {
            quickRecordStream.getTracks().forEach(track => track.stop());
            quickRecordStream = null;
        }
        const stopRes = await ipcRenderer.invoke('stop-live-asr');
        if (!stopRes?.success) {
            cheddar.setStatus('Error: ' + (stopRes?.error || 'Live ASR stop failed'));
        } else {
            cheddar.setStatus('实时识别已停止');
        }
    } catch (error) {
        cheddar.setStatus('Error: ' + error.message);
    } finally {
        isQuickRecording = false;
        isLiveAsrRunning = false;
        liveAsrNoChunking = false;
        liveAsrBufferedChunks = [];
    }
}

async function startQuickAudioCapture(options = {}) {
    const useMic = options.useMic || false;

    if (isQuickRecording || isLiveAsrRunning) {
        cheddar.setLiveAsrRunning(false);
        await stopRealtimeAsrCapture();
        await submitLiveTranscriptDelta();
        cheddar.setLiveTranscript('');
        return;
    }

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

        const apiKey = (localStorage.getItem('apiKey') || '').trim();
        if (!apiKey) {
            cheddar.setStatus('请先配置 API Key');
            return;
        }

        resetLiveTranscriptState();
        const userScope = await getCurrentUserScope();
        let rawHotwords = String(readScopedLocal('asrHotwords', userScope));
        if (!userScope && !rawHotwords) {
            rawHotwords = readRuntimeFallback('asrHotwords');
        }
        const hotwords = rawHotwords
            .split(',')
            .map(x => x.trim())
            .filter(Boolean)
            .slice(0, 15);
        const startLiveRes = await ipcRenderer.invoke('start-live-asr', {
            apiKey,
            sampleRate: liveAsrSampleRate,
            hotwords,
        });
        if (!startLiveRes?.success) {
            cheddar.setStatus('Error: ' + (startLiveRes?.error || 'Live ASR start failed'));
            return;
        }

        if (useMic) {
            try {
                quickRecordStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: liveAsrSampleRate,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    video: false
                });
            } catch (err) {
                console.error('Microphone access failed:', err);
                cheddar.setStatus('❌ 麦克风访问失败');
                await ipcRenderer.invoke('stop-live-asr').catch(() => {});
                return;
            }
        } else {
            if (isMacOS) {
                cheddar.setStatus('⚠️ macOS 实时识别暂不可用');
                await ipcRenderer.invoke('stop-live-asr').catch(() => {});
                return;
            }

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
            } catch (err) {
                console.error('System audio access failed:', err);
                cheddar.setStatus('❌ 系统音频获取失败');
                await ipcRenderer.invoke('stop-live-asr').catch(() => {});
                return;
            }
        }

        const audioTracks = quickRecordStream.getAudioTracks();
        if (audioTracks.length === 0) {
            quickRecordStream.getTracks().forEach(track => track.stop());
            quickRecordStream = null;
            cheddar.setStatus(useMic ? '❌ 未检测到麦克风音轨' : '⚠️ 未获取到系统音频（请勾选共享音频）');
            await ipcRenderer.invoke('stop-live-asr').catch(() => {});
            return;
        }

        const streamToUse = new MediaStream([audioTracks[0]]);
        isQuickRecording = true;
        isLiveAsrRunning = true;
        quickRecordStartTime = Date.now();
        quickRecordStallCount = 0;
        liveAsrBufferedChunks = [];

        const asrChunkConfig = (() => {
            const v = parseFloat(localStorage.getItem('asrChunkDurationSec') || '0');
            const normalized = Number.isFinite(v) ? Math.max(0, Math.min(10, v)) : 0;
            return {
                raw: normalized,
                noChunking: normalized === 0,
                recorderChunkSec: normalized === 0 ? 0.25 : normalized,
            };
        })();
        liveAsrNoChunking = asrChunkConfig.noChunking;
        const monitorStallMs = Math.max(1500, Math.round(asrChunkConfig.recorderChunkSec * 3000));
        quickRecorder = await createPcmRecorder({
            stream: streamToUse,
            targetSampleRate: liveAsrSampleRate,
            chunkDurationSec: asrChunkConfig.recorderChunkSec,
            monitorStallMs,
            onChunk: msg => {
                if (!isLiveAsrRunning) return;
                if (liveAsrNoChunking) {
                    liveAsrBufferedChunks.push(new Uint8Array(msg.buffer));
                    return;
                }
                ipcRenderer
                    .invoke('push-live-audio-chunk', {
                        pcmBase64: arrayBufferToBase64(msg.buffer),
                        sampleRate: liveAsrSampleRate,
                    })
                    .catch(() => {});
            },
            onEvent: ev => {
                if (ev && ev.type === 'stall') quickRecordStallCount++;
            },
        });

        cheddar.setLiveAsrRunning(true);
        
        let stopKey = 'Ctrl+L';
        if (useMic) {
            stopKey = 'Ctrl+K'; // Windows Mic
            if (platform === 'darwin') stopKey = 'Cmd+K';
        } else {
            if (platform === 'darwin') stopKey = 'Cmd+L';
        }

        const sourceName = useMic ? '麦克风' : '实时';
        cheddar.setStatus(`🎙️ ${sourceName}识别中... (再按 ${stopKey} 停止并提交给 AI)`);
    } catch (error) {
        cheddar.setStatus('Error: ' + error.message);
        isQuickRecording = false;
        isLiveAsrRunning = false;
        liveAsrNoChunking = false;
        liveAsrBufferedChunks = [];
        await ipcRenderer.invoke('stop-live-asr').catch(() => {});
    }
}

async function submitLiveTranscriptDelta() {
    const hasUncommitted = liveTranscriptBuffer.substring(committedRawLength).trim().length >= COMMIT_MIN_CHARS;
    if (hasUncommitted) {
        if (commitTimer) {
            clearTimeout(commitTimer);
            commitTimer = null;
        }
        await doCommitSegment();
    }
    const textToSubmit = committedDisplay ? getDisplayTranscriptForSubmit() : liveTranscriptBuffer;
    const submitText = textToSubmit.substring(lastSubmittedOffset).trim();
    if (!submitText) {
        cheddar.setStatus('暂无新增转写');
        return { success: false, submitted: false, reason: 'empty-delta' };
    }

    cheddar.setStatus('提交中...');
    const result = await sendTextMessage(submitText);
    if (result?.success) {
        lastSubmittedOffset = liveTranscriptBuffer.length;
        // 不在这里设状态——AI 流式回复期间 Qwen session 自己会设 '就绪'
        return { success: true, submitted: true, text: submitText };
    }
    cheddar.setStatus('Error: ' + (result?.error || 'submit failed'));
    return { success: false, submitted: false, reason: 'send-failed' };
}

window.startQuickAudioCapture = startQuickAudioCapture;
window.submitLiveTranscriptDelta = submitLiveTranscriptDelta;

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
    setLiveTranscript: transcript => cheatingDaddyApp.setLiveTranscript(transcript),
    setLiveAsrRunning: running => cheatingDaddyApp.setLiveAsrRunning(running),

    // Core functionality
    initializeGemini,
    startCapture,
    stopCapture,
    sendTextMessage,
    submitLiveTranscriptDelta,
    clearLiveTranscript,
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
