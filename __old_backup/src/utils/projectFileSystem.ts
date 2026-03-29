import { ProjectFile, ProjectSettings, AssetReference, Track, Asset } from '../types';

// ─── File System Access API Utility ─────────────────────────

// Store handles in memory (not serializable)
let fileHandle: FileSystemFileHandle | null = null;
let dirHandle: FileSystemDirectoryHandle | null = null;

export const getFileHandle = () => fileHandle;
export const getDirHandle = () => dirHandle;
export const setFileHandle = (h: FileSystemFileHandle | null) => { fileHandle = h; };
export const setDirHandle = (h: FileSystemDirectoryHandle | null) => { dirHandle = h; };

/**
 * Check if File System Access API is supported
 */
export const isFileSystemAccessSupported = (): boolean => {
    return 'showDirectoryPicker' in window && 'showSaveFilePicker' in window;
};

/**
 * Create a new project — pick a folder, create .webframe file
 */
export const createProjectOnDisk = async (
    settings: ProjectSettings,
    tracks: Track[],
    assets: Asset[],
    currentTime: number
): Promise<{ fileHandle: FileSystemFileHandle; dirHandle: FileSystemDirectoryHandle }> => {
    // Let user pick a directory
    const dir = await (window as any).showDirectoryPicker({ mode: 'readwrite' });

    // Create "media" subfolder for assets
    try {
        await dir.getDirectoryHandle('media', { create: true });
    } catch {
        // Ignore if it already exists
    }

    // Build project data
    const assetRefs: AssetReference[] = assets.map(a => ({
        id: a.id,
        type: a.type,
        name: a.name,
        fileName: a.name, // Original file name
        duration: a.duration,
    }));

    // Clean tracks for serialization (remove blob URLs from clips)
    const cleanTracks = cleanTracksForSave(tracks);

    const projectData: ProjectFile = {
        version: 1,
        settings: { ...settings, modifiedAt: new Date().toISOString() },
        tracks: cleanTracks,
        assets: assetRefs,
        currentTime,
    };

    // Write .webframe file
    const fileName = `${sanitizeFileName(settings.name)}.webframe`;
    const file = await dir.getFileHandle(fileName, { create: true });
    const writable = await file.createWritable();
    await writable.write(JSON.stringify(projectData, null, 2));
    await writable.close();

    // Store handles
    fileHandle = file;
    dirHandle = dir;

    return { fileHandle: file, dirHandle: dir };
};

/**
 * Save current project to existing file handle
 */
export const saveProject = async (
    settings: ProjectSettings,
    tracks: Track[],
    assets: Asset[],
    currentTime: number
): Promise<boolean> => {
    if (!fileHandle) return false;

    try {
        const assetRefs: AssetReference[] = assets.map(a => ({
            id: a.id,
            type: a.type,
            name: a.name,
            fileName: a.name,
            duration: a.duration,
        }));

        const cleanTracks = cleanTracksForSave(tracks);

        const projectData: ProjectFile = {
            version: 1,
            settings: { ...settings, modifiedAt: new Date().toISOString() },
            tracks: cleanTracks,
            assets: assetRefs,
            currentTime,
        };

        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(projectData, null, 2));
        await writable.close();
        return true;
    } catch (err) {
        console.error('Save failed:', err);
        return false;
    }
};

/**
 * Save As — pick new location
 */
export const saveProjectAs = async (
    settings: ProjectSettings,
    tracks: Track[],
    assets: Asset[],
    currentTime: number
): Promise<{ fileHandle: FileSystemFileHandle; dirHandle: FileSystemDirectoryHandle } | null> => {
    try {
        const result = await createProjectOnDisk(settings, tracks, assets, currentTime);
        return result;
    } catch {
        return null;
    }
};

/**
 * Open an existing .webframe project
 */
export const openProjectFromDisk = async (): Promise<{
    projectData: ProjectFile;
    fileHandle: FileSystemFileHandle;
    dirHandle: FileSystemDirectoryHandle;
    mediaFiles: Map<string, File>;
} | null> => {
    try {
        // Pick directory (project folder)
        const dir = await (window as any).showDirectoryPicker({ mode: 'readwrite' });

        // Find .webframe file
        let projectFile: FileSystemFileHandle | null = null;
        for await (const entry of dir.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.webframe')) {
                projectFile = entry as FileSystemFileHandle;
                break;
            }
        }

        if (!projectFile) {
            alert('Bu klasörde .webframe proje dosyası bulunamadı.');
            return null;
        }

        // Read project data
        const file = await projectFile.getFile();
        const text = await file.text();
        const projectData: ProjectFile = JSON.parse(text);

        // Read media files from /media subfolder
        const mediaFiles = new Map<string, File>();
        try {
            const mediaDir = await dir.getDirectoryHandle('media');
            for await (const entry of mediaDir.values()) {
                if (entry.kind === 'file') {
                    const mediaFile = await (entry as FileSystemFileHandle).getFile();
                    mediaFiles.set(entry.name, mediaFile);
                }
            }
        } catch {
            // No media folder — ok, media might be in root or user needs to re-import
        }

        // Store handles
        fileHandle = projectFile;
        dirHandle = dir;

        return { projectData, fileHandle: projectFile, dirHandle: dir, mediaFiles };
    } catch (err) {
        console.error('Open failed:', err);
        return null;
    }
};

/**
 * Copy a media file into the project's /media folder
 */
export const copyMediaToProject = async (file: File): Promise<string | null> => {
    if (!dirHandle) return null;

    try {
        const mediaDir = await dirHandle.getDirectoryHandle('media', { create: true });
        const newFile = await mediaDir.getFileHandle(file.name, { create: true });
        const writable = await newFile.createWritable();
        await writable.write(file);
        await writable.close();
        return file.name;
    } catch (err) {
        console.error('Failed to copy media:', err);
        return null;
    }
};

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Clean tracks for serialization — remove Blob URLs (they are transient)
 */
const cleanTracksForSave = (tracks: Track[]): Track[] => {
    return tracks.map(track => ({
        ...track,
        clips: track.clips.map(clip => ({
            ...clip,
            src: '', // Blob URLs are not persistable; cleared on save, restored on load
            waveform: undefined, // Waveform can be regenerated
        })),
    }));
};

/**
 * Sanitize a file name
 */
const sanitizeFileName = (name: string): string => {
    return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'Untitled';
};
