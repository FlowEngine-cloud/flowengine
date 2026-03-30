/**
 * Credential Extractor Utility
 * Extracts required credentials from n8n workflow JSON
 */

import { getCredentialDocUrl } from '../n8nInstanceApi';

/**
 * Credential information with display metadata
 */
export interface CredentialInfo {
  type: string;      // n8n credential type (e.g., 'slackOAuth2Api')
  name: string;      // Human-readable name (e.g., 'Slack')
  icon: string;      // Icon identifier for display
  docUrl: string;    // Link to n8n documentation
  nodeTypes: string[]; // Which nodes in the workflow require this credential
}

/**
 * Available credential option (when multiple exist of same type)
 */
export interface CredentialOption {
  id: string;
  name: string;
}

/**
 * Credential with status (for client display)
 */
export interface CredentialWithStatus extends CredentialInfo {
  status: 'available' | 'missing';
  existingCredentialId?: string;
  existingCredentialName?: string;
  // All available credentials of this type (for selection when multiple exist)
  availableCredentials?: CredentialOption[];
}

/**
 * Mapping from node type keywords to credential information
 * Based on n8n's node-credential relationships
 */
export const CREDENTIAL_MAPPINGS: Record<string, { type: string; name: string; icon: string }> = {
  // Google Services (regular nodes)
  'googlesheets': { type: 'googleSheetsOAuth2Api', name: 'Google Sheets', icon: 'google-sheets' },
  'gmail': { type: 'gmailOAuth2', name: 'Gmail', icon: 'gmail' },
  'googledrive': { type: 'googleDriveOAuth2Api', name: 'Google Drive', icon: 'google-drive' },
  'googlecalendar': { type: 'googleCalendarOAuth2Api', name: 'Google Calendar', icon: 'google-calendar' },
  'googledocs': { type: 'googleDocsOAuth2Api', name: 'Google Docs', icon: 'google-docs' },
  'googletranslate': { type: 'googleTranslateOAuth2Api', name: 'Google Translate', icon: 'google' },
  'googlebigquery': { type: 'googleBigQueryOAuth2Api', name: 'Google BigQuery', icon: 'google' },
  'googleanalytics': { type: 'googleAnalyticsOAuth2Api', name: 'Google Analytics', icon: 'google' },
  'googlecontacts': { type: 'googleContactsOAuth2Api', name: 'Google Contacts', icon: 'google' },
  'googleslides': { type: 'googleSlidesOAuth2Api', name: 'Google Slides', icon: 'google' },
  'googleads': { type: 'googleAdsOAuth2Api', name: 'Google Ads', icon: 'google' },
  'googlechat': { type: 'googleChatOAuth2Api', name: 'Google Chat', icon: 'google' },
  'googletasks': { type: 'googleTasksOAuth2Api', name: 'Google Tasks', icon: 'google' },

  // Google AI Agent Tool nodes (map to same OAuth credentials)
  'toolgooglesheets': { type: 'googleSheetsOAuth2Api', name: 'Google Sheets', icon: 'google-sheets' },
  'toolgmail': { type: 'gmailOAuth2', name: 'Gmail', icon: 'gmail' },
  'toolgoogledrive': { type: 'googleDriveOAuth2Api', name: 'Google Drive', icon: 'google-drive' },
  'toolgooglecalendar': { type: 'googleCalendarOAuth2Api', name: 'Google Calendar', icon: 'google-calendar' },
  'toolgoogledocs': { type: 'googleDocsOAuth2Api', name: 'Google Docs', icon: 'google-docs' },
  'toolgoogletasks': { type: 'googleTasksOAuth2Api', name: 'Google Tasks', icon: 'google' },
  'toolgooglecontacts': { type: 'googleContactsOAuth2Api', name: 'Google Contacts', icon: 'google' },
  'toolgooglebigquery': { type: 'googleBigQueryOAuth2Api', name: 'Google BigQuery', icon: 'google' },
  'toolgoogleslides': { type: 'googleSlidesOAuth2Api', name: 'Google Slides', icon: 'google' },
  'toolgooglechat': { type: 'googleChatOAuth2Api', name: 'Google Chat', icon: 'google' },
  'toolgoogleads': { type: 'googleAdsOAuth2Api', name: 'Google Ads', icon: 'google' },
  'toolgoogleanalytics': { type: 'googleAnalyticsOAuth2Api', name: 'Google Analytics', icon: 'google' },
  'toolgoogletranslate': { type: 'googleTranslateOAuth2Api', name: 'Google Translate', icon: 'google' },

  // Communication
  'slack': { type: 'slackOAuth2Api', name: 'Slack', icon: 'slack' },
  'discord': { type: 'discordOAuth2Api', name: 'Discord', icon: 'discord' },
  'telegram': { type: 'telegramApi', name: 'Telegram', icon: 'telegram' },
  'whatsapp': { type: 'whatsAppBusinessCloudApi', name: 'WhatsApp', icon: 'whatsapp' },
  'twilio': { type: 'twilioApi', name: 'Twilio', icon: 'twilio' },
  'sendgrid': { type: 'sendGridApi', name: 'SendGrid', icon: 'sendgrid' },
  'mailchimp': { type: 'mailchimpApi', name: 'Mailchimp', icon: 'mailchimp' },
  'mailgun': { type: 'mailgunApi', name: 'Mailgun', icon: 'email' },
  'postmark': { type: 'postmarkApi', name: 'Postmark', icon: 'email' },
  'smtp': { type: 'smtp', name: 'SMTP', icon: 'email' },
  'imap': { type: 'imap', name: 'IMAP', icon: 'email' },

  // Productivity
  'notion': { type: 'notionOAuth2Api', name: 'Notion', icon: 'notion' },
  'airtable': { type: 'airtableOAuth2Api', name: 'Airtable', icon: 'airtable' },
  'asana': { type: 'asanaOAuth2Api', name: 'Asana', icon: 'asana' },
  'trello': { type: 'trelloApi', name: 'Trello', icon: 'trello' },
  'todoist': { type: 'todoistOAuth2Api', name: 'Todoist', icon: 'todoist' },
  'clickup': { type: 'clickUpOAuth2Api', name: 'ClickUp', icon: 'clickup' },
  'monday': { type: 'mondayComOAuth2Api', name: 'Monday.com', icon: 'monday' },
  'baserow': { type: 'baserowApi', name: 'Baserow', icon: 'database' },
  'coda': { type: 'codaApi', name: 'Coda', icon: 'document' },

  // Development
  'github': { type: 'githubOAuth2Api', name: 'GitHub', icon: 'github' },
  'gitlab': { type: 'gitlabOAuth2Api', name: 'GitLab', icon: 'gitlab' },
  'bitbucket': { type: 'bitbucketApi', name: 'Bitbucket', icon: 'bitbucket' },
  'jira': { type: 'jiraSoftwareCloudApi', name: 'Jira', icon: 'jira' },
  'linear': { type: 'linearApi', name: 'Linear', icon: 'linear' },
  'sentry': { type: 'sentryIoApi', name: 'Sentry', icon: 'bug' },
  'circleci': { type: 'circleciApi', name: 'CircleCI', icon: 'code' },
  'travisci': { type: 'travisCiApi', name: 'Travis CI', icon: 'code' },

  // E-commerce
  'shopify': { type: 'shopifyOAuth2Api', name: 'Shopify', icon: 'shopify' },
  'stripe': { type: 'stripeApi', name: 'Stripe', icon: 'stripe' },
  'woocommerce': { type: 'wooCommerceApi', name: 'WooCommerce', icon: 'woocommerce' },
  'paypal': { type: 'payPalApi', name: 'PayPal', icon: 'paypal' },
  'square': { type: 'squareApi', name: 'Square', icon: 'creditcard' },
  'lemonsqueezy': { type: 'lemonsqueezyApi', name: 'LemonSqueezy', icon: 'creditcard' },

  // Marketing & CRM
  'hubspot': { type: 'hubspotOAuth2Api', name: 'HubSpot', icon: 'hubspot' },
  'salesforce': { type: 'salesforceOAuth2Api', name: 'Salesforce', icon: 'salesforce' },
  'activecampaign': { type: 'activeCampaignApi', name: 'ActiveCampaign', icon: 'activecampaign' },
  'pipedrive': { type: 'pipedriveOAuth2Api', name: 'Pipedrive', icon: 'pipedrive' },
  'intercom': { type: 'intercomApi', name: 'Intercom', icon: 'intercom' },
  'zendesk': { type: 'zendeskApi', name: 'Zendesk', icon: 'zendesk' },
  'freshdesk': { type: 'freshdeskApi', name: 'Freshdesk', icon: 'helpdesk' },
  'crisp': { type: 'crispApi', name: 'Crisp', icon: 'chat' },
  'drift': { type: 'driftApi', name: 'Drift', icon: 'chat' },
  'convertkit': { type: 'convertKitApi', name: 'ConvertKit', icon: 'email' },
  'klaviyo': { type: 'klaviyoApi', name: 'Klaviyo', icon: 'email' },

  // Databases
  'postgres': { type: 'postgres', name: 'PostgreSQL', icon: 'postgres' },
  'mysql': { type: 'mySql', name: 'MySQL', icon: 'mysql' },
  'mongodb': { type: 'mongoDb', name: 'MongoDB', icon: 'mongodb' },
  'redis': { type: 'redis', name: 'Redis', icon: 'redis' },
  'supabase': { type: 'supabaseApi', name: 'Supabase', icon: 'supabase' },
  'firebase': { type: 'firebaseCloudFirestoreOAuth2Api', name: 'Firebase', icon: 'firebase' },
  'elasticsearch': { type: 'elasticsearch', name: 'Elasticsearch', icon: 'database' },
  'qdrant': { type: 'qdrantApi', name: 'Qdrant', icon: 'database' },
  'weaviate': { type: 'weaviateApi', name: 'Weaviate', icon: 'database' },
  'milvus': { type: 'milvusApi', name: 'Milvus', icon: 'database' },

  // AI & ML - LLM Providers (regular nodes)
  'openai': { type: 'openAiApi', name: 'OpenAI', icon: 'openai' },
  'anthropic': { type: 'anthropicApi', name: 'Anthropic', icon: 'anthropic' },
  'groq': { type: 'groqApi', name: 'Groq', icon: 'groq' },
  'cohere': { type: 'cohereApi', name: 'Cohere', icon: 'ai' },
  'mistral': { type: 'mistralCloudApi', name: 'Mistral AI', icon: 'ai' },
  'deepseek': { type: 'deepSeekApi', name: 'DeepSeek', icon: 'ai' },
  'openrouter': { type: 'openRouterApi', name: 'OpenRouter', icon: 'ai' },
  'xai': { type: 'xAiApi', name: 'xAI Grok', icon: 'ai' },
  'ollama': { type: 'ollamaApi', name: 'Ollama', icon: 'ai' },
  'azureopenai': { type: 'azureOpenAiApi', name: 'Azure OpenAI', icon: 'azure' },
  'googlegemini': { type: 'googleGeminiApi', name: 'Google Gemini', icon: 'google' },
  'googlevertex': { type: 'googleVertexAi', name: 'Google Vertex AI', icon: 'google' },
  'awsbedrock': { type: 'awsApi', name: 'AWS Bedrock', icon: 'aws' },
  'perplexity': { type: 'perplexityApi', name: 'Perplexity', icon: 'ai' },
  'flowenginellm': { type: 'flowEngineApi', name: 'FlowEngine LLM', icon: 'bot' },

  // LLM Chat Models (langchain nodes - map to same credentials)
  'lmchatopenai': { type: 'openAiApi', name: 'OpenAI', icon: 'openai' },
  'lmchatanthropic': { type: 'anthropicApi', name: 'Anthropic', icon: 'anthropic' },
  'lmchatgroq': { type: 'groqApi', name: 'Groq', icon: 'groq' },
  'lmchatmistral': { type: 'mistralCloudApi', name: 'Mistral AI', icon: 'ai' },
  'lmchatdeepseek': { type: 'deepSeekApi', name: 'DeepSeek', icon: 'ai' },
  'lmchatollama': { type: 'ollamaApi', name: 'Ollama', icon: 'ai' },
  'lmchatazureopenai': { type: 'azureOpenAiApi', name: 'Azure OpenAI', icon: 'azure' },
  'lmchatgooglegemini': { type: 'googleGeminiApi', name: 'Google Gemini', icon: 'google' },
  'lmchatgooglevertex': { type: 'googleVertexAi', name: 'Google Vertex AI', icon: 'google' },
  'lmchatoropenrouter': { type: 'openRouterApi', name: 'OpenRouter', icon: 'ai' },
  'lmchatxai': { type: 'xAiApi', name: 'xAI Grok', icon: 'ai' },
  'lmchatcohere': { type: 'cohereApi', name: 'Cohere', icon: 'ai' },
  'lmchatawsbedrock': { type: 'awsApi', name: 'AWS Bedrock', icon: 'aws' },

  // Embedding Models (langchain nodes)
  'embeddingsopenai': { type: 'openAiApi', name: 'OpenAI', icon: 'openai' },
  'embeddingscohere': { type: 'cohereApi', name: 'Cohere', icon: 'ai' },
  'embeddingshuggingface': { type: 'huggingFaceApi', name: 'Hugging Face', icon: 'huggingface' },
  'embeddingsollama': { type: 'ollamaApi', name: 'Ollama', icon: 'ai' },
  'embeddingsazureopenai': { type: 'azureOpenAiApi', name: 'Azure OpenAI', icon: 'azure' },
  'embeddingsgooglegemini': { type: 'googleGeminiApi', name: 'Google Gemini', icon: 'google' },
  'embeddingsgooglevertex': { type: 'googleVertexAi', name: 'Google Vertex AI', icon: 'google' },
  'embeddingsmistral': { type: 'mistralCloudApi', name: 'Mistral AI', icon: 'ai' },

  // AI & ML - Vector Stores & Tools
  'pinecone': { type: 'pineconeApi', name: 'Pinecone', icon: 'pinecone' },
  'huggingface': { type: 'huggingFaceApi', name: 'Hugging Face', icon: 'huggingface' },
  'tavily': { type: 'tavilyApi', name: 'Tavily', icon: 'search' },
  'tavilytool': { type: 'tavilyApi', name: 'Tavily', icon: 'search' },
  'serpapi': { type: 'serpApi', name: 'SerpApi', icon: 'search' },
  'serpapitool': { type: 'serpApi', name: 'SerpApi', icon: 'search' },

  // Vector Store nodes (langchain)
  'vectorstoreqdrant': { type: 'qdrantApi', name: 'Qdrant', icon: 'database' },
  'vectorstorepinecone': { type: 'pineconeApi', name: 'Pinecone', icon: 'pinecone' },
  'vectorstoreweaviate': { type: 'weaviateApi', name: 'Weaviate', icon: 'database' },
  'vectorstoremilvus': { type: 'milvusApi', name: 'Milvus', icon: 'database' },
  'vectorstoresupabase': { type: 'supabaseApi', name: 'Supabase', icon: 'supabase' },

  // Other AI Agent Tools
  'toolslack': { type: 'slackOAuth2Api', name: 'Slack', icon: 'slack' },
  'tooldiscord': { type: 'discordOAuth2Api', name: 'Discord', icon: 'discord' },
  'toolnotion': { type: 'notionOAuth2Api', name: 'Notion', icon: 'notion' },
  'toolairtable': { type: 'airtableOAuth2Api', name: 'Airtable', icon: 'airtable' },
  'toolgithub': { type: 'githubOAuth2Api', name: 'GitHub', icon: 'github' },
  'tooljira': { type: 'jiraSoftwareCloudApi', name: 'Jira', icon: 'jira' },
  'toolhubspot': { type: 'hubspotOAuth2Api', name: 'HubSpot', icon: 'hubspot' },
  'wolframalpha': { type: 'wolframAlphaApi', name: 'Wolfram Alpha', icon: 'math' },
  'replicate': { type: 'replicateApi', name: 'Replicate', icon: 'ai' },
  'stabilityai': { type: 'stabilityAiApi', name: 'Stability AI', icon: 'ai' },
  'deepl': { type: 'deepLApi', name: 'DeepL', icon: 'translate' },
  'elevenlabs': { type: 'elevenLabsApi', name: 'ElevenLabs', icon: 'audio' },
  'assemblyai': { type: 'assemblyAiApi', name: 'AssemblyAI', icon: 'audio' },
  'whisper': { type: 'openAiApi', name: 'Whisper (OpenAI)', icon: 'openai' },

  // Memory stores
  'zep': { type: 'zepApi', name: 'Zep Memory', icon: 'memory' },
  'motorhead': { type: 'motorheadApi', name: 'Motorhead Memory', icon: 'memory' },
  'xata': { type: 'xataApi', name: 'Xata', icon: 'database' },

  // Browser Automation
  'airtop': { type: 'airtopApi', name: 'Airtop', icon: 'browser' },
  'browserless': { type: 'browserlessApi', name: 'Browserless', icon: 'browser' },

  // Cloud Storage
  'dropbox': { type: 'dropboxOAuth2Api', name: 'Dropbox', icon: 'dropbox' },
  'box': { type: 'boxOAuth2Api', name: 'Box', icon: 'box' },
  'awss3': { type: 'aws', name: 'AWS S3', icon: 'aws' },
  'googlecloudstorage': { type: 'googleCloudStorageOAuth2Api', name: 'Google Cloud Storage', icon: 'google' },
  'minio': { type: 'minioS3', name: 'MinIO', icon: 'storage' },
  'backblaze': { type: 'backblazeB2Api', name: 'Backblaze B2', icon: 'storage' },

  // Social Media
  'twitter': { type: 'twitterOAuth2Api', name: 'Twitter/X', icon: 'twitter' },
  'facebook': { type: 'facebookGraphApi', name: 'Facebook', icon: 'facebook' },
  'instagram': { type: 'instagramBasicDisplayApi', name: 'Instagram', icon: 'instagram' },
  'linkedin': { type: 'linkedInOAuth2Api', name: 'LinkedIn', icon: 'linkedin' },
  'youtube': { type: 'youTubeOAuth2Api', name: 'YouTube', icon: 'youtube' },
  'tiktok': { type: 'tikTokApi', name: 'TikTok', icon: 'video' },
  'reddit': { type: 'redditOAuth2Api', name: 'Reddit', icon: 'reddit' },
  'pinterest': { type: 'pinterestOAuth2Api', name: 'Pinterest', icon: 'pinterest' },

  // HTTP & Webhooks
  'http': { type: 'httpHeaderAuth', name: 'HTTP Header Auth', icon: 'api' },
  'httpbasicauth': { type: 'httpBasicAuth', name: 'HTTP Basic Auth', icon: 'api' },
  'httpdigestauth': { type: 'httpDigestAuth', name: 'HTTP Digest Auth', icon: 'api' },
  'oauth1': { type: 'oAuth1Api', name: 'OAuth1', icon: 'key' },
  'oauth2': { type: 'oAuth2Api', name: 'OAuth2', icon: 'key' },
  'httpqueryauth': { type: 'httpQueryAuth', name: 'HTTP Query Auth', icon: 'api' },

  // File Transfer
  'ftp': { type: 'ftp', name: 'FTP', icon: 'ftp' },
  'sftp': { type: 'sftp', name: 'SFTP', icon: 'sftp' },
  'ssh': { type: 'sshPassword', name: 'SSH', icon: 'terminal' },

  // Form & Survey
  'typeform': { type: 'typeformOAuth2Api', name: 'Typeform', icon: 'form' },
  'googleforms': { type: 'googleFormsOAuth2Api', name: 'Google Forms', icon: 'google' },
  'surveymonkey': { type: 'surveyMonkeyApi', name: 'SurveyMonkey', icon: 'form' },
  'jotform': { type: 'jotFormApi', name: 'JotForm', icon: 'form' },

  // Scheduling & Calendar
  'calendly': { type: 'calendlyApi', name: 'Calendly', icon: 'calendar' },
  'cal': { type: 'calApi', name: 'Cal.com', icon: 'calendar' },

  // Analytics
  'mixpanel': { type: 'mixpanelApi', name: 'Mixpanel', icon: 'analytics' },
  'amplitude': { type: 'amplitudeApi', name: 'Amplitude', icon: 'analytics' },
  'segment': { type: 'segmentApi', name: 'Segment', icon: 'analytics' },
  'posthog': { type: 'postHogApi', name: 'PostHog', icon: 'analytics' },

  // Design
  'figma': { type: 'figmaApi', name: 'Figma', icon: 'figma' },
  'miro': { type: 'miroApi', name: 'Miro', icon: 'miro' },
  'canva': { type: 'canvaApi', name: 'Canva', icon: 'design' },

  // Finance
  'quickbooks': { type: 'quickBooksOAuth2Api', name: 'QuickBooks', icon: 'finance' },
  'xero': { type: 'xeroOAuth2Api', name: 'Xero', icon: 'finance' },
  'plaid': { type: 'plaidApi', name: 'Plaid', icon: 'finance' },
  'wise': { type: 'wiseApi', name: 'Wise', icon: 'finance' },

  // Cloud & Infrastructure
  'aws': { type: 'aws', name: 'AWS', icon: 'aws' },
  'gcp': { type: 'googleCloudApi', name: 'Google Cloud', icon: 'google' },
  'azure': { type: 'azureApi', name: 'Azure', icon: 'azure' },
  'digitalocean': { type: 'digitalOceanApi', name: 'DigitalOcean', icon: 'cloud' },
  'cloudflare': { type: 'cloudflareApi', name: 'Cloudflare', icon: 'cloudflare' },
  'vercel': { type: 'vercelApi', name: 'Vercel', icon: 'vercel' },
  'netlify': { type: 'netlifyApi', name: 'Netlify', icon: 'cloud' },
  'render': { type: 'renderApi', name: 'Render', icon: 'cloud' },
  'railway': { type: 'railwayApi', name: 'Railway', icon: 'cloud' },

  // Messaging & Queues
  'rabbitmq': { type: 'rabbitmq', name: 'RabbitMQ', icon: 'queue' },
  'kafka': { type: 'kafkaApi', name: 'Kafka', icon: 'queue' },
  'sqs': { type: 'awsSqs', name: 'AWS SQS', icon: 'aws' },

  // Microsoft Services
  'microsoftexcel': { type: 'microsoftExcelOAuth2Api', name: 'Microsoft Excel', icon: 'microsoft' },
  'microsoftoutlook': { type: 'microsoftOutlookOAuth2Api', name: 'Microsoft Outlook', icon: 'microsoft' },
  'microsoftteams': { type: 'microsoftTeamsOAuth2Api', name: 'Microsoft Teams', icon: 'teams' },
  'microsoftonedrive': { type: 'microsoftOneDriveOAuth2Api', name: 'Microsoft OneDrive', icon: 'onedrive' },
  'microsoftsql': { type: 'microsoftSql', name: 'Microsoft SQL Server', icon: 'database' },
  'microsoft365': { type: 'microsoftOAuth2Api', name: 'Microsoft 365', icon: 'microsoft' },
  'azuredevops': { type: 'azureDevOpsApi', name: 'Azure DevOps', icon: 'azure' },
  'dynamics365': { type: 'microsoftDynamicsCrmOAuth2Api', name: 'Dynamics 365', icon: 'microsoft' },

  // Video & Media
  'zoom': { type: 'zoomOAuth2Api', name: 'Zoom', icon: 'zoom' },
  'vimeo': { type: 'vimeoOAuth2Api', name: 'Vimeo', icon: 'video' },
  'loom': { type: 'loomApi', name: 'Loom', icon: 'video' },
  'cloudinary': { type: 'cloudinaryApi', name: 'Cloudinary', icon: 'image' },
  'imgbb': { type: 'imgBbApi', name: 'ImgBB', icon: 'image' },

  // Productivity extras
  'evernote': { type: 'evernoteOAuth2Api', name: 'Evernote', icon: 'document' },
  'dropboxpaper': { type: 'dropboxOAuth2Api', name: 'Dropbox Paper', icon: 'dropbox' },
  'onenote': { type: 'microsoftOutlookOAuth2Api', name: 'OneNote', icon: 'microsoft' },
  'confluence': { type: 'jiraSoftwareCloudApi', name: 'Confluence', icon: 'jira' },

  // Customer Support
  'helpscout': { type: 'helpScoutOAuth2Api', name: 'Help Scout', icon: 'helpdesk' },
  'groove': { type: 'grooveApi', name: 'Groove', icon: 'helpdesk' },
  'front': { type: 'frontApi', name: 'Front', icon: 'email' },
  'gorgias': { type: 'gorgiasApi', name: 'Gorgias', icon: 'helpdesk' },

  // Automation & Workflow
  'zapier': { type: 'zapierApi', name: 'Zapier', icon: 'zapier' },
  'make': { type: 'makeApi', name: 'Make (Integromat)', icon: 'make' },
  'ifttt': { type: 'iftttApi', name: 'IFTTT', icon: 'automation' },

  // Forms & Data Collection (typeform, jotform defined above)
  'formstack': { type: 'formstackApi', name: 'Formstack', icon: 'form' },
  'cognitoforms': { type: 'cognitoFormsApi', name: 'Cognito Forms', icon: 'form' },
  'paperform': { type: 'paperformApi', name: 'Paperform', icon: 'form' },
  'wufoo': { type: 'wufooApi', name: 'Wufoo', icon: 'form' },

  // HR & Recruiting
  'bamboohr': { type: 'bambooHrApi', name: 'BambooHR', icon: 'hr' },
  'workable': { type: 'workableApi', name: 'Workable', icon: 'hr' },
  'lever': { type: 'leverApi', name: 'Lever', icon: 'hr' },
  'greenhouse': { type: 'greenhouseApi', name: 'Greenhouse', icon: 'hr' },

  // IoT & Hardware
  'mqtt': { type: 'mqtt', name: 'MQTT', icon: 'iot' },
  'homeassistant': { type: 'homeAssistantApi', name: 'Home Assistant', icon: 'iot' },

  // Monitoring & Logs
  'datadog': { type: 'datadogApi', name: 'Datadog', icon: 'monitoring' },
  'newrelic': { type: 'newRelicApi', name: 'New Relic', icon: 'monitoring' },
  'pagerduty': { type: 'pagerDutyApi', name: 'PagerDuty', icon: 'monitoring' },
  'opsgenie': { type: 'opsgenieApi', name: 'Opsgenie', icon: 'monitoring' },
  'logsnag': { type: 'logsnagApi', name: 'LogSnag', icon: 'monitoring' },

  // Crypto & Web3
  'ethereum': { type: 'ethereumApi', name: 'Ethereum', icon: 'crypto' },
  'moralis': { type: 'moralisApi', name: 'Moralis', icon: 'crypto' },
  'alchemy': { type: 'alchemyApi', name: 'Alchemy', icon: 'crypto' },

  // SMS & Voice
  'vonage': { type: 'vonageApi', name: 'Vonage', icon: 'phone' },
  'messagebird': { type: 'messageBirdApi', name: 'MessageBird', icon: 'phone' },
  'plivo': { type: 'plivoApi', name: 'Plivo', icon: 'phone' },
  'sinch': { type: 'sinchApi', name: 'Sinch', icon: 'phone' },

  // Other AI Services
  'together': { type: 'togetherApi', name: 'Together AI', icon: 'ai' },
  'fireworks': { type: 'fireworksApi', name: 'Fireworks AI', icon: 'ai' },
  'anyscale': { type: 'anyscaleApi', name: 'Anyscale', icon: 'ai' },
  'cerebras': { type: 'cerebrasApi', name: 'Cerebras', icon: 'ai' },

  // Misc Services
  'webflow': { type: 'webflowOAuth2Api', name: 'Webflow', icon: 'webflow' },
  'ghost': { type: 'ghostAdminApi', name: 'Ghost', icon: 'blog' },
  'wordpress': { type: 'wordpressApi', name: 'WordPress', icon: 'wordpress' },
  'contentful': { type: 'contentfulApi', name: 'Contentful', icon: 'cms' },
  'strapi': { type: 'strapiApi', name: 'Strapi', icon: 'cms' },
  'sanity': { type: 'sanityApi', name: 'Sanity', icon: 'cms' },
  'pushover': { type: 'pushoverApi', name: 'Pushover', icon: 'notification' },
  'pushbullet': { type: 'pushbulletOAuth2Api', name: 'Pushbullet', icon: 'notification' },
  'ntfy': { type: 'ntfyApi', name: 'ntfy', icon: 'notification' },
  'openweathermap': { type: 'openWeatherMapApi', name: 'OpenWeatherMap', icon: 'weather' },
  'weather': { type: 'openWeatherMapApi', name: 'Weather', icon: 'weather' },
  'clearbit': { type: 'clearbitApi', name: 'Clearbit', icon: 'data' },
  'hunter': { type: 'hunterApi', name: 'Hunter', icon: 'email' },
  'apollo': { type: 'apolloApi', name: 'Apollo', icon: 'crm' },
  'explorium': { type: 'exploriumApi', name: 'Explorium', icon: 'database' },
  'lemlist': { type: 'lemlistApi', name: 'Lemlist', icon: 'email' },
  'instantly': { type: 'instantlyApi', name: 'Instantly', icon: 'email' },
  'woodpecker': { type: 'woodpeckerApi', name: 'Woodpecker', icon: 'email' },
  'mautic': { type: 'mauticApi', name: 'Mautic', icon: 'marketing' },
  'keap': { type: 'keapOAuth2Api', name: 'Keap', icon: 'crm' },
  'agilecrm': { type: 'agileCrmApi', name: 'Agile CRM', icon: 'crm' },
  'copper': { type: 'copperApi', name: 'Copper', icon: 'crm' },
  'freshsales': { type: 'freshsalesApi', name: 'Freshsales', icon: 'crm' },
  'close': { type: 'closeApi', name: 'Close', icon: 'crm' },
  'nutshell': { type: 'nutshellApi', name: 'Nutshell', icon: 'crm' },
};

/**
 * Extract required credentials from a workflow JSON
 * Analyzes both explicit credentials in nodes and implicit requirements from node types
 */
export function extractRequiredCredentials(workflowJson: any): CredentialInfo[] {
  const credMap = new Map<string, {
    type: string;
    name: string;
    icon: string;
    nodeTypes: Set<string>;
  }>();

  const nodes = workflowJson?.nodes || [];

  for (const node of nodes) {
    // Skip trigger nodes that don't need credentials (manual, schedule, etc.)
    const nodeType = node.type || '';
    if (
      nodeType.includes('manualTrigger') ||
      nodeType.includes('scheduleTrigger') ||
      nodeType.includes('webhook') ||
      nodeType.includes('Webhook') ||
      nodeType.includes('Start')
    ) {
      // These might still have credentials, so check explicitly
      if (!node.credentials) continue;
    }

    // Method 1: Check explicit credentials defined in the node
    if (node.credentials && typeof node.credentials === 'object') {
      for (const [credType, credValue] of Object.entries(node.credentials)) {
        if (!credMap.has(credType)) {
          // Try to find a friendly name from our mappings
          const mapping = Object.values(CREDENTIAL_MAPPINGS).find(m => m.type === credType);
          credMap.set(credType, {
            type: credType,
            name: mapping?.name || formatCredentialName(credType),
            icon: mapping?.icon || 'key',
            nodeTypes: new Set([nodeType]),
          });
        } else {
          credMap.get(credType)!.nodeTypes.add(nodeType);
        }
      }
    }

    // Method 2: Infer credentials from node type (for nodes without explicit credentials)
    // This catches cases where the workflow was created without credentials configured
    const nodeTypeSimple = nodeType.split('.').pop()?.toLowerCase() || '';
    for (const [keyword, mapping] of Object.entries(CREDENTIAL_MAPPINGS)) {
      if (nodeTypeSimple.includes(keyword) && !credMap.has(mapping.type)) {
        // Only add if this node type typically requires credentials
        // and we haven't already found explicit credentials
        const hasExplicitCreds = node.credentials && Object.keys(node.credentials).length > 0;
        if (!hasExplicitCreds) {
          credMap.set(mapping.type, {
            ...mapping,
            nodeTypes: new Set([nodeType]),
          });
        }
      }
    }
  }

  // Convert to array with doc URLs
  return Array.from(credMap.values()).map(cred => ({
    type: cred.type,
    name: cred.name,
    icon: cred.icon,
    docUrl: getCredentialDocUrl(cred.type),
    nodeTypes: Array.from(cred.nodeTypes),
  }));
}

/**
 * Format a credential type into a human-readable name
 * e.g., 'slackOAuth2Api' -> 'Slack OAuth2'
 */
function formatCredentialName(credentialType: string): string {
  return credentialType
    .replace(/OAuth2Api$/i, ' OAuth2')
    .replace(/Api$/i, '')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Compare required credentials against user's existing credentials
 * Returns credentials with availability status and all options when multiple exist
 */
export function checkCredentialStatus(
  requiredCredentials: CredentialInfo[],
  userCredentials: Array<{ id: string; name: string; type: string }>
): CredentialWithStatus[] {
  return requiredCredentials.map(required => {
    // FlowEngine LLM is always available via environment variables
    if (required.type === 'flowEngineApi') {
      // Check if user has custom credentials
      const matchingCredentials = userCredentials.filter(uc => uc.type === required.type);

      if (matchingCredentials.length > 0) {
        const firstMatch = matchingCredentials[0];
        return {
          ...required,
          status: 'available' as const,
          existingCredentialId: firstMatch.id,
          existingCredentialName: firstMatch.name,
          availableCredentials: matchingCredentials.length > 1
            ? matchingCredentials.map(c => ({ id: c.id, name: c.name }))
            : undefined,
        };
      }

      // Even without explicit credentials, mark as available (uses env vars)
      return {
        ...required,
        status: 'available' as const,
        existingCredentialId: 'env',
        existingCredentialName: 'FlowEngine LLM (Default)',
      };
    }

    // Find ALL matching credentials by type
    const matchingCredentials = userCredentials.filter(uc => uc.type === required.type);

    if (matchingCredentials.length > 0) {
      // Use the first one as default, but provide all options
      const firstMatch = matchingCredentials[0];
      return {
        ...required,
        status: 'available' as const,
        existingCredentialId: firstMatch.id,
        existingCredentialName: firstMatch.name,
        // Include all options if there are multiple
        availableCredentials: matchingCredentials.length > 1
          ? matchingCredentials.map(c => ({ id: c.id, name: c.name }))
          : undefined,
      };
    }

    return {
      ...required,
      status: 'missing' as const,
    };
  });
}

/**
 * Check if all required credentials are available
 */
export function canImportWorkflow(credentialsWithStatus: CredentialWithStatus[]): boolean {
  return credentialsWithStatus.every(cred => cred.status === 'available');
}

/**
 * Get list of missing credentials
 */
export function getMissingCredentials(credentialsWithStatus: CredentialWithStatus[]): CredentialWithStatus[] {
  return credentialsWithStatus.filter(cred => cred.status === 'missing');
}

/**
 * Prepare workflow JSON for import by mapping credential IDs
 * Replaces placeholder credential IDs with actual user credential IDs
 * Only keeps fields that n8n POST /workflows accepts
 */
export function prepareWorkflowForImport(
  workflowJson: any,
  credentialMappings: Record<string, string> // { credentialType: actualCredentialId }
): any {
  const source = JSON.parse(JSON.stringify(workflowJson)); // Deep clone

  // Map credential IDs in nodes
  for (const node of source.nodes || []) {
    if (node.credentials && typeof node.credentials === 'object') {
      for (const [credType, credValue] of Object.entries(node.credentials)) {
        const actualId = credentialMappings[credType];
        if (actualId && typeof credValue === 'object' && credValue !== null) {
          // Update the credential ID to the user's actual credential
          (credValue as any).id = actualId;
        }
      }
    }
  }

  // Only keep fields that n8n POST /workflows API accepts
  // n8n is strict and rejects any additional properties
  const workflow: any = {
    name: source.name,
    nodes: source.nodes || [],
    connections: source.connections || {},
  };

  // Optional fields - only include if present
  if (source.settings) {
    workflow.settings = source.settings;
  }
  if (source.staticData) {
    workflow.staticData = source.staticData;
  }
  if (source.tags && Array.isArray(source.tags)) {
    workflow.tags = source.tags;
  }

  return workflow;
}
