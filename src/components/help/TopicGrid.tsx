import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  PiCreditCard,
  PiDesktop,
  PiDeviceMobile,
  PiGauge,
  PiGlobe,
  PiQuestion,
  PiWifiSlash,
} from 'react-icons/pi';
import { HELP_TOPICS, type HelpTopicGroup, type HelpTopicKey } from '../../utils/help/topics';

export const TOPIC_ICON: Record<HelpTopicKey, ComponentType<{ className?: string }>> = {
  trouble: PiWifiSlash,
  connect: PiDesktop,
  services: PiGlobe,
  devices: PiDeviceMobile,
  whitelist: PiGauge,
  billing: PiCreditCard,
  other: PiQuestion,
};

const ACCENT = new Set(HELP_TOPICS.filter((t) => t.accent).map((t) => t.key));

export function TopicGrid({ topics }: { topics: HelpTopicGroup[] }) {
  const { t } = useTranslation();
  if (!topics.length) return null;
  return (
    <nav aria-label={t('help.title')} className="grid grid-cols-2 gap-2.5">
      {topics.map(({ key, pages }) => {
        const Icon = TOPIC_ICON[key];
        const accent = ACCENT.has(key);
        return (
          <Link
            key={key}
            to={`/info/topic/${key}`}
            className={`flex min-h-[112px] flex-col items-start gap-2.5 rounded-2xl p-3.5 transition-colors ${
              accent
                ? 'border-[1.5px] border-accent-500/40 bg-accent-500/10 hover:border-accent-500/60'
                : 'border border-dark-700/60 bg-dark-800/40 hover:border-dark-600'
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${
                accent ? 'bg-accent-500 text-on-accent' : 'bg-accent-500/10 text-accent-400'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block break-words text-[15px] font-bold leading-snug text-dark-50">
                {t(`help.topics.${key}.title`)}
              </span>
              <span
                className={`mt-0.5 block text-xs ${accent ? 'font-semibold text-accent-400' : 'text-dark-400'}`}
              >
                {key === 'trouble'
                  ? t('help.topics.trouble.hint')
                  : t('help.topics.count', { count: pages.length })}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
