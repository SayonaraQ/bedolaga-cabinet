import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/primitives/Button';
import type { PaymentMethod } from '@/types';
import { sortOptionsWithSbpFirst } from '@/utils/paymentOptions';

export function methodDisplayName(method: PaymentMethod, t: TFunction): string {
  return (
    method.name ||
    t(`balance.paymentMethods.${method.id.toLowerCase().replace(/-/g, '_')}.name`, {
      defaultValue: method.id,
    })
  );
}

export function PaymentChoice({
  methods,
  method,
  onMethodChange,
  selectedOptionId,
  onOptionChange,
  disabled,
}: {
  methods: PaymentMethod[];
  method: PaymentMethod;
  onMethodChange: (id: string) => void;
  selectedOptionId: string | undefined;
  onOptionChange: (id: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      {methods.length > 1 && (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t('balance.wallet.paymentMethod')}
        >
          {methods.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant="secondary"
              aria-pressed={item.id === method.id}
              disabled={!item.is_available || disabled}
              className={
                item.id === method.id ? 'border-accent-500 bg-accent-500/10 text-accent-400' : ''
              }
              onClick={() => onMethodChange(item.id)}
            >
              {methodDisplayName(item, t)}
            </Button>
          ))}
        </div>
      )}
      {!!method.options?.length && (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t('balance.wallet.paymentOption')}
        >
          {sortOptionsWithSbpFirst(method.options).map((option) => (
            <Button
              key={option.id}
              size="sm"
              variant="secondary"
              aria-pressed={option.id === selectedOptionId}
              disabled={disabled}
              className={
                option.id === selectedOptionId
                  ? 'border-accent-500 bg-accent-500/10 text-accent-400'
                  : ''
              }
              onClick={() => onOptionChange(option.id)}
            >
              {option.name}
            </Button>
          ))}
        </div>
      )}
    </>
  );
}
