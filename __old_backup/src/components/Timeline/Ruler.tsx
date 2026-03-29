import React, { useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { formatTime } from '../../utils/time';

/**
 * Picks a nice tick interval (in seconds) so labels don't overlap.
 * Aims for ~80-150px between major labels.
 */
const getTickStep = (pixelsPerSecond: number): number => {
    const NICE_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    const MIN_LABEL_GAP = 80; // min px between major tick labels

    for (const step of NICE_STEPS) {
        if (step * pixelsPerSecond >= MIN_LABEL_GAP) {
            return step;
        }
    }
    return 600; // fallback: 10 min
};

export const Ruler = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { currentTime, setCurrentTime, maxDuration, pixelsPerSecond, setPlaybackSpeed } = useStore();

    const handleMouseDown = (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        setPlaybackSpeed(1.0);

        const updateTime = (clientX: number) => {
            const x = clientX - rect.left;
            const time = Math.max(0, x / pixelsPerSecond);
            setCurrentTime(time);
        };

        updateTime(e.clientX);

        const handleMouseMove = (ev: MouseEvent) => {
            updateTime(ev.clientX);
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // Draw Ruler
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Resize
        const parent = canvas.parentElement;
        if (parent) {
            canvas.width = parent.clientWidth;
            canvas.height = 40;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#475569';
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '11px Inter, sans-serif';
        ctx.textBaseline = 'top';
        ctx.beginPath();

        const totalWidth = canvas.width;
        const step = getTickStep(pixelsPerSecond);
        const pixelStep = step * pixelsPerSecond;
        const minorCount = step >= 10 ? 5 : step >= 1 ? Math.min(5, Math.round(step * 5)) : 5;

        for (let x = 0; x < totalWidth; x += pixelStep) {
            const timeAtTick = x / pixelsPerSecond;

            // Major tick
            ctx.moveTo(x, 18);
            ctx.lineTo(x, 40);

            // Label — measure to avoid overflow
            const label = formatTime(timeAtTick);
            const labelX = x + 4;
            const labelWidth = ctx.measureText(label).width;

            // Only draw if it fits before next tick
            if (labelX + labelWidth < x + pixelStep - 4 || x + pixelStep >= totalWidth) {
                ctx.fillText(label, labelX, 4);
            }

            // Minor ticks
            for (let j = 1; j < minorCount; j++) {
                const mx = x + (j * pixelStep / minorCount);
                if (mx < totalWidth) {
                    ctx.moveTo(mx, 30);
                    ctx.lineTo(mx, 40);
                }
            }
        }
        ctx.stroke();

    }, [pixelsPerSecond]);

    return (
        <div className="h-10 relative cursor-pointer border-b border-slate-700" onMouseDown={handleMouseDown}>
            <canvas ref={canvasRef} className="block w-full h-full" />
            {/* Playhead Indicator */}
            <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
                style={{ left: `${currentTime * pixelsPerSecond}px` }}
            >
                <div className="w-3 h-3 bg-red-500 -ml-1.5 transform rotate-45 -mt-1.5 rounded-sm shadow-sm ring-1 ring-red-900"></div>
            </div>
        </div>
    );
};
