import { expect, it } from 'vitest';
import ru from './ru.json';

// Клиенту пишем «заявка», а не «тикет»/«обращение»: «Новый тикет» не читался
// как «написать в поддержку», и люди уходили в личку Telegram. Админка не в счёт.
type Tree = { [key: string]: Tree | string };

function strings(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [[path, value] as [string, string]] : strings(value, path);
  });
}

it('names the support action «Создать заявку»', () => {
  expect(ru.support.newTicket).toBe('Создать заявку');
});

it.each(['support', 'notifications', 'apiErrors'])(
  'uses «заявка» instead of «тикет»/«обращение» in %s',
  (section) => {
    const offenders = strings((ru as unknown as Tree)[section] as Tree).filter(([, text]) =>
      /тикет|обращени/i.test(text),
    );
    expect(offenders).toEqual([]);
  },
);
