import { useState, type ReactNode } from 'react';
import { Sparkles, RefreshCw, CheckSquare, ListTodo, BadgeCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Transcript } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { useLiveHighlights } from '@/hooks/useLiveHighlights';

interface LiveHighlightsPanelProps {
  transcripts: Transcript[];
  isRecording: boolean;
  modelName?: string;
}

function Section({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
        {icon}
        <span>{title}</span>
      </div>
      {items.length > 0 ? (
        <ul className="space-y-2 text-sm text-gray-700">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="rounded-md bg-gray-50 px-3 py-2 leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-400">{title}</p>
      )}
    </div>
  );
}

export function LiveHighlightsPanel({
  transcripts,
  isRecording,
  modelName,
}: LiveHighlightsPanelProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useI18n();
  const {
    key_points,
    action_items,
    decisions,
    status,
    error,
    updatedAt,
    refresh,
  } = useLiveHighlights({
    transcripts,
    isRecording,
    modelName,
  });

  const hasTranscriptContent = transcripts.some((transcript) => transcript.text.trim());
  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const content = (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span>{t('live_highlights_title')}</span>
            </div>
            <p className="mt-1 text-sm text-gray-600">{t('live_highlights_description')}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void refresh()}
            title={t('common_retry')}
            disabled={!hasTranscriptContent}
          >
            <RefreshCw className={`h-4 w-4 ${status === 'generating' ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
          <span className={`inline-flex h-2 w-2 rounded-full ${
            status === 'generating'
              ? 'bg-blue-500'
              : status === 'ready'
                ? 'bg-green-500'
                : status === 'error'
                  ? 'bg-red-500'
                  : 'bg-gray-300'
          }`} />
          <span>
            {status === 'generating'
              ? t('live_highlights_generating')
              : updatedLabel
                ? `${t('live_highlights_updated')} ${updatedLabel}`
                : t('live_highlights_waiting')}
          </span>
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-600">{error}</p>
        )}
      </div>

      {!hasTranscriptContent ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
          {t('live_highlights_empty')}
        </div>
      ) : (
        <div className="space-y-4">
          <Section
            title={t('live_highlights_key_points')}
            items={key_points}
            icon={<CheckSquare className="h-4 w-4 text-blue-600" />}
          />
          <Section
            title={t('live_highlights_action_items')}
            items={action_items}
            icon={<ListTodo className="h-4 w-4 text-amber-600" />}
          />
          <Section
            title={t('live_highlights_decisions')}
            items={decisions}
            icon={<BadgeCheck className="h-4 w-4 text-green-600" />}
          />
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="fixed right-4 top-20 z-20 xl:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="bg-white/95 shadow-md backdrop-blur"
            >
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span>{t('live_highlights_title')}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[92vw] max-w-[420px] border-l bg-gray-50 p-0">
            <SheetHeader className="px-4 pt-6 pb-0 text-left">
              <SheetTitle>{t('live_highlights_title')}</SheetTitle>
              <SheetDescription>{t('live_highlights_description')}</SheetDescription>
            </SheetHeader>
            {content}
          </SheetContent>
        </Sheet>
      </div>

      <aside className="hidden xl:flex xl:w-[360px] xl:flex-col xl:border-l xl:border-gray-200 xl:bg-gray-50">
        {content}
      </aside>
    </>
  );
}
