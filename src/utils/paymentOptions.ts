import type { PaymentMethod, PaymentMethodOption } from '../types';

function isSbpOption(option: PaymentMethodOption): boolean {
  const normalizedId = option.id.toLowerCase();
  const normalizedName = option.name.toLowerCase();
  return (
    normalizedId.includes('sbp') || normalizedName.includes('сбп') || normalizedName.includes('sbp')
  );
}

export function getPreferredOptionId(options?: PaymentMethod['options']): string | null {
  if (!options || options.length === 0) return null;

  const sbpOption = options.find(isSbpOption);

  return sbpOption?.id ?? options[0].id;
}

export function sortOptionsWithSbpFirst(options?: PaymentMethod['options']): PaymentMethodOption[] {
  if (!options || options.length <= 1) return options ?? [];

  return [...options].sort((left, right) => {
    const leftIsPreferred = isSbpOption(left);
    const rightIsPreferred = isSbpOption(right);

    if (leftIsPreferred === rightIsPreferred) return 0;
    return leftIsPreferred ? -1 : 1;
  });
}
