import { hasUnknownManagedTraffic } from '@/utils/trafficAccounting';
import ManagedTrafficSummary from '@/components/subscription/ManagedTrafficSummary';
import { uiLocale } from '@/utils/uiLocale';
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { subscriptionApi } from '../api/subscription';
import { WebBackButton } from '../components/WebBackButton';
import TrafficProgressBar from '../components/dashboard/TrafficProgressBar';
import { ConnectDeviceButton } from '../components/ui/ConnectDeviceButton';
import { useTrafficZone } from '../hooks/useTrafficZone';
import { formatTraffic } from '../utils/formatTraffic';
import { getGlassColors } from '../utils/glassTheme';
import { copyToClipboard } from '../utils/clipboard';
import { useTheme } from '../hooks/useTheme';
import { useCloseOnSuccessNotification } from '../store/successNotification';
import PurchaseCTAButton from '../components/subscription/PurchaseCTAButton';
import {
  CARD_CTA_LABEL,
  subscriptionCardCta,
  tariffSwitchLink,
  type CardCtaAction,
} from '../utils/subscriptionCta';
import { planTitle, showsAddonOptions } from '../utils/legacySubscription';
import {
  ArrowsLeftRightIcon,
  CalendarIcon,
  ChatIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  DevicesIcon,
  DownloadIcon,
  RefreshIcon,
  SubscriptionIcon,
  TrashIcon,
  WarningIcon,
} from '../components/icons';
import { useHaptic } from '../platform';
import { resolveConnectionUrlForUi } from '../utils/connectionLink';
import { getFlagEmoji } from '../utils/subscriptionHelpers';
import Twemoji from '@/lib/twemoji';
import { AutopayToggle } from '../components/subscription/manage/AutopayToggle';
import { DailyPausePanel } from '../components/subscription/manage/DailyPausePanel';
import {
  canReissueLink,
  ReissueLinkButton,
} from '../components/subscription/manage/ReissueLinkButton';
import { DeviceSlotsPanel } from '../components/subscription/manage/DeviceSlotsPanel';
import { useScrollToSection } from '../hooks/useScrollToSection';
import { RecurringPanels } from '../components/subscription/manage/RecurringPanels';
import { DeviceTopupSheet } from '../components/subscription/sheets/DeviceTopupSheet';
import { DeviceReductionSheet } from '../components/subscription/sheets/DeviceReductionSheet';
import { TrafficTopupSheet } from '../components/subscription/sheets/TrafficTopupSheet';
import { ServerManagementSheet } from '../components/subscription/sheets/ServerManagementSheet';
import { DeleteSubscriptionSheet } from '../components/subscription/sheets/DeleteSubscriptionSheet';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';
import { safeLocal } from '../utils/safeStorage';

/** Isolated countdown so 1s interval doesn't re-render the whole page */
const CountdownTimer = memo(function CountdownTimer({
  endDate,
  isActive,
  glassColors: g,
  footer,
  inactiveLabel,
}: {
  endDate: string;
  isActive: boolean;
  glassColors: ReturnType<typeof getGlassColors>;
  /** «Продлить подписку» прямо под сроком (макет 05.11.2026). */
  footer?: React.ReactNode;
  /** Слово вместо таймера, когда подписка не идёт; по умолчанию «Истекла». */
  inactiveLabel?: string;
}) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const endTime = new Date(endDate).getTime();
    const tick = () => {
      const diff = Math.max(0, endTime - Date.now());
      setCountdown({
        days: Math.floor(diff / 86_400_000),
        hours: Math.floor((diff % 86_400_000) / 3_600_000),
        minutes: Math.floor((diff % 3_600_000) / 60_000),
        seconds: Math.floor((diff % 60_000) / 1_000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endDate]);

  const isExpired = !isActive;
  const isUrgent = countdown.days <= 3;

  const formattedDate = new Date(endDate).toLocaleDateString(uiLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      data-testid="countdown-card"
      className="min-w-0 overflow-hidden rounded-[14px] p-3.5"
      style={{
        background: isExpired
          ? 'rgba(255,59,92,0.06)'
          : isUrgent
            ? 'rgba(255,184,0,0.06)'
            : g.innerBg,
        border: isExpired
          ? '1px solid rgba(255,59,92,0.15)'
          : isUrgent
            ? '1px solid rgba(255,184,0,0.15)'
            : `1px solid ${g.innerBorder}`,
      }}
    >
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-dark-400">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-[7px]"
          style={{
            background: isExpired
              ? 'rgba(255,59,92,0.1)'
              : isUrgent
                ? 'rgba(255,184,0,0.1)'
                : g.hoverBg,
          }}
        >
          <span
            style={{
              color: isExpired
                ? 'rgb(var(--color-critical-500))'
                : isUrgent
                  ? 'rgb(var(--color-urgent-400))'
                  : g.textSecondary,
            }}
          >
            <CalendarIcon className="h-[13px] w-[13px]" />
          </span>
        </div>
        {t('dashboard.remaining')}
      </div>
      {isExpired ? (
        <div
          className="text-[18px] font-bold tracking-tight"
          style={{ color: 'rgb(var(--color-critical-500))' }}
        >
          {inactiveLabel ?? t('subscription.expired')}
        </div>
      ) : (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          {/* На телефоне дата уходит на свою строку: рядом с таймером ей не хватало места, и она ломалась посреди «23 сент. / 2026 г.» */}
          <div className="flex items-baseline gap-1 font-mono tabular-nums">
            {countdown.days > 0 && (
              <>
                <span
                  className="text-[20px] font-bold tracking-tight"
                  style={{ color: isUrgent ? 'rgb(var(--color-urgent-400))' : g.text }}
                >
                  {countdown.days}
                </span>
                <span className="mr-1 text-[10px] font-medium text-dark-400">
                  {t('subscription.daysShort')}
                </span>
              </>
            )}
            <span
              className="text-[20px] font-bold tracking-tight"
              style={{ color: isUrgent ? 'rgb(var(--color-urgent-400))' : g.text }}
            >
              {String(countdown.hours).padStart(2, '0')}
            </span>
            <span
              className="mx-[-1px] text-[16px] font-bold opacity-30"
              style={{ color: isUrgent ? 'rgb(var(--color-urgent-400))' : g.text }}
            >
              :
            </span>
            <span
              className="text-[20px] font-bold tracking-tight"
              style={{ color: isUrgent ? 'rgb(var(--color-urgent-400))' : g.text }}
            >
              {String(countdown.minutes).padStart(2, '0')}
            </span>
            <span
              className="mx-[-1px] text-[16px] font-bold opacity-30"
              style={{ color: isUrgent ? 'rgb(var(--color-urgent-400))' : g.text }}
            >
              :
            </span>
            <span
              className="text-[20px] font-bold tracking-tight"
              style={{ color: isUrgent ? 'rgb(var(--color-urgent-400))' : g.text }}
            >
              {String(countdown.seconds).padStart(2, '0')}
            </span>
          </div>
          <div className="text-[10px] font-medium text-dark-400">
            {t('subscription.expiresAt')}: {formattedDate}
          </div>
        </div>
      )}
      {footer && <div className="mt-3.5">{footer}</div>}
    </div>
  );
});

function CardCtaIcon({ action, className }: { action: CardCtaAction; className: string }) {
  if (action === 'renew') return <RefreshIcon className={className} />;
  if (action === 'moveToTariff') return <ArrowsLeftRightIcon className={className} />;
  if (action === 'support') return <ChatIcon className={className} />;
  return <SubscriptionIcon className={className} />;
}

export default function Subscription() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { subscriptionId: subIdParam } = useParams<{ subscriptionId?: string }>();
  const subscriptionId = subIdParam ? parseInt(subIdParam, 10) : undefined;
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const haptic = useHaptic();
  const [copied, setCopied] = useState(false);
  // Ссылку подписки не находят: 11-й кегль на 30% контраста прямо под
  // вращающейся рамкой «Подключить устройство», которая забирает весь взгляд.
  // Поэтому кнопка копирования всегда в акценте и с пульсирующим ореолом
  // (владелец 05.11.2026: раньше гасла навсегда после первого копирования).
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);

  // Device/traffic topup state
  const [showDeviceTopup, setShowDeviceTopup] = useState(false);
  const [devicesToAdd, setDevicesToAdd] = useState(1);
  const [showDeviceReduction, setShowDeviceReduction] = useState(false);
  const [targetDeviceLimit, setTargetDeviceLimit] = useState<number>(1);
  const [showTrafficTopup, setShowTrafficTopup] = useState(false);
  const [selectedTrafficPackage, setSelectedTrafficPackage] = useState<number | null>(null);
  const [showServerManagement, setShowServerManagement] = useState(false);
  const [selectedServersToUpdate, setSelectedServersToUpdate] = useState<string[]>([]);

  // Traffic refresh state
  const [trafficRefreshCooldown, setTrafficRefreshCooldown] = useState(0);

  // Revoke (reissue) cooldown state
  const [trafficData, setTrafficData] = useState<{
    traffic_used_gb: number;
    traffic_used_percent: number;
    is_unlimited: boolean;
    traffic_accounting_mode?: 'legacy' | 'managed';
    traffic_remaining_gb?: number | null;
    base_traffic_remaining_gb?: number | null;
    next_traffic_refresh_at?: string | null;
  } | null>(null);

  // Detect multi-tariff mode from cached subscriptions-list
  const { data: multiSubData } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => subscriptionApi.getSubscriptions(),
    staleTime: 60_000,
  });
  const isMultiTariff = multiSubData?.multi_tariff_enabled ?? false;

  const { data: subscriptionResponse, isLoading } = useQuery({
    queryKey: ['subscription', subscriptionId],
    queryFn: () => subscriptionApi.getSubscription(subscriptionId),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const { data: connectionLink, isLoading: isConnectionLinkLoading } = useQuery({
    queryKey: ['connection-link', subscriptionId],
    queryFn: () => subscriptionApi.getConnectionLink(subscriptionId),
    retry: false,
    staleTime: 0,
  });

  // Extract subscription from response (null if no subscription)
  const subscription = subscriptionResponse?.subscription ?? null;
  const displayedConnectionUrl = useMemo(
    () =>
      resolveConnectionUrlForUi({
        mode: connectionLink?.connect_mode,
        happSchemeLink: connectionLink?.happ_scheme_link,
        displayLink: connectionLink?.display_link,
        subscriptionUrl: connectionLink?.subscription_url,
        happCryptLink: connectionLink?.happ_cryptolink,
        happCryptoLink: connectionLink?.happ_crypto_link,
        happLink: connectionLink?.happ_link,
        fallbackUrl: isConnectionLinkLoading ? null : (subscription?.subscription_url ?? null),
      }),
    [
      connectionLink?.connect_mode,
      connectionLink?.display_link,
      connectionLink?.happ_cryptolink,
      connectionLink?.happ_crypto_link,
      connectionLink?.happ_link,
      connectionLink?.happ_scheme_link,
      connectionLink?.subscription_url,
      isConnectionLinkLoading,
      subscription?.subscription_url,
    ],
  );
  // Подписка работает (активна или кончился только трафик белых списков). У истёкшей
  // и отключённой карточка срока с главной кнопкой встаёт первой, над трафиком,
  // плиткой и ссылкой (владелец 05.11.2026). Плитку и ссылку не прячем: на белых
  // списках оплатить без VPN нельзя, а после истечения по той же ссылке работает
  // grace — только Telegram, чтобы дойти до оплаты.
  const subscriptionRuns = !!subscription && (subscription.is_active || subscription.is_limited);
  const shouldHideConnectionLink =
    subscription?.hide_subscription_link || connectionLink?.hide_link;

  // Traffic zone (theme-aware) — called unconditionally at top level
  const usedPercent = trafficData?.traffic_used_percent ?? subscription?.traffic_used_percent ?? 0;
  const zone = useTrafficZone(usedPercent);

  // Purchase options (needed for balance_kopeks in device/traffic/server management)
  const purchaseOptionsQuery = useQuery({
    queryKey: ['purchase-options', subscriptionId],
    queryFn: () => subscriptionApi.getPurchaseOptions(subscriptionId),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const purchaseOptions = purchaseOptionsQuery.data;

  const isTariffsMode = purchaseOptions?.sales_mode === 'tariffs';
  const canManageAddons = isTariffsMode && !!subscription && showsAddonOptions(subscription);
  const canBuyTraffic = canManageAddons && (subscription?.traffic_limit_gb ?? 0) > 0;
  const nextTrafficReset =
    trafficData?.next_traffic_refresh_at ?? subscription?.next_traffic_refresh_at ?? null;
  // Главная кнопка — в карточке срока у всех состояний (решение владельца
  // 05.11.2026): «продление должно быть там же, где написано, что подписка истекла».
  const cardCta = isTariffsMode ? subscriptionCardCta(subscription) : null;
  // «Сменить тариф» под названием: смена у активной, витрина у истёкшей.
  const switchLink = isTariffsMode ? tariffSwitchLink(subscription) : null;
  // Нижний общий блок остался только для классического режима без тарифов.
  const showBottomCta = !subscription || (!purchaseOptionsQuery.isPending && !isTariffsMode);
  // Кончился трафик — «Докупить трафик» стоит в самом предупреждении, у шкалы не дублируется.
  const buyTrafficInWarning = canBuyTraffic && !!subscription?.is_limited;

  // Devices query
  // Счётчик подключённых устройств в шапке. Сам список живёт в <DevicesPanel>
  // и ходит по тому же ключу, так что второго запроса не возникает.
  const { data: devicesData, isLoading: isDevicesLoading } = useQuery({
    queryKey: ['devices', subscriptionId],
    queryFn: () => subscriptionApi.getDevices(subscriptionId),
    enabled: !!subscription,
  });

  // Слот устройства на главной ведёт сюда с #devices — к списку в самом низу.
  // Ждём подписку, устройства и ссылку подключения: иначе блок съедет вниз,
  // когда догрузится то, что над ним, и прокрутка промахнётся.
  useScrollToSection('devices', !!subscription && !!devicesData && !isConnectionLinkLoading);

  // Pause subscription mutation
  // Auto-close all modals/forms when success notification appears
  const handleCloseAllModals = useCallback(() => {
    setShowDeviceTopup(false);
    setShowDeviceReduction(false);
    setShowTrafficTopup(false);
    setShowServerManagement(false);
  }, []);
  useCloseOnSuccessNotification(handleCloseAllModals);

  // (device price + purchase moved into <DeviceTopupSheet>)
  // (device reduction info + mutation moved into <DeviceReductionSheet>)

  // (traffic packages + purchase moved into <TrafficTopupSheet>)
  // (countries query + update mutation moved into <ServerManagementSheet>)

  // Traffic refresh mutation
  const refreshTrafficMutation = useMutation({
    mutationFn: () => subscriptionApi.refreshTraffic(subscriptionId),
    onSuccess: (data) => {
      setTrafficData({
        traffic_used_gb: data.traffic_used_gb,
        traffic_used_percent: data.traffic_used_percent,
        is_unlimited: data.is_unlimited,
        traffic_accounting_mode: data.traffic_accounting_mode,
        traffic_remaining_gb: data.traffic_remaining_gb,
        base_traffic_remaining_gb: data.base_traffic_remaining_gb,
        next_traffic_refresh_at: data.next_traffic_refresh_at,
      });
      safeLocal.setItem(`traffic_refresh_ts_${subscriptionId ?? 'default'}`, Date.now().toString());
      if (data.rate_limited && data.retry_after_seconds) {
        setTrafficRefreshCooldown(data.retry_after_seconds);
      } else {
        setTrafficRefreshCooldown(30);
      }
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
    },
    onError: (error: {
      response?: { status?: number; headers?: { get?: (key: string) => string } };
    }) => {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers?.get?.('Retry-After');
        setTrafficRefreshCooldown(retryAfter ? parseInt(retryAfter, 10) : 30);
      }
    },
  });

  // Track if we've already triggered auto-refresh this session
  const hasAutoRefreshed = useRef(false);

  // Cooldown timer for traffic refresh
  useEffect(() => {
    if (trafficRefreshCooldown <= 0) return;
    const timer = setInterval(() => {
      setTrafficRefreshCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [trafficRefreshCooldown]);

  // Auto-refresh traffic on mount (with 30s caching)
  useEffect(() => {
    if (!subscription) return;
    if (hasAutoRefreshed.current) return;
    hasAutoRefreshed.current = true;

    const lastRefresh = safeLocal.getItem(`traffic_refresh_ts_${subscriptionId ?? 'default'}`);
    const now = Date.now();
    const cacheMs = 30 * 1000;

    if (lastRefresh && now - parseInt(lastRefresh, 10) < cacheMs) {
      const elapsed = now - parseInt(lastRefresh, 10);
      const remaining = Math.ceil((cacheMs - elapsed) / 1000);
      if (remaining > 0) {
        setTrafficRefreshCooldown(remaining);
      }
      return;
    }

    refreshTrafficMutation.mutate();
  }, [subscription, refreshTrafficMutation, subscriptionId]);

  const copyUrl = () => {
    if (displayedConnectionUrl) {
      void copyToClipboard(displayedConnectionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // In multi-tariff mode without a specific subscription ID, redirect to list
  if (isMultiTariff && !subscriptionId && !isLoading) {
    return <Navigate to="/subscriptions" replace />;
  }

  if (isLoading) {
    return (
      <PageSkeleton leading={1} titleWidth="w-48">
        <Skeleton variant="card" className="h-64" />
        <Skeleton variant="card" count={2} className="h-20" />
      </PageSkeleton>
    );
  }

  if (!subscription && subscriptionId) {
    return (
      <div className="mx-auto max-w-lg p-4 text-center">
        <div className="mb-4 text-4xl">😕</div>
        <h2 className="mb-2 text-xl font-bold text-dark-50">
          {t('subscription.notFound', 'Подписка не найдена')}
        </h2>
        <p className="mb-4 text-sm text-dark-50/60">
          {t('subscription.notFoundDesc', 'Возможно, подписка была удалена или не существует')}
        </p>
        <button
          onClick={() => navigate('/subscriptions')}
          className="rounded-xl bg-accent-500 px-6 py-2.5 text-sm font-medium text-on-accent"
        >
          {t('subscription.backToList', 'Мои подписки')}
        </button>
      </div>
    );
  }

  // Карточка срока с главной кнопкой; место на странице зависит от subscriptionRuns.
  const renderCountdown = (sub: NonNullable<typeof subscription>) => (
    <div className="mb-5">
      <CountdownTimer
        endDate={sub.end_date}
        isActive={sub.is_active || sub.is_limited}
        glassColors={g}
        // Отключённая админом не истекла: дни у неё есть, просто доступ выключен.
        inactiveLabel={
          sub.status === 'disabled' && !sub.is_daily ? t('subscription.disabledBadge') : undefined
        }
        footer={
          cardCta ? (
            <Link
              to={cardCta.to}
              className="cta-pulse flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-accent-500 px-4 text-center text-base font-bold leading-tight text-on-accent transition-colors hover:bg-accent-600 max-[359px]:px-2"
            >
              {/* Ниже 360 px значок уступает место тексту: карточка срока вложена в
                            карточку подписки, и надпись иначе ломалась на две строки. */}
              <CardCtaIcon
                action={cardCta.action}
                className="h-[18px] w-[18px] shrink-0 max-[359px]:hidden"
              />
              {t(CARD_CTA_LABEL[cardCta.action])}
            </Link>
          ) : undefined
        }
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-center gap-3">
        <WebBackButton to={isMultiTariff ? '/subscriptions' : '/'} />
        <h1 className="text-2xl font-bold text-dark-50 sm:text-3xl">
          {isMultiTariff && subscription?.tariff_name
            ? subscription.tariff_name
            : t('subscription.title')}
        </h1>
      </div>

      {/* Current Subscription */}
      {subscription ? (
        (() => {
          const unknownTraffic = hasUnknownManagedTraffic(subscription, trafficData);
          const usedGb = trafficData?.traffic_used_gb ?? subscription.traffic_used_gb;
          const isUnlimited =
            (trafficData?.is_unlimited ?? false) || subscription.traffic_limit_gb === 0;
          const connectedDevices = devicesData?.total ?? 0;
          const isAtDeviceLimit =
            subscription.device_limit > 0 && connectedDevices >= subscription.device_limit;

          return (
            <div
              className="glass-card relative overflow-hidden rounded-3xl lg:backdrop-blur-xl"
              style={{
                background: g.cardBg,
                border: subscription.is_trial
                  ? '1px solid rgba(var(--color-accent-400), 0.15)'
                  : isDark
                    ? `1px solid ${g.cardBorder}`
                    : `1px solid ${zone.mainHex}25`,
                boxShadow: isDark
                  ? g.shadow
                  : `0 2px 16px ${zone.mainHex}12, 0 0 0 1px ${zone.mainHex}08`,
                padding: '28px 28px 24px',
              }}
            >
              {/* Decorative ambient radial + trial shimmer border were
                  removed: they carried no information, leaked zone/accent
                  hue into pure decoration (violates DESIGN.md
                  Tunable-but-Scarce + Status-Hue Lockout rules), and the
                  same chrome was distilled out of SubscriptionCardActive
                  earlier in this branch. Trial state is conveyed by the
                  header badge. */}

              {/* ─── Header ─── */}
              <div className="mb-6 flex items-start justify-between">
                <div>
                  {/* Подписи «Норма / Умеренный / …» (зона расхода трафика) над названием
                      тарифа здесь нет: читалась как статус тарифа. На главной она осталась —
                      там стоит над «Расход трафика» (решение владельца 05.11.2026). */}
                  {/* Plan name */}
                  <h2 className="text-lg font-bold tracking-tight text-dark-50">
                    {planTitle(subscription, t)}
                  </h2>
                  {switchLink && (
                    <Link
                      to={switchLink}
                      className="subscription-action-neutral cta-shine mt-2.5 inline-flex h-[34px] items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition-colors"
                    >
                      <ArrowsLeftRightIcon className="h-3.5 w-3.5" />
                      {t('subscription.switchTariff.title')}
                    </Link>
                  )}
                </div>

                {/* Status badge */}
                <span
                  className={`max-w-[55%] shrink-0 rounded-full border px-3 py-1 text-center font-mono text-[10px] font-semibold uppercase tracking-wider ${
                    subscription.is_active
                      ? subscription.is_trial
                        ? 'border-accent-500/[0.32] bg-accent-500/[0.12] text-accent-400'
                        : 'border-success-500/[0.32] bg-success-500/[0.12] text-success-400 light:text-success-700'
                      : subscription.is_limited
                        ? 'border-warning-500/25 bg-warning-500/[0.12] text-urgent-400'
                        : 'border-critical-500/25 bg-critical-500/[0.12] text-critical-500'
                  }`}
                >
                  {subscription.is_active
                    ? subscription.is_trial
                      ? t('subscription.trialStatus')
                      : t('subscription.active')
                    : subscription.is_limited
                      ? t('subscription.trafficLimited')
                      : subscription.status === 'disabled'
                        ? // «Недостаточно средств» — только про суточную; у нас disabled ставит админ.
                          subscription.is_daily
                          ? t('subscription.pause.suspended')
                          : t('subscription.disabledBadge')
                        : t('subscription.expired')}
                </span>
              </div>

              {/* ─── Traffic Limited Banner ─── */}
              {subscription.is_limited && (
                <div
                  data-testid="traffic-limited"
                  className="mb-6 rounded-[14px] p-4"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255,184,0,0.08), rgba(255,184,0,0.03))',
                    border: '1px solid rgba(255,184,0,0.2)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                      style={{ background: 'rgba(255,184,0,0.12)' }}
                    >
                      <WarningIcon className="h-4 w-4 text-urgent-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-semibold"
                        style={{ color: 'rgb(var(--color-urgent-400))' }}
                      >
                        {t('subscription.trafficLimitedTitle')}
                      </p>
                      <p className="mt-1 text-xs text-dark-400">
                        {t('subscription.trafficLimitedDescription')}
                      </p>
                    </div>
                  </div>
                  {/* Во всю ширину предупреждения: в колонке текста рядом с иконкой
                      кнопка на 320 px не помещалась. */}
                  {buyTrafficInWarning && (
                    <button
                      type="button"
                      onClick={() => setShowTrafficTopup((open) => !open)}
                      className="subscription-action-neutral cta-shine cta-shine-late mt-3 inline-flex h-9 w-full items-center justify-center whitespace-nowrap rounded-[10px] px-3 text-[13px] font-bold transition-colors"
                    >
                      {t('subscription.buyTrafficButton')}
                    </button>
                  )}
                </div>
              )}

              {/* ─── Trial Info Banner ─── */}
              {subscription.is_trial && subscription.is_active && (
                <div
                  data-testid="trial-banner"
                  className="mb-6 rounded-[14px] p-4"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(var(--color-accent-400), 0.08), rgba(var(--color-accent-400), 0.03))',
                    border: '1px solid rgba(var(--color-accent-400), 0.12)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                      style={{ background: 'rgba(var(--color-accent-400), 0.12)' }}
                    >
                      <ClockIcon className="h-4 w-4 text-accent-400" />
                    </div>
                    <div className="flex-1">
                      <div
                        className="text-sm font-semibold"
                        style={{ color: 'rgb(var(--color-accent-400))' }}
                      >
                        {t('subscription.trialInfo.title')}
                      </div>
                      <div className="mt-1 text-[12px] text-dark-400">
                        {t('subscription.trialInfo.description')}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-[12px] font-semibold"
                            style={{ color: 'rgb(var(--color-accent-400))' }}
                          >
                            {subscription.days_left > 0
                              ? t('subscription.days', { count: subscription.days_left })
                              : `${subscription.hours_left}${t('subscription.hours')} ${subscription.minutes_left}${t('subscription.minutes')}`}
                          </span>
                          <span className="text-[11px] text-dark-400">
                            {t('subscription.trialInfo.remaining')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-[12px] font-semibold"
                            style={{ color: 'rgb(var(--color-accent-400))' }}
                          >
                            {subscription.traffic_limit_gb || '∞'} {t('common.units.gb')}
                          </span>
                          <span className="text-[11px] text-dark-400">
                            {t('subscription.traffic')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-[12px] font-semibold"
                            style={{ color: 'rgb(var(--color-accent-400))' }}
                          >
                            {subscription.device_limit === 0 ? '∞' : subscription.device_limit}
                          </span>
                          {/* Слово по числу: было «1 Устройства». Безлимит — «∞ устройств». */}
                          <span className="text-[11px] text-dark-400">
                            {t('subscription.devicesWord', {
                              count:
                                subscription.device_limit === 0 ? 5 : subscription.device_limit,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Та же кнопка, что в карточке срока: здесь написано «Пробный период». */}
                  {cardCta?.action === 'chooseTariff' && (
                    <Link
                      to={cardCta.to}
                      className="cta-shine mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-accent-500/35 bg-accent-500/10 px-3 text-sm font-bold text-accent-400 transition-colors hover:bg-accent-500/15"
                    >
                      {t('subscription.cardCta.chooseTariff')}
                    </Link>
                  )}
                </div>
              )}

              {/* ─── Countdown первой: подписка истекла или отключена ─── */}
              {!subscriptionRuns && renderCountdown(subscription)}

              {/* ─── Traffic Progress ─── */}
              <div className="mb-6">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-dark-400">
                    {t('subscription.traffic')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-dark-400">
                      {unknownTraffic
                        ? '—'
                        : isUnlimited
                          ? formatTraffic(usedGb)
                          : `${formatTraffic(usedGb)} / ${formatTraffic(subscription.traffic_limit_gb)}`}
                    </span>
                    <button
                      onClick={() => refreshTrafficMutation.mutate()}
                      disabled={refreshTrafficMutation.isPending || trafficRefreshCooldown > 0}
                      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-dark-400 transition-colors hover:bg-dark-50/[0.05] hover:text-dark-50/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshIcon
                        className="h-3 w-3"
                        spinning={refreshTrafficMutation.isPending}
                      />
                      {trafficRefreshCooldown > 0
                        ? `${trafficRefreshCooldown}s`
                        : t('common.refresh')}
                    </button>
                  </div>
                </div>
                {subscription.traffic_reset_mode &&
                  subscription.traffic_reset_mode !== 'NO_RESET' && (
                    <div className="mb-2 text-[10px] text-dark-400">
                      {t(`subscription.trafficReset.${subscription.traffic_reset_mode}`)}
                    </div>
                  )}
                {unknownTraffic ? (
                  <div className="h-2" aria-hidden="true" />
                ) : (
                  <TrafficProgressBar
                    usedGb={usedGb}
                    limitGb={subscription.traffic_limit_gb}
                    percent={usedPercent}
                    isUnlimited={isUnlimited}
                    compact
                  />
                )}
                {/* Кнопка всегда справа от текста (решение владельца 05.11.2026): на 320–360 px
                    текст переносится в 3–4 строки, но только целыми словами. Без min-w-0
                    колонка не уже самого длинного слова, поэтому «Следующи-й» больше не рвётся;
                    дата не отрывается от месяца. */}
                {(nextTrafficReset || (canBuyTraffic && !buyTrafficInWarning)) && (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    {nextTrafficReset ? (
                      <div className="text-xs leading-snug text-dark-400">
                        <div>{t('subscription.nextTrafficReset.line1')}</div>
                        <div>
                          {t('subscription.nextTrafficReset.line2')}{' '}
                          <span className="whitespace-nowrap font-bold text-dark-50">
                            {new Date(nextTrafficReset).toLocaleDateString(uiLocale(), {
                              day: 'numeric',
                              month: 'long',
                            })}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span />
                    )}
                    {canBuyTraffic && !buyTrafficInWarning && (
                      <button
                        type="button"
                        onClick={() => setShowTrafficTopup((open) => !open)}
                        className="subscription-action-neutral cta-shine cta-shine-late inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-[10px] px-2.5 text-[13px] font-bold transition-colors"
                      >
                        {t('subscription.buyTrafficButton')}
                      </button>
                    )}
                  </div>
                )}
                {canBuyTraffic && showTrafficTopup && (
                  <div className="mt-3">
                    <TrafficTopupSheet
                      open
                      onOpen={() => setShowTrafficTopup(true)}
                      onClose={() => setShowTrafficTopup(false)}
                      subscription={subscription}
                      subscriptionId={subscriptionId}
                      selectedTrafficPackage={selectedTrafficPackage}
                      onSelectedTrafficPackageChange={setSelectedTrafficPackage}
                      purchaseOptions={purchaseOptions}
                      isDark={isDark}
                    />
                  </div>
                )}
                <ManagedTrafficSummary
                  subscription={subscription}
                  refreshed={trafficData}
                  hideNextRefresh={Boolean(nextTrafficReset)}
                />
              </div>

              {/* ─── Connect Device Button ─── */}
              {subscription.subscription_url && (
                <ConnectDeviceButton
                  loading={isConnectionLinkLoading || isDevicesLoading}
                  disabled={isAtDeviceLimit}
                  onClick={() => {
                    if (isAtDeviceLimit) {
                      haptic.notification('error');
                      return;
                    }
                    navigate(subscriptionId ? `/connection?sub=${subscriptionId}` : '/connection');
                  }}
                  className="mb-5 flex w-full items-center gap-3.5 rounded-[14px] p-3.5 text-left transition-shadow duration-300"
                  style={{ fontFamily: 'inherit' }}
                >
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] transition-colors duration-500"
                    style={{ background: `${zone.mainHex}12`, color: zone.mainHex }}
                  >
                    <DevicesIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold tracking-tight text-dark-50">
                      {t('dashboard.connectDevice')}
                    </div>
                    <div className="mt-0.5 text-[11px] text-dark-400">
                      {subscription.device_limit === 0
                        ? t('dashboard.devicesConnectedUnlimited', { used: connectedDevices })
                        : t('dashboard.devicesOfMax', {
                            used: connectedDevices,
                            max: subscription.device_limit,
                          })}
                    </div>
                    {isAtDeviceLimit && (
                      <div
                        className="mt-1 text-[10px] font-medium"
                        style={{ color: 'rgb(var(--color-warning-400))' }}
                      >
                        {t('dashboard.deviceLimitReached')}
                      </div>
                    )}
                  </div>
                  {subscription.device_limit === 0 ? (
                    <div
                      className="flex flex-shrink-0 items-center text-lg text-dark-400"
                      aria-hidden="true"
                    >
                      ∞
                    </div>
                  ) : subscription.device_limit <= 10 ? (
                    // Больше пяти точек — в два ряда по пять: десять в ряд занимали
                    // 124 px, и текст кнопки на телефоне шёл в 5–7 строк.
                    <div
                      className={
                        subscription.device_limit > 5
                          ? 'grid flex-shrink-0 grid-cols-5 gap-1'
                          : 'flex flex-shrink-0 gap-1.5'
                      }
                      aria-hidden="true"
                    >
                      {Array.from({ length: subscription.device_limit }, (_, i) => (
                        <div
                          key={i}
                          className="h-[7px] w-[7px] rounded-full transition-[background-color,box-shadow] duration-300"
                          style={{
                            background: i < connectedDevices ? zone.mainHex : g.textGhost,
                            boxShadow: i < connectedDevices ? `0 0 6px ${zone.mainHex}50` : 'none',
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex w-16 flex-shrink-0 items-center" aria-hidden="true">
                      <div
                        className="h-[6px] w-full overflow-hidden rounded-full"
                        style={{ background: g.textGhost }}
                      >
                        {/* scaleX (compositor) instead of width (layout-thrash).
                            Track is 64px (w-16), so 0.0625 floor = 4px minimum,
                            preserving the prior minWidth behaviour. */}
                        <div
                          className="h-full w-full origin-left rounded-full transition-transform duration-500"
                          style={{
                            transform: `scaleX(${(() => {
                              const pct = connectedDevices / subscription.device_limit;
                              return connectedDevices > 0 ? Math.max(pct, 0.0625) : 0;
                            })()})`,
                            background: zone.mainHex,
                            boxShadow: `0 0 8px ${zone.mainHex}40`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </ConnectDeviceButton>
              )}

              {/* ─── Subscription URL ─── */}
              {displayedConnectionUrl && !shouldHideConnectionLink && (
                <div className="mb-5 flex gap-2">
                  <code
                    className="block min-w-0 flex-1 truncate whitespace-nowrap rounded-[10px] px-3 py-2 font-mono text-[11px] text-dark-400"
                    style={{
                      background: g.codeBg,
                      border: `1px solid ${g.codeBorder}`,
                    }}
                    title={displayedConnectionUrl}
                  >
                    {displayedConnectionUrl}
                  </code>
                  <button
                    onClick={copyUrl}
                    className={`subscription-action-neutral flex h-auto items-center rounded-[10px] px-3 transition-colors duration-300${
                      copied ? '' : ' copy-link-attention'
                    }`}
                    aria-label={t('subscription.copyLink')}
                    title={t('subscription.copyLink')}
                  >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </div>
              )}

              {/* ─── Countdown (у работающей подписки — здесь, под ссылкой) ─── */}
              {subscriptionRuns && renderCountdown(subscription)}

              {/* ─── Locations ─── */}
              {subscription.servers && subscription.servers.length > 0 && (
                <div className="mb-5">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-dark-400">
                    {t('subscription.locationsLabel')}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {subscription.servers.map((server) => (
                      <span
                        key={server.uuid}
                        className="inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-[11px] font-medium text-dark-50/50"
                        style={{
                          background: g.innerBorder,
                          border: `1px solid ${g.trackBg}`,
                        }}
                      >
                        {server.country_code && (
                          <span className="text-xs">{getFlagEmoji(server.country_code)}</span>
                        )}
                        <Twemoji
                          tag="span"
                          options={{ className: 'twemoji', folder: 'svg', ext: '.svg' }}
                        >
                          {server.name}
                        </Twemoji>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Purchased Traffic Packages ─── */}
              {subscription.traffic_purchases && subscription.traffic_purchases.length > 0 && (
                <div className="mb-5">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-dark-400">
                    {t('subscription.purchasedTraffic')}
                  </div>
                  <div className="space-y-2">
                    {subscription.traffic_purchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        className="rounded-[12px] p-3"
                        style={{
                          background: g.innerBg,
                          border: `1px solid ${g.innerBorder}`,
                        }}
                      >
                        <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-7 w-7 items-center justify-center rounded-[8px]"
                              style={{ background: `${zone.mainHex}12`, color: zone.mainHex }}
                            >
                              <DownloadIcon className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-sm font-semibold text-dark-50">
                              {purchase.traffic_gb} {t('common.units.gb')}
                            </span>
                          </div>
                          <div className="min-w-0 text-end">
                            <div
                              className="text-[11px] font-medium"
                              style={{
                                color: purchase.days_remaining === 0 ? '#FF6B35' : g.textSecondary,
                              }}
                            >
                              {purchase.days_remaining === 0
                                ? t('subscription.expired')
                                : t('subscription.days', { count: purchase.days_remaining })}
                            </div>
                            <div className="mt-0.5 font-mono text-[9px] text-dark-400">
                              {t('subscription.accounting.packageExpires')}:{' '}
                              {new Date(purchase.expires_at).toLocaleDateString(uiLocale(), {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </div>
                          </div>
                        </div>
                        {subscription.traffic_accounting_mode === 'managed' &&
                          typeof purchase.remaining_gb === 'number' &&
                          Number.isFinite(purchase.remaining_gb) &&
                          purchase.remaining_gb >= 0 && (
                            <p className="mb-2 text-sm tabular-nums text-dark-300">
                              {t('subscription.accounting.packageRemaining', {
                                amount: formatTraffic(purchase.remaining_gb),
                              })}
                            </p>
                          )}
                        <div
                          className="relative h-1.5 overflow-hidden rounded-full"
                          style={{ background: g.trackBg }}
                        >
                          <div
                            className="absolute inset-0 origin-left rounded-full bg-accent-500 transition-transform duration-500"
                            style={{
                              transform: `scaleX(${purchase.progress_percent / 100})`,
                            }}
                          />
                        </div>
                        <div className="mt-1 flex justify-between font-mono text-[9px] text-dark-400">
                          <span>
                            {new Date(purchase.created_at).toLocaleDateString(uiLocale())}
                          </span>
                          <span>
                            {new Date(purchase.expires_at).toLocaleDateString(uiLocale())}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Autopay Toggle ─── */}
              <AutopayToggle
                subscription={subscription}
                subscriptionId={subscriptionId}
                accentColor={zone.mainHex}
                offColor={g.textGhost}
                surface={{ background: g.innerBg, border: g.innerBorder }}
              />

              <RecurringPanels subscription={subscription} subscriptionId={subscriptionId} />
            </div>
          );
        })()
      ) : (
        <div
          className="glass-card relative overflow-hidden rounded-3xl py-12 text-center"
          style={{
            background: g.cardBg,
            border: `1px solid ${g.cardBorder}`,
            boxShadow: g.shadow,
          }}
        >
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: g.hoverBg, color: g.textFaint }}
          >
            <TrashIcon className="h-8 w-8" />
          </div>
          <div className="text-sm text-dark-400">{t('subscription.noSubscription')}</div>
        </div>
      )}

      {/* Устройства: слоты «приложение · устройство», докупка и уменьшение лимита.
          Заменил «Дополнительные опции» (для тарифов) и нижний список «Мои устройства». */}
      {subscription && (
        <div
          id="devices"
          className="glass-card relative scroll-mt-24 overflow-hidden rounded-3xl"
          style={{
            background: g.cardBg,
            border: `1px solid ${g.cardBorder}`,
            boxShadow: g.shadow,
            padding: '22px 20px',
          }}
        >
          <DeviceSlotsPanel
            subscriptionId={subscriptionId}
            deviceLimit={subscription.device_limit}
            onConnect={() => navigate(`/connection?sub=${subscription.id}`)}
            onAddSlot={
              canManageAddons
                ? () => {
                    setShowDeviceReduction(false);
                    setShowDeviceTopup((open) => !open);
                  }
                : undefined
            }
            onReduce={
              canManageAddons
                ? () => {
                    setShowDeviceTopup(false);
                    setShowDeviceReduction((open) => !open);
                  }
                : undefined
            }
          />
          {canManageAddons && showDeviceTopup && (
            <div className="mt-4">
              <DeviceTopupSheet
                open
                onOpen={() => setShowDeviceTopup(true)}
                onClose={() => setShowDeviceTopup(false)}
                subscription={subscription}
                subscriptionId={subscriptionId}
                devicesToAdd={devicesToAdd}
                onDevicesToAddChange={setDevicesToAdd}
                purchaseOptions={purchaseOptions}
                isDark={isDark}
              />
            </div>
          )}
          {canManageAddons && showDeviceReduction && (
            <div className="mt-4">
              <DeviceReductionSheet
                open
                onOpen={() => setShowDeviceReduction(true)}
                onClose={() => setShowDeviceReduction(false)}
                subscriptionPresent
                subscriptionId={subscriptionId}
                targetDeviceLimit={targetDeviceLimit}
                onTargetDeviceLimitChange={setTargetDeviceLimit}
                isDark={isDark}
              />
            </div>
          )}
        </div>
      )}

      {/* Daily Subscription Pause */}
      {subscription && subscription.is_daily && !subscription.is_trial && (
        <div
          className="glass-card relative overflow-hidden rounded-3xl"
          style={{
            background: g.cardBg,
            border: `1px solid ${g.cardBorder}`,
            boxShadow: g.shadow,
            padding: '24px 28px',
          }}
        >
          <DailyPausePanel subscription={subscription} subscriptionId={subscriptionId} />
        </div>
      )}

      {/* Нижний общий блок — только классический режим и «подписки нет»: на тарифах
          главная кнопка любого состояния стоит в карточке срока. */}
      {showBottomCta && (
        <PurchaseCTAButton
          subscription={subscription}
          isMultiTariff={isMultiTariff}
          isTariffsMode={isTariffsMode}
        />
      )}

      {/* Delete expired subscription */}
      {isMultiTariff &&
        subscription &&
        !subscription.is_active &&
        !subscription.is_trial &&
        !subscription.is_limited && (
          <div className="space-y-3">
            <DeleteSubscriptionSheet
              subscriptionId={subscription.id}
              open={showDeleteSheet}
              onOpen={() => setShowDeleteSheet(true)}
              onClose={() => setShowDeleteSheet(false)}
              textSecondary={g.textSecondary}
              onDeleted={() => {
                queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
                navigate('/subscriptions', { replace: true });
              }}
            />
          </div>
        )}

      {/* Additional Options — только классический режим: на тарифах докупка трафика
          стоит у полосы трафика, устройства — в разделе «Устройства». */}
      {subscription && !isTariffsMode && showsAddonOptions(subscription) && (
        <div
          className="glass-card relative overflow-hidden rounded-3xl"
          style={{
            background: g.cardBg,
            border: `1px solid ${g.cardBorder}`,
            boxShadow: g.shadow,
            padding: '24px 28px',
          }}
        >
          <h2 className="mb-4 text-base font-bold tracking-tight text-dark-50">
            {t('subscription.additionalOptions.title')}
          </h2>

          {/* Buy Devices */}
          <DeviceTopupSheet
            open={showDeviceTopup}
            onOpen={() => setShowDeviceTopup(true)}
            onClose={() => setShowDeviceTopup(false)}
            subscription={subscription}
            subscriptionId={subscriptionId}
            devicesToAdd={devicesToAdd}
            onDevicesToAddChange={setDevicesToAdd}
            purchaseOptions={purchaseOptions}
            isDark={isDark}
          />

          {/* Reduce Devices */}
          <div className="mt-4">
            <DeviceReductionSheet
              open={showDeviceReduction}
              onOpen={() => setShowDeviceReduction(true)}
              onClose={() => setShowDeviceReduction(false)}
              subscriptionPresent={!!subscription}
              subscriptionId={subscriptionId}
              targetDeviceLimit={targetDeviceLimit}
              onTargetDeviceLimitChange={setTargetDeviceLimit}
              isDark={isDark}
            />
          </div>

          {/* Buy Traffic */}
          {subscription.traffic_limit_gb > 0 && (
            <div className="mt-4">
              <TrafficTopupSheet
                open={showTrafficTopup}
                onOpen={() => setShowTrafficTopup(true)}
                onClose={() => setShowTrafficTopup(false)}
                subscription={subscription}
                subscriptionId={subscriptionId}
                selectedTrafficPackage={selectedTrafficPackage}
                onSelectedTrafficPackageChange={setSelectedTrafficPackage}
                purchaseOptions={purchaseOptions}
                isDark={isDark}
              />
            </div>
          )}

          {/* Server Management - only in classic mode */}
          {!isTariffsMode && (
            <div className="mt-4">
              <ServerManagementSheet
                open={showServerManagement}
                onOpen={() => setShowServerManagement(true)}
                onClose={() => setShowServerManagement(false)}
                subscription={subscription}
                subscriptionId={subscriptionId}
                selectedServers={selectedServersToUpdate}
                onSelectedServersChange={setSelectedServersToUpdate}
                purchaseOptions={purchaseOptions}
                isDark={isDark}
              />
            </div>
          )}
        </div>
      )}

      {/* Reissue Subscription — standalone block, not dependent on device_limit */}
      {subscription && canReissueLink(subscription) && (
        <div
          className="glass-card relative overflow-hidden rounded-3xl"
          style={{
            background: g.cardBg,
            border: `1px solid ${g.cardBorder}`,
            boxShadow: g.shadow,
            padding: '16px 20px',
          }}
        >
          <ReissueLinkButton
            subscription={subscription}
            subscriptionId={subscriptionId}
            connectedDevices={devicesData?.total ?? 0}
          />
        </div>
      )}
    </div>
  );
}
