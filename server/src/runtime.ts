/**
 * Baut alle Abhaengigkeiten des Dienstes zusammen. Genutzt vom Hauptprogramm
 * und von replay.ts, damit beide denselben Weg gehen.
 */
import { DisplayHub } from "./viewer/display-hub.js";
import { Ingest } from "./viewer/ingest.js";
import { LayoutStore } from "./viewer/layout-store.js";
import { createFramePipeline } from "./viewer/pipeline.js";
import { Recorder, sessionPath } from "./viewer/recorder.js";
import type { AppDeps } from "./http.js";
import { JobRunner } from "./system/jobs.js";
import { createStatusReader } from "./system/status.js";

export interface Runtime extends AppDeps {
  recorder: Recorder | null;
}

export function createDeps(options: { record: boolean }): Runtime {
  const layouts = new LayoutStore("data/layouts");
  const hub = new DisplayHub(layouts);
  // Jede Session wird mitgeschrieben: Material fuer Tests und fuer die
  // spaeteren Stufen (die Wurf-Koordinaten stecken schon in den Nachrichten).
  const recorder = options.record ? new Recorder(sessionPath()) : null;
  return {
    hub,
    recorder,
    layouts,
    ingest: new Ingest(createFramePipeline(hub, recorder)),
    status: createStatusReader(),
    jobs: new JobRunner(),
  };
}
