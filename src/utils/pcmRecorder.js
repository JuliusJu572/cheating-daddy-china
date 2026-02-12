function getWorkletModuleSource() {
    return `
class PcmCaptureProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        const processorOptions = (options && options.processorOptions) || {};
        this.targetSampleRate = processorOptions.targetSampleRate || sampleRate;
        this.chunkFrames = processorOptions.chunkFrames || Math.max(1, Math.round(this.targetSampleRate * 0.25));
        this.sourceSampleRate = sampleRate;
        this.ratio = this.sourceSampleRate / this.targetSampleRate;
        this.sourcePos = 0;
        this.prevSample = 0;
        this.out = new Int16Array(this.chunkFrames);
        this.outIndex = 0;
        this.seq = 0;
        this.framesIn = 0;
        this.framesOut = 0;
        this.lastReportFrame = 0;
        this.reportEveryFrames = Math.max(1, Math.round(this.sourceSampleRate * 0.5));
    }
    process(inputs, outputs) {
        const output = outputs && outputs[0] && outputs[0][0];
        if (output) output.fill(0);
        const input = inputs && inputs[0];
        if (!input || input.length === 0) return true;
        const channels = input.length;
        const frames = input[0].length;
        if (frames === 0) return true;
        this.framesIn += frames;
        const mono = new Float32Array(frames);
        for (let i = 0; i < frames; i++) {
            let s = 0;
            for (let c = 0; c < channels; c++) {
                const ch = input[c];
                s += ch ? ch[i] : 0;
            }
            mono[i] = s / channels;
        }
        let pos = this.sourcePos;
        while (true) {
            const idx = pos | 0;
            if (idx >= frames) break;
            const frac = pos - idx;
            const s0 = idx >= 0 ? mono[idx] : this.prevSample;
            const s1 = idx + 1 < frames ? mono[idx + 1] : mono[frames - 1];
            const v = s0 + (s1 - s0) * frac;
            const clamped = v < -1 ? -1 : v > 1 ? 1 : v;
            this.out[this.outIndex++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
            this.framesOut++;
            if (this.outIndex === this.out.length) {
                const buf = this.out.buffer;
                this.port.postMessage({ type: 'chunk', seq: this.seq++, sampleRate: this.targetSampleRate, buffer: buf }, [buf]);
                this.out = new Int16Array(this.chunkFrames);
                this.outIndex = 0;
            }
            pos += this.ratio;
        }
        this.sourcePos = pos - frames;
        this.prevSample = mono[frames - 1];
        const cf = currentFrame | 0;
        if (cf - this.lastReportFrame >= this.reportEveryFrames) {
            this.lastReportFrame = cf;
            this.port.postMessage({
                type: 'stats',
                sourceSampleRate: this.sourceSampleRate,
                targetSampleRate: this.targetSampleRate,
                framesIn: this.framesIn,
                framesOut: this.framesOut,
            });
        }
        return true;
    }
}
registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
`;
}

async function createPcmRecorder({
    stream,
    targetSampleRate = 16000,
    chunkDurationSec = 0.25,
    onChunk,
    onStats,
    onEvent,
    monitorStallMs = 1500,
}) {
    if (!stream) throw new Error('Missing stream');
    const audioContext = new AudioContext();
    if (audioContext.state === 'suspended') await audioContext.resume();

    const sourceNode = audioContext.createMediaStreamSource(stream);
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0;

    let stopped = false;
    let lastChunkAt = Date.now();
    let workletNode = null;
    let processorType = 'worklet';
    let workletModuleLoaded = false;

    function handleChunkMessage(data) {
        lastChunkAt = Date.now();
        if (typeof onChunk === 'function' && data && data.buffer) onChunk(data);
    }

    function handleStatsMessage(data) {
        if (typeof onStats === 'function') onStats(data);
    }

    async function startWorklet() {
        if (!workletModuleLoaded) {
            const source = getWorkletModuleSource();
            const blobUrl = URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
            try {
                await audioContext.audioWorklet.addModule(blobUrl);
                workletModuleLoaded = true;
            } finally {
                URL.revokeObjectURL(blobUrl);
            }
        }

        const chunkFrames = Math.max(1, Math.round(targetSampleRate * chunkDurationSec));
        workletNode = new AudioWorkletNode(audioContext, 'pcm-capture-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1],
            processorOptions: { targetSampleRate, chunkFrames },
        });

        workletNode.port.onmessage = ev => {
            const msg = ev && ev.data;
            if (!msg || !msg.type) return;
            if (msg.type === 'chunk') handleChunkMessage(msg);
            if (msg.type === 'stats') handleStatsMessage(msg);
        };

        sourceNode.connect(workletNode);
        workletNode.connect(gainNode);
        gainNode.connect(audioContext.destination);
    }

    function startScriptProcessorFallback() {
        processorType = 'scriptProcessor';
        const bufferSize = 4096;
        const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
        let ratio = audioContext.sampleRate / targetSampleRate;
        let pos = 0;
        let prev = 0;
        const chunkFrames = Math.max(1, Math.round(targetSampleRate * chunkDurationSec));
        let out = new Int16Array(chunkFrames);
        let outIndex = 0;
        let seq = 0;
        let framesIn = 0;
        let framesOut = 0;
        let lastStatsAt = Date.now();

        processor.onaudioprocess = e => {
            const input = e.inputBuffer.getChannelData(0);
            const frames = input.length;
            if (!frames) return;
            framesIn += frames;
            while (true) {
                const idx = pos | 0;
                if (idx >= frames) break;
                const frac = pos - idx;
                const s0 = idx >= 0 ? input[idx] : prev;
                const s1 = idx + 1 < frames ? input[idx + 1] : input[frames - 1];
                const v = s0 + (s1 - s0) * frac;
                const clamped = v < -1 ? -1 : v > 1 ? 1 : v;
                out[outIndex++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
                framesOut++;
                if (outIndex === out.length) {
                    lastChunkAt = Date.now();
                    if (typeof onChunk === 'function') onChunk({ type: 'chunk', seq: seq++, sampleRate: targetSampleRate, buffer: out.buffer });
                    out = new Int16Array(chunkFrames);
                    outIndex = 0;
                }
                pos += ratio;
            }
            pos = pos - frames;
            prev = input[frames - 1];

            const now = Date.now();
            if (typeof onStats === 'function' && now - lastStatsAt >= 500) {
                lastStatsAt = now;
                onStats({ type: 'stats', sourceSampleRate: audioContext.sampleRate, targetSampleRate, framesIn, framesOut });
            }
        };

        sourceNode.connect(processor);
        processor.connect(gainNode);
        gainNode.connect(audioContext.destination);
        workletNode = processor;
    }

    try {
        if (!audioContext.audioWorklet || typeof AudioWorkletNode === 'undefined') {
            if (typeof onEvent === 'function') onEvent({ type: 'fallback', reason: 'worklet_unavailable' });
            startScriptProcessorFallback();
        } else {
            await startWorklet();
        }
    } catch (e) {
        if (typeof onEvent === 'function') onEvent({ type: 'fallback', reason: 'worklet_failed', error: String(e && e.message ? e.message : e) });
        startScriptProcessorFallback();
    }

    const stallTimer = setInterval(() => {
        if (stopped) return;
        if (Date.now() - lastChunkAt <= monitorStallMs) return;
        if (typeof onEvent === 'function') onEvent({ type: 'stall', processorType });
        try {
            if (workletNode) {
                if (workletNode.port && workletNode.port.close) workletNode.port.close();
                if (workletNode.disconnect) workletNode.disconnect();
            }
        } catch {}
        try {
            if (sourceNode && sourceNode.disconnect) sourceNode.disconnect();
        } catch {}
        try {
            if (gainNode && gainNode.disconnect) gainNode.disconnect();
        } catch {}
        lastChunkAt = Date.now();
        if (processorType === 'worklet' && audioContext.audioWorklet) {
            startWorklet().catch(() => {});
        } else {
            startScriptProcessorFallback();
        }
    }, 500);

    return {
        audioContext,
        sourceNode,
        get targetSampleRate() {
            return targetSampleRate;
        },
        stop: async () => {
            if (stopped) return;
            stopped = true;
            clearInterval(stallTimer);
            try {
                if (workletNode) {
                    if (workletNode.port && workletNode.port.close) workletNode.port.close();
                    if (workletNode.disconnect) workletNode.disconnect();
                }
            } catch {}
            try {
                if (sourceNode && sourceNode.disconnect) sourceNode.disconnect();
            } catch {}
            try {
                if (gainNode && gainNode.disconnect) gainNode.disconnect();
            } catch {}
            try {
                if (audioContext && audioContext.state !== 'closed') await audioContext.close();
            } catch {}
        },
    };
}

module.exports = { createPcmRecorder };

module.exports = { createPcmRecorder };
