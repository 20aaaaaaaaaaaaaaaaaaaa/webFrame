import { useState, useCallback } from 'react';
import type { MediaMetadata } from '@/types/storage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RotateCcw, Trash2, Loader2, Check, ImagePlus, Film } from 'lucide-react';
import {
  LocalInferenceUnloadControl,
  useSettingsStore,
} from '@/features/editor/deps/settings';
import {
  useMediaLibraryStore,
  getSharedProxyKey,
  importProxyService,
  importMediaLibraryService,
  importThumbnailGenerator,
} from '@/features/editor/deps/media-library';
import {
  importGifFrameCache,
  importFilmstripCache,
  importWaveformCache,
} from '@/features/editor/deps/timeline-cache';
import { clearPreviewAudioCache } from '@/features/editor/deps/composition-runtime';
import { createLogger } from '@/shared/logging/logger';
import { EDITOR_DENSITY_OPTIONS } from '@/shared/ui/editor-layout';
import {
  getWhisperQuantizationOption,
  getWhisperLanguageSelectValue,
  getWhisperLanguageSettingValue,
  WHISPER_LANGUAGE_OPTIONS,
  WHISPER_MODEL_OPTIONS,
  WHISPER_QUANTIZATION_OPTIONS,
} from '@/shared/utils/whisper-settings';
import type { MediaTranscriptModel, MediaTranscriptQuantization } from '@/types/storage';
import { useTranslation } from 'react-i18next';

const log = createLogger('SettingsDialog');

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Clear regenerable cache data for the current project's media only.
 * Clears filmstrips, waveforms, GIF frames, and decoded audio
 * scoped to the given media IDs.
 *
 * Does NOT clear thumbnails (not auto-regenerated) or proxies (separate action).
 */
async function clearProjectCaches(mediaIds: string[]): Promise<void> {
  if (mediaIds.length === 0) return;

  const [
    { deleteWaveform },
    { deleteGifFrames },
    { deleteDecodedPreviewAudio },
    { gifFrameCache },
    { filmstripCache },
    { waveformCache },
  ] = await Promise.all([
    import('@/infrastructure/storage/indexeddb/waveforms'),
    import('@/infrastructure/storage/indexeddb/gif-frames'),
    import('@/infrastructure/storage/indexeddb/decoded-preview-audio'),
    importGifFrameCache(),
    importFilmstripCache(),
    importWaveformCache(),
  ]);

  // Clear in-memory preview audio cache (not keyed per-media, so clear all)
  clearPreviewAudioCache();

  await Promise.all(
    mediaIds.flatMap((id) => [
      deleteWaveform(id).catch((e) => { log.debug('Failed to delete waveform:', id, e); }),
      deleteGifFrames(id).catch((e) => { log.debug('Failed to delete GIF frames:', id, e); }),
      deleteDecodedPreviewAudio(id).catch((e) => { log.debug('Failed to delete decoded audio:', id, e); }),
      gifFrameCache.clearMedia(id).catch((e) => { log.debug('Failed to clear GIF cache:', id, e); }),
      filmstripCache.clearMedia(id).catch((e) => { log.debug('Failed to clear filmstrip cache:', id, e); }),
      waveformCache.clearMedia(id).catch((e) => { log.debug('Failed to clear waveform cache:', id, e); }),
    ])
  );

  log.info(`Cleared caches for ${mediaIds.length} media items`);
}

/** Delete all proxy videos for the given media items and clear their store status. */
async function clearProjectProxies(
  mediaItems: MediaMetadata[]
): Promise<void> {
  if (mediaItems.length === 0) return;

  const { proxyService } = await importProxyService();

  await Promise.all(mediaItems.map(async (media) => {
    try {
      await proxyService.deleteProxy(media.id, getSharedProxyKey(media));
    } catch { /* already absent */ }
    useMediaLibraryStore.getState().clearProxyStatus(media.id);
    proxyService.clearProxyKey(media.id);
  }));

  log.info(`Cleared proxies for ${mediaItems.length} media items`);
}

/**
 * Regenerate thumbnails for all media in the current project.
 * Fetches each media file, generates a new thumbnail, and saves it to IndexedDB.
 */
async function regenerateProjectThumbnails(
  mediaItems: Array<{ id: string; fileName: string; mimeType: string }>,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  if (mediaItems.length === 0) return 0;

  const [
    { mediaLibraryService },
    { generateThumbnail },
    { saveThumbnail },
    { updateMedia },
  ] = await Promise.all([
    importMediaLibraryService(),
    importThumbnailGenerator(),
    import('@/infrastructure/storage/indexeddb/thumbnails'),
    import('@/infrastructure/storage/indexeddb/media'),
  ]);

  let regenerated = 0;

  for (const media of mediaItems) {
    try {
      const blob = await mediaLibraryService.getMediaFile(media.id);
      if (!blob) continue;

      // generateThumbnail expects a File (needs .name for extension-based mime detection)
      const file = new File([blob], media.fileName, { type: media.mimeType });
      const thumbnailBlob = await generateThumbnail(file);

      const thumbnailId = crypto.randomUUID();
      await saveThumbnail({
        id: thumbnailId,
        mediaId: media.id,
        blob: thumbnailBlob,
        timestamp: 1,
        width: 320,
        height: 180,
      });

      // Update the media record so the new thumbnailId propagates to the store
      await updateMedia(media.id, { thumbnailId });

      // Clear the in-memory blob URL cache so UI picks up the new thumbnail
      mediaLibraryService.clearThumbnailCache(media.id);
      regenerated++;
    } catch (err) {
      log.warn(`Failed to regenerate thumbnail for ${media.fileName}:`, err);
    }
    onProgress?.(regenerated, mediaItems.length);
  }

  // Reload store so MediaCards see the updated thumbnailId and re-fetch
  await useMediaLibraryStore.getState().loadMediaItems();

  log.info(`Regenerated ${regenerated}/${mediaItems.length} thumbnails`);
  return regenerated;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const editorDensity = useSettingsStore((s) => s.editorDensity);
  const showWaveforms = useSettingsStore((s) => s.showWaveforms);
  const showFilmstrips = useSettingsStore((s) => s.showFilmstrips);
  const autoSaveInterval = useSettingsStore((s) => s.autoSaveInterval);
  const maxUndoHistory = useSettingsStore((s) => s.maxUndoHistory);
  const defaultWhisperModel = useSettingsStore((s) => s.defaultWhisperModel);
  const defaultWhisperQuantization = useSettingsStore((s) => s.defaultWhisperQuantization);
  const defaultWhisperLanguage = useSettingsStore((s) => s.defaultWhisperLanguage);
  const setSetting = useSettingsStore((s) => s.setSetting);
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);
  const language = useSettingsStore((s) => s.language);
  const { t, i18n } = useTranslation();

  const mediaItems = useMediaLibraryStore((s) => s.mediaItems);

  const [clearState, setClearState] = useState<'idle' | 'clearing' | 'done'>('idle');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [regenState, setRegenState] = useState<'idle' | 'working' | 'done'>('idle');
  const [regenProgress, setRegenProgress] = useState('');
  const [proxyState, setProxyState] = useState<'idle' | 'clearing' | 'done'>('idle');

  const handleClearCache = useCallback(async () => {
    setClearState('clearing');
    try {
      const ids = mediaItems.map((m) => m.id);
      await clearProjectCaches(ids);
      setClearState('done');
      setTimeout(() => setClearState('idle'), 2000);
    } catch (err) {
      log.error('Failed to clear caches', err);
      setClearState('idle');
    }
  }, [mediaItems]);

  const handleRegenThumbnails = useCallback(async () => {
    setRegenState('working');
    setRegenProgress('0/' + mediaItems.length);
    try {
      const items = mediaItems.map((m) => ({ id: m.id, fileName: m.fileName, mimeType: m.mimeType }));
      await regenerateProjectThumbnails(items, (done, total) => {
        setRegenProgress(`${done}/${total}`);
      });
      setRegenState('done');
      setTimeout(() => {
        setRegenState('idle');
        setRegenProgress('');
      }, 2000);
    } catch (err) {
      log.error('Failed to regenerate thumbnails', err);
      setRegenState('idle');
      setRegenProgress('');
    }
  }, [mediaItems]);

  const handleClearProxies = useCallback(async () => {
    setProxyState('clearing');
    try {
      await clearProjectProxies(mediaItems);
      setProxyState('done');
      setTimeout(() => setProxyState('idle'), 2000);
    } catch (err) {
      log.error('Failed to clear proxies', err);
      setProxyState('idle');
    }
  }, [mediaItems]);

  const defaultWhisperLanguageValue = getWhisperLanguageSelectValue(defaultWhisperLanguage);
  const defaultWhisperQuantizationOption = getWhisperQuantizationOption(defaultWhisperQuantization);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="flex flex-row items-center justify-between border-b px-6 py-4 pr-14">
          <DialogTitle>{t('settings.editorSettings', 'Editor Settings')}</DialogTitle>
          <Button variant="ghost" size="sm" onClick={resetToDefaults} className="h-8 shrink-0 gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            {t('settings.reset', 'Reset')}
          </Button>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6 px-6 py-5 pr-7">
            {/* Interface */}
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">{t('settings.interface', 'Interface')}</h3>
              <div className="space-y-1.5">
                <Label className="text-sm">{t('settings.editorDensity', 'Editor Density')}</Label>
                <Select
                  value={editorDensity}
                  onValueChange={(value) => setSetting('editorDensity', value as typeof editorDensity)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EDITOR_DENSITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('settings.editorDensityHint', 'Compact fits more of the editor into a 1080p screen. Default restores the roomier layout.')}
                </p>
              </div>

              <div className="space-y-1.5 pt-2">
                <Label className="text-sm">{t('settings.language', 'Language')}</Label>
                <Select
                  value={language}
                  onValueChange={(value) => {
                    setSetting('language', value);
                    if (value !== 'system') {
                       i18n.changeLanguage(value);
                    } else {
                       window.location.reload(); 
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">{t('system', 'System Default')}</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="tr">Türkçe</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('settings.languageDesc', 'Select the application interface language')}
                </p>
              </div>
            </section>

            {/* General */}
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">{t('settings.general', 'General')}</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t('settings.autoSave', 'Auto-save')}</Label>
                  <Switch
                    checked={autoSaveInterval > 0}
                    onCheckedChange={(v) => setSetting('autoSaveInterval', v ? 5 : 0)}
                  />
                </div>
                {autoSaveInterval > 0 && (
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">{t('settings.interval', 'Interval')}</Label>
                    <div className="w-32 flex items-center gap-2">
                      <Slider
                        value={[autoSaveInterval]}
                        onValueChange={([v]) => setSetting('autoSaveInterval', v || 5)}
                        min={5}
                        max={30}
                        step={5}
                      />
                      <span className="text-xs text-muted-foreground w-6">{autoSaveInterval}m</span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Timeline */}
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">{t('settings.timeline', 'Timeline')}</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t('settings.showWaveforms', 'Show Waveforms')}</Label>
                  <Switch checked={showWaveforms} onCheckedChange={(v) => setSetting('showWaveforms', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t('settings.showFilmstrips', 'Show Filmstrips')}</Label>
                  <Switch checked={showFilmstrips} onCheckedChange={(v) => setSetting('showFilmstrips', v)} />
                </div>
              </div>
            </section>

            {/* Performance */}
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">{t('settings.performance', 'Performance')}</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t('settings.undoHistoryDepth', 'Undo History Depth')}</Label>
                  <div className="w-32 flex items-center gap-2">
                    <Slider
                      value={[maxUndoHistory]}
                      onValueChange={([v]) => setSetting('maxUndoHistory', v || 10)}
                      min={10}
                      max={200}
                      step={10}
                    />
                    <span className="text-xs text-muted-foreground w-6">{maxUndoHistory}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Whisper */}            
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Whisper</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">{t('settings.defaultModel', 'Default Model')}</Label>
                  <Select
                    value={defaultWhisperModel}
                    onValueChange={(value) =>
                      setSetting('defaultWhisperModel', value as MediaTranscriptModel)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WHISPER_MODEL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.defaultModelHint', 'Used when transcription starts without an explicit model override.')}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">{t('settings.defaultQuantization', 'Default Quantization')}</Label>
                  <Select
                    value={defaultWhisperQuantization}
                    onValueChange={(value) =>
                      setSetting('defaultWhisperQuantization', value as MediaTranscriptQuantization)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WHISPER_QUANTIZATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.defaultQuantizationHint', 'Pick based on memory first.')} {defaultWhisperQuantizationOption?.description ?? ''}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">{t('settings.defaultLanguage', 'Default Language')}</Label>
                  <Combobox
                    value={defaultWhisperLanguageValue}
                    onValueChange={(value) =>
                      setSetting('defaultWhisperLanguage', getWhisperLanguageSettingValue(value))
                    }
                    options={WHISPER_LANGUAGE_OPTIONS}
                    placeholder={t('settings.autoDetect', 'Auto-detect')}
                    searchPlaceholder={t('settings.searchLanguages', 'Search languages...')}
                    emptyMessage={t('settings.noLanguagesMatch', 'No languages match that search.')}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('settings.defaultLanguageHint', 'Choose Auto-detect to infer the language, or lock transcription to a known language for faster startup.')}
                  </p>
                </div>

                <LocalInferenceUnloadControl />
              </div>
            </section>

            {/* Storage */}
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">{t('settings.storage', 'Storage')}</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">{t('settings.clearProjectCache', 'Clear Project Cache')}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('settings.clearProjectCacheHint', 'Waveforms, filmstrips, GIF frames, decoded audio')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-28 gap-1.5"
                    onClick={() => setShowClearConfirm(true)}
                    disabled={clearState !== 'idle'}
                  >
                    {clearState === 'clearing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {clearState === 'done' && <Check className="w-3.5 h-3.5" />}
                    {clearState === 'idle' && <Trash2 className="w-3.5 h-3.5" />}
                    {clearState === 'clearing' ? t('settings.clearing', 'Clearing...') : clearState === 'done' ? t('settings.cleared', 'Cleared') : t('settings.clear', 'Clear')}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">{t('settings.regenerateThumbnails', 'Regenerate Thumbnails')}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('settings.regenerateThumbnailsHint', 'Re-create media library thumbnails for this project')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-28 gap-1.5"
                    onClick={handleRegenThumbnails}
                    disabled={regenState !== 'idle'}
                  >
                    {regenState === 'working' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {regenState === 'done' && <Check className="w-3.5 h-3.5" />}
                    {regenState === 'idle' && <ImagePlus className="w-3.5 h-3.5" />}
                    {regenState === 'working' ? regenProgress : regenState === 'done' ? t('settings.done', 'Done') : t('settings.regenerate', 'Regenerate')}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">{t('settings.deleteProxies', 'Delete Proxies')}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('settings.deleteProxiesHint', 'Remove generated proxy videos for this project')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-28 gap-1.5"
                    onClick={handleClearProxies}
                    disabled={proxyState !== 'idle'}
                  >
                    {proxyState === 'clearing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {proxyState === 'done' && <Check className="w-3.5 h-3.5" />}
                    {proxyState === 'idle' && <Film className="w-3.5 h-3.5" />}
                    {proxyState === 'clearing' ? t('settings.deleting', 'Deleting...') : proxyState === 'done' ? t('settings.deleted', 'Deleted') : t('common.delete', 'Delete')}
                  </Button>
                </div>
              </div>
            </section>

          </div>
        </ScrollArea>
      </DialogContent>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.clearProjectCacheConfirmTitle', 'Clear project cache?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.clearProjectCacheConfirmDesc', 'This will delete cached waveforms, filmstrips, GIF frames, and decoded audio for the current project ({{count}} media items). These will be regenerated automatically when needed. Your project data, media files, thumbnails, and proxies will not be affected.', { count: mediaItems.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('timeline.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleClearCache();
              }}
            >
              {t('settings.clearCacheBtn', 'Clear Cache')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
