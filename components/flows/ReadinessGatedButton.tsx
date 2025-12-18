// components/flows/ReadinessGatedButton.tsx
// Readiness-gated button wrapper
//
// Wraps any generation button with a readiness check.
// Shows the ReadinessGateModal if flow is not ready.

'use client';

import { useState, useCallback, ReactNode } from 'react';
import { ReadinessGateModal } from './ReadinessGateModal';
import {
  checkFlowReadinessFromGraph,
  type FlowType,
  type FlowReadiness,
} from '@/lib/os/flow/readiness.shared';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

interface ReadinessGatedButtonProps {
  children: ReactNode;
  graph: CompanyContextGraph | null;
  companyId: string;
  flowType: FlowType;
  onProceed: () => void;
  onRunLab?: (labKey: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ReadinessGatedButton({
  children,
  graph,
  companyId,
  flowType,
  onProceed,
  onRunLab,
  disabled = false,
  className = '',
}: ReadinessGatedButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [readiness, setReadiness] = useState<FlowReadiness | null>(null);

  const handleClick = useCallback(() => {
    if (!graph) {
      // No graph - proceed anyway (let downstream handle error)
      onProceed();
      return;
    }

    // Check readiness
    const result = checkFlowReadinessFromGraph(graph, flowType, companyId);

    if (result.isReady) {
      // Ready - proceed directly
      onProceed();
    } else {
      // Not ready - show modal
      setReadiness(result);
      setShowModal(true);
    }
  }, [graph, companyId, flowType, onProceed]);

  const handleProceedAnyway = useCallback(() => {
    setShowModal(false);
    onProceed();
  }, [onProceed]);

  const handleRunLab = useCallback(
    (labKey: string) => {
      setShowModal(false);
      if (onRunLab) {
        onRunLab(labKey);
      } else {
        // Default: navigate to lab
        const labPath = labKey.replace('_lab', '');
        window.location.href = `/c/${companyId}/diagnostics/${labPath}`;
      }
    },
    [companyId, onRunLab]
  );

  return (
    <>
      <div onClick={handleClick} className={`inline-block ${className}`}>
        {children}
      </div>

      {readiness && (
        <ReadinessGateModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onProceed={handleProceedAnyway}
          onRunLab={handleRunLab}
          readiness={readiness}
          companyId={companyId}
        />
      )}
    </>
  );
}

// Hook version for more complex integrations
export function useReadinessGate(
  graph: CompanyContextGraph | null,
  companyId: string,
  flowType: FlowType
) {
  const [showModal, setShowModal] = useState(false);
  const [readiness, setReadiness] = useState<FlowReadiness | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const checkAndProceed = useCallback(
    (action: () => void) => {
      if (!graph) {
        // No graph - proceed
        action();
        return;
      }

      const result = checkFlowReadinessFromGraph(graph, flowType, companyId);

      if (result.isReady) {
        // Ready - proceed
        action();
      } else {
        // Not ready - store action and show modal
        setReadiness(result);
        setPendingAction(() => action);
        setShowModal(true);
      }
    },
    [graph, companyId, flowType]
  );

  const proceedAnyway = useCallback(() => {
    setShowModal(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setPendingAction(null);
  }, []);

  return {
    checkAndProceed,
    showModal,
    readiness,
    proceedAnyway,
    closeModal,
    setShowModal,
  };
}
