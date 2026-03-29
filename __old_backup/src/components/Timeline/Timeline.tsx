import React, { useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { Play, Pause, SkipBack, Scissors, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { formatTime } from '../../utils/time';
import { Ruler } from './Ruler';
import { TrackRow } from './TrackRow';

export const Timeline = () => {
    const {
        isPlaying,
        setIsPlaying,
        currentTime,
        maxDuration,
        tracks,
        selectedClipIds,
        removeClip,
        splitClip,
        pixelsPerSecond,
        setZoom,
        setSelectedClipIds,
        setPlaybackSpeed,
        playbackSpeed
    } = useStore();

    // Selection Box State
    const [isSelecting, setIsSelecting] = React.useState(false);
    const [selectionBox, setSelectionBox] = React.useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);
    const timelineRef = useRef<HTMLDivElement>(null);

    // ... (omitted sound logic) ...

    const togglePlay = () => setIsPlaying(!isPlaying);

    const handleDelete = () => {
        // Remove ALL selected
        selectedClipIds.forEach(id => removeClip(id));
    };

    const handleSplit = () => {
        if (selectedClipIds.length > 0) splitClip();
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            if (e.key === 'Delete') handleDelete();
            if (e.key === '4') handleSplit();

            // Spacebar: Play/Pause and reset speed
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                togglePlay();
                setPlaybackSpeed(1.0); // Reset to normal speed
            }

            // J: Rewind — stack speed: -2 → -4 → -8
            if (e.key.toLowerCase() === 'j') {
                e.preventDefault();
                const currentSpeed = useStore.getState().playbackSpeed;
                let newSpeed = -2;
                if (currentSpeed < 0) {
                    // Already reversing, double the speed (cap at -8)
                    newSpeed = Math.max(currentSpeed * 2, -8);
                }
                setIsPlaying(true);
                setPlaybackSpeed(newSpeed);
            }

            // K: Pause and reset speed to normal
            if (e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsPlaying(false);
                setPlaybackSpeed(1.0);
            }

            // L: Fast forward — stack speed: 2 → 4 → 8
            if (e.key.toLowerCase() === 'l') {
                e.preventDefault();
                const currentSpeed = useStore.getState().playbackSpeed;
                let newSpeed = 2;
                if (currentSpeed > 1) {
                    // Already fast-forwarding, double the speed (cap at 8)
                    newSpeed = Math.min(currentSpeed * 2, 8);
                }
                setIsPlaying(true);
                setPlaybackSpeed(newSpeed);
            }

            // In/Out Points
            if (e.key.toLowerCase() === 'i') {
                useStore.getState().setInPoint(useStore.getState().currentTime);
            }
            if (e.key.toLowerCase() === 'o') {
                useStore.getState().setOutPoint(useStore.getState().currentTime);
            }
            if (e.key.toLowerCase() === 'x' && e.altKey) {
                useStore.getState().clearInOut();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedClipIds, isPlaying, setIsPlaying, setPlaybackSpeed, playbackSpeed]);

    const { inPoint, outPoint } = useStore();

    // Box Selection Logic
    const handleTimelineMouseDown = (e: React.MouseEvent) => {
        // If target is Ruler or Scrollbar, ignore.
        // The listener is on the container.
        if (e.button !== 0) return; // Left click only

        // Convert to relative coords
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + timelineRef.current.scrollLeft; // Account for scroll
        const y = e.clientY - rect.top + timelineRef.current.scrollTop;

        // Start Selection
        setIsSelecting(true);
        setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y });

        // On start, if not holding Shift, clear selection?
        if (!e.shiftKey && !e.ctrlKey) {
            setSelectedClipIds([]);
        }
    };

    const handleTimelineMouseMove = (e: React.MouseEvent) => {
        if (!isSelecting || !selectionBox || !timelineRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
        const y = e.clientY - rect.top + timelineRef.current.scrollTop;

        setSelectionBox({ ...selectionBox, currentX: x, currentY: y });
    };

    const handleTimelineMouseUp = () => {
        if (!isSelecting || !selectionBox) return;

        // Calculate Intersection
        const boxLeft = Math.min(selectionBox.startX, selectionBox.currentX);
        const boxTop = Math.min(selectionBox.startY, selectionBox.currentY);
        const boxWidth = Math.abs(selectionBox.currentX - selectionBox.startX);
        const boxHeight = Math.abs(selectionBox.currentY - selectionBox.startY);
        const boxRight = boxLeft + boxWidth;
        const boxBottom = boxTop + boxHeight;

        // Don't select if just a click (or tiny drag)
        if (boxWidth > 5 || boxHeight > 5) {
            const newSelectedIds: string[] = [];

            tracks.forEach((track, trackIndex) => {
                // Calculate Track Y Bounds (Assuming 128px height)
                const TRACK_HEIGHT = 81; // border
                const trackTop = trackIndex * TRACK_HEIGHT; // Approximate, assuming Ruler is not in this scroll container? 
                // Wait, TrackRow is inside map using Ruler offset? 
                // The container `timelineRef` is the one with scroll.
                // tracks.map renders TrackRows.
                // Assuming TrackRow height is fixed.

                const trackBottom = trackTop + TRACK_HEIGHT;

                // Check vertical intersection with Track
                if (trackBottom < boxTop || trackTop > boxBottom) return;

                track.clips.forEach(clip => {
                    const clipLeft = clip.start * pixelsPerSecond;
                    const clipRight = (clip.start + clip.duration) * pixelsPerSecond;

                    // Box Intersects Clip?
                    // Vertical intersection is true if we are in track loop (simplified). 
                    // Horizontal:
                    if (clipRight > boxLeft && clipLeft < boxRight) {
                        newSelectedIds.push(clip.id);
                    }
                });
            });

            // If Shift, append
            setSelectedClipIds(newSelectedIds); // For now replace. Merging is complex with deselection logic.
            // User requested "Select layers", usually replaces unless shift.
        }

        setIsSelecting(false);
        setSelectionBox(null);
    };


    return (
        <div className="flex flex-col h-full select-none">
            {/* Toolbar */}
            <div className="h-10 bg-slate-800 border-b border-slate-700 flex items-center px-4 justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                        <div className="relative">
                            <button onClick={togglePlay} className="p-1.5 hover:bg-slate-700 rounded text-slate-200">
                                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                            </button>
                            {playbackSpeed !== 1 && isPlaying && (
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-bold text-indigo-400 bg-indigo-950/80 border border-indigo-500/40 px-1.5 py-0.5 rounded whitespace-nowrap">
                                    {playbackSpeed > 0 ? `${playbackSpeed}x` : `${playbackSpeed}x`}
                                </span>
                            )}
                        </div>
                        <button onClick={() => { }} className="p-1.5 hover:bg-slate-700 rounded text-slate-200">
                            <SkipBack size={16} />
                        </button>
                    </div>

                    <div className="text-xs font-mono bg-slate-950 px-2 py-1 rounded text-indigo-400 border border-slate-700">
                        {formatTime(currentTime)} <span className="text-slate-600">/ {formatTime(maxDuration)}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Zoom Slider */}
                    <div className="flex items-center gap-2 mr-4">
                        <ZoomOut size={14} className="text-slate-500" />
                        <input
                            type="range"
                            min="5"
                            max="100"
                            value={pixelsPerSecond}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="w-24 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <ZoomIn size={14} className="text-slate-500" />
                    </div>

                    <button
                        className="p-1.5 hover:bg-slate-700 rounded text-slate-200"
                        title="Split"
                        onClick={handleSplit}
                    >
                        <Scissors size={16} />
                    </button>
                    <button
                        className="p-1.5 hover:bg-red-900/50 hover:text-red-400 rounded text-slate-200"
                        title="Delete"
                        onClick={handleDelete}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Timeline Area */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                <div className="pl-32 border-b border-slate-700 bg-slate-900 border-r border-slate-800">
                    <Ruler />
                </div>

                <div
                    ref={timelineRef}
                    className="flex-1 overflow-y-auto overflow-x-hidden relative bg-slate-900"
                    style={{ backgroundImage: 'linear-gradient(to right, #1e293b 1px, transparent 1px)', backgroundSize: `${pixelsPerSecond}px 100%` }}
                    onMouseDown={handleTimelineMouseDown}
                    onMouseMove={handleTimelineMouseMove}
                    onMouseUp={handleTimelineMouseUp}
                    onMouseLeave={handleTimelineMouseUp}

                    // Drag & Drop
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        const data = e.dataTransfer.getData('application/json');
                        if (!data) return;

                        try {
                            const asset = JSON.parse(data) as import('../../types').Asset;
                            if (!asset.id || !asset.src) return;

                            const rect = timelineRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            // Ruler is separate div "pl-32" (128px) in parent.
                            // Wait, timelineRef is the scrolling container "flex-1 overflow-y-auto...".
                            // It does NOT contain the 128px padding?
                            // Code: `<div ref={timelineRef} ... onDrop...>`
                            // It's the sibling of `<div className="pl-32... Ruler...`.
                            // So timelineRef starts at x=0 relative to its container? 
                            // Ah, render is:
                            // Parent Flex row:
                            //  Div Ruler (pl-32) - wait, hierarchy:
                            //  Parent "flex-1 flex flex-col overflow-hidden relative"
                            //    Row 1: Ruler div (pl-32)
                            //    Row 2: TimelineRef div "flex-1 overflow-y-auto..."
                            // This means TimelineRef div fills the width? or starts below?
                            // If Ruler is above, TimelineRef is below.
                            // But Ruler is usually sync'd scroll?
                            // Current code: 
                            // <div className="pl-32 ..."> <Ruler /> </div>
                            // <div ref={timelineRef} ...> {tracks.map...} </div>

                            // TrackRow has `w-32` header inside it.
                            // So timelineRef covers the WHOLE width including headers.
                            // So x=0 is left edge of header.
                            // x=128 is start of timeline (0s).

                            // Calc Time
                            const mouseXInternal = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
                            const timelineStartPx = 128;
                            const pixels = mouseXInternal - timelineStartPx;
                            const time = Math.max(0, pixels / pixelsPerSecond);

                            // Calc Track
                            // Y is relative to container top (scrolling handled by getBoundingClientRect being viewport rel, but we add scrollTop)
                            const mouseYInternal = e.clientY - rect.top + (timelineRef.current?.scrollTop || 0);
                            // Track height is presumably 128px (TrackRow h-32) + border?
                            // TrackRow h-32 = 128px. Border-b 1px.
                            const TRACK_HEIGHT = 81;
                            const trackIndex = Math.floor(mouseYInternal / TRACK_HEIGHT);

                            let targetTrackId = tracks[trackIndex]?.id;

                            // If dropped on valid track, check type compatibility
                            if (targetTrackId) {
                                const track = tracks[trackIndex];
                                const isAudioAsset = asset.type === 'audio';
                                const isAudioTrack = track.type === 'audio';

                                if (isAudioAsset !== isAudioTrack) {
                                    // Incompatible type. Force create a new track.
                                    targetTrackId = ''; 
                                }
                            }

                            if (!targetTrackId) {
                                // Create new track with normalized type (video or audio)
                                targetTrackId = `track-${Date.now()}`;
                                const trackType = asset.type === 'audio' ? 'audio' : 'video';
                                useStore.getState().addTrack({
                                    id: targetTrackId,
                                    name: `${trackType.charAt(0).toUpperCase() + trackType.slice(1)} Track ${tracks.length + 1}`,
                                    type: trackType,
                                    visible: true,
                                    muted: false,
                                    clips: []
                                });
                            }

                            // Add Clip
                            useStore.getState().addClip({
                                id: crypto.randomUUID(),
                                trackId: targetTrackId,
                                type: asset.type,
                                src: asset.src,
                                name: asset.name,
                                start: time,
                                duration: asset.duration || 5,
                                offset: 0,
                                position: { x: 0, y: 0 },
                                scale: 1,
                                rotation: 0,
                                opacity: 1,
                                zIndex: 0,
                                volume: 1,
                                waveform: asset.waveform
                            });

                        } catch (err) {
                            console.error("Drop failed", err);
                        }
                    }}
                >
                    {/* Playhead Line extending down */}
                    <div
                        className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none ml-32"
                        style={{ left: `${currentTime * pixelsPerSecond}px` }}
                    />

                    {/* In/Out Point Visualization */}
                    {inPoint !== null && (
                        <div
                            className="absolute top-0 bottom-0 w-px bg-yellow-400 z-40 ml-32 pointer-events-none"
                            style={{ left: `${inPoint * pixelsPerSecond}px` }}
                        >
                            <div className="absolute top-0 -translate-x-1/2 text-[10px] font-bold text-yellow-500 bg-black/50 px-1 rounded-b">IN</div>
                        </div>
                    )}
                    {outPoint !== null && (
                        <div
                            className="absolute top-0 bottom-0 w-px bg-yellow-400 z-40 ml-32 pointer-events-none"
                            style={{ left: `${outPoint * pixelsPerSecond}px` }}
                        >
                            <div className="absolute top-0 -translate-x-1/2 text-[10px] font-bold text-yellow-500 bg-black/50 px-1 rounded-b">OUT</div>
                        </div>
                    )}

                    {/* Range Highlight (Dim outside) */}
                    {(inPoint !== null || outPoint !== null) && (
                        <>
                            {inPoint !== null && (
                                <div
                                    className="absolute top-0 bottom-0 bg-black/30 z-20 pointer-events-none ml-32"
                                    style={{ left: 0, width: `${inPoint * pixelsPerSecond}px` }}
                                />
                            )}
                            {outPoint !== null && (
                                <div
                                    className="absolute top-0 bottom-0 bg-black/30 z-20 pointer-events-none ml-32"
                                    style={{ left: `${outPoint * pixelsPerSecond}px`, right: 0 }}
                                />
                            )}
                            {/* Connector Line if both exist */}
                            {inPoint !== null && outPoint !== null && outPoint > inPoint && (
                                <div
                                    className="absolute top-0 h-1 bg-yellow-500/50 z-20 pointer-events-none ml-32"
                                    style={{ left: `${inPoint * pixelsPerSecond}px`, width: `${(outPoint - inPoint) * pixelsPerSecond}px` }}
                                />
                            )}
                        </>
                    )}


                    {tracks.map((track) => {
                        const containsSelected = track.clips.some(c => selectedClipIds.includes(c.id));
                        return (
                            <div key={track.id} className={containsSelected ? "relative z-50" : "relative z-0"}>
                                <TrackRow track={track} pixelsPerSecond={pixelsPerSecond} />
                            </div>
                        );
                    })}

                    {/* Selection Box Overlay */}
                    {isSelecting && selectionBox && (
                        <div
                            className="absolute bg-indigo-500/30 border border-indigo-400 pointer-events-none z-[100]"
                            style={{
                                left: Math.min(selectionBox.startX, selectionBox.currentX),
                                top: Math.min(selectionBox.startY, selectionBox.currentY),
                                width: Math.abs(selectionBox.currentX - selectionBox.startX),
                                height: Math.abs(selectionBox.currentY - selectionBox.startY)
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
