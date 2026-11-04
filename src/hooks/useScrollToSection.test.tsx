// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useScrollToSection } from './useScrollToSection';

// Слот устройства на главной ведёт на страницу подписки с #devices: человек
// хочет отключить устройство, а список — в самом низу страницы.

function Page({ ready }: { ready: boolean }) {
  useScrollToSection('devices', ready);
  return <div id="devices">devices</div>;
}

function renderAt(url: string, ready: boolean) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Page ready={ready} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

it('scrolls to the section named in the hash once the page is ready', async () => {
  renderAt('/subscriptions/42#devices', true);

  await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1));
});

it('waits while the content above is still loading', async () => {
  const view = renderAt('/subscriptions/42#devices', false);
  await new Promise((r) => setTimeout(r, 50));
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();

  view.rerender(
    <MemoryRouter initialEntries={['/subscriptions/42#devices']}>
      <Page ready />
    </MemoryRouter>,
  );
  await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
});

it('leaves the scroll alone without the hash', async () => {
  renderAt('/subscriptions/42', true);
  await new Promise((r) => setTimeout(r, 50));

  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
});
