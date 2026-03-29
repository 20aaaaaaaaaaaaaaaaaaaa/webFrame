import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Save, Trash2 } from 'lucide-react';
import { createLogger } from '@/shared/logging/logger';
import { useTranslation } from 'react-i18next';

const logger = createLogger('UnsavedChangesDialog');

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => Promise<void>;
  projectName?: string;
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onSave,
  projectName,
}: UnsavedChangesDialogProps) {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation();

  const handleSaveAndExit = async () => {
    setIsSaving(true);
    try {
      await onSave();
      onOpenChange(false);
      navigate({ to: '/projects' });
    } catch (error) {
      logger.error('Failed to save project:', error);
      // Keep dialog open on error
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    onOpenChange(false);
    navigate({ to: '/projects' });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('editor.unsavedChanges', 'Unsaved Changes')}</AlertDialogTitle>
          <AlertDialogDescription>
            {projectName ? (
              <>
                {t('editor.unsavedChangesDescNamed1', 'You have unsaved changes in ')}<strong>{projectName}</strong>{t('editor.unsavedChangesDescNamed2', '. Would you like to save before leaving?')}
              </>
            ) : (
              t('editor.unsavedChangesDesc', 'You have unsaved changes. Would you like to save before leaving?')
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isSaving}>{t('timeline.cancel', 'Cancel')}</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDiscard}
            disabled={isSaving}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {t('editor.discard', 'Discard')}
          </Button>
          <AlertDialogAction
            onClick={handleSaveAndExit}
            disabled={isSaving}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? t('projects.saving', 'Saving...') : t('editor.saveAndExit', 'Save & Exit')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
