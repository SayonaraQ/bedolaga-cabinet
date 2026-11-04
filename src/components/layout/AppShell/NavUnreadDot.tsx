import { useTranslation } from 'react-i18next';

/**
 * Точка «есть непрочитанный ответ» у иконки пункта навигации. Родитель должен
 * быть `relative`. Текст для скринридера живёт внутри ссылки, поэтому попадает
 * в её доступное имя.
 */
export function NavUnreadDot({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute h-2 w-2 rounded-full bg-error-500 ring-2 ring-dark-900 ${className}`}
      />
      <span className="sr-only">{t('nav.supportUnread')}</span>
    </>
  );
}
