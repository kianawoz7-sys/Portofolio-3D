import type { JourneyLayoutProfile } from "./archiveJourney";
import { remapJourneyProgressForArchive } from "./archiveJourney";

export interface JourneyNavigationChapter {
  number: string;
  label: string;
  activeFrom: number;
}

export interface JourneyNavItem {
  index: string;
  label: string;
  href: string;
  chapter: string;
  activeFrom: number;
  targetProgress: number;
  accessibilityLabel: string;
}

export const JOURNEY_SELECTOR = ".planet-world-journey";

/**
 * Semantic journey positions shared by navbar navigation and chapter state.
 * Targets sit inside each chapter's readable hold rather than at its entrance.
 */
export const JOURNEY_CHAPTERS: readonly JourneyNavigationChapter[] = [
  { number: "01", label: "PLANET ENTRY", activeFrom: 0 },
  { number: "02", label: "MEMORY CHAMBER", activeFrom: 0.105 },
  { number: "03", label: "SYSTEM CORE", activeFrom: 0.255 },
  { number: "04", label: "DIGITAL ARCHIVE", activeFrom: 0.395 },
  { number: "05", label: "LISTENING CAPSULE", activeFrom: 0.615 },
  { number: "06", label: "VOID THOUGHT", activeFrom: 0.745 },
  { number: "07", label: "FINAL SIGNAL", activeFrom: 0.955 },
] as const;

/** The single source of truth for adaptive navbar rendering and navigation. */
export const JOURNEY_NAV_ITEMS: readonly JourneyNavItem[] = [
  {
    index: "01",
    label: "Tentang",
    href: "#about",
    chapter: "MEMORY CHAMBER",
    activeFrom: 0.105,
    targetProgress: 0.17,
    accessibilityLabel: "Tentang — Memory Chamber",
  },
  {
    index: "02",
    label: "Karya",
    href: "#projects",
    chapter: "DIGITAL ARCHIVE",
    activeFrom: 0.395,
    targetProgress: 0.455,
    accessibilityLabel: "Karya — Digital Archive",
  },
  {
    index: "03",
    label: "Filosofi",
    href: "#philosophy",
    chapter: "VOID THOUGHT",
    activeFrom: 0.745,
    targetProgress: 0.86,
    accessibilityLabel: "Filosofi — Void Thought",
  },
  {
    index: "04",
    label: "Kontak",
    href: "#contact",
    chapter: "FINAL SIGNAL",
    activeFrom: 0.955,
    targetProgress: 0.965,
    accessibilityLabel: "Kontak — Final Signal",
  },
] as const;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function getActiveJourneyChapterIndex(semanticProgress: number) {
  const progress = clamp01(semanticProgress);
  let activeIndex = 0;

  for (let index = 1; index < JOURNEY_CHAPTERS.length; index += 1) {
    if (progress >= JOURNEY_CHAPTERS[index].activeFrom) activeIndex = index;
  }

  return activeIndex;
}

export function getActiveJourneyNavIndex(semanticProgress: number) {
  const progress = clamp01(semanticProgress);
  let activeIndex = -1;

  for (let index = 0; index < JOURNEY_NAV_ITEMS.length; index += 1) {
    if (progress >= JOURNEY_NAV_ITEMS[index].activeFrom) activeIndex = index;
  }

  return activeIndex;
}

/** Inverts the archive-aware semantic remap so navigation lands at the correct physical scroll position. */
export function getRawJourneyProgress(semanticProgress: number, projectCount: number, profile: JourneyLayoutProfile = "desktop") {
  const target = clamp01(semanticProgress);
  let lower = 0;
  let upper = 1;

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const midpoint = (lower + upper) * 0.5;
    if (remapJourneyProgressForArchive(midpoint, projectCount, profile) < target) lower = midpoint;
    else upper = midpoint;
  }

  return (lower + upper) * 0.5;
}

export function getJourneySemanticProgress(
  journeyElement: HTMLElement,
  scrollY: number,
  viewportHeight: number,
  projectCount: number,
  profile: JourneyLayoutProfile = "desktop",
) {
  const journeyStart = scrollY + journeyElement.getBoundingClientRect().top;
  const journeyScrollableDistance = Math.max(1, journeyElement.offsetHeight - viewportHeight);
  const rawProgress = clamp01((scrollY - journeyStart) / journeyScrollableDistance);
  return remapJourneyProgressForArchive(rawProgress, projectCount, profile);
}

export function getJourneyChapterScrollTop(
  journeyElement: HTMLElement,
  semanticProgress: number,
  scrollY: number,
  viewportHeight: number,
  projectCount: number,
  profile: JourneyLayoutProfile = "desktop",
) {
  const journeyStart = scrollY + journeyElement.getBoundingClientRect().top;
  const journeyScrollableDistance = Math.max(1, journeyElement.offsetHeight - viewportHeight);
  const rawTargetProgress = getRawJourneyProgress(semanticProgress, projectCount, profile);
  return journeyStart + journeyScrollableDistance * rawTargetProgress;
}
