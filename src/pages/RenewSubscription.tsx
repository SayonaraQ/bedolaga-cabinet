import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient, useIsMutating } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { subscriptionApi } from '@/api/subscription';
import { Card } from '@/components/data-display/Card';
import { Button } from '@/components/primitives/Button';
import { RenewAutopayNote } from '@/components/subscription/renew/RenewAutopayNote';
import { RenewPayPanel, type RenewAttempt } from '@/components/subscription/renew/RenewPayPanel';
import { RenewPeriodTiles } from '@/components/subscription/renew/RenewPeriodTiles';
import { RenewSummary } from '@/components/subscription/renew/RenewSummary';
import { useTheme } from '@/hooks/useTheme';
import { getGlassColors } from '@/utils/glassTheme';
import { useCurrency } from '@/hooks/useCurrency';
import { useHaptic } from '@/platform';
import { WebBackButton } from '@/components/WebBackButton';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';
import { DailyPausePanel } from '@/components/subscription/manage/DailyPausePanel';
import { canOpenTariffSwitch, needsTariff, tariffSelectionPath } from '@/utils/legacySubscription';
import { getLocalizedApiErrorMessage } from '@/utils/api-error-display';
import { isUncertainPurchaseOutcome } from '@/utils/api-error';
import {
  pickDefaultPeriod,
  renewedEndDate,
  renewalShortfallKopeks,
  sortRenewalOptions,
} from '@/utils/renew/renewPlan';
import { uiLocale } from '@/utils/uiLocale';

function renewalRejection(err: unknown) {
  const response =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { status?: number; data?: { detail?: unknown } } }).response
      : undefined;
  const detail = response?.data?.detail;
  const insufficient =
    response?.status === 402 &&
    detail !== null &&
    typeof detail === 'object' &&
    'code' in detail &&
    detail.code === 'insufficient_funds';
  const missing = insufficient && 'missing_amount' in detail ? detail.missing_amount : null;
  return {
    status: response?.status,
    insufficient,
    missingKopeks: typeof missing === 'number' && Number.isFinite(missing) ? missing : null,
  };
}

export default function RenewSubscription() {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  const subId = subscriptionId ? Number(subscriptionId) : undefined;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const purchasePending = useIsMutating() > 0;
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const { formatAmount, currencySymbol } = useCurrency();
  const { impact } = useHaptic();
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shortage, setShortage] = useState<{
    periodDays: number;
    missingKopeks: number | null;
    balanceKopeks: number;
  } | null>(null);
  const submitting = useRef(false);

  const { data: subscriptionResponse, isLoading: isSubscriptionLoading } = useQuery({
    queryKey: ['subscription', subId],
    queryFn: () => subscriptionApi.getSubscription(subId),
    enabled: !!subId,
    staleTime: 30_000,
  });
  const subscription = subscriptionResponse?.subscription ?? null;
  const { data: options, isLoading } = useQuery({
    queryKey: ['renewal-options', subId],
    queryFn: () => subscriptionApi.getRenewalOptions(subId),
    enabled: !!subId && !!subscription && !(subscription.is_daily && !subscription.is_trial),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Выбираем период после загрузки; обновление цен сохраняет выбор человека.
  useEffect(() => {
    if (!options?.length) return;
    setSelectedPeriod((current) =>
      options.some((option) => option.period_days === current)
        ? current
        : pickDefaultPeriod(options, subscription?.autopay_period_days),
    );
  }, [options, subscription?.autopay_period_days]);

  const { data: purchaseOptions } = useQuery({
    queryKey: ['purchase-options', subId],
    queryFn: () => subscriptionApi.getPurchaseOptions(subId),
    staleTime: 0,
  });
  const balanceKopeks = purchaseOptions?.balance_kopeks ?? 0;
  // Ответ 402 относится к прежнему балансу; после пополнения считаем заново.
  useEffect(() => {
    setShortage((current) => (current && current.balanceKopeks !== balanceKopeks ? null : current));
  }, [balanceKopeks]);
  const renewMutation = useMutation({
    retry: false,
    mutationFn: (periodDays: number) =>
      subscriptionApi.renewSubscription(periodDays, subId, subscription?.end_date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-options', subId] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      navigate(`/subscriptions/${subId}`, { replace: true });
    },
    onError: (err: unknown, periodDays: number) => {
      if (isUncertainPurchaseOutcome(err)) {
        setError(t('subscription.purchaseOutcomeUnknown'));
        return;
      }
      const rejection = renewalRejection(err);
      if (rejection.insufficient) {
        const provisionalShortage = {
          periodDays,
          missingKopeks: rejection.missingKopeks,
          balanceKopeks,
        };
        setShortage(provisionalShortage);
        // Успешный ответ подтверждает баланс даже с той же суммой и датой обновления.
        // Не ждём refetch: сохранённый ответ 402 уже позволяет перейти к оплате.
        void queryClient
          .invalidateQueries({ queryKey: ['purchase-options', subId] }, { throwOnError: true })
          .then(
            () => setShortage((current) => (current === provisionalShortage ? null : current)),
            () => {},
          );
        return;
      }
      if (rejection.status === 409) {
        queryClient.invalidateQueries({ queryKey: ['subscription', subId] });
        queryClient.invalidateQueries({ queryKey: ['renewal-options', subId] });
      }
      setError(getLocalizedApiErrorMessage(err, t('common.error'), t));
    },
  });

  const saveRenewal = async (): Promise<RenewAttempt> => {
    if (selectedPeriod === null || submitting.current) return { kind: 'stopped' };
    submitting.current = true;
    impact('medium');
    setError(null);
    try {
      await renewMutation.mutateAsync(selectedPeriod);
      return { kind: 'renewed' };
    } catch (err: unknown) {
      const rejection = renewalRejection(err);
      if (!isUncertainPurchaseOutcome(err) && rejection.insufficient) {
        return { kind: 'insufficient', missingKopeks: rejection.missingKopeks };
      }
      return { kind: 'stopped' };
    } finally {
      submitting.current = false;
    }
  };

  if (!subId) return <Navigate to="/subscriptions" replace />;
  if (needsTariff(subscription)) return <Navigate to={tariffSelectionPath(subId)} replace />;
  if (isLoading || isSubscriptionLoading) {
    return (
      <PageSkeleton leading={1} titleWidth="w-56" className="space-y-5">
        <Skeleton variant="card" className="h-16" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton variant="card" count={4} className="h-20" />
        </div>
      </PageSkeleton>
    );
  }

  const now = new Date();
  const sortedOptions = sortRenewalOptions(options ?? []);
  const selected = sortedOptions.find((option) => option.period_days === selectedPeriod);
  const clientShortfall = selected
    ? renewalShortfallKopeks(selected.price_kopeks, balanceKopeks)
    : 0;
  const currentShortage =
    shortage?.periodDays === selectedPeriod && shortage.balanceKopeks === balanceKopeks
      ? shortage
      : null;
  const serverShortfall = currentShortage?.missingKopeks ?? null;
  const shortfallKopeks =
    serverShortfall !== null ? renewalShortfallKopeks(serverShortfall, 0) : clientShortfall;
  const inlinePayment = shortfallKopeks > 0 || currentShortage !== null;
  const ended = subscription?.is_expired || subscription?.status === 'expired';
  const oldEnd = subscription?.end_date ? new Date(subscription.end_date) : null;
  const validEnd = oldEnd && Number.isFinite(oldEnd.getTime());
  const endLabel = validEnd
    ? new Intl.DateTimeFormat(uiLocale(), {
        day: 'numeric',
        month: 'long',
        ...(oldEnd.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
      }).format(oldEnd)
    : null;
  const money = (kopeks: number) =>
    `${formatAmount(kopeks / 100, kopeks % 100 === 0 ? 0 : 2)}\u00A0${currencySymbol}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <WebBackButton to={`/subscriptions/${subId}`} />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: g.text }}>
            {t('subscription.extend', 'Продлить подписку')}
          </h1>
          {subscription?.is_daily && !subscription.is_trial && subscription.tariff_name && (
            <p className="mt-1 text-sm" style={{ color: g.textSecondary }}>
              {subscription.tariff_name}
            </p>
          )}
        </div>
      </div>

      {subscription?.is_daily && !subscription.is_trial ? (
        <>
          <div
            className="glass-card flex items-center justify-between rounded-2xl p-4"
            style={{ background: g.cardBg, border: `1px solid ${g.cardBorder}` }}
          >
            <span className="text-sm" style={{ color: g.textSecondary }}>
              {t('common.balance', 'Баланс')}
            </span>
            <span className="text-base font-semibold" style={{ color: g.text }}>
              {formatAmount(balanceKopeks / 100)}
              {'\u00A0'}
              {currencySymbol}
            </span>
          </div>
          <section
            className="glass-card space-y-4 rounded-2xl p-6"
            style={{ background: g.cardBg, border: `1px solid ${g.cardBorder}` }}
          >
            <p className="text-sm text-dark-300">{t('subscription.dailyRenewalExplanation')}</p>
            <p className="text-base font-semibold text-dark-50">
              {t('subscription.dailyRenewalPrice', {
                price: `${formatAmount((subscription.daily_price_kopeks ?? 0) / 100)}\u00A0${currencySymbol}`,
              })}
            </p>
            <DailyPausePanel subscription={subscription} subscriptionId={subId} />
            {canOpenTariffSwitch(subscription) && (
              <Link className="btn-secondary w-full" to={tariffSelectionPath(subId)}>
                {t('subscription.switchTariff.title')}
              </Link>
            )}
          </section>
        </>
      ) : !options?.length ? (
        <div
          className="glass-card rounded-2xl p-6 text-center"
          style={{ background: g.cardBg, border: `1px solid ${g.cardBorder}` }}
        >
          <p style={{ color: g.textSecondary }}>
            {t('subscription.noRenewalOptions', 'Нет доступных вариантов продления')}
          </p>
        </div>
      ) : (
        <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-5 lg:space-y-0">
          <Card className="min-w-0">
            <h2 className="text-lg font-semibold text-dark-50">
              {subscription?.tariff_name}
              {(selected?.extra_devices ?? 0) > 0 && (
                <span className="ml-1 font-normal text-dark-400">
                  {t('balance.wallet.extraDevices', { count: selected?.extra_devices })}
                </span>
              )}
            </h2>
            {endLabel && (
              <p
                className={`mt-1 flex items-center gap-1.5 text-sm ${ended ? 'text-error-400' : 'text-success-400'}`}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
                {t(`subscription.renewPage.${ended ? 'endedOn' : 'activeUntil'}`, {
                  date: endLabel,
                })}
              </p>
            )}
            <h3 className="mb-2 mt-5 text-sm text-dark-400">
              {t('subscription.renewPage.periodHeading')}
            </h3>
            <RenewPeriodTiles
              options={sortedOptions}
              selectedDays={selectedPeriod}
              disabled={purchasePending}
              onSelect={(days) => {
                impact('light');
                setSelectedPeriod(days);
                setShortage(null);
                setError(null);
              }}
            />
            {selected && (
              <>
                <RenewSummary
                  newEndDate={renewedEndDate(
                    validEnd ? oldEnd.toISOString() : now.toISOString(),
                    selected.period_days,
                    now,
                  )}
                  priceKopeks={selected.price_kopeks}
                  balanceKopeks={balanceKopeks}
                  shortfallKopeks={shortfallKopeks}
                />
                {inlinePayment ? (
                  <RenewPayPanel
                    key={selected.period_days}
                    shortfallKopeks={shortfallKopeks}
                    saveRenewal={saveRenewal}
                  />
                ) : (
                  <Button
                    fullWidth
                    className="mt-5 min-h-14"
                    disabled={renewMutation.isPending}
                    onClick={() => {
                      void saveRenewal();
                    }}
                  >
                    {renewMutation.isPending
                      ? t('common.processing', 'Обработка...')
                      : selected.price_kopeks === 0
                        ? t('subscription.renewPage.renewFree')
                        : t('subscription.renewPage.renewFor', {
                            price: money(selected.price_kopeks),
                          })}
                  </Button>
                )}
              </>
            )}
            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl bg-error-400/10 p-3 text-sm text-error-400"
              >
                {error}
              </div>
            )}
          </Card>
          <aside className="min-w-0 space-y-4">
            {subscription && (
              <RenewAutopayNote
                subscription={subscription}
                options={sortedOptions}
                balanceKopeks={balanceKopeks}
                subId={subId}
                now={now}
              />
            )}
            {canOpenTariffSwitch(subscription) && (
              <Link
                to={tariffSelectionPath(subId)}
                className="glass-card block rounded-linear-lg border p-5 transition-colors hover:border-accent-400/40"
                style={{ background: g.cardBg, borderColor: g.cardBorder }}
              >
                <span className="text-sm font-semibold text-dark-100">
                  {t('subscription.switchTariff.title')}
                </span>
                <p className="mt-1 text-sm leading-relaxed text-dark-400">
                  {t('subscription.renewPage.changeTariffHint')}
                </p>
              </Link>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
