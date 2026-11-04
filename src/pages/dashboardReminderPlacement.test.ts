import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

// Карточки-напоминания («Подключите Telegram», «Добавьте почту») стоят сразу под
// карточкой подписки. Внизу главной, после статистики и колеса, на телефоне их
// не видели — а ради них и заводили напоминания о втором способе входа.
const source = readFileSync(resolve(__dirname, 'Dashboard.tsx'), 'utf-8');

it('renders reminder cards right after the subscription block', () => {
  const reminders = source.indexOf('<ReminderCards />');
  expect(reminders).toBeGreaterThan(-1);
  expect(source.indexOf('<SubscriptionCardActive')).toBeLessThan(reminders);
  expect(reminders).toBeLessThan(source.indexOf('<PromoOffersSection />'));
  expect(reminders).toBeLessThan(source.indexOf('<StatsGrid'));
});
