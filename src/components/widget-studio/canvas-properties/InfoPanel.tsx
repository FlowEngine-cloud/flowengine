'use client';

import React, { useMemo } from 'react';
import { Info } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  instance_id?: string | null;
  instance?: {
    id: string;
    instance_name: string;
  } | null;
}

interface InstanceWithoutCategory {
  id: string;
  instance_name: string;
}

interface InfoPanelProps {
  widgetName: string;
  widgetDescription: string;
  defaultWebhookPath: string;
  selectedInstanceIds: string[];
  categories: Category[];
  instancesWithoutCategory?: InstanceWithoutCategory[];
  widgetType?: 'chatbot' | 'form' | 'button';
  onWidgetNameChange: (name: string) => void;
  onWidgetDescriptionChange: (description: string) => void;
  onWebhookPathChange: (path: string) => void;
  onInstanceIdsChange: (ids: string[]) => void;
}

export function InfoPanel({
  widgetName,
  widgetDescription,
  defaultWebhookPath,
  selectedInstanceIds,
  categories,
  instancesWithoutCategory = [],
  widgetType,
  onWidgetNameChange,
  onWidgetDescriptionChange,
  onWebhookPathChange,
  onInstanceIdsChange,
}: InfoPanelProps) {
  const isChatbot = widgetType === 'chatbot';

  // Combine instances from categories and instancesWithoutCategory into a unified list
  const allInstances = useMemo(() => {
    const instances: Array<{ id: string; name: string }> = [];
    const seenIds = new Set<string>();

    // Add instances from categories
    categories.forEach((cat) => {
      const instanceId = cat.instance_id || cat.instance?.id;
      const instanceName = cat.instance?.instance_name || cat.name;
      if (instanceId && !seenIds.has(instanceId)) {
        seenIds.add(instanceId);
        instances.push({ id: instanceId, name: instanceName });
      }
    });

    // Add instances without categories
    instancesWithoutCategory.forEach((inst) => {
      if (!seenIds.has(inst.id)) {
        seenIds.add(inst.id);
        instances.push({ id: inst.id, name: inst.instance_name });
      }
    });

    return instances;
  }, [categories, instancesWithoutCategory]);

  const toggleInstance = (instanceId: string) => {
    if (selectedInstanceIds.includes(instanceId)) {
      onInstanceIdsChange(selectedInstanceIds.filter((id) => id !== instanceId));
    } else {
      onInstanceIdsChange([...selectedInstanceIds, instanceId]);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-800 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-5 h-5 text-white" />
          <h3 className="text-lg font-medium text-white">Component Information</h3>
        </div>
        <p className="text-sm text-gray-400">Configure basic component settings and metadata</p>
      </div>

      {/* Widget Name */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400">Component Name *</label>
        <input
          type="text"
          value={widgetName}
          onChange={(e) => onWidgetNameChange(e.target.value)}
          placeholder="My Awesome Component"
          className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white transition-colors"
        />
        <p className="text-xs text-gray-500">Give your component a descriptive name</p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400">Description</label>
        <textarea
          value={widgetDescription}
          onChange={(e) => onWidgetDescriptionChange(e.target.value)}
          placeholder="Describe what this component does..."
          rows={3}
          className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white transition-colors resize-none"
        />
        <p className="text-xs text-gray-500">Optional description for internal reference</p>
      </div>

      {/* Webhook/Chat URL */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400">
          {isChatbot ? 'Chat URL' : 'Webhook URL'}
        </label>
        <input
          type="text"
          value={defaultWebhookPath}
          onChange={(e) => onWebhookPathChange(e.target.value)}
          placeholder={isChatbot
            ? "https://your-n8n.com/webhook/abc123/chat"
            : "https://your-n8n.com/webhook/abc123"
          }
          className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white transition-colors"
        />
        <p className="text-xs text-gray-500">
          {isChatbot
            ? "Paste your n8n Chat Trigger URL (ends with /chat)"
            : "Paste your full n8n webhook URL"
          }
        </p>
      </div>

      {/* Instances */}
      {allInstances.length > 0 && (
        <div className="space-y-3">
          <label className="text-sm text-gray-400">Assign to Instance</label>
          <div className="flex flex-wrap gap-2">
            {allInstances.map((instance) => {
              const isSelected = selectedInstanceIds.includes(instance.id);
              return (
                <button
                  key={instance.id}
                  onClick={() => toggleInstance(instance.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-white text-black'
                      : 'bg-gray-800/30 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {instance.name}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-500">Select an instance to link this component</p>
        </div>
      )}

      {/* Instance Selection Info */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm text-white">About Instances</p>
            <p className="text-xs text-gray-400">
              Instances determine which n8n workflows can receive data from this component. Select the
              appropriate categories to route submissions correctly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
