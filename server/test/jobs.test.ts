import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/http.js";
import { JobRunner, type JobEvent } from "../src/system/jobs.js";
import { listen, testDeps } from "./helpers.js";

interface FakeChild extends EventEmitter {
  stdout: PassThrough;
  stderr: PassThrough;
}

/** Ein Kindprozess, der Zeilen ausgibt und dann mit `code` endet - oder haengt. */
function fakeChild(options: { lines?: string[]; chunks?: (string | Buffer)[]; code?: number; hang?: boolean } = {}): FakeChild {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  });
  if (!options.hang) {
    setImmediate(() => {
      for (const line of options.lines ?? []) child.stdout.write(`${line}\n`);
      for (const chunk of options.chunks ?? []) child.stdout.write(chunk);
      setImmediate(() => child.emit("close", options.code ?? 0));
    });
  }
  return child;
}

const asChild = (child: FakeChild) => child as unknown as ChildProcess;

function collect(runner: JobRunner, script: string): Promise<JobEvent[]> {
  return new Promise((resolve) => {
    const events: JobEvent[] = [];
    runner.run(script, (event) => {
      events.push(event);
      if (event.type === "done") resolve(events);
    });
  });
}

describe("JobRunner", () => {
  test("reicht Ausgabezeilen weiter und meldet Erfolg", async () => {
    const started: string[] = [];
    const runner = new JobRunner((script) => {
      started.push(script);
      return asChild(fakeChild({ lines: ["eins", "zwei"] }));
    });

    const events = await collect(runner, "raspdarts-update.sh");

    expect(started).toEqual(["raspdarts-update.sh"]);
    expect(events).toEqual([
      { type: "log", line: "eins" },
      { type: "log", line: "zwei" },
      { type: "done", success: true },
    ]);
  });

  test("meldet einen Fehler mit Exit-Code", async () => {
    const runner = new JobRunner(() => asChild(fakeChild({ code: 3 })));

    const events = await collect(runner, "x.sh");

    expect(events.at(-1)).toEqual({ type: "done", success: false, error: "Exit code 3" });
  });

  test("meldet einen Fehler, wenn der Start scheitert", async () => {
    const runner = new JobRunner(() => {
      throw new Error("sudo fehlt");
    });

    const events = await collect(runner, "x.sh");

    expect(events).toEqual([{ type: "done", success: false, error: "sudo fehlt" }]);
    expect(runner.busy).toBe(false);
  });

  test("setzt Zeilen zusammen, die ueber mehrere Bloecke verteilt ankommen", async () => {
    const runner = new JobRunner(() => asChild(fakeChild({ chunks: ["hal", "lo\nwel", "t\n"] })));

    const events = await collect(runner, "x.sh");

    expect(events).toEqual([
      { type: "log", line: "hallo" },
      { type: "log", line: "welt" },
      { type: "done", success: true },
    ]);
  });

  test("gibt einen Rest ohne Zeilenumbruch vor dem Ende aus", async () => {
    const runner = new JobRunner(() => asChild(fakeChild({ chunks: ["ende"] })));

    const events = await collect(runner, "x.sh");

    expect(events).toEqual([
      { type: "log", line: "ende" },
      { type: "done", success: true },
    ]);
  });

  test("setzt ein UTF-8-Zeichen zusammen, das auf zwei Bloecke verteilt ist", async () => {
    const runner = new JobRunner(() =>
      asChild(fakeChild({ chunks: [Buffer.from([0xc3]), Buffer.from([0xbc, 0x0a])] })),
    );

    const events = await collect(runner, "x.sh");

    expect(events[0]).toEqual({ type: "log", line: "ü" });
  });

  test("laesst keinen zweiten Auftrag zu, solange einer laeuft", async () => {
    const child = fakeChild({ hang: true });
    const runner = new JobRunner(() => asChild(child));
    const first = collect(runner, "a.sh");

    expect(runner.busy).toBe(true);
    expect(runner.run("b.sh", () => {})).toBe(false);

    child.emit("close", 0);
    await first;
    expect(runner.busy).toBe(false);
  });
});

describe("Routen", () => {
  let app: FastifyInstance;
  afterEach(async () => app.close());

  test("streamt einen Auftrag als SSE", async () => {
    const started: string[] = [];
    const jobs = new JobRunner((script) => {
      started.push(script);
      return asChild(fakeChild({ lines: ["fertig"] }));
    });
    app = await buildApp(testDeps({ jobs }));
    const host = await listen(app);

    const response = await fetch(`http://${host}/api/system/update`, {
      method: "POST",
      headers: { "X-Raspdarts": "1" },
    });
    const body = await response.text();

    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain('data: {"type":"log","line":"fertig"}\n\n');
    expect(body).toContain('data: {"type":"done","success":true}\n\n');
    expect(started).toEqual(["raspdarts-update.sh"]);
  });

  test.each([
    ["/api/system/update", "raspdarts-update.sh"],
    ["/api/system/uninstall", "raspdarts-uninstall.sh"],
  ])("%s startet %s", async (path, script) => {
    const started: string[] = [];
    const jobs = new JobRunner((name) => {
      started.push(name);
      return asChild(fakeChild());
    });
    app = await buildApp(testDeps({ jobs }));
    const host = await listen(app);

    const response = await fetch(`http://${host}${path}`, {
      method: "POST",
      headers: { "X-Raspdarts": "1" },
    });
    await response.text();

    expect(started).toEqual([script]);
  });

  test.each(["/api/autodarts/install", "/api/autodarts/uninstall"])(
    "%s gibt es nicht mehr",
    async (path) => {
      const started: string[] = [];
      const jobs = new JobRunner((name) => {
        started.push(name);
        return asChild(fakeChild());
      });
      app = await buildApp(testDeps({ jobs }));
      const host = await listen(app);

      const response = await fetch(`http://${host}${path}`, {
        method: "POST",
        headers: { "X-Raspdarts": "1" },
      });
      await response.text();

      expect(response.status).toBe(404);
      expect(started).toEqual([]);
    },
  );

  test("antwortet mit 409, solange ein Auftrag laeuft", async () => {
    const child = fakeChild({ hang: true });
    const jobs = new JobRunner(() => asChild(child));
    app = await buildApp(testDeps({ jobs }));
    const host = await listen(app);
    const headers = { "X-Raspdarts": "1" };

    const first = await fetch(`http://${host}/api/system/update`, { method: "POST", headers });
    const second = await fetch(`http://${host}/api/system/uninstall`, { method: "POST", headers });

    expect(second.status).toBe(409);
    child.emit("close", 0);
    await first.text();
  });

  test("Neustart waehrend eines Auftrags: 409 und kein Start", async () => {
    const started: string[] = [];
    const jobs = new JobRunner((name) => {
      started.push(name);
      return asChild(fakeChild({ hang: true }));
    });
    app = await buildApp(testDeps({ jobs }));
    jobs.run("raspdarts-update.sh", () => {});

    const response = await app.inject({
      method: "POST",
      url: "/api/system/reboot",
      headers: { "x-raspdarts": "1" },
    });

    expect(response.statusCode).toBe(409);
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(started).toEqual(["raspdarts-update.sh"]);
  });

  test.each([
    ["/api/system/reboot", "reboot.sh"],
    ["/api/system/shutdown", "shutdown.sh"],
  ])("%s antwortet sofort und startet danach %s", async (path, script) => {
    const started: string[] = [];
    const jobs = new JobRunner((name) => {
      started.push(name);
      return asChild(fakeChild({ hang: true }));
    });
    app = await buildApp(testDeps({ jobs }));

    const response = await app.inject({ method: "POST", url: path, headers: { "x-raspdarts": "1" } });

    expect(response.json()).toEqual({ ok: true });
    expect(started).toEqual([]);
    await vi.waitFor(() => expect(started).toEqual([script]), { timeout: 2000 });
  });
});
