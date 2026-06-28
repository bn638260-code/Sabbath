// Renders each Afrikaans-announcement carousel slide as a 9:16 PNG (one still per
// frame of the CarouselAfr composition) into out/carousel-afr/slide-NN.png.
//
// Run: npm run render:carousel:afr
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const TOTAL = 3;
const OUT_DIR = "out/carousel-afr";

mkdirSync(OUT_DIR, { recursive: true });

for (let i = 0; i < TOTAL; i++) {
  const file = `${OUT_DIR}/slide-${String(i + 1).padStart(2, "0")}.png`;
  console.log(`Rendering ${file} (frame ${i})`);
  execSync(`npx remotion still CarouselAfr "${file}" --frame=${i}`, { stdio: "inherit" });
}

console.log(`\nDone — ${TOTAL} slides in ${OUT_DIR}/`);
