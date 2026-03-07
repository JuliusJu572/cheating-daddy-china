const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pcmToWav } = require('../audioUtils');
const { createPcmRecorder } = require('./pcmRecorder');

let isRecording = false;
let mediaStream = null;
let pcmRecorder = null;
let recordedChunks = [];
let isMicMode = false;
const TARGET_SAMPLE_RATE = 16000;

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

async function toggleRecording(useMic = false) {
    console.log('[WindowsAudioRecorder] Toggle recording triggered. Current state:', isRecording, 'UseMic:', useMic);
    if (isRecording) {
        await stopRecording();
    } else {
        await startRecording(useMic);
    }
}

async function startRecording(useMic = false) {
    try {
        isMicMode = useMic;
        const sourceName = useMic ? '麦克风' : '系统音频';
        ipcRenderer.send('update-status', `初始化${sourceName}...`);
        console.log(`[WindowsAudioRecorder] Starting ${sourceName} Capture...`);
        recordedChunks = [];

        // Check API key first for real-time transcription
        const apiKey = (localStorage.getItem('apiKey') || '').trim();
        if (useMic && !apiKey) {
             ipcRenderer.send('update-status', '请先配置 API Key 以使用实时转录');
             return;
        }

        if (useMic) {
            // Start Real-time ASR session
            const startLiveRes = await ipcRenderer.invoke('start-live-asr', {
                apiKey,
                sampleRate: TARGET_SAMPLE_RATE,
            });
            if (!startLiveRes?.success) {
                ipcRenderer.send('update-status', '❌ 实时转录启动失败: ' + (startLiveRes?.error || 'Unknown error'));
                return;
            }
        }

        let stream;
        if (useMic) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1, // Mic usually mono
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: TARGET_SAMPLE_RATE
                    },
                    video: false
                });
            } catch (err) {
                console.error('[WindowsAudioRecorder] Microphone access failed:', err);
                ipcRenderer.send('update-status', '❌ 麦克风访问失败');
                if (useMic) await ipcRenderer.invoke('stop-live-asr').catch(() => {});
                return;
            }
        } else {
            try {
                stream = await navigator.mediaDevices.getDisplayMedia({
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
                console.error('[WindowsAudioRecorder] System audio access failed:', err);
                ipcRenderer.send('update-status', '❌ 系统音频获取失败');
                return;
            }
        }

        if (stream.getAudioTracks().length === 0) {
            console.error('[WindowsAudioRecorder] No audio track found in stream');
            ipcRenderer.send('update-status', useMic ? '❌ 未检测到麦克风音轨' : '⚠️ 未获取到系统音频（分享时请勾选“共享音频”）');
            stream.getTracks().forEach(track => track.stop());
            if (useMic) await ipcRenderer.invoke('stop-live-asr').catch(() => {});
            return;
        }

        mediaStream = stream;

        const audioTrack = stream.getAudioTracks()[0];
        const audioStream = new MediaStream([audioTrack]);

        pcmRecorder = await createPcmRecorder({
            stream: audioStream,
            targetSampleRate: TARGET_SAMPLE_RATE,
            chunkDurationSec: useMic ? 1.0 : 0.25, // Larger chunks for streaming might be better or same
            onChunk: msg => {
                if (!isRecording) return;
                const buffer = Buffer.from(msg.buffer);
                recordedChunks.push(buffer);
                
                // If using mic, push to live ASR
                if (isMicMode) {
                    const base64 = arrayBufferToBase64(msg.buffer);
                    ipcRenderer.invoke('push-live-audio-chunk', {
                        pcmBase64: base64,
                        sampleRate: TARGET_SAMPLE_RATE,
                    }).catch(() => {});
                }
            },
        });

        isRecording = true;
        
        // Notify UI state change if in Mic mode
        if (isMicMode && onStateChangeCallback) {
            onStateChangeCallback(true);
        }

        const stopKey = 'Ctrl+K';
        ipcRenderer.send('update-status', `🔴 实时识别中... (再按 ${stopKey} 停止并提交给AI)`);
        console.log(`[WindowsAudioRecorder] ${sourceName} Recording Started`);

        stream.getAudioTracks()[0].onended = () => {
            console.log(`[WindowsAudioRecorder] ${sourceName} stream ended`);
            stopRecording();
        };
    } catch (error) {
        console.error('[WindowsAudioRecorder] Failed to start recording:', error);
        ipcRenderer.send('update-status', '❌ 录制失败: ' + error.message);
        isRecording = false;
        if (useMic) await ipcRenderer.invoke('stop-live-asr').catch(() => {});
    }
}

async function stopRecording() {
    if (!isRecording) return;

    console.log('[WindowsAudioRecorder] Stopping Capture...');
    isRecording = false;

    // Notify UI state change if in Mic mode
    if (isMicMode && onStateChangeCallback) {
        onStateChangeCallback(false);
    }

    ipcRenderer.send('update-status', '⏳ 处理音频中...');

    // Clean up resources
    if (pcmRecorder) await pcmRecorder.stop().catch(() => {});
    pcmRecorder = null;
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    mediaStream = null;

    // Handle Data
    if (recordedChunks.length === 0) {
        console.warn('[WindowsAudioRecorder] No audio data recorded');
        ipcRenderer.send('update-status', '⚠️ 未录制到音频');
        if (isMicMode) await ipcRenderer.invoke('stop-live-asr').catch(() => {});
        return;
    }

    const fullBuffer = Buffer.concat(recordedChunks);

    // 1. Save to file (always good for debugging/history)
    const homeDir = os.homedir();
    const audioDir = path.join(homeDir, 'cheddar', 'data', 'audio');
    if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
    }

    const timestamp = Date.now();
    const prefix = isMicMode ? 'mic_rec_' : 'win_rec_';
    const wavPath = path.join(audioDir, `${prefix}${timestamp}.wav`);

    try {
        pcmToWav(fullBuffer, wavPath, TARGET_SAMPLE_RATE, 1, 16);
        console.log('[WindowsAudioRecorder] Saved recording to:', wavPath);
    } catch (e) {
        console.error('[WindowsAudioRecorder] Error saving wav:', e);
    }

    // 2. Transcribe
    if (isMicMode) {
        // Stop Real-time ASR
        ipcRenderer.send('update-status', '⏳ 正在提交转录结果...');
        const stopRes = await ipcRenderer.invoke('stop-live-asr');
        
        if (stopRes && stopRes.success) {
            const text = stopRes.text || '';
            console.log('[WindowsAudioRecorder] Live ASR Text:', text);
            
            if (text) {
                // Manually trigger the "send to AI" logic since we bypassed the save-audio-and-transcribe for ASR
                // But wait, save-audio-and-transcribe handles "send to AI" too.
                // However, we already have the text from live ASR!
                // We should reuse the existing flow or call a new IPC to "send text to AI"
                
                // Let's use the same flow as save-audio-and-transcribe but skip the STT part?
                // Actually, index.js save-audio-and-transcribe does BOTH STT and Sending.
                // Since we already did STT via live-asr, we just need to send it.
                // BUT, live-asr only gives us text. We need to feed it to the model.
                
                // Let's invoke a helper in index.js to send text to model
                // We can reuse 'save-audio-and-transcribe' but passing text directly? No, it expects audio.
                
                // We will create a new IPC or just reuse the logic.
                // Or better: We can just use the text we got and call the model.
                // In renderer.js, submitLiveTranscriptDelta calls nothing, it relies on user?
                // No, wait. In renderer.js:
                // submitLiveTranscriptDelta -> stopRealtimeAsrCapture -> stop-live-asr -> returns text
                // Then it calls geminiSessionRef.sendRealtimeInput({ text }) ?
                // Let's check renderer.js logic again.
                // renderer.js: submitLiveTranscriptDelta does NOT send to model automatically?
                // Ah, the user said "Ctrl+K ... 发送的处理逻辑".
                
                // Let's invoke 'save-audio-and-transcribe' with a flag or just send the audio anyway?
                // If we send audio, it will re-transcribe (wasteful).
                
                // Let's look at index.js 'save-audio-and-transcribe'.
                // It does: 1. save file (optional), 2. transcribe (if no text provided), 3. send to model.
                
                // We should modify 'save-audio-and-transcribe' to accept 'text' parameter to skip transcription.
                
                ipcRenderer.invoke('save-audio-and-transcribe', {
                    text: text, // Pass the text directly
                    path: wavPath, // Pass path for reference
                    skipTranscribe: true // Flag to skip STT
                }).catch(console.error);
                
            } else {
                ipcRenderer.send('update-status', '⚠️ 未识别到语音内容');
            }
        } else {
             ipcRenderer.send('update-status', '❌ 实时转录结束失败');
        }
    } else {
        // System Audio - Use existing non-realtime flow (or we could enable realtime for it too, but let's stick to original for now unless requested)
        // User asked for "Mic recording should have real-time transcription LIKE system audio"?
        // Wait, user said "Like system audio transcription function"?
        // Actually, previous system audio was NOT real-time. It was record -> stop -> transcribe.
        // User said: "麦克风录制功能也应该有实时转录哇 和系统声音转录功能一样的"
        // Maybe they meant "Like the real-time ASR feature in the app"?
        // Yes, likely referencing the 'Realtime' tab or functionality.
        
        // For system audio, we keep it as batch for now to avoid breaking it, 
        // unless we want to unify. Let's keep system audio as batch (safer) and mic as realtime (requested).
        
        const base64Audio = fullBuffer.toString('base64');
        ipcRenderer.send('update-status', '🔊 转写系统音频中...');
        
        ipcRenderer.invoke('save-audio-and-transcribe', {
            pcmBase64: base64Audio,
            sampleRate: TARGET_SAMPLE_RATE
        }).catch(err => {
            console.error('[WindowsAudioRecorder] Error invoking save-audio-and-transcribe:', err);
            ipcRenderer.send('update-status', '❌ 错误');
        });
    }

    recordedChunks = [];
}

module.exports = {
    initialize: (callbacks = {}) => {
        console.log('[WindowsAudioRecorder] Initializing...');
        
        // Listen for state changes
        const originalToggle = toggleRecording;
        // Override to intercept state changes if needed, but better to just export a way to set callback
        // Actually, let's just use a global variable or closure within this module scope
        if (callbacks.onStateChange) {
            onStateChangeCallback = callbacks.onStateChange;
        }

        ipcRenderer.on('toggle-windows-audio-capture', () => {
            console.log('[WindowsAudioRecorder] Received toggle-windows-audio-capture event');
            // Default to useMic = true as per user requirement for Ctrl+K
            toggleRecording(true);
        });
    }
};

let onStateChangeCallback = null;
