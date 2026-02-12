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
const TARGET_SAMPLE_RATE = 16000; // Gemini supports 16kHz or 24kHz, 16kHz is safer for consistent processing
let initialized = false;

function setStatus(text) {
    try {
        if (window.cheddar?.setStatus) {
            window.cheddar.setStatus(text);
            return;
        }
        const app = document.querySelector('cheating-daddy-app');
        if (app && typeof app.setStatus === 'function') app.setStatus(text);
    } catch (e) {}
}

async function toggleRecording() {
    console.log('[WindowsAudioRecorder] Toggle recording triggered. Current state:', isRecording);
    if (isRecording) {
        await stopRecording();
    } else {
        await startRecording();
    }
}

async function startRecording() {
    try {
        setStatus('初始化麦克风...');
        console.log('[WindowsAudioRecorder] Starting Microphone Capture...');
        recordedChunks = [];

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: TARGET_SAMPLE_RATE,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
            video: false,
        });

        if (stream.getAudioTracks().length === 0) {
            console.error('[WindowsAudioRecorder] No audio track found in stream');
            setStatus('❌ 未找到麦克风');
            stream.getTracks().forEach(track => track.stop());
            return;
        }

        mediaStream = stream;

        const audioTrack = stream.getAudioTracks()[0];
        const audioStream = new MediaStream([audioTrack]);

        pcmRecorder = await createPcmRecorder({
            stream: audioStream,
            targetSampleRate: TARGET_SAMPLE_RATE,
            chunkDurationSec: 0.25,
            onChunk: msg => {
                if (!isRecording) return;
                recordedChunks.push(Buffer.from(msg.buffer));
            },
        });

        isRecording = true;

        const stopKey = 'Ctrl+K';
        setStatus(`🎙️ 录制麦克风... (${stopKey} 停止并发送)`);
        console.log('[WindowsAudioRecorder] Microphone Recording Started');

        stream.getAudioTracks()[0].onended = () => {
            console.log('[WindowsAudioRecorder] Microphone stream ended');
            stopRecording();
        };
    } catch (error) {
        console.error('[WindowsAudioRecorder] Failed to start recording:', error);
        setStatus('❌ 麦克风录制失败: ' + error.message);
        isRecording = false;
    }
}

async function stopRecording() {
    if (!isRecording) return;

    console.log('[WindowsAudioRecorder] Stopping Windows Audio Capture...');
    isRecording = false;
    setStatus('⏳ 处理音频中...');

    // 清理资源
    if (pcmRecorder) await pcmRecorder.stop().catch(() => {});
    pcmRecorder = null;
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    mediaStream = null;

    // 处理数据
    if (recordedChunks.length === 0) {
        console.warn('[WindowsAudioRecorder] No audio data recorded');
        setStatus('⚠️ 未录制到音频');
        return;
    }

    const fullBuffer = Buffer.concat(recordedChunks);

    // 1. 保存到文件 (先保存)
    const homeDir = os.homedir();
    const audioDir = path.join(homeDir, 'cheddar', 'data', 'audio');
    if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
    }

    const timestamp = Date.now();
    const wavPath = path.join(audioDir, `win_rec_${timestamp}.wav`);

    try {
        pcmToWav(fullBuffer, wavPath, TARGET_SAMPLE_RATE, 1, 16);
        console.log('[WindowsAudioRecorder] Saved recording to:', wavPath);
    } catch (e) {
        console.error('[WindowsAudioRecorder] Error saving wav:', e);
    }

    // 2. 发送给转录模型 (模拟 renderer.js 的行为)
    const base64Audio = fullBuffer.toString('base64');

    setStatus('🎙️ 转写麦克风音频中...');

    // 使用 save-audio-and-transcribe 替代 send-windows-audio-data
    // 这个 IPC handler 在 index.js 中，它负责保存文件并调用 STT (Speech-to-Text)
    // index.js 会自动将转录结果发送给 LLM，并更新状态为"完成"或"回答中"
    ipcRenderer.invoke('save-audio-and-transcribe', {
        pcmBase64: base64Audio,
        sampleRate: TARGET_SAMPLE_RATE // 16000
    }).then(result => {
        if (!result || !result.success) {
            console.error('[WindowsAudioRecorder] Transcription failed:', result?.error);
            // 转写失败，更新状态
            setStatus('❌ 转写失败');
        }
        // 转写成功时，不需要更新状态
        // index.js 中的 save-audio-and-transcribe 会处理：
        // 1. 发送文本给 LLM
        // 2. 更新状态为 "回答中..."
        // 3. LLM 响应完成后更新状态为 "完成"
        // 这里不需要额外操作，避免状态冲突
    }).catch(err => {
        console.error('[WindowsAudioRecorder] Error invoking save-audio-and-transcribe:', err);
        setStatus('❌ 错误');
    });

    recordedChunks = [];
}

module.exports = {
    initialize: () => {
        if (initialized) return;
        initialized = true;
        console.log('[WindowsAudioRecorder] Initializing...');
        ipcRenderer.removeAllListeners('toggle-windows-audio-capture');
        ipcRenderer.on('toggle-windows-audio-capture', () => {
            console.log('[WindowsAudioRecorder] Received toggle-windows-audio-capture event');
            toggleRecording();
        });
    }
};
