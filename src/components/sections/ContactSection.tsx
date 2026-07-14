import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";

import { contactLinks } from "../../data/navLinks";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { usePlanetChapterState } from "./PlanetWorldJourneySection";

export function ContactSection() {
  const ref = useRef<HTMLElement>(null);
  const [activeSignal, setActiveSignal] = useState<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const anchoredState = usePlanetChapterState("signal");
  const { scrollY } = useScroll();
  const scrollYProgress = useTransform(scrollY, (value) => {
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

  const signalScale = useTransform(
    scrollYProgress,
    [0, 0.18, 0.38, 0.62, 1],
    reducedMotion ? [1, 1, 1, 1, 1] : [0.52, 0.78, 1, 1.06, 1],
  );
  const signalOpacity = useTransform(scrollYProgress, [0, 0.14, 0.3, 1], [0, 0.52, 1, 1]);
  const gravityOpacity = useTransform(scrollYProgress, [0, 0.12, 0.32, 1], [0, 0.64, 1, 1]);
  const gravityWellOpacity = useTransform(scrollYProgress, [0, 0.26, 0.52, 0.76, 1], [0, 0.12, 0.72, 1, 1]);
  const lowerVeilOpacity = useTransform(scrollYProgress, [0, 0.25, 0.5, 1], [0, 0, 0.9, 1]);
  const gravityScale = useTransform(
    scrollYProgress,
    [0, 0.24, 0.52, 1],
    reducedMotion ? [1, 1, 1, 1] : [0.82, 0.95, 1, 1.015],
  );
  const gravityY = useTransform(scrollYProgress, [0, 0.34, 1], reducedMotion ? [0, 0, 0] : [28, 0, -4]);
  const travellingParticleOpacity = useTransform(scrollYProgress, [0, 0.12, 0.52, 0.76, 1], [0, 0.82, 0.56, 0.12, 0.06]);
  const contentY = useTransform(
    scrollYProgress,
    [0, 0.28, 0.55, 0.86, 1],
    reducedMotion ? [0, 0, 0, 0, 0] : [36, 12, 0, -2, 0],
  );
  const labelOpacity = useTransform(scrollYProgress, [0.24, 0.3, 1], [0, 1, 1]);
  const labelY = useTransform(scrollYProgress, [0.24, 0.32], reducedMotion ? [0, 0] : [10, 0]);
  const supportOpacity = useTransform(scrollYProgress, [0.27, 0.34, 1], [0, 1, 1]);
  const headlineOpacity = useTransform(scrollYProgress, [0.31, 0.42, 1], [0, 1, 1]);
  const headlineY = useTransform(scrollYProgress, [0.31, 0.44], reducedMotion ? [0, 0] : [15, 0]);
  const copyOpacity = useTransform(scrollYProgress, [0.38, 0.48, 1], [0, 1, 1]);
  const copyY = useTransform(scrollYProgress, [0.38, 0.5], reducedMotion ? [0, 0] : [10, 0]);
  const railOpacity = useTransform(scrollYProgress, [0.45, 0.55, 1], [0, 1, 1]);
  const railY = useTransform(
    scrollYProgress,
    [0.45, 0.55, 0.94, 1],
    reducedMotion ? [0, 0, 0, 0] : [18, 0, 2, 0],
  );

  return (
    <section ref={ref} id="contact" className="world-chapter world-chapter--signal" aria-labelledby="signal-title">
      <div className="world-chapter__sticky">
        <motion.div
          className="planet-anchored-discovery planet-anchored-discovery--signal"
          data-active-signal={activeSignal ?? "idle"}
          style={anchoredState}
        >
          <div className="final-signal-haze" aria-hidden="true" />
          <motion.div className="final-signal-lower-veil" style={{ opacity: lowerVeilOpacity }} aria-hidden="true" />
          <motion.div
            className="final-signal-gravity"
            style={{ opacity: gravityOpacity, scale: gravityScale, y: gravityY }}
            aria-hidden="true"
          >
            <div className="final-signal-gravity__halo" />
            <div className="final-signal-gravity__lensing">
              <i />
              <i />
              <i />
            </div>
            <motion.div className="final-signal-gravity__well" style={{ opacity: gravityWellOpacity }}>
              <i />
            </motion.div>
            <div className="final-signal-gravity__accretion">
              <i />
              <i />
            </div>
            <i className="final-signal-gravity__rim final-signal-gravity__rim--inner" />
            <i className="final-signal-gravity__rim final-signal-gravity__rim--outer" />
            <span className="final-signal-gravity__arc final-signal-gravity__arc--cyan" />
            <span className="final-signal-gravity__arc final-signal-gravity__arc--warm" />
            <div className="final-signal-gravity__ripples">
              <i />
              <i />
              <i />
            </div>
            <motion.div className="final-signal-gravity__dust" style={{ opacity: travellingParticleOpacity }}>
              {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
            </motion.div>
            <motion.div className="final-signal-particles" style={{ opacity: travellingParticleOpacity }}>
              {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
            </motion.div>
            <motion.div className="final-signal-point" style={{ scale: signalScale, opacity: signalOpacity }}>
              <i />
              <span />
              <span />
            </motion.div>
          </motion.div>

          <motion.div className="final-signal-content" style={{ y: contentY }}>
            <motion.div className="final-signal-label" style={{ opacity: labelOpacity, y: labelY }}>
              <span className="font-label-caps">07 / FINAL SIGNAL</span>
              <i />
            </motion.div>
            <motion.p className="final-signal-support font-label-caps" style={{ opacity: supportOpacity }}>
              UJUNG PERJALANAN
            </motion.p>

            <motion.h2
              id="signal-title"
              className="font-headline-md"
              style={{ opacity: headlineOpacity, y: headlineY }}
            >
              Mari bangun sesuatu yang bermakna.
            </motion.h2>

            <motion.p className="final-signal-copy font-body-md" style={{ opacity: copyOpacity, y: copyY }}>
              Dari ide, sistem, hingga pengalaman yang terasa utuh kalau kita sefrekuensi, mari mulai sesuatu yang benar-benar hidup.
            </motion.p>

            <motion.div className="final-signal-links" style={{ opacity: railOpacity, y: railY }}>
              {contactLinks.map((link, index) => (
                <a
                  key={link.label}
                  className={`final-signal-action${index === 0 ? " final-signal-action--primary" : ""}`}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  aria-label={index === 0 ? "Kirim sinyal melalui Email" : link.label}
                  onMouseEnter={() => setActiveSignal(index)}
                  onMouseLeave={() => setActiveSignal(null)}
                  onFocus={() => setActiveSignal(index)}
                  onBlur={() => setActiveSignal(null)}
                >
                  <span className="final-signal-action__identity font-label-caps">
                    <span>0{index + 1}</span>
                    <span>{link.label}</span>
                  </span>
                  {index === 0 ? <strong className="font-label-caps">KIRIM SINYAL</strong> : null}
                </a>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
