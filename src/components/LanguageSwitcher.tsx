import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { infoApi } from '@/api/info';

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Кэш react-query переживает перемонтирование AppShell при смене роута:
  // локальный useState начинал каждый маунт с пустого списка, и до ответа API
  // компонент рендерил null — переключатель «мигал» при каждой навигации.
  const { data } = useQuery({
    queryKey: ['languages'],
    queryFn: infoApi.getLanguages,
    staleTime: 1000 * 60 * 5,
  });
  const availableLanguages = data?.languages ?? [];

  const currentLang = availableLanguages.find((l) => l.code === i18n.language) ||
    availableLanguages[0] || { code: 'ru', name: 'RU', flag: '🇷🇺' };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeLanguage = (code: string) => {
    // i18n.ts subscribes to languageChanged and syncs <html lang> + dir
    // centrally — no need to set documentElement.dir here.
    i18n.changeLanguage(code);
    setIsOpen(false);
  };

  if (availableLanguages.length <= 1) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Только флаг, квадрат 38 px как у соседних кнопок шапки: с кодом «RU» и
        стрелкой кнопка была вдвое шире, и в шапке телефона не помещались палитра,
        тема и колокольчик (11.11.2026). Код языка — в подсказке и списке. */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center rounded-linear-lg border p-2 transition-all ${
          isOpen
            ? 'border-dark-600 bg-dark-700'
            : 'border-dark-700/50 bg-dark-800/50 hover:border-dark-600 hover:bg-dark-700'
        }`}
        aria-label={t('common.changeLanguage')}
        aria-expanded={isOpen}
        title={currentLang.name}
      >
        <span className="flex h-5 w-5 items-center justify-center text-base leading-none">
          {currentLang.flag}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-40 animate-fade-in rounded-xl border border-dark-700/50 bg-dark-800 py-1 shadow-lg">
          {availableLanguages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                lang.code === i18n.language
                  ? 'bg-accent-500/10 text-accent-400'
                  : 'text-dark-300 hover:bg-dark-700/50'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
