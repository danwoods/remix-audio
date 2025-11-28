/** @file React Context for player state */
import { createContext, useContext } from "react";
import type { Context } from "../root.tsx";

export const PlayerContext = createContext<Context | null>(null);

export function usePlayerContext(): Context {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error(
      "usePlayerContext must be used within PlayerContext.Provider",
    );
  }
  return context;
}
