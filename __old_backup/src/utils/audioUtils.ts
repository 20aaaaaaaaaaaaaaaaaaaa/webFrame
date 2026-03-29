/**
 * Extract waveform data from a media URL (audio or video).
 * 
 * Strategy:
 * 1. Try fast offline decode (works for audio files and some video containers)
 * 2. Fallback: Use hidden <video> + captureStream + OfflineAudioContext
 * 
 * Sample count is AUTO-CALCULATED from audio duration:
 *   ~50 samples per second → consistent visual density regardless of clip length.
 */

const extractionCache = new Map<string, Promise<number[]>>();

// Target density: 50 waveform samples per second of audio (cap 8000)
const AUTO_SAMPLES_PER_SEC = 50;
const MAX_SAMPLES = 8000;
const MIN_SAMPLES = 150;

const calcSamples = (durationSec: number): number =>
    Math.max(MIN_SAMPLES, Math.min(MAX_SAMPLES, Math.ceil(durationSec * AUTO_SAMPLES_PER_SEC)));

// Fast offline approach — works for WAV, MP3, OGG, and some MP4s
const fastDecode = async (blobUrl: string): Promise<number[]> => {
    const response = await fetch(blobUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const samples = calcSamples(audioBuffer.duration);
        return processAudioBuffer(audioBuffer, samples);
    } finally {
        await audioContext.close().catch(() => {});
    }
};

// Fallback: play video in hidden element, capture audio via Web Audio API
const captureFromVideo = (blobUrl: string): Promise<number[]> => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.src = blobUrl;
        video.volume = 0;
        video.preload = 'auto';
        video.playsInline = true;

        let audioCtx: AudioContext | null = null;
        let source: MediaElementAudioSourceNode | null = null;
        let processor: ScriptProcessorNode | null = null;
        let gainNode: GainNode | null = null;
        const allSamples: number[] = [];
        let done = false;
        let videoDuration = 0;

        const timeout = setTimeout(() => finish(), 10000);

        const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(timeout);
            video.pause();
            if (processor) { try { processor.disconnect(); } catch (e) {} }
            if (source) { try { source.disconnect(); } catch (e) {} }
            if (gainNode) { try { gainNode.disconnect(); } catch (e) {} }
            if (audioCtx) { try { audioCtx.close(); } catch (e) {} }
            video.removeAttribute('src');
            video.load();

            if (allSamples.length === 0) {
                resolve([]);
                return;
            }

            // Resample to target count based on actual duration
            const targetSamples = calcSamples(videoDuration || allSamples.length / 20);
            const resampled = resample(allSamples, targetSamples);
            const max = Math.max(...resampled);
            resolve(resampled.map(v => v / (max || 1)));
        };

        video.addEventListener('loadedmetadata', () => {
            const duration = video.duration;
            if (!duration || !isFinite(duration) || duration <= 0) {
                finish();
                return;
            }

            videoDuration = duration;

            try {
                audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                source = audioCtx.createMediaElementSource(video);

                // Use ScriptProcessor to capture raw audio samples
                const bufferSize = 2048;
                processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);

                processor.onaudioprocess = (e) => {
                    const input = e.inputBuffer.getChannelData(0);
                    // Calculate RMS for this chunk
                    let sum = 0;
                    for (let i = 0; i < input.length; i++) {
                        sum += Math.abs(input[i]);
                    }
                    allSamples.push(sum / input.length);
                };

                // Connect: source → processor → gain(0) → destination
                gainNode = audioCtx.createGain();
                gainNode.gain.value = 0;
                source.connect(processor);
                processor.connect(gainNode);
                gainNode.connect(audioCtx.destination);

                // Play at max speed
                video.playbackRate = Math.min(16, Math.max(4, duration / 2));
                video.volume = 0;
                video.play().catch(() => finish());

                video.addEventListener('ended', finish);
            } catch (e) {
                finish();
            }
        });

        video.addEventListener('error', () => finish());
    });
};

// Process decoded AudioBuffer into normalized waveform array
const processAudioBuffer = (audioBuffer: AudioBuffer, samples: number): number[] => {
    const rawData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(rawData.length / samples);
    if (blockSize === 0) return [];

    const waveform: number[] = [];
    for (let i = 0; i < samples; i++) {
        const start = i * blockSize;
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[start + j]);
        }
        waveform.push(sum / blockSize);
    }

    const max = Math.max(...waveform);
    return waveform.map(v => v / (max || 1));
};

// Linear interpolation resample
const resample = (arr: number[], targetLen: number): number[] => {
    if (arr.length === 0) return new Array(targetLen).fill(0);
    if (arr.length === targetLen) return arr;

    const result: number[] = [];
    const ratio = (arr.length - 1) / (targetLen - 1);
    for (let i = 0; i < targetLen; i++) {
        const pos = i * ratio;
        const low = Math.floor(pos);
        const high = Math.min(Math.ceil(pos), arr.length - 1);
        const frac = pos - low;
        result.push(arr[low] * (1 - frac) + arr[high] * frac);
    }
    return result;
};

/**
 * Main entry — extract waveform with per-URL deduplication.
 * Sample count is auto-calculated from audio duration (~50 samples/sec).
 */
export const extractWaveform = async (blobUrl: string): Promise<number[]> => {
    const cached = extractionCache.get(blobUrl);
    if (cached) return cached;

    const promise = (async () => {
        // Try fast decode first
        try {
            const result = await fastDecode(blobUrl);
            if (result.length > 0) return result;
        } catch (e) {
            console.log("Fast decode failed, trying capture fallback...");
        }

        // Fallback: realtime capture from video element
        try {
            const result = await captureFromVideo(blobUrl);
            if (result.length > 0) return result;
        } catch (e) {
            console.error("Waveform capture failed:", e);
        }

        return [] as number[];
    })();

    extractionCache.set(blobUrl, promise);

    // Replace promise with resolved value to save memory
    promise.then(result => {
        extractionCache.set(blobUrl, Promise.resolve(result));
    });

    return promise;
};
