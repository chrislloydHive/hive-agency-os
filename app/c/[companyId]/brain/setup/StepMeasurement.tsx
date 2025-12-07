'use client';

// app/c/[companyId]/setup/StepMeasurement.tsx
// Step 9: Measurement Setup with GA4/GSC Auto-Import

import { useState, useEffect, useCallback } from 'react';
import { SetupFormData } from './types';
import { FormSection, FormField, TagInput, inputStyles } from './components/StepContainer';

interface StepMeasurementProps {
  companyId: string;
  formData: Partial<SetupFormData>;
  updateStepData: <K extends keyof SetupFormData>(
    stepKey: K,
    data: Partial<SetupFormData[K]>
  ) => void;
  errors: Record<string, string[]>;
}

interface GoogleConnectionStatus {
  connected: boolean;
  ga4Connected: boolean;
  gscConnected: boolean;
  ga4PropertyId?: string;
  ga4MeasurementId?: string;
  gscSiteUrl?: string;
  connectedEmail?: string;
}

interface GA4Account {
  name: string;
  displayName: string;
  properties: Array<{
    name: string;
    displayName: string;
  }>;
}

interface GSCSite {
  siteUrl: string;
  permissionLevel: string;
}

const CONVERSION_EVENT_SUGGESTIONS = [
  'purchase',
  'generate_lead',
  'submit_form',
  'phone_call',
  'schedule_appointment',
  'add_to_cart',
  'begin_checkout',
  'sign_up',
  'page_view',
  'scroll',
];

const TRACKING_TOOL_SUGGESTIONS = [
  'Google Tag Manager',
  'Google Analytics 4',
  'Google Ads Conversion Tracking',
  'Meta Pixel',
  'LinkedIn Insight Tag',
  'Microsoft UET',
  'CallRail',
  'CallTrackingMetrics',
  'Hotjar',
  'Mixpanel',
];

const ATTRIBUTION_MODELS = [
  { value: 'last_click', label: 'Last Click', description: 'Credit to final touchpoint before conversion' },
  { value: 'first_click', label: 'First Click', description: 'Credit to first touchpoint in the journey' },
  { value: 'linear', label: 'Linear', description: 'Equal credit across all touchpoints' },
  { value: 'time_decay', label: 'Time Decay', description: 'More credit to touchpoints closer to conversion' },
  { value: 'position_based', label: 'Position Based', description: '40% first, 40% last, 20% middle touches' },
  { value: 'data_driven', label: 'Data-Driven', description: 'ML-based attribution using available data' },
];

const ATTRIBUTION_WINDOWS = [
  { value: '1_day', label: '1 Day' },
  { value: '7_days', label: '7 Days' },
  { value: '14_days', label: '14 Days' },
  { value: '30_days', label: '30 Days' },
  { value: '60_days', label: '60 Days' },
  { value: '90_days', label: '90 Days' },
];

const CALL_TRACKING_OPTIONS = [
  { value: 'none', label: 'Not Tracking Calls', description: 'No call tracking in place' },
  { value: 'basic', label: 'Basic Tracking', description: 'Simple call counting only' },
  { value: 'dynamic', label: 'Dynamic Numbers', description: 'Source-level tracking with dynamic insertion' },
  { value: 'advanced', label: 'Advanced', description: 'Call recording, scoring, and CRM integration' },
];

export function StepMeasurement({
  companyId,
  formData,
  updateStepData,
}: StepMeasurementProps) {
  const data = formData.measurement || {
    ga4PropertyId: '',
    ga4ConversionEvents: [],
    callTracking: '',
    trackingTools: [],
    attributionModel: '',
    attributionWindow: '',
  };

  // Google connection state
  const [googleStatus, setGoogleStatus] = useState<GoogleConnectionStatus | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(true);

  // GA4 property selection state
  const [ga4Accounts, setGa4Accounts] = useState<GA4Account[] | null>(null);
  const [loadingGa4Properties, setLoadingGa4Properties] = useState(false);
  const [showGa4Picker, setShowGa4Picker] = useState(false);
  const [connectingGa4, setConnectingGa4] = useState(false);
  const [syncingGa4, setSyncingGa4] = useState(false);

  // GSC site selection state
  const [gscSites, setGscSites] = useState<GSCSite[] | null>(null);
  const [loadingGscSites, setLoadingGscSites] = useState(false);
  const [showGscPicker, setShowGscPicker] = useState(false);
  const [connectingGsc, setConnectingGsc] = useState(false);
  const [syncingGsc, setSyncingGsc] = useState(false);

  const update = (changes: Partial<typeof data>) => {
    updateStepData('measurement', changes);
  };

  // Fetch Google connection status
  const fetchGoogleStatus = useCallback(async () => {
    try {
      // Fetch overall Google connection status
      const response = await fetch(`/api/os/companies/${companyId}/measurement/google`);
      const statusData = await response.json();

      setGoogleStatus({
        connected: statusData.connected,
        ga4Connected: statusData.ga4Connected,
        gscConnected: statusData.gscConnected,
        ga4PropertyId: statusData.ga4PropertyId,
        ga4MeasurementId: statusData.ga4MeasurementId,
        gscSiteUrl: statusData.gscSiteUrl,
        connectedEmail: statusData.connectedEmail,
      });

      // Fetch GA4 details if connected
      const ga4Data = statusData.ga4Connected ?
        await fetch(`/api/os/companies/${companyId}/measurement/ga4/sync`).then(r => r.json()) :
        null;

      // Auto-fill form data from GA4 if connected
      if (ga4Data?.connected && ga4Data.ga4) {
        const ga4 = ga4Data.ga4;
        const updates: Partial<typeof data> = {};

        if (ga4.measurementId && !data.ga4PropertyId) {
          updates.ga4PropertyId = ga4.measurementId;
        }
        if (ga4.conversionEvents?.length && !data.ga4ConversionEvents.length) {
          updates.ga4ConversionEvents = ga4.conversionEvents;
        }
        if (ga4.attributionSettings) {
          if (!data.attributionModel && ga4.attributionSettings.reportingAttributionModel) {
            // Map GA4 attribution model to our values
            const modelMap: Record<string, string> = {
              'CROSS_CHANNEL_DATA_DRIVEN': 'data_driven',
              'CROSS_CHANNEL_LAST_CLICK': 'last_click',
              'CROSS_CHANNEL_FIRST_CLICK': 'first_click',
              'CROSS_CHANNEL_LINEAR': 'linear',
              'CROSS_CHANNEL_POSITION_BASED': 'position_based',
              'CROSS_CHANNEL_TIME_DECAY': 'time_decay',
            };
            updates.attributionModel = modelMap[ga4.attributionSettings.reportingAttributionModel] || '';
          }
        }

        if (Object.keys(updates).length > 0) {
          update(updates);
        }
      }
    } catch (error) {
      console.error('Error fetching Google status:', error);
    } finally {
      setLoadingGoogle(false);
    }
  }, [companyId, data.ga4PropertyId, data.ga4ConversionEvents.length, data.attributionModel]);

  useEffect(() => {
    fetchGoogleStatus();
  }, [fetchGoogleStatus]);

  // Check URL params for OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'true') {
      // Refresh status after OAuth callback
      fetchGoogleStatus();
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('google_connected');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [fetchGoogleStatus]);

  // Connect Google OAuth
  const connectGoogle = () => {
    const redirectUrl = `/c/${companyId}/brain/setup?step=9`;
    window.location.href = `/api/integrations/google/authorize?companyId=${companyId}&redirect=${encodeURIComponent(redirectUrl)}`;
  };

  // Load GA4 properties
  const loadGa4Properties = async () => {
    setLoadingGa4Properties(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/measurement/ga4/connect`);
      const data = await response.json();

      if (data.status === 'ok') {
        setGa4Accounts(data.accounts);
        setShowGa4Picker(true);
      } else if (data.status === 'not_connected') {
        // Need to connect Google first
        connectGoogle();
      }
    } catch (error) {
      console.error('Error loading GA4 properties:', error);
    } finally {
      setLoadingGa4Properties(false);
    }
  };

  // Connect GA4 property
  const connectGa4Property = async (propertyId: string) => {
    setConnectingGa4(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/measurement/ga4/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      const data = await response.json();

      if (data.status === 'ok' && data.ga4) {
        // Update form with imported data
        const updates: Partial<typeof formData.measurement> = {};
        if (data.ga4.measurementId) {
          updates.ga4PropertyId = data.ga4.measurementId;
        }
        if (data.ga4.conversionEvents?.length) {
          updates.ga4ConversionEvents = data.ga4.conversionEvents;
        }
        update(updates);

        // Refresh status
        await fetchGoogleStatus();
        setShowGa4Picker(false);
      }
    } catch (error) {
      console.error('Error connecting GA4:', error);
    } finally {
      setConnectingGa4(false);
    }
  };

  // Sync GA4 data
  const syncGa4 = async () => {
    setSyncingGa4(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/measurement/ga4/sync`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.status === 'ok' && data.ga4) {
        // Update form with refreshed data
        const updates: Partial<typeof formData.measurement> = {};
        if (data.ga4.conversionEvents?.length) {
          updates.ga4ConversionEvents = data.ga4.conversionEvents;
        }
        update(updates);
        await fetchGoogleStatus();
      }
    } catch (error) {
      console.error('Error syncing GA4:', error);
    } finally {
      setSyncingGa4(false);
    }
  };

  // Load GSC sites
  const loadGscSites = async () => {
    setLoadingGscSites(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/measurement/gsc/connect`);
      const data = await response.json();

      if (data.status === 'ok') {
        setGscSites(data.sites);
        setShowGscPicker(true);
      } else if (data.status === 'not_connected') {
        // Need to connect Google first
        connectGoogle();
      }
    } catch (error) {
      console.error('Error loading GSC sites:', error);
    } finally {
      setLoadingGscSites(false);
    }
  };

  // Connect GSC site
  const connectGscSite = async (siteUrl: string) => {
    setConnectingGsc(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/measurement/gsc/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl }),
      });
      const data = await response.json();

      if (data.status === 'ok') {
        await fetchGoogleStatus();
        setShowGscPicker(false);
      }
    } catch (error) {
      console.error('Error connecting GSC:', error);
    } finally {
      setConnectingGsc(false);
    }
  };

  // Sync GSC data
  const syncGsc = async () => {
    setSyncingGsc(true);
    try {
      await fetch(`/api/os/companies/${companyId}/measurement/gsc/sync`, {
        method: 'POST',
      });
      await fetchGoogleStatus();
    } catch (error) {
      console.error('Error syncing GSC:', error);
    } finally {
      setSyncingGsc(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Google Integration Banner */}
      {!loadingGoogle && (
        <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-slate-200">Google Integration</h3>
                <p className="text-sm text-slate-400">
                  {googleStatus?.connected
                    ? `Connected${googleStatus.connectedEmail ? ` as ${googleStatus.connectedEmail}` : ''}`
                    : 'Connect to import GA4 and Search Console data automatically'
                  }
                </p>
              </div>
            </div>
            {!googleStatus?.connected && (
              <button
                onClick={connectGoogle}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Connect Google
              </button>
            )}
          </div>

          {googleStatus?.connected && (
            <div className="mt-4 flex gap-3">
              {/* GA4 Status */}
              <div className="flex-1 p-3 bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200">Google Analytics 4</span>
                      {googleStatus.ga4Connected && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {googleStatus.ga4MeasurementId || 'Not configured'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {googleStatus.ga4Connected ? (
                      <button
                        onClick={syncGa4}
                        disabled={syncingGa4}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {syncingGa4 ? 'Syncing...' : 'Sync'}
                      </button>
                    ) : (
                      <button
                        onClick={loadGa4Properties}
                        disabled={loadingGa4Properties}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {loadingGa4Properties ? 'Loading...' : 'Connect GA4'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* GSC Status */}
              <div className="flex-1 p-3 bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200">Search Console</span>
                      {googleStatus.gscConnected && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                      {googleStatus.gscSiteUrl || 'Not configured'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {googleStatus.gscConnected ? (
                      <button
                        onClick={syncGsc}
                        disabled={syncingGsc}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {syncingGsc ? 'Syncing...' : 'Sync'}
                      </button>
                    ) : (
                      <button
                        onClick={loadGscSites}
                        disabled={loadingGscSites}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {loadingGscSites ? 'Loading...' : 'Connect GSC'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GA4 Property Picker Modal */}
      {showGa4Picker && ga4Accounts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-slate-200 mb-4">Select GA4 Property</h3>
            <div className="space-y-3">
              {ga4Accounts.length === 0 ? (
                <p className="text-slate-400 text-sm">No GA4 properties found for this account.</p>
              ) : (
                ga4Accounts.map((account) => (
                  <div key={account.name} className="space-y-2">
                    <div className="text-sm font-medium text-slate-400">{account.displayName}</div>
                    {account.properties.map((property) => (
                      <button
                        key={property.name}
                        onClick={() => connectGa4Property(property.name)}
                        disabled={connectingGa4}
                        className="w-full text-left p-3 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <div className="font-medium text-slate-200">{property.displayName}</div>
                        <div className="text-xs text-slate-500">{property.name}</div>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowGa4Picker(false)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GSC Site Picker Modal */}
      {showGscPicker && gscSites && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-slate-200 mb-4">Select Search Console Property</h3>
            <div className="space-y-2">
              {gscSites.length === 0 ? (
                <p className="text-slate-400 text-sm">No Search Console properties found for this account.</p>
              ) : (
                gscSites.map((site) => (
                  <button
                    key={site.siteUrl}
                    onClick={() => connectGscSite(site.siteUrl)}
                    disabled={connectingGsc}
                    className="w-full text-left p-3 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <div className="font-medium text-slate-200">{site.siteUrl}</div>
                    <div className="text-xs text-slate-500">{site.permissionLevel}</div>
                  </button>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowGscPicker(false)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GA4 Setup */}
      <FormSection
        title="Google Analytics 4"
        description="Core analytics configuration"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="GA4 Property ID"
            hint="Format: G-XXXXXXXXXX"
          >
            <input
              type="text"
              value={data.ga4PropertyId}
              onChange={(e) => update({ ga4PropertyId: e.target.value })}
              className={inputStyles.base}
              placeholder="G-1234567890"
            />
          </FormField>

          <div /> {/* Spacer */}
        </div>

        <FormField
          label="Conversion Events"
          hint="Key events tracked as conversions"
        >
          <TagInput
            value={data.ga4ConversionEvents}
            onChange={(tags) => update({ ga4ConversionEvents: tags })}
            placeholder="Add conversion events..."
            suggestions={CONVERSION_EVENT_SUGGESTIONS}
          />
        </FormField>
      </FormSection>

      {/* Call Tracking */}
      <FormSection
        title="Call Tracking"
        description="How is the business tracking phone calls?"
      >
        <FormField label="Call Tracking Setup">
          <div className="grid grid-cols-2 gap-3">
            {CALL_TRACKING_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => update({ callTracking: option.value })}
                className={`text-left p-4 rounded-lg border transition-all ${
                  data.callTracking === option.value
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <div className="font-medium text-slate-200">{option.label}</div>
                <div className="text-xs text-slate-500 mt-1">{option.description}</div>
              </button>
            ))}
          </div>
        </FormField>
      </FormSection>

      {/* Tracking Stack */}
      <FormSection
        title="Tracking Stack"
        description="Tools and pixels in use"
      >
        <FormField
          label="Tracking Tools"
          hint="All tracking tools and pixels installed"
        >
          <TagInput
            value={data.trackingTools}
            onChange={(tags) => update({ trackingTools: tags })}
            placeholder="Add tracking tools..."
            suggestions={TRACKING_TOOL_SUGGESTIONS}
          />
        </FormField>
      </FormSection>

      {/* Attribution */}
      <FormSection
        title="Attribution"
        description="How does the business measure marketing effectiveness?"
      >
        <FormField label="Attribution Model" hint="How conversions are credited to touchpoints">
          <div className="grid grid-cols-3 gap-3">
            {ATTRIBUTION_MODELS.map((model) => (
              <button
                key={model.value}
                type="button"
                onClick={() => update({ attributionModel: model.value })}
                className={`text-left p-3 rounded-lg border transition-all ${
                  data.attributionModel === model.value
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <div className="font-medium text-sm text-slate-200">{model.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{model.description}</div>
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Attribution Window" hint="How long after a click to count conversions">
          <div className="flex gap-2">
            {ATTRIBUTION_WINDOWS.map((window) => (
              <button
                key={window.value}
                type="button"
                onClick={() => update({ attributionWindow: window.value })}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  data.attributionWindow === window.value
                    ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                    : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                }`}
              >
                {window.label}
              </button>
            ))}
          </div>
        </FormField>
      </FormSection>

      {/* Measurement Readiness */}
      <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
        <h4 className="font-medium text-slate-200 mb-3">Measurement Readiness</h4>
        <div className="space-y-2">
          <ReadinessItem
            label="GA4 Property"
            isReady={!!data.ga4PropertyId}
            description={data.ga4PropertyId || 'Not configured'}
          />
          <ReadinessItem
            label="Conversion Events"
            isReady={data.ga4ConversionEvents.length > 0}
            description={`${data.ga4ConversionEvents.length} events configured`}
          />
          <ReadinessItem
            label="Call Tracking"
            isReady={!!data.callTracking && data.callTracking !== 'none'}
            description={data.callTracking || 'Not configured'}
          />
          <ReadinessItem
            label="Attribution Model"
            isReady={!!data.attributionModel}
            description={
              ATTRIBUTION_MODELS.find((m) => m.value === data.attributionModel)?.label ||
              'Not selected'
            }
          />
        </div>
      </div>
    </div>
  );
}

function ReadinessItem({
  label,
  isReady,
  description,
}: {
  label: string;
  isReady: boolean;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center ${
          isReady ? 'bg-green-500/20' : 'bg-slate-700'
        }`}
      >
        {isReady ? (
          <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <div className="w-2 h-2 bg-slate-500 rounded-full" />
        )}
      </div>
      <div className="flex-1">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-sm text-slate-500 ml-2">— {description}</span>
      </div>
    </div>
  );
}
