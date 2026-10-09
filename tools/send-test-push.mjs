/* eslint-disable no-console -- a command-line tool's whole job is stdout */
/**
 * Send ONE test push, from your own machine, with zero packages installed.
 *
 *   node tools/send-test-push.mjs --private <PRIVATE> --public <PUBLIC> --sub subscription.json
 *     [--subject mailto:you@example.com] [--title ...] [--body ...] [--url /]
 *   node tools/send-test-push.mjs ... --title "Test" --body "Hello from PowerShell"
 *
 * subscription.json is the JSON the admin dashboard's "Copy subscription"
 * button puts on your clipboard (endpoint, keys.p256dh, keys.auth). The push
 * service (FCM for Chrome) is called directly over HTTPS; a 201/202 response
 * means accepted for delivery. The private key never leaves this process.
 */

import { readFile } from "node:fs/promises";
import { encryptPushPayload, vapidJwt } from "./push-crypto.mjs";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? "" : args[i + 1] || "";
};

const subFile = opt("sub");
const privateKey = opt("private");
const subject = opt("subject") || "mailto:push@omkar-samithi.example";
const title = opt("title") || "Omkar Samithi";
const body = opt("body") || "This is a test notification.";
const url = opt("url") || "/";

if (!subFile || !privateKey) {
  console.error("usage: node tools/send-test-push.mjs --private <key> --public <pub> --sub <subscription.json> [--subject mailto:...] [--title ...] [--body ...] [--url /]");
  process.exit(2);
}

const sub = JSON.parse(await readFile(subFile, "utf8"));
const endpoint = sub.endpoint;
const p256dh = sub.keys && sub.keys.p256dh;
const auth = sub.keys && sub.keys.auth;
if (!endpoint || !p256dh || !auth) {
  console.error("subscription.json must carry endpoint and keys.p256dh / keys.auth");
  process.exit(2);
}

// The vapid k= value is the sender's public key; Node cannot derive it from
// the private scalar alone, so push-keys.mjs prints both halves of the pair.
const publicB64url = opt("public");
if (!publicB64url) {
  console.error("also pass --public <PUBLIC> from the tools/push-keys.mjs output");
  process.exit(2);
}

const { jwt } = vapidJwt({ endpoint, subject, privateB64url: privateKey, publicB64url });
const encrypted = encryptPushPayload(JSON.stringify({ title, body, url, tag: "omkar-test" }), {
  p256dh,
  auth,
});

const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/octet-stream",
    "Content-Encoding": "aes128gcm",
    TTL: "60",
    Urgency: "normal",
    Authorization: `vapid t=${jwt}, k=${publicB64url}`,
  },
  body: encrypted,
});

console.log(`push service said: ${res.status} ${res.statusText}`);
if (!res.ok && res.status !== 202) {
  console.error(await res.text().catch(() => ""));
  process.exit(1);
}
