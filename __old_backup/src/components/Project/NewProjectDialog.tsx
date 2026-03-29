import React, { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { RESOLUTION_PRESETS, FRAME_RATE_OPTIONS, ProjectSettings, ResolutionPreset } from '../../types';
import { createProjectOnDisk, openProjectFromDisk, isFileSystemAccessSupported } from '../../utils/projectFileSystem';
import { X, FolderOpen, Plus, Monitor, Smartphone, Square, Clapperboard, Settings2, Clock } from 'lucide-react';

interface NewProjectDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NewProjectDialog: React.FC<NewProjectDialogProps> = ({ isOpen, onClose }) => {
    const { setProjectSettings, loadProject } = useStore();

    const [projectName, setProjectName] = useState('Untitled Project');
    const [selectedPreset, setSelectedPreset] = useState<string>('yt-1080');
    const [customWidth, setCustomWidth] = useState(1920);
    const [customHeight, setCustomHeight] = useState(1080);
    const [frameRate, setFrameRate] = useState(30);
    const [isCustom, setIsCustom] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [timelineDuration, setTimelineDuration] = useState(600); // seconds (default 10 min)
    const [customDuration, setCustomDuration] = useState(10); // minutes for custom input

    const preset = useMemo(() =>
        RESOLUTION_PRESETS.find(p => p.id === selectedPreset),
        [selectedPreset]
    );

    const resolution = isCustom
        ? { width: customWidth, height: customHeight }
        : preset
            ? { width: preset.width, height: preset.height }
            : { width: 1920, height: 1080 };

    const aspectRatio = isCustom
        ? `${customWidth}:${customHeight}`
        : preset?.aspectRatio || '16:9';

    const effectiveFrameRate = isCustom ? frameRate : (preset?.frameRate || 30);

    // Group presets by category
    const groupedPresets = useMemo(() => {
        const groups: Record<string, ResolutionPreset[]> = {};
        RESOLUTION_PRESETS.forEach(p => {
            if (!groups[p.category]) groups[p.category] = [];
            groups[p.category].push(p);
        });
        return groups;
    }, []);

    const getCategoryIcon = (category: string) => {
        if (category.includes('YouTube') || category.includes('Widescreen')) return <Monitor size={14} />;
        if (category.includes('Dikey')) return <Smartphone size={14} />;
        if (category.includes('Kare')) return <Square size={14} />;
        if (category.includes('Sinematik')) return <Clapperboard size={14} />;
        return <Settings2 size={14} />;
    };

    const handleCreate = async () => {
        if (!projectName.trim()) {
            setError('Proje adı boş olamaz');
            return;
        }

        if (!isFileSystemAccessSupported()) {
            setError('Bu tarayıcı File System Access API desteklemiyor. Lütfen Chrome veya Edge kullanın.');
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            const settings: ProjectSettings = {
                name: projectName.trim(),
                resolution,
                frameRate: effectiveFrameRate,
                maxDuration: timelineDuration,
                aspectRatio,
                createdAt: new Date().toISOString(),
                modifiedAt: new Date().toISOString(),
            };

            await createProjectOnDisk(settings, [], [], 0);
            setProjectSettings(settings);
            onClose();
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                // User cancelled directory picker
                setError(null);
            } else {
                setError('Proje oluşturulamadı: ' + (err?.message || 'Bilinmeyen hata'));
            }
        } finally {
            setIsCreating(false);
        }
    };

    const handleOpen = async () => {
        if (!isFileSystemAccessSupported()) {
            setError('Bu tarayıcı File System Access API desteklemiyor. Lütfen Chrome veya Edge kullanın.');
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            const result = await openProjectFromDisk();
            if (!result) {
                setIsCreating(false);
                return;
            }

            const { projectData, mediaFiles } = result;

            // Reconstruct assets with Blob URLs from media files
            const restoredAssets = projectData.assets.map(ref => {
                const file = mediaFiles.get(ref.fileName);
                return {
                    id: ref.id,
                    type: ref.type,
                    src: file ? URL.createObjectURL(file) : '',
                    name: ref.name,
                    duration: ref.duration,
                };
            });

            // Reconstruct tracks — re-attach blob URLs to clips from matching assets
            const restoredTracks = projectData.tracks.map(track => ({
                ...track,
                clips: track.clips.map(clip => {
                    // Find matching asset to get src
                    const asset = restoredAssets.find(a => a.name === clip.name || a.id === clip.id);
                    return {
                        ...clip,
                        src: asset?.src || clip.src || '',
                    };
                }),
            }));

            loadProject(
                projectData.settings,
                restoredTracks,
                restoredAssets,
                projectData.currentTime
            );

            onClose();
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                setError(null);
            } else {
                setError('Proje açılamadı: ' + (err?.message || 'Bilinmeyen hata'));
            }
        } finally {
            setIsCreating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#111113] border border-neutral-800 rounded-2xl shadow-2xl w-[680px] max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Yeni Proje</h2>
                        <p className="text-xs text-neutral-500 mt-0.5">Proje ayarlarını seçin ve başlayın</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {/* Project Name */}
                    <div>
                        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Proje Adı</label>
                        <input
                            type="text"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            placeholder="Proje adınızı girin..."
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Resolution Presets */}
                    <div>
                        <label className="block text-xs font-medium text-neutral-400 mb-2">Çözünürlük</label>
                        <div className="space-y-3">
                            {Object.entries(groupedPresets).map(([category, presets]) => (
                                <div key={category}>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <span className="text-neutral-500">{getCategoryIcon(category)}</span>
                                        <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">{category}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {presets.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => { setSelectedPreset(p.id); setIsCustom(false); setFrameRate(p.frameRate); }}
                                                className={`relative text-left p-3 rounded-xl border transition-all group ${
                                                    !isCustom && selectedPreset === p.id
                                                        ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30'
                                                        : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-600 hover:bg-neutral-800/50'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-base">{p.icon}</span>
                                                    <span className="text-xs font-medium text-white">{p.name}</span>
                                                </div>
                                                <p className="text-[10px] text-neutral-500">{p.width}×{p.height} • {p.frameRate}fps</p>
                                                <p className="text-[10px] text-neutral-600 mt-0.5">{p.description}</p>
                                                {/* Aspect ratio badge */}
                                                <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono ${
                                                    !isCustom && selectedPreset === p.id
                                                        ? 'bg-indigo-500/20 text-indigo-300'
                                                        : 'bg-neutral-800 text-neutral-500'
                                                }`}>
                                                    {p.aspectRatio}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Custom Resolution */}
                        <button
                            onClick={() => setIsCustom(!isCustom)}
                            className={`mt-2 w-full text-left p-3 rounded-xl border transition-all ${
                                isCustom
                                    ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30'
                                    : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-600 hover:bg-neutral-800/50'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <Settings2 size={14} className="text-neutral-400" />
                                <span className="text-xs font-medium text-white">Özel Çözünürlük</span>
                            </div>
                        </button>

                        {isCustom && (
                            <div className="mt-2 flex gap-3 items-center">
                                <div className="flex-1">
                                    <label className="block text-[10px] text-neutral-500 mb-1">Genişlik</label>
                                    <input
                                        type="number"
                                        value={customWidth}
                                        onChange={(e) => setCustomWidth(Number(e.target.value))}
                                        min={320}
                                        max={7680}
                                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                    />
                                </div>
                                <span className="text-neutral-600 mt-4">×</span>
                                <div className="flex-1">
                                    <label className="block text-[10px] text-neutral-500 mb-1">Yükseklik</label>
                                    <input
                                        type="number"
                                        value={customHeight}
                                        onChange={(e) => setCustomHeight(Number(e.target.value))}
                                        min={240}
                                        max={4320}
                                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Frame Rate */}
                    <div>
                        <label className="block text-xs font-medium text-neutral-400 mb-2">Kare Hızı (FPS)</label>
                        <div className="flex gap-2">
                            {FRAME_RATE_OPTIONS.map((fps) => (
                                <button
                                    key={fps}
                                    onClick={() => { setFrameRate(fps); if (!isCustom && preset) { /* keep preset selected but override fps */ } setIsCustom(true); }}
                                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                                        effectiveFrameRate === fps
                                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50'
                                            : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:border-neutral-600'
                                    }`}
                                >
                                    {fps} fps
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Timeline Duration */}
                    <div>
                        <label className="block text-xs font-medium text-neutral-400 mb-2">
                            <Clock size={12} className="inline mr-1.5 -mt-0.5" />
                            Timeline Süresi
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {[
                                { label: '5 dk', value: 300 },
                                { label: '10 dk', value: 600 },
                                { label: '30 dk', value: 1800 },
                                { label: '1 saat', value: 3600 },
                                { label: '2 saat', value: 7200 },
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setTimelineDuration(opt.value)}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        timelineDuration === opt.value
                                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50'
                                            : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:border-neutral-600'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="number"
                                    value={customDuration}
                                    onChange={(e) => {
                                        const mins = Math.max(1, Number(e.target.value));
                                        setCustomDuration(mins);
                                        setTimelineDuration(mins * 60);
                                    }}
                                    min={1}
                                    max={600}
                                    className="w-16 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-2 text-xs text-white text-center focus:outline-none focus:border-indigo-500 transition-all"
                                />
                                <span className="text-[10px] text-neutral-500">dk</span>
                            </div>
                        </div>
                    </div>

                    {/* Preview Summary */}
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-500">Özet:</span>
                            <div className="flex items-center gap-3 text-neutral-300">
                                <span>{resolution.width}×{resolution.height}</span>
                                <span className="text-neutral-600">•</span>
                                <span>{effectiveFrameRate} fps</span>
                                <span className="text-neutral-600">•</span>
                                <span>{aspectRatio}</span>
                                <span className="text-neutral-600">•</span>
                                <span>{timelineDuration >= 3600 ? `${Math.floor(timelineDuration / 3600)}sa ${Math.floor((timelineDuration % 3600) / 60)}dk` : `${Math.floor(timelineDuration / 60)} dk`}</span>
                            </div>
                        </div>
                        {/* Tiny aspect ratio preview */}
                        <div className="mt-2 flex justify-center">
                            <div
                                className="border border-neutral-700 bg-neutral-800 rounded-sm"
                                style={{
                                    width: resolution.width > resolution.height ? 80 : 80 * (resolution.width / resolution.height),
                                    height: resolution.height > resolution.width ? 50 : 50 * (resolution.height / resolution.width),
                                    maxWidth: 80,
                                    maxHeight: 50,
                                }}
                            />
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 px-6 py-4 border-t border-neutral-800 bg-neutral-900/30">
                    <button
                        onClick={handleOpen}
                        disabled={isCreating}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-300 hover:text-white transition-all disabled:opacity-50"
                    >
                        <FolderOpen size={14} />
                        Proje Aç
                    </button>
                    <div className="flex-1" />
                    <button
                        onClick={handleCreate}
                        disabled={isCreating || !projectName.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-medium transition-all disabled:opacity-50 disabled:hover:bg-indigo-600"
                    >
                        <Plus size={14} />
                        {isCreating ? 'Oluşturuluyor...' : 'Proje Oluştur'}
                    </button>
                </div>
            </div>
        </div>
    );
};
