// src/hooks/useIntersectionObserver.ts
import { useEffect, useRef } from 'react';

interface UseIntersectionObserverProps {
    target: React.RefObject<Element | null>;
    onIntersect: () => void;
    threshold?: number | number[];
    rootMargin?: string;
    enabled?: boolean; // To conditionally enable/disable the observer
}

const useIntersectionObserver = ({
    target,
    onIntersect,
    threshold = 1.0, // Trigger when 100% visible by default
    rootMargin = '0px',
    enabled = true, // Enabled by default
}: UseIntersectionObserverProps) => {
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        if (!enabled || !target.current) {
            // If disabled or target isn't set, disconnect any existing observer
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
                // console.log("IntersectionObserver disconnected (disabled or no target).");
            }
            return;
        }

        // Ensure we don't create multiple observers for the same target
        if (observerRef.current) {
             observerRef.current.disconnect();
        }
        
        // Create the observer
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        // console.log("IntersectionObserver: Target intersected!");
                        onIntersect();
                    }
                });
            },
            {
                rootMargin,
                threshold,
            }
        );

        const currentTarget = target.current; // Capture target ref value
        // console.log("IntersectionObserver created and observing target:", currentTarget);
        observerRef.current.observe(currentTarget);

        // Cleanup function
        return () => {
            if (observerRef.current) {
                 // console.log("IntersectionObserver disconnecting on cleanup.");
                observerRef.current.disconnect();
                observerRef.current = null;
            }
        };
    }, [target, onIntersect, threshold, rootMargin, enabled]); // Re-run effect if any dependency changes
};

export default useIntersectionObserver;
