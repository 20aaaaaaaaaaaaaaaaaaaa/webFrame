/**
 * DockablePanel
 *
 * Wraps each editor panel with a floating drag grip button (no header bar).
 * The grip appears on hover in the top-left corner.
 * During drag, other panels show a highlighted drop zone overlay.
 * Supports swap (drop on panel) and edge docking (drop on edge zones).
 */
import { memo, useCallback, useEffect } from 'react';
import { GripVertical, RotateCcw } from 'lucide-react';
import {
  usePanelLayoutStore,
  selectIsDefault,
  PANEL_LABELS,
  type PanelId,
} from '@/shared/state/panel-layout-store';

interface DockablePanelProps {
  panelId: PanelId;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const DockablePanel = memo(function DockablePanel({
  panelId,
  children,
  className,
  style,
}: DockablePanelProps) {
  const draggingPanel = usePanelLayoutStore((s) => s.draggingPanel);
  const dropTarget = usePanelLayoutStore((s) => s.dropTarget);
  const startDrag = usePanelLayoutStore((s) => s.startDrag);
  const setDropTarget = usePanelLayoutStore((s) => s.setDropTarget);
  const endDrag = usePanelLayoutStore((s) => s.endDrag);
  const resetLayout = usePanelLayoutStore((s) => s.resetLayout);
  const isDefault = usePanelLayoutStore(selectIsDefault);

  const isDragging = draggingPanel === panelId;
  const isDropTarget =
    dropTarget === panelId && draggingPanel !== null && draggingPanel !== panelId;
  const isDragActive = draggingPanel !== null;

  const handleGripMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startDrag(panelId);
    },
    [panelId, startDrag]
  );

  // Global mouseup to end drag
  useEffect(() => {
    if (!isDragActive) return;
    const handleMouseUp = () => endDrag();
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isDragActive, endDrag]);

  const handleOverlayMouseEnter = useCallback(() => {
    if (isDragActive && draggingPanel !== panelId) {
      setDropTarget(panelId);
    }
  }, [isDragActive, draggingPanel, panelId, setDropTarget]);

  const handleOverlayMouseLeave = useCallback(() => {
    if (dropTarget === panelId) {
      setDropTarget(null);
    }
  }, [dropTarget, panelId, setDropTarget]);

  return (
    <div
      className={`relative overflow-hidden group/dock ${className || ''}`}
      style={style}
    >
      {/* Panel content — fills entire area, no header bar */}
      <div
        className={`h-full w-full flex flex-col overflow-hidden transition-opacity duration-150 ${
          isDragging ? 'opacity-30' : ''
        }`}
      >
        {children}
      </div>

      {/* Floating drag grip — top-left corner, appears on hover */}
      {!isDragActive && (
        <div className="absolute top-1 left-1 z-20 opacity-0 group-hover/dock:opacity-100 transition-opacity duration-200 flex gap-0.5">
          <button
            onMouseDown={handleGripMouseDown}
            className="w-6 h-6 rounded-md flex items-center justify-center bg-black/50 hover:bg-primary/80 cursor-grab active:cursor-grabbing backdrop-blur-sm shadow-lg border border-white/10 transition-colors"
            title={`${PANEL_LABELS[panelId]} — Taşımak için sürükle`}
          >
            <GripVertical className="w-3.5 h-3.5 text-white/80" />
          </button>
          {/* Reset button — only when layout has been changed */}
          {!isDefault && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetLayout();
              }}
              className="w-6 h-6 rounded-md flex items-center justify-center bg-black/50 hover:bg-orange-500/80 cursor-pointer backdrop-blur-sm shadow-lg border border-white/10 transition-colors"
              title="Varsayılan düzene sıfırla"
            >
              <RotateCcw className="w-2.5 h-2.5 text-white/80" />
            </button>
          )}
        </div>
      )}

      {/* Drop target overlay — visible on OTHER panels during drag */}
      {isDragActive && !isDragging && (
        <div
          className={`absolute inset-0 z-30 transition-all duration-100 ${
            isDropTarget
              ? 'bg-primary/20 ring-2 ring-inset ring-primary'
              : 'bg-transparent'
          }`}
          onMouseEnter={handleOverlayMouseEnter}
          onMouseLeave={handleOverlayMouseLeave}
        >
          {isDropTarget && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-md text-xs font-medium shadow-lg backdrop-blur-sm">
                {PANEL_LABELS[draggingPanel!]} ↔ {PANEL_LABELS[panelId]}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

/**
 * EdgeDropZone
 *
 * Thin strip on the left/right edge of the editor.
 * Visible only during drag — dropping here docks the panel to full height.
 */
export const EdgeDropZone = memo(function EdgeDropZone({
  side,
}: {
  side: 'left' | 'right';
}) {
  const draggingPanel = usePanelLayoutStore((s) => s.draggingPanel);
  const dropTarget = usePanelLayoutStore((s) => s.dropTarget);
  const setDropTarget = usePanelLayoutStore((s) => s.setDropTarget);

  const isDragActive = draggingPanel !== null;
  const edgeId = `edge-${side}` as const;
  const isActive = dropTarget === edgeId;

  const handleMouseEnter = useCallback(() => {
    if (isDragActive) setDropTarget(edgeId);
  }, [isDragActive, edgeId, setDropTarget]);

  const handleMouseLeave = useCallback(() => {
    if (dropTarget === edgeId) setDropTarget(null);
  }, [dropTarget, edgeId, setDropTarget]);

  if (!isDragActive) return null;

  return (
    <div
      className={`absolute ${side === 'left' ? 'left-0' : 'right-0'} top-0 bottom-0 w-5 z-40 transition-all duration-100 ${
        isActive ? 'bg-primary/25' : 'bg-transparent'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Bright edge indicator */}
      <div
        className={`absolute ${side === 'left' ? 'left-0' : 'right-0'} top-0 bottom-0 w-1 transition-all duration-100 ${
          isActive ? 'bg-primary shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-transparent'
        }`}
      />
      {isActive && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 ${
            side === 'left' ? 'left-6' : 'right-6'
          } pointer-events-none`}
        >
          <div className="bg-primary/90 text-primary-foreground px-2 py-1 rounded text-[10px] font-medium shadow-lg whitespace-nowrap backdrop-blur-sm">
            Tam yükseklikte {side === 'left' ? 'sola' : 'sağa'} yerleştir
          </div>
        </div>
      )}
    </div>
  );
});
