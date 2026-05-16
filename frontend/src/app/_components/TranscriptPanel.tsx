import { useMemo } from 'react';
import { Copy, GlobeIcon } from 'lucide-react';

import { VirtualizedTranscriptView } from '@/components/VirtualizedTranscriptView';
import { PermissionWarning } from '@/components/PermissionWarning';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useConfig } from '@/contexts/ConfigContext';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { useI18n } from '@/contexts/I18nContext';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import { ModalType } from '@/hooks/useModalState';
import { useIsLinux } from '@/hooks/usePlatform';

interface TranscriptPanelProps {
  isProcessingStop: boolean;
  isStopping: boolean;
  showModal: (name: ModalType, message?: string) => void;
}

export function TranscriptPanel({
  isProcessingStop,
  isStopping,
  showModal,
}: TranscriptPanelProps) {
  const {
    transcripts,
    transcriptContainerRef,
    copyTranscript,
    translationEnabled,
    setTranslationEnabled,
  } = useTranscripts();
  const { transcriptModelConfig } = useConfig();
  const { isRecording, isPaused } = useRecordingState();
  const { checkPermissions, isChecking, hasSystemAudio, hasMicrophone } = usePermissionCheck();
  const isLinux = useIsLinux();
  const { t } = useI18n();

  const segments = useMemo(() => {
    return transcripts.map((transcript) => ({
      id: transcript.id,
      timestamp: transcript.audio_start_time ?? 0,
      endTime: transcript.audio_end_time,
      text: transcript.text,
      translation: transcript.translation,
      confidence: transcript.confidence,
    }));
  }, [transcripts]);

  return (
    <div ref={transcriptContainerRef} className="w-full border-r border-gray-200 bg-white flex flex-col overflow-y-auto">
      <div className="sticky top-0 z-10 bg-white p-4 border-gray-200">
        <div className="flex flex-col space-y-3">
          <div className="flex flex-col space-y-2">
            <div className="flex justify-center items-center space-x-2">
              <ButtonGroup>
                {transcripts.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyTranscript}
                    title={t('transcript_copy')}
                  >
                    <Copy />
                    <span className="hidden md:inline">{t('transcript_copy')}</span>
                  </Button>
                )}

                <Button
                  variant={translationEnabled ? 'blue' : 'outline'}
                  size="sm"
                  onClick={() => setTranslationEnabled(!translationEnabled)}
                  title={`${t('settings_translation')} ${translationEnabled ? t('common_on') : t('common_off')}`}
                >
                  <GlobeIcon />
                  <span className="hidden md:inline">{t('settings_translation')}</span>
                </Button>

                {transcriptModelConfig.provider === 'localWhisper' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => showModal('languageSettings')}
                    title={t('transcript_language')}
                  >
                    <GlobeIcon />
                    <span className="hidden md:inline">{t('transcript_language')}</span>
                  </Button>
                )}
              </ButtonGroup>
            </div>
          </div>
        </div>
      </div>

      {!isRecording && !isChecking && !isLinux && (
        <div className="flex justify-center px-4 pt-4">
          <PermissionWarning
            hasMicrophone={hasMicrophone}
            hasSystemAudio={hasSystemAudio}
            onRecheck={checkPermissions}
            isRechecking={isChecking}
          />
        </div>
      )}

      <div className="pb-20">
        <div className="flex justify-center">
          <div className="w-2/3 max-w-[750px]">
            <VirtualizedTranscriptView
              segments={segments}
              isRecording={isRecording}
              isPaused={isPaused}
              isProcessing={isProcessingStop}
              isStopping={isStopping}
              enableStreaming={isRecording}
              showConfidence={true}
              showTranslation={translationEnabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
