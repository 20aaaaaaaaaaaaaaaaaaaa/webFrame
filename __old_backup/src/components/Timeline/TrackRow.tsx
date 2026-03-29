import React from 'react';
import { Track } from '../../types';
import { ClipItem } from './ClipItem';
import { useStore } from '../../store/useStore';

interface TrackProps {
    track: Track;
    pixelsPerSecond: number;
}

export const TrackRow = ({ track, pixelsPerSecond }: TrackProps) => {
    const tracks = useStore(state => state.tracks);

    // Check if this track's clips are linked to another track (visual grouping)
    const hasLinkedClips = track.clips.some(c => !!c.linkedClipId);

    // Determine if this is an auto-created audio track (linked audio child)
    const isLinkedAudioTrack = track.type === 'audio' && hasLinkedClips;

    return (
        <div className={`flex h-20 border-b ${isLinkedAudioTrack ? 'border-amber-800/30' : 'border-slate-800'} bg-slate-900/50 group hover:bg-slate-800/30 transition-colors relative`}>
            {/* Linked group indicator — thin side bar */}
            {isLinkedAudioTrack && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/40 z-10" />
            )}

            {/* Header */}
            <div className={`w-32 ${isLinkedAudioTrack ? 'bg-slate-900/90' : 'bg-slate-900'} border-r border-slate-800 flex flex-col justify-center px-3 z-20 shrink-0`}>
                <span className={`text-xs font-semibold truncate group-hover:text-white transition-colors ${isLinkedAudioTrack ? 'text-amber-300/80' : 'text-slate-300'}`}>
                    {track.name}
                </span>
                <div className="flex gap-2 mt-1">
                    <div className={`w-3 h-3 rounded-full ${isLinkedAudioTrack ? 'bg-amber-700/50' : 'bg-slate-700'}`} />
                    <div className={`w-3 h-3 rounded-full ${isLinkedAudioTrack ? 'bg-amber-700/50' : 'bg-slate-700'}`} />
                </div>
            </div>

            {/* Track Lanes */}
            <div className="flex-1 relative">
                {track.clips.map((clip) => (
                    <ClipItem key={clip.id} clip={clip} pixelsPerSecond={pixelsPerSecond} />
                ))}
            </div>
        </div>
    );
};
