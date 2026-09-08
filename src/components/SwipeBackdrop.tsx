import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';

interface Props {
  /** Drag offset of the top card. Swiping left lights up the X, right lights up the check. */
  x?: MotionValue<number>;
}

const RESTING = 0.18;
const LIT = 0.7;
const RANGE = 200;

export function SwipeBackdrop({ x }: Props) {
  const idle = useMotionValue(0);
  const drag = x ?? idle;

  // Clamp first so a card flying off-screen doesn't overshoot into a long
  // fade, then spring so the glow eases in and lingers on the way out
  // instead of snapping back the moment the card is released.
  const clamped = useTransform(drag, (v) => Math.max(-RANGE, Math.min(RANGE, v)));
  const smooth = useSpring(clamped, { stiffness: 130, damping: 26, mass: 0.9, restDelta: 0.5 });

  const rejectOpacity = useTransform(smooth, [-RANGE, -25, 0], [LIT, RESTING, RESTING]);
  const approveOpacity = useTransform(smooth, [0, 25, RANGE], [RESTING, RESTING, LIT]);
  const rejectScale = useTransform(smooth, [-RANGE, 0], [1.16, 1]);
  const approveScale = useTransform(smooth, [0, RANGE], [1, 1.16]);

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
