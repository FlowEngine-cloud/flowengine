'use client';

/**
 * AddCredentialModal Component
 * Modal for adding new credentials with dynamic form based on n8n schema
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Loader2, Eye, EyeOff, AlertCircle, Key, Search, ArrowLeft, ChevronDown, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import CredentialIcon from './CredentialIcon';
import { CREDENTIAL_MAPPINGS } from '@/lib/n8n/credentialExtractor';

interface SchemaField {
  name: string;
  displayName?: string;
  type?: string;
  required?: boolean;
  default?: any;
  description?: string;
  options?: Array<{ name: string; value: string }>;
}

interface CredentialSchema {
  properties?: Record<string, any>;
  required?: string[];
}

interface N8nCredentialType {
  name: string;
  displayName: string;
  properties?: any[];
  documentationUrl?: string;
}

interface ExistingCredential {
  id?: string;
  type: string;
  name: string;
}

interface AddCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (type: string, name: string, data: Record<string, any>) => Promise<void>;
  fetchSchema: (type: string) => Promise<{ schema?: CredentialSchema; docUrl?: string; error?: string }>;
  preselectedType?: string | null;
  instanceUrl?: string; // n8n instance URL for OAuth redirect
  instanceId?: string; // Instance ID for fetching credential types
  accessToken?: string; // Access token for API calls
  allowFullAccess?: boolean; // Whether client has full n8n access
  onOAuthSuccess?: () => void; // Callback when OAuth credential is created successfully
  requiredTypes?: string[]; // Credential types that workflows actually need - only these can be added
  existingCredentials?: ExistingCredential[]; // Existing credentials to auto-number duplicates
}

// API Key-based credentials (can be added via form)
const API_KEY_CREDENTIALS = [
  { type: 'openAiApi', name: 'OpenAI', icon: 'openai' },
  { type: 'anthropicApi', name: 'Anthropic', icon: 'anthropic' },
  { type: 'flowEngineApi', name: 'FlowEngine LLM', icon: 'bot' },
  { type: 'stripeApi', name: 'Stripe', icon: 'stripe' },
  { type: 'httpHeaderAuth', name: 'HTTP Header', icon: 'api' },
  { type: 'telegramApi', name: 'Telegram', icon: 'telegram' },
  { type: 'sendGridApi', name: 'SendGrid', icon: 'sendgrid' },
  { type: 'twilioApi', name: 'Twilio', icon: 'twilio' },
  { type: 'pineconeApi', name: 'Pinecone', icon: 'pinecone' },
  { type: 'groqApi', name: 'Groq', icon: 'groq' },
  { type: 'deepLApi', name: 'DeepL', icon: 'deepl' },
  { type: 'mistralCloudApi', name: 'Mistral AI', icon: 'mistral' },
  { type: 'cohereApi', name: 'Cohere', icon: 'cohere' },
  { type: 'perplexityApi', name: 'Perplexity', icon: 'perplexity' },
  { type: 'mailchimpApi', name: 'Mailchimp', icon: 'mailchimp' },
  { type: 'linearApi', name: 'Linear', icon: 'linear' },
  { type: 'jiraApi', name: 'Jira', icon: 'jira' },
  { type: 'asanaApi', name: 'Asana', icon: 'asana' },
  { type: 'clickupApi', name: 'ClickUp', icon: 'clickup' },
  { type: 'mondayComApi', name: 'Monday.com', icon: 'monday' },
  { type: 'dropboxApi', name: 'Dropbox', icon: 'dropbox' },
  { type: 'intercomApi', name: 'Intercom', icon: 'intercom' },
  { type: 'zendeskApi', name: 'Zendesk', icon: 'zendesk' },
  { type: 'freshworksApi', name: 'Freshworks', icon: 'freshworks' },
  { type: 'pipedriveApi', name: 'Pipedrive', icon: 'pipedrive' },
  { type: 'activeCampaignApi', name: 'ActiveCampaign', icon: 'activecampaign' },
  { type: 'convertKitApi', name: 'ConvertKit', icon: 'convertkit' },
  { type: 'calendlyApi', name: 'Calendly', icon: 'calendly' },
  { type: 'typeformApi', name: 'Typeform', icon: 'typeform' },
  { type: 'webflowApi', name: 'Webflow', icon: 'webflow' },
  { type: 'figmaApi', name: 'Figma', icon: 'figma' },
  { type: 'miroApi', name: 'Miro', icon: 'miro' },
  { type: 'awsApi', name: 'AWS', icon: 'aws' },
  { type: 'digitalOceanApi', name: 'DigitalOcean', icon: 'digitalocean' },
  { type: 'cloudflareApi', name: 'Cloudflare', icon: 'cloudflare' },
  { type: 'vercelApi', name: 'Vercel', icon: 'vercel' },
];

// OAuth-based credentials (require OAuth flow)
const OAUTH_CREDENTIALS = [
  // Google services (n8n requires separate credentials per service)
  { type: 'gmailOAuth2', name: 'Gmail', icon: 'gmail' },
  { type: 'googleSheetsOAuth2Api', name: 'Google Sheets', icon: 'sheets' },
  { type: 'googleDriveOAuth2Api', name: 'Google Drive', icon: 'drive' },
  { type: 'googleCalendarOAuth2Api', name: 'Google Calendar', icon: 'calendar' },
  { type: 'googleDocsOAuth2Api', name: 'Google Docs', icon: 'docs' },
  { type: 'googleBigQueryOAuth2Api', name: 'Google BigQuery', icon: 'bigquery' },
  { type: 'googleAnalyticsOAuth2', name: 'Google Analytics', icon: 'analytics' },
  { type: 'googleAdsOAuth2Api', name: 'Google Ads', icon: 'ads' },
  { type: 'googleContactsOAuth2Api', name: 'Google Contacts', icon: 'contacts' },
  { type: 'googleChatOAuth2Api', name: 'Google Chat', icon: 'chat' },
  { type: 'googleTasksOAuth2Api', name: 'Google Tasks', icon: 'tasks' },
  { type: 'googleSlidesOAuth2Api', name: 'Google Slides', icon: 'slides' },
  { type: 'googleTranslateOAuth2Api', name: 'Google Translate', icon: 'translate' },
  { type: 'googleVertexOAuth2Api', name: 'Vertex AI (Gemini)', icon: 'gemini' },
  { type: 'googleFormsOAuth2Api', name: 'Google Forms', icon: 'forms' },
  { type: 'googleBooksOAuth2Api', name: 'Google Books', icon: 'books' },
  { type: 'googleBusinessProfileOAuth2Api', name: 'Google Business Profile', icon: 'business' },
  { type: 'googleCloudStorageOAuth2Api', name: 'Google Cloud Storage', icon: 'storage' },
  { type: 'googlePerspectiveOAuth2Api', name: 'Google Perspective', icon: 'perspective' },
  { type: 'googleFirebaseCloudFirestoreOAuth2Api', name: 'Firebase Firestore', icon: 'firebase' },
  { type: 'googleFirebaseRealtimeDatabaseOAuth2Api', name: 'Firebase Realtime DB', icon: 'firebase' },
  { type: 'gSuiteAdminOAuth2Api', name: 'Google Workspace Admin', icon: 'workspace' },
  { type: 'googleCloudNaturalLanguageOAuth2Api', name: 'Cloud Natural Language', icon: 'nlp' },
  // Microsoft services
  { type: 'microsoftOAuth2Api', name: 'Microsoft 365', icon: 'microsoft' },
  { type: 'microsoftOneDriveOAuth2Api', name: 'OneDrive', icon: 'onedrive' },
  { type: 'microsoftOutlookOAuth2Api', name: 'Outlook', icon: 'outlook' },
  { type: 'microsoftTeamsOAuth2Api', name: 'Microsoft Teams', icon: 'teams' },
  { type: 'microsoftCalendarOAuth2Api', name: 'Microsoft Calendar', icon: 'calendar' },
  { type: 'microsoftExcelOAuth2Api', name: 'Microsoft Excel', icon: 'excel' },
  { type: 'microsoftSharePointOAuth2Api', name: 'SharePoint', icon: 'sharepoint' },
  // Other OAuth services (FlowEngine-handled)
  { type: 'slackOAuth2Api', name: 'Slack', icon: 'slack' },
  { type: 'linkedInOAuth2Api', name: 'LinkedIn', icon: 'linkedin' },
  { type: 'redditOAuth2Api', name: 'Reddit', icon: 'reddit' },
  { type: 'twitterOAuth2Api', name: 'Twitter/X', icon: 'twitter' },
  // Other OAuth services (n8n-handled)
  { type: 'notionOAuth2Api', name: 'Notion', icon: 'notion' },
  { type: 'airtableOAuth2Api', name: 'Airtable', icon: 'airtable' },
  { type: 'githubOAuth2Api', name: 'GitHub', icon: 'github' },
  { type: 'hubspotOAuth2Api', name: 'HubSpot', icon: 'hubspot' },
  { type: 'discordOAuth2Api', name: 'Discord', icon: 'discord' },
  { type: 'facebookGraphApi', name: 'Facebook', icon: 'facebook' },
  { type: 'dropboxOAuth2Api', name: 'Dropbox', icon: 'dropbox' },
  { type: 'shopifyOAuth2Api', name: 'Shopify', icon: 'shopify' },
  { type: 'zoomOAuth2Api', name: 'Zoom', icon: 'zoom' },
  { type: 'spotifyOAuth2Api', name: 'Spotify', icon: 'spotify' },
];

// Combined list for display
const COMMON_CREDENTIALS = [...API_KEY_CREDENTIALS, ...OAUTH_CREDENTIALS];

// Helper to check if credential requires OAuth
const isOAuthCredential = (type: string) => {
  return type.toLowerCase().includes('oauth') || OAUTH_CREDENTIALS.some(c => c.type === type);
};

// OAuth credentials that we handle via FlowEngine OAuth broker
const FLOWENGINE_OAUTH_TYPES = {
  // Google services
  google: [
    'googleSheetsOAuth2Api',
    'gmailOAuth2',
    'googleDriveOAuth2Api',
    'googleCalendarOAuth2Api',
    'googleDocsOAuth2Api',
    'googleBigQueryOAuth2Api',
    'googleAnalyticsOAuth2',
    'googleAdsOAuth2Api',
    'googleContactsOAuth2Api',
    'googleChatOAuth2Api',
    'googleTasksOAuth2Api',
    'googleSlidesOAuth2Api',
    'googleTranslateOAuth2Api',
    'googleVertexOAuth2Api',
    'googleFormsOAuth2Api',
    'googleBooksOAuth2Api',
    'googleBusinessProfileOAuth2Api',
    'googleCloudStorageOAuth2Api',
    'googlePerspectiveOAuth2Api',
    'googleFirebaseCloudFirestoreOAuth2Api',
    'googleFirebaseRealtimeDatabaseOAuth2Api',
    'gSuiteAdminOAuth2Api',
    'googleCloudNaturalLanguageOAuth2Api',
  ],
  // Microsoft services
  microsoft: [
    'microsoftOneDriveOAuth2Api',
    'microsoftOutlookOAuth2Api',
    'microsoftTeamsOAuth2Api',
    'microsoftCalendarOAuth2Api',
    'microsoftExcelOAuth2Api',
    'microsoftSharePointOAuth2Api',
    'microsoftOAuth2Api', // Generic Microsoft 365
  ],
  // Other OAuth services
  slack: ['slackOAuth2Api'],
  linkedin: ['linkedInOAuth2Api'],
  reddit: ['redditOAuth2Api'],
  twitter: ['twitterOAuth2Api'],
};

// Check if this is an OAuth credential we handle via FlowEngine
const getOAuthProvider = (type: string): string | null => {
  for (const [provider, types] of Object.entries(FLOWENGINE_OAUTH_TYPES)) {
    if (types.includes(type)) {
      return provider;
    }
  }
  return null;
};

// Scope limitation notes for Google OAuth credentials
// These inform users what's included vs what requires their own Google OAuth2 setup
const GOOGLE_SCOPE_NOTES: Record<string, { included: string; restricted: string }> = {
  'gmailOAuth2': {
    included: 'Send emails, manage labels, and add-on interactions',
    restricted: 'Reading or organizing emails requires adding your own Google OAuth2 credentials in n8n',
  },
  'googleDriveOAuth2Api': {
    included: 'Access files created by or opened with this app',
    restricted: 'Browsing all Drive files requires adding your own Google OAuth2 credentials in n8n',
  },
  'googleDocsOAuth2Api': {
    included: 'Create and edit Google Docs',
    restricted: 'Full Drive file browsing requires adding your own Google OAuth2 credentials in n8n',
  },
};

export default function AddCredentialModal({
  isOpen,
  onClose,
  onAdd,
  fetchSchema,
  preselectedType,
  instanceUrl,
  instanceId,
  accessToken,
  allowFullAccess = true, // Default to true for backwards compatibility
  onOAuthSuccess,
  requiredTypes,
  existingCredentials = [],
}: AddCredentialModalProps) {
  const [step, setStep] = useState<'select' | 'form' | 'oauth'>('select');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<{ name: string; icon: string } | null>(null);
  const [schema, setSchema] = useState<CredentialSchema | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [oauthProvider, setOauthProvider] = useState<string | null>(null);

  // Form state
  const [credentialName, setCredentialName] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Helper to update form data and clear test result (forces re-test)
  const updateFormField = (key: string, value: any) => {
    setTestResult(null); // Clear test result - must re-test after changes
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Advanced fields toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Fetched credential types from n8n
  const [fetchedTypes, setFetchedTypes] = useState<N8nCredentialType[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);

  // Close on ESC key
  useEscapeKey(isOpen, onClose);

  // Separate main vs advanced fields
  // Required fields ALWAYS go to main - never hidden in advanced
  const { mainFields, advancedFields, hasRequiredAdvanced } = useMemo(() => {
    if (!schema?.properties) return { mainFields: [], advancedFields: [], hasRequiredAdvanced: false };

    const entries = Object.entries(schema.properties);
    const requiredSet = new Set(schema.required || []);

    // Keywords that indicate essential credential fields (always main)
    const mainKeywords = ['key', 'token', 'api', 'secret', 'password', 'auth', 'credential', 'access'];
    // Keywords that indicate optional/advanced settings (only if NOT required)
    const advancedKeywords = ['region', 'timeout', 'option', 'custom', 'advanced', 'extra', 'additional', 'proxy', 'ssl', 'verify'];

    const main: [string, any][] = [];
    const advanced: [string, any][] = [];

    for (const [key, prop] of entries) {
      const keyLower = key.toLowerCase();
      const isRequired = requiredSet.has(key) || prop.required === true;
      const isMainKeyword = mainKeywords.some(kw => keyLower.includes(kw));
      const isAdvancedKeyword = advancedKeywords.some(kw => keyLower.includes(kw));

      // CRITICAL: Required fields ALWAYS go to main section
      // Also include fields with main keywords (api key, token, etc.)
      if (isRequired || isMainKeyword) {
        main.push([key, prop]);
      } else if (isAdvancedKeyword || prop.default !== undefined) {
        // Only put in advanced if it's optional AND has advanced keyword or has a default
        advanced.push([key, prop]);
      } else {
        // Unknown optional fields go to main for visibility
        main.push([key, prop]);
      }
    }

    return { mainFields: main, advancedFields: advanced, hasRequiredAdvanced: false };
  }, [schema]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setSelectedType(null);
      setSelectedInfo(null);
      setSchema(null);
      setDocUrl(null);
      setError(null);
      setTestResult(null);
      setCredentialName('');
      setFormData({});
      setShowPasswords({});
      setSearchQuery('');
      setShowAdvanced(false);
      setOauthProvider(null);
    }
  }, [isOpen]);

  // Fetch credential types from n8n when modal opens
  useEffect(() => {
    const fetchCredentialTypes = async () => {
      if (!isOpen || !instanceId || !accessToken) return;

      setIsLoadingTypes(true);
      try {
        const res = await fetch(`/api/client/credentials/types?instanceId=${instanceId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setFetchedTypes(data.credentialTypes || []);
        }
      } catch (e) {
        console.warn('Failed to fetch credential types:', e);
      } finally {
        setIsLoadingTypes(false);
      }
    };

    fetchCredentialTypes();
  }, [isOpen, instanceId, accessToken]);

  // Handle preselected type - wait for types to load if needed
  useEffect(() => {
    if (isOpen && preselectedType) {
      // If we have fetched types, use them
      if (fetchedTypes.length > 0) {
        const fetchedInfo = fetchedTypes.find(c => c.name === preselectedType);
        if (fetchedInfo) {
          const icon = getIconFromCredType(fetchedInfo.name);
          handleSelectType(preselectedType, { name: fetchedInfo.displayName, icon });
          return;
        }
      }

      // If still loading types, wait for them
      if (isLoadingTypes) return;

      // Fallback to hardcoded list or generate display name
      const info = COMMON_CREDENTIALS.find(c => c.type === preselectedType) ||
        Object.values(CREDENTIAL_MAPPINGS).find(c => c.type === preselectedType);
      if (info) {
        handleSelectType(preselectedType, { name: info.name, icon: info.icon });
      } else if (preselectedType) {
        // Handle unknown credential type
        const displayName = preselectedType
          .replace(/Api$/, '')
          .replace(/OAuth2$/, '')
          .replace(/([A-Z])/g, ' $1')
          .trim();
        handleSelectType(preselectedType, { name: displayName, icon: 'key' });
      }
    }
  }, [isOpen, preselectedType, fetchedTypes, isLoadingTypes]);

  // Helper to get icon from credential type name
  const getIconFromCredType = (typeName: string): string => {
    const name = typeName.toLowerCase();
    // Google services (order matters - more specific first)
    if (name.includes('bigquery')) return 'bigquery';
    if (name.includes('analytics')) return 'analytics';
    if (name.includes('sheets')) return 'sheets';
    if (name.includes('gmail')) return 'gmail';
    if (name.includes('drive')) return 'drive';
    if (name.includes('calendar')) return 'calendar';
    if (name.includes('docs')) return 'docs';
    if (name.includes('tasks')) return 'tasks';
    if (name.includes('slides')) return 'slides';
    if (name.includes('translate')) return 'translate';
    if (name.includes('vertex') || name.includes('gemini')) return 'gemini';
    if (name.includes('forms')) return 'forms';
    if (name === 'googleoauth2') return 'google';
    if (name.includes('google')) return 'google';
    // Other services
    if (name.includes('slack')) return 'slack';
    if (name.includes('openai')) return 'openai';
    if (name.includes('anthropic')) return 'anthropic';
    if (name.includes('stripe')) return 'stripe';
    if (name.includes('notion')) return 'notion';
    if (name.includes('airtable')) return 'airtable';
    if (name.includes('github')) return 'github';
    if (name.includes('discord')) return 'discord';
    if (name.includes('telegram')) return 'telegram';
    if (name.includes('hubspot')) return 'hubspot';
    if (name.includes('postgres') || name.includes('mysql') || name.includes('mongo')) return 'database';
    if (name.includes('http')) return 'api';
    if (name.includes('aws')) return 'aws';
    return 'key';
  };

  // Start OAuth flow for any provider (Google, Microsoft, Slack, etc.)
  const startOAuth = () => {
    console.log('[AddCredential] Starting OAuth flow:', {
      selectedType,
      instanceId,
      oauthProvider,
      credentialName,
      hasSelectedInfo: !!selectedInfo,
    });

    if (!selectedType || !instanceId || !oauthProvider) {
      console.error('[AddCredential] Missing required OAuth parameters:', {
        selectedType: !!selectedType,
        instanceId: !!instanceId,
        oauthProvider: !!oauthProvider,
      });
      setError('Missing OAuth configuration. Please ensure instanceId is provided.');
      return;
    }

    // Build the OAuth URL with parameters
    const oauthUrl = new URL(`/api/oauth/${oauthProvider}`, window.location.origin);
    oauthUrl.searchParams.set('credentialType', selectedType);
    oauthUrl.searchParams.set('instanceId', instanceId);
    oauthUrl.searchParams.set('credentialName', credentialName || `My ${selectedInfo?.name} Account`);

    console.log('[AddCredential] Redirecting to OAuth URL:', oauthUrl.toString());

    // Navigate to OAuth flow (will redirect back after completion)
    window.location.href = oauthUrl.toString();
  };

  // Generate auto-numbered credential name based on existing credentials
  const generateCredentialName = (type: string, displayName: string): string => {
    // Count existing credentials of this type
    const existingOfType = existingCredentials.filter(c => c.type === type);
    const count = existingOfType.length;

    if (count === 0) {
      // First credential of this type - simple name
      return `My ${displayName}`;
    } else {
      // Has existing credentials - add number
      // Find the highest number used
      let maxNum = count;
      for (const cred of existingOfType) {
        const match = cred.name.match(/(\d+)\s*$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= maxNum) maxNum = num + 1;
        }
      }
      return `${displayName} ${maxNum + 1}`;
    }
  };

  const handleSelectType = async (type: string, info: { name: string; icon: string }) => {
    setSelectedType(type);
    setSelectedInfo(info);
    setCredentialName(generateCredentialName(type, info.name));
    setError(null);

    // Check if this is an OAuth credential we handle via FlowEngine
    const provider = getOAuthProvider(type);
    if (provider) {
      setOauthProvider(provider);
      setStep('oauth');
      setIsLoadingSchema(false);
      return;
    }

    // Check if this is an OAuth credential (requires n8n or contact)
    if (isOAuthCredential(type)) {
      setOauthProvider(null);
      setStep('oauth');
      setIsLoadingSchema(false);
      return;
    }

    setIsLoadingSchema(true);

    try {
      const result = await fetchSchema(type);

      console.log('[AddCredential] Schema fetch result for', type, ':', {
        hasSchema: !!result.schema,
        properties: result.schema?.properties ? Object.keys(result.schema.properties) : [],
        required: result.schema?.required || [],
        error: result.error,
      });

      // Even if schema fetch fails, proceed to form with generic apiKey field
      // The form component shows a fallback apiKey input when schema is empty
      if (result.error) {
        console.warn(`Schema fetch failed for ${type}: ${result.error}. Using generic form.`);
        setSchema({ properties: {} }); // Empty schema triggers generic apiKey field
        setDocUrl(result.docUrl || null);
      } else {
        setSchema(result.schema || null);
        setDocUrl(result.docUrl || null);

        // Initialize form data with defaults
        if (result.schema?.properties) {
          const defaults: Record<string, any> = {};
          for (const [key, prop] of Object.entries(result.schema.properties)) {
            if ((prop as any).default !== undefined) {
              defaults[key] = (prop as any).default;
            }
          }
          setFormData(defaults);
        }
      }

      setStep('form');
    } catch (e) {
      // Even on exception, proceed to form with generic input
      console.warn(`Schema fetch exception for ${type}. Using generic form.`);
      setSchema({ properties: {} });
      setStep('form');
    } finally {
      setIsLoadingSchema(false);
    }
  };

  // Test credential before saving
  const handleTest = async () => {
    if (!selectedType || !accessToken) return;

    setIsTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const res = await fetch('/api/client/credentials/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          type: selectedType,
          data: formData,
        }),
      });

      // Check if response is OK before parsing JSON
      if (!res.ok) {
        // Try to get error message from response
        let errorMessage = `Test failed with status ${res.status}`;
        try {
          const contentType = res.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const errorData = await res.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } else {
            // Response is likely HTML error page
            errorMessage = `Server error (${res.status}). Please check your connection and try again.`;
          }
        } catch {
          // Ignore parsing errors for error responses
        }
        setTestResult({
          success: false,
          message: errorMessage,
        });
        return;
      }

      const result = await res.json();
      setTestResult({
        success: result.success,
        message: result.message || (result.success ? 'Credential is valid' : 'Test failed'),
      });
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'Failed to test credential',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !credentialName.trim()) return;

    // Basic validation before submitting
    const requiredFields = schema?.required || [];
    const missingRequired: string[] = [];

    for (const fieldName of requiredFields) {
      const value = formData[fieldName];
      if (value === undefined || value === null || value === '') {
        const prop = schema?.properties?.[fieldName];
        const displayName = prop?.displayName || fieldName;
        missingRequired.push(displayName);
      }
    }

    // If no schema properties and no formData, likely missing API key
    if ((!schema?.properties || Object.keys(schema.properties).length === 0) && Object.keys(formData).length === 0) {
      setError('Please enter your API key or token before saving.');
      return;
    }

    // Show warning for missing required fields but allow submission
    if (missingRequired.length > 0) {
      console.warn('[AddCredential] Missing required fields:', missingRequired);
    }

    console.log('[AddCredential] Submitting credential:', {
      type: selectedType,
      name: credentialName,
      formDataKeys: Object.keys(formData),
      formData: Object.fromEntries(
        Object.entries(formData).map(([k, v]) => [
          k,
          typeof v === 'string' && v.length > 20 ? `${v.substring(0, 10)}...` : v
        ])
      ),
      mainFieldKeys: mainFields.map(([k]) => k),
      advancedFieldKeys: advancedFields.map(([k]) => k),
      schemaProperties: schema?.properties ? Object.keys(schema.properties) : [],
      schemaRequired: schema?.required || [],
      missingRequired,
    });

    setIsSaving(true);
    setError(null);

    try {
      await onAdd(selectedType, credentialName.trim(), formData);
      onClose();
    } catch (e: any) {
      // Parse n8n error messages for better display
      let errorMessage = e.message || 'Failed to create credential';

      console.error('[AddCredential] Credential creation failed:', {
        type: selectedType,
        name: credentialName,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      // Detect different error types and provide specific guidance
      if (errorMessage.includes('does not match') || errorMessage.includes('requires property')) {
        // Extract missing field names if present
        const missingFields = errorMessage.match(/requires property '([^']+)'/g);
        if (missingFields && missingFields.length > 0) {
          const fields = missingFields.map((m: string) => m.match(/'([^']+)'/)?.[1]).filter(Boolean);
          errorMessage = `Missing required fields: ${fields.join(', ')}. Please fill in these fields and try again.`;
        } else {
          errorMessage = 'Some required data is missing. Please check all required fields above and ensure they are filled correctly.';
        }
      } else if (errorMessage.includes('502') || errorMessage.includes('504')) {
        errorMessage = 'n8n instance is not responding. Please check that your n8n instance is running and try again.';
      } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'n8n API key is invalid or lacks permissions. Please verify the API key has credential:create scope.';
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        errorMessage = 'n8n API key does not have permission to create credentials. Please regenerate your API key with the correct scopes.';
      } else if (errorMessage.includes('404')) {
        errorMessage = 'n8n credential endpoint not found. Please verify your n8n instance URL and API configuration.';
      } else if (errorMessage.includes('already exists')) {
        errorMessage = `A credential named "${credentialName}" already exists. Please choose a different name.`;
      } else if (errorMessage.includes('invalid') && errorMessage.includes('key')) {
        errorMessage = 'The API key you provided appears to be invalid. Please check your API key and try again.';
      } else if (errorMessage.includes('validation')) {
        errorMessage = 'The credential data failed validation. Please check that all fields are filled with valid values.';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorMessage = 'Network error while connecting to n8n. Please check your internet connection and n8n instance URL.';
      } else if (errorMessage.includes('Failed to create')) {
        errorMessage = 'n8n rejected the credential. Please verify all fields are correct and try again. Check the n8n documentation for this credential type if needed.';
      }

      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const renderFormField = (key: string, prop: any) => {
    // Show visual indicator but DON'T enforce with HTML required
    // n8n's schema sometimes marks fields as required that aren't actually needed
    // Let n8n do the validation and show better error messages
    const schemaRequired = schema?.required?.includes(key) || prop.required;
    const label = prop.displayName || key.replace(/([A-Z])/g, ' $1').trim();
    const isPassword = prop.type === 'string' && (
      key.toLowerCase().includes('password') ||
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('key') ||
      key.toLowerCase().includes('apikey')
    );

    // Select/dropdown field
    if (prop.type === 'options' || prop.options) {
      return (
        <div key={key} className="space-y-1.5">
          <label className="block text-sm font-medium text-white">
            {label}
            {schemaRequired && <span className="text-yellow-400/70 ml-1" title="Marked as required in schema">*</span>}
          </label>
          <select
            value={formData[key] || ''}
            onChange={(e) => updateFormField(key, e.target.value)}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-white focus:border-white"
          >
            <option value="">Select...</option>
            {(prop.options || []).map((opt: any) => (
              <option key={opt.value || opt.name} value={opt.value || opt.name}>
                {opt.name}
              </option>
            ))}
          </select>
          {prop.description && (
            <p className="text-xs text-gray-500">{prop.description}</p>
          )}
        </div>
      );
    }

    // Boolean field
    if (prop.type === 'boolean') {
      return (
        <div key={key} className="flex items-center gap-3">
          <input
            type="checkbox"
            id={key}
            checked={formData[key] || false}
            onChange={(e) => updateFormField(key, e.target.checked)}
            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-white focus:ring-white"
          />
          <label htmlFor={key} className="text-sm text-white">
            {label}
          </label>
        </div>
      );
    }

    // Text/password field (default)
    return (
      <div key={key} className="space-y-1.5">
        <label className="block text-sm font-medium text-white">
          {label}
          {schemaRequired && <span className="text-yellow-400/70 ml-1" title="Marked as required in schema">*</span>}
        </label>
        <div className="relative">
          <input
            type={isPassword && !showPasswords[key] ? 'password' : 'text'}
            value={formData[key] || ''}
            onChange={(e) => updateFormField(key, e.target.value)}
            placeholder={prop.placeholder || `Enter ${label.toLowerCase()}`}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white pr-10"
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPasswords({ ...showPasswords, [key]: !showPasswords[key] })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPasswords[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {prop.description && (
          <p className="text-xs text-gray-500">{prop.description}</p>
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-lg bg-gray-900/70 border border-gray-800 rounded-xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-3">
                {/* Back arrow for form/oauth steps */}
                {step !== 'select' && (
                  <button
                    onClick={() => setStep('select')}
                    className="p-2 -ml-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                {step === 'form' && selectedInfo && selectedType && (
                  <div className="w-10 h-10 rounded-lg bg-gray-800/50 flex items-center justify-center">
                    <CredentialIcon type={selectedType} className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                {step === 'oauth' && selectedInfo && selectedType && (
                  <div className="w-10 h-10 rounded-lg bg-gray-800/50 flex items-center justify-center">
                    <CredentialIcon type={selectedType} className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {step === 'select' ? 'Add Credential' : `Add ${selectedInfo?.name || 'Credential'}`}
                  </h2>
                  {step === 'select' && (
                    <p className="text-sm text-gray-400">Connect services used in your imported workflows</p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Error message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-4 rounded-lg bg-red-900/20 border border-red-800 text-red-400"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-400" />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-semibold text-red-300">Failed to create credential</p>
                      <p className="text-sm text-red-400/90 leading-relaxed">{error}</p>
                      {/* Actionable suggestions based on error type */}
                      {error.includes('redirect') && (
                        <p className="text-xs text-red-400/70 mt-2 pt-2 border-t border-red-800/50">
                          💡 Make sure the callback URL is registered in your OAuth app settings
                        </p>
                      )}
                      {error.includes('API key') && (
                        <p className="text-xs text-red-400/70 mt-2 pt-2 border-t border-red-800/50">
                          💡 Verify your API key has the correct permissions and scopes
                        </p>
                      )}
                      {error.includes('already exists') && (
                        <p className="text-xs text-red-400/70 mt-2 pt-2 border-t border-red-800/50">
                          💡 Try using a different name or delete the existing credential first
                        </p>
                      )}
                      {error.includes('validation') && (
                        <p className="text-xs text-red-400/70 mt-2 pt-2 border-t border-red-800/50">
                          💡 Check that all required fields are filled with valid values
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 1: Select credential type */}
              {step === 'select' && (
                <div className="space-y-4">
                  {/* Show loading when preselected type is being processed */}
                  {preselectedType && (isLoadingTypes || isLoadingSchema) ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
                      <span className="text-gray-400 text-sm">Loading credential...</span>
                    </div>
                  ) : (
                    <>
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search credentials..."
                      className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                      autoFocus
                    />
                  </div>

                  {/* Loading indicator for credential types */}
                  {isLoadingTypes && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400 mr-2" />
                      <span className="text-gray-400 text-sm">Loading credential types...</span>
                    </div>
                  )}

                  {!isLoadingTypes && (() => {
                    const query = searchQuery.toLowerCase().trim();

                    // Use fetched types if available, otherwise fall back to hardcoded list
                    const useFetchedTypes = fetchedTypes.length > 0;

                    if (useFetchedTypes) {
                      // Filter fetched types - unified list
                      const filtered = fetchedTypes
                        .filter(c => c.displayName.toLowerCase().includes(query) || c.name.toLowerCase().includes(query))
                        .sort((a, b) => {
                          // Sort by isNeededByWorkflow first (available credentials first)
                          const aNeeded = requiredTypes === undefined || requiredTypes === null || requiredTypes.includes(a.name);
                          const bNeeded = requiredTypes === undefined || requiredTypes === null || requiredTypes.includes(b.name);
                          if (aNeeded !== bNeeded) return aNeeded ? -1 : 1;
                          // Then sort alphabetically
                          return a.displayName.localeCompare(b.displayName);
                        });

                      // Use filtered list directly (no unified Google Account - n8n doesn't support it)
                      const credentialsToShow = filtered;

                      if (query && credentialsToShow.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <p className="text-gray-400 mb-2">No credentials found for "{searchQuery}"</p>
                            <p className="text-xs text-gray-500">
                              Try a different search term
                            </p>
                          </div>
                        );
                      }

                      return (
                        <>
                          <p className="text-sm text-gray-400 mb-3">
                            Available Credentials {query && `(${credentialsToShow.length})`}
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[350px] overflow-y-auto">
                            {credentialsToShow.map((cred) => {
                              const isOAuth = isOAuthCredential(cred.name);
                              // Check if this type is needed by workflows
                              // undefined/null = all available, [] = none available, ['type1'] = only type1 available
                              const isNeededByWorkflow = requiredTypes === undefined || requiredTypes === null || requiredTypes.includes(cred.name);
                              const isDisabled = isLoadingSchema || !isNeededByWorkflow;
                              return (
                                <div key={cred.name} className="relative group">
                                  <button
                                    onClick={() => handleSelectType(cred.name, { name: cred.displayName, icon: getIconFromCredType(cred.name) })}
                                    disabled={isDisabled}
                                    className={cn(
                                      'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all text-center relative w-full',
                                      isNeededByWorkflow
                                        ? 'bg-gray-800/30 border-gray-800 hover:border-gray-600 hover:bg-gray-800/50'
                                        : 'bg-gray-900/30 border-gray-800/50 opacity-50 cursor-not-allowed',
                                      isLoadingSchema && 'opacity-50 cursor-not-allowed'
                                    )}
                                  >
                                    {/* Type tag */}
                                    <div className="absolute top-1.5 right-1.5">
                                      <span className={cn(
                                        'text-[9px] px-1.5 py-0.5 rounded font-medium',
                                        isOAuth ? 'bg-gray-700 text-gray-300' : 'bg-gray-800 text-gray-400'
                                      )}>
                                        {isOAuth ? 'OAuth' : 'API'}
                                      </span>
                                    </div>
                                    <div className={cn(
                                      "w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center mt-1",
                                      !isNeededByWorkflow && "opacity-50"
                                    )}>
                                      <CredentialIcon type={cred.name} className={cn("h-4 w-4", isNeededByWorkflow ? "text-gray-400" : "text-gray-600")} />
                                    </div>
                                    <span className={cn("text-xs truncate max-w-full leading-tight", isNeededByWorkflow ? "text-white" : "text-gray-500")}>{cred.displayName}</span>
                                  </button>
                                  {/* Tooltip for disabled credentials */}
                                  {!isNeededByWorkflow && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                      Import a workflow that uses this first
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-gray-500 text-center mt-3">
                            {credentialsToShow.length} of {fetchedTypes.length} credential types
                          </p>
                        </>
                      );
                    }

                    // Fallback to hardcoded list
                    const allCredentials = [...API_KEY_CREDENTIALS.map(c => ({ ...c, isOAuth: false })), ...OAUTH_CREDENTIALS.map(c => ({ ...c, isOAuth: true }))]
                      .filter(c => c.name.toLowerCase().includes(query) || c.type.toLowerCase().includes(query))
                      .sort((a, b) => {
                        // Sort by isNeededByWorkflow first (available credentials first)
                        const aNeeded = requiredTypes === undefined || requiredTypes === null || requiredTypes.includes(a.type);
                        const bNeeded = requiredTypes === undefined || requiredTypes === null || requiredTypes.includes(b.type);
                        if (aNeeded !== bNeeded) return aNeeded ? -1 : 1;
                        // Then sort alphabetically
                        return a.name.localeCompare(b.name);
                      });

                    if (query && allCredentials.length === 0) {
                      return (
                        <div className="text-center py-8">
                          <p className="text-gray-400 mb-2">No credentials found for "{searchQuery}"</p>
                          <p className="text-xs text-gray-500">
                            You can enter a custom credential type in n8n directly
                          </p>
                        </div>
                      );
                    }

                    return (
                      <>
                        <p className="text-sm text-gray-400 mb-3">
                          Available Credentials {query && `(${allCredentials.length})`}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[350px] overflow-y-auto">
                          {allCredentials.map((cred) => {
                            // Check if this type is needed by workflows
                            // undefined/null = all available, [] = none available, ['type1'] = only type1 available
                            const isNeededByWorkflow = requiredTypes === undefined || requiredTypes === null || requiredTypes.includes(cred.type);
                            const isDisabled = isLoadingSchema || !isNeededByWorkflow;
                            return (
                              <div key={cred.type} className="relative group">
                                <button
                                  onClick={() => handleSelectType(cred.type, cred)}
                                  disabled={isDisabled}
                                  className={cn(
                                    'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all text-center relative w-full',
                                    isNeededByWorkflow
                                      ? 'bg-gray-800/30 border-gray-800 hover:border-gray-600 hover:bg-gray-800/50'
                                      : 'bg-gray-900/30 border-gray-800/50 opacity-50 cursor-not-allowed',
                                    isLoadingSchema && 'opacity-50 cursor-not-allowed'
                                  )}
                                >
                                  {/* Type tag */}
                                  <div className="absolute top-1.5 right-1.5">
                                    <span className={cn(
                                      'text-[9px] px-1.5 py-0.5 rounded font-medium',
                                      cred.isOAuth ? 'bg-gray-700 text-gray-300' : 'bg-gray-800 text-gray-400'
                                    )}>
                                      {cred.isOAuth ? 'OAuth' : 'API'}
                                    </span>
                                  </div>
                                  <div className={cn(
                                    "w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center mt-1",
                                    !isNeededByWorkflow && "opacity-50"
                                  )}>
                                    <CredentialIcon type={cred.type} className={cn("h-4 w-4", isNeededByWorkflow ? "text-gray-400" : "text-gray-600")} />
                                  </div>
                                  <span className={cn("text-xs truncate max-w-full leading-tight", isNeededByWorkflow ? "text-white" : "text-gray-500")}>{cred.name}</span>
                                </button>
                                {/* Tooltip for disabled credentials */}
                                {!isNeededByWorkflow && (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    Import a workflow that uses this first
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}

                  {isLoadingSchema && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  )}
                    </>
                  )}
                </div>
              )}

              {/* Step 2: Fill credential form */}
              {step === 'form' && schema && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Hint about optional fields */}
                  <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/50 text-xs text-gray-400">
                    <p className="flex items-center gap-2">
                      <span className="text-yellow-400/70">*</span>
                      <span>Fields marked with asterisk are suggested but not always required. Start with the essentials and add more if needed.</span>
                    </p>
                  </div>

                  {/* Documentation link */}
                  {docUrl && (
                    <a
                      href={docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span className="text-sm">View setup guide</span>
                    </a>
                  )}

                  {/* Credential name */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-white">
                      Credential Name
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      value={credentialName}
                      onChange={(e) => setCredentialName(e.target.value)}
                      required
                      placeholder="e.g., My Slack Account"
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                    />
                  </div>

                  {/* Main fields (required + key/token/api fields) */}
                  {mainFields.map(([key, prop]) => (
                    renderFormField(key, prop)
                  ))}

                  {/* If no schema properties, show generic key field */}
                  {(!schema.properties || Object.keys(schema.properties).length === 0) && (
                    <>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-white">
                          API Key / Token
                          <span className="text-yellow-400/70 ml-1" title="Usually required">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPasswords['apiKey'] ? 'text' : 'password'}
                            value={formData['apiKey'] || ''}
                            onChange={(e) => updateFormField('apiKey', e.target.value)}
                            placeholder="Enter your API key or token"
                            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, apiKey: !showPasswords['apiKey'] })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                          >
                            {showPasswords['apiKey'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Advanced fields (optional, less common) */}
                  {advancedFields.length > 0 && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors w-full"
                      >
                        <ChevronDown className={cn(
                          "h-4 w-4 transition-transform",
                          showAdvanced ? "" : "-rotate-90"
                        )} />
                        <span>Advanced Settings</span>
                        <span className="text-xs text-gray-500">({advancedFields.length} optional)</span>
                      </button>

                      <AnimatePresence>
                        {showAdvanced && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-4 pt-4 border-l-2 border-gray-800 pl-4 ml-2 mt-2">
                              {advancedFields.map(([key, prop]) => (
                                renderFormField(key, prop)
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </form>
              )}

              {/* Step: OAuth - Google OAuth / n8n link / Contact message */}
              {step === 'oauth' && selectedInfo && selectedType && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center text-center py-4">
                    <div className="w-16 h-16 rounded-xl bg-gray-900/50 border border-gray-800 flex items-center justify-center mb-4">
                      <CredentialIcon type={selectedType} className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">
                      Connect {selectedInfo.name}
                    </h3>
                    <p className="text-sm text-gray-400 max-w-sm">
                      {oauthProvider
                        ? `Click the button below to authorize access to your ${selectedInfo.name} account. You'll be redirected to complete the connection.`
                        : allowFullAccess
                          ? 'This credential uses OAuth authentication and must be connected directly through n8n. Click the button below to open n8n and add this credential.'
                          : 'This credential requires OAuth authentication. Please contact your agency to set up this connection.'}
                    </p>
                  </div>

                  {/* FlowEngine OAuth - One-click connection */}
                  {oauthProvider && (
                    <>
                      {/* Credential name input */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-white">
                          Credential Name
                        </label>
                        <input
                          type="text"
                          value={credentialName}
                          onChange={(e) => setCredentialName(e.target.value)}
                          placeholder={`My ${selectedInfo.name} Account`}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                        />
                      </div>
                      {/* Scope limitation note for specific Google credential types */}
                      {selectedType && GOOGLE_SCOPE_NOTES[selectedType] && (
                        <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700 text-xs space-y-1.5">
                          <p className="text-gray-300">
                            <span className="text-green-400 font-medium">Included:</span>{' '}
                            {GOOGLE_SCOPE_NOTES[selectedType].included}
                          </p>
                          <p className="text-gray-400">
                            <span className="text-yellow-400/70 font-medium">Note:</span>{' '}
                            {GOOGLE_SCOPE_NOTES[selectedType].restricted}
                          </p>
                        </div>
                      )}
                      <button
                        onClick={startOAuth}
                        className="w-full py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                      >
                        Connect with {selectedInfo.name}
                      </button>
                      <p className="text-xs text-gray-500 text-center">
                        You&apos;ll be redirected to {selectedInfo.name} to authorize access.
                      </p>
                    </>
                  )}

                  {/* Other OAuth with n8n access */}
                  {!oauthProvider && allowFullAccess && instanceUrl && (
                    <>
                      <a
                        href={`${instanceUrl}/credentials`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open n8n Credentials
                      </a>
                      <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700 text-center">
                        <p className="text-xs text-gray-400">
                          In n8n, click <span className="text-white">Create New Credential</span> and search for <span className="text-white font-medium">{selectedInfo?.name}</span>
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 text-center">
                        After connecting in n8n, close this modal and refresh the credentials list.
                      </p>
                    </>
                  )}

                  {/* Other OAuth without n8n access - Contact message */}
                  {!oauthProvider && !allowFullAccess && (
                    <div className="p-4 rounded-lg bg-yellow-900/20 border border-yellow-800/50 text-center">
                      <p className="text-sm text-yellow-400 font-medium mb-2">
                        Contact Required
                      </p>
                      <p className="text-xs text-gray-400 mb-3">
                        <span className="text-white font-medium">{selectedInfo?.name}</span> requires OAuth authentication which must be set up by your agency administrator.
                      </p>
                      <p className="text-xs text-gray-500">
                        Please contact your agency to request this credential connection.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {step === 'form' && (
              <div className="p-6 border-t border-gray-800 shrink-0 space-y-3">
                {/* Test Result */}
                {testResult && (
                  <div className={cn(
                    'p-3 rounded-lg flex items-center gap-2 text-sm',
                    testResult.success
                      ? 'bg-green-900/20 border border-green-800/50 text-green-400'
                      : 'bg-red-900/20 border border-red-800/50 text-red-400'
                  )}>
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}

                {/* Button Row */}
                <div className="flex gap-3">
                  {/* Test Button */}
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={isTesting || isSaving || Object.keys(formData).length === 0}
                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800/50 disabled:cursor-not-allowed border border-gray-700 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      'Test'
                    )}
                  </button>

                  {/* Save Button - Only enabled after successful test */}
                  <button
                    onClick={handleSubmit}
                    disabled={isSaving || isTesting || !credentialName.trim() || !testResult?.success}
                    className={cn(
                      "flex-[2] py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
                      testResult?.success
                        ? "bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        : "bg-gray-700 text-gray-400 cursor-not-allowed"
                    )}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : testResult?.success ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Save Credential
                      </>
                    ) : (
                      'Save Credential'
                    )}
                  </button>
                </div>
              </div>
            )}

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
