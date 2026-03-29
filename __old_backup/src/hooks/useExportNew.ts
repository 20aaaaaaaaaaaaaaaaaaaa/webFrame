import { useState, useCallback, useRef } from 'react';
import { useStore } from '../store/useStore';
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
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    const { tracks, canvasSize } = useStore();

    const renderFrameToCanvas = useCallback((
        canvas: HTMLCanvasElement,
        time: number,
        videoElements: Map<string, HTMLVideoElement>,
        imageElements: Map<string, HTMLImageElement>
    ) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Render tracks in reverse order (bottom to top)
        const tracksToRender = [...tracks].reverse();

        tracksToRender.forEach(track => {
            if (!track.visible) return;

            const clip = track.clips.find(
                c => time >= c.start && time < c.start + c.duration
            );

            if (clip && clip.type !== 'audio') {
                drawClip(ctx, clip, time, videoElements, imageElements);
            }
        });
    }, [tracks]);

    const drawClip = (
        ctx: CanvasRenderingContext2D,
        clip: Clip,
        time: number,
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
                    let drawW, drawH;
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
                let drawW, drawH;
                if (imgAspect > canvasAspect) {
                    drawW = canvasSize.width;
                    drawH = canvasSize.width / imgAspect;
                } else {
                    drawH = canvasSize.height;
                    drawW = canvasSize.height * imgAspect;
                }
                ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
            }
        }

        ctx.restore();
    };

    // Calculate total duration from tracks
    const getTotalDuration = useCallback((): number => {
        let maxEnd = 0;
        tracks.forEach(track => {
            track.clips.forEach(clip => {
                const end = clip.start + clip.duration;
                if (end > maxEnd) maxEnd = end;
            });
        });
        return maxEnd || 10; // Default 10s if no clips
    }, [tracks]);

    // Prepare video elements
    const prepareVideoElements = useCallback(async (): Promise<Map<string, HTMLVideoElement>> => {
        const videoMap = new Map<string, HTMLVideoElement>();
        const videoClips = tracks.flatMap(t => t.clips.filter(c => c.type === 'video'));

        for (const clip of videoClips) {
            const video = document.createElement('video');
            video.src = clip.src;
            video.muted = true;
            video.crossOrigin = 'anonymous';

            // Wait for video to be ready
            await new Promise<void>((resolve, reject) => {
                video.onloadeddata = () => resolve();
                video.onerror = () => reject(new Error(`Failed to load video: ${clip.src}`));
                video.load();
            });

            videoMap.set(clip.id, video);
        }

        return videoMap;
    }, [tracks]);

    // Prepare image elements
    const prepareImageElements = useCallback(async (): Promise<Map<string, HTMLImageElement>> => {
        const imageMap = new Map<string, HTMLImageElement>();
        const imageClips = tracks.flatMap(t => t.clips.filter(c => c.type === 'image'));

        for (const clip of imageClips) {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error(`Failed to load image: ${clip.src}`));
                img.src = clip.src;
            });

            imageMap.set(clip.id, img);
        }

        return imageMap;
    }, [tracks]);

    const exportToWebM = useCallback(async (settings: ExportSettings) => {
        try {
            setIsExporting(true);
            cancelledRef.current = false;
            setProgress(0);
            setStatusMessage('Preparing export...');

            // Calculate timeline duration
            const totalDuration = getTotalDuration();
            console.log('[Export] Total duration:', totalDuration);

            // Load all media
            setStatusMessage('Loading media...');
            const [videoElements, imageElements] = await Promise.all([
                prepareVideoElements(),
                prepareImageElements()
            ]);

            // Create offscreen canvas
            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(canvasSize.width * settings.scale);
            canvas.height = Math.floor(canvasSize.height * settings.scale);

            console.log('[Export] Canvas size:', canvas.width, 'x', canvas.height);

            // Get canvas stream
            const stream = canvas.captureStream(settings.fps);
            setStatusMessage('Starting recording...');

            // Configure MediaRecorder
            const mimeType = 'video/webm;codecs=vp9';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                throw new Error('WebM VP9 not supported. Try a different browser.');
            }

            const chunks: Blob[] = [];
            const recorder = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: settings.quality === 'high' ? 5000000 :
                    settings.quality === 'medium' ? 2500000 : 1000000
            });

            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            recorder.onerror = (e) => {
                console.error('[Export] Recorder error:', e);
                throw new Error('Recording failed');
            };

            // Start recording
            recorder.start(100); // Collect data every 100ms
            setStatusMessage('Rendering frames...');

            // Render frames
            const frameInterval = 1000 / settings.fps; // ms per frame
            const totalFrames = Math.ceil(totalDuration * settings.fps);
            let frameCount = 0;

            const renderLoop = async () => {
                if (cancelledRef.current) {
                    recorder.stop();
                    return;
                }

                const currentTime = frameCount / settings.fps;

                if (currentTime >= totalDuration) {
                    // Finished
                    recorder.stop();
                    return;
                }

                // Seek all videos to current time
                for (const [clipId, video] of videoElements) {
                    const clip = tracks.flatMap(t => t.clips).find(c => c.id === clipId);
                    if (clip && currentTime >= clip.start && currentTime < clip.start + clip.duration) {
                        const clipTime = (currentTime - clip.start) + (clip.trimStart || 0);
                        if (Math.abs(video.currentTime - clipTime) > 0.1) {
                            video.currentTime = clipTime;
                        }
                    }
                }

                // Wait for videos to seek
                await new Promise(resolve => setTimeout(resolve, 10));

                // Render frame
                renderFrameToCanvas(canvas, currentTime, videoElements, imageElements);

                // Update progress
                frameCount++;
                const progressPercent = Math.floor((frameCount / totalFrames) * 100);
                setProgress(progressPercent);
                setStatusMessage(`Rendering frame ${frameCount}/${totalFrames}...`);

                // Schedule next frame
                await new Promise(resolve => setTimeout(resolve, frameInterval));
                await renderLoop();
            };

            // Wait for rendering to complete
            await renderLoop();

            // Wait for recorder to finish
            await new Promise<void>((resolve) => {
                recorder.onstop = () => resolve();
            });

            if (cancelledRef.current) {
                setStatusMessage('Export cancelled');
                return null;
            }

            setStatusMessage('Finalizing video...');

            // Create final blob
            const videoBlob = new Blob(chunks, { type: mimeType });
            console.log('[Export] Video blob size:', videoBlob.size);

            // Save file
            if (settings.fileHandle) {
                const writable = await settings.fileHandle.createWritable();
                await writable.write(videoBlob);
                await writable.close();
            } else {
                // Fallback download
                const url = URL.createObjectURL(videoBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = settings.filename || 'video.webm';
                a.click();
                URL.revokeObjectURL(url);
            }

            setStatusMessage('Export complete!');
            setProgress(100);

            return videoBlob;

        } catch (error) {
            console.error('[Export] Error:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            setStatusMessage(`Export failed: ${errorMsg}`);
            throw error;
        } finally {
            setIsExporting(false);
            mediaRecorderRef.current = null;
        }
    }, [getTotalDuration, prepareVideoElements, prepareImageElements, renderFrameToCanvas, canvasSize, tracks]);

    const cancelExport = useCallback(() => {
        cancelledRef.current = true;
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsExporting(false);
        setStatusMessage('Export cancelled');
    }, []);

    return {
        isExporting,
        progress,
        statusMessage,
        exportToWebM,
        cancelExport
    };
};
