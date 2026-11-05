import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PiChatCircle } from 'react-icons/pi';
import { infoApi, type FaqPage } from '../../api/info';
import { resolveSupportContact } from '../../utils/supportContact';
import { FaqItem } from './FaqItem';

/**
 * «Не нашли ответ?» — заявка первой, Telegram строкой ниже (как на экране
 * «Поддержка» после 04.11.2026), а под ними вопросы темы «Поддержка»: что
 * приложить к заявке, нужен ли VPN и т. п.
 */
export function SupportBlock({ supportPages }: { supportPages: FaqPage[] }) {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<number | null>(null);
  const { data: config } = useQuery({
    queryKey: ['support-config'],
    queryFn: infoApi.getSupportConfig,
    staleTime: 5 * 60_000,
  });
  const contact = config ? resolveSupportContact(config) : null;
  const telegramHandle =
    contact?.kind === 'telegram' ? `@${contact.url.replace(/^https?:\/\/t\.me\//, '')}` : null;

  return (
    <section
      aria-labelledby="help-support-title"
      className="flex flex-col gap-3 rounded-[var(--bento-radius-lg)] border border-accent-500/35 bg-accent-500/10 p-4 sm:p-5"
    >
      <div>
        <h2 id="help-support-title" className="text-[17px] font-bold text-dark-50">
          {t('help.support.title')}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-dark-300">{t('help.support.text')}</p>
      </div>
      <Link
        to="/support"
        className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 text-[15px] font-bold text-on-accent transition-opacity hover:opacity-90"
      >
        <PiChatCircle aria-hidden className="h-5 w-5" />
        {t('help.support.create')}
      </Link>
      {supportPages.length > 0 && (
        <div className="space-y-1.5">
          {supportPages.map((page) => (
            <FaqItem
              key={page.id}
              page={page}
              compact
              open={openId === page.id}
              onToggle={() => setOpenId((prev) => (prev === page.id ? null : page.id))}
            />
          ))}
        </div>
      )}
      {telegramHandle && contact && (
        <p className="text-center text-xs text-dark-400">
          {t('help.support.telegram')} ·{' '}
          <a
            href={contact.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-accent-400"
          >
            {telegramHandle}
          </a>
        </p>
      )}
    </section>
  );
}
