import React from 'react';
import { useStore } from '../../store/useStore';
import { saveProject } from '../../utils/projectFileSystem';
import { Save, FolderOpen, FilePlus } from 'lucide-react';

interface ProjectBarProps {
    onNewProject: () => void;
    onOpenProject: () => void;
}

export const ProjectBar: React.FC<ProjectBarProps> = ({ onNewProject, onOpenProject }) => {
    const {
        projectSettings, hasProject, isProjectDirty, lastSavedAt, isSaving,
        tracks, assets, currentTime,
        markSaved, setIsSaving,
    } = useStore();

    const handleSave = async () => {
        if (!hasProject || !projectSettings) return;
        setIsSaving(true);
        const success = await saveProject(projectSettings, tracks, assets, currentTime);
        if (success) {
            markSaved();
        }
        setIsSaving(false);
    };

    const formatTime = (date: Date | null) => {
        if (!date) return '';
        return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    };

    if (!hasProject) return null;

    return (
        <div className="h-9 bg-[#0a0a0a] border-b border-neutral-800 flex items-center px-3 gap-2 shrink-0">
            {/* Project Info */}
            <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full shrink-0" style={{
                    backgroundColor: isSaving ? '#f59e0b' : isProjectDirty ? '#ef4444' : '#22c55e',
                }} />
                <span className="text-xs font-medium text-white truncate max-w-[160px]">
                    {projectSettings?.name || 'Untitled'}
                </span>
                <span className="text-[10px] text-neutral-600 shrink-0">
                    {projectSettings?.resolution.width}×{projectSettings?.resolution.height} • {projectSettings?.frameRate}fps
                </span>
            </div>

            {/* Save Status */}
            <div className="text-[10px] text-neutral-500 shrink-0">
                {isSaving ? 'Kaydediliyor...' :
                    isProjectDirty ? 'Kaydedilmemiş değişiklikler' :
                        lastSavedAt ? `Son kayıt: ${formatTime(lastSavedAt)}` : 'Kaydedildi'}
            </div>

            <div className="flex-1" />

            {/* Actions */}
            <button
                onClick={handleSave}
                disabled={isSaving || !isProjectDirty}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all disabled:opacity-40 disabled:hover:bg-neutral-800"
                title="Kaydet (Ctrl+S)"
            >
                <Save size={12} />
                Kaydet
            </button>
            <button
                onClick={onNewProject}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all"
                title="Yeni Proje"
            >
                <FilePlus size={12} />
            </button>
            <button
                onClick={onOpenProject}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all"
                title="Proje Aç"
            >
                <FolderOpen size={12} />
            </button>
        </div>
    );
};
