import { transformWithOxc, type UserConfig } from 'vite';
import { describe, expect, it } from 'vitest';
import viteConfig from '../vite.config';

// Сторож цели сборки. Дефолт Vite 8 — Safari/iOS 16.4: с ним в бандле остаётся
// class static block (`static { … }`), а Safari 16.0–16.3 падает на нём
// SyntaxError ещё на разборе модуля. Весь граф ES-модулей не грузится, и
// кабинет — и мини-приложение в Telegram — показывает пустой фон из index.html.
// Так было с 30.09.2026 у клиентов на iOS 16.2.
async function buildTarget(): Promise<string | string[]> {
  const config = (await (viteConfig as (env: object) => UserConfig | Promise<UserConfig>)({
    mode: 'production',
    command: 'build',
    isSsrBuild: false,
    isPreview: false,
  })) as UserConfig;
  const target = config.build?.target;
  if (target === undefined || target === false) {
    throw new Error('build.target не задан — действует дефолт Vite (Safari 16.4+)');
  }
  return target;
}

describe('build.target', () => {
  it('покрывает iOS 16 — Telegram на iPhone работает во встроенном Safari', async () => {
    const target = await buildTarget();
    const list = Array.isArray(target) ? target : [target];
    expect(list).toContain('ios16');
    expect(list).toContain('safari16');
  });

  it('переписывает class static block, который Safari 16.2 не понимает', async () => {
    const target = await buildTarget();
    // Ровно то, что Rolldown пишет для keepNames в @radix-ui (OrderedDict).
    const src = 'const U = (f, n) => f; export class D extends Map { static { U(this, "D") } }';
    const { code } = await transformWithOxc(src, 'radix.js', {
      target: Array.isArray(target) ? target : [target],
    });
    expect(code).not.toMatch(/static\s*\{/);
  });
});
