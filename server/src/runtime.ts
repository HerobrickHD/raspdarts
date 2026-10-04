/**
 * Baut alle Abhaengigkeiten des Dienstes zusammen. Genutzt vom Hauptprogramm
 * und von replay.ts, damit beide denselben Weg gehen.
 */
import { DisplayHub } from "./beamer/display-hub.js";
import { Ingest } from "./beamer/ingest.js";
import { LayoutStore } from "./beamer/layout-store.js";
import { createFramePipeline } from "./beamer/pipeline.js";
import { Recorder, sessionPath } from "./beamer/recorder.js";
import type { AppDeps } from "./http.js";

export interface Runtime extends AppDeps {
  recorder: Recorder | null;
}

export function createDeps(options: { record: boolean }): Runtime {
  const hub = new DisplayHub();
  // Jede Session wird mitgeschrieben: Material fuer Tests und fuer die
  // spaeteren Stufen (die Wurf-Koordinaten stecken schon in den Nachrichten).
  const recorder = options.record ? new Recorder(sessionPath()) : null;
  return {
    hub,
    recorder,
    layouts: new LayoutStore("data/layouts"),
    ingest: new Ingest(createFramePipeline(hub, recorder)),
  };
}
