import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { Clip } from '../types';

export const useCanvasRender = (canvasRef: React.RefObject<HTMLCanvasElement>) => {
    const videoElementsRef = useRef<Record<string, HTMLVideoElement>>({});
    const imageElementsRef = useRef<Record<string, HTMLImageElement>>({});
    const animFrameRef = useRef<number>(0);
    const lastFrameTimeRef = useRef(performance.now());
    const lastSeekTimeRef = useRef<Record<string, number>>({});
    const activeClipIdsRef = useRef<Set<string>>(new Set());
    const hiddenContainerRef = useRef<HTMLDivElement | null>(null);

    // Use refs to read latest state without re-triggering useEffect
    const stateRef = useRef({
        tracks: useStore.getState().tracks,
        currentTime: useStore.getState().currentTime,
        isPlaying: useStore.getState().isPlaying,
        playbackSpeed: useStore.getState().playbackSpeed,
        canvasSize: useStore.getState().canvasSize,
    });

    // Subscribe to store changes via ref (no re-render)
    useEffect(() => {
        const unsub = useStore.subscribe((state) => {
            stateRef.current = {
                tracks: state.tracks,
                currentTime: state.currentTime,
                isPlaying: state.isPlaying,
                playbackSpeed: state.playbackSpeed,
                canvasSize: state.canvasSize,
            };
        });
        return unsub;
    }, []);

    // Ensure video/image elements exist for current clips
    const ensureMediaElements = useCallback(() => {
        const { tracks } = stateRef.current;
        const currentActiveIds = new Set<string>();

        tracks.forEach(track => {
            if (!track.visible) return;
            track.clips.forEach(clip => {
                if (clip.type === 'video' || clip.type === 'audio') {
                    currentActiveIds.add(clip.id);
                    if (!videoElementsRef.current[clip.id]) {
                        // Ensure hidden container exists
                        if (!hiddenContainerRef.current) {
                            const container = document.createElement('div');
                            container.id = 'hidden-media-container';
                            container.style.display = 'none';
                            document.body.appendChild(container);
                            hiddenContainerRef.current = container;
                        }

                        const video = document.createElement('video');
                        video.src = clip.src;
                        video.preload = 'auto';
                        video.playsInline = true;
                        video.crossOrigin = 'anonymous'; // Help with Web Audio CORS
                        // Video clips are always muted — audio only from audio clips
                        video.muted = clip.type === 'video';
                        
                        // Add to DOM so AudioMeter can find it
                        hiddenContainerRef.current.appendChild(video);
                        
                        videoElementsRef.current[clip.id] = video;
                    }
                } else if (clip.type === 'image') {
                    if (!imageElementsRef.current[clip.id]) {
                        const img = new Image();
                        img.src = clip.src;
                        imageElementsRef.current[clip.id] = img;
                    }
                }
            });
        });

        // Cleanup removed clips
        Object.keys(videoElementsRef.current).forEach(id => {
            if (!currentActiveIds.has(id)) {
                const el = videoElementsRef.current[id];
                el.pause();
                el.removeAttribute('src');
                el.load();
                el.remove(); // Remove from DOM
                delete videoElementsRef.current[id];
                delete lastSeekTimeRef.current[id];
            }
        });

        activeClipIdsRef.current = currentActiveIds;
    }, []);

    // Manage playback — JS clock drives everything, video elements sync to it
    const managePlayback = useCallback(() => {
        const { tracks, currentTime, isPlaying, playbackSpeed } = stateRef.current;

        tracks.forEach(track => {
            if (!track.visible) return;
            track.clips.forEach(clip => {
                if (clip.type !== 'video' && clip.type !== 'audio') return;

                const el = videoElementsRef.current[clip.id];
                if (!el) return;

                const clipTime = currentTime - clip.start + clip.offset;
                const isWithinClip = currentTime >= clip.start && currentTime < clip.start + clip.duration;

                // --- Volume (only for audio clips) ---
                if (clip.type === 'audio') {
                    let targetVolume = clip.volume ?? 1;
                    if (clip.volumeKeyframes && clip.volumeKeyframes.length > 0) {
                        const relTime = currentTime - clip.start;
                        const frames = clip.volumeKeyframes;
                        if (relTime <= frames[0].time) {
                            targetVolume = frames[0].value;
                        } else if (relTime >= frames[frames.length - 1].time) {
                            targetVolume = frames[frames.length - 1].value;
                        } else {
                            for (let i = 0; i < frames.length - 1; i++) {
                                if (relTime >= frames[i].time && relTime < frames[i + 1].time) {
                                    const ratio = (relTime - frames[i].time) / (frames[i + 1].time - frames[i].time);
                                    targetVolume = frames[i].value + (frames[i + 1].value - frames[i].value) * ratio;
                                    break;
                                }
                            }
                        }
                    }
                    targetVolume = Math.max(0, Math.min(1, targetVolume));
                    if (Math.abs(el.volume - targetVolume) > 0.01) {
                        el.volume = targetVolume;
                    }
                }

                // --- Playback control ---
                if (!isWithinClip) {
                    // Not in this clip — pause it
                    if (!el.paused) el.pause();
                    return;
                }

                // We ARE within this clip
                const seekTarget = Math.max(0, clipTime);

                if (playbackSpeed < 0) {
                    // REVERSE: pause element, seek manually (throttled)
                    if (!el.paused) el.pause();
                    const lastSeek = lastSeekTimeRef.current[clip.id] || 0;
                    const now = performance.now();
                    if (now - lastSeek > 80) {
                        if (Math.abs(el.currentTime - seekTarget) > 0.04) {
                            el.currentTime = seekTarget;
                            lastSeekTimeRef.current[clip.id] = now;
                        }
                    }
                } else if (isPlaying) {
                    // FORWARD PLAY
                    const targetRate = Math.abs(playbackSpeed) || 1;
                    if (Math.abs(el.playbackRate - targetRate) > 0.01) {
                        el.playbackRate = targetRate;
                    }

                    // Sync: if element is too far from expected position, seek it
                    // This handles clip transitions, splits, and gaps cleanly
                    const drift = Math.abs(el.currentTime - seekTarget);
                    if (drift > 0.15) {
                        el.currentTime = seekTarget;
                    }

                    if (el.paused) {
                        el.play().catch(() => {});
                    }
                } else {
                    // PAUSED — scrub mode
                    if (!el.paused) el.pause();
                    if (Math.abs(el.currentTime - seekTarget) > 0.05) {
                        el.currentTime = seekTarget;
                    }
                }
            });
        });
    }, []);

    // Draw a single clip to canvas
    const drawClip = useCallback((ctx: CanvasRenderingContext2D, clip: Clip) => {
        const { canvasSize } = stateRef.current;
        ctx.save();

        const { position = { x: 0, y: 0 }, scale = 1, rotation = 0, opacity = 1 } = clip;
        const cx = (canvasSize.width / 2) + position.x;
        const cy = (canvasSize.height / 2) + position.y;

        ctx.translate(cx, cy);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scale, scale);
        ctx.globalAlpha = opacity;

        if (clip.type === 'video') {
            const video = videoElementsRef.current[clip.id];
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
            const img = imageElementsRef.current[clip.id];
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
    }, []);

    // Main render loop — pure JS clock, video elements sync TO the clock
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        lastFrameTimeRef.current = performance.now();

        const renderFrame = (timestamp: number) => {
            const deltaTime = Math.min((timestamp - lastFrameTimeRef.current) / 1000, 0.1);
            lastFrameTimeRef.current = timestamp;

            const { tracks, currentTime, isPlaying, playbackSpeed } = stateRef.current;
            const canvasW = stateRef.current.canvasSize.width;
            const canvasH = stateRef.current.canvasSize.height;

            // Ensure media elements
            ensureMediaElements();

            // Manage playback (sync video elements to current time)
            managePlayback();

            // Clear canvas
            ctx.clearRect(0, 0, canvasW, canvasH);

            // Draw clips (back to front — bottom track = background)
            const tracksToRender = [...tracks].reverse();
            tracksToRender.forEach(track => {
                if (!track.visible) return;
                const clip = track.clips.find(c =>
                    c.type !== 'audio' &&
                    currentTime >= c.start &&
                    currentTime < c.start + c.duration
                );
                if (clip) drawClip(ctx, clip);
            });

            // Advance time — PURE JS CLOCK (no master video dependency)
            if (isPlaying) {
                const nextTime = currentTime + (deltaTime * playbackSpeed);

                if (nextTime < 0) {
                    useStore.getState().setCurrentTime(0);
                    useStore.getState().setIsPlaying(false);
                    useStore.getState().setPlaybackSpeed(1.0);
                } else {
                    useStore.getState().setCurrentTime(nextTime);
                }
            }

            animFrameRef.current = requestAnimationFrame(renderFrame);
        };

        animFrameRef.current = requestAnimationFrame(renderFrame);

        return () => {
            cancelAnimationFrame(animFrameRef.current);
        };
    }, [canvasRef, ensureMediaElements, managePlayback, drawClip]);

    // Cleanup all elements on unmount
    useEffect(() => {
        return () => {
            Object.values(videoElementsRef.current).forEach(v => {
                v.pause();
                v.removeAttribute('src');
                v.load();
                v.remove(); // Remove from DOM
            });
            if (hiddenContainerRef.current) {
                hiddenContainerRef.current.remove();
                hiddenContainerRef.current = null;
            }
            videoElementsRef.current = {};
            imageElementsRef.current = {};
        };
    }, []);

    const getClipRenderLayout = (clipId: string) => {
        const vid = videoElementsRef.current[clipId];
        if (vid) return { width: vid.videoWidth, height: vid.videoHeight };
        const img = imageElementsRef.current[clipId];
        if (img) return { width: img.naturalWidth, height: img.naturalHeight };
        return null;
    };

    return { getClipRenderLayout };
};
