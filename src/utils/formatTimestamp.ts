// src/utils/formatTimestamp.ts
import { formatDistanceToNowStrict } from 'date-fns';

/**
 * Formats a Unix timestamp (in seconds) into a relative time string.
 * e.g., "5m", "2h", "3d", "1w", "2mo", "1y"
 * 
 * @param timestampSeconds Unix timestamp in seconds.
 * @returns A string representing the relative time ago.
 */
export const formatTimestamp = (timestampSeconds: number): string => {
    if (!timestampSeconds || typeof timestampSeconds !== 'number' || timestampSeconds <= 0) {
        return ''; // Return empty string for invalid input
    }

    try {
        const date = new Date(timestampSeconds * 1000); // Convert seconds to milliseconds
        
        // Use formatDistanceToNowStrict for concise output like "5m", "2h"
        // addSuffix: false removes the "ago" part if you want it shorter
        // Consider locale options if needed: formatDistanceToNowStrict(date, { locale: yourLocale })
        const relativeTime = formatDistanceToNowStrict(date, { addSuffix: true });

        // Optional: Simplify further (e.g., replace "minutes" with "m", "hours" with "h")
        // This regex part is optional and can be adjusted based on desired output
        return relativeTime
            .replace(/ minutes?/, 'm')
            .replace(/ hours?/, 'h')
            .replace(/ days?/, 'd')
            .replace(/ months?/, 'mo')
            .replace(/ years?/, 'y')
            .replace(/ about /,'') // Remove approximate wording
            .replace(/ less than a minute ago/, 'now'); 
            
    } catch (error) {
        console.error("Error formatting timestamp:", error);
        return ''; // Return empty string on error
    }
};
