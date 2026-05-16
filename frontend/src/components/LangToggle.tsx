'use client';

import { useI18n } from '@/contexts/I18nContext';

export function LangToggle({ className = '' }: { className?: string }) {
  const { t, toggleLocale } = useI18n();

  return (
    <button
      onClick={toggleLocale}
      className={`text-xs font-medium px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors select-none ${className}`}
      title={t('lang_switch')}
    >
      {t('lang_toggle')}
    </button>
  );
}
