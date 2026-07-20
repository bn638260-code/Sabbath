import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react"
import { SparklesIcon, ChevronLeftIcon } from "lucide-react"
import type { TooltipRenderProps, Controls } from "react-joyride"
import {
  tutorialCompletionError,
  type TutorialStep,
} from "./tutorial-steps"

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
  const stepRef = useRef(step as TutorialStep)
  const confirmedRef = useRef(false)
  const [confirmedIndex, setConfirmedIndex] = useState<number | null>(null)
  const [blocked, setBlocked] = useState<{
    index: number
    message: string
  } | null>(null)
  const tutorialStep = step as TutorialStep
  const confirmed = confirmedIndex === index
  const blockedMessage = blocked?.index === index ? blocked.message : null

  useEffect(() => {
    controlsRef.current = controls
    indexRef.current = index
    isLastStepRef.current = isLastStep
    stepRef.current = tutorialStep
    confirmedRef.current = confirmed
  }, [confirmed, controls, index, isLastStep, tutorialStep])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault()
        e.stopPropagation()
        const error = tutorialCompletionError(
          stepRef.current,
          confirmedRef.current
        )
        if (error) {
          setBlocked({ index: indexRef.current, message: error })
          return
        }
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

  const tooltipStyle = {
    ...(tooltipProps as { style?: CSSProperties }).style,
    background: "var(--shell-bg-deep)",
  }

  function advance(event: MouseEvent<HTMLButtonElement>) {
    const error = tutorialCompletionError(tutorialStep, confirmed)
    if (error) {
      setBlocked({ index, message: error })
      return
    }
    setBlocked(null)
    primaryProps.onClick?.(event)
  }

  return (
    <div
      {...tooltipProps}
      style={tooltipStyle}
      className="glass-panel z-[70] w-[340px] overflow-hidden shadow-2xl shadow-black/25"
    >
      <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] px-4 pt-4 pb-3">
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
        {tutorialStep.completion?.confirmationLabel ? (
          <label className="mt-3 flex items-start gap-2 text-xs text-foreground">
            <input
              checked={confirmed}
              className="mt-0.5 size-4 accent-[var(--accent)]"
              type="checkbox"
              onChange={(event) =>
                setConfirmedIndex(event.target.checked ? index : null)
              }
            />
            <span>{tutorialStep.completion.confirmationLabel}</span>
          </label>
        ) : null}
        {blockedMessage ? (
          <p className="mt-2 text-xs text-amber-600" role="alert">
            {blockedMessage}
          </p>
        ) : null}
      </div>

      <div className="space-y-2.5 border-t border-[var(--border-subtle)] px-4 py-3">
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
            className="btn-action mr-auto rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-[var(--shell-bg-sunken)] hover:text-foreground"
          >
            Skip
          </button>
          {index > 0 ? (
            <button
              {...backProps}
              className="btn-action inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-[var(--shell-bg-sunken)] hover:text-foreground"
            >
              <ChevronLeftIcon className="size-3" />
              Back
            </button>
          ) : null}
          <button
            {...primaryProps}
            onClick={advance}
            className="btn-action rounded-md bg-[var(--accent)] px-3.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:brightness-110"
          >
            {isLastStep ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  )
}
