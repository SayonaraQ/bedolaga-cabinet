import { useTranslation } from 'react-i18next';
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
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 1.8-4.2 1 1 0 0 1 .7-1.8h1a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z" />
        <circle cx="7.5" cy="10" r=".75" />
        <circle cx="10.5" cy="6.5" r=".75" />
        <circle cx="15" cy="7" r=".75" />
        <circle cx="17.5" cy="10.5" r=".75" />
      </svg>
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
