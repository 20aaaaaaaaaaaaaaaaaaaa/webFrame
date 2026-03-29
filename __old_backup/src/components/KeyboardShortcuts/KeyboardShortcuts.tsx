import React from 'react';
import { X } from 'lucide-react';

interface KeyboardShortcutsProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Shortcut {
    keys: string[];
    description: string;
}

interface ShortcutCategory {
    title: string;
    shortcuts: Shortcut[];
}

const categories: ShortcutCategory[] = [
    {
        title: 'Playback',
        shortcuts: [
            { keys: ['Space'], description: 'Play / Pause (reset speed to 1x)' },
            { keys: ['J'], description: 'Rewind at 2x speed' },
            { keys: ['K'], description: 'Pause and reset speed' },
            { keys: ['L'], description: 'Fast forward at 2x speed' },
        ]
    },
    {
        title: 'Timeline',
        shortcuts: [
            { keys: ['I'], description: 'Set In Point' },
            { keys: ['O'], description: 'Set Out Point' },
            { keys: ['Alt', 'X'], description: 'Clear In/Out Points' },
        ]
    },
    {
        title: 'Editing',
        shortcuts: [
            { keys: ['4'], description: 'Split clip at playhead' },
            { keys: ['Delete'], description: 'Delete selected clips' },
        ]
    },
    {
        title: 'Navigation',
        shortcuts: [
            { keys: ['Ctrl', 'Z'], description: 'Undo' },
            { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
            { keys: ['Ctrl', 'Y'], description: 'Redo (alternative)' },
        ]
    },
    {
        title: 'Help',
        shortcuts: [
            { keys: ['?'], description: 'Toggle this shortcuts panel' },
        ]
    }
];

const KeyBadge: React.FC<{ keyName: string }> = ({ keyName }) => (
    <kbd className="px-2.5 py-1.5 text-xs font-semibold text-slate-200 bg-slate-700 border border-slate-600 rounded shadow-sm min-w-[2rem] text-center">
        {keyName}
    </kbd>
);

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700 rounded-2xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700 px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                                Keyboard Shortcuts
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">Master webFrame like a pro</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                            aria-label="Close"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-8 py-6 space-y-8">
                    {categories.map((category, idx) => (
                        <div key={idx}>
                            <h3 className="text-lg font-semibold text-indigo-400 mb-4 flex items-center gap-2">
                                <div className="h-1 w-1 rounded-full bg-indigo-400"></div>
                                {category.title}
                            </h3>
                            <div className="space-y-3">
                                {category.shortcuts.map((shortcut, sidx) => (
                                    <div
                                        key={sidx}
                                        className="flex items-center justify-between py-3 px-4 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-indigo-500/30 hover:bg-slate-800/80 transition-all"
                                    >
                                        <span className="text-slate-300 text-sm font-medium">
                                            {shortcut.description}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            {shortcut.keys.map((key, kidx) => (
                                                <React.Fragment key={kidx}>
                                                    {kidx > 0 && (
                                                        <span className="text-slate-500 text-xs font-bold mx-0.5">+</span>
                                                    )}
                                                    <KeyBadge keyName={key} />
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 px-8 py-4">
                    <p className="text-xs text-slate-500 text-center">
                        Press <KeyBadge keyName="?" /> anytime to toggle this panel
                    </p>
                </div>
            </div>
        </div>
    );
};
