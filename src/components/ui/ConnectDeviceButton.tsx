import type { ButtonHTMLAttributes } from 'react';
import { useAnimationPause } from '@/hooks/useAnimationLoop';
import { cn } from '@/lib/utils';

interface ConnectDeviceButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

/** Shared contour for the home action and the subscription device tile. */
export function ConnectDeviceButton({
  children,
  className,
  disabled = false,
  loading = false,
  type = 'button',
  ...props
}: ConnectDeviceButtonProps) {
  const paused = useAnimationPause();
  // Loading only stops the glint: dimming the action on every page load would flicker.

  return (
    <button
      {...props}
      type={type}
      className={cn('connect-device-contour', className)}
      disabled={disabled}
      aria-busy={loading || undefined}
      data-paused={paused || disabled || loading}
    >
      {children}
    </button>
  );
}
