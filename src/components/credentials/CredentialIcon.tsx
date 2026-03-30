'use client';

/**
 * CredentialIcon Component
 * Displays an icon for different credential/service types
 */

import {
  Mail,
  MessageSquare,
  FileSpreadsheet,
  Database,
  Key,
  Globe,
  Code,
  ShoppingCart,
  Users,
  Zap,
  Cloud,
  Lock,
  Terminal,
  Share2,
  Bot,
  Rss,
  Calendar,
  Video,
  Image,
  Music,
  Palette,
  CreditCard,
  Phone,
  FileText,
  Folder,
  Link,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCredentialLogo } from './CompanyLogos';

interface CredentialIconProps {
  type: string;
  className?: string;
  fallback?: 'key' | 'none';
  /** If true, prefer Lucide icons over company logos */
  preferLucide?: boolean;
}

/**
 * Map of icon identifiers to Lucide icons
 */
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  // Communication
  'slack': MessageSquare,
  'discord': MessageSquare,
  'telegram': MessageSquare,
  'whatsapp': MessageSquare,
  'twilio': Phone,
  'sendgrid': Mail,
  'mailchimp': Mail,
  'intercom': MessageSquare,

  // Email
  'gmail': Mail,
  'outlook': Mail,
  'email': Mail,

  // Productivity & Project Management
  'google-sheets': FileSpreadsheet,
  'sheets': FileSpreadsheet,
  'airtable': FileSpreadsheet,
  'notion': FileSpreadsheet,
  'trello': Folder,
  'asana': Folder,
  'monday': Folder,
  'clickup': Folder,
  'todoist': Folder,
  'excel': FileSpreadsheet,

  // Google
  'google': Globe,           // Unified Google Account
  'google-drive': Cloud,
  'drive': Cloud,
  'google-calendar': Calendar,
  'google-docs': FileText,
  'bigquery': Database,      // Google BigQuery
  'analytics': Globe,        // Google Analytics
  'tasks': Calendar,         // Google Tasks
  'gcp': Cloud,

  // Databases
  'postgres': Database,
  'mysql': Database,
  'mongodb': Database,
  'redis': Database,
  'supabase': Database,
  'firebase': Database,
  'database': Database,

  // Development
  'github': Code,
  'gitlab': Code,
  'bitbucket': Code,
  'jira': Code,
  'linear': Code,

  // E-commerce
  'shopify': ShoppingCart,
  'stripe': CreditCard,
  'woocommerce': ShoppingCart,
  'paypal': CreditCard,
  'square': CreditCard,
  'paddle': CreditCard,
  'braintree': CreditCard,
  'adyen': CreditCard,

  // CRM & Marketing
  'hubspot': Users,
  'salesforce': Users,
  'pipedrive': Users,
  'zendesk': Users,
  'freshdesk': Users,

  // AI & LLM
  'openai': Bot,
  'gpt': Bot,
  'chatgpt': Bot,
  'gpt-4': Bot,
  'gpt-3': Bot,
  'anthropic': Bot,
  'claude': Bot,
  'groq': Bot,
  'mistral': Bot,
  'gemini': Bot,
  'cohere': Bot,
  'perplexity': Bot,
  'huggingface': Bot,
  'deepl': Bot,
  'replicate': Bot,
  'pinecone': Zap,
  'qdrant': Zap,
  'weaviate': Zap,

  // Cloud
  'aws': Cloud,
  'azure': Cloud,
  'dropbox': Cloud,
  'box': Cloud,

  // Social
  'twitter': Share2,
  'facebook': Share2,
  'instagram': Share2,
  'linkedin': Share2,
  'reddit': Share2,
  'youtube': Video,

  // HTTP & Auth
  'api': Globe,
  'http': Globe,
  'oauth': Lock,
  'key': Key,

  // File Transfer
  'ftp': Terminal,
  'sftp': Terminal,
  'ssh': Terminal,
  'terminal': Terminal,

  // RSS & Content
  'rss': Rss,
  'feed': Rss,
  'rssfeed': Rss,

  // Calendar & Scheduling
  'calendar': Calendar,
  'calendly': Calendar,
  'cal': Calendar,

  // Video & Conferencing
  'zoom': Video,
  'webex': Video,
  'meet': Video,
  'teams': Video,
  'microsoft': Globe,

  // Media & Design
  'spotify': Music,
  'figma': Palette,
  'miro': Palette,
  'canva': Image,
  'unsplash': Image,

  // Analytics
  'mixpanel': Globe,
  'segment': Globe,
  'amplitude': Globe,

  // Forms
  'typeform': FileText,
  'formstack': FileText,

  // Communication extras
  'voice': Phone,
  'sms': Phone,

  // Docs
  'docs': FileText,
  'document': FileText,
  'pdf': FileText,
  'googledocs': FileText,

  // Storage extras
  'onedrive': Folder,
  'icloud': Folder,

  // Misc
  'webhook': Link,
  'n8n': Zap,
  'zapier': Zap,
  'make': Zap,
  'integromat': Zap,
  'wordpress': Globe,
  'webflow': Globe,
  'vercel': Globe,
  'netlify': Globe,
  'cloudflare': Globe,
  'digitalocean': Cloud,
  'heroku': Cloud,

  // ===== COMMUNITY NODE ICONS =====

  // Explorium & Data Enrichment
  'explorium': Database,
  'clearbit': Database,
  'apollo': Users,
  'hunter': Users,
  'zoominfo': Users,
  'snov': Users,

  // WhatsApp Community
  'chatwoot': MessageSquare,
  'waha': MessageSquare,
  'evolution': MessageSquare,

  // AI Community Nodes
  'deepseek': Bot,
  'elevenlabs': Music,
  'togetherai': Bot,
  'ollama': Bot,
  'llama': Bot,
  'stabilityai': Image,
  'midjourney': Image,
  'leonardo': Image,

  // Web Scraping
  'scraper': Globe,
  'apify': Globe,
  'browser': Globe,
  'phantom': Globe,
  'brightdata': Globe,
  'firecrawl': Globe,

  // Document & OCR
  'ocr': FileText,

  // Vector Databases
  'vector': Database,
  'chroma': Database,

  // CRM Community
  'close': Users,
  'copper': Users,
  'insightly': Users,
  'keap': Users,
  'highlevel': Users,

  // E-commerce Community
  'lemlist': Mail,
  'gumroad': ShoppingCart,
  'chargebee': CreditCard,
  'recurly': CreditCard,

  // Communication Community
  'vonage': Phone,
  'plivo': Phone,
  'nexmo': Phone,
  'clicksend': Phone,
  'messagemedia': Phone,

  // Project Management Community
  'basecamp': Folder,
  'wrike': Folder,
  'smartsheet': FileSpreadsheet,
  'teamwork': Folder,

  // Other Community
  'ifttt': Zap,
  'activepieces': Zap,

  'default': Key,
};

/**
 * Keywords to detect icon types dynamically for unknown credentials
 */
const iconKeywords: Record<string, string[]> = {
  'mail': ['mail', 'email', 'smtp', 'imap', 'sendgrid', 'mailchimp'],
  'message-square': ['chat', 'message', 'slack', 'discord', 'telegram', 'whatsapp', 'sms'],
  'phone': ['phone', 'call', 'twilio', 'vonage', 'voice'],
  'bot': ['ai', 'llm', 'gpt', 'claude', 'model', 'chat', 'openai', 'anthropic'],
  'database': ['db', 'database', 'sql', 'mongo', 'redis', 'supabase', 'firebase', 'vector'],
  'cloud': ['cloud', 'aws', 's3', 'azure', 'gcp', 'storage', 'drive'],
  'users': ['user', 'customer', 'contact', 'lead', 'crm', 'hubspot', 'salesforce'],
  'code': ['git', 'github', 'gitlab', 'code', 'dev', 'jira'],
  'credit-card': ['payment', 'stripe', 'pay', 'billing', 'invoice'],
  'shopping-cart': ['shop', 'commerce', 'store', 'order', 'product'],
  'globe': ['http', 'web', 'api', 'url', 'scrape', 'crawl'],
  'calendar': ['calendar', 'event', 'schedule', 'meeting', 'zoom'],
  'file-text': ['doc', 'document', 'pdf', 'file', 'text'],
  'image': ['image', 'photo', 'picture', 'media', 'midjourney', 'dalle'],
  'video': ['video', 'youtube', 'stream', 'record'],
  'music': ['audio', 'voice', 'speech', 'sound', 'music', 'elevenlabs'],
  'share-2': ['social', 'twitter', 'facebook', 'linkedin', 'instagram'],
  'folder': ['folder', 'directory', 'project', 'task', 'board'],
  'zap': ['automation', 'workflow', 'trigger', 'n8n', 'zapier', 'make'],
};

/**
 * Normalize a credential type for icon lookup
 * Strips common suffixes and normalizes to lowercase
 */
function normalizeCredentialType(iconType: string): string {
  return iconType
    // Remove common n8n suffixes first
    .replace(/OAuth2Api$/i, '')
    .replace(/OAuth2$/i, '')
    .replace(/Api$/i, '')
    .replace(/Credentials?$/i, '')
    // Remove n8n-nodes prefix for community nodes
    .replace(/^n8n[-_]?nodes[-_]?/i, '')
    // Normalize to lowercase and remove special chars
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    // Clean up multiple dashes
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Get the icon component for a credential type
 * Supports both hardcoded icons and dynamic detection for unknown types
 */
export function getCredentialIcon(iconType: string): React.ComponentType<{ className?: string }> {
  // Normalize the icon type (strip suffixes like Api, OAuth2Api, etc.)
  const normalizedType = normalizeCredentialType(iconType);

  // First try direct match with normalized type
  if (iconMap[normalizedType]) {
    return iconMap[normalizedType];
  }

  // Also try the original lowercase (for cases where the full name is in iconMap)
  const lowerOriginal = iconType.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (iconMap[lowerOriginal]) {
    return iconMap[lowerOriginal];
  }

  // Try partial match: check if any iconMap key is contained in the normalized type
  for (const [mapKey, icon] of Object.entries(iconMap)) {
    if (mapKey !== 'default' && normalizedType.includes(mapKey)) {
      return icon;
    }
  }

  // Try keyword-based detection for unknown types
  for (const [iconKey, keywords] of Object.entries(iconKeywords)) {
    for (const keyword of keywords) {
      if (normalizedType.includes(keyword) || lowerOriginal.includes(keyword)) {
        // Map keyword icon names to actual icons
        const keywordIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
          'mail': Mail,
          'message-square': MessageSquare,
          'phone': Phone,
          'bot': Bot,
          'database': Database,
          'cloud': Cloud,
          'users': Users,
          'code': Code,
          'credit-card': CreditCard,
          'shopping-cart': ShoppingCart,
          'globe': Globe,
          'calendar': Calendar,
          'file-text': FileText,
          'image': Image,
          'video': Video,
          'music': Music,
          'share-2': Share2,
          'folder': Folder,
          'zap': Zap,
        };
        if (keywordIconMap[iconKey]) {
          return keywordIconMap[iconKey];
        }
      }
    }
  }

  // Default fallback
  return Key;
}

export default function CredentialIcon({ type, className, fallback = 'key', preferLucide = false }: CredentialIconProps) {
  // Debug: Log the credential type to see what's being passed
  if (type.toLowerCase().includes('serp')) {
    console.log('🔍 CredentialIcon received type:', type);
  }

  // First try to get a real company logo from CompanyLogos.tsx (unless preferLucide is true)
  if (!preferLucide) {
    const LogoComponent = getCredentialLogo(type);
    if (LogoComponent) {
      return <LogoComponent className={cn('h-4 w-4', className)} />;
    }
    
    // Debug: Log when logo not found
    if (type.toLowerCase().includes('serp')) {
      console.log('❌ No logo found for:', type);
    }
  }

  // Fallback to Lucide icon
  const IconComponent = getCredentialIcon(type);

  // If fallback is 'none' and we're falling back to Key icon, return null
  if (fallback === 'none' && IconComponent === Key) {
    return null;
  }

  return <IconComponent className={cn('h-4 w-4', className)} />;
}

/**
 * Get the n8n CDN URL for a credential icon
 * n8n hosts node icons on GitHub
 * Dynamically constructs URLs for all 200+ n8n nodes
 */
function getN8nIconUrl(credentialType: string): string | null {
  // Normalize credential type to node name
  let normalized = credentialType
    .replace(/OAuth2Api$/i, '')
    .replace(/OAuth2$/i, '')
    .replace(/Api$/i, '')
    .replace(/Credentials?$/i, '')
    .trim();

  if (!normalized) return null;

  // Special cases that don't follow standard naming
  const specialCases: Record<string, string> = {
    // Google services
    'google': 'Google',
    'gmail': 'Gmail',
    'googlesheets': 'GoogleSheets',
    'sheets': 'GoogleSheets',
    'googledrive': 'GoogleDrive',
    'drive': 'GoogleDrive',
    'googlecalendar': 'GoogleCalendar',
    'calendar': 'GoogleCalendar',
    'googledocs': 'GoogleDocs',
    'docs': 'GoogleDocs',
    'googletasks': 'GoogleTasks',
    'tasks': 'GoogleTasks',
    'googleanalytics': 'GoogleAnalytics',
    'analytics': 'GoogleAnalytics',
    'bigquery': 'GoogleBigQuery',
    
    // Microsoft services
    'microsoft': 'Microsoft',
    'microsoftazure': 'MicrosoftAzure',
    'azure': 'MicrosoftAzure',
    'microsoftteams': 'MicrosoftTeams',
    'teams': 'MicrosoftTeams',
    'microsoftonedrive': 'MicrosoftOneDrive',
    'onedrive': 'MicrosoftOneDrive',
    'microsoftoutlook': 'MicrosoftOutlook',
    'outlook': 'MicrosoftOutlook',
    'microsoftsql': 'MicrosoftSql',
    
    // Database variations
    'postgres': 'Postgres',
    'postgresql': 'Postgres',
    'mysql': 'MySql',
    'mongodb': 'MongoDb',
    'mongo': 'MongoDb',
    'redis': 'Redis',
    
    // AI/LLM providers
    'openai': 'OpenAi',
    'anthropic': 'Anthropic',
    'claude': 'Anthropic',
    
    // Common variations
    'github': 'Github',
    'gitlab': 'Gitlab',
    'linkedin': 'LinkedIn',
    'youtube': 'YouTube',
    'sendgrid': 'SendGrid',
    'mailchimp': 'Mailchimp',
    'hubspot': 'Hubspot',
    'salesforce': 'Salesforce',
    'serpapi': 'SerpApi',
    'airtable': 'Airtable',
    'shopify': 'Shopify',
    'wordpress': 'WordPress',
    'woocommerce': 'WooCommerce',
    'activecampaign': 'ActiveCampaign',
    'clickup': 'ClickUp',
    'dropbox': 'Dropbox',
    'paypal': 'PayPal',
    'quickbooks': 'QuickBooks',
    'zendesk': 'Zendesk',
    'jira': 'Jira',
    'asana': 'Asana',
    'trello': 'Trello',
    'monday': 'Monday',
    'basecamp': 'Basecamp',
    'intercom': 'Intercom',
    'freshdesk': 'Freshdesk',
    'helpscout': 'HelpScout',
    'pipedrive': 'Pipedrive',
    'copper': 'Copper',
    'keap': 'Keap',
    'mautic': 'Mautic',
    'sendinblue': 'Sendinblue',
    'convertkit': 'ConvertKit',
    'getresponse': 'GetResponse',
    'aweber': 'AWeber',
    'constantcontact': 'ConstantContact',
    'campaignmonitor': 'CampaignMonitor',
    'drip': 'Drip',
    'klaviyo': 'Klaviyo',
    'omnisend': 'Omnisend',
    'mailjet': 'Mailjet',
    'postmark': 'Postmark',
    'mandrill': 'Mandrill',
    'sparkpost': 'SparkPost',
    'twilio': 'Twilio',
    'messagebird': 'MessageBird',
    'vonage': 'Vonage',
    'plivo': 'Plivo',
    'clicksend': 'ClickSend',
    'telegram': 'Telegram',
    'whatsapp': 'WhatsApp',
    'discord': 'Discord',
    'slack': 'Slack',
    'mattermost': 'Mattermost',
    'rocketchat': 'RocketChat',
    'twitter': 'Twitter',
    'facebook': 'Facebook',
    'instagram': 'Instagram',
    'reddit': 'Reddit',
    'stripe': 'Stripe',
    'square': 'Square',
    'braintree': 'Braintree',
    'chargebee': 'Chargebee',
    'recurly': 'Recurly',
    'paddle': 'Paddle',
    'lemonsqueezy': 'LemonSqueezy',
    'gumroad': 'Gumroad',
    'notion': 'Notion',
    'evernote': 'Evernote',
    'onenote': 'OneNote',
    'todoist': 'Todoist',
    'typeform': 'Typeform',
    'jotform': 'Jotform',
    'formstack': 'Formstack',
    'wufoo': 'Wufoo',
    'surveymonkey': 'SurveyMonkey',
    'qualtrics': 'Qualtrics',
    'supabase': 'Supabase',
    'firebase': 'Firebase',
    'aws': 'Aws',
    'pinecone': 'Pinecone',
    'qdrant': 'Qdrant',
    'weaviate': 'Weaviate',
    'chroma': 'Chroma',
    'milvus': 'Milvus',
    'groq': 'Groq',
    'mistral': 'Mistral',
    'cohere': 'Cohere',
    'huggingface': 'HuggingFace',
    'replicate': 'Replicate',
    'stabilityai': 'StabilityAi',
    'elevenlabs': 'ElevenLabs',
    'deepl': 'DeepL',
    'linear': 'Linear',
    'figma': 'Figma',
    'miro': 'Miro',
    'canva': 'Canva',
    'unsplash': 'Unsplash',
    'pexels': 'Pexels',
    'cloudinary': 'Cloudinary',
    'imgbb': 'ImgBB',
    'imgur': 'Imgur',
    'giphy': 'Giphy',
    'spotify': 'Spotify',
    'soundcloud': 'SoundCloud',
    'vimeo': 'Vimeo',
    'zoom': 'Zoom',
    'whereby': 'Whereby',
    'calendly': 'Calendly',
    'acuityscheduling': 'AcuityScheduling',
    'cal': 'Cal',
    'tavily': 'Tavily',
    'apify': 'Apify',
    'scraperapi': 'ScraperApi',
    'brightdata': 'BrightData',
    'phantombuster': 'PhantomBuster',
    'clearbit': 'Clearbit',
    'hunter': 'Hunter',
    'apollo': 'Apollo',
    'zoominfo': 'ZoomInfo',
    'lusha': 'Lusha',
    'snov': 'Snov',
    'rocketreach': 'RocketReach',
    'mixpanel': 'Mixpanel',
    'segment': 'Segment',
    'amplitude': 'Amplitude',
    'heap': 'Heap',
    'hotjar': 'Hotjar',
    'fullstory': 'FullStory',
    'logrocket': 'LogRocket',
    'sentry': 'Sentry',
    'bugsnag': 'Bugsnag',
    'rollbar': 'Rollbar',
    'datadog': 'Datadog',
    'newrelic': 'NewRelic',
    'grafana': 'Grafana',
    'prometheus': 'Prometheus',
    'elasticsearch': 'Elasticsearch',
    'algolia': 'Algolia',
    'meilisearch': 'Meilisearch',
    'typesense': 'Typesense',
  };

  const lowerNormalized = normalized.toLowerCase();
  
  // Check special cases first
  if (specialCases[lowerNormalized]) {
    const nodeName = specialCases[lowerNormalized];
    // Use n8n's official icon CDN
    return `https://n8n.io/icons/${nodeName.toLowerCase()}.svg`;
  }

  // For everything else, use smart capitalization
  // Convert to PascalCase (capitalize first letter of each word)
  const nodeName = normalized
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');

  if (!nodeName) return null;

  // n8n icon URL format - use their official CDN
  return `https://n8n.io/icons/${nodeName.toLowerCase()}.svg`;
}
