// Renders each carousel slide as a PNG (one still per frame of the Carousel
// composition) into out/carousel/slide-NN.png.
//
// Run: npm run render:carousel
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const TOTAL = 7;
const OUT_DIR = "out/carousel";

mkdirSync(OUT_DIR, { recursive: true });

for (let i = 0; i < TOTAL; i++) {
  const file = `${OUT_DIR}/slide-${String(i + 1).padStart(2, "0")}.png`;
  console.log(`Rendering ${file} (frame ${i})`);
  execSync(`npx remotion still Carousel "${file}" --frame=${i}`, { stdio: "inherit" });
}

console.log(`\nDone — ${TOTAL} slides in ${OUT_DIR}/`);
