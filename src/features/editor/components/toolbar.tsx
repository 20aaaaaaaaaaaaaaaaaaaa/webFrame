import { memo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  Download,
  FolderArchive,
  Save,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { LocalInferenceStatusPill } from './local-inference-status-pill';
import { UnsavedChangesDialog } from './unsaved-changes-dialog';
import { useTranslation } from 'react-i18next';

interface ToolbarProps {
  projectId: string;
  project: {
    id: string;
    name: string;
    width: number;
    height: number;
    fps: number;
    backgroundColor?: string;
  };
  isDirty?: boolean;
  onSave?: () => Promise<void>;
  onExport?: () => void;
  onExportBundle?: () => void;
}

export const Toolbar = memo(function Toolbar({
  project,
  isDirty = false,
  onSave,
  onExport,
  onExportBundle,
}: ToolbarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const handleBackClick = () => {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      navigate({ to: '/projects' });
    }
  };

  const handleSave = async () => {
    if (onSave) {
      await onSave();
    }
  };

  return (
    <div
      className="flex flex-col h-full w-full items-center py-4 px-2.5 gap-4 overflow-y-auto"
      role="toolbar"
      aria-label="Editor toolbar"
    >
      <div className="flex flex-col items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleBackClick}
          data-tooltip={t('editor.close', 'Close Project')}
          data-tooltip-side="right"
          aria-label={t('editor.close', 'Close Project')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <UnsavedChangesDialog
          open={showUnsavedDialog}
          onOpenChange={setShowUnsavedDialog}
          onSave={handleSave}
          projectName={project?.name}
        />

        <Separator className="w-8" />

        <div className="flex flex-col items-center text-center -space-y-0.5 mt-1">
          <h1 className="text-xs font-medium leading-tight line-clamp-3 px-1">
            {project?.name || 'Untitled Project'}
          </h1>
          <span className="font-mono text-[10px] text-muted-foreground mt-1">
            {project?.fps}fps
          </span>
        </div>
      </div>
      <div className="flex-1" />

      {/* Put local inference visually close to the bottom if possible, before primary actions */}
      <div className="w-full">
        <LocalInferenceStatusPill />
      </div>

      <div className="flex flex-col items-center gap-2 w-full mt-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 justify-center"
          onClick={handleSave}
          aria-label={t('editor.save', 'Save Project')}
        >
          <div className="relative">
            <Save className="h-4 w-4" />
            {isDirty && (
              <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-green-700" />
            )}
          </div>
          {t('editor.save', 'Save')}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="w-full gap-1.5 glow-primary-sm justify-center">
              <Download className="h-4 w-4" />
              {t('editor.export', 'Export')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExport} className="gap-2">
              <Video className="h-4 w-4" />
              {t('export.title', 'Export Video')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportBundle} className="gap-2">
              <FolderArchive className="h-4 w-4" />
              {t('projects.importProject', 'Download Project (.zip)').replace('Import', 'Download').replace('İçe Aktar', 'İndir')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
