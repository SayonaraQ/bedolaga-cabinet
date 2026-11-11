import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReferralEarning } from '@/api/referral';
import { Card } from '@/components/data-display/Card';
import { Button } from '@/components/primitives/Button';
import { uiLocale } from '@/utils/uiLocale';

export interface ReferralListItem {
  id: number;
  username: string | null;
  first_name: string | null;
  created_at: string;
  has_paid: boolean;
}

type Tab = 'referrals' | 'earnings';

/** Сколько строк видно до «Показать всех» / «Вся история». */
export const ACTIVITY_PREVIEW_ROWS = 5;

const dateLabel = (value: string) => {
  const parsed = new Date(value);
  return new Intl.DateTimeFormat(uiLocale(), {
    day: 'numeric',
    month: 'long',
    ...(parsed.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  }).format(parsed);
};

/**
 * Приглашённые и начисления — вкладки одной карточки, строки с разделителями,
 * как «Последние операции» на «Балансе». Вкладка начислений появляется, когда
 * есть хотя бы одно начисление.
 */
export function ReferralActivityCard({
  referrals,
  earnings,
  formatEarning,
}: {
  referrals: ReferralListItem[];
  earnings: ReferralEarning[];
  formatEarning: (earning: ReferralEarning) => string;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('referrals');
  const [expanded, setExpanded] = useState(false);
  const hasEarnings = earnings.length > 0;
  const active: Tab = hasEarnings ? tab : 'referrals';
  const rows = active === 'referrals' ? referrals.length : earnings.length;
  const limit = expanded ? rows : ACTIVITY_PREVIEW_ROWS;

  const select = (next: Tab) => {
    setTab(next);
    setExpanded(false);
  };

  return (
    <Card>
      {hasEarnings ? (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:flex" role="group">
          {(['referrals', 'earnings'] as const).map((key) => (
            <Button
              key={key}
              size="sm"
              variant="secondary"
              aria-pressed={active === key}
              className={`whitespace-nowrap max-[359px]:px-1.5 max-[359px]:text-[13px] ${
                active === key ? 'border-accent-500 bg-accent-500/10 text-accent-400' : ''
              }`}
              onClick={() => select(key)}
            >
              {t(key === 'referrals' ? 'referral.lists.referrals' : 'referral.lists.earnings')}
            </Button>
          ))}
        </div>
      ) : (
        <h2 className="mb-4 text-lg font-semibold text-dark-100">
          {t('referral.lists.referrals')}
        </h2>
      )}

      {active === 'referrals' ? (
        referrals.length > 0 ? (
          <div className="divide-y divide-dark-700/40">
            {referrals.slice(0, limit).map((ref) => (
              <div
                key={ref.id}
                data-testid="referral-row"
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  {/* Ник без пробелов не должен выталкивать отметку за карточку. */}
                  <div className="text-sm text-dark-100 [overflow-wrap:anywhere]">
                    {ref.first_name || ref.username || t('referral.anonymousUser', { id: ref.id })}
                  </div>
                  <div className="mt-1 text-xs text-dark-400">{dateLabel(ref.created_at)}</div>
                </div>
                {ref.has_paid ? (
                  <span className="shrink-0 rounded-full border border-success-500/30 bg-success-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-success-400">
                    {t('referral.status.paid')}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-dark-600/60 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-dark-400">
                    {t('referral.status.awaiting')}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-dark-400">{t('referral.noReferrals')}</p>
        )
      ) : (
        <div className="divide-y divide-dark-700/40">
          {earnings.slice(0, limit).map((earning) => (
            <div
              key={earning.id}
              data-testid="earning-row"
              // Начисление бывает длинным («+1 234,56 ₽ + 90 дн. «Тариф»»): оно
              // занимает не больше половины строки и переносится, имя — остаток.
              className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm text-dark-100 [overflow-wrap:anywhere]">
                  {earning.referral_first_name ||
                    earning.referral_username ||
                    t('referral.anonymousReferral')}
                </div>
                <div className="mt-1 text-xs text-dark-400">
                  {t(`referral.reasons.${earning.reason}`, earning.reason)}
                  {(earning.level ?? 1) > 1 &&
                    ` · ${t('referral.levelBadge', { count: earning.level ?? 1 })}`}
                  {` · ${dateLabel(earning.created_at)}`}
                </div>
              </div>
              <div className="min-w-0 max-w-[55%] text-right text-sm font-semibold text-success-400">
                {formatEarning(earning)}
              </div>
            </div>
          ))}
        </div>
      )}

      {rows > ACTIVITY_PREVIEW_ROWS && (
        <div className="mt-4 border-t border-dark-700/40 pt-3 text-center">
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {t(
              expanded
                ? 'referral.lists.collapse'
                : active === 'referrals'
                  ? 'referral.lists.showAll'
                  : 'referral.lists.allHistory',
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}
