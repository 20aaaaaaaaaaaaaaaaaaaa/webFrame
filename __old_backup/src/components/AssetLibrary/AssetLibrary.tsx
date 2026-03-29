import React from 'react';
import { useStore } from '../../store/useStore';
import { Trash2, Plus, Film, Image as ImageIcon, Music, Type, FolderPlus, FolderOpen, Save } from 'lucide-react';
import { Asset } from '../../types';
import { copyMediaToProject, getDirHandle, saveProject } from '../../utils/projectFileSystem';

interface AssetLibraryProps {
    onNewProject?: () => void;
    onOpenProject?: () => void;
}

export const AssetLibrary: React.FC<AssetLibraryProps> = ({ onNewProject, onOpenProject }) => {
    const { assets, removeAsset, addClip, tracks, addTrack, addAsset, hasProject, markDirty, projectSettings, isProjectDirty, isSaving, lastSavedAt, markSaved, setIsSaving, currentTime } = useStore();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleImportClick = () => {
        if (!hasProject) return;
        fileInputRef.current?.click();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const fileArray = Array.from(files);
        for (const file of fileArray) {
            if (getDirHandle()) {
                await copyMediaToProject(file);
            }

            const url = URL.createObjectURL(file);
            const type = file.type.startsWith('video') ? 'video'
                : file.type.startsWith('audio') ? 'audio'
                    : 'image';

            const duration = await import('../../utils/media').then(m => m.getMediaDuration(url, type as any));

            addAsset({
                id: crypto.randomUUID(),
                type: type,
                src: url,
                name: file.name,
                duration: duration || 5
            });

            markDirty();
        }
        e.target.value = '';
    };

    const handleDragStart = (e: React.DragEvent, asset: Asset) => {
        e.dataTransfer.setData('application/json', JSON.stringify(asset));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'video': return <Film size={16} />;
            case 'image': return <ImageIcon size={16} />;
            case 'audio': return <Music size={16} />;
            case 'text': return <Type size={16} />;
            default: return <Film size={16} />;
        }
    };

    const handleAddToTimeline = (asset: Asset) => {
        let trackId = tracks.find(t => t.type === asset.type && !t.muted)?.id;
        if (!trackId) {
            trackId = `track-${Date.now()}`;
            addTrack({
                id: trackId,
                name: `${asset.type.toUpperCase()} Track`,
                type: asset.type,
                visible: true,
                muted: false,
                clips: []
            });
        }
        addClip({
            id: crypto.randomUUID(),
            trackId: trackId,
            type: asset.type,
            src: asset.src,
            name: asset.name,
            start: 0,
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
    };

    const handleSave = async () => {
        if (!hasProject || !projectSettings) return;
        setIsSaving(true);
        const success = await saveProject(projectSettings, tracks, assets, currentTime);
        if (success) markSaved();
        setIsSaving(false);
    };

    const formatSavedTime = (date: Date | null) => {
        if (!date) return '';
        return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatDuration = (seconds: number) => {
        if (seconds >= 3600) return `${Math.floor(seconds / 3600)}sa ${Math.floor((seconds % 3600) / 60)}dk`;
        return `${Math.floor(seconds / 60)} dk`;
    };

    return (
        <div className="w-[280px] bg-[#0a0a0a] border-r border-neutral-800 flex flex-col h-full">
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="video/*,image/*,audio/*,.mp4,.mov,.webm,.mkv,.avi,.wmv,.flv,.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.mp3,.wav,.aac,.ogg,.m4a"
                onChange={handleFileUpload}
            />

            {/* Header */}
            <div className="px-4 py-3 border-b border-neutral-800 flex justify-between items-center text-white">
                <span className="font-medium text-sm">Media Pool</span>
                {hasProject && <span className="text-xs text-neutral-500">{assets.length} items</span>}
            </div>

            {/* No Project State */}
            {!hasProject ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                        <FolderPlus size={28} className="text-neutral-600" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium text-neutral-400 mb-1">Proje Gerekli</p>
                        <p className="text-[11px] text-neutral-600 leading-relaxed">
                            Medya dosyalarını ekleyebilmek için önce bir proje oluşturun veya mevcut bir projeyi açın.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 w-full">
                        <button
                            onClick={onNewProject}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all"
                        >
                            <Plus size={14} />
                            Yeni Proje Oluştur
                        </button>
                        <button
                            onClick={onOpenProject}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium transition-all"
                        >
                            <FolderOpen size={14} />
                            Proje Aç
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* ── Project Card ── */}
                    <div className="mx-2 mt-2 mb-1">
                        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3 relative group">
                            {/* Status Dot */}
                            <div className="absolute top-3 right-3 flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{
                                    backgroundColor: isSaving ? '#f59e0b' : isProjectDirty ? '#ef4444' : '#22c55e',
                                }} />
                            </div>

                            {/* Project Name */}
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
                                    <Film size={14} className="text-indigo-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-white truncate">{projectSettings?.name || 'Untitled'}</p>
                                    <p className="text-[10px] text-neutral-500">
                                        {isSaving ? 'Kaydediliyor...' :
                                            isProjectDirty ? 'Değişiklikler kaydedilmedi' :
                                                lastSavedAt ? `Kayıt: ${formatSavedTime(lastSavedAt)}` : 'Kaydedildi'}
                                    </p>
                                </div>
                            </div>

                            {/* Details */}
                            <div className="flex items-center gap-2 text-[10px] text-neutral-500 flex-wrap">
                                <span className="bg-neutral-800 px-1.5 py-0.5 rounded">{projectSettings?.resolution.width}×{projectSettings?.resolution.height}</span>
                                <span className="bg-neutral-800 px-1.5 py-0.5 rounded">{projectSettings?.frameRate}fps</span>
                                <span className="bg-neutral-800 px-1.5 py-0.5 rounded">{projectSettings?.aspectRatio}</span>
                                {projectSettings?.maxDuration && (
                                    <span className="bg-neutral-800 px-1.5 py-0.5 rounded">{formatDuration(projectSettings.maxDuration)}</span>
                                )}
                            </div>

                            {/* Actions Row */}
                            <div className="flex items-center gap-1.5 mt-2">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || !isProjectDirty}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all disabled:opacity-30"
                                    title="Kaydet (Ctrl+S)"
                                >
                                    <Save size={10} />
                                    Kaydet
                                </button>
                                <button
                                    onClick={onNewProject}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all"
                                    title="Yeni Proje"
                                >
                                    <FolderPlus size={10} />
                                    Yeni
                                </button>
                                <button
                                    onClick={onOpenProject}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all"
                                    title="Proje Aç"
                                >
                                    <FolderOpen size={10} />
                                    Aç
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── Asset Grid ── */}
                    <div
                        className="flex-1 overflow-y-auto p-2"
                        onDoubleClick={(e) => {
                            if (e.target === e.currentTarget) {
                                handleImportClick();
                            }
                        }}
                    >
                        <div className="grid grid-cols-2 gap-2 pointer-events-none">
                            {assets.map((asset) => (
                                <div
                                    key={asset.id}
                                    className="aspect-square bg-neutral-900 rounded border border-neutral-800 hover:border-indigo-500/50 group relative cursor-grab active:cursor-grabbing overflow-hidden pointer-events-auto"
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, asset)}
                                    onDoubleClick={(e) => { e.stopPropagation(); handleAddToTimeline(asset); }}
                                >
                                    {asset.type === 'image' || asset.type === 'video' ? (
                                        <img src={asset.src} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" draggable={false} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-neutral-600">
                                            {getIcon(asset.type)}
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-2 py-1">
                                        <p className="text-[10px] text-neutral-300 truncate">{asset.name}</p>
                                    </div>
                                    <div className="absolute top-1 left-1 text-white/50 bg-black/50 rounded p-0.5">
                                        {getIcon(asset.type)}
                                    </div>
                                    <button
                                        className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500/80 rounded opacity-0 group-hover:opacity-100 transition-all text-white"
                                        onClick={(e) => { e.stopPropagation(); removeAsset(asset.id); }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}

                            {assets.length === 0 && (
                                <div className="col-span-2 py-8 text-center pointer-events-none">
                                    <p className="text-xs text-neutral-600 mb-2">No media imported</p>
                                    <p className="text-[10px] text-neutral-700">Double-click blank space to Import</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-2 border-t border-neutral-800">
                        <div className="text-[10px] text-neutral-600 text-center">
                            Double-click to add to timeline
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
