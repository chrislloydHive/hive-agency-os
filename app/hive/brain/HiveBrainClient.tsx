'use client';

// app/hive/brain/HiveBrainClient.tsx
// Client-side Hive Brain Dashboard

import { useState, useCallback } from 'react';
import {
  Brain,
  Zap,
  Target,
  Shield,
  BarChart3,
  Play,
  AlertTriangle,
  CheckCircle,
  Clock,
  Lightbulb,
  GitBranch,
  Users,
  TrendingUp,
  Loader2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface HiveSummary {
  totalCompanies: number;
  healthDistribution: { healthy: number; warning: number; critical: number };
  topChannels: Array<{ channel: string; count: number }>;
  verticalBreakdown: Array<{ vertical: string; count: number }>;
  keyInsights: string[];
}

interface ReasonerResult {
  question: string;
  findings: string[];
  causalHypotheses: string[];
  recommendedActions: string[];
  affectedVerticals: string[];
  confidence: number;
  companiesAnalyzed: number;
}

interface SimulationResult {
  projectedImpact: {
    installsDelta: number;
    revenueDelta: number;
    cpaDelta: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
  narrativeSummary: string;
  bestCase: string;
  worstCase: string;
  assumptions: string[];
  risks: string[];
}

interface EvaluationStats {
  predictionAccuracy: { overall: number; recentTrend: string };
  autopilotQuality: {
    decisionsEvaluated: number;
    goodDecisions: number;
    badDecisions: number;
  };
  trackingStats: {
    predictions: number;
    decisions: number;
  };
}

// ============================================================================
// Simple UI Components
// ============================================================================

function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="p-6 pb-3">{children}</div>;
}

function CardTitle({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>{children}</h3>;
}

function CardDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-500 mt-1">{children}</p>;
}

function CardContent({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`p-6 pt-3 ${className}`}>{children}</div>;
}

function Button({
  className = '',
  variant = 'default',
  disabled = false,
  onClick,
  children,
}: {
  className?: string;
  variant?: 'default' | 'outline';
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const baseStyles = 'inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variantStyles = variant === 'outline'
    ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
    : 'bg-indigo-600 text-white hover:bg-indigo-700';

  return (
    <button
      className={`${baseStyles} ${variantStyles} ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Badge({
  variant = 'default',
  className = '',
  children,
}: {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  className?: string;
  children: React.ReactNode;
}) {
  const variantStyles = {
    default: 'bg-indigo-100 text-indigo-800',
    secondary: 'bg-gray-100 text-gray-800',
    outline: 'border border-gray-300 text-gray-700',
    destructive: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}

function Input({
  className = '',
  placeholder,
  value,
  onChange,
}: {
  className?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      type="text"
      className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${className}`}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
  );
}

function Textarea({
  className = '',
  placeholder,
  value,
  onChange,
  rows = 3,
}: {
  className?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
}) {
  return (
    <textarea
      className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${className}`}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      rows={rows}
    />
  );
}

// ============================================================================
// Main Component
// ============================================================================

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'reasoner', label: 'Reasoner', icon: Lightbulb },
  { id: 'simulation', label: 'Simulation', icon: GitBranch },
  { id: 'orchestration', label: 'Orchestration', icon: Users },
  { id: 'policies', label: 'Policies', icon: Shield },
  { id: 'evaluation', label: 'Self-Eval', icon: TrendingUp },
] as const;

export function HiveBrainClient() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<HiveSummary | null>(null);
  const [reasonerResult, setReasonerResult] = useState<ReasonerResult | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [evalStats, setEvalStats] = useState<EvaluationStats | null>(null);
  const [question, setQuestion] = useState('');
  const [simulationGoal, setSimulationGoal] = useState('');

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hive-brain/reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'summary' }),
      });
      const data = await res.json();
      setSummary(data);
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
    setLoading(false);
  }, []);

  // Ask a question
  const askQuestion = async () => {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/hive-brain/reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reason',
          query: { question, depth: 'standard' },
        }),
      });
      const data = await res.json();
      setReasonerResult(data);
    } catch (error) {
      console.error('Failed to ask question:', error);
    }
    setLoading(false);
  };

  // Run simulation
  const runSimulation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hive-brain/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: {
            target: 'vertical',
            verticalId: 'home_services',
            timeHorizon: '90d',
            changes: {
              budgetChange: 20,
              channelMix: { Meta: 0.5, Google: 0.3, TikTok: 0.2 },
            },
          },
        }),
      });
      const data = await res.json();
      setSimulationResult(data);
    } catch (error) {
      console.error('Failed to run simulation:', error);
    }
    setLoading(false);
  };

  // Fetch evaluation stats
  const fetchEvalStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hive-brain/evaluate');
      const data = await res.json();
      setEvalStats(data);
    } catch (error) {
      console.error('Failed to fetch eval stats:', error);
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
          <Brain className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hive Brain</h1>
          <p className="text-gray-500">
            Meta-Intelligence • Causal Reasoning • Strategic Simulation
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Hive Summary
                </CardTitle>
                <CardDescription>
                  Cross-company intelligence at a glance
                </CardDescription>
              </CardHeader>
              <CardContent>
                {summary ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-gray-900">
                          {summary.totalCompanies}
                        </div>
                        <div className="text-sm text-gray-500">Companies</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {summary.healthDistribution.healthy}
                        </div>
                        <div className="text-sm text-gray-500">Healthy</div>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">
                          {summary.healthDistribution.critical}
                        </div>
                        <div className="text-sm text-gray-500">Critical</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Key Insights</h4>
                      <ul className="space-y-1">
                        {summary.keyInsights.map((insight, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Top Channels</h4>
                      <div className="flex flex-wrap gap-2">
                        {summary.topChannels.slice(0, 5).map((ch) => (
                          <Badge key={ch.channel} variant="secondary">
                            {ch.channel} ({ch.count})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button onClick={fetchSummary} disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Load Summary
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline" onClick={fetchSummary}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Refresh Summary
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab('reasoner')}>
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Ask a Question
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab('simulation')}>
                  <GitBranch className="h-4 w-4 mr-2" />
                  Run Simulation
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={fetchEvalStats}>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Self-Assessment
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Reasoner Tab */}
        {activeTab === 'reasoner' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Ask the Hive Brain</CardTitle>
                <CardDescription>
                  Ask strategic questions across all companies and verticals
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="e.g., Why are home services companies seeing higher CPAs this month?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={3}
                />
                <Button onClick={askQuestion} disabled={loading || !question.trim()}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Brain className="h-4 w-4 mr-2" />
                  )}
                  Analyze
                </Button>
              </CardContent>
            </Card>

            {reasonerResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    Analysis Results
                  </CardTitle>
                  <CardDescription>
                    {reasonerResult.companiesAnalyzed} companies analyzed • {Math.round(reasonerResult.confidence * 100)}% confidence
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Findings</h4>
                    <ul className="space-y-1">
                      {reasonerResult.findings.map((f, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {reasonerResult.causalHypotheses.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Causal Hypotheses</h4>
                      <ul className="space-y-1">
                        {reasonerResult.causalHypotheses.map((h, i) => (
                          <li key={i} className="text-sm text-gray-600">
                            • {h}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {reasonerResult.recommendedActions.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Recommended Actions</h4>
                      <ul className="space-y-1">
                        {reasonerResult.recommendedActions.map((a, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <Target className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Simulation Tab */}
        {activeTab === 'simulation' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-purple-500" />
                  Strategy Simulation
                </CardTitle>
                <CardDescription>
                  Test &quot;what if&quot; scenarios before implementing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Simulation Goal</label>
                  <Input
                    placeholder="e.g., Increase budget by 20%"
                    value={simulationGoal}
                    onChange={(e) => setSimulationGoal(e.target.value)}
                  />
                </div>

                <Button onClick={runSimulation} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Run Simulation
                </Button>
              </CardContent>
            </Card>

            {simulationResult && (
              <Card>
                <CardHeader>
                  <CardTitle>Simulation Results</CardTitle>
                  <CardDescription>
                    Projected impact over 90 days
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-600">
                        {simulationResult.projectedImpact.revenueDelta > 0 ? '+' : ''}
                        {simulationResult.projectedImpact.revenueDelta.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">Revenue</div>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="text-lg font-bold text-green-600">
                        {simulationResult.projectedImpact.cpaDelta > 0 ? '+' : ''}
                        {simulationResult.projectedImpact.cpaDelta.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">CPA Change</div>
                    </div>
                  </div>

                  <div>
                    <Badge
                      variant={
                        simulationResult.projectedImpact.riskLevel === 'low'
                          ? 'outline'
                          : simulationResult.projectedImpact.riskLevel === 'medium'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {simulationResult.projectedImpact.riskLevel.toUpperCase()} RISK
                    </Badge>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Summary</h4>
                    <p className="text-sm text-gray-600">
                      {simulationResult.narrativeSummary}
                    </p>
                  </div>

                  {simulationResult.risks.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        Risks
                      </h4>
                      <ul className="space-y-1">
                        {simulationResult.risks.map((r, i) => (
                          <li key={i} className="text-sm text-gray-600">
                            • {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Orchestration Tab */}
        {activeTab === 'orchestration' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                Multi-Agent Orchestration
              </CardTitle>
              <CardDescription>
                Coordinate specialized agents to execute complex strategies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: 'Media', icon: '📊', status: 'idle' },
                  { name: 'Creative', icon: '🎨', status: 'idle' },
                  { name: 'Audience', icon: '👥', status: 'idle' },
                  { name: 'SEO', icon: '🔍', status: 'idle' },
                  { name: 'Website', icon: '🌐', status: 'idle' },
                  { name: 'Brand', icon: '✨', status: 'idle' },
                  { name: 'Diagnostics', icon: '🔧', status: 'idle' },
                  { name: 'Executive', icon: '📈', status: 'idle' },
                ].map((agent) => (
                  <div
                    key={agent.name}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="text-2xl mb-2">{agent.icon}</div>
                    <div className="font-medium">{agent.name} Agent</div>
                    <Badge variant="outline" className="mt-2">
                      {agent.status}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <h4 className="font-medium mb-3">Launch Orchestration</h4>
                <div className="flex gap-3">
                  <Input placeholder="Goal: e.g., Launch Q1 campaign for all home services companies" className="flex-1" />
                  <Button>
                    <Play className="h-4 w-4 mr-2" />
                    Launch
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Policies Tab */}
        {activeTab === 'policies' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-500" />
                Governance Policies
              </CardTitle>
              <CardDescription>
                Rules that constrain Hive Brain behavior for safety
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    name: 'Budget Safety',
                    type: 'limit',
                    scope: 'global',
                    active: true,
                    description: 'Prevent excessive budget changes',
                  },
                  {
                    name: 'Brand Safety',
                    type: 'forbidden',
                    scope: 'global',
                    active: true,
                    description: 'Protect brand reputation',
                  },
                  {
                    name: 'Tracking Required',
                    type: 'required',
                    scope: 'global',
                    active: true,
                    description: 'Ensure proper tracking before scaling',
                  },
                  {
                    name: 'Healthcare Compliance',
                    type: 'forbidden',
                    scope: 'vertical',
                    active: true,
                    description: 'HIPAA and healthcare advertising compliance',
                  },
                ].map((policy) => (
                  <div
                    key={policy.name}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {policy.name}
                        <Badge variant="outline">{policy.type}</Badge>
                        <Badge variant="secondary">{policy.scope}</Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        {policy.description}
                      </div>
                    </div>
                    <Badge variant={policy.active ? 'default' : 'outline'}>
                      {policy.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Self-Evaluation Tab */}
        {activeTab === 'evaluation' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Self-Assessment
                </CardTitle>
                <CardDescription>
                  How well is the Hive Brain performing?
                </CardDescription>
              </CardHeader>
              <CardContent>
                {evalStats ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg">
                      <div className="text-3xl font-bold text-purple-600">
                        {Math.round(evalStats.predictionAccuracy.overall * 100)}%
                      </div>
                      <div className="text-sm text-gray-500">
                        Prediction Accuracy
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Trend: {evalStats.predictionAccuracy.recentTrend}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-green-50 rounded-lg text-center">
                        <div className="text-xl font-bold text-green-600">
                          {evalStats.autopilotQuality.goodDecisions}
                        </div>
                        <div className="text-xs text-gray-500">Good Decisions</div>
                      </div>
                      <div className="p-3 bg-red-50 rounded-lg text-center">
                        <div className="text-xl font-bold text-red-600">
                          {evalStats.autopilotQuality.badDecisions}
                        </div>
                        <div className="text-xs text-gray-500">Bad Decisions</div>
                      </div>
                    </div>

                    <div className="text-sm text-gray-500">
                      Tracking {evalStats.trackingStats.predictions} predictions,{' '}
                      {evalStats.trackingStats.decisions} decisions
                    </div>
                  </div>
                ) : (
                  <Button onClick={fetchEvalStats} disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <BarChart3 className="h-4 w-4 mr-2" />
                    )}
                    Load Stats
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  Learning Actions
                </CardTitle>
                <CardDescription>
                  Auto-generated improvement tasks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    'Improve CPA prediction model accuracy',
                    'Retrain creative performance estimator',
                    'Update home services playbook with Q4 data',
                    'Review autopilot budget decisions',
                  ].map((action, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="p-2 bg-blue-100 rounded-full">
                        <Lightbulb className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-sm">{action}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
