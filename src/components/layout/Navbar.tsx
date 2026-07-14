import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { PROJECTS } from "../../data/projects";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { useResponsiveProfile } from "../../hooks/useResponsiveProfile";
import { easePremium } from "../../lib/animation";
import {
  getActiveJourneyChapterIndex,
  getActiveJourneyNavIndex,
  getJourneyChapterScrollTop,
  getJourneySemanticProgress,
  JOURNEY_CHAPTERS,
  JOURNEY_NAV_ITEMS,
  JOURNEY_SELECTOR,
  type JourneyNavItem,
} from "../../lib/journeyNavigation";

const CHAPTER_JUMP_DURATION_MS = 1050;

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

export function Navbar() {
  const reducedMotion = usePrefersReducedMotion();
  const { profile } = useResponsiveProfile();
  const navRef = useRef<HTMLElement>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [activeNavIndex, setActiveNavIndex] = useState(-1);
  const [isHero, setIsHero] = useState(true);
  const [navVisible, setNavVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastScrollYRef = useRef(0);
  const scrollFrameRef = useRef(0);
  const menuOpenRef = useRef(false);
  const interactionRef = useRef(false);
  const pointerNearTopRef = useRef(false);
  const navigationFrameRef = useRef(0);

  useEffect(() => {
    menuOpenRef.current = menuOpen;
    if (menuOpen) setNavVisible(true);
  }, [menuOpen]);

  useEffect(() => {
    const updateNavigation = () => {
      const scrollY = window.scrollY;
      const delta = scrollY - lastScrollYRef.current;
      const heroBoundary = Math.max(160, window.innerHeight - 72);
      const nextIsHero = scrollY < heroBoundary;
      let nextChapterIndex = 0;
      let nextNavIndex = -1;

      const journeyElement = document.querySelector<HTMLElement>(JOURNEY_SELECTOR);
      if (journeyElement) {
        const semanticProgress = getJourneySemanticProgress(
          journeyElement,
          scrollY,
          window.innerHeight,
          PROJECTS.length,
          profile,
        );
        nextChapterIndex = getActiveJourneyChapterIndex(semanticProgress);
        nextNavIndex = getActiveJourneyNavIndex(semanticProgress);
      }

      setIsHero((current) => current === nextIsHero ? current : nextIsHero);
      setActiveChapterIndex((current) => current === nextChapterIndex ? current : nextChapterIndex);
      setActiveNavIndex((current) => current === nextNavIndex ? current : nextNavIndex);

      const forcedVisible = menuOpenRef.current || interactionRef.current || pointerNearTopRef.current;
      const finalFooterHold = nextChapterIndex === JOURNEY_CHAPTERS.length - 1
        && scrollY >= document.documentElement.scrollHeight - window.innerHeight * 1.08;

      if (forcedVisible || nextIsHero || delta < -2) {
        setNavVisible(true);
      } else if (finalFooterHold || (delta > 4 && scrollY > heroBoundary + 64)) {
        setNavVisible(false);
      }

      lastScrollYRef.current = scrollY;
      scrollFrameRef.current = 0;
    };

    const scheduleUpdate = () => {
      if (scrollFrameRef.current) return;
      scrollFrameRef.current = window.requestAnimationFrame(updateNavigation);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      if (event.clientY <= 86) {
        pointerNearTopRef.current = true;
        setNavVisible(true);
      } else if (event.clientY > 132) {
        pointerNearTopRef.current = false;
      }
    };

    lastScrollYRef.current = window.scrollY;
    updateNavigation();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("pointermove", handlePointerMove);
      window.cancelAnimationFrame(scrollFrameRef.current);
    };
  }, [profile]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key === "Tab") setNavVisible(true);
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) {
        window.cancelAnimationFrame(navigationFrameRef.current);
        navigationFrameRef.current = 0;
      }
    };
    const cancelNavigation = () => {
      window.cancelAnimationFrame(navigationFrameRef.current);
      navigationFrameRef.current = 0;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", cancelNavigation, { passive: true });
    window.addEventListener("touchstart", cancelNavigation, { passive: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", cancelNavigation);
      window.removeEventListener("touchstart", cancelNavigation);
      cancelNavigation();
    };
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const handleFocusIn = () => {
      interactionRef.current = true;
      setNavVisible(true);
    };
    const handleFocusOut = () => {
      window.requestAnimationFrame(() => {
        if (!nav.contains(document.activeElement)) interactionRef.current = false;
      });
    };

    nav.addEventListener("focusin", handleFocusIn);
    nav.addEventListener("focusout", handleFocusOut);
    return () => {
      nav.removeEventListener("focusin", handleFocusIn);
      nav.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  const setInteraction = (active: boolean) => {
    interactionRef.current = active;
    if (active) setNavVisible(true);
  };

  const animateToScrollPosition = (targetScroll: number) => {
    window.cancelAnimationFrame(navigationFrameRef.current);

    if (reducedMotion) {
      window.scrollTo({ top: targetScroll, left: 0, behavior: "instant" });
      navigationFrameRef.current = 0;
      return;
    }

    const startScroll = window.scrollY;
    const distance = targetScroll - startScroll;
    const startTime = window.performance.now();

    const step = (time: number) => {
      const progress = Math.min(1, (time - startTime) / CHAPTER_JUMP_DURATION_MS);
      window.scrollTo({
        top: startScroll + distance * easeInOutCubic(progress),
        left: 0,
        behavior: "instant",
      });

      if (progress < 1) navigationFrameRef.current = window.requestAnimationFrame(step);
      else navigationFrameRef.current = 0;
    };

    navigationFrameRef.current = window.requestAnimationFrame(step);
  };

  const navigateToJourneyChapter = (event: ReactMouseEvent<HTMLAnchorElement>, item: JourneyNavItem) => {
    const journeyElement = document.querySelector<HTMLElement>(JOURNEY_SELECTOR);
    if (!journeyElement) return;

    event.preventDefault();
    const targetScroll = getJourneyChapterScrollTop(
      journeyElement,
      item.targetProgress,
      window.scrollY,
      window.innerHeight,
      PROJECTS.length,
      profile,
    );

    setMenuOpen(false);
    setNavVisible(true);
    animateToScrollPosition(targetScroll);

    if (window.location.hash === item.href) {
      window.history.replaceState(window.history.state, "", item.href);
    } else {
      window.history.pushState(window.history.state, "", item.href);
    }
  };

  const chapter = JOURNEY_CHAPTERS[activeChapterIndex];
  const activeHref = JOURNEY_NAV_ITEMS[activeNavIndex]?.href ?? "";
  const shouldShow = navVisible || menuOpen;
  const finalSignal = activeChapterIndex === JOURNEY_CHAPTERS.length - 1;

  return (
    <motion.nav
      ref={navRef}
      initial={reducedMotion ? false : { opacity: 0, y: -14 }}
      animate={{
        opacity: shouldShow ? finalSignal && !menuOpen ? 0.82 : 1 : 0,
        y: shouldShow ? 0 : -22,
      }}
      transition={{ duration: reducedMotion ? 0 : 0.45, ease: easePremium }}
      className="site-navbar"
      data-mode={isHero ? "expanded" : "compact"}
      data-visible={shouldShow}
      data-final-signal={finalSignal}
      data-menu-open={menuOpen}
      style={{ pointerEvents: shouldShow ? "auto" : "none" }}
      aria-label="Primary navigation"
      onPointerEnter={() => setInteraction(true)}
      onPointerLeave={() => setInteraction(false)}
      onFocusCapture={() => setInteraction(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteraction(false);
      }}
    >
      <div className="site-navbar__inner">
        <a
          className="site-navbar__brand font-headline-sm"
          href="#"
          aria-label="Denanda Ukky, back to top"
          onClick={() => setMenuOpen(false)}
        >
          denanda ukky
          <i aria-hidden="true" />
        </a>

        <div className="site-navbar__context">
          <p className="site-navbar__chapter font-label-caps" aria-live="polite" aria-atomic="true">
            <span>{chapter.number}</span>
            <i aria-hidden="true" />
            <strong>{chapter.label}</strong>
          </p>

          <ul className="site-navbar__links">
            {JOURNEY_NAV_ITEMS.map((item) => {
              const active = !menuOpen && activeHref === item.href;
              return (
                <li key={item.href}>
                  <a
                    className={active ? "is-active" : ""}
                    href={item.href}
                    aria-label={item.accessibilityLabel}
                    aria-current={active ? "page" : undefined}
                    onClick={(event) => navigateToJourneyChapter(event, item)}
                  >
                    <span className="font-label-caps">{item.label}</span>
                    {active && (
                      <motion.i
                        layoutId="active-nav-indicator"
                        transition={{ duration: reducedMotion ? 0 : 0.45, ease: easePremium }}
                      />
                    )}
                  </a>
                </li>
              );
            })}
          </ul>

          <button
            className="site-navbar__menu"
            type="button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="signal-navigation-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="font-label-caps">MENU</span>
            <b aria-hidden="true">
              <i />
              <i />
            </b>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="signal-navigation-menu"
            className="site-navbar__mobile"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -7, scale: 0.99 }}
            transition={{ duration: reducedMotion ? 0 : 0.38, ease: easePremium }}
          >
            <div className="site-navbar__mobile-heading font-label-caps">
              <span>NAVIGATION SIGNAL</span>
              <span>{chapter.number} / {chapter.label}</span>
            </div>
            {JOURNEY_NAV_ITEMS.map((item) => {
              const active = activeHref === item.href;
              return (
                <a
                  key={item.href}
                  className={active ? "is-active" : ""}
                  href={item.href}
                  aria-label={item.accessibilityLabel}
                  aria-current={active ? "page" : undefined}
                  onClick={(event) => navigateToJourneyChapter(event, item)}
                >
                  <span className="font-label-caps">{item.index}</span>
                  <strong className="font-headline-sm">{item.label}</strong>
                  <i aria-hidden="true" />
                </a>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
