import { motion, useMotionValue, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';

interface Props {
  /** Drag offset of the top card. Swiping left lights up the X, right lights up the check. */
  x?: MotionValue<number>;
}

const RESTING = 0.18;
const LIT = 0.65;

export function SwipeBackdrop({ x }: Props) {
  const idle = useMotionValue(0);
  const drag = x ?? idle;

  const rejectOpacity = useTransform(drag, [-180, -20, 0], [LIT, RESTING, RESTING]);
  const approveOpacity = useTransform(drag, [0, 20, 180], [RESTING, RESTING, LIT]);
  const rejectScale = useTransform(drag, [-180, 0], [1.12, 1]);
  const approveScale = useTransform(drag, [0, 180], [1, 1.12]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      <motion.svg
        className="absolute -left-16 top-[8%] blur-2xl md:-left-10"
        style={{ opacity: rejectOpacity, scale: rejectScale }}
        width="480"
        height="480"
        viewBox="0 0 200 200"
        fill="none"
      >
        <line x1="35" y1="35" x2="165" y2="165" stroke="var(--color-reject)" strokeWidth="24" strokeLinecap="round" />
        <line x1="165" y1="35" x2="35" y2="165" stroke="var(--color-reject)" strokeWidth="24" strokeLinecap="round" />
      </motion.svg>
      <motion.svg
        className="absolute -right-14 bottom-[10%] blur-2xl md:-right-8"
        style={{ opacity: approveOpacity, scale: approveScale }}
        width="460"
        height="420"
        viewBox="0 0 200 200"
        fill="none"
      >
        <path d="M40 108 L82 152 L166 52" stroke="var(--color-approve)" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
      </motion.svg>
    </div>
  );
}
