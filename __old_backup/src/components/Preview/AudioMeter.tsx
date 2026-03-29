import React, { useRef, useEffect, useCallback } from 'react';

/**
 * Vertical stereo audio level meter (L/R bars).
 * Connects to all playing <video>/<audio> elements in the DOM via Web Audio API.
 * Renders peak levels using canvas for performance.
 */

const DB_MIN = -60;
const DB_MAX = 0;
const PEAK_HOLD_MS = 1200;
const PEAK_DECAY_DB_PER_SEC = 15;

// Color stops for the gradient (bottom to top): green → yellow → red
const getBarColor = (ratio: number): string => {
    if (ratio > 0.92) return '#ef4444'; // Red (clipping)
    if (ratio > 0.75) return '#f59e0b'; // Yellow/Amber
    return '#22c55e'; // Green
};

export const AudioMeter: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserLRef = useRef<AnalyserNode | null>(null);
    const analyserRRef = useRef<AnalyserNode | null>(null);
    const splitterRef = useRef<ChannelSplitterNode | null>(null);
    const mergerRef = useRef<ChannelMergerNode | null>(null);
    const sourcesRef = useRef<Map<HTMLMediaElement, MediaElementAudioSourceNode>>(new Map());
    const rafRef = useRef<number>(0);
    const peakLRef = useRef(0);
    const peakRRef = useRef(0);
    const peakLTimeRef = useRef(0);
    const peakRTimeRef = useRef(0);
    const [audioState, setAudioState] = React.useState<AudioContextState>('suspended');

    // Initialize Audio Context and Analysers
    const ensureAudioContext = useCallback(() => {
        if (audioCtxRef.current) return;

        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;
        setAudioState(ctx.state);

        ctx.onstatechange = () => {
            setAudioState(ctx.state);
        };

        // Create stereo splitter → two mono analysers
        const splitter = ctx.createChannelSplitter(2);
        const merger = ctx.createChannelMerger(2);
        splitterRef.current = splitter;
        mergerRef.current = merger;

        const analyserL = ctx.createAnalyser();
        analyserL.fftSize = 256;
        analyserL.smoothingTimeConstant = 0.6;

        const analyserR = ctx.createAnalyser();
        analyserR.fftSize = 256;
        analyserR.smoothingTimeConstant = 0.6;

        splitter.connect(analyserL, 0);
        splitter.connect(analyserR, 1);

        // Also connect through to destination so audio still plays
        merger.connect(ctx.destination);
        analyserL.connect(merger, 0, 0);
        analyserR.connect(merger, 0, 1);

        analyserLRef.current = analyserL;
        analyserRRef.current = analyserR;
    }, []);

    // Connect/disconnect media elements
    const syncMediaSources = useCallback(() => {
        if (!audioCtxRef.current || !splitterRef.current) return;

        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }

        const ctx = audioCtxRef.current;
        const splitter = splitterRef.current;

        // Find all video/audio elements currently in the DOM (from useCanvasRender)
        const mediaElements = document.querySelectorAll<HTMLMediaElement>('video, audio');
        const currentSources = sourcesRef.current;
        const activeElements = new Set<HTMLMediaElement>();

        mediaElements.forEach(el => {
            // Skip muted elements used for waveform extraction etc.
            if (el.closest('[data-audio-meter-ignore]')) return;

            activeElements.add(el);

            if (!currentSources.has(el)) {
                try {
                    const source = ctx.createMediaElementSource(el);
                    source.connect(splitter);
                    currentSources.set(el, source);
                } catch {
                    // Already connected or other error — that's fine
                }
            }
        });

        // Remove disconnected elements
        currentSources.forEach((source, el) => {
            if (!activeElements.has(el)) {
                try { source.disconnect(); } catch {}
                currentSources.delete(el);
            }
        });
    }, []);

    // Get RMS level from analyser as dB
    const getLevel = (analyser: AnalyserNode): number => {
        const data = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(data);

        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i] * data[i];
        }
        const rms = Math.sqrt(sum / data.length);
        const db = rms > 0 ? 20 * Math.log10(rms) : DB_MIN;
        return Math.max(DB_MIN, Math.min(DB_MAX, db));
    };

    // Map dB to 0-1 ratio
    const dbToRatio = (db: number): number => {
        return Math.max(0, Math.min(1, (db - DB_MIN) / (DB_MAX - DB_MIN)));
    };

    // Draw the meter
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        const now = performance.now();

        // Get current levels
        let levelL = 0, levelR = 0;
        if (analyserLRef.current && analyserRRef.current) {
            const dbL = getLevel(analyserLRef.current);
            const dbR = getLevel(analyserRRef.current);
            levelL = dbToRatio(dbL);
            levelR = dbToRatio(dbR);
        }

        // Peak hold with decay
        if (levelL > peakLRef.current) { peakLRef.current = levelL; peakLTimeRef.current = now; }
        if (levelR > peakRRef.current) { peakRRef.current = levelR; peakRTimeRef.current = now; }

        // Decay peaks after hold time
        const decayRate = PEAK_DECAY_DB_PER_SEC / 60; // per frame at 60fps
        if (now - peakLTimeRef.current > PEAK_HOLD_MS) {
            peakLRef.current = Math.max(levelL, peakLRef.current - decayRate / 100);
        }
        if (now - peakRTimeRef.current > PEAK_HOLD_MS) {
            peakRRef.current = Math.max(levelR, peakRRef.current - decayRate / 100);
        }

        // Clear
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);

        const barPad = 2;
        const labelH = 14; // "L" / "R" label area at bottom
        const scaleW = 14; // dB scale in the middle
        const barW = (w - scaleW - barPad * 3) / 2;
        const barH = h - labelH - 4;
        const barTop = 2;

        // Draw bar backgrounds
        const lx = barPad;
        const rx = barPad + barW + scaleW + barPad;

        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(lx, barTop, barW, barH);
        ctx.fillRect(rx, barTop, barW, barH);

        // Draw level bars (bottom-up)
        const drawBar = (x: number, level: number, peak: number) => {
            const segmentCount = Math.floor(barH / 3);

            for (let i = 0; i < segmentCount; i++) {
                const segY = barTop + barH - (i + 1) * 3;
                const segRatio = (i + 1) / segmentCount;

                if (segRatio <= level) {
                    ctx.fillStyle = getBarColor(segRatio);
                    ctx.fillRect(x, segY, barW, 2);
                } else {
                    ctx.fillStyle = '#1f1f1f';
                    ctx.fillRect(x, segY, barW, 1);
                }
            }

            // Peak indicator line
            if (peak > 0.01) {
                const peakY = barTop + barH - peak * barH;
                ctx.fillStyle = peak > 0.92 ? '#ef4444' : '#ffffff';
                ctx.fillRect(x, peakY, barW, 1.5);
            }
        };

        drawBar(lx, levelL, peakLRef.current);
        drawBar(rx, levelR, peakRRef.current);

        // Draw dB scale in center
        ctx.fillStyle = '#555';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        const scaleX = lx + barW + scaleW / 2 + barPad / 2;

        const dbMarks = [0, -6, -12, -24, -48];
        dbMarks.forEach(db => {
            const ratio = dbToRatio(db);
            const y = barTop + barH - ratio * barH;
            ctx.fillStyle = '#444';
            ctx.fillRect(lx + barW + 1, y, scaleW - 2, 0.5);
            ctx.fillStyle = '#666';
            ctx.fillText(`${db}`, scaleX, y - 2);
        });

        // Labels
        ctx.fillStyle = '#888';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('L', lx + barW / 2, h - 3);
        ctx.fillText('R', rx + barW / 2, h - 3);

        rafRef.current = requestAnimationFrame(draw);
    }, []);

    // Animation loop
    useEffect(() => {
        ensureAudioContext();

        // Start animation
        rafRef.current = requestAnimationFrame(draw);

        // Periodically sync media sources
        const syncInterval = setInterval(syncMediaSources, 500);

        const handleGlobalClick = () => {
            if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume();
            }
        };
        window.addEventListener('click', handleGlobalClick);

        return () => {
            cancelAnimationFrame(rafRef.current);
            clearInterval(syncInterval);
            window.removeEventListener('click', handleGlobalClick);
        };
    }, [draw, ensureAudioContext, syncMediaSources]);

    // Resize canvas to match container
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const parent = canvas.parentElement;
        if (!parent) return;

        const observer = new ResizeObserver(() => {
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
        });
        observer.observe(parent);
        return () => observer.disconnect();
    }, []);

    return (
        <div 
            className="w-[40px] shrink-0 bg-[#0a0a0a] border-l border-neutral-800 relative cursor-pointer group"
            onClick={() => {
                if (audioCtxRef.current) audioCtxRef.current.resume();
            }}
            title={audioState === 'suspended' ? 'Click to enable audio meter' : 'Audio Level Meter'}
        >
            <canvas ref={canvasRef} className="w-full h-full block" />
            
            {audioState === 'suspended' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
                    <div className="rotate-90 text-[10px] text-white/40 font-bold uppercase tracking-widest">
                        TAP TO SYNC
                    </div>
                </div>
            )}
        </div>
    );
};
