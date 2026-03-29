import React, { useRef } from 'react';
import { Clip } from '../../types';
import { useStore } from '../../store/useStore';
import clsx from 'clsx';
import { extractWaveform } from '../../utils/audioUtils';
import { Link, Unlink } from 'lucide-react';

interface ClipItemProps {
    clip: Clip;
    pixelsPerSecond: number;
}

export const ClipItem = ({ clip, pixelsPerSecond }: ClipItemProps) => {
    const { setSelectedClipIds, selectedClipIds, updateClip, tracks, addTrack, unlinkClips, linkClips } = useStore();
    const isSelected = selectedClipIds.includes(clip.id);
    const [showContextMenu, setShowContextMenu] = React.useState(false);
    const [contextMenuPos, setContextMenuPos] = React.useState({ x: 0, y: 0 });
    const contextMenuRef = useRef<HTMLDivElement>(null);

    const isLinked = !!clip.linkedClipId;

    // Close context menu on click outside
    React.useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                setShowContextMenu(false);
            }
        };
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Extract Audio Waveform Effect — uses deduplication cache in audioUtils
    React.useEffect(() => {
        if ((clip.type === 'video' || clip.type === 'audio') && !clip.waveform && clip.src) {
            extractWaveform(clip.src).then(waveform => {
                if (waveform.length > 0) {
                    // Use silent update — no undo history bloat
                    useStore.getState().updateClipSilent(clip.id, { waveform });
                    // Also copy to linked partner clip if it exists
                    if (clip.linkedClipId) {
                        useStore.getState().updateClipSilent(clip.linkedClipId, { waveform });
                    }
                }
            });
        }
    }, [clip.id, clip.type, clip.src, clip.waveform]);

    // Real Waveform SVG Component — mirrored, pro-style
    // Slices waveform data to show only this clip's portion (offset → offset+duration)
    const WaveformVisual = () => {
        const fullData = clip.waveform;

        if (!fullData || fullData.length === 0) {
            // Fallback: subtle noise bars
            return (
                <div className="w-full h-full flex items-center justify-center gap-[1px] px-1 opacity-40">
                    {Array.from({ length: 40 }).map((_, i) => (
                        <div key={i}
                            className="flex-1 rounded-full bg-slate-400"
                            style={{ height: `${15 + Math.sin(i * 0.7) * 30}%`, minWidth: '1px' }}
                        />
                    ))}
                </div>
            );
        }

        // Calculate which slice of the full waveform to display
        // Full waveform represents the entire audio source (~50 samples/sec)
        const SAMPLES_PER_SEC = 50;
        const totalSourceDuration = fullData.length / SAMPLES_PER_SEC;

        // Map clip's offset+duration to sample indices
        const startSample = Math.floor((clip.offset / totalSourceDuration) * fullData.length);
        const endSample = Math.ceil(((clip.offset + clip.duration) / totalSourceDuration) * fullData.length);

        // Clamp and slice
        const sliceStart = Math.max(0, Math.min(startSample, fullData.length - 1));
        const sliceEnd = Math.max(sliceStart + 1, Math.min(endSample, fullData.length));
        const data = fullData.slice(sliceStart, sliceEnd);

        if (data.length === 0) return null;

        // Build mirrored waveform path using SVG
        const width = data.length;
        const height = 100;
        const centerY = height / 2;

        let pathTop = `M 0 ${centerY}`;
        let pathBottom = `M 0 ${centerY}`;

        data.forEach((val, i) => {
            const amplitude = val * centerY * 0.9;
            pathTop += ` L ${i} ${centerY - amplitude}`;
            pathBottom += ` L ${i} ${centerY + amplitude}`;
        });

        pathTop += ` L ${width} ${centerY}`;
        pathBottom += ` L ${width} ${centerY}`;

        return (
            <svg
                className="w-full h-full"
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
            >
                {/* Upper half */}
                <path
                    d={pathTop}
                    fill={clip.type === 'audio' ? 'rgba(52, 211, 153, 0.5)' : 'rgba(129, 140, 248, 0.4)'}
                    stroke={clip.type === 'audio' ? 'rgba(52, 211, 153, 0.8)' : 'rgba(129, 140, 248, 0.6)'}
                    strokeWidth="0.5"
                />
                {/* Lower half (mirror) */}
                <path
                    d={pathBottom}
                    fill={clip.type === 'audio' ? 'rgba(52, 211, 153, 0.35)' : 'rgba(129, 140, 248, 0.25)'}
                    stroke={clip.type === 'audio' ? 'rgba(52, 211, 153, 0.6)' : 'rgba(129, 140, 248, 0.4)'}
                    strokeWidth="0.5"
                />
                {/* Center line */}
                <line x1="0" y1={centerY} x2={width} y2={centerY} stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
            </svg>
        );
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
        setShowContextMenu(true);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();

        // Alt Duplicate Logic
        if (e.altKey) {
            const clone = {
                ...clip,
                id: crypto.randomUUID(),
                name: `${clip.name} (Copy)`,
                linkedClipId: undefined // Don't copy links
            };
            useStore.getState().addClip(clone);
            setSelectedClipIds([clip.id]);
        }
        else if (e.shiftKey || e.ctrlKey || e.metaKey) {
            if (isSelected) {
                setSelectedClipIds(selectedClipIds.filter(id => id !== clip.id));
                return;
            } else {
                setSelectedClipIds([...selectedClipIds, clip.id]);
            }
        } else {
            if (!isSelected) {
                setSelectedClipIds([clip.id]);
            }
        }

        const startX = e.clientX;
        const startY = e.clientY;
        const startClipTime = clip.start;
        const startTrackId = clip.trackId;
        const TRACK_HEIGHT = 80;
        const SNAP_THRESHOLD_PX = 8; // pixels
        const snapThresholdSec = SNAP_THRESHOLD_PX / pixelsPerSecond;

        // Collect all snap edges from other clips across all tracks
        const snapEdges: number[] = [];
        tracks.forEach(track => {
            track.clips.forEach(c => {
                if (c.id === clip.id) return;
                if (c.id === clip.linkedClipId) return; // Don't snap to linked partner
                snapEdges.push(c.start); // left edge
                snapEdges.push(c.start + c.duration); // right edge
            });
        });

        const findSnap = (newStart: number, duration: number): number => {
            let best = newStart;
            let bestDist = Infinity;

            for (const edge of snapEdges) {
                // Snap clip start to edge
                const distStart = Math.abs(newStart - edge);
                if (distStart < snapThresholdSec && distStart < bestDist) {
                    best = edge;
                    bestDist = distStart;
                }
                // Snap clip end to edge
                const distEnd = Math.abs((newStart + duration) - edge);
                if (distEnd < snapThresholdSec && distEnd < bestDist) {
                    best = edge - duration;
                    bestDist = distEnd;
                }
            }
            // Also snap to time 0
            if (Math.abs(newStart) < snapThresholdSec && Math.abs(newStart) < bestDist) {
                best = 0;
            }
            return Math.max(0, best);
        };

        const handleMouseMove = (ev: MouseEvent) => {
            const deltaX = ev.clientX - startX;
            const deltaY = ev.clientY - startY;

            const deltaSeconds = deltaX / pixelsPerSecond;
            let newStart = Math.max(0, startClipTime + deltaSeconds);

            // Apply magnetic snap
            newStart = findSnap(newStart, clip.duration);

            const trackJump = Math.round(deltaY / TRACK_HEIGHT);

            if (trackJump !== 0) {
                const currentTrackIndex = tracks.findIndex(t => t.id === startTrackId);
                const targetIndex = currentTrackIndex + trackJump;

                if (targetIndex >= tracks.length) {
                    const newTrackId = `track-${Date.now()}`;
                    addTrack({
                        id: newTrackId,
                        name: `Layer ${tracks.length + 1}`,
                        type: 'video',
                        visible: true,
                        muted: false,
                        clips: []
                    });
                }
                else if (targetIndex >= 0 && targetIndex < tracks.length) {
                    const targetTrack = tracks[targetIndex];
                    if (targetTrack.id !== clip.trackId) {
                        // VALIDATION: Track Type Compatibility
                        const isAudioClip = clip.type === 'audio';
                        const isAudioTrack = targetTrack.type === 'audio';

                        if (isAudioClip === isAudioTrack) {
                            updateClip(clip.id, {
                                start: newStart,
                                trackId: targetTrack.id
                            });
                        } else {
                            // Just update start time if track type is incompatible
                            if (clip.start !== newStart) {
                                updateClip(clip.id, { start: newStart });
                            }
                        }
                    }
                }
            } else {
                if (clip.start !== newStart) {
                    updateClip(clip.id, { start: newStart });
                }
            }
        };

        const handleMouseUp = (ev: MouseEvent) => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);

            const finalDeltaY = ev.clientY - startY;
            const finalTrackJump = Math.round(finalDeltaY / TRACK_HEIGHT);
            const currentTrackIndex = tracks.findIndex(t => t.id === startTrackId);
            const targetIndex = currentTrackIndex + finalTrackJump;

            if (targetIndex >= tracks.length) {
                const newTrackId = `track-${Date.now()}`;
                addTrack({
                    id: newTrackId,
                    name: `Layer ${tracks.length + 1}`,
                    type: 'video',
                    visible: true,
                    muted: false,
                    clips: []
                });
                updateClip(clip.id, { trackId: newTrackId });
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // Border color based on link status and clip type
    const getBorderColor = () => {
        if (isSelected) return 'border-indigo-400';
        if (isLinked) {
            return clip.type === 'video' ? 'border-amber-500/60' : 'border-amber-500/60';
        }
        return 'border-slate-600 hover:border-slate-500';
    };

    // Background subtle tint for linked clips
    const getBgColor = () => {
        if (isLinked) {
            return clip.type === 'audio' ? '#1a1f2e' : '#1e293b';
        }
        return '#1e293b';
    };

    return (
        <div
            className={clsx(
                "absolute h-full rounded cursor-grab active:cursor-grabbing border flex items-center overflow-hidden select-none group",
                getBorderColor(),
                isSelected && "z-10"
            )}
            style={{
                left: `${clip.start * pixelsPerSecond}px`,
                width: `${clip.duration * pixelsPerSecond}px`,
                top: 2,
                bottom: 2,
                height: 'calc(100% - 4px)',
                backgroundColor: getBgColor()
            }}
            onMouseDown={handleMouseDown}
            onContextMenu={handleContextMenu}
        >
            {/* Linked indicator */}
            {isLinked && (
                <div className="absolute top-1 left-1 z-30 flex items-center gap-0.5" title="Video-Audio Linked">
                    <Link size={10} className="text-amber-400" />
                </div>
            )}

            {/* Filmstrip Background — only for video/image, NOT audio */}
            {(clip.type === 'video' || clip.type === 'image') && (
                <div className="absolute inset-0 opacity-30 flex overflow-hidden pointer-events-none">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="flex-1 h-full min-w-[50px] border-r border-white/5 bg-slate-800">
                            {clip.type === 'image' && <img src={clip.src} className="w-full h-full object-cover opacity-50" draggable={false} />}
                        </div>
                    ))}
                </div>
            )}



            <div className={clsx("relative z-10 px-2 text-xs truncate drop-shadow-md font-medium", isLinked ? "pl-5" : "", isSelected ? "text-white" : "text-slate-200")}>
                {clip.name}
            </div>

            {isSelected && (
                <>
                    {/* Left Trim Handle */}
                    <div className="absolute left-0 top-0 bottom-0 w-4 bg-indigo-500 cursor-ew-resize opacity-0 hover:opacity-50 z-20"
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const startX = e.clientX;
                            const initialStart = clip.start;
                            const initialDuration = clip.duration;
                            const initialOffset = clip.offset;

                            const handleMouseMove = (ev: MouseEvent) => {
                                const deltaX = ev.clientX - startX;
                                const deltaSeconds = deltaX / pixelsPerSecond;

                                let newStart = initialStart + deltaSeconds;
                                if (newStart < 0) newStart = 0;
                                if (newStart > initialStart + initialDuration - 0.1) newStart = initialStart + initialDuration - 0.1;

                                const diff = newStart - initialStart;
                                const newDuration = initialDuration - diff;
                                const newOffset = initialOffset + diff;

                                updateClip(clip.id, {
                                    start: newStart,
                                    duration: newDuration,
                                    offset: newOffset
                                });
                            };

                            const handleMouseUp = () => {
                                window.removeEventListener('mousemove', handleMouseMove);
                                window.removeEventListener('mouseup', handleMouseUp);
                            };
                            window.addEventListener('mousemove', handleMouseMove);
                            window.addEventListener('mouseup', handleMouseUp);
                        }}
                    />

                    {/* Right Trim Handle */}
                    <div className="absolute right-0 top-0 bottom-0 w-4 bg-indigo-500 cursor-ew-resize opacity-0 hover:opacity-50 z-20"
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const startX = e.clientX;
                            const initialDuration = clip.duration;

                            const handleMouseMove = (ev: MouseEvent) => {
                                const deltaX = ev.clientX - startX;
                                const deltaSeconds = deltaX / pixelsPerSecond;

                                let newDuration = initialDuration + deltaSeconds;
                                if (newDuration < 0.1) newDuration = 0.1;

                                updateClip(clip.id, {
                                    duration: newDuration
                                });
                            };

                            const handleMouseUp = () => {
                                window.removeEventListener('mousemove', handleMouseMove);
                                window.removeEventListener('mouseup', handleMouseUp);
                            };
                            window.addEventListener('mousemove', handleMouseMove);
                            window.addEventListener('mouseup', handleMouseUp);
                        }
                        }
                    />
                </>
            )}

            {/* Audio Volume Layer — only for audio clips (video clips are purely visual) */}
            {clip.type === 'audio' && (
                <div
                    className="absolute inset-0 pointer-events-auto overflow-hidden group/audio bg-slate-800/60"
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;

                        const time = (x / rect.width) * clip.duration;
                        const volume = 1 - (y / rect.height);

                        useStore.getState().addKeyframe(clip.id, time, Math.max(0, Math.min(1, volume)));
                    }}
                >
                    {/* Real Waveform SVG */}
                    <div className="absolute inset-0 pointer-events-none">
                        <WaveformVisual />
                    </div>

                    {/* Keyframe Line Graph */}
                    {clip.volumeKeyframes && clip.volumeKeyframes.length > 0 && (
                        <div className="absolute inset-0 pointer-events-none z-20">
                            <svg className="w-full h-full" preserveAspectRatio="none">
                                <polyline
                                    points={
                                        (() => {
                                            let pts: string[] = [];
                                            const frames = [...clip.volumeKeyframes].sort((a, b) => a.time - b.time);

                                            if (frames[0].time > 0) pts.push(`0, ${(1 - frames[0].value) * 100}%`);

                                            frames.forEach(k => {
                                                const x = (k.time / clip.duration) * 100;
                                                const y = (1 - k.value) * 100;
                                                pts.push(`${x}%, ${y}%`);
                                            });

                                            if (frames[frames.length - 1].time < clip.duration) {
                                                pts.push(`100%, ${(1 - frames[frames.length - 1].value) * 100}%`);
                                            }

                                            return pts.join(" ");
                                        })()
                                    }
                                    fill="none"
                                    stroke="#34d399"
                                    strokeWidth="2"
                                />
                            </svg>
                            {/* Render Dots */}
                            {clip.volumeKeyframes.map((k, i) => (
                                <div
                                    key={i}
                                    className="absolute w-2 h-2 bg-white rounded-full border border-emerald-500 hover:scale-150 transition-transform cursor-pointer pointer-events-auto"
                                    style={{
                                        left: `calc(${(k.time / clip.duration) * 100}% - 4px)`,
                                        top: `calc(${(1 - k.value) * 100}% - 4px)`
                                    }}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        useStore.getState().removeKeyframe(clip.id, i);
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    {/* Base Volume Line */}
                    {(!clip.volumeKeyframes || clip.volumeKeyframes.length === 0) && (
                        <div
                            className="absolute w-full border-b-2 border-emerald-400/50 hover:border-emerald-200 cursor-ns-resize z-10 transition-colors"
                            style={{ bottom: `${(clip.volume ?? 1) * 100}%` }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const startY = e.clientY;
                                const initialVolume = clip.volume ?? 1;
                                const parent = e.currentTarget.parentElement as HTMLElement;
                                const height = parent.clientHeight;

                                const handleMouseMove = (ev: MouseEvent) => {
                                    const deltaY = startY - ev.clientY;
                                    const deltaVol = deltaY / height;
                                    let newVol = Math.max(0, Math.min(1, initialVolume + deltaVol));
                                    updateClip(clip.id, { volume: newVol });
                                };

                                const handleMouseUp = () => {
                                    window.removeEventListener('mousemove', handleMouseMove);
                                    window.removeEventListener('mouseup', handleMouseUp);
                                };
                                window.addEventListener('mousemove', handleMouseMove);
                                window.addEventListener('mouseup', handleMouseUp);
                            }}
                        >
                            <div className="absolute right-0 -bottom-1.5 w-3 h-3 bg-emerald-400 rounded-full opacity-0 group-hover/audio:opacity-100 transition-opacity" />
                        </div>
                    )}

                    {clip.type === 'audio' && (
                        <div className="absolute top-1 left-2 text-xs font-bold text-emerald-100 drop-shadow-md truncate max-w-full pr-4 p-1 rounded bg-black/30 pointer-events-none">
                            {clip.name}
                        </div>
                    )}

                    <div className="absolute left-1 bottom-1 text-[9px] font-mono text-emerald-500/80 pointer-events-none select-none">
                        {(clip.volume ?? 1).toFixed(1)} dB {clip.volumeKeyframes?.length ? '(Auto)' : ''}
                    </div>
                </div>
            )}

            {/* Context Menu */}
            {showContextMenu && (
                <div
                    ref={contextMenuRef}
                    className="fixed z-[9999] bg-slate-800 border border-slate-600 rounded-lg shadow-2xl py-1.5 min-w-[180px] text-xs"
                    style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {isLinked && (
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-slate-700 flex items-center gap-2 text-amber-400"
                            onClick={() => {
                                unlinkClips(clip.id);
                                setShowContextMenu(false);
                            }}
                        >
                            <Unlink size={12} />
                            Sesi Ayır (Unlink)
                        </button>
                    )}
                    {!isLinked && clip.type !== 'image' && clip.type !== 'text' && (
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-slate-700 flex items-center gap-2 text-emerald-400"
                            onClick={() => {
                                // Find ANY unlinked clip of opposite type across all tracks
                                const targetType = clip.type === 'video' ? 'audio' : 'video';
                                for (const t of tracks) {
                                    const partner = t.clips.find(c =>
                                        !c.linkedClipId &&
                                        c.type === targetType
                                    );
                                    if (partner) {
                                        linkClips(clip.id, partner.id);
                                        setShowContextMenu(false);
                                        return;
                                    }
                                }
                                setShowContextMenu(false);
                            }}
                        >
                            <Link size={12} />
                            Yeniden Bağla (Link)
                        </button>
                    )}
                    <button
                        className="w-full text-left px-4 py-2 hover:bg-slate-700 flex items-center gap-2 text-slate-300"
                        onClick={() => {
                            useStore.getState().removeClip(clip.id);
                            setShowContextMenu(false);
                        }}
                    >
                        Klibi Sil
                    </button>
                </div>
            )}
        </div>
    );
};
