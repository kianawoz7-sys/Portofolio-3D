import type { Project } from "../data/projects";

export type WorldVector = [number, number, number];

export interface ArchiveVaultTransform {
  position: WorldVector;
  rotation: WorldVector;
}

export interface ArchiveProgressWindow {
  approachStart: number;
  discoveryStart: number;
  discoveryEnd: number;
  transitStart: number;
  exitEnd: number;
  segmentStart: number;
  segmentEnd: number;
}

export interface ArchiveCameraPose {
  position: WorldVector;
  lookAt: WorldVector;
  activeIndex: number;
  segmentProgress: number;
  inspectionWeight: number;
}

export const ARCHIVE_CINEMATIC_LIMIT = 5;
export const ARCHIVE_GALLERY_SCROLL_VH = {
  approach: 120,
  inspection: 260,
  transition: 200,
  exit: 160,
} as const;
export const ARCHIVE_CONSTELLATION_SCROLL_VH = 110;

export type JourneyLayoutProfile = "desktop" | "tablet" | "mobile";

const JOURNEY_SEMANTIC_BASE_ARCHIVE_VH = 250;
const JOURNEY_SEMANTIC_BEFORE_ARCHIVE_VH = 450;
const JOURNEY_SEMANTIC_AFTER_ARCHIVE_VH = 472;
const ARCHIVE_VAULT_Y = 0.72;
const ARCHIVE_VAULT_Z = -52.8;
const ARCHIVE_VAULT_SPACING = 7.2;
const ARCHIVE_CAMERA_Y = 1.14;
const ARCHIVE_CAMERA_Z = -46.35;

export function getCinematicProjectCount(projectCount: number) {
  return Math.max(1, Math.min(projectCount, ARCHIVE_CINEMATIC_LIMIT));
}

function getArchiveGalleryHeightVh(projectCount: number) {
  const count = getCinematicProjectCount(projectCount);
  return ARCHIVE_GALLERY_SCROLL_VH.approach
    + count * ARCHIVE_GALLERY_SCROLL_VH.inspection
    + Math.max(0, count - 1) * ARCHIVE_GALLERY_SCROLL_VH.transition
    + ARCHIVE_GALLERY_SCROLL_VH.exit;
}

export function getArchiveScrollHeightVh(projectCount: number) {
  const constellationHeight = projectCount > ARCHIVE_CINEMATIC_LIMIT ? ARCHIVE_CONSTELLATION_SCROLL_VH : 0;
  return getArchiveGalleryHeightVh(projectCount) + constellationHeight;
}

export function getResponsiveArchiveScrollHeightVh(projectCount: number, profile: JourneyLayoutProfile) {
  const scale = profile === "mobile" ? 0.56 : profile === "tablet" ? 0.82 : 1;
  return Math.round(getArchiveScrollHeightVh(projectCount) * scale);
}

export function getArchiveProgressWindow(index: number, projectCount: number): ArchiveProgressWindow {
  const count = getCinematicProjectCount(projectCount);
  const safeIndex = Math.max(0, Math.min(index, count - 1));
  const totalHeight = getArchiveScrollHeightVh(projectCount);
  const holdStartVh = ARCHIVE_GALLERY_SCROLL_VH.approach
    + safeIndex * (ARCHIVE_GALLERY_SCROLL_VH.inspection + ARCHIVE_GALLERY_SCROLL_VH.transition);
  const holdEndVh = holdStartVh + ARCHIVE_GALLERY_SCROLL_VH.inspection;
  const approachStartVh = safeIndex === 0 ? 0 : holdStartVh - ARCHIVE_GALLERY_SCROLL_VH.transition;
  const exitEndVh = safeIndex < count - 1
    ? holdEndVh + ARCHIVE_GALLERY_SCROLL_VH.transition
    : getArchiveGalleryHeightVh(projectCount);

  return {
    approachStart: approachStartVh / totalHeight,
    discoveryStart: holdStartVh / totalHeight,
    discoveryEnd: holdEndVh / totalHeight,
    transitStart: holdEndVh / totalHeight,
    exitEnd: exitEndVh / totalHeight,
    segmentStart: approachStartVh / totalHeight,
    segmentEnd: exitEndVh / totalHeight,
  };
}

export function getArchiveActiveProjectIndex(progress: number, projectCount: number) {
  const count = getCinematicProjectCount(projectCount);
  for (let index = 0; index < count - 1; index += 1) {
    const current = getArchiveProgressWindow(index, projectCount);
    const next = getArchiveProgressWindow(index + 1, projectCount);
    const transitionMidpoint = (current.discoveryEnd + next.discoveryStart) * 0.5;
    if (progress < transitionMidpoint) return index;
  }
  return count - 1;
}

export function getArchiveConstellationProgressStart(projectCount: number) {
  if (projectCount <= ARCHIVE_CINEMATIC_LIMIT) return 1;
  return getArchiveGalleryHeightVh(projectCount) / getArchiveScrollHeightVh(projectCount);
}

export function getArchiveVaultTransform(_project: Project, index: number): ArchiveVaultTransform {
  return {
    position: [index * ARCHIVE_VAULT_SPACING, ARCHIVE_VAULT_Y, ARCHIVE_VAULT_Z],
    rotation: [0, 0, 0],
  };
}

export function getArchiveCameraCheckpoint(project: Project, index: number) {
  const [x, y, z] = getArchiveVaultTransform(project, index).position;
  return {
    position: [x, ARCHIVE_CAMERA_Y, ARCHIVE_CAMERA_Z] as WorldVector,
    lookAt: [x, y + 0.08, z] as WorldVector,
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smooth(value: number) {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function lerp(a: number, b: number, amount: number) {
  return a + (b - a) * amount;
}

export function getArchiveCameraPose(progress: number, projects: Project[]): ArchiveCameraPose {
  const cinematicProjects = projects.slice(0, ARCHIVE_CINEMATIC_LIMIT);
  const count = Math.max(1, cinematicProjects.length);
  const firstProject = cinematicProjects[0] ?? projects[0];
  if (!firstProject) {
    return {
      position: [0, ARCHIVE_CAMERA_Y, ARCHIVE_CAMERA_Z],
      lookAt: [0, ARCHIVE_VAULT_Y, ARCHIVE_VAULT_Z],
      activeIndex: 0,
      segmentProgress: 0,
      inspectionWeight: 0,
    };
  }

  const firstWindow = getArchiveProgressWindow(0, projects.length);
  const firstCheckpoint = getArchiveCameraCheckpoint(firstProject, 0);
  if (progress < firstWindow.discoveryStart) {
    return {
      ...firstCheckpoint,
      activeIndex: 0,
      segmentProgress: clamp01(progress / Math.max(0.001, firstWindow.discoveryStart)),
      inspectionWeight: 0,
    };
  }

  for (let index = 0; index < count; index += 1) {
    const project = cinematicProjects[index] ?? firstProject;
    const window = getArchiveProgressWindow(index, projects.length);
    const checkpoint = getArchiveCameraCheckpoint(project, index);
    if (progress <= window.discoveryEnd) {
      return {
        ...checkpoint,
        activeIndex: index,
        segmentProgress: clamp01((progress - window.discoveryStart) / Math.max(0.001, window.discoveryEnd - window.discoveryStart)),
        inspectionWeight: 1,
      };
    }

    if (index < count - 1) {
      const nextProject = cinematicProjects[index + 1] ?? firstProject;
      const nextWindow = getArchiveProgressWindow(index + 1, projects.length);
      if (progress < nextWindow.discoveryStart) {
        const nextCheckpoint = getArchiveCameraCheckpoint(nextProject, index + 1);
        const amount = smooth((progress - window.discoveryEnd) / Math.max(0.001, nextWindow.discoveryStart - window.discoveryEnd));
        return {
          position: [lerp(checkpoint.position[0], nextCheckpoint.position[0], amount), ARCHIVE_CAMERA_Y, ARCHIVE_CAMERA_Z],
          lookAt: [lerp(checkpoint.lookAt[0], nextCheckpoint.lookAt[0], amount), checkpoint.lookAt[1], checkpoint.lookAt[2]],
          activeIndex: amount < 0.5 ? index : index + 1,
          segmentProgress: amount,
          inspectionWeight: 0,
        };
      }
    }
  }

  const lastIndex = count - 1;
  const lastProject = cinematicProjects[lastIndex] ?? firstProject;
  const lastCheckpoint = getArchiveCameraCheckpoint(lastProject, lastIndex);
  return {
    ...lastCheckpoint,
    activeIndex: lastIndex,
    segmentProgress: 1,
    inspectionWeight: 0,
  };
}

export function getArchiveThreadPoints(projects: Project[]): WorldVector[] {
  const cinematicProjects = projects.slice(0, ARCHIVE_CINEMATIC_LIMIT);
  const stationPoints = cinematicProjects.map((project, index) => {
    const [x, y, z] = getArchiveVaultTransform(project, index).position;
    return [x, y - 1.45, z + 0.42] as WorldVector;
  });

  if (stationPoints.length === 0) return [[-3, -0.73, ARCHIVE_VAULT_Z + 0.42], [3, -0.73, ARCHIVE_VAULT_Z + 0.42]];

  const first = stationPoints[0];
  const last = stationPoints[stationPoints.length - 1];
  const points: WorldVector[] = [
    [first[0] - 3, first[1], first[2]],
    ...stationPoints,
  ];
  if (projects.length > ARCHIVE_CINEMATIC_LIMIT) points.push(getArchiveConstellationPosition(projects));
  points.push([last[0] + 3, last[1], last[2]]);
  return points;
}

export function getArchiveConstellationPosition(projects: Project[]): WorldVector {
  const cinematicProjects = projects.slice(0, ARCHIVE_CINEMATIC_LIMIT);
  const lastIndex = Math.max(0, cinematicProjects.length - 1);
  const lastProject = cinematicProjects[lastIndex] ?? projects[0];
  if (!lastProject) return [4.5, ARCHIVE_VAULT_Y, ARCHIVE_VAULT_Z];
  const [x] = getArchiveVaultTransform(lastProject, lastIndex).position;
  return [x + 5, ARCHIVE_VAULT_Y + 0.5, ARCHIVE_VAULT_Z];
}

/**
 * Keeps the rest of the planet journey on its original semantic timeline even
 * when the archive's physical scroll distance grows with the project count.
 */
export function remapJourneyProgressForArchive(
  rawProgress: number,
  projectCount: number,
  profile: JourneyLayoutProfile = "desktop",
) {
  const beforeArchiveVh = profile === "mobile" ? 490 : profile === "tablet" ? 435 : 110 + 180 + 160;
  const afterArchiveVh = profile === "mobile" ? 607 : profile === "tablet" ? 492 : 180 + 130 + 140 + 22;
  const currentArchiveVh = getResponsiveArchiveScrollHeightVh(projectCount, profile);
  const baselineArchiveVh = JOURNEY_SEMANTIC_BASE_ARCHIVE_VH;
  const currentScrollableVh = beforeArchiveVh + currentArchiveVh + afterArchiveVh - 100;
  const baselineScrollableVh = JOURNEY_SEMANTIC_BEFORE_ARCHIVE_VH
    + baselineArchiveVh
    + JOURNEY_SEMANTIC_AFTER_ARCHIVE_VH
    - 100;
  const currentArchiveStart = beforeArchiveVh / currentScrollableVh;
  const currentArchiveEnd = (beforeArchiveVh + currentArchiveVh - 100) / currentScrollableVh;
  const baselineArchiveStart = JOURNEY_SEMANTIC_BEFORE_ARCHIVE_VH / baselineScrollableVh;
  const baselineArchiveEnd = (JOURNEY_SEMANTIC_BEFORE_ARCHIVE_VH + baselineArchiveVh - 100) / baselineScrollableVh;

  if (rawProgress <= currentArchiveStart) {
    return (rawProgress / currentArchiveStart) * baselineArchiveStart;
  }
  if (rawProgress <= currentArchiveEnd) {
    const local = (rawProgress - currentArchiveStart) / (currentArchiveEnd - currentArchiveStart);
    return lerp(baselineArchiveStart, baselineArchiveEnd, local);
  }

  const local = (rawProgress - currentArchiveEnd) / (1 - currentArchiveEnd);
  return lerp(baselineArchiveEnd, 1, local);
}
