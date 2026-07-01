// Renders each kinetic-backgrounds carousel slide as a 9:16 PNG (one still per
// frame of the CarouselKinetic composition) into out/carousel-kinetic/slide-NN.png.
//
// Run: npm run render:carousel:kinetic
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const TOTAL = 4;
const OUT_DIR = "out/carousel-kinetic";

mkdirSync(OUT_DIR, { recursive: true });

for (let i = 0; i < TOTAL; i++) {
  const file = `${OUT_DIR}/slide-${String(i + 1).padStart(2, "0")}.png`;
  console.log(`Rendering ${file} (frame ${i})`);
  execSync(`npx remotion still CarouselKinetic "${file}" --frame=${i}`, { stdio: "inherit" });
}

console.log(`\nDone — ${TOTAL} slides in ${OUT_DIR}/`);
