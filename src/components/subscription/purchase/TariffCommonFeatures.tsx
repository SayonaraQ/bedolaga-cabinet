import { useId, type ComponentType } from 'react';
import {
  ArrowDownIcon,
  BoltIcon,
  CheckIcon,
  CrownIcon,
  DevicesIcon,
  GlobeIcon,
  InfinityIcon,
  MonitorIcon,
  PlusIcon,
  StarIcon,
  TagIcon,
  YoutubeIcon,
} from '@/components/icons';
import { useTranslation } from 'react-i18next';
import type { TariffCommonFeature } from '@/types';

const FEATURE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  globe: GlobeIcon,
  youtube: YoutubeIcon,
  infinity: InfinityIcon,
  check: CheckIcon,
  devices: DevicesIcon,
  speed: BoltIcon,
  traffic: ArrowDownIcon,
  premium: CrownIcon,
  value: TagIcon,
  star: StarIcon,
};
const COMMON_ICONS = new Set(['globe', 'youtube', 'infinity', 'plus', 'check']);

export function TariffFeatureIcon({ icon }: { icon: string }) {
  // biome-ignore lint/suspicious/noPrototypeBuiltins: Object.hasOwn requires ES2022; the cabinet targets ES2020
  const Icon = Object.prototype.hasOwnProperty.call(FEATURE_ICONS, icon)
    ? FEATURE_ICONS[icon]
    : CheckIcon;
  return (
    <span aria-hidden="true" className="relative inline-flex">
      {icon === 'plus' ? (
        <>
          <MonitorIcon className="h-5 w-5" />
          <PlusIcon className="absolute -bottom-1 -right-1 h-3 w-3" />
        </>
      ) : (
        <Icon className="h-5 w-5" />
      )}
    </span>
  );
}

export function TariffCommonFeatures({ features }: { features: TariffCommonFeature[] }) {
  const { t } = useTranslation();
  const headingId = useId();
  if (features.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="mb-5">
      <h2 id={headingId} className="mb-3 text-xs font-bold uppercase tracking-wider text-dark-400">
        {t('subscription.tariffCard.commonFeatures')}
      </h2>
      <ul className="grid grid-cols-1 gap-x-3 gap-y-2.5 min-[360px]:grid-cols-2 min-[360px]:gap-y-3">
        {features.map((feature, index) => (
          <li
            key={`${index}-${feature.text}`}
            className="flex min-w-0 items-center gap-2 text-sm text-dark-200"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-accent-500/10 text-accent-400">
              <TariffFeatureIcon icon={COMMON_ICONS.has(feature.icon) ? feature.icon : 'check'} />
            </span>
            <span className="min-w-0 break-words">{feature.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
