import type { CSSProperties, RefObject } from "react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

import { PROJECTS } from "../../data/projects";
import { useResponsiveProfile } from "../../hooks/useResponsiveProfile";
import { getResponsiveArchiveScrollHeightVh } from "../../lib/archiveJourney";

const loadCosmicPOV = () => import("./CosmicPOVSection");
const loadPlanetJourney = () => import("./PlanetJourneyExperience");

const LazyCosmicPOVSection = lazy(async () => ({
  default: (await loadCosmicPOV()).CosmicPOVSection,
}));
const LazyPlanetJourney = lazy(loadPlanetJourney);

function useNearViewport(rootMargin: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [isNear, setIsNear] = useState(false);
  const activate = useCallback(() => setIsNear(true), []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setIsNear(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setIsNear(true);
      observer.disconnect();
    }, { rootMargin, threshold: 0.001 });

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, isNear, activate };
}

function CosmicPlaceholder() {
  return (
    <section
      className="cosmic-pov-section relative z-0 isolate bg-[#020716]"
      style={{ marginTop: "-1px" }}
      aria-hidden="true"
    />
  );
}

function PlanetJourneyPlaceholder() {
  const { profile } = useResponsiveProfile();
  const archiveHeight = getResponsiveArchiveScrollHeightVh(PROJECTS.length, profile);
  const archiveStyle = { "--archive-scroll-height": `${archiveHeight}dvh` } as CSSProperties;

  return (
    <section className="planet-world-journey planet-world-journey--placeholder" aria-hidden="true">
      <div className="planet-world__content">
        <div className="planet-entry-stage" />
        <section className="world-chapter world-chapter--memory planet-memory-scroll-anchor" id="about" />
        <section className="world-chapter world-chapter--system" id="system-core" />
        <section className="world-chapter world-chapter--archive" id="projects" style={archiveStyle} />
        <section className="world-chapter world-chapter--listening" id="listening-capsule" />
        <section className="world-chapter world-chapter--void" id="philosophy" />
        <section className="world-chapter world-chapter--signal" id="contact" />
        <footer className="world-footer" />
      </div>
    </section>
  );
}

function ProgressiveStage({
  stageRef,
  children,
}: {
  stageRef: RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  return <div ref={stageRef} className="progressive-journey-stage">{children}</div>;
}

export function ProgressiveJourney() {
  const cosmic = useNearViewport("0px 0px -18% 0px");
  const planet = useNearViewport("140% 0px");

  useEffect(() => {
    const warmCosmic = () => { void loadCosmicPOV(); };
    const warmForNavigation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const href = target.closest<HTMLAnchorElement>('a[href^="#"]')?.getAttribute("href");
      if (["#about", "#projects", "#philosophy", "#contact"].includes(href ?? "")) {
        planet.activate();
        void loadPlanetJourney();
      }
    };

    window.addEventListener("wheel", warmCosmic, { once: true, passive: true });
    window.addEventListener("touchstart", warmCosmic, { once: true, passive: true });
    document.addEventListener("click", warmForNavigation, { capture: true });
    return () => {
      window.removeEventListener("wheel", warmCosmic);
      window.removeEventListener("touchstart", warmCosmic);
      document.removeEventListener("click", warmForNavigation, { capture: true });
    };
  }, [planet.activate]);

  return (
    <>
      <ProgressiveStage stageRef={cosmic.ref}>
        {cosmic.isNear ? (
          <Suspense fallback={<CosmicPlaceholder />}>
            <LazyCosmicPOVSection />
          </Suspense>
        ) : <CosmicPlaceholder />}
      </ProgressiveStage>

      <ProgressiveStage stageRef={planet.ref}>
        {planet.isNear ? (
          <Suspense fallback={<PlanetJourneyPlaceholder />}>
            <LazyPlanetJourney />
          </Suspense>
        ) : <PlanetJourneyPlaceholder />}
      </ProgressiveStage>
    </>
  );
}
