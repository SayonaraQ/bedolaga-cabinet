import { getLocalizedApiErrorMessage } from '../utils/api-error-display';
import { uiLocale } from '@/utils/uiLocale';
import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { usePlatform } from '@/platform';
import { copyToClipboard } from '@/utils/clipboard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/auth';
import { displayName } from '../utils/displayName';
import { authApi } from '../api/auth';
import { isValidEmail } from '../utils/validation';
import { useCountdown } from '../hooks/useCountdown';
import { getApiErrorMessage } from '../utils/api-error';
import {
  notificationsApi,
  type NotificationSettings,
  type NotificationSettingsUpdate,
} from '../api/notifications';
import { brandingApi, type EmailAuthEnabled } from '../api/branding';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { UI } from '../config/constants';
import { Card } from '@/components/data-display/Card';
import { Button } from '@/components/primitives/Button';
import { Switch } from '@/components/primitives/Switch';
import { staggerContainer, staggerItem } from '@/components/motion/transitions';
import {
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  GiftIcon,
  LinkIcon,
  MailIcon,
  NewsIcon,
  PencilIcon,
  TrafficIcon,
  WalletIcon,
} from '@/components/icons';
import { TelegramIcon } from '@/components/ProviderIcon';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();
  const avatar = useUserAvatar(user);
  const name = displayName(user);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [idCopied, setIdCopied] = useState(false);
  const idCopyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showVerificationDetails, setShowVerificationDetails] = useState(false);

  useEffect(
    () => () => {
      if (idCopyTimer.current !== null) clearTimeout(idCopyTimer.current);
    },
    [],
  );

  const copyTelegramId = () => {
    if (!user?.telegram_id) return;
    void copyToClipboard(String(user.telegram_id));
    setIdCopied(true);
    if (idCopyTimer.current !== null) clearTimeout(idCopyTimer.current);
    idCopyTimer.current = setTimeout(() => setIdCopied(false), 2000);
  };

  // Inline email change flow
  const [changeEmailStep, setChangeEmailStep] = useState<'email' | 'code' | 'success' | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [changeCode, setChangeCode] = useState('');
  const [changeError, setChangeError] = useState<string | null>(null);
  const [resendCooldown, startResendCooldown] = useCountdown();
  const [verificationResendCooldown, startVerificationResendCooldown] = useCountdown();
  const newEmailInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Check if email auth is enabled
  const { data: emailAuthConfig } = useQuery<EmailAuthEnabled>({
    queryKey: ['email-auth-enabled'],
    queryFn: brandingApi.getEmailAuthEnabled,
    staleTime: 60000,
  });
  const isEmailAuthEnabled = emailAuthConfig?.enabled ?? true;
  const isEmailVerificationEnabled = emailAuthConfig?.verification_enabled ?? true;

  const resendVerificationMutation = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => {
      setSuccess(t('profile.verificationResent'));
      setError(null);
      startVerificationResendCooldown(UI.RESEND_COOLDOWN_SEC);
    },
    onError: (err: unknown) => {
      setError(getLocalizedApiErrorMessage(err, t('common.error'), t));
      setSuccess(null);
    },
  });

  // Email change mutations
  const requestEmailChangeMutation = useMutation({
    mutationFn: (emailAddr: string) => authApi.requestEmailChange(emailAddr),
    onSuccess: async (data) => {
      setChangeError(null);
      if (data.expires_in_minutes === 0) {
        // Unverified email was replaced directly
        setChangeEmailStep('success');
        const updatedUser = await authApi.getMe();
        setUser(updatedUser);
      } else {
        setChangeEmailStep('code');
        startResendCooldown(UI.RESEND_COOLDOWN_SEC);
      }
    },
    onError: (err: unknown) => {
      const detail = getApiErrorMessage(err, '');
      if (detail.includes('already registered') || detail.includes('already in use')) {
        setChangeError(t('profile.changeEmail.emailAlreadyUsed'));
      } else if (detail.includes('same as current')) {
        setChangeError(t('profile.changeEmail.sameEmail'));
      } else if (detail.includes('rate limit') || detail.includes('too many')) {
        setChangeError(t('profile.changeEmail.tooManyRequests'));
      } else {
        setChangeError(getLocalizedApiErrorMessage(err, t('common.error'), t));
      }
    },
  });

  const verifyEmailChangeMutation = useMutation({
    mutationFn: (verificationCode: string) => authApi.verifyEmailChange(verificationCode),
    onSuccess: async () => {
      setChangeError(null);
      setChangeEmailStep('success');
      const updatedUser = await authApi.getMe();
      setUser(updatedUser);
      // Note: auth user lives in the zustand store, not in React Query —
      // the explicit setUser above IS the refresh. No ['user'] query exists.
    },
    onError: (err: unknown) => {
      const detail = getApiErrorMessage(err, '');
      if (detail.includes('invalid') || detail.includes('wrong')) {
        setChangeError(t('profile.changeEmail.invalidCode'));
      } else if (detail.includes('expired')) {
        setChangeError(t('profile.changeEmail.codeExpired'));
      } else {
        setChangeError(getLocalizedApiErrorMessage(err, t('common.error'), t));
      }
    },
  });

  // Auto-focus inputs on step change (skip on Telegram — keyboard hides bottom nav)
  const { platform: profilePlatform } = usePlatform();
  useEffect(() => {
    if (profilePlatform === 'telegram') return;
    const timer = setTimeout(() => {
      if (changeEmailStep === 'email') newEmailInputRef.current?.focus();
      else if (changeEmailStep === 'code') codeInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [changeEmailStep, profilePlatform]);

  const resetChangeEmail = useCallback(() => {
    setChangeEmailStep(null);
    setNewEmail('');
    setChangeCode('');
    setChangeError(null);
    startResendCooldown(0);
  }, [startResendCooldown]);

  // Auto-close success after 3s
  useEffect(() => {
    if (changeEmailStep !== 'success') return;
    const timer = setTimeout(resetChangeEmail, 3000);
    return () => clearTimeout(timer);
  }, [changeEmailStep, resetChangeEmail]);

  const handleSendChangeCode = () => {
    setChangeError(null);
    if (!newEmail.trim()) {
      setChangeError(t('profile.emailRequired'));
      return;
    }
    if (!isValidEmail(newEmail.trim())) {
      setChangeError(t('profile.invalidEmail'));
      return;
    }
    if (user?.email && newEmail.toLowerCase().trim() === user.email.toLowerCase()) {
      setChangeError(t('profile.changeEmail.sameEmail'));
      return;
    }
    requestEmailChangeMutation.mutate(newEmail.trim());
  };

  const handleVerifyChangeCode = () => {
    setChangeError(null);
    if (!changeCode.trim()) {
      setChangeError(t('profile.changeEmail.enterCode'));
      return;
    }
    if (changeCode.trim().length < 4) {
      setChangeError(t('profile.changeEmail.invalidCode'));
      return;
    }
    verifyEmailChangeMutation.mutate(changeCode.trim());
  };

  const handleResendChangeCode = () => {
    if (resendCooldown > 0) return;
    requestEmailChangeMutation.mutate(newEmail.trim());
  };

  const { data: notificationSettings, isLoading: notificationsLoading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: notificationsApi.getSettings,
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: notificationsApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
  });

  const handleNotificationToggle = (key: keyof NotificationSettings, value: boolean) => {
    const update: NotificationSettingsUpdate = { [key]: value };
    updateNotificationsMutation.mutate(update);
  };

  const handleNotificationValue = (key: keyof NotificationSettings, value: number) => {
    const update: NotificationSettingsUpdate = { [key]: value };
    updateNotificationsMutation.mutate(update);
  };

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold text-dark-50 sm:text-3xl">{t('profile.title')}</h1>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 space-y-6">
          <motion.div variants={staggerItem}>
            <Card>
              <div className="flex items-center gap-4">
                {avatar.src ? (
                  <img
                    src={avatar.src}
                    onError={avatar.onError}
                    alt={t('common.avatar')}
                    className="h-16 w-16 shrink-0 rounded-full object-cover shadow-[0_0_0_4px_rgba(var(--color-accent-500),0.15)]"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-accent-700 text-2xl font-semibold text-white shadow-[0_0_0_4px_rgba(var(--color-accent-500),0.15)]">
                    {Array.from(name)[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="break-words text-xl font-semibold text-dark-50">{name}</div>
                  {(user?.username || user?.email) && (
                    <div className="mt-0.5 break-words text-sm text-dark-400">
                      {user.username ? `@${user.username}` : user.email}
                    </div>
                  )}
                </div>
              </div>
              {(user?.telegram_id || user?.created_at) && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {user?.telegram_id && (
                    <button
                      type="button"
                      onClick={copyTelegramId}
                      aria-label={t(idCopied ? 'profile.idCopied' : 'profile.copyId')}
                      className="flex items-center gap-2 rounded-full border border-dark-700/70 px-3 py-1.5 font-mono text-[12px] text-dark-300 transition-colors hover:border-accent-500/60 hover:text-dark-100"
                    >
                      {t('profile.idChip', { id: user.telegram_id })}
                      {idCopied ? (
                        <CheckIcon className="h-3.5 w-3.5 text-success-400" />
                      ) : (
                        <CopyIcon className="h-3.5 w-3.5 text-dark-400" />
                      )}
                    </button>
                  )}
                  {user?.created_at && (
                    <span className="flex items-center gap-2 rounded-full border border-dark-700/70 px-3 py-1.5 text-[12px] text-dark-300">
                      <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-dark-400" />
                      {t('profile.memberSince', {
                        date: new Date(user.created_at).toLocaleDateString(uiLocale(), {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        }),
                      })}
                    </span>
                  )}
                </div>
              )}
            </Card>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Card>
              <h2 className="text-lg font-semibold text-dark-100">{t('profile.signInMethods')}</h2>
              <div className="mt-4 divide-y divide-dark-800/60">
                {user?.telegram_id && (
                  <div className="flex items-center gap-3 pb-3">
                    <ProfileIconTile telegram>
                      <TelegramIcon className="h-5 w-5" />
                    </ProfileIconTile>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-dark-100">Telegram</div>
                      <div className="mt-0.5 truncate text-xs text-dark-400">
                        {user.username ? `@${user.username}` : user.telegram_id}
                      </div>
                    </div>
                    <StatusPill>{t('profile.connected')}</StatusPill>
                  </div>
                )}
                {isEmailAuthEnabled && (
                  <div className="pb-3 pt-3 first:pt-0">
                    <div className="flex items-center gap-3">
                      <ProfileIconTile>
                        <MailIcon className="h-5 w-5" />
                      </ProfileIconTile>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-dark-100">{t('profile.emailLabel')}</div>
                        <div className="mt-0.5 truncate text-xs text-dark-400">
                          {user?.email || t('profile.emailNotLinked')}
                        </div>
                      </div>
                      {!user?.email ? (
                        <button
                          type="button"
                          onClick={() => navigate('/profile/accounts')}
                          className="shrink-0 text-sm font-medium text-accent-400 transition-colors hover:text-accent-300"
                        >
                          {t('profile.link')}
                        </button>
                      ) : !user.email_verified && isEmailVerificationEnabled ? (
                        <button
                          type="button"
                          aria-expanded={showVerificationDetails}
                          aria-controls="profile-email-verification"
                          onClick={() => setShowVerificationDetails((shown) => !shown)}
                          className="shrink-0 text-sm font-medium text-warning-400 transition-colors hover:text-warning-300"
                        >
                          {t('profile.confirmEmail')}
                        </button>
                      ) : (
                        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                          {user.email_verified && <StatusPill>{t('profile.verified')}</StatusPill>}
                          <button
                            type="button"
                            onClick={() => setChangeEmailStep('email')}
                            className="text-sm font-medium text-accent-400 transition-colors hover:text-accent-300"
                          >
                            {t('profile.changeShort')}
                          </button>
                        </div>
                      )}
                    </div>
                    {user?.email && (
                      <div className="sm:pl-[52px]">
                        {!user.email_verified &&
                          isEmailVerificationEnabled &&
                          showVerificationDetails && (
                            <div
                              id="profile-email-verification"
                              className="mt-4 rounded-linear border border-warning-500/30 bg-warning-500/10 p-4"
                            >
                              <p className="mb-4 text-sm text-warning-400">
                                {t('profile.verificationRequired')}
                              </p>
                              <div className="flex flex-wrap items-center gap-3">
                                <Button
                                  onClick={() => resendVerificationMutation.mutate()}
                                  loading={resendVerificationMutation.isPending}
                                  disabled={verificationResendCooldown > 0}
                                >
                                  {verificationResendCooldown > 0
                                    ? t('profile.resendIn', { seconds: verificationResendCooldown })
                                    : t('profile.resendVerification')}
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => setChangeEmailStep('email')}
                                >
                                  <PencilIcon className="h-4 w-4" />
                                  {t('profile.changeEmail.button')}
                                </Button>
                              </div>
                            </div>
                          )}
                        <AnimatePresence>
                          {changeEmailStep === 'email' && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="mt-4 overflow-hidden"
                            >
                              <div className="space-y-3 border-t border-dark-800/50 pt-4">
                                <label className="block text-sm font-medium text-dark-400">
                                  {t('profile.changeEmail.newEmail')}
                                </label>
                                <input
                                  ref={newEmailInputRef}
                                  type="email"
                                  value={newEmail}
                                  onChange={(e) => setNewEmail(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSendChangeCode();
                                    }
                                  }}
                                  placeholder="new@email.com"
                                  className="input w-full"
                                  autoComplete="email"
                                />
                                {changeError && (
                                  <p className="text-sm text-error-400">{changeError}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-3">
                                  <Button
                                    onClick={handleSendChangeCode}
                                    loading={requestEmailChangeMutation.isPending}
                                    disabled={!newEmail.trim()}
                                  >
                                    {t('profile.changeEmail.sendCode')}
                                  </Button>
                                  <Button variant="secondary" onClick={resetChangeEmail}>
                                    {t('common.cancel')}
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          )}

                          {changeEmailStep === 'code' && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="mt-4 overflow-hidden"
                            >
                              <div className="space-y-3 border-t border-dark-800/50 pt-4">
                                <div className="rounded-linear border border-accent-500/30 bg-accent-500/10 p-3">
                                  <p className="text-sm text-accent-400">
                                    {t('profile.changeEmail.codeSentTo', { email: newEmail })}
                                  </p>
                                </div>
                                <label className="block text-sm font-medium text-dark-400">
                                  {t('profile.changeEmail.verificationCode')}
                                </label>
                                <input
                                  ref={codeInputRef}
                                  type="text"
                                  inputMode="numeric"
                                  value={changeCode}
                                  onChange={(e) => setChangeCode(e.target.value.replace(/\D/g, ''))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleVerifyChangeCode();
                                    }
                                  }}
                                  placeholder="000000"
                                  maxLength={6}
                                  className="input w-full text-center text-2xl tracking-[0.5em]"
                                  autoComplete="one-time-code"
                                />
                                {changeError && (
                                  <p className="text-sm text-error-400">{changeError}</p>
                                )}
                                {/* Три действия на телефон в строку не влезают — переносятся. */}
                                <div className="flex flex-wrap items-center gap-3">
                                  <Button
                                    onClick={handleVerifyChangeCode}
                                    loading={verifyEmailChangeMutation.isPending}
                                    disabled={!changeCode.trim()}
                                  >
                                    {t('profile.changeEmail.verify')}
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    onClick={() => {
                                      setChangeEmailStep('email');
                                      setChangeCode('');
                                      setChangeError(null);
                                    }}
                                  >
                                    {t('common.back')}
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    onClick={handleResendChangeCode}
                                    disabled={
                                      resendCooldown > 0 || requestEmailChangeMutation.isPending
                                    }
                                  >
                                    {resendCooldown > 0
                                      ? t('profile.changeEmail.resendIn', {
                                          seconds: resendCooldown,
                                        })
                                      : t('profile.changeEmail.resendCode')}
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          )}

                          {changeEmailStep === 'success' && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="mt-4 overflow-hidden"
                            >
                              <div className="border-t border-dark-800/50 pt-4">
                                <div className="flex items-center gap-3 rounded-linear border border-success-500/30 bg-success-500/10 p-4">
                                  <CheckIcon />
                                  <div>
                                    <p className="font-medium text-success-400">
                                      {t('profile.changeEmail.success')}
                                    </p>
                                    <p className="text-sm text-dark-400">{newEmail}</p>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/profile/accounts')}
                  className="group flex w-full items-center gap-3 pt-3 text-left first:pt-0"
                >
                  <ProfileIconTile>
                    <LinkIcon className="h-5 w-5" />
                  </ProfileIconTile>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-dark-100 transition-colors group-hover:text-accent-400">
                      {t('profile.accounts.goToAccounts')}
                    </span>
                    <span className="mt-0.5 block text-xs text-dark-400">
                      {t('profile.accounts.subtitle')}
                    </span>
                  </span>
                  <ChevronRightIcon className="h-5 w-5 shrink-0 text-dark-400" />
                </button>
              </div>
              {isEmailAuthEnabled && (error || success) && user?.email && (
                <div className="mt-4">
                  {error && (
                    <div className="rounded-linear border border-error-500/30 bg-error-500/10 p-4 text-sm text-error-400">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="rounded-linear border border-success-500/30 bg-success-500/10 p-4 text-sm text-success-400">
                      {success}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        <motion.div className="min-w-0" variants={staggerItem}>
          <Card>
            <h2 className="mb-5 text-lg font-semibold text-dark-100">
              {t('profile.notifications.title')}
            </h2>
            {notificationsLoading ? (
              <SkeletonGroup className="space-y-3">
                <Skeleton variant="card" count={3} className="h-16" />
              </SkeletonGroup>
            ) : notificationSettings ? (
              <div className="space-y-5">
                <NotificationRow
                  icon={<ClockIcon className="h-5 w-5" />}
                  title={t('profile.notifications.subscriptionExpiry')}
                  description={t('profile.notifications.subscriptionExpiryDesc')}
                  enabled={notificationSettings.subscription_expiry_enabled}
                  onToggle={(checked) =>
                    handleNotificationToggle('subscription_expiry_enabled', checked)
                  }
                >
                  <NotificationThresholdChips
                    label={t('profile.notifications.daysBeforeExpiry')}
                    values={[1, 2, 3, 5, 7, 14]}
                    selected={notificationSettings.subscription_expiry_days}
                    onSelect={(value) => handleNotificationValue('subscription_expiry_days', value)}
                  />
                </NotificationRow>
                <NotificationRow
                  divider
                  icon={<TrafficIcon className="h-5 w-5" />}
                  title={t('profile.notifications.trafficWarning')}
                  description={t('profile.notifications.trafficWarningDesc')}
                  enabled={notificationSettings.traffic_warning_enabled}
                  onToggle={(checked) =>
                    handleNotificationToggle('traffic_warning_enabled', checked)
                  }
                >
                  <NotificationThresholdChips
                    label={t('profile.notifications.atPercent')}
                    values={[50, 70, 80, 90, 95]}
                    selected={notificationSettings.traffic_warning_percent}
                    suffix="%"
                    onSelect={(value) => handleNotificationValue('traffic_warning_percent', value)}
                  />
                </NotificationRow>
                <NotificationRow
                  divider
                  icon={<WalletIcon className="h-5 w-5" />}
                  title={t('profile.notifications.balanceLow')}
                  description={t('profile.notifications.balanceLowDesc')}
                  enabled={notificationSettings.balance_low_enabled}
                  onToggle={(checked) => handleNotificationToggle('balance_low_enabled', checked)}
                >
                  <label className="flex flex-wrap items-center gap-3 text-xs text-dark-400">
                    {t('profile.notifications.threshold')}
                    <input
                      type="number"
                      value={notificationSettings.balance_low_threshold}
                      onChange={(e) =>
                        handleNotificationValue('balance_low_threshold', Number(e.target.value))
                      }
                      min={0}
                      className="input w-24 border-dark-700/70 py-1 font-mono text-[12px]"
                    />
                  </label>
                </NotificationRow>
                <NotificationRow
                  divider
                  icon={<NewsIcon className="h-5 w-5" />}
                  title={t('profile.notifications.news')}
                  description={t('profile.notifications.newsDesc')}
                  enabled={notificationSettings.news_enabled}
                  onToggle={(checked) => handleNotificationToggle('news_enabled', checked)}
                />
                <NotificationRow
                  divider
                  icon={<GiftIcon className="h-5 w-5" />}
                  title={t('profile.notifications.promoOffers')}
                  description={t('profile.notifications.promoOffersDesc')}
                  enabled={notificationSettings.promo_offers_enabled}
                  onToggle={(checked) => handleNotificationToggle('promo_offers_enabled', checked)}
                />
              </div>
            ) : (
              <p className="text-dark-400">{t('profile.notifications.unavailable')}</p>
            )}
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function ProfileIconTile({
  children,
  telegram = false,
}: {
  children: ReactNode;
  telegram?: boolean;
}) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-linear ${telegram ? '' : 'bg-accent-500/10 text-accent-400'}`}
      style={telegram ? { background: 'rgba(42,171,238,0.12)', color: '#2AABEE' } : undefined}
    >
      {children}
    </span>
  );
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-full border border-success-500/30 bg-success-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-success-400">
      {children}
    </span>
  );
}

function NotificationRow({
  icon,
  title,
  description,
  enabled,
  onToggle,
  divider = false,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  divider?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={divider ? 'border-t border-dark-800/60 pt-5' : undefined}>
      <div className="flex items-center gap-3">
        <ProfileIconTile>{icon}</ProfileIconTile>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-dark-100">{title}</div>
          <div className="mt-0.5 text-xs text-dark-400">{description}</div>
        </div>
        <Switch aria-label={title} checked={enabled} onCheckedChange={onToggle} />
      </div>
      {enabled && children && <div className="mt-3 sm:pl-[52px]">{children}</div>}
    </div>
  );
}

function NotificationThresholdChips({
  label,
  values,
  selected,
  onSelect,
  suffix = '',
}: {
  label: string;
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
  suffix?: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="w-full text-xs text-dark-400">{label}</span>
      {values.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={value === selected}
          onClick={() => onSelect(value)}
          className={`rounded-linear border px-2.5 py-1 font-mono text-[12px] transition-colors ${value === selected ? 'border-accent-500/60 bg-accent-500/15 text-accent-300' : 'border-dark-700/70 text-dark-400 hover:text-dark-200'}`}
        >
          {value}
          {suffix}
        </button>
      ))}
    </div>
  );
}
