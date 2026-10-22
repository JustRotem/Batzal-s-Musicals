// Generates the Ed25519 key pair for single sign-on.
//   node scripts/generate-sso-key.mjs
// Put SSO_PRIVATE_KEY in the app's environment (never commit it). The public key is served at /api/sso/public-key.
import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();

console.log(`SSO_PRIVATE_KEY="${Buffer.from(privatePem).toString("base64")}"`);
console.log("");
console.log(publicPem);
