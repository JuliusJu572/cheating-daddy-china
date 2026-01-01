const { ipcRenderer, desktopCapturer } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pcmToWav } = require('../audioUtils');

let isRecording = false;
let audioContext = null;
let mediaStream = null;
let processor = null;
let sourceNode = null;
let recordedChunks = [];
const TARGET_SAMPLE_RATE = 16000; // Gemini supports 16kHz or 24kHz, 16kHz is safer for consistent processing

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
        // 立即给用户反馈
        ipcRenderer.send('update-status', 'Initializing Microphone...');
        console.log('[WindowsAudioRecorder] Starting Microphone Capture...');
        recordedChunks = [];

        // 使用 getUserMedia 获取麦克风音频
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: TARGET_SAMPLE_RATE,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });

        // 检查是否有音频轨道
        if (stream.getAudioTracks().length === 0) {
            console.error('[WindowsAudioRecorder] No audio track found in stream');
            ipcRenderer.send('update-status', '❌ No Microphone Found');
            stream.getTracks().forEach(track => track.stop());
            return;
        }

        mediaStream = stream;
        
        // 设置 AudioContext
        audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
        const audioTrack = stream.getAudioTracks()[0];
        const audioStream = new MediaStream([audioTrack]);
        
        sourceNode = audioContext.createMediaStreamSource(audioStream);
        
        // 创建 ScriptProcessor
        // 16kHz sample rate, buffer size 4096 => ~256ms latency
        // buffer size 8192 => ~512ms latency
        // renderer.js uses 8192 for 16kHz, sticking to 4096 for lower latency if possible, or align with renderer
        // Let's use 8192 to match renderer.js stability
        processor = audioContext.createScriptProcessor(8192, 1, 1);
        
        sourceNode.connect(processor);
        processor.connect(audioContext.destination); // 必须连接到 destination 才能运行

        processor.onaudioprocess = (e) => {
            if (!isRecording) return;
            
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmData = new Int16Array(inputData.length);
            
            for (let i = 0; i < inputData.length; i++) {
                // Float32 转 Int16
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            recordedChunks.push(Buffer.from(pcmData.buffer));
        };

        isRecording = true;
        
        // 通知 UI 更新状态
        ipcRenderer.send('update-status', '🎙️ Recording Microphone...');
        console.log('[WindowsAudioRecorder] Microphone Recording Started');

        // 监听流结束事件
        stream.getAudioTracks()[0].onended = () => {
            console.log('[WindowsAudioRecorder] Microphone stream ended');
            stopRecording();
        };

    } catch (error) {
        console.error('[WindowsAudioRecorder] Failed to start recording:', error);
        ipcRenderer.send('update-status', '❌ Mic Capture Failed: ' + error.message);
        isRecording = false;
    }
}

async function stopRecording() {
    if (!isRecording) return;
    
    console.log('[WindowsAudioRecorder] Stopping Windows Audio Capture...');
    isRecording = false;
    ipcRenderer.send('update-status', '⏳ Processing Audio...');

    // 清理资源
    if (processor) {
        processor.disconnect();
        processor.onaudioprocess = null;
    }
    if (sourceNode) {
        sourceNode.disconnect();
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext) {
        await audioContext.close();
    }

    // 处理数据
    if (recordedChunks.length === 0) {
        console.warn('[WindowsAudioRecorder] No audio data recorded');
        ipcRenderer.send('update-status', '⚠️ No Audio Recorded');
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
    
    ipcRenderer.send('update-status', 'Transcribing...');

    // 使用 save-audio-and-transcribe 替代 send-windows-audio-data
    // 这个 IPC handler 在 index.js 中，它负责保存文件并调用 STT (Speech-to-Text)
    ipcRenderer.invoke('save-audio-and-transcribe', {
        pcmBase64: base64Audio,
        sampleRate: TARGET_SAMPLE_RATE // 16000
    }).then(result => {
        if (!result || !result.success) {
            console.error('[WindowsAudioRecorder] Transcription failed:', result?.error);
            ipcRenderer.send('update-status', '❌ Transcribe Failed');
        } else {
            // 转录成功，index.js 会处理后续逻辑（比如发送文本给 LLM）
            // 或者它只是返回文本，我们需要在这里发送？
            // 让我们检查一下 renderer.js 是怎么做的。
            // renderer.js 调用 invoke 后好像没有处理返回值发送给 LLM？
            // 等等，index.js 的 save-audio-and-transcribe 实现里并没有调用 LLM。
            // 它是调用了 Whisper 还是什么？
            // 让我们再确认一下 index.js 的 save-audio-and-transcribe。
        }
    }).catch(err => {
        console.error('[WindowsAudioRecorder] Error invoking save-audio-and-transcribe:', err);
        ipcRenderer.send('update-status', '❌ Error');
    });

    recordedChunks = [];
}

module.exports = {
    initialize: () => {
        console.log('[WindowsAudioRecorder] Initializing...');
        ipcRenderer.on('toggle-windows-audio-capture', () => {
            console.log('[WindowsAudioRecorder] Received toggle-windows-audio-capture event');
            toggleRecording();
        });
    }
};
