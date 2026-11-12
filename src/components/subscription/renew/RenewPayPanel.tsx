import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { balanceApi } from '@/api/balance';
import { methodDisplayName, PaymentChoice } from '@/components/balance/PaymentChoice';
import { PaymentReadyPanel } from '@/components/balance/PaymentReadyPanel';
import { Button } from '@/components/primitives/Button';
import { useCurrency } from '@/hooks/useCurrency';
import { useTopUpPayment } from '@/hooks/useTopUpPayment';
import { getPreferredOptionId } from '@/utils/paymentOptions';
import {
  paymentOptionLabel,
  renewalShortfallKopeks,
  renewTopUpAmount,
} from '@/utils/renew/renewPlan';

export type RenewAttempt =
  | { kind: 'renewed' }
  | { kind: 'insufficient'; missingKopeks: number | null }
  | { kind: 'stopped' };

export function RenewPayPanel({
  shortfallKopeks,
  saveRenewal,
}: {
  shortfallKopeks: number;
  saveRenewal: () => Promise<RenewAttempt>;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatAmount, currencySymbol, targetCurrency } = useCurrency();
  const {
    data: methods = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: balanceApi.getPaymentMethods,
  });
  const [methodId, setMethodId] = useState<string | null>(null);
  const method =
    methods.find((item) => item.id === methodId && item.is_available) ??
    methods.find((item) => item.is_available);
  const [optionId, setOptionId] = useState<string | null>(null);
  const selectedOptionId =
    method?.options?.find((option) => option.id === optionId)?.id ??
    getPreferredOptionId(method?.options);
  const selectedOption = method?.options?.find((option) => option.id === selectedOptionId);
  const { pay, isPending, error, paymentUrl, qrPayload, reset } = useTopUpPayment(method);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const submitting = useRef(false);
  const amount = method ? renewTopUpAmount(shortfallKopeks, method) : null;
  const money = (kopeks: number) =>
    `${formatAmount(kopeks / 100, kopeks % 100 === 0 ? 0 : 2)}\u00A0${currencySymbol}`;

  const handlePay = async () => {
    if (!method || !amount || saving || isPending || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setLocalError(null);
    reset();
    try {
      const result = await saveRenewal();
      if (result.kind !== 'insufficient') return;
      const confirmedAmount = renewTopUpAmount(
        result.missingKopeks !== null
          ? renewalShortfallKopeks(result.missingKopeks, 0)
          : shortfallKopeks,
        method,
      );
      if (!confirmedAmount) {
        setLocalError(t('common.error'));
        return;
      }
      if (method.id === 'stars' || method.id === 'antilopay' || targetCurrency !== 'RUB') {
        navigate(`/balance/top-up/${method.id}?amount=${confirmedAmount.amountKopeks / 100}`);
        return;
      }
      pay(confirmedAmount.amountKopeks, selectedOptionId);
    } catch {
      setLocalError(t('common.error'));
    } finally {
      setSaving(false);
      // Держим блокировку через await и запуск pay, даже без pending-рендера.
      queueMicrotask(() => {
        submitting.current = false;
      });
    }
  };

  if (isLoading) return <p className="mt-5 text-sm text-dark-400">{t('common.loading')}</p>;
  if (isError)
    return (
      <p role="alert" className="mt-5 text-sm text-error-400">
        {t('common.error')}
      </p>
    );
  if (!method) return <p className="mt-5 text-sm text-dark-400">{t('balance.noPaymentMethods')}</p>;

  return (
    <div className="mt-5 space-y-3 border-t border-dark-700/50 pt-5">
      <h2 className="font-semibold text-dark-100">
        {t('subscription.renewPage.topUpHeading', {
          amount: money(amount?.amountKopeks ?? shortfallKopeks),
        })}
      </h2>
      <PaymentChoice
        methods={methods}
        method={method}
        onMethodChange={(id) => {
          setMethodId(id);
          setOptionId(null);
          reset();
          setLocalError(null);
        }}
        selectedOptionId={selectedOptionId ?? undefined}
        onOptionChange={setOptionId}
        disabled={saving || isPending}
      />
      <Button
        fullWidth
        className="h-auto min-h-14 min-w-0 whitespace-normal py-3"
        disabled={!amount || saving || isPending}
        onClick={handlePay}
      >
        {saving || isPending
          ? t('common.processing')
          : t('subscription.renewPage.payVia', {
              amount: money(amount?.amountKopeks ?? shortfallKopeks),
              name: selectedOption
                ? paymentOptionLabel(selectedOption.name)
                : methodDisplayName(method, t),
            })}
      </Button>
      {amount?.raisedToMinimum && (
        <p className="text-xs leading-relaxed text-dark-400">
          {t('subscription.renewPage.minTopUpHint', { amount: money(amount.amountKopeks) })}
        </p>
      )}
      {(localError || error || !amount) && (
        <div
          role="alert"
          className="rounded-linear border border-error-500/30 bg-error-500/10 p-3 text-sm text-error-400"
        >
          {localError || error || t('common.error')}
        </div>
      )}
      {paymentUrl && <PaymentReadyPanel paymentUrl={paymentUrl} qrPayload={qrPayload} />}
      <p className="text-center text-xs leading-relaxed text-dark-400">
        {t('subscription.renewPage.payHint')}
      </p>
    </div>
  );
}
