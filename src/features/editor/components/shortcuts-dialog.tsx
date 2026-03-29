import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HOTKEYS, type HotkeyKey } from '@/config/hotkeys';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from 'react-i18next';

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Group shortcuts by category

function formatKeyBinding(key: string): string {
  return key
    .replace('mod', 'Ctrl')
    .replace('space', 'Space')
    .replace('comma', ',')
    .replace('period', '.')
    .replace('bracketleft', '[')
    .replace('bracketright', ']')
    .replace('left', '←')
    .replace('right', '→')
    .replace('up', '↑')
    .replace('down', '↓')
    .replace('home', 'Home')
    .replace('end', 'End')
    .replace('delete', 'Del')
    .replace('backspace', 'Backspace')
    .replace('escape', 'Esc')
    .replace('tab', 'Tab')
    .replace('equals', '+')
    .replace('minus', '-')
    .split('+')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' + ');
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const { t } = useTranslation();

  // Create localized descriptions mapping on the fly inside component
  const localizedDescriptions: Record<HotkeyKey, string> = {
    // Playback
    PLAY_PAUSE: t('hotkeys.playPause', 'Play/Pause'),
    PREVIOUS_FRAME: t('hotkeys.prevFrame', 'Previous frame'),
    NEXT_FRAME: t('hotkeys.nextFrame', 'Next frame'),
    GO_TO_START: t('hotkeys.goToStart', 'Go to start'),
    GO_TO_END: t('hotkeys.goToEnd', 'Go to end'),
    NEXT_SNAP_POINT: t('hotkeys.nextSnapPoint', 'Next snap point'),
    PREVIOUS_SNAP_POINT: t('hotkeys.prevSnapPoint', 'Previous snap point'),

    // Timeline editing
    SPLIT_AT_PLAYHEAD: t('hotkeys.splitAtPlayhead', 'Split at playhead'),
    JOIN_ITEMS: t('hotkeys.joinItems', 'Join selected clips'),
    DELETE_SELECTED: t('hotkeys.deleteSelected', 'Delete selected items'),
    DELETE_SELECTED_ALT: t('hotkeys.deleteSelectedAlt', 'Delete selected items (alternative)'),
    RIPPLE_DELETE: t('hotkeys.rippleDelete', 'Ripple delete selected items'),
    RIPPLE_DELETE_ALT: t('hotkeys.rippleDeleteAlt', 'Ripple delete selected items (alternative)'),
    FREEZE_FRAME: t('hotkeys.freezeFrame', 'Insert freeze frame at playhead'),
    NUDGE_LEFT: t('hotkeys.nudgeLeft', 'Nudge selected visual items left (1px)'),
    NUDGE_RIGHT: t('hotkeys.nudgeRight', 'Nudge selected visual items right (1px)'),
    NUDGE_UP: t('hotkeys.nudgeUp', 'Nudge selected visual items up (1px)'),
    NUDGE_DOWN: t('hotkeys.nudgeDown', 'Nudge selected visual items down (1px)'),
    NUDGE_LEFT_LARGE: t('hotkeys.nudgeLeftLarge', 'Nudge selected visual items left (10px)'),
    NUDGE_RIGHT_LARGE: t('hotkeys.nudgeRightLarge', 'Nudge selected visual items right (10px)'),
    NUDGE_UP_LARGE: t('hotkeys.nudgeUpLarge', 'Nudge selected visual items up (10px)'),
    NUDGE_DOWN_LARGE: t('hotkeys.nudgeDownLarge', 'Nudge selected visual items down (10px)'),

    // History
    UNDO: t('hotkeys.undo', 'Undo'),
    REDO: t('hotkeys.redo', 'Redo'),

    // Zoom
    ZOOM_TO_FIT: t('hotkeys.zoomToFit', 'Zoom to fit all content'),
    ZOOM_TO_100: t('hotkeys.zoomTo100', 'Zoom to 100% at cursor or playhead'),

    // Clipboard
    COPY: t('hotkeys.copy', 'Copy selected items or keyframes'),
    CUT: t('hotkeys.cut', 'Cut selected items or keyframes'),
    PASTE: t('hotkeys.paste', 'Paste items or keyframes'),

    // Tools
    SELECTION_TOOL: t('hotkeys.selectionTool', 'Selection tool'),
    RAZOR_TOOL: t('hotkeys.razorTool', 'Razor tool'),
    SPLIT_AT_CURSOR: t('hotkeys.splitAtCursor', 'Split at cursor'),
    RATE_STRETCH_TOOL: t('hotkeys.rateStretchTool', 'Rate stretch tool'),
    ROLLING_EDIT_TOOL: t('hotkeys.rollingEditTool', 'Rolling edit tool'),
    RIPPLE_EDIT_TOOL: t('hotkeys.rippleEditTool', 'Ripple edit tool'),
    SLIP_TOOL: t('hotkeys.slipTool', 'Slip tool'),
    SLIDE_TOOL: t('hotkeys.slideTool', 'Slide tool'),

    // Project
    SAVE: t('hotkeys.save', 'Save project'),
    EXPORT: t('hotkeys.export', 'Export video'),

    // UI
    TOGGLE_SNAP: t('hotkeys.toggleSnap', 'Toggle snap'),

    // Markers
    ADD_MARKER: t('hotkeys.addMarker', 'Add marker at playhead'),
    REMOVE_MARKER: t('hotkeys.removeMarker', 'Remove selected marker'),
    PREVIOUS_MARKER: t('hotkeys.prevMarker', 'Jump to previous marker'),
    NEXT_MARKER: t('hotkeys.nextMarker', 'Jump to next marker'),

    // Keyframes
    ADD_KEYFRAME: t('hotkeys.addKeyframe', 'Add keyframe at playhead'),
    CLEAR_KEYFRAMES: t('hotkeys.clearKeyframes', 'Clear all keyframes from selected items'),
    TOGGLE_KEYFRAME_EDITOR: t('hotkeys.toggleKeyframeEditor', 'Toggle keyframe editor panel'),
    KEYFRAME_EDITOR_GRAPH: t('hotkeys.keyframeGraph', 'Switch keyframe editor to graph view'),
    KEYFRAME_EDITOR_DOPESHEET: t('hotkeys.keyframeDopesheet', 'Switch keyframe editor to dopesheet view'),
    KEYFRAME_EDITOR_SPLIT: t('hotkeys.keyframeSplit', 'Switch keyframe editor to split view'),

    // Track Groups
    GROUP_TRACKS: t('hotkeys.groupTracks', 'Group selected tracks'),
    UNGROUP_TRACKS: t('hotkeys.ungroupTracks', 'Ungroup selected tracks'),

    // Source Monitor
    MARK_IN: t('hotkeys.markIn', 'Mark In point'),
    MARK_OUT: t('hotkeys.markOut', 'Mark Out point'),
    CLEAR_IN_OUT: t('hotkeys.clearInOut', 'Clear In/Out points'),
    INSERT_EDIT: t('hotkeys.insertEdit', 'Insert edit'),
    OVERWRITE_EDIT: t('hotkeys.overwriteEdit', 'Overwrite edit'),
  };

  const localizedCategories = [
    {
      name: t('hotkeys.catPlayback', 'Playback'),
      keys: ['PLAY_PAUSE', 'PREVIOUS_FRAME', 'NEXT_FRAME', 'GO_TO_START', 'GO_TO_END', 'PREVIOUS_SNAP_POINT', 'NEXT_SNAP_POINT'] as HotkeyKey[],
    },
    {
      name: t('hotkeys.catEditing', 'Editing'),
      keys: [
        'SPLIT_AT_PLAYHEAD',
        'JOIN_ITEMS',
        'DELETE_SELECTED',
        'RIPPLE_DELETE',
        'FREEZE_FRAME',
        'NUDGE_LEFT',
        'NUDGE_RIGHT',
        'NUDGE_UP',
        'NUDGE_DOWN',
        'NUDGE_LEFT_LARGE',
        'NUDGE_RIGHT_LARGE',
        'NUDGE_UP_LARGE',
        'NUDGE_DOWN_LARGE',
      ] as HotkeyKey[],
    },
    {
      name: t('hotkeys.catHistory', 'History'),
      keys: ['UNDO', 'REDO'] as HotkeyKey[],
    },
    {
      name: t('hotkeys.catZoom', 'Zoom'),
      keys: ['ZOOM_TO_FIT'] as HotkeyKey[],
      extra: [{ description: t('hotkeys.zoomInOut', 'Zoom in/out'), binding: 'Ctrl + Mouse Wheel' }],
    },
    {
      name: t('hotkeys.catClipboard', 'Clipboard'),
      keys: ['COPY', 'PASTE'] as HotkeyKey[],
      extra: [{ description: t('hotkeys.duplicate', 'Duplicate'), binding: 'Alt + Drag' }],
    },
    {
      name: t('hotkeys.catTools', 'Tools'),
      keys: ['SELECTION_TOOL', 'RAZOR_TOOL', 'SPLIT_AT_CURSOR', 'RATE_STRETCH_TOOL'] as HotkeyKey[],
    },
    {
      name: t('hotkeys.catProject', 'Project'),
      keys: ['SAVE', 'EXPORT'] as HotkeyKey[],
    },
    {
      name: t('hotkeys.catUI', 'UI'),
      keys: ['TOGGLE_SNAP'] as HotkeyKey[],
    },
    {
      name: t('hotkeys.catMarkers', 'Markers'),
      keys: ['ADD_MARKER', 'REMOVE_MARKER', 'PREVIOUS_MARKER', 'NEXT_MARKER'] as HotkeyKey[],
    },
    {
      name: t('hotkeys.catKeyframes', 'Keyframes'),
      keys: [
        'ADD_KEYFRAME',
        'CLEAR_KEYFRAMES',
        'TOGGLE_KEYFRAME_EDITOR',
        'KEYFRAME_EDITOR_GRAPH',
        'KEYFRAME_EDITOR_DOPESHEET',
        'KEYFRAME_EDITOR_SPLIT',
      ] as HotkeyKey[],
    },
    {
      name: t('hotkeys.catSourceMonitor', 'Source Monitor'),
      keys: ['MARK_IN', 'MARK_OUT', 'CLEAR_IN_OUT', 'INSERT_EDIT', 'OVERWRITE_EDIT'] as HotkeyKey[],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.keyboardShortcuts', 'Keyboard Shortcuts')}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {localizedCategories.map((category) => (
              <div key={category.name}>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {category.name}
                </h3>
                <div className="space-y-1">
                  {category.keys.map((key) => (
                    <div
                      key={key}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm">
                        {localizedDescriptions[key]}
                      </span>
                      <kbd className="px-2 py-0.5 text-xs font-mono bg-muted rounded border border-border">
                        {formatKeyBinding(HOTKEYS[key])}
                      </kbd>
                    </div>
                  ))}
                  {category.extra?.map((item) => (
                    <div
                      key={item.binding}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm">{item.description}</span>
                      <kbd className="px-2 py-0.5 text-xs font-mono bg-muted rounded border border-border">
                        {item.binding}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
