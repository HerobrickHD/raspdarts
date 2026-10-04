/**
 * Zeigt den Freigabe-Code des Geraete-Logins im Terminal an.
 *
 * Das ist der einzige Moment, in dem der Dienst etwas vom Benutzer will -
 * entsprechend deutlich darf er sein.
 */
import type { UserCodePrompt } from "./auth.js";

export function showUserCode(prompt: UserCodePrompt): void {
  const minutes = Math.round(prompt.expiresInSeconds / 60);
  const line = "=".repeat(52);

  console.log(`
${line}
  Einmalige Anmeldung bei Autodarts

  1. Oeffne im Browser:  ${prompt.verificationUri}
  2. Gib diesen Code ein:

         ${prompt.userCode}

  Direktlink (Code schon eingetragen):
  ${prompt.verificationUriComplete}

  Gueltig fuer etwa ${minutes} Minuten. Danach laeuft es von allein weiter -
  die Anmeldung wird gespeichert und beim naechsten Start wiederverwendet.
${line}
`);
}
