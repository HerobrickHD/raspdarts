import { describe, expect, test } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  test("nimmt ohne Umgebung Port 8743 und Autodarts auf dem Pi selbst", () => {
    expect(loadConfig({})).toEqual({ port: 8743, autodartsUrl: "http://127.0.0.1:3180" });
  });

  test("liest PORT und AUTODARTS_URL aus der Umgebung", () => {
    expect(loadConfig({ PORT: "9000", AUTODARTS_URL: "http://raspdarts.local:3180" })).toEqual({
      port: 9000,
      autodartsUrl: "http://raspdarts.local:3180",
    });
  });
});
