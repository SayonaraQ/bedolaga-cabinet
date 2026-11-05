import { plainText, type HelpDocKind, type HelpDocSection } from './search';

export interface HelpTocEntry {
  id: string;
  title: string;
  level: number;
}

const HEADINGS = new Set(['H1', 'H2', 'H3']);

/**
 * Готовый (уже очищенный `formatContent`) HTML документа → он же с `id` у
 * заголовков, оглавление и разделы для поиска. `id` ставим после очистки:
 * DOMPurify атрибут `id` не пропускает. Документ без заголовков (правила —
 * простой текст) оглавления не получает, но ищется целиком.
 */
export function outlineDocument(
  html: string,
  doc: HelpDocKind,
  docTitle: string,
): { html: string; toc: HelpTocEntry[]; sections: HelpDocSection[] } {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  const toc: HelpTocEntry[] = [];
  const sections: HelpDocSection[] = [];
  let current: { section: HelpDocSection; parts: string[] } | null = null;
  const flush = () => {
    if (current) sections.push({ ...current.section, text: plainText(current.parts.join(' ')) });
  };

  for (const node of Array.from(body.childNodes)) {
    if (node instanceof HTMLElement && HEADINGS.has(node.tagName)) {
      flush();
      const id = `sec-${toc.length + 1}`;
      const title = (node.textContent ?? '').trim();
      node.id = id;
      toc.push({ id, title, level: Number(node.tagName[1]) });
      current = { section: { doc, docTitle, id, title, text: '' }, parts: [] };
      continue;
    }
    current?.parts.push(node instanceof HTMLElement ? node.outerHTML : (node.textContent ?? ''));
  }
  flush();

  if (toc.length === 0) {
    sections.push({ doc, docTitle, id: '', title: docTitle, text: plainText(html) });
  }
  return { html: body.innerHTML, toc, sections };
}
