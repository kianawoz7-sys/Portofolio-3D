import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

import { PROJECTS } from "../../data/projects";
import { ARCHIVE_CINEMATIC_LIMIT, getResponsiveArchiveScrollHeightVh } from "../../lib/archiveJourney";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { useResponsiveProfile } from "../../hooks/useResponsiveProfile";
import { useArchiveJourneyControls } from "./PlanetWorldJourneySection";

function padVaultNumber(value: number) {
  return String(value).padStart(2, "0");
}

export function ProjectsSection() {
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const { profile } = useResponsiveProfile();
  const { archiveProgressRef, archiveActiveRef } = useArchiveJourneyControls();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const cinematicProjectCount = Math.min(PROJECTS.length, ARCHIVE_CINEMATIC_LIMIT);
  const archiveHeight = getResponsiveArchiveScrollHeightVh(PROJECTS.length, profile);
  const sectionStyle = { "--archive-scroll-height": `${archiveHeight}dvh` } as CSSProperties;
  const identityY = useTransform(scrollYProgress, [0, 0.06, 0.9, 1], reducedMotion ? [0, 0, 0, 0] : [18, 0, -8, -22]);
  const identityOpacity = useTransform(scrollYProgress, [0, 0.035, 0.1, 0.16, 0.9, 0.98], [0, 1, 1, 0.38, 0.38, 0]);
  const introOpacity = useTransform(scrollYProgress, [0, 0.02, 0.075, 0.1, 0.118], [0, 1, 1, 0.42, 0]);
  const introX = useTransform(scrollYProgress, [0, 0.035, 0.085, 0.118], reducedMotion ? [0, 0, 0, 0] : [-18, 0, 0, -42]);
  const introY = useTransform(scrollYProgress, [0, 0.045, 0.09, 0.118], reducedMotion ? [0, 0, 0, 0] : [24, 0, 0, -8]);
  const introFilter = useTransform(scrollYProgress, [0, 0.03, 0.085, 0.118], reducedMotion ? ["blur(0px)", "blur(0px)", "blur(0px)", "blur(0px)"] : ["blur(7px)", "blur(0px)", "blur(0px)", "blur(6px)"]);
  const progressHeight = useTransform(scrollYProgress, [0.02, 0.97], ["0%", "100%"]);

  useEffect(() => {
    archiveProgressRef.current = scrollYProgress.get();
    return scrollYProgress.on("change", (value) => {
      archiveProgressRef.current = value;
    });
  }, [archiveProgressRef, scrollYProgress]);

  useEffect(() => {
    const section = ref.current;
    if (!section) return;

    const observer = new IntersectionObserver(([entry]) => {
      archiveActiveRef.current = entry.isIntersecting;
    }, { threshold: 0.005 });
    observer.observe(section);

    return () => {
      archiveActiveRef.current = false;
      observer.disconnect();
    };
  }, [archiveActiveRef]);

  return (
    <section
      ref={ref}
      className="world-chapter world-chapter--archive"
      id="projects"
      aria-labelledby="archive-title"
      style={sectionStyle}
    >
      <div className="world-chapter__sticky">
        <div className="planet-anchored-discovery planet-anchored-discovery--archive">
          <div className="archive-heading">
            <motion.div className="archive-heading__identity" style={{ y: identityY, opacity: identityOpacity }}>
              <div className="chapter-kicker">
                <span>04</span>
                <i />
                <span>DIGITAL ARCHIVE</span>
              </div>
              <p className="archive-heading__count font-label-caps">
                {padVaultNumber(cinematicProjectCount)} CINEMATIC VAULTS
                {PROJECTS.length > ARCHIVE_CINEMATIC_LIMIT ? ` + ${padVaultNumber(PROJECTS.length - ARCHIVE_CINEMATIC_LIMIT)} CONSTELLATION FILES` : ""}
              </p>
            </motion.div>

            <motion.h2
              id="archive-title"
              className="archive-heading__intro font-headline-md"
              style={{ opacity: introOpacity, x: introX, y: introY, filter: introFilter }}
            >
              Proyek Terpilih
            </motion.h2>
          </div>

          <div className="archive-progress" aria-hidden="true">
            <i />
            <motion.span style={{ height: progressHeight }} />
            <b>01</b>
            <b>{padVaultNumber(Math.max(PROJECTS.length, 1))}</b>
          </div>
        </div>
      </div>
    </section>
  );
}
