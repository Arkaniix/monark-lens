import { afterEach, describe, expect, it } from "vitest";

import { requestSnapshot } from "./snapshot-client";
import type { ListingContext } from "./snapshot-client";

const ctx: ListingContext = {
  platform: "leboncoin",
  url: "https://www.leboncoin.fr/ad/x/1",
  componentId: 3,
  componentName: "RTX 3060",
  askingPrice: 200,
  condition: "good",
  intentType: "sale",
};

type ChromeLike = { runtime: { sendMessage: (m: unknown) => Promise<unknown> } };
function setChrome(c: ChromeLike | undefined): void {
  const g = globalThis as unknown as { chrome?: ChromeLike };
  if (c === undefined) delete g.chrome;
  else g.chrome = c;
}
const reply = (resp: unknown): ChromeLike => ({ runtime: { sendMessage: () => Promise.resolve(resp) } });

afterEach(() => setChrome(undefined));

describe("requestSnapshot — forward du status (402/401 doivent rester atteignables)", () => {
  it("réponse OK → { ok:true, data }", async () => {
    setChrome(reply({ ad_hash: "h", state: "reliable", credits_remaining: 5 }));
    const r = await requestSnapshot(ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.state).toBe("reliable");
  });

  it("erreur AVEC status (402) → status préservé pour l'overlay", async () => {
    setChrome(reply({ error: "Snapshot failed (402)", status: 402 }));
    const r = await requestSnapshot(ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(402);
  });

  it("erreur SANS status (Not authenticated) → ok:false sans status", async () => {
    setChrome(reply({ error: "Not authenticated" }));
    const r = await requestSnapshot(ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBeUndefined();
      expect(r.error).toBe("Not authenticated");
    }
  });

  it("sendMessage rejette → état erreur réseau (ne jette pas)", async () => {
    setChrome({ runtime: { sendMessage: () => Promise.reject(new Error("boom")) } });
    const r = await requestSnapshot(ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("boom");
  });
});
