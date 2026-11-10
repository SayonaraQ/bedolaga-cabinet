import { useTranslation } from 'react-i18next';
import { PaletteIcon } from '@/components/icons';
import { useTheme } from '@/hooks/useTheme';
import { useHaptic } from '@/platform';
import { seasonFor } from '@/theme/appearance';
import { cn } from '@/lib/utils';

export function SeasonalThemeButton({ onToggle }: { onToggle?: () => void }) {
  const { t } = useTranslation();
  const { seasonalAvailable, seasonalActive, season, toggleSeasonal } = useTheme();
  const haptic = useHaptic();
  if (!seasonalAvailable) return null;
  const label = t('theme.seasonal');
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={seasonalActive}
      title={`${label} · ${t(`theme.seasons.${season ?? seasonFor(new Date())}`)}`}
      onClick={() => {
        haptic.impact('light');
        toggleSeasonal();
        onToggle?.();
      }}
      className={cn(
        'relative rounded-linear-lg border p-2 transition-colors duration-200',
        seasonalActive
          ? 'border-accent-400/40 bg-accent-500/15 text-accent-400 ring-1 ring-accent-400/30'
          : 'border-dark-700/50 bg-dark-800/50 text-dark-400 hover:bg-dark-700 hover:text-accent-400',
      )}
    >
      <PaletteIcon className="h-5 w-5" />
      {seasonalActive && (
        <span
          aria-hidden="true"
          className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: 'var(--nc-glint)' }}
        />
      )}
    </button>
  );
}
