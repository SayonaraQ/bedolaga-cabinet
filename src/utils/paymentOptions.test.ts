import { expect, it } from 'vitest';
import type { PaymentMethod, PaymentMethodOption } from '../types';
import { getPreferredOptionId, sortOptionsWithSbpFirst } from './paymentOptions';

const card: PaymentMethodOption = { id: 'card', name: '💳 Карта' };
const sbp: PaymentMethodOption = { id: 'sbp', name: '🏦 СБП' };

it('ставит СБП первым и выбирает его по умолчанию, не меняя исходный порядок', () => {
  const options = [card, sbp];
  expect(sortOptionsWithSbpFirst(options)).toEqual([sbp, card]);
  expect(getPreferredOptionId(options)).toBe('sbp');
  expect(options).toEqual([card, sbp]);
});

it.each([
  { id: 'fast', name: '🏦 СБП' },
  { id: 'fast', name: 'Bank SBP' },
  { id: 'provider_SBP', name: 'Быстрый перевод' },
])('распознаёт СБП по id или имени без учёта регистра: %o', (option) => {
  const options = [card, option];
  expect(sortOptionsWithSbpFirst(options)).toEqual([option, card]);
  expect(getPreferredOptionId(options)).toBe(option.id);
});

it('без СБП сохраняет порядок и выбирает первый вариант', () => {
  const options = [card, { id: 'cash', name: 'Наличные' }];
  expect(sortOptionsWithSbpFirst(options)).toEqual(options);
  expect(getPreferredOptionId(options)).toBe('card');
});

it('сохраняет относительный порядок вариантов СБП и остальных вариантов', () => {
  const fast = { id: 'fast', name: 'СБП' };
  const cash = { id: 'cash', name: 'Наличные' };
  const options = [card, sbp, cash, fast];
  expect(sortOptionsWithSbpFirst(options)).toEqual([sbp, fast, card, cash]);
  expect(getPreferredOptionId(options)).toBe('sbp');
});

it.each([{ options: [] }, { options: null }, { options: undefined }] satisfies {
  options: PaymentMethod['options'];
}[])('возвращает пустой список и null для $options', ({ options }) => {
  expect(sortOptionsWithSbpFirst(options)).toEqual([]);
  expect(getPreferredOptionId(options)).toBeNull();
});
