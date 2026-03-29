import { useCallback, useMemo, memo } from 'react';
import { Maximize2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TimelineItem } from '@/types/timeline';
import { useTimelineStore } from '@/features/editor/deps/timeline-store';
import { useCornerPinStore } from '@/features/editor/deps/preview';
import {
  PropertySection,
  PropertyRow,
  NumberInput,
} from '../components';
import { useTranslation } from 'react-i18next';

interface CornerPinSectionProps {
  items: TimelineItem[];
}

type CornerKey = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';

const DEFAULT_PIN = {
  topLeft: [0, 0] as [number, number],
  topRight: [0, 0] as [number, number],
  bottomRight: [0, 0] as [number, number],
  bottomLeft: [0, 0] as [number, number],
};

const CORNER_LABELS: Record<CornerKey, string> = {
  topLeft: 'properties.tl',
  topRight: 'properties.tr',
  bottomRight: 'properties.br',
  bottomLeft: 'properties.bl',
};

/**
 * Corner Pin section — perspective warp via 4 corner offsets.
 * Only shown for single-item selection.
 */
export const CornerPinSection = memo(function CornerPinSection({
  items,
}: CornerPinSectionProps) {
  const updateItem = useTimelineStore((s) => s.updateItem);
  const {
    isEditing: isCornerPinEditing,
    editingItemId,
    startEditing,
    stopEditing,
  } = useCornerPinStore();
  const { t } = useTranslation();

  const item = items.length === 1 ? items[0]! : null;
  const cornerPin = item?.cornerPin ?? DEFAULT_PIN;
  const isEditingThisItem = isCornerPinEditing && editingItemId === item?.id;

  const hasAnyOffset = useMemo(() => {
    return (
      cornerPin.topLeft[0] !== 0 || cornerPin.topLeft[1] !== 0 ||
      cornerPin.topRight[0] !== 0 || cornerPin.topRight[1] !== 0 ||
      cornerPin.bottomRight[0] !== 0 || cornerPin.bottomRight[1] !== 0 ||
      cornerPin.bottomLeft[0] !== 0 || cornerPin.bottomLeft[1] !== 0
    );
  }, [cornerPin]);

  // Update a single corner's X or Y value
  const handleCornerChange = useCallback(
    (corner: CornerKey, axis: 0 | 1, value: number) => {
      if (!item) return;
      const current = item.cornerPin ?? DEFAULT_PIN;
      const newCorner: [number, number] = [...current[corner]];
      newCorner[axis] = value;
      updateItem(item.id, {
        cornerPin: { ...current, [corner]: newCorner },
      });
    },
    [item, updateItem],
  );

  // Reset all corners to [0, 0]
  const handleReset = useCallback(() => {
    if (!item) return;
    updateItem(item.id, { cornerPin: undefined });
  }, [item, updateItem]);

  // Toggle interactive editing
  const toggleEditMode = useCallback(() => {
    if (isEditingThisItem) {
      stopEditing();
    } else if (item) {
      startEditing(item.id);
    }
  }, [isEditingThisItem, item, startEditing, stopEditing]);

  if (!item || items.length > 1) return null;

  return (
    <PropertySection title={t('properties.cornerPin', 'Corner Pin')} icon={Maximize2} defaultOpen={false}>
      {/* Edit + Reset toolbar */}
      <div className="flex items-center gap-1 px-1 mb-2">
        <Button
          variant={isEditingThisItem ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs flex-1 gap-1"
          onClick={toggleEditMode}
          title={isEditingThisItem ? t('properties.exitCornerPin', 'Exit corner pin editor') : t('properties.editCornerPin', 'Edit corners on preview')}
        >
          <Maximize2 className="w-3 h-3" />
          {isEditingThisItem ? t('properties.editing', 'Editing...') : t('properties.edit', 'Edit')}
        </Button>
        {hasAnyOffset && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={handleReset}
            title={t('properties.resetCornerPin', 'Reset corner pin')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Corner inputs - 4 rows with X/Y for each corner */}
      {(Object.keys(CORNER_LABELS) as CornerKey[]).map((corner) => (
        <PropertyRow key={corner} label={t(CORNER_LABELS[corner], CORNER_LABELS[corner].replace('properties.', '').toUpperCase())}>
          <div className="flex items-center gap-1 w-full">
            <NumberInput
              value={cornerPin[corner][0]}
              onChange={(v) => handleCornerChange(corner, 0, v)}
              min={-2000}
              max={2000}
              step={1}
              unit="x"
              className="flex-1 min-w-0"
            />
            <NumberInput
              value={cornerPin[corner][1]}
              onChange={(v) => handleCornerChange(corner, 1, v)}
              min={-2000}
              max={2000}
              step={1}
              unit="y"
              className="flex-1 min-w-0"
            />
          </div>
        </PropertyRow>
      ))}
    </PropertySection>
  );
});
