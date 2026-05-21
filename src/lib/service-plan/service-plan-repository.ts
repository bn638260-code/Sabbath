import { load, type Store } from "@tauri-apps/plugin-store"
import { isTauriRuntime } from "@/lib/tauri-runtime"
import type {
  ServicePlan,
  ServicePlanRepository,
  ServicePlanSummary,
} from "@/types/service-plan"
import { isValidServicePlan } from "./service-plan-validation"

interface PersistedServicePlans {
  summaries: ServicePlanSummary[]
  plans: Record<string, ServicePlan>
}

const STORE_FILE = "service-plans.json"
const EMPTY_STATE: PersistedServicePlans = { summaries: [], plans: {} }

let tauriStore: Store | null = null
let memoryState: PersistedServicePlans = { ...EMPTY_STATE, plans: {}, summaries: [] }

async function getStore(): Promise<Store> {
  if (!tauriStore) {
    tauriStore = await load(STORE_FILE, { autoSave: false, defaults: {} })
  }
  return tauriStore
}

function canPersistWithTauriStore(): boolean {
  return isTauriRuntime() && typeof window !== "undefined"
}

async function readState(): Promise<PersistedServicePlans> {
  if (!canPersistWithTauriStore()) return memoryState

  const store = await getStore()
  const stored = await store.get<PersistedServicePlans>("data")
  if (!stored || !Array.isArray(stored.summaries) || !stored.plans) {
    return { summaries: [], plans: {} }
  }
  return stored
}

async function writeState(state: PersistedServicePlans): Promise<void> {
  memoryState = state
  if (!canPersistWithTauriStore()) return

  const store = await getStore()
  await store.set("data", state)
  await store.save()
}

function toSummary(plan: ServicePlan): ServicePlanSummary {
  const completedCount = plan.items.filter(
    (item) => item.status === "completed" || item.status === "skipped",
  ).length

  return {
    id: plan.id,
    title: plan.title,
    status: plan.status,
    scheduledAt: plan.scheduledAt,
    itemCount: plan.items.length,
    completedCount,
    templateId: plan.templateId,
    updatedAt: plan.updatedAt,
  }
}

function upsertSummary(summaries: ServicePlanSummary[], plan: ServicePlan): ServicePlanSummary[] {
  const summary = toSummary(plan)
  const without = summaries.filter((entry) => entry.id !== plan.id)
  return [summary, ...without].sort((a, b) => b.updatedAt - a.updatedAt)
}

class LocalServicePlanRepository implements ServicePlanRepository {
  async listSummaries(): Promise<ServicePlanSummary[]> {
    const state = await readState()
    return state.summaries
  }

  async loadPlan(id: string): Promise<ServicePlan | null> {
    const state = await readState()
    return state.plans[id] ?? null
  }

  async savePlan(plan: ServicePlan): Promise<void> {
    if (!isValidServicePlan(plan)) {
      throw new Error("Invalid service plan")
    }

    const state = await readState()
    state.plans[plan.id] = plan
    state.summaries = upsertSummary(state.summaries, plan)
    await writeState(state)
  }

  async duplicatePlan(id: string): Promise<ServicePlan | null> {
    const existing = await this.loadPlan(id)
    if (!existing) return null

    const now = Date.now()
    const duplicate: ServicePlan = {
      ...existing,
      id: crypto.randomUUID(),
      title: `${existing.title} (Copy)`,
      status: "draft",
      mode: "planning",
      createdAt: now,
      updatedAt: now,
      activeItemId: null,
      reportGeneratedAt: undefined,
      items: existing.items.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        status: "pending",
      })),
      eventLog: [],
    }

    await this.savePlan(duplicate)
    return duplicate
  }

  async archivePlan(id: string): Promise<void> {
    const plan = await this.loadPlan(id)
    if (!plan) return
    await this.savePlan({ ...plan, status: "archived", updatedAt: Date.now() })
  }

  async deletePlan(id: string): Promise<void> {
    const state = await readState()
    delete state.plans[id]
    state.summaries = state.summaries.filter((summary) => summary.id !== id)
    await writeState(state)
  }
}

export const servicePlanRepository: ServicePlanRepository = new LocalServicePlanRepository()

export function resetServicePlanRepositoryForTests(): void {
  memoryState = { summaries: [], plans: {} }
  tauriStore = null
}

export function seedServicePlanRepositoryForTests(plan: ServicePlan): void {
  memoryState.plans[plan.id] = plan
  memoryState.summaries = upsertSummary(memoryState.summaries, plan)
}
