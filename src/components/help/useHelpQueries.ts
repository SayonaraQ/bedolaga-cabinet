import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { infoApi } from '../../api/info';
import { infoPagesApi } from '../../api/infoPages';
import type { HelpDocKind } from '../../utils/help/search';

/** Язык интерфейса без региона: бэкенд отдаёт документы по `ru` / `en`. */
export function useHelpLocale(): string {
  const { i18n } = useTranslation();
  return i18n.language.split('-')[0];
}

export function useInfoVisibility() {
  return useQuery({
    queryKey: ['info-visibility'],
    queryFn: infoApi.getVisibility,
    staleTime: 60_000,
  });
}

export function useFaqPages(enabled = true) {
  const locale = useHelpLocale();
  return useQuery({
    queryKey: ['faq-pages', locale],
    queryFn: () => infoApi.getFaqPages(locale),
    enabled,
    staleTime: 60_000,
  });
}

export function useTabReplacements() {
  return useQuery({
    queryKey: ['info-pages', 'tab-replacements'],
    queryFn: infoPagesApi.getTabReplacements,
    staleTime: 60_000,
  });
}

// Ключи кеша — те же, что были у прежней страницы «Информация».
const DOC_QUERY: Record<
  HelpDocKind,
  {
    key: string;
    fetch: (language: string) => Promise<{ content: string; updated_at: string | null }>;
  }
> = {
  rules: { key: 'rules', fetch: infoApi.getRules },
  privacy: { key: 'privacy-policy', fetch: infoApi.getPrivacyPolicy },
  offer: { key: 'public-offer', fetch: infoApi.getPublicOffer },
};

export function useHelpDocument(doc: HelpDocKind, enabled = true) {
  const locale = useHelpLocale();
  const { key, fetch } = DOC_QUERY[doc];
  return useQuery({
    queryKey: [key, locale],
    queryFn: () => fetch(locale),
    enabled,
    staleTime: 60_000,
  });
}
