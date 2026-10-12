/**
 * Baut alle Abhaengigkeiten des Dienstes zusammen. Genutzt vom Hauptprogramm
 * und von replay.ts, damit beide denselben Weg gehen.
 */
import { loadConfig } from "./config.js";
import { DisplayHub } from "./viewer/display-hub.js";
import { Ingest } from "./viewer/ingest.js";
import { ProfileStore } from "./viewer/profile-store.js";
import { createFramePipeline } from "./viewer/pipeline.js";
import { Recorder, sessionPath } from "./viewer/recorder.js";
import type { AppDeps } from "./http.js";
import { autodartsHttp, createCams } from "./system/cams.js";
import { JobRunner } from "./system/jobs.js";
import { createStatusReader } from "./system/status.js";

export interface Runtime extends AppDeps {
  recorder: Recorder | null;
}

export function createDeps(options: { record: boolean }): Runtime {
  // data/layouts enthaelt die Layouts von vor den Profilen; sie werden beim
  // ersten Start einmal uebernommen und danach nicht mehr gelesen.
  const profiles = new ProfileStore("data/profiles", "data/layouts");
  const hub = new DisplayHub(profiles);
  // Jede Session wird mitgeschrieben: Material fuer Tests und fuer die
  // spaeteren Stufen (die Wurf-Koordinaten stecken schon in den Nachrichten).
  const recorder = options.record ? new Recorder(sessionPath()) : null;
  return {
    hub,
    recorder,
    profiles,
    ingest: new Ingest(createFramePipeline(hub, recorder)),
    status: createStatusReader(),
    jobs: new JobRunner(),
    cams: createCams({ http: autodartsHttp(loadConfig().autodartsUrl), now: Date.now }),
  };
}
