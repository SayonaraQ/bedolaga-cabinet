// @vitest-environment jsdom
import { Suspense } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { backgroundComponents, backgroundRegistry, prefetchBackground } from './registry';

const imported = vi.hoisted(() => ({ liquidLight: false }));
vi.mock('./liquid-light', () => {
  imported.liquidLight = true;
  return { default: () => <div>liquid-light loaded</div> };
});
afterEach(cleanup);

it('registers liquid-light in the raw import map, lazy map and editor', async () => {
  prefetchBackground('liquid-light');
  await vi.waitFor(() => expect(imported.liquidLight).toBe(true));
  const Component = backgroundComponents['liquid-light'];
  render(
    <Suspense>
      <Component settings={{}} />
    </Suspense>,
  );
  expect(await screen.findByText('liquid-light loaded')).toBeDefined();
  const definition = backgroundRegistry.find((entry) => entry.type === 'liquid-light');
  expect(definition).toMatchObject({
    category: 'css',
    labelKey: 'admin.backgrounds.liquidLight',
    descriptionKey: 'admin.backgrounds.liquidLightDesc',
  });
  expect(
    definition?.settings.map(({ key, type, default: value }) => ({ key, type, value })),
  ).toEqual([
    { key: 'color1', type: 'color', value: '#9333EA' },
    { key: 'color2', type: 'color', value: '#D68CFF' },
    { key: 'color3', type: 'color', value: '#7E22CE' },
    { key: 'speed', type: 'select', value: 'normal' },
  ]);
  expect(
    definition?.settings.find(({ key }) => key === 'speed')?.options?.map(({ value }) => value),
  ).toEqual(['slow', 'normal', 'fast']);
});
