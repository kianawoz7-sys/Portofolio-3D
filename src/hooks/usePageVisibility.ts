import { useEffect, useState } from "react";

export function usePageVisibility() {
  const [isPageVisible, setIsPageVisible] = useState(() => (
    typeof document === "undefined" || document.visibilityState !== "hidden"
  ));

  useEffect(() => {
    const updateVisibility = () => setIsPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  return isPageVisible;
}
