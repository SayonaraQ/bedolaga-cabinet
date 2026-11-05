import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/auth';
import { balanceApi } from '../api/balance';
import { subscriptionApi } from '../api/subscription';
import { API } from '../config/constants';
import type { PaginatedResponse, Transaction } from '../types';
import { WalletCard } from '@/components/balance/WalletCard';
import { PromoCodeRow } from '@/components/balance/PromoCodeRow';
import { RecentTransactions } from '@/components/balance/RecentTransactions';
import { Card } from '@/components/data-display/Card';
import { ChevronRightIcon, CreditCardIcon } from '@/components/icons';
import { staggerContainer, staggerItem } from '@/components/motion/transitions';
import { isPaidStatus, isFailedStatus } from '../utils/paymentStatus';

export default function Balance() {
  const { t } = useTranslation();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paymentHandledRef = useRef(false);
  const [transactionsPage, setTransactionsPage] = useState(1);

  const { data: balanceData } = useQuery({
    queryKey: ['balance'],
    queryFn: balanceApi.getBalance,
    staleTime: API.BALANCE_STALE_TIME_MS,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (paymentHandledRef.current) return;

    const paymentStatus = searchParams.get('payment') || searchParams.get('status');

    const normalised = paymentStatus?.toLowerCase() ?? '';
    const isSuccess = isPaidStatus(normalised) || searchParams.get('success') === 'true';
    const isFailed = isFailedStatus(normalised);

    if (isSuccess) {
      paymentHandledRef.current = true;
      navigate('/balance/top-up/result?status=success', { replace: true });
    } else if (isFailed) {
      paymentHandledRef.current = true;
      navigate('/balance/top-up/result?status=failed', { replace: true });
    }
  }, [searchParams, navigate]);

  const { data: transactions, isLoading } = useQuery<PaginatedResponse<Transaction>>({
    queryKey: ['transactions', transactionsPage],
    queryFn: () => balanceApi.getTransactions({ per_page: 20, page: transactionsPage }),
    placeholderData: (previousData) => previousData,
  });

  const { data: paymentMethods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: balanceApi.getPaymentMethods,
  });

  const { data: savedCardsData } = useQuery({
    queryKey: ['saved-cards'],
    queryFn: balanceApi.getSavedCards,
    enabled: !!paymentMethods,
    staleTime: 5 * 60 * 1000,
  });

  const { data: subscriptionResponse } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.getSubscription(),
  });
  const subscription = subscriptionResponse?.subscription ?? null;
  const { data: renewalOptions } = useQuery({
    queryKey: ['renewal-options', subscription?.id],
    queryFn: () => subscriptionApi.getRenewalOptions(subscription?.id),
    enabled: !!subscription && !subscription.is_trial,
  });

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold text-dark-50 sm:text-3xl">{t('balance.title')}</h1>
      </motion.div>
      <motion.div variants={staggerItem}>
        <WalletCard
          balanceKopeks={balanceData?.balance_kopeks ?? 0}
          subscription={subscription}
          renewalOptions={renewalOptions}
          methods={paymentMethods ?? []}
        />
      </motion.div>
      <motion.div variants={staggerItem}>
        <PromoCodeRow onActivated={() => setTransactionsPage(1)} />
      </motion.div>
      <RecentTransactions
        transactions={transactions}
        isLoading={isLoading}
        onPageChange={setTransactionsPage}
      />
      {savedCardsData?.recurrent_enabled && (
        <motion.div variants={staggerItem} initial="initial" animate="animate">
          <Card interactive onClick={() => navigate('/balance/saved-cards')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCardIcon className="h-5 w-5 text-dark-400" />
                <span className="font-medium text-dark-100">{t('balance.savedCards.title')}</span>
              </div>
              <ChevronRightIcon className="h-5 w-5 text-dark-400" />
            </div>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
