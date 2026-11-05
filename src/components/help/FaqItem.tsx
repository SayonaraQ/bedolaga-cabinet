import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PiCaretDown, PiCheck, PiLink } from 'react-icons/pi';
import type { FaqPage } from '../../api/info';
import { useInternalLinks } from '../../hooks/useInternalLinks';
import { copyToClipboard } from '../../utils/clipboard';
import { splitFaqBranches } from '../../utils/help/faqBranches';
import { formatContent } from '../../utils/legalContent';

export const faqAnchorId = (id: number) => `faq-${id}`;
export const faqLink = (id: number) => `${window.location.origin}/info/faq/${id}`;

const PROSE =
  'prose prose-invert max-w-none text-[15px] leading-relaxed text-dark-200 prose-a:text-accent-400 prose-li:my-1';

const BRANCH_BOX = `${PROSE} rounded-xl border border-dark-700/60 bg-dark-900/50 px-4 py-3`;

interface FaqItemProps {
  page: FaqPage;
  open: boolean;
  onToggle: () => void;
  /** Лёгкий вид — вопросы поддержки внутри карточки «Не нашли ответ?». */
  compact?: boolean;
}

export function FaqItem({ page, open, onToggle, compact = false }: FaqItemProps) {
  const { t } = useTranslation();
  const onContentClick = useInternalLinks();
  const [copied, setCopied] = useState(false);
  const [branchIndex, setBranchIndex] = useState(0);
  const headerRef = useRef<HTMLButtonElement>(null);
  const headerTopBeforeToggle = useRef<number | null>(null);

  // Сначала очищаем, потом режем на ветки: ветки собираются из уже чистого DOM.
  const html = useMemo(() => formatContent(page.content), [page.content]);
  const split = useMemo(() => splitFaqBranches(html), [html]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  // Открыт один вопрос: тап по вопросу ниже открытого сворачивает верхний, всё
  // над пальцем сжимается, а прокрутка остаётся прежней — заголовок уезжал за
  // экран, под пальцем оказывался низ страницы. Держим заголовок на месте:
  // запоминаем, где он был, и после перестройки (до отрисовки) докручиваем.
  const toggle = () => {
    headerTopBeforeToggle.current = headerRef.current?.getBoundingClientRect().top ?? null;
    onToggle();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: open — триггер: сверяем позицию после своего переключения
  useLayoutEffect(() => {
    const before = headerTopBeforeToggle.current;
    headerTopBeforeToggle.current = null;
    if (before === null || !headerRef.current) return;
    const shift = Math.round(headerRef.current.getBoundingClientRect().top - before);
    if (shift !== 0) window.scrollBy({ top: shift, behavior: 'instant' });
  }, [open]);

  const copy = async () => {
    try {
      await copyToClipboard(faqLink(page.id));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const shell = compact
    ? 'rounded-xl bg-dark-900/40'
    : `rounded-2xl border ${open ? 'border-accent-500/40' : 'border-dark-700/60'} bg-dark-800/40`;
  const branch = split?.branches[Math.min(branchIndex, split.branches.length - 1)];

  return (
    <div id={faqAnchorId(page.id)} className={`scroll-mt-24 ${shell}`}>
      <button
        ref={headerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left ${
          compact ? 'text-sm font-semibold' : 'text-[15px] font-semibold'
        } text-dark-50`}
      >
        <span className="min-w-0 break-words">{page.title}</span>
        <PiCaretDown
          aria-hidden
          className={`h-5 w-5 shrink-0 text-dark-400 transition-transform ${open ? 'rotate-180 text-accent-400' : ''}`}
        />
      </button>

      {open && (
        // Клик ловим на обёртке: интерактивны только ссылки внутри ответа.
        <div className="space-y-4 px-4 pb-4" onClick={onContentClick}>
          {split ? (
            <>
              {split.intro && (
                <>
                  {/* biome-ignore lint/security/noDangerouslySetInnerHtml: HTML прошёл formatContent → DOMPurify */}
                  <div className={PROSE} dangerouslySetInnerHTML={{ __html: split.intro }} />
                </>
              )}
              <div className="space-y-2">
                <p className="text-sm font-bold text-dark-100">{t('help.faq.whatBroken')}</p>
                <div className="flex flex-wrap gap-2">
                  {split.branches.map((item, index) => {
                    const active = item === branch;
                    return (
                      <button
                        key={item.title}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setBranchIndex(index)}
                        className={`min-h-[44px] rounded-xl border px-3.5 py-2 text-left text-sm font-bold transition-colors ${
                          active
                            ? 'border-accent-500 bg-accent-500 text-on-accent'
                            : 'border-dark-700 bg-dark-900/60 text-dark-100 hover:border-dark-600'
                        }`}
                      >
                        {item.title}
                      </button>
                    );
                  })}
                </div>
              </div>
              {branch && (
                <>
                  {/* biome-ignore lint/security/noDangerouslySetInnerHtml: HTML прошёл formatContent → DOMPurify */}
                  <div className={BRANCH_BOX} dangerouslySetInnerHTML={{ __html: branch.html }} />
                </>
              )}
            </>
          ) : (
            <>
              {/* biome-ignore lint/security/noDangerouslySetInnerHtml: HTML прошёл formatContent → DOMPurify */}
              <div className={PROSE} dangerouslySetInnerHTML={{ __html: html }} />
            </>
          )}

          {!compact && (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-dark-700/50 pt-3">
              <button
                type="button"
                onClick={copy}
                className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-dark-400 hover:text-dark-200"
              >
                {copied ? (
                  <PiCheck aria-hidden className="h-4 w-4 text-success-400" />
                ) : (
                  <PiLink aria-hidden className="h-4 w-4" />
                )}
                {copied ? t('help.faq.copied') : t('help.faq.copyLink')}
              </button>
              <Link
                to="/support"
                className="inline-flex min-h-[44px] items-center text-sm font-bold text-accent-400 hover:text-accent-300"
              >
                {t('help.faq.notHelped')}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
