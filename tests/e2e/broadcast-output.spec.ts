import { expect, test } from "@playwright/test"

const theme = {
  builtin: true,
  pinned: false,
  createdAt: 0,
  updatedAt: 0,
  id: "e2e-preview-match",
  name: "E2E Preview Match",
  resolution: { width: 1280, height: 720 },
  background: {
    type: "solid",
    color: "#111827",
    gradient: null,
    image: null,
  },
  textBox: {
    enabled: false,
    color: "#000000",
    opacity: 0,
    borderRadius: 0,
    padding: 0,
  },
  verseText: {
    fontFamily: "serif",
    fontSize: 56,
    fontWeight: 400,
    color: "#ffffff",
    horizontalAlign: "center",
    verticalAlign: "top",
    textTransform: "none",
    textDecoration: "none",
    lineHeight: 1.35,
    letterSpacing: 0,
    shadow: null,
    outline: null,
  },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#fbbf24",
    superscript: true,
  },
  reference: {
    fontFamily: "sans-serif",
    fontSize: 36,
    fontWeight: 600,
    color: "#fbbf24",
    horizontalAlign: "center",
    verticalAlign: "top",
    textTransform: "none",
    textDecoration: "none",
    uppercase: false,
    letterSpacing: 0,
    position: "above",
  },
  layout: {
    anchor: "center",
    offsetX: 0,
    offsetY: 0,
    padding: { top: 48, right: 72, bottom: 48, left: 72 },
    textAlign: "center",
    backgroundWidth: 100,
    backgroundHeight: 100,
    textAreaWidth: 84,
    textAreaHeight: 76,
    referenceGap: 24,
  },
  transition: {
    type: "fade",
    duration: 300,
    easing: "ease-in-out",
    direction: "up",
  },
}

const verse = {
  reference: "John 3:16 (KJV)",
  segments: [{ verseNumber: 16, text: "For God so loved the world." }],
}

const videoItem = {
  kind: "video",
  reference: "Welcome Video",
  segments: [{ text: "Welcome Video" }],
  video: {
    source: "url",
    videoId: "video-e2e",
    title: "Welcome Video",
    url: "https://cdn.example.com/welcome.mp4",
  },
}

test("broadcast output paints the same payload committed from preview", async ({ page }) => {
  await page.goto("/broadcast-output.html?output=main&e2e=1", {
    waitUntil: "domcontentloaded",
  })

  const canvas = page.locator("canvas")
  await expect(canvas).toBeVisible()

  // Fail fast (and legibly) if the page never mounts, instead of hanging the
  // full 60s test budget on the default no-timeout waitForFunction.
  await page.waitForFunction(() => Boolean(window.__SABBATHCUE_BROADCAST_TEST__), null, {
    timeout: 15_000,
  })
  await page.evaluate(
    ({ theme, item }) => {
      window.__SABBATHCUE_BROADCAST_TEST__?.render({ theme, item })
    },
    { theme, item: verse },
  )

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const canvas = document.querySelector("canvas")
        const ctx = canvas?.getContext("2d")
        if (!canvas || !ctx) return 0

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        let nonBackgroundPixels = 0
        for (let i = 0; i < imageData.length; i += 4 * 100) {
          const r = imageData[i]
          const g = imageData[i + 1]
          const b = imageData[i + 2]
          if (!(r === 17 && g === 24 && b === 39)) nonBackgroundPixels++
        }
        return nonBackgroundPixels
      }),
    )
    .toBeGreaterThan(25)

  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector("canvas")
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return null

    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let brightPixels = 0
    let goldPixels = 0

    for (let i = 0; i < data.length; i += 4 * 100) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      if (r > 220 && g > 220 && b > 220) brightPixels++
      if (r > 200 && g > 140 && b < 80) goldPixels++
    }

    return {
      width: canvas.width,
      height: canvas.height,
      brightPixels,
      goldPixels,
    }
  })

  expect(metrics).toEqual(
    expect.objectContaining({
      width: 1280,
      height: 720,
    }),
  )
  expect(metrics?.brightPixels).toBeGreaterThan(5)
  expect(metrics?.goldPixels).toBeGreaterThan(1)
})

test("broadcast output switches to the native video overlay for video payloads", async ({
  page,
}) => {
  await page.goto("/broadcast-output.html?output=main&e2e=1", {
    waitUntil: "domcontentloaded",
  })

  await page.waitForFunction(() => Boolean(window.__SABBATHCUE_BROADCAST_TEST__), null, {
    timeout: 15_000,
  })
  await page.evaluate(
    ({ theme, item }) => {
      window.__SABBATHCUE_BROADCAST_TEST__?.render({ theme, item })
    },
    { theme, item: videoItem },
  )

  const video = page.locator("video")
  await expect(video).toBeVisible()
  await expect(video).toHaveJSProperty("src", videoItem.video.url)

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const canvas = document.querySelector("canvas")
        const ctx = canvas?.getContext("2d")
        if (!canvas || !ctx) return null
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
        let blackPixels = 0
        for (let i = 0; i < data.length; i += 4 * 100) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          if (r === 0 && g === 0 && b === 0) blackPixels += 1
        }
        return blackPixels
      }),
    )
    .toBeGreaterThan(9000)
})

test("broadcast output exits a playing video through the selected transition when a non-video item replaces it", async ({
  page,
}) => {
  await page.goto("/broadcast-output.html?output=main&e2e=1", {
    waitUntil: "domcontentloaded",
  })

  await page.waitForFunction(() => Boolean(window.__SABBATHCUE_BROADCAST_TEST__), null, {
    timeout: 15_000,
  })

  // A video is live on the external monitor first.
  await page.evaluate(
    ({ theme, item }) => {
      window.__SABBATHCUE_BROADCAST_TEST__?.render({ theme, item })
    },
    { theme, item: videoItem },
  )

  const video = page.locator("video")
  await expect(video).toBeVisible()
  await expect(video).toHaveJSProperty("src", videoItem.video.url)

  // The operator pushes a non-video item live with the selected (fade)
  // transition. This is the original bug: the app updated but the external
  // monitor kept rendering the video.
  await page.evaluate(
    ({ theme, item }) => {
      window.__SABBATHCUE_BROADCAST_TEST__?.render({
        theme,
        item,
        transition: theme.transition,
      })
    },
    { theme, item: verse },
  )

  // The external monitor must not leave any visible video overlay behind. A
  // stale, still-displayed <video> (even with an empty source) renders as a
  // full-screen black box over the canvas, which is the original bug: the app
  // updated but the external monitor kept showing the (now black) video.
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          Array.from(document.querySelectorAll("video")).filter(
            (v) => getComputedStyle(v).display !== "none",
          ).length,
      ),
    )
    .toBe(0)

  // ...and paint the new scripture content on the canvas (gold reference +
  // bright verse text over the dark theme background).
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const canvas = document.querySelector("canvas")
        const ctx = canvas?.getContext("2d")
        if (!canvas || !ctx) return 0

        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
        let nonBackgroundPixels = 0
        for (let i = 0; i < data.length; i += 4 * 100) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          if (!(r === 17 && g === 24 && b === 39) && !(r === 0 && g === 0 && b === 0)) {
            nonBackgroundPixels++
          }
        }
        return nonBackgroundPixels
      }),
    )
    .toBeGreaterThan(25)
})
