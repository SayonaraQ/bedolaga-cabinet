import type { FaqPage } from '../../api/info';

/**
 * Темы справки. Ключ хранит бот (`faq_pages.category`), подписи — кабинет.
 * Порядок плиток утверждён владельцем 05.11.2026: «Не работает» первой и с
 * акцентом, «Другое» — только если есть вопросы без темы.
 */
export type HelpTopicKey =
  | 'trouble'
  | 'connect'
  | 'services'
  | 'devices'
  | 'whitelist'
  | 'billing'
  | 'other';

export const HELP_TOPICS: readonly { key: HelpTopicKey; accent?: boolean }[] = [
  { key: 'trouble', accent: true },
  { key: 'connect' },
  { key: 'services' },
  { key: 'devices' },
  { key: 'whitelist' },
  { key: 'billing' },
  { key: 'other' },
];

/** Вопросы темы «Поддержка» живут в блоке «Не нашли ответ?», а не плиткой. */
export const SUPPORT_TOPIC = 'support';

const KNOWN = new Set<string>(HELP_TOPICS.map((t) => t.key).filter((k) => k !== 'other'));

export function topicOf(page: Pick<FaqPage, 'category'>): HelpTopicKey {
  const key = page.category ?? '';
  return KNOWN.has(key) ? (key as HelpTopicKey) : 'other';
}

export interface HelpTopicGroup {
  key: HelpTopicKey;
  pages: FaqPage[];
}

export function groupFaqByTopic(pages: FaqPage[]): {
  topics: HelpTopicGroup[];
  support: FaqPage[];
} {
  const support: FaqPage[] = [];
  const byKey = new Map<HelpTopicKey, FaqPage[]>();
  for (const page of pages) {
    if (page.category === SUPPORT_TOPIC) {
      support.push(page);
      continue;
    }
    const key = topicOf(page);
    byKey.set(key, [...(byKey.get(key) ?? []), page]);
  }
  const topics = HELP_TOPICS.flatMap(({ key }) => {
    const list = byKey.get(key);
    return list?.length ? [{ key, pages: list }] : [];
  });
  return { topics, support };
}

export function pickFaq(pages: FaqPage[], ids: readonly number[]): FaqPage[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  return ids.flatMap((id) => {
    const page = byId.get(id);
    return page ? [page] : [];
  });
}

/**
 * Вопросы, которые справка показывает отдельно. Это id в боевом FAQ (заливка
 * 05.11.2026); пропавший id просто не показывается — после отката FAQ к старым
 * 26 вопросам карточки останутся с кнопкой действия, без мёртвых ссылок.
 */
export const HELP_POPULAR_FAQ_IDS: readonly number[] = [9, 7, 13, 45, 56];
