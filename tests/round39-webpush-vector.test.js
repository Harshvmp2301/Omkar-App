/**
 * Round 39 guards: the sender's key derivation must match RFC 8291 exactly.
 *
 * Rounds 29-38 derived the content-encryption PRK as HMAC(ikm, salt); the
 * standard (RFC 8188 via RFC 5869) is HKDF-Extract(salt, ikm) = HMAC(salt,
 * ikm). A self-consistent round trip cannot see that difference — both ends
 * of the test share the bug — but every real browser derives the correct key,
 * fails to decrypt, and drops the push silently before any service worker
 * sees it. RFC 8291 appendix A publishes intermediate values and the final
 * ciphertext, so the order is now pinned against the standard itself.
 */
import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { encryptPushPayload, fromB64url, b64url } from "../tools/push-crypto.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

/* RFC 8291, section 5 / appendix A (whitespace removed). */
const PLAINTEXT = "When I grow up, I want to be a watermelon";
const UA_PUBLIC =
  "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
const UA_PRIVATE = "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94";
const AS_PUBLIC =
  "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
const AS_PRIVATE = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
const SALT = "DGv6ra1nlYgDCS1FRnbzlw";
const AUTH = "BTBZMqHH6r4Tts7J_aSIgg";
const RFC_IKM = "S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg";
const RFC_PRK = "09_eUZGrsvxChDCGRCdkLiDXrReGOEVeSCdCcPBSJSc";
const RFC_CEK = "oIhVW04MRdy2XN9CiKLxTg";
const RFC_NONCE = "4h_95klXJ5E_qnoN";
const RFC_HEADER =
  "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
const RFC_CIPHERTEXT =
  "8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ";

const hkdfExtract = (salt, ikm) =>
  crypto.createHmac("sha256", salt).update(ikm).digest();
const hkdfExpand = (prk, info, length) => {
  let out = Buffer.alloc(0);
  let last = Buffer.alloc(0);
  for (let i = 1; out.length < length; i += 1) {
    last = crypto
      .createHmac("sha256", prk)
      .update(Buffer.concat([last, Buffer.from(info, "latin1"), Buffer.from([i])]))
      .digest();
    out = Buffer.concat([out, last]);
  }
  return out.subarray(0, length);
};
const webPushIkm = (authSecret, shared, uaPoint, keyid) => {
  const info = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    uaPoint,
    keyid,
  ]);
  return hkdfExpand(hkdfExtract(authSecret, shared), info.toString("latin1"), 32);
};

/** The sender's fixed key pair, exactly as the RFC's example used it. */
function rfcLocalKeyPair() {
  const point = fromB64url(AS_PUBLIC);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: b64url(fromB64url(AS_PRIVATE)),
    x: b64url(point.subarray(1, 33)),
    y: b64url(point.subarray(33, 65)),
  };
  const privateKey = crypto.createPrivateKey({ key: jwk, format: "jwk" });
  return { privateKey, publicKey: crypto.createPublicKey(privateKey) };
}

/** Receiver side, written straight from RFC 8291 + RFC 8188. */
function decryptPushPayload(message, uaPrivateB64url, sub) {
  const salt = message.subarray(0, 16);
  const idlen = message[20];
  const keyid = message.subarray(21, 21 + idlen);
  const record = message.subarray(21 + idlen);
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.setPrivateKey(fromB64url(uaPrivateB64url));
  const shared = ecdh.computeSecret(keyid);
  const ikm = webPushIkm(fromB64url(sub.auth), shared, fromB64url(sub.p256dh), keyid);
  const prk = hkdfExtract(salt, ikm);
  const cek = hkdfExpand(prk, "Content-Encoding: aes128gcm\0", 16);
  const nonce = hkdfExpand(prk, "Content-Encoding: nonce\0", 12);
  const tag = record.subarray(record.length - 16);
  const body = record.subarray(0, record.length - 16);
  const dec = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(body), dec.final()]);
}

describe("round 39 — web push keying matches RFC 8291 appendix A", () => {
  it("derives the RFC's ikm, PRK, CEK and nonce in that order", () => {
    const ua = fromB64url(UA_PUBLIC);
    const ecdh = crypto.createECDH("prime256v1");
    ecdh.setPrivateKey(fromB64url(AS_PRIVATE));
    const shared = ecdh.computeSecret(ua);
    const ikm = webPushIkm(fromB64url(AUTH), shared, ua, fromB64url(AS_PUBLIC));
    expect(b64url(ikm)).toBe(RFC_IKM);
    const prk = hkdfExtract(fromB64url(SALT), ikm);
    expect(b64url(prk)).toBe(RFC_PRK);
    expect(b64url(hkdfExpand(prk, "Content-Encoding: aes128gcm\0", 16))).toBe(RFC_CEK);
    expect(b64url(hkdfExpand(prk, "Content-Encoding: nonce\0", 12))).toBe(RFC_NONCE);
  });

  it("encrypts the RFC example byte-for-byte (header + ciphertext)", () => {
    const message = encryptPushPayload(
      PLAINTEXT,
      { p256dh: UA_PUBLIC, auth: AUTH },
      { salt: fromB64url(SALT), localKeyPair: rfcLocalKeyPair() }
    );
    const expected = Buffer.concat([
      fromB64url(RFC_HEADER),
      fromB64url(RFC_CIPHERTEXT),
    ]);
    expect(b64url(message)).toBe(b64url(expected));
  });

  it("decrypts the RFC's published message back to its plaintext", () => {
    const message = Buffer.concat([
      fromB64url(RFC_HEADER),
      fromB64url(RFC_CIPHERTEXT),
    ]);
    const plain = decryptPushPayload(message, UA_PRIVATE, {
      p256dh: UA_PUBLIC,
      auth: AUTH,
    });
    expect(plain.subarray(0, plain.length - 1).toString("utf8")).toBe(PLAINTEXT);
    expect(plain[plain.length - 1]).toBe(2); // padding delimiter, last record
  });

  it("round-trips a fresh subscription end to end", () => {
    const ecdh = crypto.createECDH("prime256v1");
    ecdh.generateKeys();
    const uaPoint = ecdh.getPublicKey();
    const uaPriv = ecdh.getPrivateKey();
    const sub = { p256dh: b64url(uaPoint), auth: b64url(crypto.randomBytes(16)) };
    const text = "Round 39: the walrus and the carpenter, in Kannada and English.";
    const message = encryptPushPayload(text, sub);
    const plain = decryptPushPayload(message, b64url(uaPriv), sub);
    expect(plain.subarray(0, plain.length - 1).toString("utf8")).toBe(text);
    expect(plain[plain.length - 1]).toBe(2);
  });

  it("keeps both senders on the standard's HMAC order (static guard)", () => {
    const edge = readFileSync(
      `${root}supabase/functions/push-send/webpush.ts`,
      "utf8"
    );
    const tool = readFileSync(`${root}tools/push-crypto.mjs`, "utf8");
    expect(edge).toContain("hmacKey(salt), ikm");
    expect(edge).not.toContain("hmacKey(ikm), salt");
    expect(tool).toContain("hkdfExtract(saltBuf, ikm)");
    expect(tool).not.toContain("hkdfExtract(ikm, saltBuf)");
  });
});
