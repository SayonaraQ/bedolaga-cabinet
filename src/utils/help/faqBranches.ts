export interface FaqBranch {
  title: string;
  html: string;
}

/**
 * Ответ-«пошаговая проверка»: подзаголовки `<h3>` — ветки («Ничего не
 * открывается», «Подключено, но интернета нет»…). Справка показывает их
 * кнопками и одну ветку за раз; бот — те же заголовки жирным текстом.
 * Меньше двух `<h3>` — обычный ответ.
 */
export function splitFaqBranches(html: string): { intro: string; branches: FaqBranch[] } | null {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  const intro: string[] = [];
  const branches: { title: string; parts: string[] }[] = [];
  for (const node of Array.from(body.childNodes)) {
    if (node instanceof HTMLElement && node.tagName === 'H3') {
      branches.push({ title: (node.textContent ?? '').trim(), parts: [] });
      continue;
    }
    const markup = node instanceof HTMLElement ? node.outerHTML : (node.textContent ?? '');
    (branches.at(-1)?.parts ?? intro).push(markup);
  }
  if (branches.length < 2) return null;
  return {
    intro: intro.join('').trim(),
    branches: branches.map((b) => ({ title: b.title, html: b.parts.join('').trim() })),
  };
}
