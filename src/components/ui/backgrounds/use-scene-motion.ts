import { useEffect, useState } from 'react';
import { useAnimationPause } from '@/hooks/useAnimationLoop';

export function useSceneMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

export function useReducedSceneMotion(): boolean {
  return useSceneMedia('(prefers-reduced-motion: reduce)');
}

export function useScenePaused(paused: boolean): boolean {
  const inactive = useAnimationPause();
  const reducedMotion = useReducedSceneMotion();
  return paused || inactive || reducedMotion;
}
