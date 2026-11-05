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
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Части собираем узлами и сериализуем браузером: textContent текстового узла
  // уже раскодирован, и «&lt;b&gt;» превратился бы в разметку.
  const intro = doc.createElement('div');
  const branches: { title: string; body: HTMLElement }[] = [];
  for (const node of Array.from(doc.body.childNodes)) {
    if (node instanceof HTMLElement && node.tagName === 'H3') {
      branches.push({ title: (node.textContent ?? '').trim(), body: doc.createElement('div') });
      continue;
    }
    (branches[branches.length - 1]?.body ?? intro).appendChild(node);
  }
  if (branches.length < 2) return null;
  return {
    intro: intro.innerHTML.trim(),
    branches: branches.map((b) => ({ title: b.title, html: b.body.innerHTML.trim() })),
  };
}
