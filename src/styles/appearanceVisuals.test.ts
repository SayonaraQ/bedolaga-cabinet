import { readFileSync } from 'node:fs';
import postcss, { type Rule } from 'postcss';
import { expect, it } from 'vitest';
import { getGlassColors } from '../utils/glassTheme';

const stylesheet = postcss.parse(readFileSync(new URL('./globals.css', import.meta.url), 'utf8'));

function rules(selector: string, inMedia = false): Rule[] {
  const found: Rule[] = [];
  stylesheet.walkRules((candidate) => {
    const media = candidate.parent?.type === 'atrule' && candidate.parent.name === 'media';
    if (candidate.selectors.includes(selector) && media === inMedia) found.push(candidate);
  });
  if (found.length === 0) throw new Error(`Missing CSS rule: ${selector}`);
  return found;
}

function rule(selector: string, inMedia = false): Rule {
  const found = rules(selector, inMedia);
  return found[found.length - 1];
}

function declarations(selector: string, inMedia = false): Record<string, string> {
  const values: Record<string, string> = {};
  for (const match of rules(selector, inMedia)) {
    match.walkDecls((declaration) => {
      values[declaration.prop] = declaration.value;
    });
  }
  return values;
}

it('gives every shared bento surface the same dark glass as the glass tokens', () => {
  const glass = getGlassColors(true);
  for (const selector of ['.dark .bento-card', '.dark .card', '.dark .bento-surface']) {
    const values = declarations(selector);
    expect(values.background.replace(/\s+/g, '')).toBe(glass.cardBg.replace(/\s+/g, ''));
    expect(values['border-color']).toBe(glass.cardBorder);
  }
});

it('adds the top highlight through card classes with no interactive overlay', () => {
  for (const selector of ['.glass-card', '.bento-card', '.card']) {
    expect(declarations(selector).position).toBe('relative');
  }
  for (const selector of [
    '.dark .glass-card::before',
    '.dark .bento-card::before',
    '.dark .card::before',
    '.dark .bento-surface::before',
  ]) {
    expect(declarations(selector)).toMatchObject({
      top: '0',
      left: '14%',
      right: '14%',
      height: '1px',
      'pointer-events': 'none',
    });
  }
});

it('keeps secondary subscription actions neutral in dark and light themes', () => {
  expect(declarations('.subscription-action-neutral')).toMatchObject({
    border: '1px solid rgba(var(--color-dark-50), 0.14)',
    background: 'rgba(var(--color-dark-50), 0.05)',
    color: 'rgb(var(--color-dark-100))',
  });
  expect(declarations('.light .subscription-action-neutral')).toMatchObject({
    'border-color': 'rgba(var(--color-dark-50), 0.16)',
    background: 'rgba(var(--color-dark-50), 0.04)',
    color: 'rgb(var(--color-dark-50))',
  });
});

it('defines info fallbacks and accent-based primary buttons for light mode', () => {
  expect(declarations(':root')['--color-info']).toBe('125, 211, 252');
  expect(declarations('.light')['--color-info']).toBe('2, 132, 199');
  const primary = rule('.light .btn-primary').toString();
  for (const token of [
    'bg-accent-600',
    'text-white',
    'hover:bg-accent-500',
    'active:bg-accent-700',
    'focus-visible:ring-accent-500',
  ]) {
    expect(primary).toContain(token);
  }
});

it('rotates the contour via transform and uses the resolved appearance fill and glint', () => {
  expect(declarations('.connect-device-contour')).toMatchObject({
    position: 'relative',
    isolation: 'isolate',
    overflow: 'hidden',
    color: 'rgb(var(--color-dark-50))',
    'box-shadow': '0 0 21px rgba(var(--color-accent-500), 0.24)',
  });
  const ring = declarations('.connect-device-contour::before');
  expect(ring.background).toContain('var(--nc-glint) 316deg');
  expect(ring.animation).toBe('connect-device-rotate 4.8s linear infinite');
  expect(declarations('.connect-device-contour::after')).toMatchObject({
    inset: '1.5px',
    background: 'linear-gradient(135deg, var(--nc-cta-a), var(--nc-cta-b))',
  });
  let rotation = '';
  stylesheet.walkAtRules('keyframes', (keyframes) => {
    if (keyframes.params === 'connect-device-rotate') rotation = keyframes.toString();
  });
  expect(rotation).toContain('transform: translate(-50%, -50%) rotate(360deg)');
  expect(declarations('.connect-device-contour:focus-visible').outline).toContain(
    '--color-accent-500',
  );
});

it('pauses disabled/inactive contours and removes rotation for reduced motion', () => {
  for (const selector of [
    '.connect-device-contour[data-paused="true"]::before',
    '.connect-device-contour:disabled::before',
  ]) {
    expect(declarations(selector)['animation-play-state']).toBe('paused');
  }
  const reduced = rule('.connect-device-contour::before', true);
  expect(reduced.parent?.type).toBe('atrule');
  expect(reduced.parent?.toString()).toContain('(prefers-reduced-motion: reduce)');
  expect(declarations('.connect-device-contour::before', true).animation).toBe('none');
});
