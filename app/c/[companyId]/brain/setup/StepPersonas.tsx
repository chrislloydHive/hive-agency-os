'use client';

// app/c/[companyId]/setup/StepPersonas.tsx
// Step 4: Personas

import { useState } from 'react';
import { SetupFormData } from './types';
import { FormSection, LabLink, inputStyles } from './components/StepContainer';

interface StepPersonasProps {
  companyId: string;
  formData: Partial<SetupFormData>;
  updateStepData: <K extends keyof SetupFormData>(
    stepKey: K,
    data: Partial<SetupFormData[K]>
  ) => void;
  errors: Record<string, string[]>;
}

interface PersonaPreview {
  name: string;
  tagline: string;
  summary: string;
}

export function StepPersonas({
  companyId,
  formData,
  updateStepData,
}: StepPersonasProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPersonas, setGeneratedPersonas] = useState<PersonaPreview[]>([]);
  const [personaCount, setPersonaCount] = useState(3);

  const audienceData = formData.audience;

  const generatePersonas = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/audience/${companyId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: audienceData?.coreSegments || [],
          demographics: audienceData?.demographics || '',
          painPoints: audienceData?.painPoints || [],
          motivations: audienceData?.motivations || [],
          personaCount,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.personas) {
          setGeneratedPersonas(data.personas);
          updateStepData('personas', {
            personaSetId: data.personaSetId,
            personaCount: data.personas.length,
          });
        }
      }
    } catch (error) {
      console.error('Failed to generate personas:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Lab Integration Banner */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="font-medium text-purple-300">Full Persona Workshop</div>
          <div className="text-sm text-purple-400/80 mt-0.5">
            For detailed persona development with AI-powered research
          </div>
        </div>
        <LabLink companyId={companyId} lab="audience" label="Open Audience Lab" />
      </div>

      {/* Quick Generate */}
      <FormSection
        title="Quick Persona Generation"
        description="Generate personas based on the audience foundations"
      >
        {audienceData?.coreSegments && audienceData.coreSegments.length > 0 ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <div className="text-sm text-slate-400 mb-2">Based on the audience data:</div>
              <div className="flex flex-wrap gap-2">
                {audienceData.coreSegments.map((segment) => (
                  <span
                    key={segment}
                    className="px-2.5 py-1 bg-slate-700 text-slate-300 rounded-full text-sm"
                  >
                    {segment}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="text-sm text-slate-300">Generate</label>
              <select
                value={personaCount}
                onChange={(e) => setPersonaCount(parseInt(e.target.value))}
                className={`${inputStyles.select} w-20`}
              >
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
              <span className="text-sm text-slate-300">personas</span>

              <button
                onClick={generatePersonas}
                disabled={isGenerating}
                className="ml-auto px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    Generate Personas
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <svg
              className="w-12 h-12 mx-auto text-slate-600 mb-3"
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
            <p className="text-slate-400">
              Complete the Audience Foundations step first to generate personas
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Core segments and audience data are needed to create relevant personas
            </p>
          </div>
        )}
      </FormSection>

      {/* Generated Personas */}
      {generatedPersonas.length > 0 && (
        <FormSection
          title="Generated Personas"
          description="Review and refine the buyer personas"
        >
          <div className="grid gap-4">
            {generatedPersonas.map((persona, index) => (
              <div
                key={index}
                className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-100">{persona.name}</h4>
                    <p className="text-sm text-purple-400 mt-0.5">{persona.tagline}</p>
                  </div>
                  <button className="text-slate-400 hover:text-slate-200">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-slate-400 mt-2">{persona.summary}</p>
              </div>
            ))}
          </div>
        </FormSection>
      )}

      {/* Existing Personas */}
      {formData.personas?.personaCount && formData.personas.personaCount > 0 && generatedPersonas.length === 0 && (
        <FormSection
          title="Existing Personas"
          description="Personas already in the Context Graph"
        >
          <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-slate-100">
                  {formData.personas.personaCount} persona{formData.personas.personaCount !== 1 ? 's' : ''} configured
                </div>
                <div className="text-sm text-slate-400">
                  Personas can be regenerated or edited in Audience Lab
                </div>
              </div>
            </div>
          </div>
        </FormSection>
      )}
    </div>
  );
}
