import { useEffect, useRef } from "react"
import { SparklesIcon, ChevronLeftIcon } from "lucide-react"
import type { TooltipRenderProps, Controls } from "react-joyride"

export function TutorialTooltip({
  index,
  step,
  size,
  isLastStep,
  backProps,
  primaryProps,
  skipProps,
  controls,
  tooltipProps,
}: TooltipRenderProps) {
  const controlsRef = useRef<Controls>(controls)
  const indexRef = useRef(index)
  const isLastStepRef = useRef(isLastStep)

  useEffect(() => {
    controlsRef.current = controls
    indexRef.current = index
    isLastStepRef.current = isLastStep
  }, [controls, index, isLastStep])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault()
        e.stopPropagation()
        if (isLastStepRef.current) {
          controlsRef.current.skip("button_skip")
        } else {
          controlsRef.current.next()
        }
      } else if (e.key === "ArrowLeft" && indexRef.current > 0) {
        e.preventDefault()
        e.stopPropagation()
        controlsRef.current.prev()
      } else if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        controlsRef.current.skip("button_close")
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <div
      {...tooltipProps}
      className="glass-panel z-[70] w-[340px] overflow-hidden shadow-2xl shadow-black/25"
    >
      <div className="flex items-center gap-2.5 border-b border-white/5 px-4 pt-4 pb-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-glow)]">
          <SparklesIcon className="size-3.5 text-[var(--accent)]" />
        </div>
        <h3 className="text-sm leading-tight font-semibold tracking-tight text-foreground">
          {step.title ?? `Step ${index + 1}`}
        </h3>
      </div>

      <div className="px-4 py-3">
        <p className="max-w-[40ch] text-[0.8125rem] leading-[1.6] text-muted-foreground">
          {step.content}
        </p>
      </div>

      <div className="space-y-2.5 border-t border-white/5 px-4 py-3">
        <div className="flex items-center gap-1">
          {Array.from({ length: size }, (_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-200 ${
                i === index
                  ? "w-3.5 bg-[var(--accent)]"
                  : i < index
                    ? "w-1.5 bg-[var(--accent)]/40"
                    : "w-1.5 bg-muted-foreground/20"
              }`}
            />
          ))}
          <span className="ml-1 text-[0.6875rem] text-muted-foreground/50 tabular-nums">
            {index + 1}/{size}
          </span>
        </div>

        <div className="flex items-center justify-end gap-1.5">
          <button
            {...skipProps}
            className="btn-action mr-auto rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground"
          >
            Skip
          </button>
          {index > 0 ? (
            <button
              {...backProps}
              className="btn-action inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground"
            >
              <ChevronLeftIcon className="size-3" />
              Back
            </button>
          ) : null}
          <button
            {...primaryProps}
            className="btn-action rounded-md bg-[var(--accent)] px-3.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:brightness-110"
          >
            {isLastStep ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  )
}
