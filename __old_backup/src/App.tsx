import React from 'react';
import { AssetLibrary } from './components/AssetLibrary/AssetLibrary';
import { Preview } from './components/Preview/Preview';
import { Timeline } from './components/Timeline/Timeline';
import { PropertiesPanel } from './components/Properties/PropertiesPanel';
import { KeyboardShortcuts } from './components/KeyboardShortcuts/KeyboardShortcuts';
import { NewProjectDialog } from './components/Project/NewProjectDialog';
import { useStore } from './store/useStore';
import { saveProject } from './utils/projectFileSystem';

const AUTOSAVE_INTERVAL = 3 * 60 * 1000; // 3 minutes

const App = () => {
    const { undo, redo, hasProject, projectSettings, tracks, assets, currentTime } = useStore();
    const [timelineHeight, setTimelineHeight] = React.useState(300);
    const [showShortcuts, setShowShortcuts] = React.useState(false);
    const [showNewProject, setShowNewProject] = React.useState(false);
    const draggingRef = React.useRef(false);

    // Show new project dialog on first load if no project
    React.useEffect(() => {
        if (!hasProject) {
            setShowNewProject(true);
        }
    }, []);

    // ─── Keyboard Shortcuts ─────────────────────────────────
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            // Toggle shortcuts panel with ? key
            if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                setShowShortcuts(prev => !prev);
                return;
            }

            // Ctrl+S — Save project
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                handleManualSave();
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, hasProject, projectSettings, tracks, assets, currentTime]);

    // ─── Manual Save ─────────────────────────────────────────
    const handleManualSave = async () => {
        const state = useStore.getState();
        if (!state.hasProject || !state.projectSettings) return;
        state.setIsSaving(true);
        const success = await saveProject(state.projectSettings, state.tracks, state.assets, state.currentTime);
        if (success) {
            state.markSaved();
        }
        state.setIsSaving(false);
    };

    // ─── Autosave Timer ──────────────────────────────────────
    React.useEffect(() => {
        const interval = setInterval(async () => {
            const state = useStore.getState();
            if (state.hasProject && state.projectSettings && state.isProjectDirty && !state.isSaving) {
                state.setIsSaving(true);
                const success = await saveProject(state.projectSettings, state.tracks, state.assets, state.currentTime);
                if (success) {
                    state.markSaved();
                }
                state.setIsSaving(false);
            }
        }, AUTOSAVE_INTERVAL);

        return () => clearInterval(interval);
    }, []);

    // ─── Mark dirty on track/asset changes ───────────────────
    React.useEffect(() => {
        // Subscribe to store and mark dirty on relevant changes
        let prevTracks = useStore.getState().tracks;
        let prevAssets = useStore.getState().assets;

        const unsub = useStore.subscribe((state) => {
            if (state.hasProject && (state.tracks !== prevTracks || state.assets !== prevAssets)) {
                if (!state.isProjectDirty) {
                    state.markDirty();
                }
                prevTracks = state.tracks;
                prevAssets = state.assets;
            }
        });

        return unsub;
    }, []);

    // ─── Beforeunload Warning ────────────────────────────────
    React.useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            const state = useStore.getState();
            if (state.hasProject && state.isProjectDirty) {
                e.preventDefault();
                e.returnValue = 'Kaydedilmemiş değişiklikler var. Çıkmak istediğinize emin misiniz?';
                return e.returnValue;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    // ─── Timeline Resize ─────────────────────────────────────
    const handleDragStart = () => {
        draggingRef.current = true;
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';

        const handleMouseMove = (e: MouseEvent) => {
            if (draggingRef.current) {
                const newHeight = window.innerHeight - e.clientY;
                if (newHeight > 150 && newHeight < window.innerHeight - 200) {
                    setTimelineHeight(newHeight);
                }
            }
        };

        const handleMouseUp = () => {
            draggingRef.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleOpenProject = () => {
        setShowNewProject(true);
    };

    return (
        <div className="h-screen flex flex-col bg-slate-950 text-white">
            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar (Asset Browser) */}
                <AssetLibrary
                    onNewProject={() => setShowNewProject(true)}
                    onOpenProject={handleOpenProject}
                />

                {/* Center Canvas */}
                <Preview />

                {/* Right Properties */}
                <PropertiesPanel />
            </div>

            {/* Resizer Handle */}
            <div
                className="h-2 bg-slate-800 hover:bg-indigo-500 cursor-ns-resize flex items-center justify-center transition-colors z-50 shrink-0"
                onMouseDown={handleDragStart}
            >
                <div className="w-8 h-1 bg-slate-600 rounded-full" />
            </div>

            {/* Bottom Timeline */}
            <div
                className="border-t border-slate-800 bg-slate-900 flex flex-col"
                style={{ height: timelineHeight }}
            >
                <Timeline />
            </div>

            {/* Keyboard Shortcuts Panel */}
            <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

            {/* New Project Dialog */}
            <NewProjectDialog
                isOpen={showNewProject}
                onClose={() => setShowNewProject(false)}
            />
        </div>
    );
};

export default App;
