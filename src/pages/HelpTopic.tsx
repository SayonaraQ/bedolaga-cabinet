import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { PiArrowLeft } from 'react-icons/pi';
import { faqAnchorId, FaqItem } from '../components/help/FaqItem';
import { SupportBlock } from '../components/help/SupportBlock';
import { useFaqPages } from '../components/help/useHelpQueries';
import { splitFaqBranches } from '../utils/help/faqBranches';
import { groupFaqByTopic, SUPPORT_TOPIC, topicOf } from '../utils/help/topics';
import { formatContent } from '../utils/legalContent';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

/**
 * Тема справки (`/info/topic/:topic`) или конкретный ответ (`/info/faq/:id` —
 * ссылка, которую поддержка отправляет в заявке). Ответ открывается и
 * прокручивается к себе; у темы с пошаговой проверкой первый вопрос открыт.
 */
export default function HelpTopic() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { topic: topicParam, id: idParam } = useParams();
  const { data: faqPages, isLoading } = useFaqPages();
  const faq = faqPages ?? [];
  const requestedId = idParam ? Number(idParam) : null;
  const requested = requestedId !== null ? faq.find((page) => page.id === requestedId) : undefined;

  const topic = requested
    ? requested.category === SUPPORT_TOPIC
      ? SUPPORT_TOPIC
      : topicOf(requested)
    : (topicParam ?? 'other');

  const { topics, support } = useMemo(() => groupFaqByTopic(faq), [faq]);
  const pages =
    topic === SUPPORT_TOPIC ? support : (topics.find((g) => g.key === topic)?.pages ?? []);

  const [openId, setOpenId] = useState<number | null>(null);
  const [initialised, setInitialised] = useState<string | null>(null);
  const initKey = `${topic}:${requestedId ?? ''}:${pages.length}`;
  useEffect(() => {
    if (!pages.length || initialised === initKey) return;
    setInitialised(initKey);
    if (requested) {
      setOpenId(requested.id);
      return;
    }
    const first = pages[0];
    setOpenId(splitFaqBranches(formatContent(first.content)) ? first.id : null);
  }, [initKey, initialised, pages, requested]);

  useEffect(() => {
    if (!requested || openId !== requested.id) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(faqAnchorId(requested.id))?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openId, requested]);

  const title = t(`help.topics.${topic}.title`);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/info')}
          aria-label={t('help.back')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-dark-700/60 bg-dark-800/50 text-dark-100"
        >
          <PiArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold text-dark-50">{title}</h1>
          <p className="text-sm text-dark-400">{t('help.title')}</p>
        </div>
      </div>

      {isLoading ? (
        <SkeletonGroup className="space-y-2">
          <Skeleton variant="card" count={4} className="h-14" />
        </SkeletonGroup>
      ) : requestedId !== null && !requested ? (
        <p className="rounded-2xl border border-dark-700/60 bg-dark-800/40 px-4 py-6 text-center text-dark-300">
          {t('help.questionNotFound')}
        </p>
      ) : pages.length === 0 ? (
        <p className="rounded-2xl border border-dark-700/60 bg-dark-800/40 px-4 py-6 text-center text-dark-300">
          {t('help.topicNotFound')}
        </p>
      ) : (
        <div className="space-y-2">
          {pages.map((page) => (
            <FaqItem
              key={page.id}
              page={page}
              open={openId === page.id}
              onToggle={() => setOpenId((prev) => (prev === page.id ? null : page.id))}
            />
          ))}
        </div>
      )}

      {topic !== SUPPORT_TOPIC && <SupportBlock supportPages={support} />}
    </div>
  );
}
