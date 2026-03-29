import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { useCanvasRender } from '../../hooks/useCanvasRender';
import { Clip } from '../../types';
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import { AudioMeter } from './AudioMeter';

type PreviewZoom = 'fit' | number; // 'fit' or percentage like 25, 50, 100, 200

const ZOOM_PRESETS = [25, 50, 75, 100, 150, 200];

export const Preview = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { canvasSize, tracks, currentTime, selectedClipIds, setSelectedClipIds, updateClip } = useStore();
    const [isDragging, setIsDragging] = useState(false);
    const [dragMode, setDragMode] = useState<'move' | 'scale'>('move');
    const [dragHandle, setDragHandle] = useState<'nw' | 'ne' | 'se' | 'sw' | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [initialClipState, setInitialClipState] = useState<{ x: number, y: number, scale: number }>({ x: 0, y: 0, scale: 1 });
    const [previewZoom, setPreviewZoom] = useState<PreviewZoom>('fit');

    const { getClipRenderLayout } = useCanvasRender(canvasRef);

    // Calculate actual display dimensions based on zoom
    const getCanvasDisplaySize = useCallback(() => {
        if (!scrollRef.current) return { width: canvasSize.width, height: canvasSize.height };

        const containerW = scrollRef.current.clientWidth;
        const containerH = scrollRef.current.clientHeight;

        if (previewZoom === 'fit') {
            const canvasAspect = canvasSize.width / canvasSize.height;
            const containerAspect = containerW / containerH;

            if (containerAspect > canvasAspect) {
                // Height constrained
                const h = containerH - 16; // padding
                return { width: h * canvasAspect, height: h };
            } else {
                // Width constrained
                const w = containerW - 16;
                return { width: w, height: w / canvasAspect };
            }
        }

        const scale = previewZoom / 100;
        return { width: canvasSize.width * scale, height: canvasSize.height * scale };
    }, [previewZoom, canvasSize]);

    // Helpers for safe coordinate mapping (Canvas <-> Screen)
    const getVisualRect = () => {
        if (!canvasRef.current) return null;
        const rect = canvasRef.current.getBoundingClientRect();
        const displaySize = getCanvasDisplaySize();

        return {
            x: rect.left,
            y: rect.top,
            width: displaySize.width,
            height: displaySize.height,
            scale: displaySize.width / canvasSize.width
        };
    };

    // Calculate Screen Rect for Gizmo (CSS Px)
    const getGizmoStyle = (clip: Clip) => {
        const visual = getVisualRect();
        if (!visual || !containerRef.current || !canvasRef.current) return { display: 'none' };

        let baseW = canvasSize.width;
        let baseH = canvasSize.height;

        const layout = getClipRenderLayout(clip.id);
        if (layout && layout.width && layout.height) {
            const mediaAspect = layout.width / layout.height;
            const canvasAspect = canvasSize.width / canvasSize.height;

            if (mediaAspect > canvasAspect) {
                baseW = canvasSize.width;
                baseH = canvasSize.width / mediaAspect;
            } else {
                baseH = canvasSize.height;
                baseW = canvasSize.height * mediaAspect;
            }
        }

        const boxW = baseW * clip.scale;
        const boxH = baseH * clip.scale;

        const cxCanvas = (canvasSize.width / 2) + clip.position.x;
        const cyCanvas = (canvasSize.height / 2) + clip.position.y;

        const canvasRect = canvasRef.current.getBoundingClientRect();

        const screenX = visual.x + (cxCanvas * visual.scale);
        const screenY = visual.y + (cyCanvas * visual.scale);

        const relX = screenX - canvasRect.left;
        const relY = screenY - canvasRect.top;

        const screenW = boxW * visual.scale;
        const screenH = boxH * visual.scale;

        return {
            position: 'absolute' as const,
            left: '0px',
            top: '0px',
            width: `${screenW}px`,
            height: `${screenH}px`,
            transform: `translate(${relX - screenW / 2}px, ${relY - screenH / 2}px) rotate(${clip.rotation}deg)`,
            transformOrigin: 'center center'
        };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const visual = getVisualRect();
        if (!visual) return;

        const mouseXCanvas = (e.clientX - visual.x) / visual.scale;
        const mouseYCanvas = (e.clientY - visual.y) / visual.scale;

        let hitClipId = null;

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            if (!track.visible) continue;
            for (const clip of track.clips) {
                const clipStart = clip.start;
                const clipEnd = clip.start + clip.duration;
                if (currentTime >= clipStart && currentTime < clipEnd) {
                    const centerX = (canvasSize.width / 2) + clip.position.x;
                    const centerY = (canvasSize.height / 2) + clip.position.y;

                    let baseW = canvasSize.width;
                    let baseH = canvasSize.height;
                    const layout = getClipRenderLayout(clip.id);
                    if (layout && layout.width && layout.height) {
                        const mediaAspect = layout.width / layout.height;
                        const canvasAspect = canvasSize.width / canvasSize.height;
                        if (mediaAspect > canvasAspect) {
                            baseW = canvasSize.width;
                            baseH = canvasSize.width / mediaAspect;
                        } else {
                            baseH = canvasSize.height;
                            baseW = canvasSize.height * mediaAspect;
                        }
                    }

                    const halfW = (baseW * clip.scale) / 2;
                    const halfH = (baseH * clip.scale) / 2;

                    const dx = mouseXCanvas - centerX;
                    const dy = mouseYCanvas - centerY;

                    if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
                        hitClipId = clip.id;
                        break;
                    }
                }
            }
            if (hitClipId) break;
        }

        if (hitClipId) {
            if (e.shiftKey) {
                if (selectedClipIds.includes(hitClipId)) {
                    setSelectedClipIds(selectedClipIds.filter(id => id !== hitClipId));
                } else {
                    setSelectedClipIds([...selectedClipIds, hitClipId]);
                }
            } else {
                setSelectedClipIds([hitClipId]);
            }

            setIsDragging(true);
            setDragMode('move');
            setDragStart({ x: e.clientX, y: e.clientY });

            tracks.forEach(t => t.clips.forEach(c => {
                if (c.id === hitClipId) {
                    setInitialClipState({ x: c.position.x, y: c.position.y, scale: c.scale });
                }
            }));
        } else {
            setSelectedClipIds([]);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const visual = getVisualRect();
        if (!isDragging || selectedClipIds.length === 0 || !visual) return;

        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        const canvasDeltaX = deltaX / visual.scale;
        const canvasDeltaY = deltaY / visual.scale;

        const targetId = selectedClipIds.includes(tracks.find(t => t.clips.some(c => c.id === selectedClipIds[selectedClipIds.length - 1]))?.clips.find(c => c.id === selectedClipIds[selectedClipIds.length - 1])?.id || '')
            ? selectedClipIds[selectedClipIds.length - 1]
            : selectedClipIds[0];

        if (!targetId) return;

        if (dragMode === 'move') {
            const newX = initialClipState.x + canvasDeltaX;
            const newY = initialClipState.y + canvasDeltaY;
            updateClip(targetId, { position: { x: newX, y: newY } });

        } else if (dragMode === 'scale' && dragHandle) {
            let baseW = canvasSize.width;
            const layout = getClipRenderLayout(targetId);
            if (layout && layout.width && layout.height) {
                const mediaAspect = layout.width / layout.height;
                const canvasAspect = canvasSize.width / canvasSize.height;
                if (mediaAspect > canvasAspect) {
                    baseW = canvasSize.width;
                } else {
                    baseW = canvasSize.height * mediaAspect;
                }
            }

            const startWidth = baseW * initialClipState.scale;
            const xFactor = (dragHandle === 'ne' || dragHandle === 'se') ? 1 : -1;
            const widthChange = canvasDeltaX * xFactor;
            const newWidth = Math.max(10, startWidth + widthChange * 2);
            const newScale = newWidth / baseW;

            updateClip(targetId, { scale: Math.max(0.1, newScale) });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragHandle(null);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove as any);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove as any);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, selectedClipIds, dragStart, dragMode, dragHandle, initialClipState]);

    // Find Selected Clip Wrapper (Primary for Gizmo)
    const primarySelectedClip = React.useMemo(() => {
        if (selectedClipIds.length === 0) return null;
        const id = selectedClipIds[selectedClipIds.length - 1];
        for (const track of tracks) {
            const c = track.clips.find(clip => clip.id === id);
            if (c) return c;
        }
        return null;
    }, [selectedClipIds, tracks]);

    const isVisibleInTime = primarySelectedClip && currentTime >= primarySelectedClip.start && currentTime < primarySelectedClip.start + primarySelectedClip.duration;

    const startScaleDrag = (e: React.MouseEvent, handle: 'nw' | 'ne' | 'se' | 'sw') => {
        e.stopPropagation();
        if (primarySelectedClip) {
            setIsDragging(true);
            setDragMode('scale');
            setDragHandle(handle);
            setDragStart({ x: e.clientX, y: e.clientY });
            setInitialClipState({ x: primarySelectedClip.position.x, y: primarySelectedClip.position.y, scale: primarySelectedClip.scale });
        }
    };

    const displaySize = getCanvasDisplaySize();
    const zoomPercent = previewZoom === 'fit'
        ? Math.round((displaySize.width / canvasSize.width) * 100)
        : previewZoom;

    return (
        <div
            className="flex-1 flex flex-col overflow-hidden select-none"
            ref={containerRef}
        >
            {/* Scrollable Canvas Area + Audio Meter */}
            <div className="flex-1 flex overflow-hidden">
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-auto flex items-center justify-center"
                    style={{ backgroundColor: '#1a1a1a' }}
                    onMouseDown={handleMouseDown}
                >
                {/* Canvas Wrapper — sized based on zoom */}
                <div
                    className="relative shrink-0"
                    style={{
                        width: displaySize.width,
                        height: displaySize.height,
                        margin: previewZoom === 'fit' ? '0' : '24px',
                        boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.5)',
                    }}
                >
                    <canvas
                        ref={canvasRef}
                        width={canvasSize.width}
                        height={canvasSize.height}
                        style={{
                            width: displaySize.width,
                            height: displaySize.height,
                        }}
                        className="block bg-neutral-950"
                    />

                    {/* Gizmo Overlay for Selected Clip */}
                    {primarySelectedClip && isVisibleInTime && (
                        <div
                            className="border-2 border-indigo-500 box-border pointer-events-none"
                            style={getGizmoStyle(primarySelectedClip)}
                        >
                            <div className="absolute -left-2 -top-2 w-4 h-4 bg-white border border-indigo-500 rounded-full pointer-events-auto cursor-nwse-resize"
                                onMouseDown={(e) => startScaleDrag(e, 'nw')}
                            />
                            <div className="absolute -right-2 -top-2 w-4 h-4 bg-white border border-indigo-500 rounded-full pointer-events-auto cursor-nesw-resize"
                                onMouseDown={(e) => startScaleDrag(e, 'ne')}
                            />
                            <div className="absolute -right-2 -bottom-2 w-4 h-4 bg-white border border-indigo-500 rounded-full pointer-events-auto cursor-nwse-resize"
                                onMouseDown={(e) => startScaleDrag(e, 'se')}
                            />
                            <div className="absolute -left-2 -bottom-2 w-4 h-4 bg-white border border-indigo-500 rounded-full pointer-events-auto cursor-nesw-resize"
                                onMouseDown={(e) => startScaleDrag(e, 'sw')}
                            />
                        </div>
                    )}
                </div>
            </div>

                {/* Audio Level Meter */}
                <AudioMeter />
            </div>

            {/* ── Zoom Toolbar ── */}
            <div className="h-8 bg-[#111] border-t border-neutral-800 flex items-center justify-center gap-1 px-3 shrink-0">
                {/* Fit Button */}
                <button
                    onClick={() => setPreviewZoom('fit')}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
                        previewZoom === 'fit'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                            : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
                    }`}
                    title="Sığdır"
                >
                    <Maximize size={11} />
                    Fit
                </button>

                <div className="w-px h-4 bg-neutral-800 mx-1" />

                {/* Zoom Presets */}
                {ZOOM_PRESETS.map(z => (
                    <button
                        key={z}
                        onClick={() => setPreviewZoom(z)}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                            previewZoom === z
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                : 'text-neutral-500 hover:text-white hover:bg-neutral-800 border border-transparent'
                        }`}
                    >
                        {z}%
                    </button>
                ))}

                <div className="w-px h-4 bg-neutral-800 mx-1" />

                {/* Zoom In/Out */}
                <button
                    onClick={() => {
                        const current = typeof previewZoom === 'number' ? previewZoom : zoomPercent;
                        const next = ZOOM_PRESETS.find(z => z > current);
                        if (next) setPreviewZoom(next);
                    }}
                    className="p-1 rounded text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all"
                    title="Yakınlaştır"
                >
                    <ZoomIn size={13} />
                </button>
                <button
                    onClick={() => {
                        const current = typeof previewZoom === 'number' ? previewZoom : zoomPercent;
                        const prev = [...ZOOM_PRESETS].reverse().find(z => z < current);
                        if (prev) setPreviewZoom(prev);
                    }}
                    className="p-1 rounded text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all"
                    title="Uzaklaştır"
                >
                    <ZoomOut size={13} />
                </button>

                <div className="w-px h-4 bg-neutral-800 mx-1" />

                {/* Current Zoom Label */}
                <span className="text-[10px] text-neutral-600 font-mono min-w-[36px] text-center">
                    {zoomPercent}%
                </span>
            </div>
        </div>
    );
};
