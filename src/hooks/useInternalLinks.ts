import { useCallback, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';

/**
 * Ссылки внутри ответов FAQ — абсолютные (`https://lk.null-core.com/subscriptions`):
 * тот же текст бот показывает в Telegram. В кабинете такая ссылка открывала бы
 * новую вкладку, а в мини-приложении — внешний браузер; ведём её роутером.
 * Внешние ссылки не трогаем.
 */
export function useInternalLinks(): (event: MouseEvent<HTMLElement>) => void {
  const navigate = useNavigate();
  return useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement).closest('a');
      const href = anchor?.getAttribute('href');
      if (!href) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      navigate(`${url.pathname}${url.search}${url.hash}`);
    },
    [navigate],
  );
}
