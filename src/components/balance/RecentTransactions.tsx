import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Card } from '@/components/data-display/Card';
import { Button } from '@/components/primitives/Button';
import { staggerContainer, staggerItem } from '@/components/motion/transitions';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { useCurrency } from '@/hooks/useCurrency';
import type { PaginatedResponse, Transaction } from '@/types';
import { transactionTypeBadge, transactionTypeLabelKey } from '@/utils/transactionType';
import { uiLocale } from '@/utils/uiLocale';

export function RecentTransactions({
  transactions,
  isLoading,
  onPageChange,
}: {
  transactions: PaginatedResponse<Transaction> | undefined;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  const { formatAmount, currencySymbol } = useCurrency();
  const [open, setOpen] = useState(false);
  const historyId = useId();
  const date = (value: string) => {
    const parsed = new Date(value);
    return new Intl.DateTimeFormat(uiLocale(), {
      day: 'numeric',
      month: 'long',
      ...(parsed.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
    }).format(parsed);
  };
  if (!transactions?.items.length) return null;

  return (
    <Card variants={staggerItem} initial="initial" animate="animate">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-dark-100">
          {t('balance.wallet.recentTransactions')}
        </h2>
        <Button
          variant="link"
          size="sm"
          className="h-auto shrink-0 px-0"
          aria-expanded={open}
          aria-controls={historyId}
          onClick={() => {
            setOpen(!open);
            if (open) onPageChange(1);
          }}
        >
          {t(open ? 'balance.wallet.collapseHistory' : 'balance.wallet.allHistory')}
        </Button>
      </div>
      {!open && (
        <div className="divide-y divide-dark-700/40">
          {transactions.items.slice(0, 3).map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="truncate text-sm text-dark-100">
                  {tx.description || t(transactionTypeLabelKey(tx.type))}
                </div>
                <div className="mt-1 text-xs text-dark-400">{date(tx.created_at)}</div>
              </div>
              <div
                className={`shrink-0 whitespace-nowrap text-sm font-semibold ${tx.amount_rubles > 0 ? 'text-success-400' : 'text-dark-100'}`}
              >
                {tx.amount_rubles === 0 ? '' : tx.amount_rubles > 0 ? '+' : '-'}
                {formatAmount(Math.abs(tx.amount_rubles))}
                {'\u00A0'}
                {currencySymbol}
              </div>
            </div>
          ))}
        </div>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={historyId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {isLoading ? (
              <SkeletonGroup className="space-y-3">
                <Skeleton variant="card" count={3} className="h-16" />
              </SkeletonGroup>
            ) : (
              <motion.div
                className="space-y-3"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                {transactions.items.map((tx) => {
                  const isZero = tx.amount_rubles === 0;
                  const isPositive = tx.amount_rubles > 0;
                  const displayAmount = Math.abs(tx.amount_rubles);
                  const sign = isZero ? '' : isPositive ? '+' : '-';
                  const colorClass = isZero
                    ? 'text-dark-400'
                    : isPositive
                      ? 'text-success-400'
                      : 'text-dark-100';

                  return (
                    <motion.div
                      key={tx.id}
                      variants={staggerItem}
                      className="rounded-linear border border-dark-700/30 bg-dark-800/30 p-4"
                    >
                      {/* Сумма — в строке с типом и датой и держит свою ширину;
                                описание — под ними во всю ширину. Рядом с суммой
                                описание сжималось в узкий столбик, а без запрета
                                сжатия сумму уводило за край карточки, и карточка
                                её обрезала. */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                          <span className={transactionTypeBadge(tx.type)}>
                            {t(transactionTypeLabelKey(tx.type))}
                          </span>
                          <span className="text-xs text-dark-500">{date(tx.created_at)}</span>
                        </div>
                        <div
                          className={`shrink-0 whitespace-nowrap text-lg font-semibold ${colorClass}`}
                        >
                          {sign}
                          {formatAmount(displayAmount)}
                          {'\u00A0'}
                          {currencySymbol}
                        </div>
                      </div>
                      {/* Почта, ник, номер счёта — без пробелов, переносятся где угодно. */}
                      {tx.description && (
                        <div className="mt-2 text-sm text-dark-400 [overflow-wrap:anywhere]">
                          {tx.description}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
            {transactions && transactions.pages > 1 && (
              // Три колонки: «Далее» не уезжает отдельной строкой на всю ширину.
              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm text-dark-500">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onPageChange(Math.max(1, transactions.page - 1))}
                  disabled={transactions.page <= 1}
                >
                  {t('common.back')}
                </Button>
                <div className="whitespace-nowrap text-center">
                  {t('balance.page', {
                    current: transactions.page,
                    total: transactions.pages,
                  })}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onPageChange(Math.min(transactions.pages, transactions.page + 1))}
                  disabled={transactions.page >= transactions.pages}
                >
                  {t('common.next')}
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
