import { useBackgroundProfileManager } from "@/hooks/useBackgroundProfileManager";

/**
 * Silent background profile management component
 * Handles stuck queries and retries automatically without any UI
 */
export function BackgroundProfileManager() {
  useBackgroundProfileManager();
  return null; // This component renders nothing
}