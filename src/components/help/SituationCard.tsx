import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  PiCaretRight,
  PiClock,
  PiDesktop,
  PiDeviceMobile,
  PiGauge,
  PiQuestion,
  PiStar,
  PiWarningCircle,
} from 'react-icons/pi';
import type { FaqPage } from '../../api/info';
import type { Subscription } from '@/types';
import { formatTraffic } from '../../utils/formatTraffic';
import {
  HELP_SITUATION_FAQ,
  type HelpSituation,
  type HelpSituationKind,
} from '../../utils/help/situation';
import { pickFaq } from '../../utils/help/topics';
import { CARD_CTA_LABEL, subscriptionCardCta } from '../../utils/subscriptionCta';
import { uiLocale } from '../../utils/uiLocale';

type Tone = 'error' | 'warning' | 'accent';

const TONE: Record<Tone, { box: string; label: string; divider: string }> = {
  error: {
    box: 'border-error-500/40 bg-error-500/10',
    label: 'text-error-400',
    divider: 'border-error-500/20',
  },
  warning: {
    box: 'border-warning-500/45 bg-warning-500/10',
    label: 'text-warning-400',
    divider: 'border-warning-500/20',
  },
  accent: {
    box: 'border-accent-500/35 bg-accent-500/10',
    label: 'text-accent-400',
    divider: 'border-accent-500/20',
  },
};

const LOOK: Record<HelpSituationKind, { tone: Tone; Icon: ComponentType<{ className?: string }> }> =
  {
    expired: { tone: 'error', Icon: PiWarningCircle },
    trafficOut: { tone: 'warning', Icon: PiGauge },
    trafficLow: { tone: 'warning', Icon: PiGauge },
    slotsFull: { tone: 'warning', Icon: PiDeviceMobile },
    expiring: { tone: 'accent', Icon: PiClock },
    noDevices: { tone: 'accent', Icon: PiDesktop },
    trial: { tone: 'accent', Icon: PiStar },
  };

interface Action {
  label: string;
  to: string;
}

interface SituationCardProps {
  situation: HelpSituation;
  subscription: Subscription;
  faq: FaqPage[];
}

/** Одна карточка «По вашей подписке» над поиском (макет AB-States). */
export function SituationCard({ situation, subscription, faq }: SituationCardProps) {
  const { t } = useTranslation();
  const { kind } = situation;
  const { tone, Icon } = LOOK[kind];
  const toneClass = TONE[tone];
  const wiring = HELP_SITUATION_FAQ[kind];
  const subscriptionPath = `/subscriptions/${subscription.id}`;
  const buyTraffic: Action = { label: t('help.situation.trafficLow.buy'), to: subscriptionPath };

  const cta = subscriptionCardCta(subscription);
  const ctaAction: Action | null = cta
    ? { label: t(CARD_CTA_LABEL[cta.action]), to: cta.to }
    : null;
  const primaryFaq = wiring.primary ? pickFaq(faq, [wiring.primary])[0] : undefined;

  let title = t(`help.situation.${kind}.title`);
  let text = t(`help.situation.${kind}.text`);
  let primary: Action | null = null;
  const extra: Action[] = [];

  switch (kind) {
    case 'expired':
      primary = ctaAction;
      break;
    case 'trafficOut': {
      const refresh = subscription.next_traffic_refresh_at;
      if (refresh) {
        const date = new Date(refresh).toLocaleDateString(uiLocale(), {
          day: 'numeric',
          month: 'long',
        });
        text = t('help.situation.trafficOut.textDate', { date });
      }
      primary = { label: t('help.situation.trafficOut.action'), to: subscriptionPath };
      break;
    }
    case 'trafficLow': {
      const used = situation.usedGb ?? 0;
      const limit = situation.limitGb ?? 0;
      text = t('help.situation.trafficLow.text', {
        left: formatTraffic(Math.max(0, limit - used)),
        limit: formatTraffic(limit),
      });
      if (primaryFaq) {
        primary = {
          label: t('help.situation.trafficLow.action'),
          to: `/info/faq/${primaryFaq.id}`,
        };
        extra.push(buyTraffic);
      } else {
        primary = buyTraffic;
      }
      break;
    }
    case 'slotsFull':
      title = t('help.situation.slotsFull.title', { count: situation.deviceLimit ?? 0 });
      primary = { label: t('help.situation.slotsFull.action'), to: `${subscriptionPath}#devices` };
      break;
    case 'expiring':
    case 'trial': {
      const days = situation.daysLeft ?? 0;
      title =
        days <= 0
          ? t(`help.situation.${kind}.today`)
          : t(`help.situation.${kind}.title`, { count: days });
      primary = ctaAction;
      break;
    }
    case 'noDevices':
      primary = {
        label: t('help.situation.noDevices.action'),
        to: `/connection?sub=${subscription.id}`,
      };
      break;
  }

  const links: Action[] = [
    ...extra,
    ...pickFaq(faq, wiring.links).map((page) => ({
      label: page.title,
      to: `/info/faq/${page.id}`,
    })),
  ];
  const usedShare =
    kind === 'trafficLow' && situation.limitGb
      ? Math.min(100, Math.round(((situation.usedGb ?? 0) / situation.limitGb) * 100))
      : null;

  return (
    <section
      aria-labelledby="help-situation-title"
      className={`flex flex-col gap-3.5 rounded-[var(--bento-radius-lg)] border-[1.5px] p-4 sm:p-5 ${toneClass.box}`}
    >
      <div
        className={`flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] ${toneClass.label}`}
      >
        <Icon className="h-4 w-4" />
        {t('help.situation.label')}
      </div>
      <div>
        <h2 id="help-situation-title" className="text-lg font-extrabold leading-snug text-dark-50">
          {title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-dark-200">{text}</p>
      </div>
      {usedShare !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-dark-900/60" aria-hidden>
          <div className="h-full rounded-full bg-warning-400" style={{ width: `${usedShare}%` }} />
        </div>
      )}
      {primary && (
        <Link
          to={primary.to}
          className="flex min-h-[48px] items-center justify-center rounded-xl bg-accent-500 px-4 text-center text-[15px] font-bold text-on-accent transition-opacity hover:opacity-90"
        >
          {primary.label}
        </Link>
      )}
      {links.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-dark-950/40">
          {links.map((link, index) => (
            <Link
              key={link.to + link.label}
              to={link.to}
              className={`flex min-h-[48px] items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-dark-100 hover:bg-dark-900/40 ${
                index > 0 ? `border-t ${toneClass.divider}` : ''
              }`}
            >
              <PiQuestion aria-hidden className={`h-[18px] w-[18px] shrink-0 ${toneClass.label}`} />
              <span className="min-w-0 flex-1">{link.label}</span>
              <PiCaretRight aria-hidden className="h-4 w-4 shrink-0 text-dark-500" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
