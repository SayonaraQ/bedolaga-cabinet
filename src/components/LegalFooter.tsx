import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { infoApi, type InfoVisibility } from '../api/info';

interface LegalLink {
  href: string;
  labelKey: string;
  fallback: string;
  visibilityKey: keyof InfoVisibility;
}

const LINKS: LegalLink[] = [
  {
    href: '/offer',
    labelKey: 'footer.offer',
    fallback: 'Публичная оферта',
    visibilityKey: 'offer',
  },
  {
    href: '/privacy',
    labelKey: 'footer.privacy',
    fallback: 'Политика конфиденциальности',
    visibilityKey: 'privacy',
  },
  {
    href: '/recurrent-payments',
    labelKey: 'footer.recurrent',
    fallback: 'Рекуррентные платежи',
    visibilityKey: 'recurrent',
  },
];

interface LegalFooterProps {
  className?: string;
}

export default function LegalFooter({ className = '' }: LegalFooterProps) {
  const { t } = useTranslation();
  // Тот же ключ, что у «Справки»: документ, выключенный для веба, бэк по
  // публичной ручке отдаёт 404, и ссылка вела бы на «Документ недоступен».
  // Пока видимость не пришла (или не пришла вовсе) — ссылки прежние.
  const { data: visibility } = useQuery({
    queryKey: ['info-visibility'],
    queryFn: infoApi.getVisibility,
    staleTime: 60_000,
  });
  const links = LINKS.filter((link) => visibility?.[link.visibilityKey] !== false);

  return (
    // Ссылки разведены зазором, без «·» между ними: на узком экране ряд
    // переносится, и точка оставалась висеть в конце первой строки.
    <footer
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-[11px] leading-relaxed text-dark-500 ${className}`}
    >
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-accent-400"
        >
          {t(link.labelKey, link.fallback)}
        </a>
      ))}
    </footer>
  );
}
