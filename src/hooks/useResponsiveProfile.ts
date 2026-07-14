import { useEffect, useState } from "react";

export type ResponsiveProfile = "desktop" | "tablet" | "mobile";

interface ResponsiveViewport {
  profile: ResponsiveProfile;
  isLandscape: boolean;
}

function readViewportProfile(): ResponsiveViewport {
  const mobilePortrait = window.matchMedia("(max-width: 767px)").matches;
  const mobileLandscape = window.matchMedia("(max-height: 520px) and (max-width: 950px)").matches;
  const tablet = window.matchMedia("(max-width: 1100px)").matches;

  return {
    profile: mobilePortrait || mobileLandscape ? "mobile" : tablet ? "tablet" : "desktop",
    isLandscape: window.matchMedia("(orientation: landscape)").matches,
  };
}

export function useResponsiveProfile() {
  const [viewport, setViewport] = useState<ResponsiveViewport>(() => {
    if (typeof window === "undefined") return { profile: "desktop", isLandscape: false };
    return readViewportProfile();
  });

  useEffect(() => {
    const queries = [
      window.matchMedia("(max-width: 767px)"),
      window.matchMedia("(max-height: 520px) and (max-width: 950px)"),
      window.matchMedia("(max-width: 1100px)"),
      window.matchMedia("(orientation: landscape)"),
    ];
    const update = () => setViewport(readViewportProfile());

    queries.forEach((query) => query.addEventListener("change", update));
    return () => queries.forEach((query) => query.removeEventListener("change", update));
  }, []);

  return {
    ...viewport,
    isMobile: viewport.profile === "mobile",
    isTablet: viewport.profile === "tablet",
  };
}
