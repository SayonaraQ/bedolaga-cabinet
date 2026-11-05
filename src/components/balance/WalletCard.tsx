import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Card } from '@/components/data-display/Card';
import { Button } from '@/components/primitives/Button';
import { useCurrency } from '@/hooks/useCurrency';
import { useTopUpPayment } from '@/hooks/useTopUpPayment';
import type { PaymentMethod, RenewalOption, Subscription } from '@/types';
import { buildQuickTopUps, buildRenewalPlan, type RenewalPlan } from '@/utils/balance/renewalPlan';
import { PaymentReadyPanel } from './PaymentReadyPanel';
import { RenewalStatus } from './RenewalStatus';

export function WalletCard({
  balanceKopeks,
  subscription,
  renewalOptions,
  methods,
}: {
  balanceKopeks: number;
  subscription: Subscription | null;
  renewalOptions: RenewalOption[] | undefined;
  methods: PaymentMethod[];
}) {
  const { t } = useTranslation();
  const { formatAmount, currencySymbol } = useCurrency();
  const [methodId, setMethodId] = useState<string | null>(null);
  const method =
    methods.find((item) => item.id === methodId && item.is_available) ??
    methods.find((item) => item.is_available);
  const plan = buildRenewalPlan({
    subscription,
    options: renewalOptions,
    balanceKopeks,
    now: new Date(),
  });

  return (
    <Card>
      <div className="mb-2 text-sm text-dark-400">{t('balance.wallet.onBalance')}</div>
      <div className="text-4xl font-bold text-dark-50 sm:text-5xl">
        {formatAmount(balanceKopeks / 100)}
        <span className="ml-2 text-2xl text-dark-400">{currencySymbol}</span>
      </div>
      {plan && <RenewalStatus plan={plan} />}
      {method && (
        <WalletTopUp
          key={method.id}
          plan={plan}
          method={method}
          methods={methods}
          onMethodChange={setMethodId}
        />
      )}
    </Card>
  );
}

function WalletTopUp({
  plan,
  method,
  methods,
  onMethodChange,
}: {
  plan: RenewalPlan | null;
  method: PaymentMethod;
  methods: PaymentMethod[];
  onMethodChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatAmount, currencySymbol, targetCurrency, convertToRub } = useCurrency();
  const { pay, isPending, error, paymentUrl, qrPayload } = useTopUpPayment(method);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const selectedOption =
    method.options?.find((option) => option.id === selectedOptionId)?.id ?? method.options?.[0]?.id;
  const quickTopUps = buildQuickTopUps(plan, method);
  const [selectedAmount, setSelectedAmount] = useState<number | null | undefined>(undefined);
  const [customAmount, setCustomAmount] = useState('');
  const submitting = useRef(false);
  const selectedQuickAmount =
    selectedAmount === null
      ? null
      : (quickTopUps.items.find((item) => item.amountKopeks === selectedAmount)?.amountKopeks ??
        quickTopUps.items[quickTopUps.defaultIndex]?.amountKopeks);
  const inputAmount = /^\d+(?:[.,]\d{0,2})?$/.test(customAmount.trim())
    ? Number(customAmount.trim().replace(',', '.'))
    : Number.NaN;
  const customKopeks = Number.isFinite(inputAmount)
    ? Math.round((targetCurrency === 'RUB' ? inputAmount : convertToRub(inputAmount)) * 100)
    : Number.NaN;
  const amountKopeks = selectedQuickAmount === null ? customKopeks : selectedQuickAmount;
  const validAmount =
    amountKopeks !== undefined &&
    Number.isSafeInteger(amountKopeks) &&
    amountKopeks > 0 &&
    amountKopeks >= method.min_amount_kopeks &&
    amountKopeks <= method.max_amount_kopeks;
  const money = (kopeks: number) =>
    `${formatAmount(kopeks / 100, kopeks % 100 === 0 ? 0 : 2)} ${currencySymbol}`;
  const methodName = (item: PaymentMethod) =>
    item.name ||
    t(`balance.paymentMethods.${item.id.toLowerCase().replace(/-/g, '_')}.name`, {
      defaultValue: item.id,
    });

  const handleTopUp = () => {
    if (!validAmount || isPending || submitting.current || amountKopeks === undefined) return;
    if (method.id === 'stars' || method.id === 'antilopay' || targetCurrency !== 'RUB') {
      navigate(`/balance/top-up/${method.id}?amount=${amountKopeks / 100}`);
      return;
    }
    // Два события в одном цикле могут прийти до обновления isPending из React Query.
    submitting.current = true;
    pay(amountKopeks, selectedOption);
    queueMicrotask(() => {
      submitting.current = false;
    });
  };

  return (
    <div className="mt-6 space-y-4 border-t border-dark-700/50 pt-5">
      <h2 className="font-semibold text-dark-100">{t('balance.wallet.topUpHeading')}</h2>
      {methods.length > 1 && (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t('balance.wallet.paymentMethod')}
        >
          {methods.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant="secondary"
              aria-pressed={item.id === method.id}
              disabled={!item.is_available || isPending}
              className={
                item.id === method.id ? 'border-accent-500 bg-accent-500/10 text-accent-400' : ''
              }
              onClick={() => onMethodChange(item.id)}
            >
              {methodName(item)}
            </Button>
          ))}
        </div>
      )}
      {!!method.options?.length && (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t('balance.wallet.paymentOption')}
        >
          {method.options.map((option) => (
            <Button
              key={option.id}
              size="sm"
              variant="secondary"
              aria-pressed={option.id === selectedOption}
              disabled={isPending}
              className={
                option.id === selectedOption
                  ? 'border-accent-500 bg-accent-500/10 text-accent-400'
                  : ''
              }
              onClick={() => setSelectedOptionId(option.id)}
            >
              {option.name}
            </Button>
          ))}
        </div>
      )}
      <div
        className={`grid gap-2 ${quickTopUps.items.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}
        role="group"
        aria-label={t('balance.wallet.quickAmounts')}
      >
        {quickTopUps.items.map((item) => {
          const selected = selectedQuickAmount === item.amountKopeks;
          const durationKey = plan?.shortfallKopeks
            ? item.labelKey === 'months'
              ? 'extraMonths'
              : 'extraDays'
            : item.labelKey;
          const label =
            item.labelKey === 'plain'
              ? null
              : item.labelKey === 'shortfall'
                ? t('balance.wallet.quick.shortfall')
                : t(`balance.wallet.quick.${durationKey}`, { count: item.count });
          return (
            <button
              key={item.amountKopeks}
              type="button"
              aria-label={label ? `${label} ${money(item.amountKopeks)}` : money(item.amountKopeks)}
              aria-pressed={selected}
              disabled={isPending}
              onClick={() => {
                setSelectedAmount(item.amountKopeks);
                setCustomAmount('');
              }}
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-linear border px-1 py-2 transition-colors disabled:opacity-50 ${selected ? 'border-accent-500 bg-accent-500/10 text-accent-400' : 'border-dark-700 bg-dark-800/50 text-dark-100 hover:border-accent-500/50'}`}
            >
              {label && <span className="text-xs text-dark-400">{label}</span>}
              <span className="text-sm font-semibold sm:text-base">{money(item.amountKopeks)}</span>
            </button>
          );
        })}
      </div>
      <label className="block text-sm text-dark-400">
        {t('balance.wallet.otherAmount')}
        <div className="relative mt-2">
          <input
            type="text"
            inputMode="decimal"
            aria-label={t('balance.wallet.otherAmount')}
            value={customAmount}
            disabled={isPending}
            onChange={(event) => {
              setCustomAmount(event.target.value);
              setSelectedAmount(null);
            }}
            className="input w-full min-w-0 pr-12"
          />
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-dark-400">
            {currencySymbol}
          </span>
        </div>
      </label>
      <Button
        variant="primary"
        fullWidth
        className="h-14"
        disabled={!validAmount || isPending}
        onClick={handleTopUp}
      >
        {validAmount
          ? t('balance.wallet.topUpAmount', { amount: money(amountKopeks) })
          : t('balance.wallet.topUpHeading')}
      </Button>
      {error && (
        <div
          role="alert"
          className="rounded-linear border border-error-500/30 bg-error-500/10 p-3 text-sm text-error-400"
        >
          {error}
        </div>
      )}
      {paymentUrl && <PaymentReadyPanel paymentUrl={paymentUrl} qrPayload={qrPayload} />}
      <p className="text-center text-xs text-dark-400">
        {t('balance.wallet.paymentThrough', { name: methodName(method) })}
        {' · '}
        <span>
          {t('balance.wallet.paymentRange', {
            min: formatAmount(method.min_amount_kopeks / 100, 0),
            max: formatAmount(method.max_amount_kopeks / 100, 0),
          })}{' '}
          {currencySymbol}
        </span>
      </p>
    </div>
  );
}
