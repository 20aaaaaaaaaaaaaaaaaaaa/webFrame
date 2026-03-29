import { useState, useCallback, useRef } from 'react';
import { useStore } from '../store/useStore';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Clip } from '../types';
import { renderAudioToWav } from '../utils/audioExportUtils';

export interface ExportSettings {
    fps: number;
    scale: number;
    quality: 'high' | 'medium' | 'low';
    filename: string;
    fileHandle: FileSystemFileHandle | null;
    audioBitrate: number;
    audioSampleRate: number;
    audioEnabled: boolean;
}

export const useExport = () => {
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const cancelledRef = useRef(false);
    const ffmpegRef = useRef<FFmpeg | null>(null);
    const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

    const { tracks, canvasSize } = useStore();

    // ─── Load FFmpeg ──────────────────────────────────────────
    const loadFFmpeg = useCallback(async () => {
        if (ffmpegLoaded && ffmpegRef.current) return ffmpegRef.current;

        try {
            setStatusMessage('FFmpeg yükleniyor...');
            const ffmpeg = new FFmpeg();

            ffmpeg.on('log', ({ message }) => {
                console.log('[FFmpeg]', message);
            });

            ffmpeg.on('progress', ({ progress: p }) => {
                if (p > 0 && p < 1) {
                    // Map FFmpeg encoding progress to 70-95%
                    setProgress(70 + Math.floor(p * 25));
                }
            });

            const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
            console.log('[Export] Loading FFmpeg from', baseURL);

            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });

            ffmpegRef.current = ffmpeg;
            setFfmpegLoaded(true);
            setStatusMessage('FFmpeg hazır');
            console.log('[Export] FFmpeg initialized successfully');
            return ffmpeg;
        } catch (error) {
            console.error('FFmpeg loading failed:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            throw new Error(`FFmpeg yüklenemedi: ${errorMsg}. Chrome veya Edge kullanın.`);
        }
    }, [ffmpegLoaded]);

    // ─── Render a single frame onto a canvas ──────────────────
    const renderFrameToCanvas = useCallback((
        canvas: HTMLCanvasElement,
        time: number,
        videoElements: Map<string, HTMLVideoElement>,
        imageElements: Map<string, HTMLImageElement>
    ) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Render tracks in reverse order (bottom to top)
        const tracksToRender = [...tracks].reverse();

        tracksToRender.forEach(track => {
            if (!track.visible) return;

            // Find active clip at this time
            const clip = track.clips.find(
                c => time >= c.start && time < c.start + c.duration
            );

            if (clip && clip.type !== 'audio') {
                drawClip(ctx, clip, time, videoElements, imageElements);
            }
        });
    }, [tracks, canvasSize]);

    // ─── Draw a single clip ───────────────────────────────────
    const drawClip = (
        ctx: CanvasRenderingContext2D,
        clip: Clip,
        _time: number,
        videoElements: Map<string, HTMLVideoElement>,
        imageElements: Map<string, HTMLImageElement>
    ) => {
        ctx.save();
        const { position = { x: 0, y: 0 }, scale = 1, rotation = 0, opacity = 1 } = clip;

        const cx = (canvasSize.width / 2) + position.x;
        const cy = (canvasSize.height / 2) + position.y;

        ctx.translate(cx, cy);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scale, scale);
        ctx.globalAlpha = opacity;

        if (clip.type === 'video') {
            const video = videoElements.get(clip.id);
            if (video && video.readyState >= 2) {
                const vidW = video.videoWidth;
                const vidH = video.videoHeight;
                if (vidW && vidH) {
                    const vidAspect = vidW / vidH;
                    const canvasAspect = canvasSize.width / canvasSize.height;
                    let drawW: number, drawH: number;
                    if (vidAspect > canvasAspect) {
                        drawW = canvasSize.width;
                        drawH = canvasSize.width / vidAspect;
                    } else {
                        drawH = canvasSize.height;
                        drawW = canvasSize.height * vidAspect;
                    }
                    ctx.drawImage(video, 0, 0, vidW, vidH, -drawW / 2, -drawH / 2, drawW, drawH);
                }
            }
        } else if (clip.type === 'image') {
            const img = imageElements.get(clip.id);
            if (img && img.complete && img.naturalWidth) {
                const imgW = img.naturalWidth;
                const imgH = img.naturalHeight;
                const imgAspect = imgW / imgH;
                const canvasAspect = canvasSize.width / canvasSize.height;
                let drawW: number, drawH: number;
                if (imgAspect > canvasAspect) {
                    drawW = canvasSize.width;
                    drawH = canvasSize.width / imgAspect;
                } else {
                    drawH = canvasSize.height;
                    drawW = canvasSize.height * imgAspect;
                }
                ctx.drawImage(img, 0, 0, imgW, imgH, -drawW / 2, -drawH / 2, drawW, drawH);
            }
        } else if (clip.type === 'text') {
            ctx.fillStyle = 'white';
            ctx.font = 'bold 48px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(clip.name, 0, 0);
        }
        ctx.restore();
    };

    // ─── Seek a video element and WAIT for it to be ready ─────
    const seekVideoAndWait = (video: HTMLVideoElement, targetTime: number): Promise<void> => {
        return new Promise((resolve) => {
            // If already close enough, skip seeking
            if (Math.abs(video.currentTime - targetTime) < 0.01) {
                resolve();
                return;
            }

            const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                resolve();
            };

            video.addEventListener('seeked', onSeeked);
            video.currentTime = targetTime;

            // Safety timeout: if seeked never fires, after 500ms continue anyway
            setTimeout(() => {
                video.removeEventListener('seeked', onSeeked);
                resolve();
            }, 500);
        });
    };

    // ─── Main Export Function ─────────────────────────────────
    const exportVideo = useCallback(async (settings: ExportSettings) => {
        setIsExporting(true);
        setProgress(0);
        setStatusMessage('Başlatılıyor...');
        cancelledRef.current = false;

        try {
            // 1. Load FFmpeg
            const ffmpeg = await loadFFmpeg();
            if (!ffmpeg) throw new Error('FFmpeg yüklenemedi');
            if (cancelledRef.current) throw new Error('Export iptal edildi');

            // 2. Calculate export parameters
            const duration = Math.max(
                ...tracks.flatMap(t => t.clips.map(c => c.start + c.duration)),
                1
            );

            const fps = settings.fps;
            const totalFrames = Math.ceil(duration * fps);
            const outputWidth = Math.floor(canvasSize.width * settings.scale);
            const outputHeight = Math.floor(canvasSize.height * settings.scale);

            console.log(`[Export] Duration: ${duration}s, Frames: ${totalFrames}, Size: ${outputWidth}x${outputHeight}`);
            setStatusMessage(`${totalFrames} frame hazırlanıyor...`);

            // 3. Create offscreen canvas
            const canvas = document.createElement('canvas');
            canvas.width = outputWidth;
            canvas.height = outputHeight;

            // 4. Load all media elements
            const videoElements = new Map<string, HTMLVideoElement>();
            const imageElements = new Map<string, HTMLImageElement>();

            setStatusMessage('Medya dosyaları yükleniyor...');
            setProgress(5);

            for (const track of tracks) {
                for (const clip of track.clips) {
                    if (cancelledRef.current) throw new Error('Export iptal edildi');

                    if (clip.type === 'video') {
                        if (!videoElements.has(clip.id)) {
                            const video = document.createElement('video');
                            video.src = clip.src;
                            video.muted = true;
                            video.preload = 'auto';
                            await new Promise<void>((resolve, reject) => {
                                video.onloadeddata = () => resolve();
                                video.onerror = () => reject(new Error(`Video yüklenemedi: ${clip.name}`));
                                video.load();
                            });
                            videoElements.set(clip.id, video);
                        }
                    } else if (clip.type === 'image') {
                        if (!imageElements.has(clip.id)) {
                            const img = new Image();
                            img.crossOrigin = 'anonymous';
                            await new Promise<void>((resolve, reject) => {
                                img.onload = () => resolve();
                                img.onerror = () => reject(new Error(`Resim yüklenemedi: ${clip.name}`));
                                img.src = clip.src;
                            });
                            imageElements.set(clip.id, img);
                        }
                    }
                }
            }

            if (cancelledRef.current) throw new Error('Export iptal edildi');
            setStatusMessage('Frame\'ler render ediliyor...');
            setProgress(10);

            // 5. Render frames one by one
            for (let frameNum = 0; frameNum < totalFrames; frameNum++) {
                if (cancelledRef.current) throw new Error('Export iptal edildi');

                const time = frameNum / fps;

                // Seek all active video elements to the correct time
                for (const track of tracks) {
                    for (const clip of track.clips) {
                        if (clip.type === 'video' && time >= clip.start && time < clip.start + clip.duration) {
                            const video = videoElements.get(clip.id);
                            if (video) {
                                const clipTime = time - clip.start + clip.offset;
                                await seekVideoAndWait(video, clipTime);
                            }
                        }
                    }
                }

                // Render the frame
                renderFrameToCanvas(canvas, time, videoElements, imageElements);

                // Convert to PNG blob and write to FFmpeg
                const blob = await new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob(
                        b => b ? resolve(b) : reject(new Error('Canvas blob oluşturulamadı')),
                        'image/png'
                    );
                });

                const frameData = await fetchFile(blob);
                const filename = `frame${frameNum.toString().padStart(6, '0')}.png`;
                await ffmpeg.writeFile(filename, frameData);

                // Update progress (10% to 60% for frame rendering)
                const renderProgress = 10 + Math.floor((frameNum / totalFrames) * 50);
                setProgress(renderProgress);

                // Update status every 10 frames to avoid too many re-renders
                if (frameNum % 10 === 0) {
                    setStatusMessage(`Frame ${frameNum + 1}/${totalFrames} render ediliyor...`);
                }
            }

            if (cancelledRef.current) throw new Error('Export iptal edildi');

            // 6. Process audio
            let hasAudio = false;
            if (settings.audioEnabled) {
                setStatusMessage('Ses karıştırılıyor...');
                setProgress(62);

                const audioData = await renderAudioToWav(
                    tracks,
                    duration,
                    settings.audioSampleRate,
                    cancelledRef
                );

                if (cancelledRef.current) throw new Error('Export iptal edildi');

                if (audioData) {
                    await ffmpeg.writeFile('audio.wav', audioData);
                    hasAudio = true;
                    console.log('[Export] Audio rendered successfully');
                } else {
                    console.log('[Export] No audio tracks found');
                }
            }

            // 7. Encode with FFmpeg
            setStatusMessage('Video kodlanıyor (FFmpeg)...');
            setProgress(65);

            const qualityMap = { high: '18', medium: '23', low: '28' };
            const crf = qualityMap[settings.quality];

            // Build FFmpeg args — use sequential frame input (not glob)
            const ffmpegArgs = [
                '-framerate', fps.toString(),
                '-i', 'frame%06d.png',
            ];

            if (hasAudio) {
                ffmpegArgs.push('-i', 'audio.wav');
            }

            ffmpegArgs.push(
                '-c:v', 'libx264',
                '-crf', crf,
                '-pix_fmt', 'yuv420p',
                '-preset', 'fast',
            );

            if (hasAudio) {
                ffmpegArgs.push(
                    '-c:a', 'aac',
                    '-b:a', `${settings.audioBitrate}k`,
                    '-ar', settings.audioSampleRate.toString(),
                    '-shortest',
                );
            }

            ffmpegArgs.push('-y', 'output.mp4');

            console.log('[Export] FFmpeg command:', ffmpegArgs.join(' '));
            await ffmpeg.exec(ffmpegArgs);

            if (cancelledRef.current) throw new Error('Export iptal edildi');

            // 8. Read and save output
            setStatusMessage('Dosya kaydediliyor...');
            setProgress(96);

            const data = await ffmpeg.readFile('output.mp4');
            const videoBlob = new Blob([new Uint8Array(data as Uint8Array)], { type: 'video/mp4' });

            if (settings.fileHandle) {
                const writable = await settings.fileHandle.createWritable();
                await writable.write(videoBlob);
                await writable.close();
            } else {
                // Fallback: automatic download
                const url = URL.createObjectURL(videoBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = settings.filename.replace(/\.webm$/i, '.mp4');
                a.click();
                URL.revokeObjectURL(url);
            }

            // 9. Cleanup FFmpeg files
            for (let i = 0; i < totalFrames; i++) {
                try { await ffmpeg.deleteFile(`frame${i.toString().padStart(6, '0')}.png`); } catch {}
            }
            try { await ffmpeg.deleteFile('output.mp4'); } catch {}
            if (hasAudio) { try { await ffmpeg.deleteFile('audio.wav'); } catch {} }

            // Cleanup video elements
            videoElements.forEach(v => { v.pause(); v.src = ''; });

            setProgress(100);
            setStatusMessage('Export tamamlandı! ✅');

        } catch (error) {
            console.error('Export failed:', error);
            const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
            setStatusMessage(`Export başarısız: ${message}`);
            if (!cancelledRef.current) {
                alert('❌ Export başarısız: ' + message);
            }
        } finally {
            setIsExporting(false);
            setTimeout(() => {
                setProgress(0);
                setStatusMessage('');
            }, 4000);
        }
    }, [tracks, canvasSize, loadFFmpeg, renderFrameToCanvas]);

    const cancelExport = useCallback(() => {
        cancelledRef.current = true;
        setIsExporting(false);
        setProgress(0);
        setStatusMessage('Export iptal edildi');
    }, []);

    return {
        exportVideo,
        isExporting,
        progress,
        statusMessage,
        cancelExport,
        ffmpegLoaded
    };
};
