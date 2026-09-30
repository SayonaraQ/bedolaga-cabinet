import { useState, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeIcon, EyeSlashIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * Поле пароля с кнопкой «показать / скрыть».
 *
 * Без неё человек вводит пароль вслепую: при привязке почты ошибка на сервере
 * выглядела как «не тот пароль», и пользователи перебирали пароли, не видя, что
 * набирают. Показ — только по нажатию и только в этом поле: у «Подтвердите пароль»
 * своя кнопка, чтобы открытый пароль не появлялся там, где его не просили.
 */
export function PasswordInput({ className, disabled, ...props }: PasswordInputProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const label = visible ? t('auth.hidePassword') : t('auth.showPassword');

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        className={cn('input pr-11', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-dark-400 transition-colors hover:text-dark-200 disabled:opacity-50"
      >
        {visible ? <EyeSlashIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
