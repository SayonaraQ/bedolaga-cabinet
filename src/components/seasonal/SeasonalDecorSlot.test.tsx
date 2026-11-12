// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Season } from '@/theme/appearance';
import { SeasonalDecorSlot } from './SeasonalDecorSlot';

const theme = vi.hoisted(() => ({
  season: null as Season | null,
  seasonalActive: false,
  isLight: false,
}));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => theme }));
afterEach(cleanup);

// Art and inline positioning styles copied from the mockup's DECOR table.
const expected = {
  winter: {
    corner: [
      ['SnowCap', 'left:10px;top:-17px;width:min(171px,48cqw);height:28px'],
      ['Snowman', 'right:-2px;top:-66px;width:min(76px,22cqw);height:82px'],
    ],
    connect: [['SnowRight', 'right:6px;top:-17px;width:min(158px,55cqw);height:25px']],
    renew: [['SnowFull', 'left:4px;right:4px;top:-18px;height:25px']],
  },
  spring: {
    corner: [['GardenBed', 'right:0;top:-83px;width:min(100px,29cqw);height:96px']],
    connect: [['GardenTulip', 'right:3px;top:-16px;width:34px;height:42px']],
    renew: [['GardenDaffodil', 'left:-8px;top:-20px;width:41px;height:42px']],
  },
  summer: {
    corner: [
      ['Beach', 'left:9px;top:-17px;width:min(142px,40cqw);height:27px'],
      ['Palm', 'right:-10px;top:-47px;width:min(81px,24cqw);height:62px'],
    ],
    connect: [['Shell', 'right:5px;top:-24px;width:46px;height:32px']],
    renew: [['Wave', 'left:4px;right:4px;top:-19px;height:29px']],
  },
  autumn: {
    corner: [['MapleCluster', 'right:-4px;top:-44px;width:min(84px,25cqw);height:64px']],
    connect: [['LeafDrift', 'right:6px;top:-17px;width:min(198px,56cqw);height:30px']],
    renew: [['LeafRow', 'left:6px;top:-13px;width:64px;height:24px']],
  },
};
const slots = ['corner', 'connect', 'renew'] as const;
const seasons = ['winter', 'spring', 'summer', 'autumn'] as const;

it.each(['dark', 'light'])('adds no markup for the %s base appearance', (base) => {
  Object.assign(theme, { season: null, seasonalActive: false, isLight: base === 'light' });
  const { container } = render(
    slots.map((slot) => (
      <SeasonalDecorSlot key={slot} slot={slot}>
        <button type="button">{slot}</button>
      </SeasonalDecorSlot>
    )),
  );
  expect([...container.children].map((child) => child.tagName)).toEqual([
    'BUTTON',
    'BUTTON',
    'BUTTON',
  ]);
  expect(container.querySelector('[aria-hidden]')).toBeNull();
});

it.each(slots)('off renders %s children unchanged even in a seasonal theme', (slot) => {
  Object.assign(theme, { season: 'autumn', seasonalActive: true, isLight: false });
  const { container } = render(
    <SeasonalDecorSlot slot={slot} off>
      <button type="button">Action</button>
    </SeasonalDecorSlot>,
  );
  expect(container.innerHTML).toBe('<button type="button">Action</button>');
  expect(container.querySelector('[data-seasonal-slot]')).toBeNull();
});

for (const season of seasons) {
  for (const slot of slots) {
    it.each([false, true])(
      `renders ${season} ${slot}, day=%s, at the reference positions`,
      (day) => {
        Object.assign(theme, { season, seasonalActive: true, isLight: day });
        const onClick = vi.fn();
        const { container } = render(
          <SeasonalDecorSlot slot={slot}>
            <button type="button" onClick={onClick}>
              Action
            </button>
          </SeasonalDecorSlot>,
        );
        const wrapper = container.firstElementChild;
        expect(wrapper?.getAttribute('data-seasonal-slot')).toBe(slot);
        const layer = wrapper?.lastElementChild;
        expect(layer?.getAttribute('aria-hidden')).toBe('true');
        expect(layer?.classList.contains('pointer-events-none')).toBe(true);
        expect(layer?.classList.contains('seasonal-decor-day')).toBe(day);
        expect(layer?.className).toContain('z-[6]');
        const pieces = [...(layer?.children ?? [])];
        expect(
          pieces.map((piece) => piece.firstElementChild?.getAttribute('data-seasonal-art')),
        ).toEqual(expected[season][slot].map(([name]) => name));
        for (const [index, [, css]] of expected[season][slot].entries()) {
          const reference = document.createElement('div');
          reference.style.cssText = css;
          expect((pieces[index] as HTMLElement).style.cssText).toBe(reference.style.cssText);
        }
        fireEvent.click(screen.getByRole('button', { name: 'Action' }));
        expect(onClick).toHaveBeenCalledOnce();
      },
    );
  }
}

for (const season of ['winter', 'spring', 'summer'] as const) {
  it.each(slots)(`keeps gradients local to each of two ${season} %s instances`, (slot) => {
    Object.assign(theme, { season, seasonalActive: true, isLight: false });
    const { container } = render(
      <>
        <SeasonalDecorSlot slot={slot}>
          <button type="button">One</button>
        </SeasonalDecorSlot>
        <SeasonalDecorSlot slot={slot}>
          <button type="button">Two</button>
        </SeasonalDecorSlot>
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((node) => node.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const svg of container.querySelectorAll('svg')) {
      const localIds = [...svg.querySelectorAll('[id]')].map((node) => node.id);
      for (const node of svg.querySelectorAll('[fill^="url("]')) {
        expect(localIds).toContain(node.getAttribute('fill')?.slice(5, -1));
      }
    }
  });
}

it('updates the decor when the resolved season changes and removes it when switched off', () => {
  Object.assign(theme, { season: 'winter', seasonalActive: true, isLight: false });
  const child = <button type="button">Action</button>;
  const { container, rerender } = render(
    <SeasonalDecorSlot slot="corner">{child}</SeasonalDecorSlot>,
  );
  expect(container.querySelector('[data-seasonal-art="Snowman"]')).toBeTruthy();
  theme.season = 'spring';
  rerender(<SeasonalDecorSlot slot="corner">{child}</SeasonalDecorSlot>);
  expect(container.querySelector('[data-seasonal-art="Snowman"]')).toBeNull();
  expect(container.querySelector('[data-seasonal-art="GardenBed"]')).toBeTruthy();
  Object.assign(theme, { season: null, seasonalActive: false });
  rerender(<SeasonalDecorSlot slot="corner">{child}</SeasonalDecorSlot>);
  expect(container.innerHTML).toBe('<button type="button">Action</button>');
});
