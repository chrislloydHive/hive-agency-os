'use client';

// app/c/[companyId]/setup/StepPersonas.tsx
// Step 4: Audience Preview
//
// Shows a summary of the audience/ICP data entered in the previous step.
// Links to Audience Lab for segment development (done later, not during setup).

import { SetupFormData } from './types';
import { FormSection, LabLink } from './components/StepContainer';

interface StepPersonasProps {
  companyId: string;
  formData: Partial<SetupFormData>;
  updateStepData: <K extends keyof SetupFormData>(
    stepKey: K,
    data: Partial<SetupFormData[K]>
  ) => void;
  errors: Record<string, string[]>;
}

export function StepPersonas({
  companyId,
  formData,
}: StepPersonasProps) {
  const audienceData = formData.audience;
  const hasAudienceData = audienceData && (
    audienceData.primaryAudience ||
    (audienceData.coreSegments && audienceData.coreSegments.length > 0) ||
    audienceData.demographics ||
    (audienceData.primaryBuyerRoles && audienceData.primaryBuyerRoles.length > 0)
  );

  return (
    <div className="space-y-6">
      {/* Summary of what was entered */}
      {hasAudienceData ? (
        <>
          {/* ICP Summary Card */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-emerald-300">Target Audience Defined</div>
                <div className="text-sm text-emerald-400/80 mt-1">
                  Your ICP has been saved to the Brain and will be used to guide segment generation in Audience Lab.
                </div>
              </div>
            </div>
          </div>

          {/* Audience Data Preview */}
          <FormSection
            title="Your Target Audience"
            description="Summary of the ICP data you've entered"
          >
            <div className="space-y-4">
              {/* Primary Audience */}
              {audienceData.primaryAudience && (
                <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                    Primary Audience
                  </div>
                  <div className="text-slate-200">
                    {audienceData.primaryAudience}
                  </div>
                </div>
              )}

              {/* Core Segments */}
              {audienceData.coreSegments && audienceData.coreSegments.length > 0 && (
                <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Target Segments
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {audienceData.coreSegments.map((segment) => (
                      <span
                        key={segment}
                        className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-full text-sm"
                      >
                        {segment}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Buyer Roles */}
              {audienceData.primaryBuyerRoles && audienceData.primaryBuyerRoles.length > 0 && (
                <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Decision Makers / Buyer Roles
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {audienceData.primaryBuyerRoles.map((role) => (
                      <span
                        key={role}
                        className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-300 rounded-full text-sm"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Demographics & Geos */}
              <div className="grid grid-cols-2 gap-4">
                {audienceData.demographics && (
                  <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                      Demographics
                    </div>
                    <div className="text-sm text-slate-300">
                      {audienceData.demographics}
                    </div>
                  </div>
                )}
                {audienceData.geos && (
                  <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                      Geographic Focus
                    </div>
                    <div className="text-sm text-slate-300">
                      {audienceData.geos}
                    </div>
                  </div>
                )}
              </div>

              {/* Pain Points & Motivations */}
              {((audienceData.painPoints && audienceData.painPoints.length > 0) ||
                (audienceData.motivations && audienceData.motivations.length > 0)) && (
                <div className="grid grid-cols-2 gap-4">
                  {audienceData.painPoints && audienceData.painPoints.length > 0 && (
                    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Pain Points
                      </div>
                      <ul className="text-sm text-slate-300 space-y-1">
                        {audienceData.painPoints.slice(0, 4).map((pain, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-red-400 mt-0.5">•</span>
                            {pain}
                          </li>
                        ))}
                        {audienceData.painPoints.length > 4 && (
                          <li className="text-slate-500 text-xs">
                            +{audienceData.painPoints.length - 4} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                  {audienceData.motivations && audienceData.motivations.length > 0 && (
                    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Motivations
                      </div>
                      <ul className="text-sm text-slate-300 space-y-1">
                        {audienceData.motivations.slice(0, 4).map((motivation, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            {motivation}
                          </li>
                        ))}
                        {audienceData.motivations.length > 4 && (
                          <li className="text-slate-500 text-xs">
                            +{audienceData.motivations.length - 4} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </FormSection>

          {/* Next Steps */}
          <FormSection
            title="What's Next"
            description="After completing setup, you can develop detailed segments"
          >
            <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-200">Audience Lab</div>
                  <p className="text-sm text-slate-400 mt-1">
                    Use Audience Lab to decompose your ICP into actionable segments with demand states,
                    media preferences, and creative angles. Generate detailed personas when you're ready
                    to create communications.
                  </p>
                  <div className="mt-3">
                    <LabLink companyId={companyId} lab="audience" label="Open Audience Lab" />
                  </div>
                </div>
              </div>
            </div>
          </FormSection>
        </>
      ) : (
        /* No audience data yet */
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 mx-auto text-slate-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h3 className="text-lg font-medium text-slate-300 mb-2">
            No Audience Data Yet
          </h3>
          <p className="text-slate-400 max-w-md mx-auto">
            Go back to the <strong>Audience Foundations</strong> step to define your target audience
            and ICP. This data will be used to generate segments in Audience Lab.
          </p>
        </div>
      )}
    </div>
  );
}
