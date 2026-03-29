export type MediaType = 'video' | 'image' | 'audio' | 'text';

export interface Clip {
    id: string;
    trackId: string;
    type: MediaType;
    src: string; // Blob URL
    name: string;

    // Timeline Positioning
    start: number; // Start time on timeline (seconds)
    duration: number; // Duration on timeline (seconds)
    offset: number; // Start time within the source media (trimming)

    // Visual Transformations
    position: { x: number; y: number };
    positionKeyframes?: {
        time: number; // relative to clip start
        x: number;
        y: number;
        ease?: 'linear' | 'ease-in-out'; // Future proofing
    }[];
    scale: number;
    rotation: number;
    opacity: number;
    zIndex: number;

    // Audio specific
    volume: number;
    volumeKeyframes?: { time: number; value: number }[]; // time relative to clip start (0 to duration)

    // Waveform Data (Normalized peaks 0-1)
    waveform?: number[];

    // Linked clip (video-audio pair)
    linkedClipId?: string;
}

export interface Track {
    id: string;
    type: MediaType; // Primary type, though tracks might be mixed in some designs, we keep strict for now
    name: string;
    visible: boolean;
    muted: boolean;
    clips: Clip[];
}

export interface Size {
    width: number;
    height: number;
}

export interface Asset {
    id: string;
    type: MediaType;
    src: string;
    name: string;
    duration?: number; // Video/Audio duration (if known)
    waveform?: number[]; // Audio waveform cache
}

// ─── Project System ─────────────────────────────────────────

export interface ProjectSettings {
    name: string;
    resolution: { width: number; height: number };
    frameRate: number;
    maxDuration: number;  // Timeline max duration in seconds
    aspectRatio: string; // Display label: "16:9", "9:16", etc.
    createdAt: string;   // ISO string
    modifiedAt: string;  // ISO string
}

export interface AssetReference {
    id: string;
    type: MediaType;
    name: string;      // Display name
    fileName: string;   // File name inside the project media folder
    duration?: number;
}

export interface ProjectFile {
    version: 1;
    settings: ProjectSettings;
    tracks: Track[];
    assets: AssetReference[];
    currentTime: number;
}

export interface ResolutionPreset {
    id: string;
    name: string;
    category: string;
    width: number;
    height: number;
    frameRate: number;
    aspectRatio: string;
    icon: string; // Emoji icon for visual
    description: string;
}

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
    // YouTube / Widescreen
    { id: 'yt-1080', name: '1080p Full HD', category: 'YouTube / Widescreen', width: 1920, height: 1080, frameRate: 30, aspectRatio: '16:9', icon: '🖥️', description: 'YouTube, Streaming standart' },
    { id: 'yt-4k', name: '4K Ultra HD', category: 'YouTube / Widescreen', width: 3840, height: 2160, frameRate: 30, aspectRatio: '16:9', icon: '✨', description: 'Ultra yüksek çözünürlük' },
    { id: 'yt-720', name: '720p HD', category: 'YouTube / Widescreen', width: 1280, height: 720, frameRate: 30, aspectRatio: '16:9', icon: '📺', description: 'Hafif, hızlı yükleme' },

    // Social Media (Vertical)
    { id: 'tiktok', name: 'TikTok / Reels', category: 'Sosyal Medya (Dikey)', width: 1080, height: 1920, frameRate: 30, aspectRatio: '9:16', icon: '📱', description: 'TikTok, Instagram Reels, Shorts' },
    { id: 'stories', name: 'Stories', category: 'Sosyal Medya (Dikey)', width: 1080, height: 1920, frameRate: 30, aspectRatio: '9:16', icon: '📲', description: 'Instagram & WhatsApp Stories' },

    // Social Media (Square)
    { id: 'ig-square', name: 'Instagram Post', category: 'Sosyal Medya (Kare)', width: 1080, height: 1080, frameRate: 30, aspectRatio: '1:1', icon: '⬜', description: 'Instagram feed, kare format' },

    // Cinematic
    { id: 'cinema-2k', name: 'Cinema 2K', category: 'Sinematik', width: 2048, height: 1080, frameRate: 24, aspectRatio: '1.90:1', icon: '🎬', description: 'Sinema standardı 2K' },
    { id: 'cinema-4k', name: 'Cinema 4K', category: 'Sinematik', width: 4096, height: 2160, frameRate: 24, aspectRatio: '1.90:1', icon: '🎞️', description: 'Sinema standardı 4K' },
];

export const FRAME_RATE_OPTIONS = [24, 25, 30, 50, 60];
