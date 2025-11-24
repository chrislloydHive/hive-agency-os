'use client';

interface NextStepsPanelProps {
  nextSteps: string[];
  risks: any[];
  keyIssues: string[];
}

export default function NextStepsPanel({
  nextSteps,
  risks,
  keyIssues,
}: NextStepsPanelProps) {
  const hasContent = nextSteps.length > 0 || risks.length > 0 || keyIssues.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-100 mb-6">Next Steps & Risks</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Steps */}
        {nextSteps.length > 0 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Next Steps</h3>
            <ul className="space-y-3">
              {nextSteps.map((step, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-yellow-500 mr-3 mt-1">→</span>
                  <span className="text-gray-300 flex-1">{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Key Issues */}
        {keyIssues.length > 0 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Key Issues</h3>
            <ul className="space-y-3">
              {keyIssues.map((issue, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-red-400 mr-3 mt-1">⚠</span>
                  <span className="text-gray-300 flex-1">{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Emerging Risks */}
        {risks.length > 0 && (
          <div className="bg-gray-800 rounded-lg border border-red-700/50 p-6">
            <h3 className="text-lg font-semibold text-red-400 mb-4">Emerging Risks</h3>
            <ul className="space-y-3">
              {risks.map((risk, idx) => {
                const riskText = typeof risk === 'string' ? risk : risk?.description || risk?.title || 'Unknown risk';
                return (
                  <li key={idx} className="flex items-start">
                    <span className="text-red-500 mr-3 mt-1">⚡</span>
                    <span className="text-gray-300 flex-1">{riskText}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

