import { useQuery } from '@tanstack/react-query';
import { ticketNotificationsApi } from '../api/ticketNotifications';
import { useAuthStore } from '../store/auth';

/**
 * Непрочитанные ответы поддержки пользователю.
 *
 * Тот же ключ и запрос, что у колокольчика (TicketNotificationBell, режим
 * пользователя), — кеш общий, второго опроса бэка нет, и колокольчик с точкой
 * на вкладке «Поддержка» гаснут одновременно.
 */
export const SUPPORT_UNREAD_COUNT_KEY = ['ticket-notifications-count'] as const;

export function useSupportUnreadCount(): number {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { data } = useQuery({
    queryKey: SUPPORT_UNREAD_COUNT_KEY,
    queryFn: ticketNotificationsApi.getUnreadCount,
    enabled: isAuthenticated,
    refetchInterval: 60000,
    staleTime: 30000,
  });
  return data?.unread_count ?? 0;
}
