import { createContext } from "react";

export type Theme = "dark" | "light" | "system";

export interface RelayInfo {
  url: string;
  read: boolean;
  write: boolean;
}

export interface RelayMetadata {
  relays: RelayInfo[];
  updatedAt: number;
}

export interface AppConfig {
  /** Current theme */
  theme: Theme;
  /** User's NIP-65 relay metadata */
  relayMetadata: RelayMetadata;
}

export interface AppContextType {
  /** Current application configuration */
  config: AppConfig;
  /** Update configuration using a callback that receives current config and returns new config */
  updateConfig: (updater: (currentConfig: AppConfig) => AppConfig) => void;
  /** Default relays used for fallback when outbox model routing fails */
  defaultRelays: { name: string; url: string }[];
}

export const AppContext = createContext<AppContextType | undefined>(undefined);
