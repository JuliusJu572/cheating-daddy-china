// renderer.js
const { ipcRenderer } = require('electron');

// Initialize random display name for UI components
window.randomDisplayName = null;

// Request random display name from main process
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
let currentImageQuality = 'medium'; // Store current image quality for manual screenshots

let isQuickRecording = false;
let quickRecordStream = null;
let quickRecordContext = null;
let quickRecordProcessor = null;
let quickRecordBuffer = [];
let quickRecordStartTime = null;

const isLinux = process.platform === 'linux';
const isMacOS = process.platform === 'darwin';

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
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function initializeGemini(profile = 'interview', language = 'zh-CN') {
    const selectedModel = localStorage.getItem('selectedModel') || 'aihubmix:qwen3-vl-30b-a3b-instruct';
    
    console.log('🚀 [renderer] initializeGemini 开始...');
    console.log('🚀 [renderer] 读取 localStorage...');
    
    const apiKey = (localStorage.getItem('apiKey') || '').trim();
    const apiBase = (localStorage.getItem('modelApiBase') || '').trim();
    
    console.log('🚀 [renderer] Model:', selectedModel);
    console.log('🚀 [renderer] API Base:', apiBase);
    
    if (apiKey) {
        console.log('🚀 [renderer] 调用 initialize-model...');
        const success = await ipcRenderer.invoke('initialize-model', {
            model: selectedModel,
            apiKey,
            apiBase,
            customPrompt: localStorage.getItem('customPrompt') || '',
            profile,
            language,
        });
        
        console.log('🚀 [renderer] initialize-model 结果:', success);
        
        if (success) {
            cheddar.setStatus('Live');
        } else {
            cheddar.setStatus('error');
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
    const selectedModel = (localStorage.getItem('selectedModel') || 'aihubmix:qwen3-vl-30b-a3b-instruct');
    const disableAudio = localStorage.getItem('disableAudio') === 'true' || selectedModel.startsWith('aihubmix:');

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
                    setupLinuxMicProcessing(micStream);
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
                              sampleRate: SAMPLE_RATE,
                              channelCount: 1,
                              echoCancellation: false, // Don't cancel system audio
                              noiseSuppression: false,
                              autoGainControl: false,
                          },
                });

                console.log('Linux system audio capture via getDisplayMedia succeeded');

                // Setup audio processing for Linux system audio
                if (!disableAudio) {
                    setupLinuxSystemAudioProcessing();
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
                    setupLinuxMicProcessing(micStream);
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
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: false,  // ✅ 改为 false
                        noiseSuppression: false,  // ✅ 改为 false
                        autoGainControl: false,   // ✅ 改为 false
                    },
            });

            console.log('Windows capture started with loopback audio');

            // Setup audio processing for Windows loopback audio only
            if (!disableAudio) {
                setupWindowsLoopbackProcessing();
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
                    setupLinuxMicProcessing(micStream);
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
        cheddar.setStatus('error');
    }
}

function setupLinuxMicProcessing(micStream) {
    // Setup microphone audio processing for Linux
    const micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const micSource = micAudioContext.createMediaStreamSource(micStream);
    const micProcessor = micAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    micProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-mic-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    micSource.connect(micProcessor);
    micProcessor.connect(micAudioContext.destination);

    // Store processor reference for cleanup
    micAudioProcessor = micProcessor;
}

function setupLinuxSystemAudioProcessing() {
    // Setup system audio processing for Linux (from getDisplayMedia)
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioContext.createMediaStreamSource(mediaStream);
    audioProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    audioProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);
}

function setupWindowsLoopbackProcessing() {
    // Setup audio processing for Windows loopback audio only
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioContext.createMediaStreamSource(mediaStream);
    audioProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    audioProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);
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
        offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = hiddenVideo.videoWidth;
        offscreenCanvas.height = hiddenVideo.videoHeight;
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
        console.error('❌ Cannot take screenshot - mediaStream not initialized. Start capture first!');
        cheddar.setStatus('Error: Please start session first');
        return;
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
            cheddar.setStatus('Processing...');
            
            // 停止录音
            if (quickRecordProcessor) {
                quickRecordProcessor.disconnect();
            }
            if (quickRecordContext) {
                await quickRecordContext.close();
            }
            if (quickRecordStream) {
                quickRecordStream.getTracks().forEach(track => track.stop());
            }
            // 处理录音数据
            if (quickRecordBuffer.length > 0) {
                const pcm = convertFloat32ToInt16(quickRecordBuffer);
                const base64 = arrayBufferToBase64(pcm.buffer);
                cheddar.setStatus('Transcribing...');

                console.log('📊 Audio buffer size:', quickRecordBuffer.length, 'samples');
                console.log('📊 PCM size:', pcm.length, 'bytes');
                
                const result = await ipcRenderer.invoke('save-audio-and-transcribe', { 
                    pcmBase64: base64, 
                    sampleRate: 16000 
                });
                if (!result || !result.success) {
                    cheddar.setStatus('Error: ' + (result?.error || 'Unknown'));
                }
            } else {
                cheddar.setStatus('No audio recorded');
            }
            
            // 重置状态
            isQuickRecording = false;
            quickRecordStream = null;
            quickRecordContext = null;
            quickRecordProcessor = null;
            quickRecordBuffer = [];
            quickRecordStartTime = null;
            
        } catch (error) {
            console.error('Error stopping audio capture:', error);
            cheddar.setStatus('Error: ' + error.message);
            isQuickRecording = false;
        }
        return;
    }
    
    // 开始新的录音
    try {
        let streamToUse = null;
        
        // ✅ 所有平台：尝试使用已有的 mediaStream（如果有音频轨道）
        if (mediaStream && mediaStream.getAudioTracks().length > 0) {
            console.log('📻 Using existing mediaStream for recording');
            streamToUse = mediaStream;
        } else {
            // ✅ 没有音频轨道，需要请求新的屏幕共享（包含音频）
            console.log('🎬 Requesting new screen share with audio...');
            try {
                quickRecordStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: 1,
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: {
                        sampleRate: 16000,
                        channelCount: 1,
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                    },
                });
                
                // ✅ 检查是否获取到音频轨道
                if (quickRecordStream.getAudioTracks().length === 0) {
                    console.error('❌ No audio track in stream - user may not have checked "Share audio"');
                    cheddar.setStatus('Error: Please check "Share audio" when prompted');
                    quickRecordStream.getTracks().forEach(track => track.stop());
                    quickRecordStream = null;
                    return;
                }
                
                streamToUse = quickRecordStream;
                console.log('✅ Screen share with audio granted');
            } catch (getErr) {
                console.error('❌ Failed to get screen share with audio:', getErr);
                
                // ✅ macOS：特别提示用户需要勾选音频
                if (isMacOS) {
                    cheddar.setStatus('Error: Screen recording requires "Share audio" checkbox');
                } else {
                    cheddar.setStatus('Error: Screen audio capture unavailable');
                }
                return;
            }
        }

        if (!streamToUse) {
            cheddar.setStatus('Error: No audio stream available');
            return;
        }

        const stopKey = process.platform === 'darwin' ? 'Cmd+L' : 'Ctrl+L';
        cheddar.setStatus(`Recording system audio... Press ${stopKey} to stop`);

        quickRecordContext = new AudioContext({ sampleRate: 16000 });
        const source = quickRecordContext.createMediaStreamSource(streamToUse);
        quickRecordProcessor = quickRecordContext.createScriptProcessor(8192, 1, 1);
        quickRecordBuffer = [];
        quickRecordStartTime = Date.now();
        isQuickRecording = true;
        
        quickRecordProcessor.onaudioprocess = e => {
            if (isQuickRecording) {
                const input = e.inputBuffer.getChannelData(0);
                quickRecordBuffer.push(...input);
                
                // 更新状态显示录音时长
                const elapsed = Math.floor((Date.now() - quickRecordStartTime) / 1000);
                const stopKey2 = process.platform === 'darwin' ? 'Cmd+L' : 'Ctrl+L';
                cheddar.setStatus(`Recording system audio... ${elapsed}s (Press ${stopKey2} to stop)`);
            }
        };
        
        source.connect(quickRecordProcessor);
        quickRecordProcessor.connect(quickRecordContext.destination);
        
    } catch (error) {
        console.error('System audio capture error:', error);
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

    if (audioProcessor) {
        audioProcessor.disconnect();
        audioProcessor = null;
    }

    // Clean up microphone audio processor (Linux only)
    if (micAudioProcessor) {
        micAudioProcessor.disconnect();
        micAudioProcessor = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
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
initConversationStorage().catch(console.error);

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
