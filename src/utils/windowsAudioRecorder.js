const { ipcRenderer } = require('electron');

let initialized = false;

async function toggleRecording() {
    console.log('[WindowsAudioRecorder] Toggle recording triggered');
    
    if (typeof window !== 'undefined' && typeof window.startQuickAudioCapture === 'function') {
        console.log('[WindowsAudioRecorder] Delegating to startQuickAudioCapture({ useMic: true })');
        try {
            await window.startQuickAudioCapture({ useMic: true });
        } catch (e) {
            console.error('[WindowsAudioRecorder] Error invoking startQuickAudioCapture:', e);
        }
    } else {
        console.error('[WindowsAudioRecorder] window.startQuickAudioCapture is not available');
        // 尝试手动显示错误
        try {
            const app = document.querySelector('cheating-daddy-app');
            if (app && typeof app.setStatus === 'function') {
                app.setStatus('❌ 内部错误: 音频模块未连接');
            }
        } catch (_) {}
    }
}

module.exports = {
    initialize: () => {
        if (initialized) return;
        initialized = true;
        console.log('[WindowsAudioRecorder] Initializing (Real-time Mode)...');
        
        ipcRenderer.removeAllListeners('toggle-windows-audio-capture');
        ipcRenderer.on('toggle-windows-audio-capture', () => {
            console.log('[WindowsAudioRecorder] Received toggle-windows-audio-capture event');
            toggleRecording();
        });
    }
};
