import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { PiArrowLeft, PiArrowUp, PiCalendarBlank, PiClock, PiListBullets } from 'react-icons/pi';
import {
  useHelpDocument,
  useInfoVisibility,
  useTabReplacements,
} from '../components/help/useHelpQueries';
import { useInternalLinks } from '../hooks/useInternalLinks';
import { outlineDocument } from '../utils/help/docOutline';
import { plainText, type HelpDocKind } from '../utils/help/search';
import { formatContent } from '../utils/legalContent';
import { uiLocale } from '../utils/uiLocale';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

const DOCS = new Set<HelpDocKind>(['rules', 'privacy', 'offer']);
const WORDS_PER_MINUTE = 200;
const TO_TOP_AFTER_PX = 600;

/** Документ справки: оглавление, дата обновления, время чтения, «Наверх». */
export default function HelpDocument() {
  const { doc: docParam } = useParams();
  const doc = DOCS.has(docParam as HelpDocKind) ? (docParam as HelpDocKind) : null;
  if (!doc) return <Navigate to="/info" replace />;
  return <HelpDocumentView doc={doc} />;
}

function HelpDocumentView({ doc }: { doc: HelpDocKind }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const onContentClick = useInternalLinks();
  const { data: visibility } = useInfoVisibility();
  const { data: replacements } = useTabReplacements();
  const hidden = visibility?.[doc] === false;
  const { data, isLoading } = useHelpDocument(doc, !hidden);
  const [showTop, setShowTop] = useState(false);

  const title = t(`help.docs.${doc}`);
  const outline = useMemo(
    () => (data?.content ? outlineDocument(formatContent(data.content), doc, title) : null),
    [data?.content, doc, title],
  );
  const toc = outline
    ? outline.toc.some((entry) => entry.level > 1)
      ? outline.toc.filter((entry) => entry.level > 1)
      : outline.toc
    : [];
  const minutes = data?.content
    ? Math.max(1, Math.ceil(plainText(data.content).split(' ').length / WORDS_PER_MINUTE))
    : 0;

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > TO_TOP_AFTER_PX);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!outline || !location.hash) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [outline, location.hash]);

  const replacement = replacements?.[doc];
  if (replacement) return <Navigate to={`/info/${replacement}`} replace />;

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    navigate({ hash: id }, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate('/info')}
          aria-label={t('help.back')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-dark-700/60 bg-dark-800/50 text-dark-100"
        >
          <PiArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold leading-tight text-dark-50">{title}</h1>
          {data?.content && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dark-400">
              {data.updated_at && (
                <span className="inline-flex items-center gap-1.5">
                  <PiCalendarBlank aria-hidden className="h-3.5 w-3.5" />
                  {t('help.doc.updated', {
                    date: new Date(data.updated_at).toLocaleDateString(uiLocale(), {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }),
                  })}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <PiClock aria-hidden className="h-3.5 w-3.5" />
                {t('help.doc.readingTime', { count: minutes })}
              </span>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <SkeletonGroup className="space-y-3">
          <Skeleton variant="card" count={3} className="h-24" />
        </SkeletonGroup>
      ) : hidden || !outline ? (
        <p className="rounded-2xl border border-dark-700/60 bg-dark-800/40 px-4 py-6 text-center text-dark-300">
          {t('help.doc.unavailable')}
        </p>
      ) : (
        <>
          {toc.length >= 2 && (
            <nav
              aria-label={t('help.doc.contents')}
              className="rounded-2xl border border-dark-700/60 bg-dark-800/40 px-4 py-3.5"
            >
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-dark-400">
                <PiListBullets aria-hidden className="h-4 w-4" />
                {t('help.doc.contents')} · {t('help.doc.contentsCount', { count: toc.length })}
              </div>
              <ol className="mt-2 space-y-0.5">
                {toc.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => jump(entry.id)}
                      className="flex min-h-[36px] w-full items-center text-left text-sm text-dark-100 hover:text-accent-400"
                    >
                      {entry.title}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {/* Клик ловим на обёртке: интерактивны только ссылки внутри документа. */}
          <article
            onClick={onContentClick}
            className="prose prose-invert max-w-none rounded-2xl border border-dark-700/60 bg-dark-800/40 px-4 py-5 text-[15px] leading-relaxed text-dark-200 prose-headings:scroll-mt-24 prose-a:text-accent-400 sm:px-6"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML прошёл formatContent → DOMPurify, id заголовков добавлены после очистки
            dangerouslySetInnerHTML={{ __html: outline.html }}
          />
        </>
      )}

      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label={t('help.doc.toTop')}
          className="fixed bottom-6 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-accent-500/40 bg-dark-900 text-accent-400 shadow-lg"
        >
          <PiArrowUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
