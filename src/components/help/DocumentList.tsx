import type { ComponentType } from 'react';
import { Link } from 'react-router';
import { PiCaretRight } from 'react-icons/pi';

export interface HelpDocumentRow {
  key: string;
  title: string;
  subtitle?: string;
  to: string;
  Icon: ComponentType<{ className?: string }>;
}

export function DocumentList({ title, rows }: { title: string; rows: HelpDocumentRow[] }) {
  if (!rows.length) return null;
  return (
    <section className="space-y-2.5" aria-label={title}>
      <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-dark-400">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-dark-700/60 bg-dark-800/40">
        {rows.map(({ key, title: rowTitle, subtitle, to, Icon }, index) => (
          <Link
            key={key}
            to={to}
            className={`flex min-h-[60px] items-center gap-3 px-4 py-3 hover:bg-dark-800/60 ${
              index > 0 ? 'border-t border-dark-700/50' : ''
            }`}
          >
            <Icon className="h-5 w-5 shrink-0 text-dark-400" />
            <span className="min-w-0 flex-1">
              <span className="block break-words text-[15px] font-semibold text-dark-50">
                {rowTitle}
              </span>
              {subtitle && <span className="mt-0.5 block text-xs text-dark-400">{subtitle}</span>}
            </span>
            <PiCaretRight aria-hidden className="h-4 w-4 shrink-0 text-dark-500" />
          </Link>
        ))}
      </div>
    </section>
  );
}
