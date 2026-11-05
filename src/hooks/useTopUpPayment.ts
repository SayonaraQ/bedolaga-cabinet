import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { usePlatform } from '@/platform';
import { balanceApi } from '../api/balance';
import type { PaymentMethod } from '../types';
import { getApiErrorMessage } from '../utils/api-error';
import { getLocalizedApiErrorMessage } from '../utils/api-error-display';
import { openPaymentUrl } from '../utils/openPaymentUrl';
import { checkRateLimit, getRateLimitResetTime, RATE_LIMIT_KEYS } from '../utils/rateLimit';
import { saveTopUpPendingInfo } from '../utils/topUpStorage';

// Shared with the Stars flow, which still creates invoices in TopUpAmount.
export function getTopUpRateLimitError(t: TFunction): string | null {
  if (!checkRateLimit(RATE_LIMIT_KEYS.PAYMENT, 3, 30000)) {
    return t('balance.errors.rateLimit', {
      seconds: getRateLimitResetTime(RATE_LIMIT_KEYS.PAYMENT),
    });
  }
  return null;
}

export function useTopUpPayment(method: PaymentMethod | undefined): {
  pay: (amountKopeks: number, option?: string | null, extra?: { email?: string }) => void;
  isPending: boolean;
  error: string | null;
  setError: (e: string | null) => void;
  paymentUrl: string | null;
  qrPayload: string | null;
  reset: () => void;
} {
  const { t } = useTranslation();
  const { openLink, platform } = usePlatform();
  const [error, setError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);

  const topUpMutation = useMutation<
    {
      payment_id: string;
      payment_url?: string;
      invoice_url?: string;
      amount_kopeks: number;
      amount_rubles: number;
      status: string;
      expires_at: string | null;
      qr_payload?: string | null;
    },
    unknown,
    { amountKopeks: number; option?: string | null; extra?: { email?: string } }
  >({
    mutationFn: ({ amountKopeks, option, extra }) => {
      if (!method) throw new Error('Method not loaded');
      if (method.id === 'antilopay') {
        return balanceApi.createTopUp(
          amountKopeks,
          method.id,
          option || undefined,
          extra?.email?.trim(),
        );
      }
      return balanceApi.createTopUp(amountKopeks, method.id, option || undefined);
    },
    onSuccess: (data) => {
      const redirectUrl = data.payment_url || data.invoice_url;
      if (redirectUrl) {
        // Save payment info for the result page (do BEFORE possible redirect,
        // иначе после window.location.href этот код не выполнится).
        if (method && data.payment_id) {
          const methodKey = method.id.toLowerCase().replace(/-/g, '_');
          const displayName =
            method.name || t(`balance.paymentMethods.${methodKey}.name`, { defaultValue: '' });
          saveTopUpPendingInfo({
            amount_kopeks: data.amount_kopeks,
            method_id: method.id,
            method_name: displayName,
            payment_id: data.payment_id,
            created_at: Date.now(),
          });
        }

        // open_url_direct: seamless флоу как при покупке подарка.
        // window.location.href внутри Telegram MiniApp WebView навигирует
        // в том же контейнере без открытия внешнего браузера. После
        // оплаты return_url возвращает на /balance/top-up/result.
        //
        // t.me/ URL (Telegram Stars, CryptoBot) — всегда через нативный
        // handler (openInvoice / openTelegramLink в setPaymentUrl-ветке).
        // Stars уже отбит раньше через starsPaymentMutation, здесь — защита
        // на случай CryptoBot и других Telegram-deep-link провайдеров.
        // toLowerCase для устойчивости к редким провайдерам, которые могут вернуть
        // URL в нестандартном регистре. Также покрываем tg:// scheme на всякий случай.
        const lowerUrl = redirectUrl.toLowerCase();
        const isTelegramDeepLink =
          lowerUrl.startsWith('https://t.me/') ||
          lowerUrl.startsWith('http://t.me/') ||
          lowerUrl.startsWith('tg://');
        // Свой экран оплаты: QR показываем здесь же — уводить на страницу провайдера незачем.
        if (data.qr_payload) {
          setQrPayload(data.qr_payload);
          setPaymentUrl(redirectUrl);
          return;
        }

        if (method?.open_url_direct && !isTelegramDeepLink) {
          // In the Telegram WebView, same-container navigation to the provider page breaks
          // when it hands off to a bank app via a custom scheme (SBP) — Android shows
          // ERR_UNKNOWN_URL_SCHEME, iOS opens nothing (bug #654272). Open externally there;
          // on web keep same-tab navigation.
          openPaymentUrl(redirectUrl, platform, openLink);
          return;
        }

        setPaymentUrl(redirectUrl);
      }
    },
    onError: (err: unknown) => {
      const detail = getApiErrorMessage(err, '');
      setError(
        detail.includes('not yet implemented')
          ? t('balance.useBot')
          : getLocalizedApiErrorMessage(err, t('common.error'), t),
      );
    },
  });

  const reset = () => {
    setError(null);
    setPaymentUrl(null);
    setQrPayload(null);
  };

  const pay = (amountKopeks: number, option?: string | null, extra?: { email?: string }) => {
    reset();
    const rateLimitError = getTopUpRateLimitError(t);
    if (rateLimitError) {
      setError(rateLimitError);
      return;
    }
    topUpMutation.mutate({ amountKopeks, option, extra });
  };

  return {
    pay,
    isPending: topUpMutation.isPending,
    error,
    setError,
    paymentUrl,
    qrPayload,
    reset,
  };
}
