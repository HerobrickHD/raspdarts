/**
 * Legt die Anmelde-Tokens auf der Platte ab.
 *
 * Noetig, weil der Geraete-Login sonst bei jedem Neustart erneut eine
 * Freigabe am Handy verlangen wuerde. Das Refresh-Token ist 30 Tage gueltig
 * und wird bei jeder Erneuerung ausgetauscht - laeuft der Dienst regelmaessig,
 * meldest du dich genau einmal an.
 *
 * Die Datei enthaelt gueltige Zugangstokens und steht deshalb in .gitignore.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { TokenSet, TokenStorage } from "./auth.js";

export class FileTokenStorage implements TokenStorage {
  constructor(private readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
  }

  read(): TokenSet | null {
    try {
      const data = JSON.parse(readFileSync(this.path, "utf8")) as Partial<TokenSet>;
      if (typeof data.accessToken !== "string" || typeof data.refreshToken !== "string") {
        return null;
      }
      return {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: typeof data.expiresAt === "number" ? data.expiresAt : 0,
      };
    } catch {
      // Noch nie angemeldet oder Datei beschaedigt - dann eben neu anmelden.
      return null;
    }
  }

  write(tokens: TokenSet): void {
    writeFileSync(this.path, `${JSON.stringify(tokens, null, 2)}\n`, { mode: 0o600 });
  }
}
