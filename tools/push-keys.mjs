/* eslint-disable no-console -- a command-line tool's whole job is stdout */
/**
 * Generate a VAPID key pair for Web Push (round 29).
 *
 *   node tools/push-keys.mjs
 *
 * Prints the two secrets on separate lines. The PUBLIC value goes into Vercel
 * as VITE_PUSH_VAPID_PUBLIC_KEY (Type: Config — the public-prefix warning is
 * expected and correct, the browser needs it). The PRIVATE value stays on the
 * machine that sends: never in Vercel, never in the repo, never in chat.
 */

import { generateVapidKeys } from "./push-crypto.mjs";

const { public: pub, private: priv } = generateVapidKeys();
console.log(`PUBLIC  ${pub}`);
console.log(`PRIVATE ${priv}`);
