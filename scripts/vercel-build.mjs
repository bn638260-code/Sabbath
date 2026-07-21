import { cpSync, mkdirSync, rmSync } from "node:fs"
import { execSync } from "node:child_process"

const project = process.env.VERCEL_PROJECT_NAME ?? ""
const knfcStaticProjects = new Set(["knfcpilot", "knfcsabbathcue"])
const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? ""

function isKnfcPilotStaticDeploy() {
  if (knfcStaticProjects.has(project)) return true
  return productionUrl.includes("knfcpilot.vercel.app")
}

rmSync("dist", { recursive: true, force: true })
mkdirSync("dist", { recursive: true })

if (isKnfcPilotStaticDeploy()) {
  cpSync("landing-knfcpilot/index.html", "dist/index.html")
  cpSync("landing-knfcpilot/favicon.svg", "dist/favicon.svg")
  cpSync("landing-knfcpilot/assets", "dist/assets", { recursive: true })
  console.log(
    `[vercel-build] Published static KNFC landing to dist/ (project=${project || "unknown"}, production=${productionUrl || "n/a"})`
  )
  process.exit(0)
}

console.log(`[vercel-build] Project "${project}" — running Vite build`)
execSync("npm run build", { stdio: "inherit" })
cpSync("build", "dist", { recursive: true })
console.log("[vercel-build] Copied build/ to dist/")
