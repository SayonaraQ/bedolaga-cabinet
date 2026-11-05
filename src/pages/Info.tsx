import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import {
  PiCaretRight,
  PiFileText,
  PiMagnifyingGlass,
  PiShieldCheck,
  PiStar,
  PiX,
} from 'react-icons/pi';
import type { FaqPage } from '../api/info';
import { infoPagesApi } from '../api/infoPages';
import { promoApi } from '../api/promo';
import { subscriptionApi } from '../api/subscription';
import { DocumentList, type HelpDocumentRow } from '../components/help/DocumentList';
import { HelpSearchResults } from '../components/help/HelpSearchResults';
import { SituationCard } from '../components/help/SituationCard';
import { SupportBlock } from '../components/help/SupportBlock';
import { TopicGrid } from '../components/help/TopicGrid';
import {
  useFaqPages,
  useHelpDocument,
  useHelpLocale,
  useInfoVisibility,
  useTabReplacements,
} from '../components/help/useHelpQueries';
import { outlineDocument } from '../utils/help/docOutline';
import {
  searchHelp,
  searchStems,
  type HelpDocKind,
  type HelpDocSection,
} from '../utils/help/search';
import { pickHelpSituation } from '../utils/help/situation';
import {
  groupFaqByTopic,
  HELP_POPULAR_FAQ_IDS,
  pickFaq,
  SUPPORT_TOPIC,
  topicOf,
} from '../utils/help/topics';
import { formatContent } from '../utils/legalContent';
import { uiLocale } from '../utils/uiLocale';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

const BUILTIN_SLUGS = new Set(['faq', 'rules', 'privacy', 'offer', 'loyalty']);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(uiLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * «Справка» (была «Информация»): карточка по подписке, поиск, темы, частые
 * вопросы, «Не нашли ответ?» и документы. Макет — холст «Справка: A+B на живом
 * FAQ», утверждён владельцем 05.11.2026.
 */
export default function Info() {
  const { t } = useTranslation();
  const locale = useHelpLocale();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const searching = searchStems(query).length > 0;
  const setQuery = (value: string) => setParams(value ? { q: value } : {}, { replace: true });

  const { data: visibility } = useInfoVisibility();
  const faqVisible = visibility?.faq !== false;
  const { data: faqPages, isLoading: faqLoading } = useFaqPages(faqVisible);
  const { data: replacements } = useTabReplacements();
  const { data: customPages } = useQuery({
    queryKey: ['info-pages', 'list'],
    queryFn: () => infoPagesApi.getPages(),
    staleTime: 60_000,
  });
  const { data: loyalty } = useQuery({
    queryKey: ['loyalty-tiers'],
    queryFn: promoApi.getLoyaltyTiers,
    staleTime: 60_000,
    retry: false,
  });

  const { data: subscriptionResponse } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.getSubscription(),
    retry: false,
  });
  const subscription = subscriptionResponse?.subscription ?? null;
  const { data: devicesData } = useQuery({
    queryKey: ['devices'],
    queryFn: () => subscriptionApi.getDevices(),
    enabled: !!subscription,
    retry: false,
  });

  const docVisible = (doc: HelpDocKind) => visibility?.[doc] !== false && !replacements?.[doc];
  const offer = useHelpDocument('offer', docVisible('offer'));
  const privacy = useHelpDocument('privacy', docVisible('privacy'));
  const rules = useHelpDocument('rules', docVisible('rules'));

  const faq = faqPages ?? [];
  const { topics, support } = useMemo(() => groupFaqByTopic(faq), [faq]);
  const popular = useMemo(() => pickFaq(faq, HELP_POPULAR_FAQ_IDS), [faq]);
  const situation = subscription
    ? pickHelpSituation(subscription, devicesData?.total ?? null)
    : null;

  const docs = useMemo<
    { kind: HelpDocKind; data?: { content: string; updated_at: string | null } }[]
  >(
    () => [
      { kind: 'offer', data: offer.data },
      { kind: 'privacy', data: privacy.data },
      { kind: 'rules', data: rules.data },
    ],
    [offer.data, privacy.data, rules.data],
  );

  // Документы режем на разделы только во время поиска.
  const sections = useMemo<HelpDocSection[]>(() => {
    if (!searching) return [];
    return docs.flatMap(({ kind, data }) =>
      data?.content
        ? outlineDocument(formatContent(data.content), kind, t(`help.docs.${kind}`)).sections
        : [],
    );
  }, [searching, docs, t]);

  const topicLabel = (page: FaqPage) =>
    page.category === SUPPORT_TOPIC
      ? t('help.topics.support.title')
      : t(`help.topics.${topicOf(page)}.title`);
  const results = searching ? searchHelp(query, faq, topicLabel, sections) : null;

  const docRows: HelpDocumentRow[] = [];
  for (const { kind, data } of docs) {
    const slug = replacements?.[kind];
    if (visibility?.[kind] === false && !slug) continue;
    if (!slug && !data?.content) continue;
    const updated = data?.updated_at
      ? t('help.updatedAt', { date: formatDate(data.updated_at) })
      : '';
    const subtitle =
      kind === 'offer'
        ? [t('help.offerSubtitle'), updated].filter(Boolean).join(' · ')
        : updated || undefined;
    docRows.push({
      key: kind,
      title: t(`help.docs.${kind}`),
      subtitle,
      to: slug ? `/info/${slug}` : `/info/doc/${kind}`,
      Icon: kind === 'privacy' ? PiShieldCheck : PiFileText,
    });
  }
  if (loyalty?.tiers?.length) {
    docRows.push({ key: 'loyalty', title: t('help.loyalty'), to: '/info/loyalty', Icon: PiStar });
  }
  for (const page of customPages ?? []) {
    if (page.replaces_tab || BUILTIN_SLUGS.has(page.slug)) continue;
    docRows.push({
      key: `page-${page.slug}`,
      title: page.title[locale] || page.title.ru || page.title.en || page.slug,
      to: `/info/${page.slug}`,
      Icon: PiFileText,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-50 sm:text-3xl">{t('help.title')}</h1>
        <p className="mt-1.5 text-sm text-dark-400">{t('help.subtitle')}</p>
      </div>

      {!searching && situation && subscription && (
        <SituationCard situation={situation} subscription={subscription} faq={faq} />
      )}

      <label className="flex h-[52px] items-center gap-2.5 rounded-2xl border border-dark-700 bg-dark-900/60 pl-4 pr-1.5 text-dark-400 focus-within:border-accent-500/60">
        <PiMagnifyingGlass aria-hidden className="h-5 w-5 shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('help.searchPlaceholder')}
          aria-label={t('help.searchPlaceholder')}
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-[15px] text-dark-50 outline-none placeholder:text-dark-500 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('help.searchClear')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-dark-400 hover:text-dark-200"
          >
            <PiX className="h-[18px] w-[18px]" />
          </button>
        )}
      </label>

      {results ? (
        <HelpSearchResults query={query} faq={results.faq} docs={results.docs} />
      ) : (
        <>
          {faqLoading ? (
            <SkeletonGroup className="grid grid-cols-2 gap-2.5">
              <Skeleton variant="card" count={4} className="h-28" />
            </SkeletonGroup>
          ) : (
            <TopicGrid topics={topics} />
          )}

          {popular.length > 0 && (
            <section className="space-y-2.5" aria-label={t('help.popular')}>
              <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-dark-400">
                {t('help.popular')}
              </h2>
              <div className="overflow-hidden rounded-2xl border border-dark-700/60 bg-dark-800/40">
                {popular.map((page, index) => (
                  <Link
                    key={page.id}
                    to={`/info/faq/${page.id}`}
                    className={`flex min-h-[54px] items-center gap-3 px-4 py-3 text-[15px] font-medium text-dark-50 hover:bg-dark-800/60 ${
                      index > 0 ? 'border-t border-dark-700/50' : ''
                    }`}
                  >
                    <span className="min-w-0 flex-1 break-words">{page.title}</span>
                    <PiCaretRight aria-hidden className="h-4 w-4 shrink-0 text-dark-500" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <SupportBlock supportPages={support} />
          <DocumentList title={t('help.documents')} rows={docRows} />
        </>
      )}
    </div>
  );
}
