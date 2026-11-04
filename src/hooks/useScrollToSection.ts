import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/**
 * Прокрутить к блоку страницы, названному в hash ссылки (`/subscriptions/42#devices`).
 *
 * `ready` — когда содержимое выше блока уже загружено: прокрутка раньше
 * промахнётся, потому что блок съедет вниз, когда догрузится то, что над ним.
 * Срабатывает один раз за открытие страницы, дальше скролл — забота человека.
 */
export function useScrollToSection(id: string, ready: boolean): void {
  const { hash } = useLocation();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !ready || hash !== `#${id}`) return;
    const element = document.getElementById(id);
    if (!element) return;
    done.current = true;
    requestAnimationFrame(() => element.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  }, [hash, id, ready]);
}
