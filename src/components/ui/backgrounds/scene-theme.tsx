import { createContext, useContext } from 'react';
import { useTheme } from '@/hooks/useTheme';

/**
 * Тема, в которой рисовать сцену фона. По умолчанию — тема кабинета, но
 * предпросмотр в админке показывает фон светлой темы, пока сам админ сидит в
 * тёмной (и наоборот), поэтому может задать её явно.
 */
export const SceneThemeContext = createContext<'light' | 'dark' | null>(null);

export function useSceneIsLight(): boolean {
  const forced = useContext(SceneThemeContext);
  const { isLight } = useTheme();
  return forced ? forced === 'light' : isLight;
}
