import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PiCaretRight, PiFileText } from 'react-icons/pi';
import type { HelpHit, Segments } from '../../utils/help/search';

function Marked({ segments }: { segments: Segments }) {
  return (
    <>
      {segments.map((part, index) =>
        part.mark ? (
          <mark key={index} className="rounded bg-accent-500/30 px-0.5 text-dark-50">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

function HitGroup({ title, hits, doc }: { title: string; hits: HelpHit[]; doc?: boolean }) {
  if (!hits.length) return null;
  return (
    <section className="space-y-2.5">
      <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-dark-400">
        {title} · {hits.length}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-dark-700/60 bg-dark-800/40">
        {hits.map((hit, index) => (
          <Link
            key={hit.key}
            to={hit.to}
            className={`flex items-start gap-3 px-4 py-3 hover:bg-dark-800/60 ${
              index > 0 ? 'border-t border-dark-700/50' : ''
            }`}
          >
            {doc && <PiFileText aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-dark-400" />}
            <span className="min-w-0 flex-1">
              <span className="block break-words text-[15px] font-semibold leading-snug text-dark-50">
                <Marked segments={hit.title} />
              </span>
              <span className="mt-1 block break-words text-[13px] leading-relaxed text-dark-400">
                <Marked segments={hit.snippet} />
              </span>
              <span className="mt-1.5 block text-[11px] font-bold tracking-wide text-accent-400">
                {hit.where}
              </span>
            </span>
            {!doc && <PiCaretRight aria-hidden className="mt-1 h-4 w-4 shrink-0 text-dark-500" />}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function HelpSearchResults({
  query,
  faq,
  docs,
}: {
  query: string;
  faq: HelpHit[];
  docs: HelpHit[];
}) {
  const { t } = useTranslation();
  if (!faq.length && !docs.length) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-2xl border border-dark-700/60 bg-dark-800/40 px-4 py-7 text-center">
        <p className="text-base font-bold text-dark-50">
          {t('help.searchNothing', { query: query.trim() })}
        </p>
        <p className="text-sm text-dark-400">{t('help.searchNothingHint')}</p>
        <Link
          to="/support"
          className="flex min-h-[48px] items-center rounded-xl bg-accent-500 px-5 text-[15px] font-bold text-on-accent"
        >
          {t('help.support.create')}
        </Link>
      </section>
    );
  }
  return (
    <div className="space-y-5" aria-live="polite">
      <HitGroup title={t('help.searchQuestions')} hits={faq} />
      <HitGroup title={t('help.searchDocs')} hits={docs} doc />
      <p className="text-center text-sm text-dark-400">
        {t('help.noAnswer')}{' '}
        <Link to="/support" className="font-bold text-accent-400">
          {t('help.support.create')}
        </Link>
      </p>
    </div>
  );
}
