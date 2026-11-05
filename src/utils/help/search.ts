import type { FaqPage } from '../../api/info';

export type HelpDocKind = 'rules' | 'privacy' | 'offer';

export interface HelpDocSection {
  doc: HelpDocKind;
  docTitle: string;
  /** id заголовка в документе (`sec-N`); пусто — документ без заголовков. */
  id: string;
  title: string;
  text: string;
}

export type Segments = { text: string; mark: boolean }[];

export interface HelpHit {
  key: string;
  to: string;
  title: Segments;
  snippet: Segments;
  where: string;
}

/** Текст из HTML ответа: пробел на месте каждого тега, иначе пункты списка слипаются. */
export function plainText(html: string): string {
  const doc = new DOMParser().parseFromString(html.replace(/</g, ' <'), 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Слова запроса → основы: у слов длиннее пяти букв отрезаем два последних знака,
 * чтобы «оплата» находила «оплатить», а «возврат» — «возврата». Однобуквенные
 * слова не ищем.
 */
export function searchStems(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 2)
    .map((word) => (word.length > 5 ? word.slice(0, -2) : word));
}

function firstMatch(text: string, stems: string[]): { index: number; length: number } | null {
  const lower = text.toLowerCase();
  let best: { index: number; length: number } | null = null;
  for (const stem of stems) {
    const index = lower.indexOf(stem);
    if (index >= 0 && (!best || index < best.index)) best = { index, length: stem.length };
  }
  return best;
}

export function highlight(text: string, stems: string[]): Segments {
  const match = firstMatch(text, stems);
  if (!match) return [{ text, mark: false }];
  const parts: Segments = [
    { text: text.slice(0, match.index), mark: false },
    { text: text.slice(match.index, match.index + match.length), mark: true },
    { text: text.slice(match.index + match.length), mark: false },
  ];
  return parts.filter((part) => part.text.length > 0);
}

const SNIPPET_BEFORE = 60;
const SNIPPET_LENGTH = 160;

function snippet(text: string, stems: string[]): Segments {
  const match = firstMatch(text, stems);
  if (!match) {
    const head =
      text.length > SNIPPET_LENGTH ? `${text.slice(0, SNIPPET_LENGTH).trimEnd()}…` : text;
    return [{ text: head, mark: false }];
  }
  const start = Math.max(0, match.index - SNIPPET_BEFORE);
  const end = Math.min(text.length, start + SNIPPET_LENGTH);
  const window = `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
  return highlight(window, stems);
}

export function searchHelp(
  query: string,
  faq: FaqPage[],
  topicLabel: (page: FaqPage) => string,
  sections: HelpDocSection[],
): { faq: HelpHit[]; docs: HelpHit[] } {
  const stems = searchStems(query);
  if (stems.length === 0) return { faq: [], docs: [] };
  const matches = (haystack: string) => {
    const lower = haystack.toLowerCase();
    return stems.every((stem) => lower.includes(stem));
  };

  const faqHits = faq.flatMap((page) => {
    const text = plainText(page.content);
    const where = topicLabel(page);
    if (!matches(`${page.title} ${text} ${where}`)) return [];
    return [
      {
        key: `faq-${page.id}`,
        to: `/info/faq/${page.id}`,
        title: highlight(page.title, stems),
        snippet: snippet(text, stems),
        where,
      },
    ];
  });

  const docHits = sections.flatMap((section) => {
    if (!matches(`${section.title} ${section.text}`)) return [];
    return [
      {
        key: `doc-${section.doc}-${section.id || 'top'}`,
        to: `/info/doc/${section.doc}${section.id ? `#${section.id}` : ''}`,
        title: highlight(section.title, stems),
        snippet: snippet(section.text, stems),
        where: section.docTitle,
      },
    ];
  });

  return { faq: faqHits, docs: docHits };
}
