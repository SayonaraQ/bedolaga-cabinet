import { getLocalizedApiErrorMessage } from '../utils/api-error-display';
import { uiLocale } from '@/utils/uiLocale';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from 'react-router';
import { PiCaretRight, PiQuestion } from 'react-icons/pi';
import { ticketsApi } from '../api/tickets';
import { ticketNotificationsApi } from '../api/ticketNotifications';
import { SUPPORT_UNREAD_COUNT_KEY } from '../hooks/useSupportUnreadCount';
import { MessageMediaGrid } from '../components/tickets/MessageMediaGrid';
import { infoApi } from '../api/info';
import { useAuthStore } from '../store/auth';
import { logger } from '../utils/logger';
import { checkRateLimit, getRateLimitResetTime, RATE_LIMIT_KEYS } from '../utils/rateLimit';

import { isOpenTicketConflict } from '../utils/ticketErrors';
import type { SupportConfig, Ticket, TicketDetail } from '../types';
import { Card } from '@/components/data-display/Card';
import { Button } from '@/components/primitives/Button';
import { staggerContainer, staggerItem } from '@/components/motion/transitions';
import {
  ChatIcon,
  ChevronRightIcon,
  CloseIcon,
  EditIcon,
  ImageIcon,
  SendIcon,
  TelegramIcon,
} from '@/components/icons';
import { usePlatform } from '@/platform';
import { linkifyText } from '../utils/linkify';
import { resolveSupportContact } from '../utils/supportContact';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

const log = logger.createLogger('Support');

// Бэк держит одну незакрытую заявку на пользователя: open/answered считаются
// активными (TicketCRUD.user_has_active_ticket), на вторую POST отвечает 409.
// pending создание не блокирует — его здесь нет намеренно.
const ACTIVE_TICKET_STATUSES = new Set(['open', 'answered']);

const MEDIA_TYPES: Record<string, 'photo' | 'video'> = {
  'image/jpeg': 'photo',
  'image/png': 'photo',
  'image/gif': 'photo',
  'image/webp': 'photo',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
};

// Media attachment state
interface MediaAttachment {
  id: string;
  file: File;
  preview: string;
  mediaType: 'photo' | 'video';
  uploading: boolean;
  fileId?: string;
  error?: string;
}

export default function Support() {
  log.debug('Component loaded');

  const { t } = useTranslation();
  const isAdmin = useAuthStore((state) => state.isAdmin);
  // Без Telegram бот шлёт уведомление об ответе письмом, а не в чат.
  const notifyByEmail = useAuthStore((state) => !!state.user && !state.user.telegram_id);
  const queryClient = useQueryClient();
  const { openTelegramLink, openLink } = usePlatform();

  const openSupportContact = useCallback(
    (config: SupportConfig) => {
      const target = resolveSupportContact(config);
      if (!target) return;
      if (target.kind === 'external') {
        openLink(target.url, { tryInstantView: false });
      } else {
        openTelegramLink(target.url);
      }
    },
    [openLink, openTelegramLink],
  );
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  // Ошибка активной формы: и клиентский rate-limit, и отказ бэка (409 «уже есть
  // открытый тикет», 403 «поддержка выключена/пользователь заблокирован» и т.п.).
  // Формы create и reply взаимоисключающие, поэтому состояние одно на обе.
  const [formError, setFormError] = useState<string | null>(null);

  // Media attachment states (multi-upload, up to 10)
  const [createAttachments, setCreateAttachments] = useState<MediaAttachment[]>([]);
  const [replyAttachments, setReplyAttachments] = useState<MediaAttachment[]>([]);
  const createFileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  const blobUrlsRef = useRef<Set<string>>(new Set());
  const detailRef = useRef<HTMLDivElement>(null);
  const selectedTicketId = selectedTicket?.id;

  // На телефоне форма и переписка стоят под списком заявок, за краем экрана:
  // без прокрутки нажатие «Создать заявку» выглядело так, будто ничего не
  // произошло. На десктопе панель и так рядом со списком — страницу не дёргаем.
  useEffect(() => {
    if (!showCreateForm && selectedTicketId === undefined) return;
    if (window.matchMedia?.('(min-width: 1024px)').matches) return;
    detailRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [showCreateForm, selectedTicketId]);

  // Ответ прочитан здесь, в переписке: гасим и колокольчик, и точку на вкладке.
  // Без этого они горели, пока человек не откроет сам колокольчик.
  useEffect(() => {
    if (selectedTicketId === undefined) return;
    ticketNotificationsApi
      .markTicketAsRead(selectedTicketId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: SUPPORT_UNREAD_COUNT_KEY });
        queryClient.invalidateQueries({ queryKey: ['ticket-notifications'] });
      })
      .catch(() => undefined);
  }, [selectedTicketId, queryClient]);

  useEffect(() => {
    const urls = blobUrlsRef;
    return () => {
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const clearCreateAttachments = () => {
    createAttachments.forEach((a) => {
      if (a.preview) URL.revokeObjectURL(a.preview);
    });
    setCreateAttachments([]);
    if (createFileInputRef.current) createFileInputRef.current.value = '';
  };

  const clearReplyAttachments = () => {
    replyAttachments.forEach((a) => {
      if (a.preview) URL.revokeObjectURL(a.preview);
    });
    setReplyAttachments([]);
    if (replyFileInputRef.current) replyFileInputRef.current.value = '';
  };

  const openCreateForm = () => {
    setShowCreateForm(true);
    setSelectedTicket(null);
    setFormError(null);
    clearCreateAttachments();
  };

  const openTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket as unknown as TicketDetail);
    setShowCreateForm(false);
    setFormError(null);
    clearReplyAttachments();
  };

  // Get support configuration
  const { data: supportConfig, isLoading: configLoading } = useQuery({
    queryKey: ['support-config'],
    queryFn: infoApi.getSupportConfig,
  });

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => ticketsApi.getTickets({ per_page: 20 }),
    enabled: supportConfig?.tickets_enabled === true,
  });

  const { data: ticketDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['ticket', selectedTicket?.id],
    queryFn: () => ticketsApi.getTicket(selectedTicket!.id),
    enabled: !!selectedTicket,
  });

  // Handle file selection (multi-upload)
  const handleFileSelect = async (
    file: File,
    setAttachments: React.Dispatch<React.SetStateAction<MediaAttachment[]>>,
  ) => {
    const mediaType = MEDIA_TYPES[file.type];
    if (!mediaType) return;
    if (file.size > 10 * 1024 * 1024) return;

    const preview = mediaType === 'photo' ? URL.createObjectURL(file) : '';
    if (preview) blobUrlsRef.current.add(preview);
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `att_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const entry: MediaAttachment = { id, file, preview, mediaType, uploading: true };
    setAttachments((prev) => (prev.length >= 10 ? prev : [...prev, entry]));

    try {
      const result = await ticketsApi.uploadMedia(file, mediaType);
      setAttachments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, uploading: false, fileId: result.file_id } : a)),
      );
    } catch {
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, uploading: false, error: t('support.uploadFailed') } : a,
        ),
      );
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const ready = createAttachments.filter(
        (a): a is MediaAttachment & { fileId: string } => !!a.fileId,
      );
      const media =
        ready.length > 0
          ? {
              media_type: ready[0].mediaType,
              media_file_id: ready[0].fileId,
              media_items: ready.map((a) => ({ type: a.mediaType, file_id: a.fileId })),
            }
          : undefined;
      return ticketsApi.createTicket(newTitle, newMessage, media);
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setShowCreateForm(false);
      setFormError(null);
      setNewTitle('');
      setNewMessage('');
      clearCreateAttachments();
      setSelectedTicket(ticket);
    },
    onError: (error) => {
      // Без этого отказ бэка (чаще всего 409 «уже есть открытый тикет») уходил
      // в никуда: форма просто оставалась на месте, и пользователь жал «Отправить»
      // снова и снова, не понимая, почему обращение не создаётся.
      log.error('Ticket creation failed', error);
      if (isOpenTicketConflict(error)) {
        setFormError(t('support.errors.alreadyOpenTicket'));
        // Открытый тикет мог появиться в другой сессии (бот, второе устройство) —
        // подтягиваем список, чтобы пользователю было куда перейти.
        queryClient.invalidateQueries({ queryKey: ['tickets'] });
        return;
      }
      setFormError(getLocalizedApiErrorMessage(error, t('support.errors.createFailed'), t));
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const ready = replyAttachments.filter(
        (a): a is MediaAttachment & { fileId: string } => !!a.fileId,
      );
      const media =
        ready.length > 0
          ? {
              media_type: ready[0].mediaType,
              media_file_id: ready[0].fileId,
              media_items: ready.map((a) => ({ type: a.mediaType, file_id: a.fileId })),
            }
          : undefined;
      await ticketsApi.addMessage(selectedTicket!.id, replyMessage, media);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', selectedTicket?.id] });
      setFormError(null);
      setReplyMessage('');
      clearReplyAttachments();
    },
    onError: (error) => {
      // Ответ в тикет молчал ровно так же: 403 (блокировка в поддержке) и 400
      // (тикет уже закрыт) выглядели как «кнопка не работает».
      log.error('Ticket reply failed', error);
      setFormError(getLocalizedApiErrorMessage(error, t('support.errors.replyFailed'), t));
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return 'badge-info';
      case 'answered':
        return 'badge-success';
      case 'pending':
        return 'badge-warning';
      case 'closed':
        return 'badge-neutral';
      default:
        return 'badge-neutral';
    }
  };

  const getStatusLabel = (status: string) => {
    return t(`support.status.${status}`) || status;
  };

  // Show loading while checking configuration
  if (configLoading) {
    return (
      <SkeletonGroup className="space-y-3">
        <Skeleton variant="card" count={3} className="h-16" />
      </SkeletonGroup>
    );
  }

  // If tickets are disabled, show redirect message
  if (supportConfig && !supportConfig.tickets_enabled) {
    log.debug('Tickets disabled, config:', supportConfig);

    // Куда и чем открывать контакт — один резолв на весь блок. null → открывать
    // нечего (пустой/битый конфиг), и кнопку тогда не рендерим вовсе.
    const contact = resolveSupportContact(supportConfig);

    const getSupportMessage = () => {
      log.debug('Getting support message for type:', supportConfig.support_type);

      const title = isAdmin ? t('support.ticketsDisabled') : t('support.title');

      if (supportConfig.support_type === 'url' && supportConfig.support_url) {
        return {
          title,
          message: t('support.useExternalLink'),
          buttonText: t('support.openSupport'),
        };
      }

      // profile и любой fallback — контакт в телеграме
      const supportUsername = supportConfig.support_username || '@support';
      return {
        title,
        message: t('support.contactSupport', { username: supportUsername }),
        buttonText: t('support.contactUs'),
      };
    };

    const supportMessage = getSupportMessage();

    return (
      <div className="mx-auto mt-12 max-w-md">
        <Card className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-dark-800">
            <ChatIcon className="h-8 w-8 text-dark-400" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-dark-100">{supportMessage.title}</h2>
          <p className="mb-6 text-dark-400">{supportMessage.message}</p>
          {contact && (
            <Button onClick={() => openSupportContact(supportConfig)} fullWidth>
              {supportMessage.buttonText}
            </Button>
          )}
        </Card>
      </div>
    );
  }

  // Attachments preview component
  const AttachmentsPreview = ({
    items,
    onRemove,
  }: {
    items: MediaAttachment[];
    onRemove: (idx: number) => void;
  }) =>
    items.length === 0 ? null : (
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((att, idx) => (
          <div key={idx} className="relative">
            {att.preview ? (
              <img
                src={att.preview}
                alt={t('common.preview')}
                loading="lazy"
                className="h-16 w-16 rounded-lg border border-dark-700 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-dark-700 text-xs text-dark-400">
                {att.file.name.slice(-6)}
              </div>
            )}
            {att.uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-dark-950/50">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
              </div>
            )}
            {att.error && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-error-500/30">
                <span className="text-xs text-error-300">!</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-dark-600 text-dark-300 hover:bg-error-500 hover:text-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    );

  // Запасной канал есть только в режиме «both» и только с открываемым контактом.
  const contactTarget =
    supportConfig?.support_type === 'both' && supportConfig.support_username
      ? resolveSupportContact(supportConfig)
      : null;
  const activeTicket = tickets?.items.find((item) => ACTIVE_TICKET_STATUSES.has(item.status));

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold text-dark-50 sm:text-3xl">{t('support.title')}</h1>
        {contactTarget && <p className="mt-1 text-sm text-dark-400">{t('support.subtitle')}</p>}
      </motion.div>

      {/* Заявка — первое и главное действие экрана. Раньше здесь была кнопка
          «Новый тикет» в шапке, а ниже карточка «Связаться с поддержкой →
          Написать»: люди читали вторую как «связаться» и уходили в личку. */}
      <motion.section
        variants={staggerItem}
        className="rounded-[var(--bento-radius-lg)] border-[1.5px] border-accent-500 bg-accent-500/10 p-5 sm:p-6"
      >
        {activeTicket ? (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-accent-400">
                {t('support.hero.activeTitle')}
              </span>
              <span className={`${getStatusBadge(activeTicket.status)} flex-shrink-0`}>
                {getStatusLabel(activeTicket.status)}
              </span>
            </div>
            <h2 className="break-words text-lg font-bold leading-snug text-dark-50">
              {activeTicket.title}
            </h2>
            {activeTicket.last_message?.message_text && (
              <div className="rounded-xl border border-dark-700/40 bg-dark-900/70 px-3.5 py-3">
                <div
                  className={`text-xs font-semibold ${activeTicket.last_message.is_from_admin ? 'text-accent-400' : 'text-dark-400'}`}
                >
                  {activeTicket.last_message.is_from_admin
                    ? t('support.supportTeam')
                    : t('support.you')}
                </div>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-dark-100">
                  {activeTicket.last_message.message_text}
                </p>
              </div>
            )}
            <Button
              size="lg"
              fullWidth
              className="h-[52px] font-bold"
              onClick={() => openTicket(activeTicket)}
            >
              <ChatIcon className="h-5 w-5" />
              {t('support.hero.openTicket')}
            </Button>
            <p className="text-center text-xs text-dark-400">{t('support.hero.activeHint')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-accent-500 text-on-accent">
                <ChatIcon className="h-[22px] w-[22px]" />
              </div>
              <div>
                <h2 className="text-lg font-bold leading-snug text-dark-50">
                  {t('support.hero.title')}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-dark-400">
                  {notifyByEmail ? t('support.hero.textEmail') : t('support.hero.text')}
                </p>
              </div>
            </div>
            <Button
              size="lg"
              className="h-[52px] w-full shrink-0 font-bold sm:w-auto"
              onClick={openCreateForm}
            >
              <EditIcon className="h-5 w-5" />
              {t('support.newTicket')}
            </Button>
          </div>
        )}
      </motion.section>

      {/* Вход в справку: в нижнем меню телефона места нет (решение владельца 05.11.2026).
          Сразу под заявкой — до Telegram: сначала «создать заявку», потом «найти ответ самому». */}
      <motion.div variants={staggerItem}>
        <Link
          to="/info"
          className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-dark-700/60 bg-dark-800/40 px-4 py-3 hover:border-dark-600"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500/10 text-accent-400">
            <PiQuestion aria-hidden className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-dark-50">
              {t('help.entry.title')}
            </span>
            <span className="mt-0.5 block text-xs text-dark-400">{t('help.entry.subtitle')}</span>
          </span>
          <PiCaretRight aria-hidden className="h-4 w-4 shrink-0 text-dark-500" />
        </Link>
      </motion.div>

      {/* Telegram — запасной путь, строкой под заявкой и справкой, а не равной кнопкой.
          Self-animated: монтируется после ответа конфига, когда stagger родителя
          уже отыграл и оставил бы его на opacity 0. */}
      {contactTarget && supportConfig && (
        <motion.div variants={staggerItem} initial="initial" animate="animate">
          <button
            type="button"
            onClick={() => openSupportContact(supportConfig)}
            className="flex w-full items-center gap-3 rounded-[var(--bento-radius)] border border-dark-700/40 bg-dark-900/70 px-4 py-3.5 text-left transition-colors hover:border-dark-600/50 hover:bg-dark-800/60"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dark-800 text-dark-400">
              {contactTarget.kind === 'telegram' ? (
                <TelegramIcon className="h-5 w-5" />
              ) : (
                <ChatIcon className="h-5 w-5" />
              )}
            </span>
            {/* Длинный ник не должен выталкивать стрелку за край: подпись переносится
                (а не режется многоточием — иначе пропадает «когда сюда писать»), иконки не сжимаются. */}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-dark-100">
                {contactTarget.kind === 'telegram'
                  ? t('support.telegramTitle')
                  : t('support.openSupport')}
              </span>
              <span className="mt-0.5 block break-words text-xs leading-snug text-dark-400">
                {supportConfig.support_username} · {t('support.telegramHint')}
              </span>
            </span>
            <ChevronRightIcon className="h-[18px] w-[18px] shrink-0 text-dark-400" />
          </button>
        </motion.div>
      )}

      <motion.div variants={staggerItem} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Tickets List */}
        <Card className="lg:col-span-1">
          <h2 className="mb-4 text-lg font-semibold text-dark-100">{t('support.yourTickets')}</h2>

          {isLoading ? (
            <SkeletonGroup className="space-y-3">
              <Skeleton variant="card" count={3} className="h-16" />
            </SkeletonGroup>
          ) : tickets?.items && tickets.items.length > 0 ? (
            <div className="space-y-2">
              {tickets.items.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => openTicket(ticket)}
                  className={`w-full rounded-bento border p-4 text-left transition-all ${
                    selectedTicket?.id === ticket.id
                      ? 'border-accent-500 bg-accent-500/10'
                      : 'border-dark-700/50 bg-dark-800/30 hover:border-dark-600'
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="truncate font-medium text-dark-100">{ticket.title}</div>
                    <span className={`${getStatusBadge(ticket.status)} flex-shrink-0`}>
                      {getStatusLabel(ticket.status)}
                    </span>
                  </div>
                  <div className="text-xs text-dark-500">
                    {new Date(ticket.updated_at).toLocaleDateString(uiLocale())}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            // Пустой список — строкой: большая иконка тут спорила с кнопкой заявки.
            <p className="-mt-2 text-sm text-dark-400">{t('support.noTickets')}</p>
          )}
        </Card>

        {/* Ticket Detail / Create Form. Пустая панель «выберите заявку» на телефоне
            — полэкрана ни о чём, там она скрыта; на десктопе это правая колонка. */}
        <Card
          ref={detailRef}
          className={`scroll-mt-24 lg:col-span-2 ${
            !showCreateForm && !selectedTicket ? 'hidden lg:block' : ''
          }`}
        >
          {showCreateForm ? (
            <div>
              <h2 className="mb-6 text-lg font-semibold text-dark-100">
                {t('support.createTicket')}
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setFormError(null);
                  // Rate limit: max 3 tickets per 60 seconds
                  if (!checkRateLimit(RATE_LIMIT_KEYS.TICKET_CREATE, 3, 60000)) {
                    const resetTime = getRateLimitResetTime(RATE_LIMIT_KEYS.TICKET_CREATE);
                    setFormError(t('support.tooManyRequests', { seconds: resetTime }));
                    return;
                  }
                  createMutation.mutate();
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="support-subject" className="label">
                    {t('support.subject')}
                  </label>
                  <input
                    id="support-subject"
                    type="text"
                    className="input"
                    placeholder={t('support.subjectPlaceholder')}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    minLength={3}
                    maxLength={255}
                  />
                </div>
                <div>
                  <label htmlFor="support-message" className="label">
                    {t('support.message')}
                  </label>
                  <textarea
                    id="support-message"
                    className="input min-h-[150px]"
                    placeholder={t('support.messagePlaceholder')}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    required
                    minLength={10}
                    maxLength={4000}
                  />
                </div>

                {/* Media attachments for create */}
                <div>
                  <input
                    ref={createFileInputRef}
                    type="file"
                    accept={Object.keys(MEDIA_TYPES).join(',')}
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      files.forEach((file) => handleFileSelect(file, setCreateAttachments));
                      e.target.value = '';
                    }}
                  />
                  <AttachmentsPreview
                    items={createAttachments}
                    onRemove={(idx) =>
                      setCreateAttachments((prev) => {
                        const removed = prev[idx];
                        if (removed?.preview) URL.revokeObjectURL(removed.preview);
                        return prev.filter((_, i) => i !== idx);
                      })
                    }
                  />
                  {createAttachments.length < 10 && (
                    <button
                      type="button"
                      onClick={() => createFileInputRef.current?.click()}
                      disabled={createAttachments.some((a) => a.uploading)}
                      className="mt-2 flex items-center gap-2 text-sm text-dark-400 transition-colors hover:text-dark-200 disabled:opacity-50"
                    >
                      <ImageIcon />
                      {t('support.attachMedia')}{' '}
                      {createAttachments.length > 0 && `(${createAttachments.length}/10)`}
                    </button>
                  )}
                </div>

                {formError && (
                  <div className="rounded-xl border border-error-500/30 bg-error-500/10 p-3 text-sm text-error-400">
                    {formError}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={createAttachments.some((a) => a.uploading)}
                    loading={createMutation.isPending}
                  >
                    <SendIcon className="h-4 w-4" />
                    <span className="ml-2">{t('support.send')}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCreateForm(false);
                      setFormError(null);
                      clearCreateAttachments();
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </form>
            </div>
          ) : selectedTicket ? (
            <div className="flex h-full flex-col">
              <div className="mb-6 flex flex-col gap-2 border-b border-dark-800/50 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-dark-100">
                    {ticketDetail?.title || selectedTicket.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={getStatusBadge(ticketDetail?.status || selectedTicket.status)}>
                      {getStatusLabel(ticketDetail?.status || selectedTicket.status)}
                    </span>
                    <span className="text-xs text-dark-500">
                      {t('support.created')}{' '}
                      {new Date(selectedTicket.created_at).toLocaleDateString(uiLocale())}
                    </span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              {detailLoading ? (
                <SkeletonGroup className="space-y-3">
                  <Skeleton variant="card" count={3} className="h-16" />
                </SkeletonGroup>
              ) : ticketDetail?.messages ? (
                <div className="scrollbar-hide mb-6 max-h-96 flex-1 space-y-4 overflow-y-auto">
                  {ticketDetail.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-xl p-4 ${
                        msg.is_from_admin
                          ? 'ml-4 border border-accent-500/20 bg-accent-500/10'
                          : 'mr-4 border border-dark-700/30 bg-dark-800/50'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span
                          className={`text-xs font-medium ${msg.is_from_admin ? 'text-accent-400' : 'text-dark-400'}`}
                        >
                          {msg.is_from_admin ? t('support.supportTeam') : t('support.you')}
                        </span>
                        <span className="text-xs text-dark-500">
                          {new Date(msg.created_at).toLocaleString(uiLocale())}
                        </span>
                      </div>
                      {msg.message_text && (
                        <div
                          className="whitespace-pre-wrap break-words text-dark-200 [&_a]:text-accent-400 [&_a]:underline"
                          dangerouslySetInnerHTML={{ __html: linkifyText(msg.message_text) }}
                        />
                      )}
                      {/* Display media if present */}
                      <MessageMediaGrid
                        message={msg}
                        translateError={t('support.imageLoadFailed')}
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Reply Form */}
              {ticketDetail?.status !== 'closed' && !ticketDetail?.is_reply_blocked && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setFormError(null);
                    // Rate limit: max 5 replies per 30 seconds
                    if (!checkRateLimit(RATE_LIMIT_KEYS.TICKET_REPLY, 5, 30000)) {
                      const resetTime = getRateLimitResetTime(RATE_LIMIT_KEYS.TICKET_REPLY);
                      setFormError(t('support.tooManyRequests', { seconds: resetTime }));
                      return;
                    }
                    replyMutation.mutate();
                  }}
                  className="border-t border-dark-800/50 pt-4"
                >
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <textarea
                        className="input min-h-[80px] min-w-0 flex-1"
                        placeholder={t('support.replyPlaceholder')}
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        maxLength={4000}
                      />
                    </div>

                    {/* Media attachments for reply */}
                    <div>
                      <input
                        ref={replyFileInputRef}
                        type="file"
                        accept={Object.keys(MEDIA_TYPES).join(',')}
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          files.forEach((file) => handleFileSelect(file, setReplyAttachments));
                          e.target.value = '';
                        }}
                      />
                      <AttachmentsPreview
                        items={replyAttachments}
                        onRemove={(idx) =>
                          setReplyAttachments((prev) => {
                            const removed = prev[idx];
                            if (removed?.preview) URL.revokeObjectURL(removed.preview);
                            return prev.filter((_, i) => i !== idx);
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      {replyAttachments.length < 10 && (
                        <button
                          type="button"
                          onClick={() => replyFileInputRef.current?.click()}
                          disabled={replyAttachments.some((a) => a.uploading)}
                          className="flex items-center gap-2 text-sm text-dark-400 transition-colors hover:text-dark-200 disabled:opacity-50"
                        >
                          <ImageIcon />
                          {t('support.attachMedia')}{' '}
                          {replyAttachments.length > 0 && `(${replyAttachments.length}/10)`}
                        </button>
                      )}

                      <Button
                        type="submit"
                        disabled={
                          (!replyMessage.trim() &&
                            replyAttachments.filter((a) => a.fileId).length === 0) ||
                          replyAttachments.some((a) => a.uploading)
                        }
                        loading={replyMutation.isPending}
                      >
                        <SendIcon className="h-4 w-4" />
                      </Button>
                    </div>
                    {formError && (
                      <div className="mt-2 rounded-lg border border-error-500/30 bg-error-500/10 p-2 text-sm text-error-400">
                        {formError}
                      </div>
                    )}
                  </div>
                </form>
              )}

              {ticketDetail?.is_reply_blocked && (
                <div className="border-t border-dark-800/50 py-4 text-center text-sm text-dark-500">
                  {t('support.repliesDisabled')}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-dark-800">
                <ChatIcon className="h-8 w-8 text-dark-500" />
              </div>
              <div className="text-dark-400">{t('support.selectTicket')}</div>
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
