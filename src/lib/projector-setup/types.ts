/**
 * A snapshot of the last display setup that was confirmed working ("on air").
 * Persisted per broadcast output so the guided Projector Setup panel can restore
 * it in one tap the following week, even if Windows re-positions the projector.
 */
export interface RememberedSetup {
  /** Geometry key from when the setup last worked (`name|WxH|x,y`). */
  monitorKey: string
  /** Monitor name, used for position-independent re-matching. */
  monitorName: string
  width: number
  height: number
  fullscreen: boolean
  themeId?: string | null
  /** Epoch millis when this setup was last confirmed on air. */
  savedAt?: number
}
