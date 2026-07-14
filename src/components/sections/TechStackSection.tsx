import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { usePlanetChapterState } from "./PlanetWorldJourneySection";

export function TechStackSection() {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const anchoredState = usePlanetChapterState("system");
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const sceneY = useTransform(scrollYProgress, [0, 1], reducedMotion ? [0, 0] : [26, -18]);
  const sceneOpacity = useTransform(scrollYProgress, [0, 0.12, 0.86, 1], [0, 1, 1, 0]);

  return (
    <section ref={ref} className="world-chapter world-chapter--system" id="system-core" aria-labelledby="system-title">
      <div className="world-chapter__sticky">
        <motion.div className="planet-anchored-discovery planet-anchored-discovery--system" style={anchoredState}>
          <motion.div
            className="system-core-scene system-core-scene--world-metadata"
            style={{ y: sceneY, opacity: sceneOpacity }}
          >
            <div className="system-core-metadata">
              <span id="system-title" className="font-label-caps">03 / SYSTEM CORE</span>
              <i />
              <span className="font-label-caps">CAPABILITY SYSTEM</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
