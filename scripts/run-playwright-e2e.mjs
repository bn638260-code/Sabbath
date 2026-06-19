import { spawn } from "node:child_process"
import http from "node:http"
import path from "node:path"

const root = process.cwd()
const previewUrl = "http://127.0.0.1:3000/broadcast-output.html?output=main&e2e=1"
const isWindows = process.platform === "win32"

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      ...options,
    })
    child.on("error", reject)
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${command} ${args.join(" ")} failed with ${signal ?? code}`))
    })
  })
}

function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const probe = () => {
      const req = http.get(url, (res) => {
        res.resume()
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve()
          return
        }
        retry()
      })
      req.on("error", retry)
      req.setTimeout(2_000, () => {
        req.destroy()
        retry()
      })
    }

    const retry = () => {
      if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for ${url}`))
        return
      }
      setTimeout(probe, 500)
    }

    probe()
  })
}

function stopProcess(child) {
  if (!child || child.killed) return Promise.resolve()
  if (isWindows && child.pid) {
    return run("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    }).catch(() => {})
  }
  child.kill("SIGTERM")
  return Promise.resolve()
}

let preview
let exitCode = 0

try {
  await run(
    isWindows ? "cmd.exe" : "npm",
    isWindows ? ["/c", "npm.cmd", "run", "build"] : ["run", "build"],
  )

  preview = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/vite/bin/vite.js"),
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "3000",
    ],
    {
      cwd: root,
      stdio: "inherit",
    },
  )
  preview.on("error", (error) => {
    console.error(error)
  })

  await waitForUrl(previewUrl, 60_000)
  await run(
    process.execPath,
    [
      path.join(root, "node_modules/@playwright/test/cli.js"),
      "test",
      ...process.argv.slice(2),
    ],
    {
      env: {
        ...process.env,
        SABBATHCUE_E2E_EXTERNAL_SERVER: "1",
      },
    },
  )
} catch (error) {
  console.error(error)
  exitCode = 1
} finally {
  await stopProcess(preview)
  process.exit(exitCode)
}
