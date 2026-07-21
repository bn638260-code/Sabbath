import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist");

mkdirSync(out, { recursive: true });
for (const name of ["index.html", "favicon.svg"]) {
  cpSync(join(root, name), join(out, name));
}
if (existsSync(join(root, "assets"))) {
  cpSync(join(root, "assets"), join(out, "assets"), { recursive: true });
}
