import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import {
  b64url,
  fromB64url,
  generateVapidKeys,
  vapidJwt,
  encryptPushPayload,
  p1363ToDer,
} from "../tools/push-crypto.mjs";

/* Round 29: the test-push path. The crypto is hand-rolled on purpose (zero
   packages), so it gets the deepest testing: a real decrypt-back round trip,
   a real signature verification, and structural checks on the wire format. */

describe("VAPID keys come out in the shape browsers and push services expect", () => {
  it("makes an 87-char public point and a 43-char private scalar", () => {
    const { public: pub, private: priv } = generateVapidKeys();
    expect(pub).toMatch(/^[AB][0-9A-Za-z_-]{86}$/);
    expect(priv).toMatch(/^[0-9A-Za-z_-]{43}$/);
    expect(fromB64url(pub)[0]).toBe(4); // uncompressed P-256 point
    expect(fromB64url(priv).length).toBe(32);
  });
});

describe("the VAPID JWT signs and verifies", () => {
  it("carries audience, expiry and subject, and its signature checks", () => {
    const { public: pub, private: priv } = generateVapidKeys();
    const endpoint = "https://fcm.googleapis.com/fcm/send/some-token";
    const { jwt } = vapidJwt({
      endpoint,
      subject: "mailto:test@example.com",
      privateB64url: priv,
      publicB64url: pub,
      now: 1_700_000_000_000,
    });
    const [h, c, sig] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "ES256", typ: "JWT" });
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toBe("mailto:test@example.com");
    expect(claims.exp).toBe(1_700_000_000 + 43200);

    // raw r||s back to DER, then verify with the public point
    const der = p1363ToDer(Buffer.from(sig, "base64url"));
    const point = fromB64url(pub);
    const key = crypto.createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: b64url(point.subarray(1, 33)),
        y: b64url(point.subarray(33, 65)),
      },
      format: "jwk",
    });
    const ok = crypto.verify("sha256", Buffer.from(`${h}.${c}`), key, der);
    expect(ok).toBe(true);
  });
});

describe("the encrypted payload is RFC 8188 aes128gcm, and decrypts back", () => {
  const subscriber = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const subPub = subscriber.publicKey.export({ format: "jwk" });
  const p256dh = b64url(
    Buffer.concat([Buffer.from([4]), fromB64url(subPub.x), fromB64url(subPub.y)])
  );
  const auth = b64url(crypto.randomBytes(16));
  const salt = crypto.randomBytes(16);
  const localKeyPair = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });

  const plaintext = JSON.stringify({ title: "Omkar Samithi", body: "Test", url: "/", tag: "omkar-test" });
  const packet = encryptPushPayload(plaintext, { p256dh, auth }, { salt, localKeyPair });

  it("writes the 21-byte header plus the 65-byte key id", () => {
    expect(packet.subarray(0, 16).equals(salt)).toBe(true);
    expect(packet.readUInt32BE(16)).toBe(4096);
    expect(packet[20]).toBe(65);
    expect(packet[21]).toBe(4); // uncompressed local point follows
  });

  it("round-trips: the subscriber can read exactly what was sent", () => {
    const localPoint = packet.subarray(21, 21 + 65);
    const record = packet.subarray(21 + 65);

    // subscriber side: ECDH with the sender's point, then RFC 8291 -> 8188
    const ecdh = crypto.createECDH("prime256v1");
    ecdh.setPrivateKey(fromB64url(subscriber.privateKey.export({ format: "jwk" }).d));
    const ecdhSecret = ecdh.computeSecret(localPoint);
    const hmac = (s, d) => crypto.createHmac("sha256", s).update(d).digest();
    const expand = (prk, info, len) => {
      let out = Buffer.alloc(0);
      let last = Buffer.alloc(0);
      for (let i = 1; out.length < len; i += 1) {
        last = hmac(prk, Buffer.concat([last, Buffer.from(info), Buffer.from([i])]));
        out = Buffer.concat([out, last]);
      }
      return out.subarray(0, len);
    };
    const info = Buffer.concat([Buffer.from("WebPush: info\0"), fromB64url(p256dh), localPoint]);
    const ikm = expand(hmac(fromB64url(auth), ecdhSecret), info, 32);
    const prk = hmac(ikm, salt);
    const cek = expand(prk, "Content-Encoding: aes128gcm\0", 16);
    const nonce = expand(prk, "Content-Encoding: nonce\0", 12);

    const tag = record.subarray(record.length - 16);
    const decipher = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
    decipher.setAuthTag(tag);
    const body = Buffer.concat([
      decipher.update(record.subarray(0, record.length - 16)),
      decipher.final(),
    ]);
    expect(body[body.length - 1]).toBe(2); // last-record delimiter
    expect(body.subarray(0, body.length - 1).toString("utf8")).toBe(plaintext);
  });
});

describe("the pieces are wired where the browser looks for them", () => {
  const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  const push = readFileSync(new URL("../src/utils/push.js", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../src/admin/views/PushAdmin.jsx", import.meta.url), "utf8");
  const supabase = readFileSync(new URL("../src/utils/supabase.js", import.meta.url), "utf8");
  const admin = readFileSync(new URL("../src/admin/AdminApp.jsx", import.meta.url), "utf8");
  const sender = readFileSync(new URL("../tools/send-test-push.mjs", import.meta.url), "utf8");

  it("service worker renders push and opens the app on click", () => {
    expect(sw).toContain('addEventListener("push"');
    expect(sw).toContain('addEventListener("notificationclick"');
    expect(sw).toContain("showNotification");
    expect(sw).toContain("clients.openWindow");
  });

  it("never asks for permission outside the admin panel", () => {
    expect(push).not.toContain("requestPermission");
    expect(panel).toContain("Notification.requestPermission");
  });

  it("stays switched off without a VAPID key, and says so", () => {
    expect(push).toContain("VITE_PUSH_VAPID_PUBLIC_KEY");
    expect(push).toContain("pushConfigured");
    expect(push).toContain("userVisibleOnly: true");
  });

  it("stores subscriptions insert-only, upserted by endpoint", () => {
    expect(supabase).toContain("push_subscriptions");
    expect(supabase).toContain("resolution=merge-duplicates,return=minimal");
    expect(supabase).toContain("deletePushSubscription");
  });

  it("gives the dashboard a Push tab", () => {
    expect(admin).toContain('id: "push"');
    expect(admin).toContain("PushAdmin");
  });

  it("sends with the modern single Authorization header and a TTL", () => {
    expect(sender).toContain("Authorization: `vapid t=${jwt}, k=${publicB64url}`");
    expect(sender).toContain('TTL: "60"');
    expect(sender).toContain('"Content-Encoding": "aes128gcm"');
  });
});
