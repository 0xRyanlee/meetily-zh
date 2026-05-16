import React from 'react';
import { Lock, Sparkles, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OnboardingContainer } from '../OnboardingContainer';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useI18n } from '@/contexts/I18nContext';

export function WelcomeStep() {
  const { goNext } = useOnboarding();
  const { t } = useI18n();

  const features = [
    { icon: Lock,     key: 'welcome_feature_privacy' as const },
    { icon: Sparkles, key: 'welcome_feature_summaries' as const },
    { icon: Cpu,      key: 'welcome_feature_offline' as const },
  ];

  return (
    <OnboardingContainer
      title={t('welcome_title')}
      description={t('welcome_subtitle')}
      step={1}
      hideProgress={true}
    >
      <div className="flex flex-col items-center space-y-10">
        <div className="w-16 h-px bg-gray-300" />

        <div className="w-full max-w-md bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          {features.map(({ icon: Icon, key }) => (
            <div key={key} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                  <Icon className="w-3 h-3 text-gray-700" />
                </div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{t(key)}</p>
            </div>
          ))}
        </div>

        <div className="w-full max-w-xs space-y-3">
          <Button onClick={goNext} className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white">
            {t('welcome_cta')}
          </Button>
          <p className="text-xs text-center text-gray-500">{t('welcome_time_hint')}</p>
        </div>
      </div>
    </OnboardingContainer>
  );
}
