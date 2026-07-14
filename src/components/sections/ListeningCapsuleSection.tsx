import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { usePlanetChapterState } from "./PlanetWorldJourneySection";

export function ListeningCapsuleSection() {
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const anchoredState = usePlanetChapterState("listening");
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const headingY = useTransform(scrollYProgress, [0, 0.24, 0.76, 1], reducedMotion ? [0, 0, 0, 0] : [24, 0, -8, -24]);
  const headingOpacity = useTransform(scrollYProgress, [0, 0.14, 0.82, 1], [0, 1, 1, 0]);
  const signalWidth = useTransform(scrollYProgress, [0.08, 0.34], ["0%", "100%"]);

  return (
    <section
      ref={ref}
      id="listening-capsule"
      className="world-chapter world-chapter--listening"
      aria-labelledby="listening-capsule-title"
    >
      <div className="world-chapter__sticky">
        <motion.div className="planet-anchored-discovery planet-anchored-discovery--listening" style={anchoredState}>
          <motion.header className="listening-capsule-heading" style={{ y: headingY, opacity: headingOpacity }}>
            <div className="chapter-kicker">
              <span>05</span>
              <i />
              <span>LISTENING CAPSULE</span>
            </div>
            <h2 id="listening-capsule-title" className="font-headline-md">A moment I chose to keep</h2>
            <div className="listening-capsule-heading__signal">
              <motion.i style={{ width: signalWidth }} aria-hidden="true" />
              <span className="font-label-caps">29 SEC / USER INITIATED MEMORY</span>
            </div>
          </motion.header>
        </motion.div>
      </div>
    </section>
  );
}
