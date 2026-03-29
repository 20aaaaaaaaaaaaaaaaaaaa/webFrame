import { create } from 'zustand';
import { Clip, Track, Asset, ProjectSettings } from '../types';

interface InternalState {
    tracks: Track[];
    currentTime: number; // in seconds
    isPlaying: boolean;
    playbackSpeed: number; // 1.0 = normal, negative = reverse
    maxDuration: number;

    selectedClipIds: string[];

    canvasSize: { width: number; height: number };
    pixelsPerSecond: number; // Zoom level

    // Project
    projectSettings: ProjectSettings | null;
    hasProject: boolean;
    isProjectDirty: boolean;
    lastSavedAt: Date | null;
    isSaving: boolean;
}

interface Actions {
    addTrack: (track: Track) => void;
    addClip: (clip: Clip) => void;
    updateClip: (clipId: string, updates: Partial<Clip>) => void;
    updateClipSilent: (clipId: string, updates: Partial<Clip>) => void; // No history save
    removeClip: (clipId: string) => void;
    splitClip: () => void;
    unlinkClips: (clipId: string) => void;
    linkClips: (clipId1: string, clipId2: string) => void;
    addKeyframe: (clipId: string, time: number, value: number) => void;
    removeKeyframe: (clipId: string, index: number) => void;
    updateKeyframe: (clipId: string, index: number, updates: { time?: number, value?: number }) => void;

    setTracks: (tracks: Track[]) => void;

    setCurrentTime: (time: number) => void;
    setIsPlaying: (isPlaying: boolean) => void;
    setPlaybackSpeed: (speed: number) => void;
    setZoom: (zoom: number) => void;
    setCanvasSize: (size: { width: number, height: number }) => void;

    setSelectedClipIds: (ids: string[]) => void;

    // Assets
    assets: Asset[];
    addAsset: (asset: Asset) => void;
    removeAsset: (assetId: string) => void;

    // In/Out Points
    inPoint: number | null;
    outPoint: number | null;
    setInPoint: (time: number | null) => void;
    setOutPoint: (time: number | null) => void;
    clearInOut: () => void;

    // History
    past: { tracks: Track[], assets: Asset[] }[];
    future: { tracks: Track[], assets: Asset[] }[];
    undo: () => void;
    redo: () => void;
    saveHistory: () => void;

    // Project
    setProjectSettings: (settings: ProjectSettings | null) => void;
    markDirty: () => void;
    markSaved: () => void;
    setIsSaving: (saving: boolean) => void;
    loadProject: (settings: ProjectSettings, tracks: Track[], assets: Asset[], currentTime: number) => void;
    resetProject: () => void;
}

const resolveOverlaps = (clips: Clip[], primeClipId: string): Clip[] => {
    const prime = clips.find(c => c.id === primeClipId);
    if (!prime) return clips;

    const primeEnd = prime.start + prime.duration;
    let finalClips: Clip[] = [prime];

    clips.forEach(clip => {
        if (clip.id === primeClipId) return;

        const clipEnd = clip.start + clip.duration;

        // 1. Clip is entirely covered by prime
        if (clip.start >= prime.start && clipEnd <= primeEnd) {
            return; // Discard it
        }

        // 2. Prime is entirely within clip (requires split)
        if (prime.start > clip.start && primeEnd < clipEnd) {
            const leftPart = { ...clip, duration: prime.start - clip.start };
            const rightPart = {
                ...clip,
                id: crypto.randomUUID(),
                start: primeEnd,
                duration: clipEnd - primeEnd,
                offset: clip.offset + (primeEnd - clip.start)
            };
            finalClips.push(leftPart, rightPart);
            return;
        }

        // 3. Prime overlaps start of clip
        if (prime.start <= clip.start && primeEnd > clip.start && primeEnd < clipEnd) {
            const diff = primeEnd - clip.start;
            finalClips.push({
                ...clip,
                start: primeEnd,
                duration: clip.duration - diff,
                offset: clip.offset + diff
            });
            return;
        }

        // 4. Prime overlaps end of clip
        if (prime.start > clip.start && prime.start < clipEnd && primeEnd >= clipEnd) {
            finalClips.push({
                ...clip,
                duration: prime.start - clip.start
            });
            return;
        }

        // 5. No overlap
        finalClips.push(clip);
    });

    return finalClips;
};

export const useStore = create<InternalState & Actions>((set, get) => ({
    tracks: [],
    currentTime: 0,
    isPlaying: false,
    playbackSpeed: 1.0, // 1.0 = normal speed
    maxDuration: 300, // Defaut 5 mins
    selectedClipIds: [],
    canvasSize: { width: 1920, height: 1080 },
    pixelsPerSecond: 20, // Default zoom

    // Project defaults
    projectSettings: null,
    hasProject: false,
    isProjectDirty: false,
    lastSavedAt: null,
    isSaving: false,

    inPoint: null,
    outPoint: null,

    past: [],
    future: [],

    saveHistory: () => {
        set((state) => {
            const newPast = [...state.past, { tracks: state.tracks, assets: state.assets }];
            // Limit history size to 50
            if (newPast.length > 50) newPast.shift();
            return { past: newPast, future: [] };
        });
    },

    undo: () => set((state) => {
        if (state.past.length === 0) return state;
        const previous = state.past[state.past.length - 1];
        const newPast = state.past.slice(0, -1);
        return {
            past: newPast,
            future: [{ tracks: state.tracks, assets: state.assets }, ...state.future],
            tracks: previous.tracks,
            assets: previous.assets,
            // Re-select nothing or handle selection? Let's clear selection to avoid issues
            selectedClipIds: []
        };
    }),

    redo: () => set((state) => {
        if (state.future.length === 0) return state;
        const next = state.future[0];
        const newFuture = state.future.slice(1);
        return {
            past: [...state.past, { tracks: state.tracks, assets: state.assets }],
            future: newFuture,
            tracks: next.tracks,
            assets: next.assets,
            selectedClipIds: []
        };
    }),

    setZoom: (zoom) => set({ pixelsPerSecond: zoom }),
    setCanvasSize: (size) => set({ canvasSize: size }),

    addTrack: (track) => {
        get().saveHistory();
        set((state) => ({ tracks: [...state.tracks, track] }));
    },

    addClip: (clip) => {
        get().saveHistory();
        set((state) => {
            const trackIndex = state.tracks.findIndex((t) => t.id === clip.trackId);
            if (trackIndex === -1) return state;

            const targetTrack = state.tracks[trackIndex];

            // VALIDATION: Track Type Constraints
            if (clip.type === 'audio' && targetTrack.type !== 'audio') return state;
            if (clip.type !== 'audio' && targetTrack.type === 'audio') return state;

            let newTracks = [...state.tracks];

            // If this is a video clip, auto-create a linked audio clip + track
            if (clip.type === 'video') {
                const audioClipId = crypto.randomUUID();
                const audioTrackId = `track-audio-${Date.now()}`;

                // Link video -> audio — video is purely visual (volume: 0)
                const linkedVideoClip = { ...clip, linkedClipId: audioClipId, volume: 0 };

                // Create audio clip
                const audioClip: Clip = {
                    ...clip,
                    id: audioClipId,
                    type: 'audio',
                    name: `${clip.name} (Audio)`,
                    trackId: audioTrackId,
                    linkedClipId: clip.id,
                    volume: clip.volume ?? 1,
                    zIndex: 0,
                    position: { x: 0, y: 0 },
                    scale: 1,
                    rotation: 0,
                    opacity: 1,
                };

                // Create audio track
                const audioTrack: Track = {
                    id: audioTrackId,
                    name: `🔊 ${clip.name}`,
                    type: 'audio',
                    visible: true,
                    muted: false,
                    clips: [audioClip]
                };

                // Add video clip to its track and RESOLVE OVERLAPS
                newTracks[trackIndex] = {
                    ...targetTrack,
                    clips: resolveOverlaps([...targetTrack.clips, linkedVideoClip], clip.id),
                };

                // Insert audio track right below the video track
                newTracks.splice(trackIndex + 1, 0, audioTrack);

                return { tracks: newTracks, selectedClipIds: [clip.id] };
            }

            // Non-video clips: add normally and RESOLVE OVERLAPS
            newTracks[trackIndex] = {
                ...targetTrack,
                clips: resolveOverlaps([...targetTrack.clips, clip], clip.id),
            };
            return { tracks: newTracks, selectedClipIds: [clip.id] };
        });
    },

    updateClip: (clipId, updates) => {
        // Silent updates (like waveform/volume) don't need history or overlap resolution
        if (Object.keys(updates).length === 1 && (updates.waveform || updates.volume !== undefined)) {
            set((state) => ({
                tracks: state.tracks.map(t => ({
                    ...t,
                    clips: t.clips.map(c => c.id === clipId ? { ...c, ...updates } : c)
                }))
            }));
            return;
        }

        get().saveHistory();
        set((state) => {
            // Find the clip being updated
            let movingClip: Clip | undefined;
            for (const t of state.tracks) {
                movingClip = t.clips.find(c => c.id === clipId);
                if (movingClip) break;
            }
            if (!movingClip) return state;

            const updatedClip = { ...movingClip, ...updates };
            let newTracks = [...state.tracks];

            // If trackId is changing, we need to move the clip
            if (updates.trackId && updates.trackId !== movingClip.trackId) {
                const sourceTrackIndex = state.tracks.findIndex(t => t.id === movingClip!.trackId);
                const targetTrackIndex = state.tracks.findIndex(t => t.id === updates.trackId);

                if (sourceTrackIndex === -1 || targetTrackIndex === -1) return state;
                
                const targetTrack = state.tracks[targetTrackIndex];

                // VALIDATION: Track Type Constraints
                if (updatedClip.type === 'audio' && targetTrack.type !== 'audio') return state;
                if (updatedClip.type !== 'audio' && targetTrack.type === 'audio') return state;

                // Remove from source
                newTracks[sourceTrackIndex] = {
                    ...state.tracks[sourceTrackIndex],
                    clips: state.tracks[sourceTrackIndex].clips.filter(c => c.id !== clipId)
                };

                // Add to target and RESOLVE OVERLAPS
                newTracks[targetTrackIndex] = {
                    ...targetTrack,
                    clips: resolveOverlaps([...targetTrack.clips, updatedClip], clipId)
                };
            } 
            else {
                // Same track update (start/duration change)
                const trackIndex = state.tracks.findIndex(t => t.clips.some(c => c.id === clipId));
                if (trackIndex !== -1) {
                    const track = state.tracks[trackIndex];
                    newTracks[trackIndex] = {
                        ...track,
                        clips: resolveOverlaps(
                            track.clips.map(c => c.id === clipId ? updatedClip : c),
                            clipId
                        )
                    };
                }
            }

            // Sync linked clip's start time using DELTA and RESOLVE ITS OVERLAPS TOO
            if (updates.start !== undefined && movingClip.linkedClipId) {
                const linkedId = movingClip.linkedClipId;
                const delta = updates.start - movingClip.start;
                
                // Find linked clip and its track
                let linkedClip: Clip | undefined;
                let linkedTrackIndex = -1;
                for (let i = 0; i < newTracks.length; i++) {
                    linkedClip = newTracks[i].clips.find(c => c.id === linkedId);
                    if (linkedClip) { linkedTrackIndex = i; break; }
                }

                if (linkedClip && linkedTrackIndex !== -1) {
                    const updatedLinkedClip = { ...linkedClip, start: Math.max(0, linkedClip.start + delta) };
                    const linkedTrack = newTracks[linkedTrackIndex];
                    newTracks[linkedTrackIndex] = {
                        ...linkedTrack,
                        clips: resolveOverlaps(
                            linkedTrack.clips.map(c => c.id === linkedId ? updatedLinkedClip : c),
                            linkedId
                        )
                    };
                }
            }

            return { tracks: newTracks };
        })
    },

    removeClip: (clipId) => {
        get().saveHistory();
        set((state) => {
            // Find the clip to check for linked partner
            let linkedId: string | undefined;
            for (const t of state.tracks) {
                const clip = t.clips.find(c => c.id === clipId);
                if (clip) { linkedId = clip.linkedClipId; break; }
            }

            let newTracks = state.tracks.map((track) => ({
                ...track,
                clips: track.clips.filter((clip) => clip.id !== clipId),
            }));

            // Clear linkedClipId on the partner clip
            if (linkedId) {
                newTracks = newTracks.map((track) => ({
                    ...track,
                    clips: track.clips.map((clip) =>
                        clip.id === linkedId ? { ...clip, linkedClipId: undefined } : clip
                    ),
                }));
            }

            return { tracks: newTracks, selectedClipIds: state.selectedClipIds.filter(id => id !== clipId) };
        });
    },

    splitClip: () => {
        get().saveHistory();
        set((state) => {
            const { selectedClipIds, currentTime, tracks } = state;
            if (selectedClipIds.length === 0) return state;

            // Split ALL selected clips at playhead
            let newTracks = [...tracks];
            let newSelection: string[] = [];

            selectedClipIds.forEach(targetId => {
                let trackIndex = -1;
                let targetClip: Clip | undefined;

                for (let i = 0; i < newTracks.length; i++) {
                    const clip = newTracks[i].clips.find(c => c.id === targetId);
                    if (clip) {
                        trackIndex = i;
                        targetClip = clip;
                        break;
                    }
                }

                if (!targetClip || trackIndex === -1) return; // Continue

                // Check playhead
                if (currentTime <= targetClip.start || currentTime >= targetClip.start + targetClip.duration) {
                    newSelection.push(targetId); // Keep selected even if not split
                    return;
                }

                const splitPoint = currentTime - targetClip.start;
                const newDuration1 = splitPoint;
                const newDuration2 = targetClip.duration - splitPoint;

                const newId2 = crypto.randomUUID();
                const clip1 = { ...targetClip, duration: newDuration1 };
                const clip2 = {
                    ...targetClip,
                    id: newId2,
                    start: currentTime,
                    duration: newDuration2,
                    offset: targetClip.offset + splitPoint
                };

                // If this clip has a linked partner, split that too
                if (targetClip.linkedClipId) {
                    const linkedId = targetClip.linkedClipId;
                    let linkedTrackIndex = -1;
                    let linkedClip: Clip | undefined;

                    for (let li = 0; li < newTracks.length; li++) {
                        const lc = newTracks[li].clips.find(c => c.id === linkedId);
                        if (lc) { linkedTrackIndex = li; linkedClip = lc; break; }
                    }

                    if (linkedClip && linkedTrackIndex !== -1) {
                        const linkedNewId2 = crypto.randomUUID();

                        // Update linked references
                        clip1.linkedClipId = linkedId; // clip1 stays linked to original linked clip part 1
                        clip2.linkedClipId = linkedNewId2; // clip2 links to new linked clip part 2

                        const linkedClip1 = { ...linkedClip, duration: newDuration1, linkedClipId: targetId };
                        const linkedClip2 = {
                            ...linkedClip,
                            id: linkedNewId2,
                            start: currentTime,
                            duration: newDuration2,
                            offset: linkedClip.offset + splitPoint,
                            linkedClipId: newId2
                        };

                        newTracks[linkedTrackIndex] = {
                            ...newTracks[linkedTrackIndex],
                            clips: newTracks[linkedTrackIndex].clips
                                .filter(c => c.id !== linkedId)
                                .concat([linkedClip1, linkedClip2])
                        };
                    }
                }

                newTracks[trackIndex] = {
                    ...newTracks[trackIndex],
                    clips: newTracks[trackIndex].clips
                        .filter(c => c.id !== targetId)
                        .concat([clip1, clip2])
                };

                newSelection.push(clip2.id); // Select the second part
            });

            return { tracks: newTracks, selectedClipIds: newSelection };
        });
    },

    unlinkClips: (clipId) => {
        get().saveHistory();
        set((state) => {
            // Find the clip
            let targetClip: Clip | undefined;
            for (const t of state.tracks) {
                targetClip = t.clips.find(c => c.id === clipId);
                if (targetClip) break;
            }

            if (!targetClip?.linkedClipId) return state;
            const linkedId = targetClip.linkedClipId;

            // Determine which is video and which is audio
            const newTracks = state.tracks.map(track => ({
                ...track,
                clips: track.clips.map(clip => {
                    if (clip.id === clipId || clip.id === linkedId) {
                        const updates: Partial<Clip> = { linkedClipId: undefined };
                        // Mute the video clip — audio stays on the audio clip
                        if (clip.type === 'video') {
                            updates.volume = 0;
                        }
                        return { ...clip, ...updates };
                    }
                    return clip;
                })
            }));

            return { tracks: newTracks };
        });
    },

    linkClips: (clipId1, clipId2) => {
        get().saveHistory();
        set((state) => {
            // Find both clips
            let clip1: Clip | undefined;
            let clip2: Clip | undefined;
            for (const t of state.tracks) {
                if (!clip1) clip1 = t.clips.find(c => c.id === clipId1);
                if (!clip2) clip2 = t.clips.find(c => c.id === clipId2);
                if (clip1 && clip2) break;
            }
            if (!clip1 || !clip2) return state;

            // Link them and mute whichever is the video clip
            const newTracks = state.tracks.map(track => ({
                ...track,
                clips: track.clips.map(clip => {
                    if (clip.id === clipId1) {
                        return { ...clip, linkedClipId: clipId2, volume: clip.type === 'video' ? 0 : clip.volume };
                    }
                    if (clip.id === clipId2) {
                        return { ...clip, linkedClipId: clipId1, volume: clip.type === 'video' ? 0 : clip.volume };
                    }
                    return clip;
                })
            }));

            return { tracks: newTracks };
        });
    },

    // Silent update — no history save (for cosmetic updates like waveform)
    updateClipSilent: (clipId, updates) => {
        set((state) => {
            const newTracks = state.tracks.map((track) => ({
                ...track,
                clips: track.clips.map((clip) =>
                    clip.id === clipId ? { ...clip, ...updates } : clip
                ),
            }));
            return { tracks: newTracks };
        });
    },

    setTracks: (tracks) => {
        get().saveHistory();
        set({ tracks });
    },

    setCurrentTime: (time) => set({ currentTime: time }),
    setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
    setIsPlaying: (isPlaying) => set({ isPlaying }),

    addKeyframe: (clipId: string, time: number, value: number) => {
        get().saveHistory();
        set((state) => {
            const newTracks = state.tracks.map(track => ({
                ...track,
                clips: track.clips.map(clip => {
                    if (clip.id === clipId) {
                        const keyframes = clip.volumeKeyframes ? [...clip.volumeKeyframes] : [];
                        const existing = keyframes.find(k => Math.abs(k.time - time) < 0.1);
                        if (existing) {
                            existing.value = value;
                        } else {
                            keyframes.push({ time, value });
                        }
                        keyframes.sort((a, b) => a.time - b.time);
                        return { ...clip, volumeKeyframes: keyframes };
                    }
                    return clip;
                })
            }));
            return { tracks: newTracks };
        });
    },

    removeKeyframe: (clipId: string, index: number) => {
        get().saveHistory();
        set((state) => {
            const newTracks = state.tracks.map(track => ({
                ...track,
                clips: track.clips.map(clip => {
                    if (clip.id === clipId && clip.volumeKeyframes) {
                        const keyframes = [...clip.volumeKeyframes];
                        keyframes.splice(index, 1);
                        return { ...clip, volumeKeyframes: keyframes };
                    }
                    return clip;
                })
            }));
            return { tracks: newTracks };
        });
    },

    updateKeyframe: (clipId, index, updates) => {
        get().saveHistory();
        set((state) => {
            const newTracks = state.tracks.map(track => ({
                ...track,
                clips: track.clips.map(clip => {
                    if (clip.id === clipId && clip.volumeKeyframes) {
                        const keyframes = [...clip.volumeKeyframes];
                        if (keyframes[index]) {
                            keyframes[index] = { ...keyframes[index], ...updates };
                        }
                        keyframes.sort((a, b) => a.time - b.time);
                        return { ...clip, volumeKeyframes: keyframes };
                    }
                    return clip;
                })
            }));
            return { tracks: newTracks };
        });
    },

    setSelectedClipIds: (ids) => set({ selectedClipIds: ids }),

    // Assets
    assets: [],
    addAsset: (asset) => {
        get().saveHistory();
        set((state) => ({ assets: [...state.assets, asset] }));
    },
    removeAsset: (assetId) => {
        get().saveHistory();
        set((state) => ({ assets: state.assets.filter(a => a.id !== assetId) }));
    },

    // In/Out Points
    setInPoint: (time) => set({ inPoint: time }),
    setOutPoint: (time) => set({ outPoint: time }),
    clearInOut: () => set({ inPoint: null, outPoint: null }),

    // ─── Project Actions ─────────────────────────────────────
    setProjectSettings: (settings) => set({
        projectSettings: settings,
        hasProject: settings !== null,
        canvasSize: settings ? settings.resolution : { width: 1920, height: 1080 },
        maxDuration: settings ? settings.maxDuration : 300,
    }),

    markDirty: () => set({ isProjectDirty: true }),
    markSaved: () => set({ isProjectDirty: false, lastSavedAt: new Date() }),
    setIsSaving: (saving) => set({ isSaving: saving }),

    loadProject: (settings, tracks, assets, currentTime) => set({
        projectSettings: settings,
        hasProject: true,
        tracks,
        assets,
        currentTime,
        canvasSize: settings.resolution,
        maxDuration: settings.maxDuration,
        isProjectDirty: false,
        lastSavedAt: new Date(),
        selectedClipIds: [],
        past: [],
        future: [],
    }),

    resetProject: () => set({
        projectSettings: null,
        hasProject: false,
        tracks: [],
        assets: [],
        currentTime: 0,
        isProjectDirty: false,
        lastSavedAt: null,
        selectedClipIds: [],
        past: [],
        future: [],
        canvasSize: { width: 1920, height: 1080 },
    }),
}));
