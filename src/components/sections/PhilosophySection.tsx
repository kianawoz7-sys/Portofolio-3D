import { useEffect, useRef } from "react";
import type { MotionValue } from "motion/react";
import { motion, useScroll, useTransform } from "motion/react";

import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { usePlanetChapterState } from "./PlanetWorldJourneySection";

interface VoidFragmentPath {
  x: number;
  y: number;
  controlX: number;
  controlY: number;
  radius: number;
  arc: number;
  delay: number;
}

const VOID_FRAGMENT_PATHS: VoidFragmentPath[] = [
  { x: 214, y: 142, controlX: 292, controlY: 94, radius: 1.8, arc: -18, delay: 0 },
  { x: 286, y: 156, controlX: 346, controlY: 102, radius: 1.1, arc: 16, delay: 0.025 },
  { x: 365, y: 139, controlX: 410, controlY: 82, radius: 1.5, arc: -14, delay: 0.05 },
  { x: 447, y: 158, controlX: 466, controlY: 98, radius: 1, arc: 12, delay: 0.015 },
  { x: 536, y: 141, controlX: 524, controlY: 90, radius: 1.9, arc: -12, delay: 0.04 },
  { x: 625, y: 157, controlX: 586, controlY: 96, radius: 1.2, arc: 15, delay: 0.065 },
  { x: 716, y: 143, controlX: 652, controlY: 100, radius: 1.6, arc: -17, delay: 0.03 },
  { x: 782, y: 156, controlX: 694, controlY: 118, radius: 1, arc: 13, delay: 0.075 },
  { x: 248, y: 246, controlX: 316, controlY: 205, radius: 1.4, arc: 20, delay: 0.055 },
  { x: 332, y: 260, controlX: 382, controlY: 210, radius: 1, arc: -16, delay: 0.01 },
  { x: 413, y: 242, controlX: 448, controlY: 196, radius: 1.7, arc: 14, delay: 0.08 },
  { x: 492, y: 259, controlX: 486, controlY: 205, radius: 1.1, arc: -12, delay: 0.035 },
  { x: 575, y: 244, controlX: 548, controlY: 198, radius: 1.6, arc: 15, delay: 0.06 },
  { x: 658, y: 259, controlX: 604, controlY: 213, radius: 1, arc: -18, delay: 0.02 },
  { x: 744, y: 245, controlX: 670, controlY: 210, radius: 1.5, arc: 16, delay: 0.085 },
  { x: 166, y: 348, controlX: 268, controlY: 324, radius: 1.1, arc: -22, delay: 0.04 },
  { x: 254, y: 366, controlX: 326, controlY: 332, radius: 1.8, arc: 19, delay: 0.07 },
  { x: 347, y: 345, controlX: 400, controlY: 318, radius: 1, arc: -16, delay: 0.015 },
  { x: 442, y: 365, controlX: 468, controlY: 322, radius: 1.6, arc: 13, delay: 0.05 },
  { x: 548, y: 346, controlX: 530, controlY: 317, radius: 1.2, arc: -14, delay: 0.08 },
  { x: 646, y: 364, controlX: 600, controlY: 329, radius: 1.7, arc: 17, delay: 0.025 },
  { x: 744, y: 347, controlX: 674, controlY: 318, radius: 1, arc: -20, delay: 0.06 },
  { x: 834, y: 363, controlX: 730, controlY: 326, radius: 1.5, arc: 18, delay: 0.035 },
];

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function VoidLetterFragment({
  progress,
  path,
  reducedMotion,
}: {
  progress: MotionValue<number>;
  path: VoidFragmentPath;
  reducedMotion: boolean;
}) {
  const localProgress = (value: number) => clamp01((value - path.delay) / Math.max(0.001, 1 - path.delay));
  const cx = useTransform(progress, (value) => {
    if (reducedMotion) return path.x;
    const raw = localProgress(value);
    const t = Math.pow(raw, 1.65);
    const inverse = 1 - t;
    const orbit = Math.sin(t * Math.PI) * path.arc * inverse;
    return inverse * inverse * path.x + 2 * inverse * t * path.controlX + t * t * 500 + orbit;
  });
  const cy = useTransform(progress, (value) => {
    if (reducedMotion) return path.y;
    const raw = localProgress(value);
    const t = Math.pow(raw, 1.65);
    const inverse = 1 - t;
    const orbit = Math.sin(t * Math.PI * 1.15) * path.arc * 0.45 * inverse;
    return inverse * inverse * path.y + 2 * inverse * t * path.controlY + t * t * 260 + orbit;
  });
  const radius = useTransform(progress, (value) => {
    const t = localProgress(value);
    const softRadius = path.radius * 1.9;
    return reducedMotion ? softRadius : softRadius * (1 - t * 0.72);
  });
  const opacity = useTransform(progress, (value) => {
    if (reducedMotion) return 0;
    const t = localProgress(value);
    if (t < 0.08) return t / 0.08 * 0.72;
    if (t < 0.72) return 0.72 - t * 0.18;
    return Math.max(0, (1 - t) / 0.28 * 0.58);
  });

  return <motion.circle cx={cx} cy={cy} r={radius} style={{ opacity }} />;
}

export function PhilosophySection() {
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const anchoredState = usePlanetChapterState("void");
  const { scrollY } = useScroll();
  const readingProgress = useTransform(scrollY, (value) => {
    const section = ref.current;
    if (!section || typeof window === "undefined") return 0;
    const sectionTop = value + section.getBoundingClientRect().top;
    const marginBottom = Number.parseFloat(window.getComputedStyle(section).marginBottom) || 0;
    const timelineHeight = Math.max(section.offsetHeight + marginBottom, section.offsetHeight * 0.67);
    return Math.min(1, Math.max(0, (value - sectionTop + window.innerHeight) / (timelineHeight + window.innerHeight)));
  });
  const exitProgress = useTransform(scrollY, (value) => {
    const section = ref.current;
    if (!section || typeof window === "undefined") return 0;
    const sectionTop = value + section.getBoundingClientRect().top;
    const pinnedDistance = Math.max(1, section.offsetHeight - window.innerHeight);
    return Math.min(1, Math.max(0, (value - sectionTop) / pinnedDistance));
  });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => scrollY.set(window.scrollY));
    return () => window.cancelAnimationFrame(frame);
  }, [scrollY]);

  const contentEntryOpacity = useTransform(readingProgress, [0.24, 0.32], [0, 1]);
  const contentExitOpacity = useTransform(exitProgress, [0.79, 0.995], [1, 0]);
  const contentOpacity = useTransform([contentEntryOpacity, contentExitOpacity], ([entry, exit]) => Number(entry) * Number(exit));
  const contentEntryY = useTransform(readingProgress, [0.24, 0.4], reducedMotion ? [0, 0] : [14, 0]);
  const contentExitY = useTransform(exitProgress, [0.79, 0.995], reducedMotion ? [0, 0] : [0, -6]);
  const contentY = useTransform([contentEntryY, contentExitY], ([entry, exit]) => Number(entry) + Number(exit));
  const contentEntryScale = useTransform(readingProgress, [0.24, 0.42], reducedMotion ? [1, 1] : [0.99, 1]);
  const contentExitScale = useTransform(exitProgress, [0.79, 0.995], reducedMotion ? [1, 1] : [1, 0.994]);
  const contentScale = useTransform([contentEntryScale, contentExitScale], ([entry, exit]) => Number(entry) * Number(exit));
  const kickerOpacity = useTransform(readingProgress, [0.27, 0.37, 0.7, 0.8], [0, 0.72, 0.72, 0]);

  const lineOneEntryOpacity = useTransform(readingProgress, [0.3, 0.4], [0, 1]);
  const lineTwoEntryOpacity = useTransform(readingProgress, [0.38, 0.48], [0, 1]);
  const lineThreeEntryOpacity = useTransform(readingProgress, [0.46, 0.56], [0, 1]);
  const lineOneExitOpacity = useTransform(exitProgress, [0.88, 0.995], [1, 0]);
  const lineTwoExitOpacity = useTransform(exitProgress, [0.9, 0.995], [1, 0]);
  const lineThreeExitOpacity = useTransform(exitProgress, [0.92, 0.998], [1, 0]);
  const lineOneOpacity = useTransform([lineOneEntryOpacity, lineOneExitOpacity], ([entry, exit]) => Number(entry) * Number(exit));
  const lineTwoOpacity = useTransform([lineTwoEntryOpacity, lineTwoExitOpacity], ([entry, exit]) => Number(entry) * Number(exit));
  const lineThreeOpacity = useTransform([lineThreeEntryOpacity, lineThreeExitOpacity], ([entry, exit]) => Number(entry) * Number(exit));

  const lineOneEntryY = useTransform(readingProgress, [0.3, 0.4], reducedMotion ? [0, 0] : [9, 0]);
  const lineTwoEntryY = useTransform(readingProgress, [0.38, 0.48], reducedMotion ? [0, 0] : [8, 0]);
  const lineThreeEntryY = useTransform(readingProgress, [0.46, 0.56], reducedMotion ? [0, 0] : [7, 0]);
  const lineOneExitY = useTransform(exitProgress, [0.82, 0.995], reducedMotion ? [0, 0] : [0, -3]);
  const lineTwoExitY = useTransform(exitProgress, [0.84, 0.995], reducedMotion ? [0, 0] : [0, -3]);
  const lineThreeExitY = useTransform(exitProgress, [0.86, 0.998], reducedMotion ? [0, 0] : [0, -3]);
  const lineOneY = useTransform([lineOneEntryY, lineOneExitY], ([entry, exit]) => Number(entry) + Number(exit));
  const lineTwoY = useTransform([lineTwoEntryY, lineTwoExitY], ([entry, exit]) => Number(entry) + Number(exit));
  const lineThreeY = useTransform([lineThreeEntryY, lineThreeExitY], ([entry, exit]) => Number(entry) + Number(exit));

  const lineOneEntryBlur = useTransform(readingProgress, [0.3, 0.4], reducedMotion ? [0, 0] : [8, 0]);
  const lineTwoEntryBlur = useTransform(readingProgress, [0.38, 0.48], reducedMotion ? [0, 0] : [8, 0]);
  const lineThreeEntryBlur = useTransform(readingProgress, [0.46, 0.56], reducedMotion ? [0, 0] : [8, 0]);
  const lineOneExitBlur = useTransform(exitProgress, [0.86, 0.995], reducedMotion ? [0, 0] : [0, 4]);
  const lineTwoExitBlur = useTransform(exitProgress, [0.88, 0.995], reducedMotion ? [0, 0] : [0, 4]);
  const lineThreeExitBlur = useTransform(exitProgress, [0.9, 0.998], reducedMotion ? [0, 0] : [0, 4]);
  const lineOneBlur = useTransform([lineOneEntryBlur, lineOneExitBlur], ([entry, exit]) => `blur(${Number(entry) + Number(exit)}px)`);
  const lineTwoBlur = useTransform([lineTwoEntryBlur, lineTwoExitBlur], ([entry, exit]) => `blur(${Number(entry) + Number(exit)}px)`);
  const lineThreeBlur = useTransform([lineThreeEntryBlur, lineThreeExitBlur], ([entry, exit]) => `blur(${Number(entry) + Number(exit)}px)`);

  const fragmentProgress = useTransform(exitProgress, [0.74, 0.995], [0, 1]);
  const handoffOpacity = useTransform(exitProgress, [0.74, 0.82, 0.985, 1], [0, 1, 1, 0.45]);
  const handoffScale = useTransform(exitProgress, [0.74, 0.84, 0.965, 1], reducedMotion ? [1, 1, 1, 1] : [0.28, 1, 1.36, 0.92]);

  return (
    <section ref={ref} className="world-chapter world-chapter--void" id="philosophy" aria-labelledby="void-title">
      <div className="world-chapter__sticky">
        <motion.div className="planet-anchored-discovery planet-anchored-discovery--void" style={anchoredState}>
          <div className="void-thought">
            <motion.div className="void-thought__content" style={{ y: contentY, scale: contentScale, opacity: contentOpacity }}>
              <motion.div className="chapter-kicker chapter-kicker--center chapter-kicker--quiet" style={{ opacity: kickerOpacity }}>
                <span>06</span>
                <i />
                <span>VOID THOUGHT</span>
              </motion.div>
              <h2 id="void-title" className="font-headline-md">
                <span className="void-thought__line void-thought__line--near">
                  <motion.span className="void-thought__line-copy" style={{ y: lineOneY, opacity: lineOneOpacity, filter: lineOneBlur }}>
                    Interface is what they see.
                  </motion.span>
                </span>
                <span className="void-thought__line void-thought__line--neutral">
                  <motion.span className="void-thought__line-copy" style={{ y: lineTwoY, opacity: lineTwoOpacity, filter: lineTwoBlur }}>
                    Value is what they feel.
                  </motion.span>
                </span>
                <span className="void-thought__line void-thought__line--far">
                  <motion.span className="void-thought__line-copy" style={{ y: lineThreeY, opacity: lineThreeOpacity, filter: lineThreeBlur }}>
                    System is what keeps it alive.
                  </motion.span>
                </span>
              </h2>
            </motion.div>

            <svg aria-hidden="true" className="void-thought__fragments" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet">
              {VOID_FRAGMENT_PATHS.map((path, index) => (
                <VoidLetterFragment key={index} progress={fragmentProgress} path={path} reducedMotion={reducedMotion} />
              ))}
            </svg>
            <motion.div aria-hidden="true" className="void-thought__handoff-point" style={{ opacity: handoffOpacity, scale: handoffScale }}>
              <i />
              <span />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
