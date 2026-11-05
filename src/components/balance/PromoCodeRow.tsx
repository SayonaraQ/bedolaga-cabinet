import { useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { PiTicket } from 'react-icons/pi';
import { balanceApi } from '@/api/balance';
import { Card } from '@/components/data-display/Card';
import { ChevronDownIcon } from '@/components/icons';
import { Button } from '@/components/primitives/Button';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuthStore } from '@/store/auth';

export function PromoCodeRow({ onActivated }: { onActivated?: () => void }) {
  const { t } = useTranslation();
  const { formatAmount, currencySymbol } = useCurrency();
  const queryClient = useQueryClient();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const [open, setOpen] = useState(false);
  const formId = useId();
  const [promocode, setPromocode] = useState('');
  const [promocodeLoading, setPromocodeLoading] = useState(false);
  const [promocodeError, setPromocodeError] = useState<string | null>(null);
  const [promocodeSuccess, setPromocodeSuccess] = useState<{
    message: string;
    amount: number;
  } | null>(null);
  const [promoSelectSubs, setPromoSelectSubs] = useState<Array<{
    id: number;
    tariff_name: string;
    days_left: number;
  }> | null>(null);
  const [promoSelectCode, setPromoSelectCode] = useState<string | null>(null);

  const handlePromocodeActivate = async (subscriptionId?: number) => {
    const code = subscriptionId ? promoSelectCode || '' : promocode.trim();
    if (!code) return;

    setPromocodeLoading(true);
    setPromocodeError(null);
    setPromocodeSuccess(null);

    try {
      const result = await balanceApi.activatePromocode(code, subscriptionId);

      if (result.error === 'select_subscription' && result.eligible_subscriptions) {
        setPromoSelectSubs(result.eligible_subscriptions);
        setPromoSelectCode(result.code || code);
        return;
      }

      if (result.success) {
        const bonusAmount = (result.balance_after || 0) - (result.balance_before || 0);
        setPromocodeSuccess({
          message: result.bonus_description || t('balance.promocode.success'),
          amount: bonusAmount,
        });
        onActivated?.();
        setPromocode('');
        setPromoSelectSubs(null);
        setPromoSelectCode(null);
        await queryClient.invalidateQueries({ queryKey: ['balance'] });
        await refreshUser();
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
        queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        queryClient.invalidateQueries({ queryKey: ['renewal-options'] });
      }
    } catch (error: unknown) {
      // Машинный код ошибки стабилен, текст ответа сервера может меняться.
      const axiosError = error as {
        response?: { data?: { detail?: { code?: string } | string } };
      };
      const detail = axiosError.response?.data?.detail;
      const code = typeof detail === 'object' && detail ? detail.code : undefined;
      const knownErrorKeys = [
        'not_found',
        'expired',
        'inactive',
        'not_yet_valid',
        'used',
        'already_used_by_user',
        'active_discount_exists',
        'no_subscription_for_days',
        'subscription_not_found',
        'not_first_purchase',
        'daily_limit',
        'trial_subscription_exists',
        'trial_provisioning_failed',
        'user_not_found',
        'server_error',
      ];
      const errorKey = code && knownErrorKeys.includes(code) ? code : 'server_error';
      setPromocodeError(t(`balance.promocode.errors.${errorKey}`));
      setPromoSelectSubs(null);
      setPromoSelectCode(null);
    } finally {
      setPromocodeLoading(false);
    }
  };

  return (
    <Card>
      <button
        type="button"
        className="flex w-full items-center gap-3 text-left"
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => setOpen(!open)}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-linear bg-accent-500/10 text-accent-400">
          <PiTicket className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-dark-100">{t('balance.wallet.promoTitle')}</span>
          <span className="mt-1 block text-xs text-dark-400">{t('balance.wallet.promoHint')}</span>
        </span>
        <ChevronDownIcon
          className={`h-5 w-5 shrink-0 text-dark-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={formId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              {/* На телефоне поле во всю ширину, кнопка под ним: рядом с «Активировать»
              подсказка в поле обрезалась посреди слова. */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={promocode}
                  onChange={(e) => setPromocode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePromocodeActivate()}
                  placeholder={t('balance.promocode.placeholder')}
                  className="input min-w-0 flex-1"
                  disabled={promocodeLoading}
                />
                <Button
                  onClick={() => handlePromocodeActivate()}
                  disabled={!promocode.trim()}
                  loading={promocodeLoading}
                >
                  {t('balance.promocode.activate')}
                </Button>
              </div>
              <AnimatePresence mode="wait">
                {promocodeError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-3 rounded-linear border border-error-500/30 bg-error-500/10 p-3 text-sm text-error-400"
                  >
                    {promocodeError}
                  </motion.div>
                )}
                {promocodeSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-3 rounded-linear border border-success-500/30 bg-success-500/10 p-3 text-sm text-success-400"
                  >
                    <div className="font-medium">{promocodeSuccess.message}</div>
                    {promocodeSuccess.amount > 0 && (
                      <div className="mt-1">
                        {t('balance.wallet.promoBalanceAdded', {
                          amount: `${formatAmount(promocodeSuccess.amount)} ${currencySymbol}`,
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              {promoSelectSubs && promoSelectSubs.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 space-y-2 rounded-linear border border-accent-500/30 bg-accent-500/10 p-3"
                >
                  <div className="text-sm font-medium text-dark-200">
                    {t(
                      'balance.promocode.selectSubscription',
                      'К какой подписке применить промокод?',
                    )}
                  </div>
                  {promoSelectSubs.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => handlePromocodeActivate(sub.id)}
                      disabled={promocodeLoading}
                      className="flex w-full min-w-0 items-center justify-between gap-3 rounded-linear border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-200 transition-colors hover:border-accent-500/50 hover:bg-dark-600"
                    >
                      <span className="truncate">{sub.tariff_name}</span>
                      <span className="shrink-0 text-dark-400">
                        {t('balance.promocode.daysLeft', '{{count}} дн.', { count: sub.days_left })}
                      </span>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setPromoSelectSubs(null);
                      setPromoSelectCode(null);
                    }}
                    className="text-xs text-dark-400 hover:text-dark-200"
                  >
                    {t('common.cancel', 'Отмена')}
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
