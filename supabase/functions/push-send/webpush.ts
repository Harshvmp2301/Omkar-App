/**
 * Web Push crypto for Deno (Supabase Edge Functions), round 33.
 *
 * The same two standards tools/push-crypto.mjs proved on the owner's machine
 * in round 29, ported from Node's crypto to the WebCrypto every Deno isolate
 * already has:
 *   - RFC 8292 / VAPID: `Authorization: vapid t=<jwt>, k=<public>`, the JWT
 *     signed ES256 with the server key. WebCrypto's ECDSA sign returns the
 *     raw r||s (P1363) form a JWT wants, so no DER conversion is needed here;
 *   - RFC 8291 + RFC 8188: the payload encrypted aes128gcm to the subscriber's
 *     p256dh key, with the WebPush HKDF info string and the roles swapped.
 *
 * The private key arrives as the raw 32-byte scalar, base64url — exactly what
 * tools/push-keys.mjs prints as PRIVATE — from the function secret
 * VAPID_PRIVATE_KEY. It never leaves this isolate.
 */

export function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array {
  const bin = atob(String(s).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

const concat = (...parts: Uint8Array[]) => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

const enc = new TextEncoder();

const hmacKey = (secret: Uint8Array) =>
  crypto.subtle.importKey("raw", secret as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

const hmac = async (key: CryptoKey, data: Uint8Array) =>
  new Uint8Array(await crypto.subtle.sign("HMAC", key, data as BufferSource));

/** HKDF-Expand (RFC 5869) with SHA-256, by hand — expand is a HMAC chain. */
async function hkdfExpand(prk: Uint8Array, info: string, length: number) {
  const key = await hmacKey(prk);
  let out = new Uint8Array(0);
  let last = new Uint8Array(0);
  for (let i = 1; out.length < length; i += 1) {
    last = await hmac(key, concat(last, enc.encode(info), new Uint8Array([i])));
    out = concat(out, last);
  }
  return out.subarray(0, length);
}

/** The VAPID JWT the push service checks: who sends, for which audience. */
export async function vapidJwt({
  endpoint,
  subject,
  privateB64url,
  publicB64url,
  now = Date.now(),
}: {
  endpoint: string;
  subject: string;
  privateB64url: string;
  publicB64url: string;
  now?: number;
}) {
  const aud = new URL(endpoint).origin;
  const header = { alg: "ES256", typ: "JWT" };
  const claims = { aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject };
  const body = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(claims)))}`;

  const d = fromB64url(privateB64url);
  const point = fromB64url(publicB64url); // 65-byte uncompressed point
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: b64url(d),
      x: b64url(point.subarray(1, 33)),
      y: b64url(point.subarray(33, 65)),
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  // WebCrypto ECDSA signs straight to raw r||s — the JWT form, no DER step.
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(body))
  );
  return { jwt: `${body}.${b64url(sig)}`, publicB64url };
}

/**
 * Encrypt one push payload (RFC 8188 aes128gcm, RFC 8291 WebPush keying).
 * Returns the complete request body: 16-byte salt, rs, keyid length, the
 * ephemeral public point, then the single encrypted record.
 */
export async function encryptPushPayload(
  plaintext: string,
  sub: { p256dh: string; auth: string }
): Promise<{ payload: Uint8Array }> {
  const ua = fromB64url(sub.p256dh);
  const authSecret = fromB64url(sub.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const local = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const localPoint = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey(
    "raw",
    ua as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256)
  );

  // RFC 8291: ikm = HKDF(salt=authSecret, ikm=ecdhSecret, "WebPush: info\0"||ua||localPoint)
  const ikmKey = await crypto.subtle.importKey(
    "raw",
    ecdhSecret as BufferSource,
    "HKDF",
    false,
    ["deriveBits"]
  );
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: authSecret as BufferSource,
        info: concat(enc.encode("WebPush: info\0"), ua, localPoint) as BufferSource,
      },
      ikmKey,
      256
    )
  );

  // RFC 8188 with the roles swapped, as RFC 8291 section 3 requires: the
  // header salt is the input keying material, ikm is the salt.
  const prk = await hmac(await hmacKey(ikm), salt);
  const cek = await hkdfExpand(prk, "Content-Encoding: aes128gcm\0", 16);
  const nonce = await hkdfExpand(prk, "Content-Encoding: nonce\0", 12);

  const cekKey = await crypto.subtle.importKey(
    "raw",
    cek as BufferSource,
    "AES-GCM",
    false,
    ["encrypt"]
  );
  const record = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as BufferSource },
      cekKey,
      concat(enc.encode(plaintext), new Uint8Array([2])) as BufferSource // last record
    )
  );

  const header = concat(
    salt,
    new Uint8Array([0, 0, 16, 0]), // rs = 4096
    new Uint8Array([65]), // one 65-byte key id follows
    localPoint
  );
  return { payload: concat(header, record) };
}
