import { defineConfig, devices } from "@playwright/test"

const previewBaseUrl = "http://127.0.0.1:3000"
const broadcastEntryUrl = `${previewBaseUrl}/broadcast-output.html?output=main&e2e=1`

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: previewBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run build && npx vite preview --host 127.0.0.1 --port 3000",
    url: broadcastEntryUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
