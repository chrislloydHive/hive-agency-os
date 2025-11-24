"use client";

import { useMemo } from "react";
import { CheckCircle, Loader2, Search } from "lucide-react";
import {
  ANALYSIS_STEPS,
  type AnalysisStepId,
  getAnalysisProgressPercent,
} from "@/lib/eval/analysisProgress";
import { TypedFindingText } from "@/components/gap/TypedFindingText";
import clsx from "clsx";

type Props = {
  currentStepId?: AnalysisStepId;
  activityLog?: string[];
  status?: "queued" | "running" | "completed" | "failed" | null;
  progress?: number;
  stage?: string | null;
  currentFinding?: string | null;
  runId?: string | null;
};

/**
 * Map stage string from API to AnalysisStepId
 */
function mapStageToStepId(stage: string | null): AnalysisStepId {
  if (!stage) return "init";
  
  const stageLower = stage.toLowerCase();
  if (stageLower.includes("starting") || stageLower.includes("init")) return "init";
  if (stageLower.includes("crawl") || stageLower.includes("fetch")) return "crawl";
  if (stageLower.includes("extract") || stageLower.includes("signal")) return "extractFeatures";
  if (stageLower.includes("website") || stageLower.includes("conversion")) return "scoreWebsite";
  if (stageLower.includes("content")) return "scoreContent";
  if (stageLower.includes("seo") || stageLower.includes("visibility")) return "scoreSEO";
  if (stageLower.includes("brand") || stageLower.includes("positioning")) return "scoreBrand";
  if (stageLower.includes("authority") || stageLower.includes("trust")) return "scoreAuthority";
  if (stageLower.includes("assemble") || stageLower.includes("generating-gap")) return "assemblePlan";
  if (stageLower.includes("finalize") || stageLower.includes("completed")) return "finalize";
  
  return "init";
}

export function AnalysisProgressBar({ 
  currentStepId, 
  activityLog = [],
  status,
  progress,
  stage,
  currentFinding,
  runId,
}: Props) {
  // Use stage from API if available, otherwise fall back to currentStepId
  const effectiveStepId = stage ? mapStageToStepId(stage) : (currentStepId ?? "init");
  
  const currentStep = useMemo(
    () => ANALYSIS_STEPS.find((s) => s.id === effectiveStepId) ?? ANALYSIS_STEPS[0],
    [effectiveStepId]
  );

  // Use progress from API if available, otherwise calculate from step
  const percent = progress !== undefined ? Math.max(5, Math.min(progress, 100)) : getAnalysisProgressPercent(currentStep.id);
  
  // Don't show progress bar if completed or failed
  if (status === "completed" || status === "failed") {
    return null;
  }

  return (
    <section className="mb-4 rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 sm:p-6">
      {/* Top row: progress bar + percent */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <div className="flex items-baseline justify-between gap-2 sm:gap-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 sm:text-xs">
              {status === "queued" ? "Preparing GAP run…" : "Running GAP Analysis…"}
            </h2>
            <span className="text-[10px] font-medium text-neutral-300 sm:text-xs">
              {percent}% complete
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-900 sm:h-2">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Current step explanation + Activity log */}
      <div className="mt-3 grid gap-4 md:grid-cols-[2fr,1.5fr]">
        {/* Left: current step explanation */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
            {stage ? stage.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : currentStep.label}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-200">
            {currentStep.description}
          </p>
          {currentStep.details && currentStep.details.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-neutral-300">
              {currentStep.details.map((detail, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-amber-300" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: activity log */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            Analysis activity
          </p>
          <div className="mt-2 max-h-40 space-y-1.5 overflow-auto text-xs text-neutral-300">
            {runId && status && (status === "queued" || status === "running") ? (
              <div className="space-y-1.5">
                {/* STARTED */}
                <p className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  GAP job started (Run ID: {runId})
                </p>

                {/* POLLING */}
                <p className="flex items-center gap-2 text-neutral-300">
                  <Loader2 className="h-4 w-4 animate-spin opacity-80" />
                  Polling for progress...
                </p>

                {/* LIVE FINDING */}
                {currentFinding && (
                  <p className="flex items-center gap-2 mt-1 text-emerald-300">
                    <Search className="h-4 w-4 opacity-80" />
                    <TypedFindingText text={currentFinding} />
                  </p>
                )}
              </div>
            ) : activityLog && activityLog.length > 0 ? (
              activityLog.map((line, idx) => {
                const isCompleted = line.startsWith("✔");
                const isError = line.startsWith("⚠");
                const isInProgress = line.startsWith("▶");
                
                return (
                  <div key={idx} className="flex gap-2">
                    <span
                      className={clsx(
                        "mt-1 h-1 w-1 flex-shrink-0 rounded-full",
                        isCompleted && "bg-emerald-500",
                        isError && "bg-red-500",
                        isInProgress && "bg-amber-400 animate-pulse",
                        !isCompleted && !isError && !isInProgress && "bg-neutral-700"
                      )}
                    />
                    <span
                      className={clsx(
                        isCompleted && "text-emerald-300",
                        isError && "text-red-300",
                        isInProgress && "text-amber-300"
                      )}
                    >
                      {line}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-neutral-500">Waiting for analysis steps to begin…</p>
            )}
          </div>
        </div>
      </div>

      {/* Step pills */}
      <div className="mt-4 flex flex-wrap gap-1.5 sm:gap-2">
        {ANALYSIS_STEPS.map((step, index) => {
          const stepIndex = index;
          const currentIndex = ANALYSIS_STEPS.findIndex(
            (s) => s.id === currentStep.id
          );
          const isDone = stepIndex < currentIndex;
          const isCurrent = step.id === currentStep.id;

          return (
            <div
              key={step.id}
              className={clsx(
                "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] sm:gap-2 sm:px-2.5 sm:py-1 sm:text-[11px]",
                isCurrent &&
                  "border-amber-400/70 bg-amber-400/10 text-amber-100",
                isDone &&
                  "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
                !isCurrent &&
                  !isDone &&
                  "border-neutral-800 bg-neutral-900 text-neutral-400"
              )}
            >
              <span
                className={clsx(
                  "flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] sm:h-4 sm:w-4 sm:text-[9px]",
                  isCurrent
                    ? "bg-amber-400 text-neutral-950"
                    : isDone
                    ? "bg-emerald-500 text-neutral-950"
                    : "bg-neutral-800 text-neutral-300"
                )}
              >
                {stepIndex + 1}
              </span>
              <span>{step.shortLabel}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

