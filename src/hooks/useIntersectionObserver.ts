// src/hooks/useIntersectionObserver.ts
import { RefObject, useEffect } from "react";

interface UseIntersectionObserverOptions {
  enabled?: boolean;
  root?: null | Element;
  rootMargin?: string;
  target: RefObject<null | Element>;
  threshold?: number | number[];
  onIntersect: () => void;
}

function useIntersectionObserver({
  enabled = true,
  onIntersect,
  root = null,
  rootMargin = "0px",
  target,
  threshold = 0.1,
}: UseIntersectionObserverOptions): void {
  useEffect(() => {
    if (!enabled) {
      // console.log("Observer disabled"); // Optional log
      return;
    }

    // --- MORE ROBUST CHECK ---
    // 1. Check if the ref object itself was passed correctly
    if (!target) {
      console.warn("Intersection Observer: 'target' prop (the ref object) is missing.");
      return; // Cannot proceed without the ref object
    }

    // 2. Get the DOM element from the ref's current property
    const el = target.current;

    // 3. Check if the DOM element exists yet
    if (!el) {
      // This can happen normally on initial render before the ref is attached.
      // console.log("Observer waiting for target element..."); // Optional log
      return; // Don't set up the observer yet
    }
    // --- END ROBUST CHECK ---

    // console.log("Observer setting up for element:", el); // Optional log

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // Ensure entry exists and is intersecting before calling callback
        if (entry && entry.isIntersecting) {
          // console.log("Element intersecting, calling onIntersect"); // Optional log
          onIntersect();
        }
      },
      {
        root,
        rootMargin,
        threshold,
      },
    );

    // Start observing the element (we know 'el' is valid here)
    observer.observe(el);

    // Cleanup function
    return () => {
      // console.log("Observer cleaning up for element:", el); // Optional log
      // No need to check el again here because 'observe' would only have been called if it existed.
      // However, checking doesn't hurt if there are complex re-render scenarios.
      // if (el) {
      observer.unobserve(el);
      // }
    };
  }, [target, enabled, threshold, root, rootMargin, onIntersect]); // Dependencies
}

export default useIntersectionObserver;
