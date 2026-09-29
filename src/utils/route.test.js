import { describe, expect, it } from "vitest";
import { TABS, tabFromHash } from "./route.js";

/** Stand-in for window.location — the function only reads hash and search. */
const at = (hash, search = "") => ({ hash, search });

describe("tabFromHash", () => {
  it("reads an ordinary fragment route", () => {
    expect(tabFromHash(at("#/gallery"))).toBe("gallery");
    expect(tabFromHash(at("#gallery"))).toBe("gallery");
    expect(tabFromHash(at("#/seva"))).toBe("seva");
  });

  it("opens the dashboard for #/admin", () => {
    expect(tabFromHash(at("#/admin"))).toBe("admin");
  });

  it("opens the dashboard when sign-in returns to ?admin=1", () => {
    expect(tabFromHash(at("", "?admin=1"))).toBe("admin");
  });

  it("stays on the dashboard while the auth callback is still in the URL", () => {
    // implicit flow: tokens in the fragment
    expect(tabFromHash(at("#access_token=abc&refresh_token=def"))).toBe("admin");
    // PKCE flow: a code in the query
    expect(tabFromHash(at("", "?code=abc123"))).toBe("admin");
    // the old double-hash shape, in case a bookmark or cached URL survives
    expect(tabFromHash(at("#/admin#access_token=abc"))).toBe("admin");
    // a refused sign-in still belongs on the dashboard, where the reason is shown
    expect(tabFromHash(at("", "?error_description=access_denied"))).toBe("admin");
  });

  it("lets a real tab win over the sign-in marker, so Back to site works", () => {
    expect(tabFromHash(at("#/hub", "?admin=1"))).toBe("hub");
    expect(tabFromHash(at("#/gallery", "?admin=1"))).toBe("gallery");
  });

  it("keeps the legacy deep-links behaving", () => {
    expect(tabFromHash(at("#/contact"))).toBe("about");
    expect(tabFromHash(at("#/donate"))).toBe("hub"); // retired: donations are not accepted
  });

  it("falls back to the hub for anything else", () => {
    expect(tabFromHash(at(""))).toBe("hub");
    expect(tabFromHash(at("#/nonsense"))).toBe("hub");
    expect(tabFromHash(null)).toBe("hub");
  });

  it("only ever returns a tab the app can render", () => {
    const everyShape = [
      at(""), at("#"), at("#/"), at("#/admin"), at("", "?admin=1"),
      at("#access_token=x"), at("", "?code=x"), at("#/hub", "?admin=1"),
      at("#/donate"), at("#/contact"), at("#/events"), at("?admin=0"),
    ];
    for (const loc of everyShape) {
      const tab = tabFromHash(loc);
      expect([...TABS, "admin"]).toContain(tab);
    }
  });
});
