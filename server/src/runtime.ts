/**
 * Baut alle Abhaengigkeiten des Dienstes zusammen. Genutzt vom Hauptprogramm
 * und von replay.ts, damit beide denselben Weg gehen.
 */
import { DisplayHub } from "./beamer/display-hub.js";
import { LayoutStore } from "./beamer/layout-store.js";
import type { AppDeps } from "./http.js";

export function createDeps(): AppDeps {
  return {
    hub: new DisplayHub(),
    layouts: new LayoutStore("data/layouts"),
  };
}
