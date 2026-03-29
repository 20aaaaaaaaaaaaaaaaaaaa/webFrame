import React from 'react';
import { useStore } from '../../store/useStore';
import { useExport } from '../../hooks/useExport';
import { Trash2, Volume2, Video, Square, Download, Settings, XCircle, Keyboard } from 'lucide-react';

export const PropertiesPanel = () => {
    const { selectedClipIds, tracks, updateClip } = useStore();
    const { exportVideo, isExporting, progress, statusMessage, cancelExport } = useExport();
    const currentTimeState = useStore(state => state.currentTime);
    const [activeTab, setActiveTab] = React.useState<'properties' | 'export' | 'shortcuts'>('properties');

    const selectedClip = React.useMemo(() => {
        if (selectedClipIds.length === 0) return null;
        const lastSelectedId = selectedClipIds[selectedClipIds.length - 1];
        for (const track of tracks) {
            const clip = track.clips.find(c => c.id === lastSelectedId);
            if (clip) return clip;
        }
        return null;
    }, [selectedClipIds, tracks]);

    // Keyframe Logic Helpers (Safe even if selectedClip is null, just don't call)
    const getInterpolatedPosition = (clip: any) => {
        const relTime = currentTimeState - clip.start;
        const frames = [...(clip.positionKeyframes || [])].sort((a: any, b: any) => a.time - b.time);
        if (frames.length === 0) return clip.position;

        if (relTime <= frames[0].time) return { x: frames[0].x, y: frames[0].y };
        if (relTime >= frames[frames.length - 1].time) {
            const last = frames[frames.length - 1];
            return { x: last.x, y: last.y };
        }

        for (let i = 0; i < frames.length - 1; i++) {
            if (relTime >= frames[i].time && relTime < frames[i + 1].time) {
                const duration = frames[i + 1].time - frames[i].time;
                const progress = (relTime - frames[i].time) / duration;
                return {
                    x: frames[i].x + (frames[i + 1].x - frames[i].x) * progress,
                    y: frames[i].y + (frames[i + 1].y - frames[i].y) * progress
                };
            }
        }
        return clip.position;
    };

    const renderProperties = () => {
        if (!selectedClip) {
            return (
                <div className="h-full flex flex-col items-center justify-center text-neutral-500 text-sm p-4 text-center">
                    <Settings className="w-8 h-8 mb-2 opacity-50" />
                    <p>Select a clip to edit properties</p>
                </div>
            );
        }

        const relTime = currentTimeState - selectedClip.start;
        const hasPositionKeyframes = (selectedClip.positionKeyframes?.length ?? 0) > 0;
        const activeKeyframeIndex = selectedClip.positionKeyframes?.findIndex(k => Math.abs(k.time - relTime) < 0.05);
        const isKeyframeActive = activeKeyframeIndex !== undefined && activeKeyframeIndex !== -1;
        const displayPos = hasPositionKeyframes ? getInterpolatedPosition(selectedClip) : selectedClip.position;

        const handlePosChange = (axis: 'x' | 'y', val: number) => {
            if (hasPositionKeyframes && selectedClip.positionKeyframes) {
                let newFrames = [...selectedClip.positionKeyframes];
                if (isKeyframeActive && activeKeyframeIndex !== undefined) {
                    newFrames[activeKeyframeIndex] = { ...newFrames[activeKeyframeIndex], [axis]: val };
                } else {
                    const current = getInterpolatedPosition(selectedClip);
                    newFrames.push({
                        time: relTime,
                        x: axis === 'x' ? val : current.x,
                        y: axis === 'y' ? val : current.y
                    });
                }
                newFrames.sort((a, b) => a.time - b.time);
                updateClip(selectedClip.id, { positionKeyframes: newFrames });
            } else {
                updateClip(selectedClip.id, { position: { ...selectedClip.position, [axis]: val } });
            }
        };

        const toggleKeyframe = () => {
            let newFrames = selectedClip.positionKeyframes ? [...selectedClip.positionKeyframes] : [];
            if (isKeyframeActive && activeKeyframeIndex !== undefined) {
                newFrames.splice(activeKeyframeIndex, 1);
            } else {
                const current = displayPos;
                newFrames.push({ time: relTime, x: current.x, y: current.y });
            }
            newFrames.sort((a, b) => a.time - b.time);
            updateClip(selectedClip.id, { positionKeyframes: newFrames });
        };

        return (
            <div className="p-4 space-y-6">
                {/* Clip Name Header inside Content */}
                <div className="flex justify-between items-center mb-4">
                    <span className="text-white font-medium truncate max-w-[150px]">{selectedClip.name}</span>
                    <span className="text-[10px] bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-400 font-mono text-xs uppercase">{selectedClip.type}</span>
                </div>

                {/* General */}
                <div className="space-y-3">
                    <div className="bg-neutral-900 border border-neutral-800 rounded p-2">
                        <label className="text-[10px] uppercase text-neutral-500 font-bold mb-1 block">Name</label>
                        <input
                            className="w-full bg-transparent text-white focus:outline-none"
                            value={selectedClip.name}
                            onChange={(e) => updateClip(selectedClip.id, { name: e.target.value })}
                        />
                    </div>
                </div>

                {/* Transform */}
                <div>
                    <div className="text-[10px] uppercase text-neutral-500 font-bold mb-3 flex items-center gap-2">
                        Transform
                        {hasPositionKeyframes && <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />}
                    </div>
                    <div className="space-y-3">
                        {/* Position */}
                        <div className="bg-neutral-900/50 rounded border border-neutral-800 p-2">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-neutral-400">Position</span>
                                <button
                                    onClick={toggleKeyframe}
                                    className={`w-3 h-3 rotate-45 border transition-all ${isKeyframeActive ? 'bg-indigo-500 border-indigo-500 shadow-glow' : 'border-neutral-500 hover:border-white'}`}
                                    title="Toggle Animation Keyframe"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="relative">
                                    <span className="absolute left-2 top-1.5 text-xs text-neutral-600 font-mono">X</span>
                                    <input
                                        type="number"
                                        value={Math.round(displayPos.x)}
                                        onChange={(e) => handlePosChange('x', Number(e.target.value))}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded py-1 pl-6 pr-1 text-right focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="relative">
                                    <span className="absolute left-2 top-1.5 text-xs text-neutral-600 font-mono">Y</span>
                                    <input
                                        type="number"
                                        value={Math.round(displayPos.y)}
                                        onChange={(e) => handlePosChange('y', Number(e.target.value))}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded py-1 pl-6 pr-1 text-right focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Scale & Rotation */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-neutral-900/50 rounded border border-neutral-800 p-2">
                                <label className="text-xs text-neutral-400 block mb-1">Scale</label>
                                <input
                                    type="number" step="0.1"
                                    value={selectedClip.scale}
                                    onChange={(e) => updateClip(selectedClip.id, { scale: Number(e.target.value) })}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded py-1 px-2 text-right focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div className="bg-neutral-900/50 rounded border border-neutral-800 p-2">
                                <label className="text-xs text-neutral-400 block mb-1">Rotation</label>
                                <input
                                    type="number"
                                    value={selectedClip.rotation}
                                    onChange={(e) => updateClip(selectedClip.id, { rotation: Number(e.target.value) })}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded py-1 px-2 text-right focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Opacity */}
                <div>
                    <div className="text-[10px] uppercase text-neutral-500 font-bold mb-2">Opacity</div>
                    <div className="bg-neutral-900/50 rounded border border-neutral-800 p-2">
                        <input
                            type="range" min="0" max="1" step="0.01"
                            value={selectedClip.opacity}
                            onChange={(e) => updateClip(selectedClip.id, { opacity: Number(e.target.value) })}
                            className="w-full accent-indigo-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="text-right text-xs mt-1 text-neutral-400">{Math.round(selectedClip.opacity * 100)}%</div>
                    </div>
                </div>
            </div>
        );
    };

    const [exportSettings, setExportSettings] = React.useState({
        fps: 30,
        scale: 1,
        quality: 'medium' as 'high' | 'medium' | 'low',
        filename: 'video.mp4',
        fileHandle: null as FileSystemFileHandle | null,
        audioBitrate: 192,
        audioSampleRate: 44100,
        audioEnabled: true
    });

    const handleSetLocation = async () => {
        try {
            // @ts-ignore - showSaveFilePicker is not yet in standard TS lib
            const handle = await window.showSaveFilePicker({
                suggestedName: exportSettings.filename,
                types: [{
                    description: 'Video File',
                    accept: { 'video/mp4': ['.mp4'] }
                }]
            });
            setExportSettings({
                ...exportSettings,
                fileHandle: handle,
                filename: handle.name
            });
        } catch (err) {
            // User cancelled
            console.log("File picker cancelled");
        }
    };

    const handleExport = () => {
        exportVideo(exportSettings);
    };

    const renderExport = () => {
        return (
            <div className="p-6 flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center border border-neutral-800">
                    <Download className="text-indigo-500" size={32} />
                </div>
                <div>
                    <h3 className="text-lg font-medium text-white mb-2">Export Project</h3>
                    <p className="text-xs text-neutral-500">Render your timeline to video.</p>
                </div>

                <div className="w-full space-y-4">
                    <div className="bg-neutral-900/50 p-3 rounded border border-neutral-800 text-left space-y-3">
                        <label className="text-xs text-neutral-500 uppercase font-bold block">Settings</label>

                        {/* Output File */}
                        <div className="space-y-2 pb-2 border-b border-neutral-800">
                            <label className="text-xs text-neutral-400 block">Output Location</label>
                            <div className="flex gap-2">
                                <input
                                    value={exportSettings.filename}
                                    onChange={(e) => setExportSettings({ ...exportSettings, filename: e.target.value })}
                                    className="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1.5 text-xs text-neutral-300 focus:ring-1 focus:ring-indigo-500 outline-none truncate"
                                    placeholder="video.webm"
                                    disabled={!!exportSettings.fileHandle} // Disable manual typing if handle picked
                                />
                                <button
                                    onClick={handleSetLocation}
                                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 rounded px-3 py-1 text-xs whitespace-nowrap transition-colors"
                                    title="Choose Save Location"
                                >
                                    Browse...
                                </button>
                            </div>
                            {exportSettings.fileHandle && (
                                <div className="text-[10px] text-green-500 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                    Location Selected
                                </div>
                            )}
                        </div>

                        {/* FPS */}
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-neutral-400">Frame Rate</span>
                            <select
                                value={exportSettings.fps}
                                onChange={(e) => setExportSettings({ ...exportSettings, fps: Number(e.target.value) })}
                                className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                            >
                                <option value={24}>24 FPS</option>
                                <option value={30}>30 FPS</option>
                                <option value={60}>60 FPS</option>
                            </select>
                        </div>

                        {/* Resolution */}
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-neutral-400">Resolution</span>
                            <select
                                value={exportSettings.scale}
                                onChange={(e) => setExportSettings({ ...exportSettings, scale: Number(e.target.value) })}
                                className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                            >
                                <option value={1}>1080p (Full)</option>
                                <option value={0.666}>720p (HD)</option>
                                <option value={0.5}>540p (Half)</option>
                            </select>
                        </div>

                        {/* Quality */}
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-neutral-400">Quality</span>
                            <select
                                value={exportSettings.quality}
                                onChange={(e) => setExportSettings({ ...exportSettings, quality: e.target.value as any })}
                                className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                            >
                                <option value="high">High (Slower)</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low (Faster)</option>
                            </select>
                        </div>
                    </div>

                    {/* Audio Settings */}
                    <div className="bg-neutral-900/50 p-3 rounded border border-neutral-800 text-left space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-neutral-500 uppercase font-bold">Audio</label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={exportSettings.audioEnabled}
                                    onChange={(e) => setExportSettings({ ...exportSettings, audioEnabled: e.target.checked })}
                                    className="w-4 h-4 accent-indigo-500"
                                />
                                <span className="text-xs text-neutral-400">Enable</span>
                            </label>
                        </div>

                        {exportSettings.audioEnabled && (
                            <>
                                {/* Audio Bitrate */}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-neutral-400">Bitrate</span>
                                    <select
                                        value={exportSettings.audioBitrate}
                                        onChange={(e) => setExportSettings({ ...exportSettings, audioBitrate: Number(e.target.value) })}
                                        className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value={128}>128 kbps</option>
                                        <option value={192}>192 kbps</option>
                                        <option value={256}>256 kbps</option>
                                        <option value={320}>320 kbps</option>
                                    </select>
                                </div>

                                {/* Sample Rate */}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-neutral-400">Sample Rate</span>
                                    <select
                                        value={exportSettings.audioSampleRate}
                                        onChange={(e) => setExportSettings({ ...exportSettings, audioSampleRate: Number(e.target.value) })}
                                        className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value={44100}>44.1 kHz</option>
                                        <option value={48000}>48 kHz</option>
                                    </select>
                                </div>
                            </>
                        )}
                    </div>

                    {!isExporting ? (
                        <button
                            onClick={handleExport}
                            className="w-full py-3 rounded font-medium flex items-center justify-center gap-2 transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/20"
                        >
                            <Download size={16} />
                            <span>Start Export</span>
                        </button>
                    ) : (
                        <button
                            onClick={cancelExport}
                            className="w-full py-3 rounded font-medium flex items-center justify-center gap-2 transition-all bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20"
                        >
                            <XCircle size={16} />
                            <span>Cancel Export</span>
                        </button>
                    )}

                    {isExporting && (
                        <>
                            <div className="w-full bg-neutral-800 h-1 rounded-full overflow-hidden">
                                <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                            </div>
                            {statusMessage && (
                                <div className="text-xs text-center text-neutral-400 animate-pulse">
                                    {statusMessage}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    const shortcutCategories = [
        {
            title: 'Oynatma (Playback)',
            shortcuts: [
                { keys: ['Space'], description: 'Oynat / Duraklat (hızı 1x\'e sıfırlar)' },
                { keys: ['J'], description: 'Geri sar (tekrarla: 2x→4x→8x)' },
                { keys: ['K'], description: 'Duraklat ve hızı sıfırla' },
                { keys: ['L'], description: 'İleri sar (tekrarla: 2x→4x→8x)' },
            ]
        },
        {
            title: 'Zaman Çizelgesi (Timeline)',
            shortcuts: [
                { keys: ['I'], description: 'Başlangıç noktası (In Point) belirle' },
                { keys: ['O'], description: 'Bitiş noktası (Out Point) belirle' },
                { keys: ['Alt', 'X'], description: 'In/Out noktalarını temizle' },
            ]
        },
        {
            title: 'Düzenleme (Editing)',
            shortcuts: [
                { keys: ['4'], description: 'Oynatma çubuğunda klibi böl' },
                { keys: ['Delete'], description: 'Seçili klipleri sil' },
            ]
        },
        {
            title: 'Genel (Navigation)',
            shortcuts: [
                { keys: ['Ctrl', 'Z'], description: 'Geri Al (Undo)' },
                { keys: ['Ctrl', 'Shift', 'Z'], description: 'Yinele (Redo)' },
                { keys: ['Ctrl', 'Y'], description: 'Yinele (Redo alternatif)' },
                { keys: ['?'], description: 'Kısayollar panelini aç/kapat' },
            ]
        },
    ];

    const renderShortcuts = () => {
        return (
            <div className="p-4 space-y-5">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-neutral-900 rounded-full flex items-center justify-center border border-neutral-800">
                        <Keyboard className="text-indigo-500" size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white">Klavye Kısayolları</h3>
                        <p className="text-[10px] text-neutral-500">Aktif kısayol tuşları ve işlevleri</p>
                    </div>
                </div>

                {shortcutCategories.map((category, idx) => (
                    <div key={idx}>
                        <h4 className="text-[10px] uppercase text-indigo-400 font-bold mb-2 flex items-center gap-1.5">
                            <div className="h-1 w-1 rounded-full bg-indigo-400"></div>
                            {category.title}
                        </h4>
                        <div className="space-y-1.5">
                            {category.shortcuts.map((shortcut, sidx) => (
                                <div
                                    key={sidx}
                                    className="flex items-center justify-between py-2 px-3 bg-neutral-900/50 rounded-lg border border-neutral-800/50 hover:border-indigo-500/30 hover:bg-neutral-800/50 transition-all"
                                >
                                    <span className="text-neutral-300 text-xs">
                                        {shortcut.description}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                        {shortcut.keys.map((key, kidx) => (
                                            <React.Fragment key={kidx}>
                                                {kidx > 0 && (
                                                    <span className="text-neutral-600 text-[10px] font-bold">+</span>
                                                )}
                                                <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-200 bg-neutral-700 border border-neutral-600 rounded shadow-sm min-w-[1.5rem] text-center">
                                                    {key}
                                                </kbd>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                <div className="mt-4 pt-3 border-t border-neutral-800">
                    <p className="text-[10px] text-neutral-600 text-center">
                        Herhangi bir anda <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-300 bg-neutral-700 border border-neutral-600 rounded">?</kbd> tuşuna basarak tam ekran kısayol panelini açabilirsin.
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className="w-[320px] bg-[#0a0a0a] border-l border-neutral-800 flex flex-col text-sm text-neutral-300 h-full overflow-hidden font-sans">
            {/* Tabs Header */}
            <div className="flex border-b border-neutral-800 shrink-0">
                <button
                    onClick={() => setActiveTab('properties')}
                    className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'properties'
                        ? 'text-white border-indigo-500 bg-neutral-900/50'
                        : 'text-neutral-500 border-transparent hover:text-neutral-300 hover:bg-neutral-900/30'
                        }`}
                >
                    Properties
                </button>
                <button
                    onClick={() => setActiveTab('export')}
                    className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'export'
                        ? 'text-white border-indigo-500 bg-neutral-900/50'
                        : 'text-neutral-500 border-transparent hover:text-neutral-300 hover:bg-neutral-900/30'
                        }`}
                >
                    Export
                </button>
                <button
                    onClick={() => setActiveTab('shortcuts')}
                    className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'shortcuts'
                        ? 'text-white border-indigo-500 bg-neutral-900/50'
                        : 'text-neutral-500 border-transparent hover:text-neutral-300 hover:bg-neutral-900/30'
                        }`}
                >
                    Shortcuts
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'properties' ? (
                    selectedClipIds.length > 0 ? renderProperties() : (
                        <div className="p-6 text-center space-y-6">
                            <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center border border-neutral-800 mx-auto">
                                <Settings className="text-neutral-500" size={32} />
                            </div>
                            <div>
                                <h3 className="text-lg font-medium text-white mb-2">Project Settings</h3>
                                <p className="text-xs text-neutral-500">Configure your sequence.</p>
                            </div>

                            <div className="bg-neutral-900/50 p-3 rounded border border-neutral-800 text-left space-y-3">
                                <label className="text-xs text-neutral-500 uppercase font-bold block">Resolution (Canvas)</label>

                                <div className="space-y-2">
                                    <button
                                        onClick={() => useStore.getState().setCanvasSize({ width: 1920, height: 1080 })}
                                        className={`w-full text-left px-3 py-2 rounded text-xs flex justify-between ${useStore.getState().canvasSize.width === 1920 && useStore.getState().canvasSize.height === 1080 ? 'bg-indigo-900/30 text-indigo-400 border border-indigo-500/50' : 'bg-neutral-950 hover:bg-neutral-900 text-neutral-300'}`}
                                    >
                                        <span>1920 x 1080</span>
                                        <span className="opacity-50">Landscape (16:9)</span>
                                    </button>

                                    <button
                                        onClick={() => useStore.getState().setCanvasSize({ width: 1080, height: 1920 })}
                                        className={`w-full text-left px-3 py-2 rounded text-xs flex justify-between ${useStore.getState().canvasSize.width === 1080 && useStore.getState().canvasSize.height === 1920 ? 'bg-indigo-900/30 text-indigo-400 border border-indigo-500/50' : 'bg-neutral-950 hover:bg-neutral-900 text-neutral-300'}`}
                                    >
                                        <span>1080 x 1920</span>
                                        <span className="opacity-50">Portrait (9:16)</span>
                                    </button>

                                    <button
                                        onClick={() => useStore.getState().setCanvasSize({ width: 1080, height: 1080 })}
                                        className={`w-full text-left px-3 py-2 rounded text-xs flex justify-between ${useStore.getState().canvasSize.width === 1080 && useStore.getState().canvasSize.height === 1080 ? 'bg-indigo-900/30 text-indigo-400 border border-indigo-500/50' : 'bg-neutral-950 hover:bg-neutral-900 text-neutral-300'}`}
                                    >
                                        <span>1080 x 1080</span>
                                        <span className="opacity-50">Square (1:1)</span>
                                    </button>

                                    <button
                                        onClick={() => useStore.getState().setCanvasSize({ width: 3840, height: 2160 })}
                                        className={`w-full text-left px-3 py-2 rounded text-xs flex justify-between ${useStore.getState().canvasSize.width === 3840 && useStore.getState().canvasSize.height === 2160 ? 'bg-indigo-900/30 text-indigo-400 border border-indigo-500/50' : 'bg-neutral-950 hover:bg-neutral-900 text-neutral-300'}`}
                                    >
                                        <span>3840 x 2160</span>
                                        <span className="opacity-50">4K (16:9)</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-4 pt-2 border-t border-neutral-800">
                                    <div>
                                        <label className="text-[10px] text-neutral-500 block mb-1">Width</label>
                                        <input
                                            type="number"
                                            value={useStore.getState().canvasSize.width}
                                            onChange={(e) => useStore.getState().setCanvasSize({ ...useStore.getState().canvasSize, width: Number(e.target.value) })}
                                            className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-right"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-neutral-500 block mb-1">Height</label>
                                        <input
                                            type="number"
                                            value={useStore.getState().canvasSize.height}
                                            onChange={(e) => useStore.getState().setCanvasSize({ ...useStore.getState().canvasSize, height: Number(e.target.value) })}
                                            className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-right"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                ) : activeTab === 'export' ? renderExport() : renderShortcuts()}
            </div>
        </div>
    );
};
