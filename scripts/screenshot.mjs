// Dev-only visual-review helper: captures the controller in dark + light mode
// against the running Vite dev server with the demo seed enabled.
//
//   bun run dev            # in one terminal (serves :3000)
//   node scripts/screenshot.mjs
//
// Output: tmp/ui-shots/{dark,light}.png
import { chromium } from "@playwright/test"
import { mkdir } from "node:fs/promises"

const URL = process.env.SHOT_URL ?? "http://localhost:3000/?demo=1"
const OUT = "tmp/ui-shots"

const browser = await chromium.launch()
try {
  await mkdir(OUT, { recursive: true })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  // Vite keeps an HMR socket open, so `networkidle` never fires — use
  // domcontentloaded and then wait for the seeded content to render.
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 })
  await page.getByText("Good morning, church family", { exact: false }).waitFor({
    timeout: 45000,
  })
  await page.waitForTimeout(1400) // let fonts + entrance animation settle

  await page.screenshot({ path: `${OUT}/dark.png` })
  console.log(`wrote ${OUT}/dark.png`)

  const toLight = page.locator('[aria-label="Switch to light mode"]').first()
  if (await toLight.count()) {
    await toLight.click()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/light.png` })
    console.log(`wrote ${OUT}/light.png`)
  } else {
    console.warn("light-mode toggle not found; skipped light screenshot")
  }
} finally {
  await browser.close()
}
