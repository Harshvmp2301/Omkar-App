/**
 * Web Push crypto with nothing but Node's own crypto (round 29).
 *
 * Two standards, by hand, so the owner can send a test push from PowerShell
 * without installing a single package:
 *   - RFC 8292 / VAPID: a JWT signed with the server's P-256 key, sent as
 *     `Authorization: vapid t=<jwt>, k=<public>`;
 *   - RFC 8291 + RFC 8188: the payload, encrypted with aes128gcm to the
 *     subscriber's p256dh key.
 *
 * Every function takes its randomness or keys as arguments where a test needs
 * determinism, and the sender script wires them to real random bytes.
 */

import crypto from "node:crypto";

export const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const fromB64url = (s) =>
  Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

/** A fresh VAPID key pair: raw P-256 point and scalar, base64url. */
export function generateVapidKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "P-256",
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });
  const pub = crypto.createPublicKey({ key: publicKey, format: "der", type: "spki" });
  const priv = crypto.createPrivateKey({ key: privateKey, format: "der", type: "pkcs8" });
  const pubJwk = pub.export({ format: "jwk" });
  const privJwk = priv.export({ format: "jwk" });
  const x = fromB64url(pubJwk.x);
  const y = fromB64url(pubJwk.y);
  const point = Buffer.concat([Buffer.from([4]), x, y]); // uncompressed point
  return { public: b64url(point), private: b64url(fromB64url(privJwk.d)) };
}


/** DER ECDSA signature -> raw r||s (what JWTs and Web Push expect). */
export function derToP1363(der) {
  // SEQUENCE len [INTEGER len r] [INTEGER len s]
  let i = 2;
  if (der[1] & 0x80) i += der[1] & 0x7f;
  const readInt = () => {
    if (der[i] !== 2) throw new Error("bad DER integer");
    const len = der[i + 1];
    let start = i + 2;
    const end = start + len;
    while (der[start] === 0 && end - start > 1) start += 1; // strip sign pad
    const value = der.subarray(start, end);
    i = end;
    const out = Buffer.alloc(32);
    value.copy(out, 32 - value.length); // left-pad to 32
    return out;
  };
  return Buffer.concat([readInt(), readInt()]);
}

/** raw r||s -> DER, the mirror image, for tests and for picky verifiers. */
export function p1363ToDer(raw) {
  const int = (half) => {
    let value = half;
    while (value.length > 1 && value[0] === 0) value = value.subarray(1);
    const pad = value[0] & 0x80 ? Buffer.from([0]) : Buffer.alloc(0);
    const body = Buffer.concat([pad, value]);
    return Buffer.concat([Buffer.from([2, body.length]), body]);
  };
  const body = Buffer.concat([int(raw.subarray(0, 32)), int(raw.subarray(32))]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

/** The JWT the push service checks: who is sending, for which audience. */
export function vapidJwt({ endpoint, subject, privateB64url, publicB64url, now = Date.now() }) {
  const aud = new URL(endpoint).origin;
  const header = { alg: "ES256", typ: "JWT" };
  const claims = { aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject };
  const body = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const d = fromB64url(privateB64url);
  const point = fromB64url(publicB64url);
  const key = crypto.createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: b64url(d),
      x: b64url(point.subarray(1, 33)),
      y: b64url(point.subarray(33, 65)),
    },
    format: "jwk",
  });
  const sig = crypto.sign("sha256", Buffer.from(body), key);
  // Node signs ECDSA in DER; a JWT wants raw r||s, 64 bytes.
  return { jwt: `${body}.${b64url(derToP1363(sig))}`, publicB64url };
}

const hkdfExtract = (salt, ikm) =>
  crypto.createHmac("sha256", salt.length ? salt : Buffer.alloc(32)).update(ikm).digest();
const hkdfExpand = (prk, info, length) => {
  let out = Buffer.alloc(0);
  let last = Buffer.alloc(0);
  for (let i = 1; out.length < length; i += 1) {
    last = crypto.createHmac("sha256", prk).update(Buffer.concat([last, Buffer.from(info), Buffer.from([i])])).digest();
    out = Buffer.concat([out, last]);
  }
  return out.subarray(0, length);
};
const hkdf = (salt, ikm, info, length) => hkdfExpand(hkdfExtract(salt, ikm), info, length);

/**
 * Encrypt one push payload (RFC 8188 aes128gcm, RFC 8291 WebPush keys).
 * `salt` and the local key pair are injectable so tests can decrypt again.
 */
export function encryptPushPayload(plaintext, { p256dh, auth }, { salt, localKeyPair } = {}) {
  const ua = fromB64url(p256dh);
  const authSecret = fromB64url(auth);
  const saltBuf = salt || crypto.randomBytes(16);

  const local = localKeyPair || crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const localPubJwk = local.publicKey.export({ format: "jwk" });
  const localPoint = Buffer.concat([
    Buffer.from([4]),
    fromB64url(localPubJwk.x),
    fromB64url(localPubJwk.y),
  ]);

  const ecdh = crypto.createECDH("prime256v1");
  ecdh.setPrivateKey(fromB64url(local.privateKey.export({ format: "jwk" }).d));
  const ecdhSecret = ecdh.computeSecret(ua);

  // RFC 8291: ikm = HKDF(salt=authSecret, ikm=ecdhSecret, "WebPush: info\0"||ua||localPoint)
  const info = Buffer.concat([Buffer.from("WebPush: info\0"), ua, localPoint]);
  const ikm = hkdf(authSecret, ecdhSecret, info, 32);

  // RFC 8188 with the roles swapped, as RFC 8291 section 3 requires:
  // the header salt is the input keying material, ikm is the salt.
  const prk = hkdfExtract(ikm, saltBuf);
  const cek = hkdfExpand(prk, "Content-Encoding: aes128gcm\0", 16);
  const nonce = hkdfExpand(prk, "Content-Encoding: nonce\0", 12);

  const body = Buffer.concat([Buffer.from(plaintext, "utf8"), Buffer.from([2])]); // last record
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const record = Buffer.concat([cipher.update(body), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.concat([
    saltBuf,
    Buffer.from([0, 0, 16, 0]), // rs = 4096
    Buffer.from([65]), // idlen: one key id follows
    localPoint,
  ]);
  return Buffer.concat([header, record]);
}
