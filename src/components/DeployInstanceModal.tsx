'use client';

import React, { useState, useEffect } from 'react';
import { X, HardDrive, Calendar, CreditCard, Loader2, Cloud, Link2, ExternalLink, Settings, AlertCircle } from 'lucide-react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import Link from 'next/link';

type DeployMode = 'connect' | 'cloud';

interface PricingTier {
  price: number;
  display: string;
  yearly?: string;
}

interface DeployInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (config: InstanceConfig) => void;
  onConnectInstance?: (config: ConnectInstanceConfig) => void;
  existingInstanceCount: number;
  isDeploying?: boolean;
  accessToken?: string;
  onSuccess?: () => void;
}

export interface InstanceConfig {
  name: string;
  storageSize: 10 | 30 | 50;
  billingCycle: 'monthly' | 'annual';
}

export interface ConnectInstanceConfig {
  name: string;
  instanceUrl: string;
  apiKey: string;
  serviceType: 'n8n' | 'openclaw';
}

const CLOUD_TIERS = [
  { size: 10 as const, cpu: 2, ram: 2, label: '10GB', badge: null },
  { size: 30 as const, cpu: 4, ram: 8, label: '30GB', badge: 'POPULAR' },
  { size: 50 as const, cpu: 6, ram: 16, label: '50GB', badge: null },
];

export default function DeployInstanceModal({
  isOpen,
  onClose,
  onDeploy,
  onConnectInstance,
  existingInstanceCount,
  isDeploying = false,
  accessToken,
  onSuccess,
}: DeployInstanceModalProps) {
  useEscapeKey(isOpen, onClose);

  const [mode, setMode] = useState<DeployMode>('connect');
  const [instanceName, setInstanceName] = useState('');

  // Cloud mode state
  const [storageSize, setStorageSize] = useState<10 | 30 | 50>(30);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [directCharging, setDirectCharging] = useState(false);

  // FlowEngine connection + pricing
  const [flowEngineConnected, setFlowEngineConnected] = useState<boolean | null>(null);
  const [instancePricing, setInstancePricing] = useState<Record<string, PricingTier> | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  // Connect mode state
  const [serviceType, setServiceType] = useState<'n8n' | 'openclaw'>('n8n');
  const [instanceUrl, setInstanceUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  const [deployError, setDeployError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDeployError(null);
      setFlowEngineConnected(null);
      setInstancePricing(null);
      setConnectionError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !instanceName) {
      setInstanceName(`Instance ${existingInstanceCount + 1}`);
    }
  }, [isOpen, existingInstanceCount, instanceName]);

  // Fetch FlowEngine connection status + pricing when cloud tab is selected
  useEffect(() => {
    if (!isOpen || mode !== 'cloud' || !accessToken || flowEngineConnected !== null) return;
    setPricingLoading(true);
    setConnectionError(null);
    fetch('/api/flowengine/pricing', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(res => res.ok ? res.json() : { connected: false, error: 'Failed to connect' })
      .then(data => {
        setFlowEngineConnected(data.connected);
        if (data.connected && data.pricing?.instances) {
          setInstancePricing(data.pricing.instances);
        }
        if (!data.connected && data.error) {
          setConnectionError(data.error);
        }
      })
      .catch(() => {
        setFlowEngineConnected(false);
        setConnectionError('Could not reach the server');
      })
      .finally(() => setPricingLoading(false));
  }, [isOpen, mode, accessToken, flowEngineConnected]);

  const pricingKey = `${storageSize}-${billingCycle}`;
  const currentPricing = instancePricing?.[pricingKey] || null;
  const selectedTier = CLOUD_TIERS.find(t => t.size === storageSize)!;

  const handleCloudDeploy = async () => {
    if (!instanceName.trim() || !accessToken) return;
    setDeployError(null);
    setDirectCharging(true);

    try {
      // Call FlowEngine provisioning API directly
      const res = await fetch('/api/flowengine/instances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          instanceName: instanceName.trim(),
          storageSize,
          billingCycle,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onClose();
        if (onSuccess) onSuccess();
        else window.location.reload();
        return;
      }
      setDeployError(data.message || data.error || 'Deployment failed. Please try again.');
    } catch {
      setDeployError('Something went wrong. Please try again.');
    } finally {
      setDirectCharging(false);
    }
  };

  const handleConnectInstance = () => {
    if (!instanceName.trim() || !instanceUrl.trim()) return;
    if (serviceType === 'n8n' && !apiKey.trim()) {
      setDeployError('API key is required for n8n instances');
      return;
    }
    setDeployError(null);

    if (onConnectInstance) {
      onConnectInstance({
        name: instanceName.trim(),
        instanceUrl: instanceUrl.trim(),
        apiKey: apiKey.trim(),
        serviceType,
      });
    }
  };

  const isProcessing = isDeploying || directCharging;
  const canConnect = instanceName.trim() && instanceUrl.trim() && (serviceType !== 'n8n' || apiKey.trim());

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !isProcessing) onClose(); }}
    >
      <div className="relative w-full max-w-lg bg-gray-900/70 rounded-xl border border-gray-800 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-30"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-semibold text-white">New Instance</h2>
          <p className="text-white/60 text-sm mt-1">Connect an existing instance or deploy via cloud</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Mode Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode('connect')}
              className={`p-4 rounded-lg border transition-all cursor-pointer text-left ${
                mode === 'connect'
                  ? 'border-white bg-gray-800/30'
                  : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
              }`}
            >
              <Link2 className="w-5 h-5 text-white mb-2" />
              <div className="text-white font-medium text-sm">Connect Existing</div>
              <div className="text-white/60 text-sm mt-0.5">Link your own instance</div>
            </button>
            <button
              onClick={() => setMode('cloud')}
              className={`p-4 rounded-lg border transition-all cursor-pointer text-left ${
                mode === 'cloud'
                  ? 'border-white bg-gray-800/30'
                  : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
              }`}
            >
              <Cloud className="w-5 h-5 text-white mb-2" />
              <div className="text-white font-medium text-sm">FlowEngine Cloud</div>
              <div className="text-white/60 text-sm mt-0.5">Managed hosting</div>
            </button>
          </div>

          {/* Instance Name - shared (only show when connected or in connect mode) */}
          {(mode === 'connect' || flowEngineConnected) && (
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Instance Name</label>
              <input
                type="text"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="e.g., Production Workflows"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                maxLength={50}
              />
            </div>
          )}

          {/* ========== CONNECT MODE ========== */}
          {mode === 'connect' && (
            <>
              {/* Service Type */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Service Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setServiceType('n8n')}
                    className={`p-3 rounded-lg border transition-all cursor-pointer text-left ${
                      serviceType === 'n8n'
                        ? 'border-white bg-gray-800/30'
                        : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-white font-medium text-sm">n8n</div>
                    <div className="text-white/60 text-sm mt-0.5">Workflow automation</div>
                  </button>
                  <button
                    onClick={() => setServiceType('openclaw')}
                    className={`p-3 rounded-lg border transition-all cursor-pointer text-left ${
                      serviceType === 'openclaw'
                        ? 'border-white bg-gray-800/30'
                        : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-white font-medium text-sm">OpenClaw</div>
                    <div className="text-white/60 text-sm mt-0.5">AI agent runtime</div>
                  </button>
                </div>
              </div>

              {/* Instance URL */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Instance URL</label>
                <input
                  type="url"
                  value={instanceUrl}
                  onChange={(e) => setInstanceUrl(e.target.value)}
                  placeholder={serviceType === 'n8n' ? 'https://n8n.example.com' : 'https://openclaw.example.com'}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                />
              </div>

              {/* API Key (required for n8n only) */}
              {serviceType === 'n8n' && (
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="n8n API key for management"
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                  />
                  <p className="text-gray-500 text-sm mt-1.5">
                    Required for workflow management, executions, and credentials
                  </p>
                </div>
              )}

              {/* Info box */}
              <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                <p className="text-white/60 text-sm">
                  {serviceType === 'n8n'
                    ? 'Your n8n instance will be connected via its REST API. You can manage workflows, executions, and credentials directly from the portal.'
                    : 'Your OpenClaw instance will be registered with its URL. The portal will monitor its health status and provide a quick-access link.'}
                </p>
              </div>
            </>
          )}

          {/* ========== CLOUD MODE ========== */}
          {mode === 'cloud' && (
            <>
              {pricingLoading ? (
                <div className="flex items-center justify-center gap-2 py-8">
                  <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
                  <span className="text-white/40 text-sm">Loading pricing...</span>
                </div>
              ) : flowEngineConnected === false ? (
                /* Not connected — show CTA */
                <div className="p-6 bg-gray-800/20 rounded-lg border border-gray-700 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-gray-800/50 border border-gray-700 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-white/40" />
                  </div>
                  <div>
                    <p className="text-white font-medium">FlowEngine API not connected</p>
                    <p className="text-white/50 text-sm mt-1">
                      {connectionError || 'Add your FlowEngine API key in settings to deploy managed cloud instances.'}
                    </p>
                  </div>
                  <Link
                    href="/portal/settings?tab=connections#flowengine"
                    onClick={onClose}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Go to Settings
                  </Link>
                </div>
              ) : !instancePricing ? (
                /* Connected but pricing data not available */
                <div className="p-6 bg-gray-800/20 rounded-lg border border-gray-700 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-gray-800/50 border border-gray-700 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-white/40" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Pricing unavailable</p>
                    <p className="text-white/50 text-sm mt-1">
                      Connected to FlowEngine but couldn&apos;t load pricing. Please try again later.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Tier Selection */}
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-2">
                      <HardDrive className="inline-block w-4 h-4 mr-1.5 text-gray-400" />
                      Plan
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {CLOUD_TIERS.map((tier) => (
                        <button
                          key={tier.size}
                          onClick={() => setStorageSize(tier.size)}
                          className={`relative p-4 rounded-lg border transition-all cursor-pointer text-left ${
                            storageSize === tier.size
                              ? 'border-white bg-gray-800/30'
                              : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                          }`}
                        >
                          {tier.badge && (
                            <span className="absolute -top-2 right-3 px-2 py-0.5 bg-white text-black text-[10px] font-bold rounded-full">
                              {tier.badge}
                            </span>
                          )}
                          <div className="text-white font-medium">{tier.label}</div>
                          <div className="text-white/60 text-sm mt-1">{tier.ram}GB RAM</div>
                          <div className="text-white/60 text-sm">{tier.cpu} CPU</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Billing Cycle */}
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-2">
                      <Calendar className="inline-block w-4 h-4 mr-1.5 text-gray-400" />
                      Billing
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setBillingCycle('monthly')}
                        className={`p-4 rounded-lg border transition-all cursor-pointer text-left ${
                          billingCycle === 'monthly'
                            ? 'border-white bg-gray-800/30'
                            : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                        }`}
                      >
                        <div className="text-white font-medium">Monthly</div>
                        <div className="text-white/60 text-sm mt-0.5">
                          {currentPricing?.display || 'Billed monthly'}
                        </div>
                      </button>
                      <button
                        onClick={() => setBillingCycle('annual')}
                        className={`relative p-4 rounded-lg border transition-all cursor-pointer text-left ${
                          billingCycle === 'annual'
                            ? 'border-white bg-gray-800/30'
                            : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                        }`}
                      >
                        <span className="absolute -top-2 right-3 px-2 py-0.5 bg-white text-black text-[10px] font-bold rounded-full">
                          SAVE 20%
                        </span>
                        <div className="text-white font-medium">Annual</div>
                        <div className="text-white/60 text-sm mt-0.5">
                          {currentPricing?.display || 'Save 20%'}
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Pricing + Specs Summary */}
                  <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white/60 text-sm">Total</span>
                      <div className="text-right">
                        <span className="text-white font-bold text-lg">{currentPricing?.display}</span>
                        {billingCycle === 'annual' && currentPricing?.yearly && (
                          <div className="text-gray-500 text-sm">{currentPricing.yearly} billed annually</div>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-gray-700 pt-3 grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-white font-medium text-sm">{selectedTier.cpu} cores</div>
                        <div className="text-white/60 text-sm">CPU</div>
                      </div>
                      <div>
                        <div className="text-white font-medium text-sm">{selectedTier.ram}GB</div>
                        <div className="text-white/60 text-sm">RAM</div>
                      </div>
                      <div>
                        <div className="text-white font-medium text-sm">{selectedTier.size}GB</div>
                        <div className="text-white/60 text-sm">SSD</div>
                      </div>
                    </div>
                  </div>

                  {/* Billing info */}
                  <div className="flex items-center gap-2 p-3 bg-gray-800/30 rounded-lg border border-gray-700">
                    <CreditCard className="w-4 h-4 text-white/60" />
                    <span className="text-sm text-white/60">
                      Billed via your FlowEngine account
                    </span>
                  </div>
                </>
              )}
            </>
          )}

          {/* Error */}
          {deployError && (
            <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg">
              <p className="text-sm text-red-400">{deployError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 space-y-3">
          {mode === 'cloud' && flowEngineConnected && instancePricing ? (
            <>
              <button
                onClick={handleCloudDeploy}
                disabled={isProcessing || !instanceName.trim()}
                className="w-full px-4 py-3 bg-white hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 text-black rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Deploying...</span></>
                ) : (
                  <><Cloud className="w-4 h-4" /><span>Deploy Instance</span></>
                )}
              </button>
              <p className="text-gray-500 text-sm text-center">
                Instance will be provisioned via FlowEngine
              </p>
            </>
          ) : mode === 'connect' ? (
            <>
              <button
                onClick={handleConnectInstance}
                disabled={isProcessing || !canConnect}
                className="w-full px-4 py-3 bg-white hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 text-black rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Connecting...</span></>
                ) : (
                  <><ExternalLink className="w-4 h-4" /><span>Connect Instance</span></>
                )}
              </button>
              <p className="text-gray-500 text-sm text-center">
                Instance URL will be verified on connect
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
