import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { usePlatform } from '@/platform';
import { staggerItem } from '@/components/motion/transitions';
import { CheckIcon, CopyIcon, ExternalLinkIcon } from '@/components/icons';
import { copyToClipboard } from '@/utils/clipboard';

export function PaymentReadyPanel({
  paymentUrl,
  qrPayload,
}: {
  paymentUrl: string;
  qrPayload: string | null;
}) {
  const { t } = useTranslation();
  const { openTelegramLink, openLink } = usePlatform();
  const [copied, setCopied] = useState(false);

  const handleOpenPayment = () => {
    if (!paymentUrl) return;
    if (paymentUrl.includes('t.me/')) {
      openTelegramLink(paymentUrl);
    } else {
      openLink(paymentUrl);
    }
  };

  const handleCopyUrl = async () => {
    if (!paymentUrl) return;
    try {
      await copyToClipboard(paymentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed silently
    }
  };

  return (
    <motion.div
      variants={staggerItem}
      className="space-y-3 rounded-2xl border border-success-500/20 bg-success-500/10 p-4"
    >
      <div className="flex items-center gap-2 text-success-400">
        <CheckIcon className="h-5 w-5" />
        <span className="font-semibold">{t('balance.paymentReady')}</span>
      </div>

      {qrPayload ? (
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-xl bg-white p-3" data-testid="topup-qr">
            <QRCodeSVG value={qrPayload} size={192} level="M" includeMargin={false} />
          </div>
          <p className="text-center text-sm text-dark-400">
            {t('balance.scanQrToPay', 'Отсканируйте QR-код в приложении банка или откройте оплату')}
          </p>
        </div>
      ) : (
        <p className="text-sm text-dark-400">{t('balance.clickToOpenPayment')}</p>
      )}

      <button
        type="button"
        onClick={handleOpenPayment}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-success-500 font-bold text-white transition-colors hover:bg-success-400 active:bg-success-600"
      >
        <ExternalLinkIcon />
        <span>{t('balance.openPaymentPage')}</span>
      </button>

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 rounded-lg border border-dark-700/50 bg-dark-800/70 px-3 py-2">
          <p className="truncate text-xs text-dark-500">{paymentUrl}</p>
        </div>
        <button
          type="button"
          onClick={handleCopyUrl}
          className={`shrink-0 rounded-lg p-2.5 transition-colors ${
            copied
              ? 'bg-success-500/20 text-success-400'
              : 'bg-dark-800/70 text-dark-400 hover:bg-dark-700 hover:text-dark-200'
          }`}
          title={t('common.copy')}
        >
          {copied ? <CheckIcon className="h-5 w-5" /> : <CopyIcon className="h-5 w-5" />}
        </button>
      </div>
    </motion.div>
  );
}
