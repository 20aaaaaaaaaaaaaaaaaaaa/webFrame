import { Track, Clip } from '../types';

export const renderAudioToWav = async (
    tracks: Track[],
    totalDuration: number,
    sampleRate: number = 44100,
    cancelRef?: React.MutableRefObject<boolean>
): Promise<Uint8Array | null> => {
    console.log(`[AudioExport] Start: duration=${totalDuration}s, sampleRate=${sampleRate}`);

    // Check cancellation early
    if (cancelRef?.current) {
        console.log("[AudioExport] Cancelled before start");
        return null;
    }

    // Collect all audio-capable clips
    const audioClips: { clip: Clip; track: Track }[] = [];
    tracks.forEach(track => {
        if (!track.muted) {
            track.clips.forEach(clip => {
                if ((clip.type === 'video' || clip.type === 'audio') && (clip.volume ?? 1) > 0) {
                    audioClips.push({ clip, track });
                }
            });
        }
    });

    if (audioClips.length === 0) {
        console.log("[AudioExport] No audio clips found.");
        return null;
    }

    console.log(`[AudioExport] Found ${audioClips.length} audio-capable clips`);

    // Create OfflineAudioContext
    const OfflineContext = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!OfflineContext) {
        console.error("[AudioExport] OfflineAudioContext not supported");
        return null;
    }

    const totalSamples = Math.ceil(totalDuration * sampleRate);
    console.log(`[AudioExport] Creating context: ${totalSamples} samples`);
    const ctx = new OfflineContext(2, totalSamples, sampleRate);

    // Buffer cache for reusing decoded audio
    const bufferCache: Map<string, AudioBuffer> = new Map();

    // Fetch and decode audio from URL
    const getAudioBuffer = async (url: string): Promise<AudioBuffer | null> => {
        // Check cancellation
        if (cancelRef?.current) {
            console.log("[AudioExport] Cancelled during buffer fetch");
            return null;
        }

        if (bufferCache.has(url)) {
            return bufferCache.get(url)!;
        }

        try {
            console.log(`[AudioExport] Fetching: ${url.substring(0, 60)}...`);
            const response = await fetch(url);

            // Check cancellation after fetch
            if (cancelRef?.current) return null;

            if (!response.ok) {
                console.error(`[AudioExport] Fetch failed: ${response.status} ${response.statusText}`);
                return null;
            }

            const arrayBuffer = await response.arrayBuffer();

            // Check cancellation after arrayBuffer
            if (cancelRef?.current) return null;

            console.log(`[AudioExport] Fetched ${arrayBuffer.byteLength} bytes, decoding...`);

            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

            // Check cancellation after decode
            if (cancelRef?.current) return null;

            console.log(`[AudioExport] Decoded: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.numberOfChannels}ch`);

            bufferCache.set(url, audioBuffer);
            return audioBuffer;
        } catch (error) {
            console.error(`[AudioExport] Error loading audio from ${url}:`, error);
            return null;
        }
    };

    // Schedule all clips
    let scheduledCount = 0;
    for (const { clip } of audioClips) {
        // Check cancellation in loop
        if (cancelRef?.current) {
            console.log("[AudioExport] Cancelled during clip scheduling");
            return null;
        }

        try {
            const buffer = await getAudioBuffer(clip.src);
            if (!buffer) {
                console.warn(`[AudioExport] Skipping clip "${clip.name}" - no audio buffer`);
                continue;
            }

            // Create source and gain nodes
            const source = ctx.createBufferSource();
            source.buffer = buffer;

            const gainNode = ctx.createGain();
            const volume = clip.volume ?? 1;
            gainNode.gain.value = volume;

            // Apply volume keyframes if present
            if (clip.volumeKeyframes && clip.volumeKeyframes.length > 0) {
                const sortedKeyframes = [...clip.volumeKeyframes].sort((a, b) => a.time - b.time);
                gainNode.gain.setValueAtTime(sortedKeyframes[0].value, clip.start);

                for (let i = 1; i < sortedKeyframes.length; i++) {
                    const kf = sortedKeyframes[i];
                    const contextTime = clip.start + kf.time;
                    if (contextTime <= totalDuration) {
                        gainNode.gain.linearRampToValueAtTime(kf.value, contextTime);
                    }
                }
            }

            // Connect: source -> gain -> destination
            source.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Schedule playback
            const playOffset = Math.max(0, clip.offset);
            const playDuration = Math.min(clip.duration, buffer.duration - playOffset);

            if (playDuration > 0) {
                source.start(clip.start, playOffset, playDuration);
                scheduledCount++;
                console.log(`[AudioExport] Scheduled "${clip.name}": start=${clip.start.toFixed(2)}, offset=${playOffset.toFixed(2)}, duration=${playDuration.toFixed(2)}`);
            }
        } catch (error) {
            console.error(`[AudioExport] Error scheduling clip "${clip.name}":`, error);
        }
    }

    if (scheduledCount === 0) {
        console.log("[AudioExport] No clips were successfully scheduled");
        return null;
    }

    // Final cancellation check before rendering
    if (cancelRef?.current) {
        console.log("[AudioExport] Cancelled before rendering");
        return null;
    }

    // Render the audio
    console.log(`[AudioExport] Rendering ${scheduledCount} scheduled sources...`);
    const renderedBuffer = await ctx.startRendering();

    // Check after rendering
    if (cancelRef?.current) {
        console.log("[AudioExport] Cancelled after rendering");
        return null;
    }

    console.log(`[AudioExport] Rendered: ${renderedBuffer.length} samples, ${renderedBuffer.duration.toFixed(2)}s`);

    // Convert to WAV
    return audioBufferToWav(renderedBuffer);
};

/**
 * Convert an AudioBuffer to a WAV file as Uint8Array
 */
function audioBufferToWav(buffer: AudioBuffer): Uint8Array {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);

    // Helper to write string
    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    writeString(8, 'WAVE');

    // fmt subchunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data subchunk
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Write interleaved audio data
    let offset = headerSize;
    const channels: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
        channels.push(buffer.getChannelData(ch));
    }

    for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            let sample = channels[ch][i];
            sample = Math.max(-1, Math.min(1, sample));
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, intSample | 0, true);
            offset += 2;
        }
    }

    console.log(`[AudioExport] WAV generated: ${totalSize} bytes`);
    return new Uint8Array(arrayBuffer);
}
