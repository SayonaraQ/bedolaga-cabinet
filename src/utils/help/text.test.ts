// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { FaqPage } from '../../api/info';
import { splitFaqBranches } from './faqBranches';
import { outlineDocument } from './docOutline';
import { highlight, searchHelp, searchStems, type HelpDocSection } from './search';

const GUIDE =
  '<p>Сначала проверьте локации.</p>\n<h3>Ничего не открывается</h3>\n<ol><li>Обновите подписку</li></ol>\n' +
  '<h3>Приложение подключено, но интернета нет</h3>\n<p>Отключите VPN</p>\n' +
  '<h3>Не помогло</h3>\n<p>Создайте заявку</p>';

describe('splitFaqBranches', () => {
  it('splits an answer with ≥ 2 h3 into intro and branches', () => {
    const result = splitFaqBranches(GUIDE);
    expect(result?.intro).toContain('Сначала проверьте локации.');
    expect(result?.branches.map((b) => b.title)).toEqual([
      'Ничего не открывается',
      'Приложение подключено, но интернета нет',
      'Не помогло',
    ]);
    expect(result?.branches[0].html).toContain('<li>Обновите подписку</li>');
    expect(result?.branches[0].html).not.toContain('Отключите VPN');
  });

  it('keeps escaped text escaped (entities never turn into markup)', () => {
    const result = splitFaqBranches(
      'Вводная &lt;img src=x onerror=alert(1)&gt;<h3>A</h3>текст &lt;b&gt;<h3>B</h3><p>b</p>',
    );
    expect(result?.intro).toBe('Вводная &lt;img src=x onerror=alert(1)&gt;');
    expect(result?.branches[0].html).toBe('текст &lt;b&gt;');
  });

  it('returns null for a plain answer or a single heading', () => {
    expect(splitFaqBranches('<p>Просто ответ</p>')).toBeNull();
    expect(splitFaqBranches('<h3>Один</h3><p>текст</p>')).toBeNull();
  });
});

const faq = (id: number, title: string, content: string, category = 'billing'): FaqPage => ({
  id,
  title,
  content,
  order: id,
  category,
});

const FAQ = [
  faq(
    52,
    'Как докупить трафик?',
    '<p>Откройте «Подписка» и нажмите «Докупить трафик».</p>',
    'whitelist',
  ),
  faq(
    45,
    'Банк или госуслуги не работают с включённым VPN. Что делать?',
    '<ul><li>Android + INCY</li></ul>',
    'services',
  ),
  faq(58, 'Можно ли вернуть деньги?', '<p>Рассмотрим заявку, если оплата прошла дважды.</p>'),
];
const label = (p: FaqPage) => `topic:${p.category}`;
const SECTIONS: HelpDocSection[] = [
  {
    doc: 'offer',
    docTitle: 'Условия оплаты',
    id: 'sec-9',
    title: '9. Возвраты',
    text: '9.3. Можно обратиться для рассмотрения возврата, если оплата прошла.',
  },
];

describe('search', () => {
  it('stems long words, drops one-letter words and empty queries', () => {
    expect(searchStems('Оплата  банк')).toEqual(['опла', 'банк']);
    expect(searchStems('в банк')).toEqual(['банк']);
    expect(searchStems(' a ')).toEqual([]);
  });

  it('requires every word to match', () => {
    expect(searchHelp('банк возврат', FAQ, label, SECTIONS).faq).toEqual([]);
    expect(searchHelp('банк', FAQ, label, SECTIONS).faq.map((h) => h.key)).toEqual(['faq-45']);
  });

  it('links FAQ hits to the answer and doc hits to the section', () => {
    const { faq: faqHits, docs } = searchHelp('возврат', FAQ, label, SECTIONS);
    expect(faqHits).toEqual([]);
    expect(docs).toHaveLength(1);
    expect(docs[0].to).toBe('/info/doc/offer#sec-9');
    expect(docs[0].where).toBe('Условия оплаты');
    expect(searchHelp('трафик', FAQ, label, []).faq[0].to).toBe('/info/faq/52');
  });

  it('searches the topic label and gives a snippet around the match', () => {
    const hit = searchHelp('дважды', FAQ, label, []).faq[0];
    expect(hit.snippet.map((s) => s.text).join('')).toContain('дважды');
    expect(hit.snippet.some((s) => s.mark && s.text.toLowerCase() === 'дваж')).toBe(true);
    expect(searchHelp('topic:services', FAQ, label, []).faq.map((h) => h.key)).toEqual(['faq-45']);
  });

  it('finds Latin brand names typed in Russian', () => {
    const rules: HelpDocSection[] = [
      {
        doc: 'rules',
        docTitle: 'Правила',
        id: '',
        title: 'Правила',
        text: 'Запрещается скачивание torrent-файлов.',
      },
    ];
    expect(searchHelp('торрент', [], label, rules).docs).toHaveLength(1);
    const tiktok = [
      faq(13, 'Не работает TikTok/Instagram/ChatGPT/Gemini', '<p>Смените локацию</p>', 'services'),
    ];
    expect(searchHelp('тикток', tiktok, label, []).faq).toHaveLength(1);
    expect(
      searchHelp('инстаграм', tiktok, label, []).faq[0].title.some(
        (s) => s.mark && s.text === 'Instagram',
      ),
    ).toBe(true);
    expect(searchHelp('андроид', FAQ, label, []).faq.map((h) => h.key)).toEqual(['faq-45']);
  });

  it('returns nothing for a one-character query', () => {
    expect(searchHelp('б', FAQ, label, SECTIONS)).toEqual({ faq: [], docs: [] });
  });

  it('highlights the first matching stem case-insensitively', () => {
    expect(highlight('Как докупить трафик?', ['траф'])).toEqual([
      { text: 'Как докупить ', mark: false },
      { text: 'траф', mark: true },
      { text: 'ик?', mark: false },
    ]);
    expect(highlight('Нет совпадений', ['траф'])).toEqual([
      { text: 'Нет совпадений', mark: false },
    ]);
  });
});

describe('outlineDocument', () => {
  it('gives headings ids and splits the text into sections', () => {
    const out = outlineDocument(
      '<h2>9. Возвраты</h2><p>9.1. Услуга</p><h2>10. Доступность</h2><p>10.1</p>',
      'offer',
      'Условия оплаты',
    );
    expect(out.toc).toEqual([
      { id: 'sec-1', title: '9. Возвраты', level: 2 },
      { id: 'sec-2', title: '10. Доступность', level: 2 },
    ]);
    expect(out.html).toContain('id="sec-1"');
    expect(out.sections[0]).toMatchObject({ doc: 'offer', id: 'sec-1', title: '9. Возвраты' });
    expect(out.sections[0].text).toContain('9.1. Услуга');
    expect(out.sections[0].text).not.toContain('10.1');
  });

  it('has no table of contents for a document without headings but stays searchable', () => {
    const out = outlineDocument(
      '<p>Запрещается скачивать torrent-файлы.</p>',
      'rules',
      'Правила сервиса',
    );
    expect(out.toc).toEqual([]);
    expect(out.sections).toEqual([
      {
        doc: 'rules',
        docTitle: 'Правила сервиса',
        id: '',
        title: 'Правила сервиса',
        text: 'Запрещается скачивать torrent-файлы.',
      },
    ]);
  });
});
