// components/gap/GrowthPlanView.tsx

import React from "react";
import Link from "next/link";

import type { GrowthAccelerationPlan } from "@/lib/growth-plan/growthActionPlanSchema";

import { ScorecardView } from "./Scorecard";
import { ExecutiveSummaryCard } from "./ExecutiveSummary";
import { QuickWinsList } from "./QuickWins";
import { TimelineView } from "./Timeline";
import { ExecutiveSummaryHero } from "@/components/growth/ExecutiveSummaryHero";
import { StrategicOutcomes } from "@/components/growth/StrategicOutcomes";
import { DebugPanel } from "@/components/growth/DebugPanel";
import { DetailedServiceAssessments } from "./DetailedServiceAssessments";
import HowYouStackUpSection from "./HowYouStackUpSection";

// V2 Components
import { RoadmapV2 } from "./RoadmapV2";
import { AcceleratorsV2 } from "./AcceleratorsV2";
import { StrategicDiagnosisV2 } from "./StrategicDiagnosisV2";

type Props = {
  plan: GrowthAccelerationPlan;
  diagnostics?: any;
  scores?: {
    brand?: number;
    content?: number;
    seo?: number;
    websiteUx?: number;
  };
};

export const GrowthPlanView: React.FC<Props> = ({ plan, diagnostics, scores }) => {
  // Check if this is a V2 plan
  const isV2 = plan.planVersion === 'v2' && plan.roadmapV2 && plan.actions;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero: Executive Summary */}
      <section id="overview">
        <ExecutiveSummaryHero plan={plan} />
      </section>

      {/* Scorecard */}
      <section id="scorecard">
        <ScorecardView scorecard={plan.scorecard} socialSignals={plan.socialSignals} />
      </section>

      {/* Consultant Report CTA */}
      {plan.gapId && (
        <div className="bg-gradient-to-br from-slate-900/70 to-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-slate-200 mb-2">
                View Comprehensive Consultant Report
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                Get a detailed, text-based consultant report (8-20 pages) with strategic priorities, initiatives, and a complete roadmap that you can share with your team or export as PDF.
              </p>
              <Link
                href={`/growth-acceleration-plan/report/${plan.gapId}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Consultant Report
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* V2 CENTERPIECE: Accelerators + Roadmap (if V2 plan) */}
      {isV2 && (
        <>
          {/* Accelerators - Highlighted above the fold */}
          <section id="accelerators">
            <AcceleratorsV2 plan={plan as any} />
          </section>

          {/* Roadmap - Main action plan */}
          <section id="roadmap">
            <RoadmapV2 plan={plan as any} />
          </section>

          {/* Strategic Diagnosis - Growth bottleneck + ICP */}
          <section id="strategic-diagnosis">
            <StrategicDiagnosisV2 plan={plan as any} />
          </section>
        </>
      )}

      {/* How You Stack Up Benchmarking (de-emphasized for V2) */}
      {plan.gapId && (
        <section id="benchmarks" className={isV2 ? 'opacity-75' : ''}>
          <HowYouStackUpSection gapRunId={plan.gapId} />
        </section>
      )}

      {/* V1 Legacy: Quick Wins + Timeline (hidden for V2) */}
      {!isV2 && (
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.3fr,1fr]">
          <section id="quick-wins">
            <QuickWinsList quickWins={plan.quickWins} />
          </section>
          <section id="timeline">
            <TimelineView plan={plan} />
          </section>
        </div>
      )}

      {/* Detailed Service Assessments - Section Analyses (de-emphasized for V2) */}
      {(plan || diagnostics) && (
        <section id="service-assessments" className={isV2 ? 'opacity-75' : ''}>
          <DetailedServiceAssessments
            plan={plan}
            diagnostics={diagnostics}
            scores={scores}
          />
        </section>
      )}

      {/* Strategic Outcomes */}
      <section id="outcomes">
        <StrategicOutcomes plan={plan} />
      </section>

      {/* Debug Panel (dev mode only) */}
      <DebugPanel debug={plan.debug} />
    </div>
  );
};

