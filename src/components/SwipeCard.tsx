import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import type { BizdexTopic, ColumnMapping, CsvRow, EnrichmentRecord } from '../types';
import { buildCardModel } from '../lib/cardFields';

export interface SwipeCardHandle {
  swipe: (direction: 'left' | 'right' | 'down') => void;
}

interface Props {
  row: CsvRow;
  mapping: ColumnMapping;
  headers: string[];
  enrichment?: EnrichmentRecord;
  isTop: boolean;
  stackIndex: number;
  onSwiped: (direction: 'left' | 'right' | 'down') => void;
}

const SWIPE_THRESHOLD = 110;
const VELOCITY_THRESHOLD = 500;
const MAX_STACK_VISIBLE = 3;

export const SwipeCard = forwardRef<SwipeCardHandle, Props>(function SwipeCard(
  { row, mapping, headers, enrichment, isTop, stackIndex, onSwiped },
  ref,
) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-320, 320], [-18, 18]);
  const likeOpacity = useTransform(x, [10, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-120, -10], [1, 0]);
  const isLeaving = useRef(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useImperativeHandle(ref, () => ({
    swipe(direction: 'left' | 'right' | 'down') {
      if (isLeaving.current) return;
      isLeaving.current = true;
      if (direction === 'down') {
        void animate(y, window.innerHeight * 1.2, { duration: 0.32, ease: [0.32, 0, 0.67, 0] }).then(() => onSwiped(direction));
        return;
      }
      const target = direction === 'right' ? window.innerWidth * 1.2 : -window.innerWidth * 1.2;
      void animate(x, target, { duration: 0.32, ease: [0.32, 0, 0.67, 0] }).then(() => onSwiped(direction));
    },
  }));

  const card = buildCardModel(row, mapping, headers, enrichment);

  if (stackIndex >= MAX_STACK_VISIBLE) return null;

  const stackScale = 1 - stackIndex * 0.045;
  const stackY = stackIndex * 14;

  return (
    <motion.div
      className="no-select absolute inset-0"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        scale: isTop ? 1 : stackScale,
        y: isTop ? y : stackY,
        zIndex: MAX_STACK_VISIBLE - stackIndex,
        touchAction: isTop ? 'pan-y' : 'auto',
      }}
      initial={false}
      animate={isTop ? { scale: 1, y: 0 } : { scale: stackScale, y: stackY }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      drag={isTop ? 'x' : false}
      dragElastic={0.9}
      dragConstraints={{ left: 0, right: 0 }}
      dragTransition={{ bounceStiffness: 400, bounceDamping: 40 }}
      onDragEnd={(_e, info) => {
        if (isLeaving.current) return;
        const passedDistance = Math.abs(info.offset.x) > SWIPE_THRESHOLD;
        const passedVelocity = Math.abs(info.velocity.x) > VELOCITY_THRESHOLD;
        if (passedDistance || passedVelocity) {
          isLeaving.current = true;
          const direction = info.offset.x > 0 ? 'right' : 'left';
          const target = direction === 'right' ? window.innerWidth * 1.2 : -window.innerWidth * 1.2;
          void animate(x, target, { duration: 0.28, ease: [0.32, 0, 0.67, 0] }).then(() => onSwiped(direction));
        } else {
          animate(x, 0, { type: 'spring', stiffness: 400, damping: 32 });
        }
      }}
    >
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-2xl shadow-black/40">
        {isTop && (
          <>
            <motion.div
              style={{ opacity: likeOpacity }}
              className="pointer-events-none absolute left-5 top-6 z-10 -rotate-12 rounded-lg border-4 border-[color:var(--color-approve)] px-3 py-1 text-2xl font-extrabold tracking-wider text-[color:var(--color-approve)]"
            >
              GOED
            </motion.div>
            <motion.div
              style={{ opacity: nopeOpacity }}
              className="pointer-events-none absolute right-5 top-6 z-10 rotate-12 rounded-lg border-4 border-[color:var(--color-reject)] px-3 py-1 text-2xl font-extrabold tracking-wider text-[color:var(--color-reject)]"
            >
              NIET GOED
            </motion.div>
          </>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-8">
          {card.avatarUrl && !avatarFailed ? (
            <img
              src={card.avatarUrl}
              onError={() => setAvatarFailed(true)}
              alt=""
              className="mb-4 h-24 w-24 shrink-0 rounded-full object-cover shadow-lg ring-2 ring-[color:var(--color-border)]"
            />
          ) : (
            <div className="mb-4 flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--color-accent)] to-[color:var(--color-accent-strong)] text-2xl font-bold text-white shadow-lg ring-2 ring-[color:var(--color-border)]">
              {card.initials}
            </div>
          )}

          <h2 className="text-[26px] font-semibold leading-tight text-[color:var(--color-text)]">{card.name}</h2>

          {(card.title || card.company) && (
            <p className="mt-1 text-[16px] text-[color:var(--color-text-muted)]">
              {card.title}
              {card.title && card.company ? ' bij ' : ''}
              {card.company}
            </p>
          )}

          {card.headline && (
            <p className="mt-1.5 text-[15px] font-medium leading-snug text-[color:var(--color-text-muted)]">{card.headline}</p>
          )}

          {(card.industry || card.companySize) && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-[color:var(--color-accent)]/10 px-3 py-2">
              <svg width="16" height="16" viewBox="0 0 24 24" className="mt-0.5 shrink-0 text-[color:var(--color-accent)]">
                <path d="M3 21h18M6 21V9l6-4 6 4v12M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
              </svg>
              <p className="text-[13px] font-semibold leading-snug text-[color:var(--color-accent)]">
                {card.industry}
                {card.industry && card.companySize ? ' · ' : ''}
                {card.companySize}
              </p>
            </div>
          )}

          {card.location && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge label={card.location} icon="location" />
            </div>
          )}

          {card.notes && (
            <div className="mt-4 rounded-2xl bg-[color:var(--color-surface-raised)] p-4">
              <p className="text-[13px] font-medium uppercase tracking-wide text-[color:var(--color-text-faint)]">Notities</p>
              <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-[color:var(--color-text-muted)]">{card.notes}</p>
            </div>
          )}

          {card.bio && (
            <p className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed text-[color:var(--color-text-muted)]">{card.bio}</p>
          )}

          {(card.supply?.length || card.demand?.length) ? (
            <div className="mt-4 space-y-2">
              {card.supply && card.supply.length > 0 && <TopicRow label="Biedt" topics={card.supply} />}
              {card.demand && card.demand.length > 0 && <TopicRow label="Zoekt" topics={card.demand} />}
            </div>
          ) : null}

          <div className="mt-auto pt-5">
            {card.linkedinUrl && (
              <a
                href={card.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                onPointerDown={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-raised)] px-3.5 py-2 text-sm font-medium text-[color:var(--color-text)] transition-colors hover:border-[color:var(--color-accent)]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.44-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.59 0 4.26 2.37 4.26 5.45v6.29zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.11 20.45H3.56V9h3.55v11.45z" />
                </svg>
                LinkedIn
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

function TopicRow({ label, topics }: { label: string; topics: BizdexTopic[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="font-medium text-[color:var(--color-text-faint)]">{label}:</span>
      {topics.slice(0, 3).map((topic) => (
        <span
          key={topic.title}
          title={topic.description}
          className="rounded-full bg-[color:var(--color-accent)]/10 px-2.5 py-1 font-medium text-[color:var(--color-accent)]"
        >
          {topic.title}
        </span>
      ))}
    </div>
  );
}

function Badge({ label, icon }: { label: string; icon: 'location' | 'industry' | 'size' }) {
  const icons: Record<typeof icon, React.ReactNode> = {
    location: (
      <path
        d="M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
    ),
    industry: <path d="M3 21h18M6 21V9l6-4 6 4v12M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />,
    size: (
      <path
        d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-2a3.5 3.5 0 0 0-2.5-3.36M15.5 3.13a3.5 3.5 0 0 1 0 6.75"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    ),
  };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-surface-raised)] px-3 py-1.5 text-[13px] text-[color:var(--color-text-muted)]">
      <svg width="14" height="14" viewBox="0 0 24 24">
        {icons[icon]}
      </svg>
      {label}
    </span>
  );
}
