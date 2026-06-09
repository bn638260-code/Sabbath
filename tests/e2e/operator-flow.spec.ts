import { expect, test } from "@playwright/test"

const e2eTheme = {
  builtin: true,
  pinned: false,
  createdAt: 0,
  updatedAt: 0,
  id: "e2e-operator-theme",
  name: "E2E Operator Theme",
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

test.describe("operator flow harness", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?e2e=1", { waitUntil: "domcontentloaded" })
    await page.waitForFunction(() => Boolean(window.__SABBATHCUE_OPERATOR_E2E__))
  })

  test("queue next and prev navigation updates active index and live reference", async ({ page }) => {
    await page.evaluate(() => {
      const harness = window.__SABBATHCUE_OPERATOR_E2E__!
      harness.queue.clear()
      harness.queue.addItems([
        {
          id: "q1",
          confidence: 1,
          source: "manual",
          added_at: 0,
          presentation: {
            kind: "scripture",
            reference: "John 3:16 (KJV)",
            verse: {
              id: 1,
              translation_id: 1,
              book_number: 43,
              book_name: "John",
              book_abbreviation: "Jn",
              chapter: 3,
              verse: 16,
              text: "For God so loved the world.",
            },
          },
        },
        {
          id: "q2",
          confidence: 1,
          source: "manual",
          added_at: 0,
          presentation: {
            kind: "scripture",
            reference: "John 3:17 (KJV)",
            verse: {
              id: 2,
              translation_id: 1,
              book_number: 43,
              book_name: "John",
              book_abbreviation: "Jn",
              chapter: 3,
              verse: 17,
              text: "For God sent not his Son.",
            },
          },
        },
      ])
      harness.queue.setActive(0)
      harness.remote.show()
      harness.remote.next()
    })

    await expect
      .poll(async () => page.evaluate(() => window.__SABBATHCUE_OPERATOR_E2E__!.snapshot()))
      .toEqual(
        expect.objectContaining({
          activeIndex: 1,
          liveReference: "John 3:17 (KJV)",
          isLive: true,
        }),
      )

    await page.evaluate(() => window.__SABBATHCUE_OPERATOR_E2E__!.remote.prev())

    await expect
      .poll(async () => page.evaluate(() => window.__SABBATHCUE_OPERATOR_E2E__!.snapshot()))
      .toEqual(
        expect.objectContaining({
          activeIndex: 0,
          liveReference: "John 3:16 (KJV)",
        }),
      )
  })

  test("go-live and hide toggles live state", async ({ page }) => {
    await page.evaluate(() => {
      const harness = window.__SABBATHCUE_OPERATOR_E2E__!
      harness.live.goLive()
    })

    await expect
      .poll(async () => page.evaluate(() => window.__SABBATHCUE_OPERATOR_E2E__!.snapshot().isLive))
      .toBe(true)

    await page.evaluate(() => window.__SABBATHCUE_OPERATOR_E2E__!.live.hide())

    await expect
      .poll(async () => page.evaluate(() => window.__SABBATHCUE_OPERATOR_E2E__!.snapshot().isLive))
      .toBe(false)
  })

  test("detection preview and queue flow updates preview and queue length", async ({ page }) => {
    const detection = {
      verse_ref: "John 3:16 (KJV)",
      book_number: 43,
      book_name: "John",
      chapter: 3,
      verse: 16,
      verse_text: "For God so loved the world.",
      confidence: 0.95,
      source: "direct",
      auto_queued: true,
      transcript_snippet: "For God so loved the world",
      is_chapter_only: false,
    }

    await page.evaluate((payload) => {
      const harness = window.__SABBATHCUE_OPERATOR_E2E__!
      harness.detection.add(payload)
      harness.detection.previewFromDetection(payload)
      harness.detection.queueFromDetection(payload)
    }, detection)

    await expect
      .poll(async () => page.evaluate(() => window.__SABBATHCUE_OPERATOR_E2E__!.snapshot()))
      .toEqual(
        expect.objectContaining({
          previewReference: "John 3:16 (KJV)",
          queueLength: 1,
          detectionCount: 1,
        }),
      )
  })

  test("theme switch updates active theme id and renders on broadcast output", async ({
    page,
    context,
  }) => {
    const verse = {
      reference: "John 3:16 (KJV)",
      segments: [{ verseNumber: 16, text: "For God so loved the world." }],
    }

    await page.evaluate((theme) => {
      const harness = window.__SABBATHCUE_OPERATOR_E2E__!
      harness.theme.add(theme)
      harness.remote.setTheme(theme.name)
    }, e2eTheme)

    await expect
      .poll(async () =>
        page.evaluate(() => window.__SABBATHCUE_OPERATOR_E2E__!.snapshot().activeThemeId),
      )
      .toBe("e2e-operator-theme")

    const payload = await page.evaluate(() => {
      const harness = window.__SABBATHCUE_OPERATOR_E2E__!
      return harness.broadcast.getPayload()
    })
    expect(payload.theme.id).toBe("e2e-operator-theme")
    expect(payload.theme.resolution).toEqual({ width: 1280, height: 720 })

    const broadcastPage = await context.newPage()
    await broadcastPage.goto("/broadcast-output.html?output=main&e2e=1", {
      waitUntil: "domcontentloaded",
    })
    await broadcastPage.waitForFunction(() => Boolean(window.__SABBATHCUE_BROADCAST_TEST__))
    await broadcastPage.evaluate(
      ({ theme, item }) => {
        window.__SABBATHCUE_BROADCAST_TEST__?.render({ theme, item })
      },
      { theme: e2eTheme, item: verse },
    )

    await expect
      .poll(async () =>
        broadcastPage.evaluate(() => {
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

    await broadcastPage.close()
  })
})
