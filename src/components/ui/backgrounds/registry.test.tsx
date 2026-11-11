// @vitest-environment jsdom
import { Suspense } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { backgroundComponents, backgroundRegistry, prefetchBackground } from './registry';

const imported = vi.hoisted(() => ({ 'liquid-light': false, halo: false, stardust: false }));
vi.mock('./liquid-light', () => {
  imported['liquid-light'] = true;
  return { default: () => <div>liquid-light loaded</div> };
});
vi.mock('./halo', () => {
  imported.halo = true;
  return { default: () => <div>halo loaded</div> };
});
vi.mock('./stardust', () => {
  imported.stardust = true;
  return { default: () => <div>stardust loaded</div> };
});
afterEach(cleanup);

it.each([
  { type: 'liquid-light', label: 'liquidLight' },
  { type: 'halo', label: 'halo' },
  { type: 'stardust', label: 'stardust' },
] as const)(
  'registers $type in the raw import map, lazy map and editor',
  async ({ type, label }) => {
    prefetchBackground(type);
    await vi.waitFor(() => expect(imported[type]).toBe(true));
    const Component = backgroundComponents[type];
    render(
      <Suspense>
        <Component settings={{}} />
      </Suspense>,
    );
    expect(await screen.findByText(`${type} loaded`)).toBeDefined();
    const definition = backgroundRegistry.find((entry) => entry.type === type);
    expect(definition).toMatchObject({
      category: 'css',
      labelKey: `admin.backgrounds.${label}`,
      descriptionKey: `admin.backgrounds.${label}Desc`,
    });
    expect(
      definition?.settings.map(({ key, type, default: value }) => ({ key, type, value })),
    ).toEqual([
      { key: 'color1', type: 'color', value: '#9333EA' },
      { key: 'color2', type: 'color', value: '#D68CFF' },
      ...(type === 'stardust' ? [] : [{ key: 'color3', type: 'color', value: '#7E22CE' }]),
      { key: 'speed', type: 'select', value: 'normal' },
    ]);
    expect(
      definition?.settings.find(({ key }) => key === 'speed')?.options?.map(({ value }) => value),
    ).toEqual(['slow', 'normal', 'fast']);
  },
);
