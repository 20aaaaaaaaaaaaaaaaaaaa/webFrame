/**
 * Panel Layout Store
 *
 * Manages editor panel positions with support for:
 * - Standard 3+1 layout (3 top panels + 1 bottom)
 * - Full-height edge docking (any panel can dock left/right spanning full height)
 * - Drag-to-swap between panels
 * - localStorage persistence
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PanelId = 'media' | 'preview' | 'properties' | 'timeline';

export const PANEL_LABELS: Record<PanelId, string> = {
  media: 'Media',
  preview: 'Preview',
  properties: 'Properties',
  timeline: 'Timeline',
};

interface PanelLayoutState {
  /** Panel docked to full-height edge (null = standard 3+1 layout) */
  dockedPanel: PanelId | null;
  /** Which side the docked panel is on */
  dockedSide: 'left' | 'right';
  /** Order of panels in the main area (excludes docked panel if any)
   *  Standard mode (4 panels): [topLeft, topCenter, topRight, bottom]
   *  Docked mode (3 panels): [topLeft, topRight, bottom]
   */
  mainOrder: PanelId[];

  /** Currently dragging this panel */
  draggingPanel: PanelId | null;
  /** Drop target: panel ID for swap, 'edge-left'/'edge-right' for docking */
  dropTarget: string | null;

  startDrag: (panel: PanelId) => void;
  setDropTarget: (target: string | null) => void;
  endDrag: () => void;
  resetLayout: () => void;
}

const DEFAULT_MAIN_ORDER: PanelId[] = ['media', 'preview', 'properties', 'timeline'];

export const usePanelLayoutStore = create<PanelLayoutState>()(
  persist(
    (set, get) => ({
      dockedPanel: null,
      dockedSide: 'right',
      mainOrder: [...DEFAULT_MAIN_ORDER],
      draggingPanel: null,
      dropTarget: null,

      startDrag: (panel) => {
        set({ draggingPanel: panel });
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      },

      setDropTarget: (target) => set({ dropTarget: target }),

      endDrag: () => {
        const { draggingPanel, dropTarget, dockedPanel, mainOrder } = get();
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        if (!draggingPanel || !dropTarget) {
          set({ draggingPanel: null, dropTarget: null });
          return;
        }

        // ── Edge docking (Left / Right) ──
        if (dropTarget === 'edge-right' || dropTarget === 'edge-left') {
          const side = dropTarget === 'edge-right' ? 'right' : 'left';

          if (dockedPanel === draggingPanel) {
            // Already docked — just switch side
            set({ dockedSide: side, draggingPanel: null, dropTarget: null });
            return;
          }

          // Dock this panel; if another was docked, put it back
          const restored = dockedPanel
            ? [dockedPanel, ...mainOrder.filter((p) => p !== draggingPanel)]
            : mainOrder.filter((p) => p !== draggingPanel);

          set({
            dockedPanel: draggingPanel,
            dockedSide: side,
            mainOrder: restored,
            draggingPanel: null,
            dropTarget: null,
          });
          return;
        }

        // ── Edge docking (Bottom) ──
        if (dropTarget === 'edge-bottom') {
          // Dropping to bottom means placing this panel at the end of mainOrder.
          // If this panel was the docked full-height panel, clear the dock state.
          const isDocked = dockedPanel === draggingPanel;
          const newDockedPanel = isDocked ? null : dockedPanel;

          // Gather all panels in mainOrder (and the old docked if it's being restored)
          // Wait, if we aren't restoring an old docked, we just filter out the dragging panel from mainOrder.
          let availablePanels = [...mainOrder];
          if (isDocked) {
             // It was docked, so it wasn't in mainOrder anyway.
          } else {
             // It was in mainOrder, so remove it.
             availablePanels = availablePanels.filter(p => p !== draggingPanel);
          }

          set({
            dockedPanel: newDockedPanel,
            mainOrder: [...availablePanels, draggingPanel],
            draggingPanel: null,
            dropTarget: null,
          });
          return;
        }

        // ── Panel swap ──
        const targetPanel = dropTarget as PanelId;
        if (targetPanel === draggingPanel) {
          set({ draggingPanel: null, dropTarget: null });
          return;
        }

        // Dragging docked panel onto a main panel → swap roles
        if (draggingPanel === dockedPanel) {
          const newMain = mainOrder.map((p) => (p === targetPanel ? draggingPanel : p));
          set({
            dockedPanel: targetPanel,
            mainOrder: newMain,
            draggingPanel: null,
            dropTarget: null,
          });
          return;
        }

        // Dragging main panel onto docked panel → swap roles
        if (targetPanel === dockedPanel && dockedPanel !== null) {
          const newMain = mainOrder.map((p) =>
            p === draggingPanel ? dockedPanel : p
          ) as PanelId[];
          set({
            dockedPanel: draggingPanel,
            mainOrder: newMain,
            draggingPanel: null,
            dropTarget: null,
          });
          return;
        }

        // Both in main area → swap indices
        const next = [...mainOrder];
        const ai = next.indexOf(draggingPanel);
        const bi = next.indexOf(targetPanel);
        if (ai !== -1 && bi !== -1) {
          next[ai] = targetPanel;
          next[bi] = draggingPanel;
        }
        set({ mainOrder: next, draggingPanel: null, dropTarget: null });
      },

      resetLayout: () =>
        set({
          dockedPanel: null,
          dockedSide: 'right',
          mainOrder: [...DEFAULT_MAIN_ORDER],
        }),
    }),
    {
      name: 'webframe-panel-layout',
      partialize: (s) => ({
        dockedPanel: s.dockedPanel,
        dockedSide: s.dockedSide,
        mainOrder: s.mainOrder,
      }),
    }
  )
);

/** Selector: true when layout matches factory default */
export const selectIsDefault = (s: PanelLayoutState): boolean =>
  s.dockedPanel === null &&
  s.mainOrder.length === 4 &&
  s.mainOrder[0] === 'media' &&
  s.mainOrder[1] === 'preview' &&
  s.mainOrder[2] === 'properties' &&
  s.mainOrder[3] === 'timeline';
