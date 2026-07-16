import { generateKeyPairSync } from "node:crypto"

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
})

const privateKeyBase64 = privateKey
  .export({ format: "der", type: "pkcs8" })
  .toString("base64")
const publicKeyBase64 = publicKey
  .export({ format: "der", type: "spki" })
  .toString("base64")

process.stdout.write(
  [
    "Store this only as a Supabase Edge Function secret:",
    `ACTIVATION_LEASE_PRIVATE_KEY=${privateKeyBase64}`,
    "",
    "Add this public value to the desktop build environment:",
    `VITE_ACTIVATION_LEASE_PUBLIC_KEY=${publicKeyBase64}`,
    "",
  ].join("\n")
)
