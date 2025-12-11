'use client';

// components/os/helpers/HelperWizard.tsx
// Interactive wizard component for executing helpers step by step

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Circle,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Copy,
  CheckCircle,
  X,
} from 'lucide-react';
import type {
  Helper,
  HelperStep,
  StepStatus,
  ChecklistItem,
  FormField,
} from '@/lib/os/helpers/helperTypes';

interface HelperWizardProps {
  helper: Helper;
  companyId: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function HelperWizard({
  helper,
  companyId,
  onComplete,
  onCancel,
}: HelperWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [checklistStates, setChecklistStates] = useState<Record<string, boolean>>({});
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentStep = helper.steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === helper.steps.length - 1;

  const canProceed = useCallback(() => {
    const step = currentStep;
    if (!step) return true;

    switch (step.type) {
      case 'checklist': {
        const items = step.config.items || [];
        const requiredItems = items.filter((i: ChecklistItem) => i.required);
        return requiredItems.every((i: ChecklistItem) => checklistStates[i.id]);
      }
      case 'form': {
        const fields = step.config.fields || [];
        const requiredFields = fields.filter((f: FormField) => f.required);
        return requiredFields.every((f: FormField) => formData[f.id]);
      }
      default:
        return true;
    }
  }, [currentStep, checklistStates, formData]);

  const handleNext = () => {
    if (isLastStep) {
      setStepStatuses(prev => ({ ...prev, [currentStep.id]: 'completed' }));
      onComplete?.();
    } else {
      setStepStatuses(prev => ({ ...prev, [currentStep.id]: 'completed' }));
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleChecklistChange = (itemId: string, checked: boolean) => {
    setChecklistStates(prev => ({ ...prev, [itemId]: checked }));
  };

  const handleFormChange = (fieldId: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      // Simulate AI generation (in production, call actual AI endpoint)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate mock output based on form data
      const output = generateMockAIOutput(currentStep, formData);
      setAiOutput(output);
    } catch (error) {
      console.error('AI generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyOutput = () => {
    if (aiOutput) {
      navigator.clipboard.writeText(aiOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{helper.name}</h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            Step {currentStepIndex + 1} of {helper.steps.length}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="px-6 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-1">
          {helper.steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                index < currentStepIndex
                  ? 'bg-emerald-500'
                  : index === currentStepIndex
                  ? 'bg-purple-500'
                  : 'bg-zinc-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="p-6 min-h-[300px]">
        <div className="mb-4">
          <h3 className="text-xl font-medium text-white">{currentStep.title}</h3>
          <p className="text-sm text-zinc-400 mt-1">{currentStep.description}</p>
        </div>

        <div className="mt-6">
          {currentStep.type === 'info' && (
            <InfoStep step={currentStep} />
          )}

          {currentStep.type === 'checklist' && (
            <ChecklistStep
              step={currentStep}
              states={checklistStates}
              onChange={handleChecklistChange}
            />
          )}

          {currentStep.type === 'form' && (
            <FormStep
              step={currentStep}
              data={formData}
              onChange={handleFormChange}
            />
          )}

          {currentStep.type === 'ai_generate' && (
            <AIGenerateStep
              step={currentStep}
              output={aiOutput}
              isGenerating={isGenerating}
              onGenerate={handleGenerateAI}
              onCopy={handleCopyOutput}
              copied={copied}
            />
          )}

          {currentStep.type === 'action' && (
            <ActionStep step={currentStep} companyId={companyId} />
          )}

          {currentStep.type === 'diagnostic' && (
            <DiagnosticStep step={currentStep} companyId={companyId} />
          )}

          {currentStep.helpText && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm text-blue-300">{currentStep.helpText}</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={isFirstStep}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isFirstStep
              ? 'text-zinc-600 cursor-not-allowed'
              : 'text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <button
          onClick={handleNext}
          disabled={!canProceed()}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            canProceed()
              ? 'bg-purple-600 text-white hover:bg-purple-500'
              : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
          }`}
        >
          {isLastStep ? (
            <>
              Complete
              <Check className="w-4 h-4" />
            </>
          ) : (
            <>
              Next
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Step Components
// ============================================================================

function InfoStep({ step }: { step: HelperStep }) {
  return (
    <div>
      {step.config.content && (
        <p className="text-zinc-300">{step.config.content}</p>
      )}
      {step.config.bullets && (
        <ul className="mt-4 space-y-2">
          {step.config.bullets.map((bullet: string, index: number) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span className="text-zinc-300">{bullet}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChecklistStep({
  step,
  states,
  onChange,
}: {
  step: HelperStep;
  states: Record<string, boolean>;
  onChange: (id: string, checked: boolean) => void;
}) {
  const items = step.config.items || [];

  return (
    <div className="space-y-3">
      {items.map((item: ChecklistItem) => (
        <label
          key={item.id}
          className="flex items-start gap-3 p-3 rounded-lg border border-zinc-700 hover:border-zinc-600 cursor-pointer transition-colors"
        >
          <input
            type="checkbox"
            checked={states[item.id] || false}
            onChange={(e) => onChange(item.id, e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500"
          />
          <div>
            <span className={`text-sm ${states[item.id] ? 'text-zinc-300' : 'text-zinc-200'}`}>
              {item.label}
            </span>
            {item.required && (
              <span className="text-xs text-amber-400 ml-2">Required</span>
            )}
            {item.description && (
              <p className="text-xs text-zinc-500 mt-1">{item.description}</p>
            )}
          </div>
        </label>
      ))}
    </div>
  );
}

function FormStep({
  step,
  data,
  onChange,
}: {
  step: HelperStep;
  data: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
}) {
  const fields = step.config.fields || [];

  return (
    <div className="space-y-4">
      {fields.map((field: FormField) => (
        <div key={field.id}>
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            {field.label}
            {field.required && <span className="text-amber-400 ml-1">*</span>}
          </label>
          {field.type === 'textarea' ? (
            <textarea
              value={(data[field.id] as string) || ''}
              onChange={(e) => onChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 resize-none"
              rows={3}
            />
          ) : field.type === 'select' ? (
            <select
              value={(data[field.id] as string) || ''}
              onChange={(e) => onChange(field.id, e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">Select...</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type}
              value={(data[field.id] as string) || ''}
              onChange={(e) => onChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function AIGenerateStep({
  step,
  output,
  isGenerating,
  onGenerate,
  onCopy,
  copied,
}: {
  step: HelperStep;
  output: string | null;
  isGenerating: boolean;
  onGenerate: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div>
      {!output && (
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-500 hover:to-blue-500 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate AI Suggestions
            </>
          )}
        </button>
      )}

      {output && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-zinc-300">AI Output</span>
            <button
              onClick={onCopy}
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="p-4 bg-zinc-800 border border-zinc-700 rounded-lg">
            <pre className="text-sm text-zinc-300 whitespace-pre-wrap">{output}</pre>
          </div>
          <button
            onClick={onGenerate}
            className="mt-3 text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

function ActionStep({
  step,
  companyId,
}: {
  step: HelperStep;
  companyId: string;
}) {
  const link = step.config.actionLink?.startsWith('http')
    ? step.config.actionLink
    : step.config.actionLink
    ? `/c/${companyId}${step.config.actionLink}`
    : null;

  return (
    <div className="flex flex-col items-center text-center py-6">
      <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mb-4">
        <ExternalLink className="w-8 h-8 text-purple-400" />
      </div>
      <p className="text-zinc-300 mb-4">
        {step.config.content || 'Take this action to complete the step'}
      </p>
      {link && (
        <a
          href={link}
          target={link.startsWith('http') ? '_blank' : undefined}
          rel={link.startsWith('http') ? 'noopener noreferrer' : undefined}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
        >
          {step.config.actionLabel || 'Take Action'}
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

function DiagnosticStep({
  step,
  companyId,
}: {
  step: HelperStep;
  companyId: string;
}) {
  const labSlug = step.config.labSlug || 'website';

  return (
    <div className="flex flex-col items-center text-center py-6">
      <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
        <Sparkles className="w-8 h-8 text-blue-400" />
      </div>
      <p className="text-zinc-300 mb-4">
        Run a diagnostic to get detailed analysis and recommendations
      </p>
      <Link
        href={`/c/${companyId}/brain/labs/${labSlug}`}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
      >
        Run Diagnostic
        <ExternalLink className="w-4 h-4" />
      </Link>
    </div>
  );
}

// ============================================================================
// Mock AI Output Generator
// ============================================================================

function generateMockAIOutput(step: HelperStep, formData: Record<string, unknown>): string {
  // In production, this would call the actual AI endpoint
  const outputType = step.config.outputType || 'text';

  if (outputType === 'suggestions') {
    return `Based on your input, here are 5 suggestions:

1. Focus on your unique value proposition in the headline
2. Include specific numbers or statistics to build credibility
3. Use action-oriented language to encourage engagement
4. Address your target audience directly
5. Highlight what makes you different from competitors

These suggestions are tailored to help you improve your content and engage your audience more effectively.`;
  }

  if (outputType === 'list') {
    return `- Improve page load speed by optimizing images
- Add more internal links to improve navigation
- Update meta descriptions for better click-through rates
- Create more content around your target keywords
- Ensure mobile responsiveness across all pages`;
  }

  return 'AI-generated content based on your inputs. This would contain specific recommendations tailored to your business and goals.';
}

export default HelperWizard;
