import { describe, expect, test } from "vitest";
import { describeAuthFailure } from "../src/auth.js";

describe("describeAuthFailure", () => {
  test("weist bei unbekannter Client-ID auf die richtige Stellschraube hin", () => {
    const message = describeAuthFailure(400, '{"error":"invalid_client"}');

    expect(message).toMatch(/AUTODARTS_CLIENT_ID/);
  });

  test("macht bei HTTP 522 klar, dass es nicht an den Zugangsdaten liegt", () => {
    // Cloudflare meldet 522, wenn login.autodarts.io selbst nicht antwortet.
    // Die Zugangsdaten wurden dabei nie geprueft - ein Hinweis auf die .env
    // waere eine falsche Faehrte.
    const message = describeAuthFailure(522, "<!DOCTYPE html><title>522</title>");

    expect(message).toMatch(/nicht erreichbar/i);
    expect(message).not.toMatch(/AUTODARTS_CLIENT_ID/);
  });

  test("behandelt jeden Serverfehler als Stoerung, nicht als Tippfehler", () => {
    for (const status of [500, 502, 503, 504]) {
      expect(describeAuthFailure(status, "")).toMatch(/nicht erreichbar/i);
    }
  });

  test("schuettet keine HTML-Fehlerseite ins Terminal", () => {
    const html = `<!DOCTYPE html><html><body>${"x".repeat(5000)}</body></html>`;

    const message = describeAuthFailure(522, html);

    expect(message).not.toMatch(/<html|DOCTYPE|<body/i);
    expect(message.length).toBeLessThan(400);
  });

  test("zeigt eine kurze Textantwort des Servers, weil sie hilfreich ist", () => {
    const message = describeAuthFailure(400, "invalid_grant: account disabled");

    expect(message).toMatch(/account disabled/);
  });
});
