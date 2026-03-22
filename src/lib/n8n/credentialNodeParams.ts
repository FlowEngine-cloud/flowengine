/**
 * Dynamic Credential Node Parameters
 * Extracts configurable parameters from n8n workflow nodes dynamically
 * Falls back to NODE_REQUIRED_PARAMS when workflow node has no parameters configured
 */

import { NODE_REQUIRED_PARAMS } from './nodeParameters';
import { CREDENTIAL_MAPPINGS } from './credentialExtractor';

/**
 * Display metadata for credential types (only icons/names, not field definitions)
 * For unknown credentials, use getCredentialDisplayInfo() which provides dynamic fallbacks
 */
export const CREDENTIAL_DISPLAY_INFO: Record<string, { displayName: string; icon: string }> = {
  // Google Services
  'googleDriveOAuth2Api': { displayName: 'Google Drive', icon: 'drive' },
  'googleSheetsOAuth2Api': { displayName: 'Google Sheets', icon: 'sheets' },
  'googleDocsOAuth2Api': { displayName: 'Google Docs', icon: 'docs' },
  'gmailOAuth2': { displayName: 'Gmail', icon: 'gmail' },
  'googleCalendarOAuth2Api': { displayName: 'Google Calendar', icon: 'calendar' },

  // Communication
  'slackOAuth2Api': { displayName: 'Slack', icon: 'slack' },
  'slackApi': { displayName: 'Slack', icon: 'slack' },
  'discordApi': { displayName: 'Discord', icon: 'discord' },
  'discordOAuth2Api': { displayName: 'Discord', icon: 'discord' },
  'telegramApi': { displayName: 'Telegram', icon: 'telegram' },
  'twilioApi': { displayName: 'Twilio', icon: 'twilio' },
  'sendGridApi': { displayName: 'SendGrid', icon: 'sendgrid' },
  'mailchimpApi': { displayName: 'Mailchimp', icon: 'mailchimp' },
  'intercomApi': { displayName: 'Intercom', icon: 'intercom' },

  // Productivity & Notes
  'notionOAuth2Api': { displayName: 'Notion', icon: 'notion' },
  'notionApi': { displayName: 'Notion', icon: 'notion' },
  'airtableOAuth2Api': { displayName: 'Airtable', icon: 'airtable' },
  'airtableApi': { displayName: 'Airtable', icon: 'airtable' },
  'trelloApi': { displayName: 'Trello', icon: 'trello' },
  'asanaApi': { displayName: 'Asana', icon: 'asana' },
  'mondayComApi': { displayName: 'Monday.com', icon: 'monday' },
  'clickUpApi': { displayName: 'ClickUp', icon: 'clickup' },
  'todoistApi': { displayName: 'Todoist', icon: 'todoist' },

  // Developer Tools
  'githubApi': { displayName: 'GitHub', icon: 'github' },
  'githubOAuth2Api': { displayName: 'GitHub', icon: 'github' },
  'gitlabApi': { displayName: 'GitLab', icon: 'gitlab' },
  'gitlabOAuth2Api': { displayName: 'GitLab', icon: 'gitlab' },
  'jiraApi': { displayName: 'Jira', icon: 'jira' },
  'jiraSoftwareCloudApi': { displayName: 'Jira', icon: 'jira' },
  'linearApi': { displayName: 'Linear', icon: 'linear' },

  // CRM & Sales
  'hubspotOAuth2Api': { displayName: 'HubSpot', icon: 'hubspot' },
  'hubspotApi': { displayName: 'HubSpot', icon: 'hubspot' },
  'salesforceOAuth2Api': { displayName: 'Salesforce', icon: 'salesforce' },
  'pipedriveApi': { displayName: 'Pipedrive', icon: 'pipedrive' },
  'zendeskApi': { displayName: 'Zendesk', icon: 'zendesk' },
  'freshdeskApi': { displayName: 'Freshdesk', icon: 'freshdesk' },

  // Cloud Storage
  'dropboxOAuth2Api': { displayName: 'Dropbox', icon: 'dropbox' },
  'boxOAuth2Api': { displayName: 'Box', icon: 'box' },
  'oneDriveOAuth2Api': { displayName: 'OneDrive', icon: 'onedrive' },

  // Microsoft
  'microsoftOAuth2Api': { displayName: 'Microsoft', icon: 'microsoft' },
  'microsoftOutlookOAuth2Api': { displayName: 'Outlook', icon: 'outlook' },
  'microsoftTeamsOAuth2Api': { displayName: 'Microsoft Teams', icon: 'teams' },
  'microsoftExcelOAuth2Api': { displayName: 'Excel', icon: 'excel' },

  // Social Media
  'twitterOAuth2Api': { displayName: 'X (Twitter)', icon: 'twitter' },
  'facebookGraphApi': { displayName: 'Facebook', icon: 'facebook' },
  'instagramBasicDisplayApi': { displayName: 'Instagram', icon: 'instagram' },
  'linkedInOAuth2Api': { displayName: 'LinkedIn', icon: 'linkedin' },
  'youtubeOAuth2Api': { displayName: 'YouTube', icon: 'youtube' },

  // E-commerce
  'stripeApi': { displayName: 'Stripe', icon: 'stripe' },
  'shopifyApi': { displayName: 'Shopify', icon: 'shopify' },
  'wooCommerceApi': { displayName: 'WooCommerce', icon: 'woocommerce' },
  'squareApi': { displayName: 'Square', icon: 'square' },

  // AI & ML - LLM Providers
  'openAiApi': { displayName: 'OpenAI', icon: 'openai' },
  'anthropicApi': { displayName: 'Anthropic', icon: 'anthropic' },
  'cohereApi': { displayName: 'Cohere', icon: 'cohere' },
  'mistralCloudApi': { displayName: 'Mistral AI', icon: 'mistral' },
  'googleGeminiApi': { displayName: 'Google Gemini', icon: 'google' },
  'googleVertexAi': { displayName: 'Google Vertex AI', icon: 'google' },
  'azureOpenAiApi': { displayName: 'Azure OpenAI', icon: 'azure' },
  'openRouterApi': { displayName: 'OpenRouter', icon: 'openrouter' },
  'xAiApi': { displayName: 'xAI Grok', icon: 'xai' },
  'vercelAiGatewayApi': { displayName: 'Vercel AI Gateway', icon: 'vercel' },
  'huggingFaceApi': { displayName: 'Hugging Face', icon: 'huggingface' },
  'replicateApi': { displayName: 'Replicate', icon: 'replicate' },
  'flowEngineApi': { displayName: 'FlowEngine LLM', icon: 'bot' },

  // AI & ML - Vector Stores & Tools
  'pineconeApi': { displayName: 'Pinecone', icon: 'pinecone' },
  'tavilyApi': { displayName: 'Tavily', icon: 'search' },
  'serpApi': { displayName: 'SerpApi', icon: 'search' },
  'wolframAlphaApi': { displayName: 'Wolfram Alpha', icon: 'math' },

  // AI Memory Stores
  'zepApi': { displayName: 'Zep Memory', icon: 'memory' },
  'motorheadApi': { displayName: 'Motorhead', icon: 'memory' },
  'xataApi': { displayName: 'Xata', icon: 'database' },
  'redisApi': { displayName: 'Redis', icon: 'redis' },
  'postgresApi': { displayName: 'PostgreSQL', icon: 'postgres' },

  // Cloud Providers
  'awsApi': { displayName: 'AWS', icon: 'aws' },
  'googleCloudApi': { displayName: 'Google Cloud', icon: 'gcp' },
  'azureApi': { displayName: 'Azure', icon: 'azure' },

  // Databases
  'supabaseApi': { displayName: 'Supabase', icon: 'supabase' },
  'firebaseApi': { displayName: 'Firebase', icon: 'firebase' },
  'mongoDbApi': { displayName: 'MongoDB', icon: 'mongodb' },

  // Analytics
  'googleAnalyticsOAuth2Api': { displayName: 'Google Analytics', icon: 'analytics' },
  'mixpanelApi': { displayName: 'Mixpanel', icon: 'mixpanel' },
  'segmentApi': { displayName: 'Segment', icon: 'segment' },
  'amplitudeApi': { displayName: 'Amplitude', icon: 'amplitude' },

  // Other Popular Services
  'webhookApi': { displayName: 'Webhook', icon: 'webhook' },
  'httpRequestApi': { displayName: 'HTTP Request', icon: 'http' },
  'calendarificApi': { displayName: 'Calendarific', icon: 'calendar' },
  'calendlyApi': { displayName: 'Calendly', icon: 'calendly' },
  'typeformApi': { displayName: 'Typeform', icon: 'typeform' },
  'formstackApi': { displayName: 'Formstack', icon: 'formstack' },
  'zoomApi': { displayName: 'Zoom', icon: 'zoom' },
  'webexApi': { displayName: 'Webex', icon: 'webex' },

  // ===== COMMUNITY NODES =====

  // Explorium (Data Enrichment & AI)
  'exploriumApi': { displayName: 'Explorium', icon: 'explorium' },
  'exploriumMcpApi': { displayName: 'Explorium MCP', icon: 'explorium' },

  // WhatsApp Community Nodes
  'wahaApi': { displayName: 'WAHA (WhatsApp)', icon: 'whatsapp' },
  'evolutionApi': { displayName: 'Evolution API', icon: 'whatsapp' },
  'whatsappBusinessApi': { displayName: 'WhatsApp Business', icon: 'whatsapp' },
  'chatWootApi': { displayName: 'ChatWoot', icon: 'chatwoot' },

  // AI Community Nodes
  'deepSeekApi': { displayName: 'DeepSeek', icon: 'deepseek' },
  'perplexityApi': { displayName: 'Perplexity', icon: 'perplexity' },
  'elevenLabsApi': { displayName: 'ElevenLabs', icon: 'elevenlabs' },
  'groqApi': { displayName: 'Groq', icon: 'groq' },
  'mistralApi': { displayName: 'Mistral', icon: 'mistral' },
  'togetherAiApi': { displayName: 'Together AI', icon: 'togetherai' },
  'ollamaApi': { displayName: 'Ollama', icon: 'ollama' },
  'llamaApi': { displayName: 'Llama', icon: 'llama' },
  'stabilityAiApi': { displayName: 'Stability AI', icon: 'stabilityai' },
  'midjourneyApi': { displayName: 'Midjourney', icon: 'midjourney' },
  'dalleApi': { displayName: 'DALL-E', icon: 'openai' },
  'leonardoAiApi': { displayName: 'Leonardo AI', icon: 'leonardo' },

  // Web Scraping Community Nodes
  'scrapeNinjaApi': { displayName: 'ScrapeNinja', icon: 'scraper' },
  'apifyApi': { displayName: 'Apify', icon: 'apify' },
  'browserlessApi': { displayName: 'Browserless', icon: 'browser' },
  'crawleeApi': { displayName: 'Crawlee', icon: 'scraper' },
  'phantombusterApi': { displayName: 'PhantomBuster', icon: 'phantom' },
  'brightDataApi': { displayName: 'Bright Data', icon: 'brightdata' },
  'scrapingBeeApi': { displayName: 'ScrapingBee', icon: 'scraper' },
  'firecrawlApi': { displayName: 'Firecrawl', icon: 'firecrawl' },

  // Document & OCR Community Nodes
  'tesseractApi': { displayName: 'Tesseract OCR', icon: 'ocr' },
  'pdfCoApi': { displayName: 'PDF.co', icon: 'pdf' },
  'docparserApi': { displayName: 'Docparser', icon: 'document' },

  // Vector Databases & RAG
  'chromaApi': { displayName: 'Chroma', icon: 'vector' },
  'qdrantApi': { displayName: 'Qdrant', icon: 'vector' },
  'weaviateApi': { displayName: 'Weaviate', icon: 'vector' },
  'milvusApi': { displayName: 'Milvus', icon: 'vector' },
  'supabaseVectorApi': { displayName: 'Supabase Vector', icon: 'supabase' },

  // Automation & Integration
  'makeApi': { displayName: 'Make', icon: 'make' },
  'zapierApi': { displayName: 'Zapier', icon: 'zapier' },
  'iftttApi': { displayName: 'IFTTT', icon: 'ifttt' },
  'activepirecesApi': { displayName: 'Activepieces', icon: 'activepieces' },

  // CRM Community Nodes
  'closeApi': { displayName: 'Close CRM', icon: 'close' },
  'copperApi': { displayName: 'Copper', icon: 'copper' },
  'insightlyApi': { displayName: 'Insightly', icon: 'insightly' },
  'keapApi': { displayName: 'Keap', icon: 'keap' },
  'highLevelApi': { displayName: 'HighLevel', icon: 'highlevel' },
  'goHighLevelApi': { displayName: 'GoHighLevel', icon: 'highlevel' },

  // E-commerce Community Nodes
  'lemlistApi': { displayName: 'Lemlist', icon: 'lemlist' },
  'gumroadApi': { displayName: 'Gumroad', icon: 'gumroad' },
  'paddleApi': { displayName: 'Paddle', icon: 'paddle' },
  'chargebeeApi': { displayName: 'Chargebee', icon: 'chargebee' },
  'recurlyApi': { displayName: 'Recurly', icon: 'recurly' },

  // Social & Marketing Community Nodes
  'phantomBusterApi': { displayName: 'PhantomBuster', icon: 'phantom' },
  'apolloApi': { displayName: 'Apollo.io', icon: 'apollo' },
  'hunterApi': { displayName: 'Hunter.io', icon: 'hunter' },
  'clearbitApi': { displayName: 'Clearbit', icon: 'clearbit' },
  'zoomInfoApi': { displayName: 'ZoomInfo', icon: 'zoominfo' },
  'snov.ioApi': { displayName: 'Snov.io', icon: 'snov' },

  // Communication Community Nodes
  'vonageApi': { displayName: 'Vonage', icon: 'vonage' },
  'plivo.Api': { displayName: 'Plivo', icon: 'plivo' },
  'nexmoApi': { displayName: 'Nexmo', icon: 'nexmo' },
  'clickSendApi': { displayName: 'ClickSend', icon: 'clicksend' },
  'messageMediaApi': { displayName: 'MessageMedia', icon: 'messagemedia' },

  // Project Management Community Nodes
  'basecampApi': { displayName: 'Basecamp', icon: 'basecamp' },
  'wrikeApi': { displayName: 'Wrike', icon: 'wrike' },
  'smartsheetApi': { displayName: 'Smartsheet', icon: 'smartsheet' },
  'teamworkApi': { displayName: 'Teamwork', icon: 'teamwork' },
};

/**
 * Icon keywords for dynamic icon detection
 * Maps keywords found in credential names to icon types
 */
const ICON_KEYWORDS: Record<string, string[]> = {
  // Communication
  'slack': ['slack'],
  'discord': ['discord'],
  'telegram': ['telegram', 'tg'],
  'whatsapp': ['whatsapp', 'waha', 'evolution'],
  'email': ['mail', 'email', 'smtp', 'imap'],
  'sms': ['sms', 'twilio', 'vonage', 'plivo', 'nexmo'],

  // Productivity
  'sheets': ['sheet', 'spreadsheet', 'excel'],
  'docs': ['doc', 'document', 'word'],
  'notion': ['notion'],
  'airtable': ['airtable'],
  'trello': ['trello'],
  'asana': ['asana'],

  // Storage
  'drive': ['drive', 'storage', 'file'],
  'dropbox': ['dropbox'],
  'cloud': ['cloud', 'aws', 's3', 'azure', 'gcp'],

  // CRM
  'hubspot': ['hubspot'],
  'salesforce': ['salesforce', 'sfdc'],
  'crm': ['crm', 'lead', 'contact', 'deal'],

  // AI
  'openai': ['openai', 'gpt', 'chatgpt', 'dalle'],
  'anthropic': ['anthropic', 'claude'],
  'bot': ['ai', 'llm', 'ml', 'model', 'deepseek', 'mistral', 'groq', 'ollama', 'perplexity'],

  // Dev tools
  'github': ['github', 'git'],
  'gitlab': ['gitlab'],
  'jira': ['jira', 'atlassian'],
  'code': ['code', 'dev', 'api'],

  // E-commerce
  'stripe': ['stripe', 'payment'],
  'shopify': ['shopify', 'shop'],
  'cart': ['cart', 'commerce', 'store', 'order'],

  // Database
  'database': ['database', 'db', 'sql', 'postgres', 'mysql', 'mongo', 'supabase', 'firebase', 'redis', 'vector', 'pinecone', 'qdrant', 'chroma', 'weaviate'],

  // Social
  'twitter': ['twitter', 'x'],
  'facebook': ['facebook', 'fb', 'meta'],
  'linkedin': ['linkedin'],
  'instagram': ['instagram', 'insta'],
  'youtube': ['youtube', 'yt'],

  // Calendar
  'calendar': ['calendar', 'event', 'schedule', 'calendly', 'zoom', 'meet'],

  // Web
  'globe': ['http', 'web', 'url', 'scrape', 'crawl', 'browser', 'apify', 'firecrawl'],

  // Media
  'image': ['image', 'photo', 'picture', 'stability', 'midjourney', 'leonardo', 'dalle'],
  'video': ['video', 'youtube', 'vimeo', 'stream'],
  'music': ['audio', 'voice', 'speech', 'elevenlabs', 'tts', 'music', 'spotify'],

  // Analytics
  'analytics': ['analytics', 'tracking', 'mixpanel', 'segment', 'amplitude'],

  // Users/CRM
  'users': ['user', 'customer', 'contact', 'lead', 'apollo', 'hunter', 'clearbit', 'zoominfo'],
};

/**
 * Get display info for a credential type - works for ANY credential, known or unknown
 * Uses hardcoded info if available, otherwise dynamically generates from the type name
 */
export function getCredentialDisplayInfo(credentialType: string): { displayName: string; icon: string } {
  // First check if we have hardcoded info
  if (CREDENTIAL_DISPLAY_INFO[credentialType]) {
    return CREDENTIAL_DISPLAY_INFO[credentialType];
  }

  // Dynamic fallback: parse the credential type name
  const displayName = parseCredentialName(credentialType);
  const icon = detectIconFromName(credentialType);

  return { displayName, icon };
}

/**
 * Parse a credential type name into a human-readable display name
 * e.g., "myCustomApiOAuth2Api" -> "My Custom Api"
 */
function parseCredentialName(credentialType: string): string {
  return credentialType
    // Remove common suffixes
    .replace(/OAuth2Api$/i, '')
    .replace(/OAuth2$/i, '')
    .replace(/Api$/i, '')
    .replace(/Credentials?$/i, '')
    // Handle n8n community node naming conventions (n8n-nodes-xxx)
    .replace(/^n8n[-_]?nodes[-_]?/i, '')
    // Insert spaces before capital letters
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Handle consecutive capitals (like "API" -> "API ")
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    // Clean up dashes and underscores
    .replace(/[-_]+/g, ' ')
    // Capitalize first letter of each word
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

/**
 * Detect the best icon for a credential type based on keywords in the name
 */
function detectIconFromName(credentialType: string): string {
  const lowerName = credentialType.toLowerCase();

  // Check each icon category for keyword matches
  for (const [icon, keywords] of Object.entries(ICON_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        return icon;
      }
    }
  }

  // Default fallback
  return 'default';
}

/**
 * Parameters to exclude from editing (internal n8n parameters only)
 * We show most parameters including 'options' since users need to configure them
 */
const EXCLUDED_PARAMS = new Set([
  'authentication', // Auth method selection - handled by credential type
  // resource and operation are included - users need to configure these via dropdowns
]);

/**
 * User-friendly descriptions for common parameters
 */
const PARAM_DESCRIPTIONS: Record<string, string> = {
  // Google Docs
  documentId: 'The Google Docs document ID. Find it in the URL: docs.google.com/document/d/[DOCUMENT_ID]/edit',
  docId: 'The Google Docs document ID. Find it in the URL: docs.google.com/document/d/[DOCUMENT_ID]/edit',
  doc: 'The Google Docs document to use',
  documentURL: 'The full URL of the Google Docs document',

  // Google Sheets
  spreadsheetId: 'The Google Sheets spreadsheet ID. Find it in the URL: docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit',
  sheetId: 'The sheet name or GID (e.g., "Sheet1" or the number from gid= in URL)',
  sheetName: 'The name of the sheet tab (e.g., "Sheet1")',
  range: 'The cell range (e.g., "A1:B10" or "Sheet1!A1:B10")',
  values: 'The values to insert or update',

  // Google Drive
  folderId: 'The Google Drive folder ID. Find it in the URL: drive.google.com/drive/folders/[FOLDER_ID]',
  driveId: 'The Google Drive ID (for shared drives)',
  fileId: 'The Google Drive file ID. Find it in the URL after /d/',
  fileName: 'The name for the file',
  mimeType: 'The file type (e.g., application/pdf, image/png)',

  // Google Calendar
  calendarId: 'The Google Calendar ID (e.g., "primary" or calendar email address)',
  eventId: 'The calendar event ID',
  startTime: 'Event start time (ISO 8601 format)',
  endTime: 'Event end time (ISO 8601 format)',

  // Gmail
  subject: 'The email subject line',
  message: 'The email message body',
  toRecipients: 'Email addresses to send to (comma separated)',
  ccRecipients: 'Email addresses to CC (comma separated)',
  bccRecipients: 'Email addresses to BCC (comma separated)',
  to: 'Email address(es) to send to',
  cc: 'Email address(es) to CC',
  bcc: 'Email address(es) to BCC',
  replyTo: 'Reply-to email address',
  attachments: 'File attachments to include',

  // General text/content
  text: 'The text content to use',
  simpleText: 'Plain text content',
  content: 'The content to send or process',
  body: 'The body content',
  title: 'The title or name',
  name: 'The name to use',
  description: 'A description',
  url: 'The URL to use',

  // Slack
  channelId: 'The Slack channel ID or name (e.g., "#general" or "C01234567")',
  channel: 'The Slack channel to use',
  messageId: 'The Slack message timestamp ID',
  threadTs: 'Thread timestamp to reply to (for threaded messages)',
  username: 'Display name for the bot message',
  iconEmoji: 'Emoji to use as the bot icon (e.g., ":robot:")',
  iconUrl: 'URL of image to use as the bot icon',
  blocks: 'Slack Block Kit blocks (JSON array)',

  // Discord
  guildId: 'The Discord server (guild) ID',
  serverId: 'The Discord server ID',
  webhookUrl: 'Discord webhook URL',
  embeds: 'Discord embed objects (JSON array)',
  discordComponents: 'Discord message components (buttons, selects)',

  // Notion
  pageId: 'The Notion page ID (found in the URL after the workspace name)',
  databaseId: 'The Notion database ID (found in the URL)',
  blockId: 'The Notion block ID',
  parentPageId: 'The parent page ID for creating nested content',
  properties: 'Page or database properties (JSON object)',
  icon: 'Page icon emoji or external URL',
  cover: 'Page cover image URL',

  // Airtable
  baseId: 'The Airtable base ID (starts with "app", found in the URL)',
  tableId: 'The Airtable table ID or name',
  tableIdOrName: 'The Airtable table ID or name',
  recordId: 'The Airtable record ID (starts with "rec")',
  viewId: 'The Airtable view ID or name',
  fields: 'Record fields to create or update',
  filterByFormula: 'Airtable formula to filter records',

  // Trello
  boardId: 'The Trello board ID',
  trelloListId: 'The Trello list ID',
  cardId: 'The Trello card ID',
  labelIds: 'Trello label IDs to apply',
  dueDate: 'Due date for the card',
  pos: 'Position in the list (top, bottom, or number)',

  // Asana
  projectId: 'The Asana project ID',
  sectionId: 'The Asana section ID',
  taskId: 'The Asana task ID',
  assignee: 'User to assign the task to',
  due_on: 'Due date (YYYY-MM-DD)',
  due_at: 'Due date and time (ISO 8601)',
  notes: 'Task notes or description',

  // GitHub
  owner: 'Repository owner (username or organization)',
  repo: 'Repository name',
  repository: 'Repository in format owner/repo',
  issueNumber: 'Issue or PR number',
  pullNumber: 'Pull request number',
  branch: 'Branch name',
  sha: 'Git commit SHA',
  path: 'File path in the repository',
  ref: 'Git reference (branch, tag, or commit)',
  labels: 'Labels to apply (comma separated)',
  assignees: 'Users to assign (comma separated)',
  milestone: 'Milestone number or title',

  // Jira
  projectKey: 'Jira project key (e.g., "PROJ")',
  issueKey: 'Jira issue key (e.g., "PROJ-123")',
  issueType: 'Issue type (Bug, Task, Story, Epic, etc.)',
  summary: 'Issue summary/title',
  priority: 'Issue priority',
  reporter: 'Issue reporter username',
  jiraComponents: 'Issue components',
  fixVersions: 'Fix versions for the issue',

  // Linear
  teamKey: 'Linear team key',
  issueId: 'Linear issue ID',
  projectId2: 'Linear project ID',
  cycleId: 'Linear cycle ID',
  estimate: 'Issue estimate (points)',
  stateId: 'Issue state/status ID',

  // HubSpot
  contactId: 'HubSpot contact ID',
  companyId: 'HubSpot company ID',
  dealId: 'HubSpot deal ID',
  ticketId: 'HubSpot ticket ID',
  pipelineId: 'HubSpot pipeline ID',
  stageId: 'HubSpot pipeline stage ID',
  ownerId: 'HubSpot owner ID',
  email: 'Contact email address',
  firstName: 'Contact first name',
  lastName: 'Contact last name',
  phone: 'Contact phone number',
  company: 'Company name',
  website: 'Website URL',
  lifecycleStage: 'HubSpot lifecycle stage',

  // Salesforce
  sobjectType: 'Salesforce object type (Account, Contact, Lead, etc.)',
  sobjectId: 'Salesforce record ID',
  externalId: 'External ID field value',
  query: 'SOQL query string',

  // Stripe
  customerId: 'Stripe customer ID (starts with "cus_")',
  paymentIntentId: 'Stripe payment intent ID (starts with "pi_")',
  subscriptionId: 'Stripe subscription ID (starts with "sub_")',
  priceId: 'Stripe price ID (starts with "price_")',
  productId: 'Stripe product ID (starts with "prod_")',
  invoiceId: 'Stripe invoice ID (starts with "in_")',
  amount: 'Amount in cents (e.g., 1000 for $10.00)',
  currency: 'Three-letter currency code (e.g., "usd")',
  metadata: 'Additional metadata (key-value pairs)',

  // Shopify
  shopName: 'Shopify store name (from your-store.myshopify.com)',
  orderId: 'Shopify order ID',
  customerId2: 'Shopify customer ID',
  productId2: 'Shopify product ID',
  variantId: 'Shopify product variant ID',
  collectionId: 'Shopify collection ID',
  sku: 'Product SKU',
  inventoryItemId: 'Inventory item ID',
  locationId: 'Shopify location ID',

  // Twilio
  from: 'Sender phone number (E.164 format, e.g., +15551234567)',
  phoneNumber: 'Phone number (E.164 format)',
  messagingServiceSid: 'Twilio Messaging Service SID',
  accountSid: 'Twilio Account SID',
  mediaUrl: 'URL of media to send (MMS)',
  statusCallback: 'Webhook URL for status updates',

  // SendGrid
  templateId: 'SendGrid dynamic template ID',
  dynamicTemplateData: 'Template variables (JSON object)',
  categories: 'Email categories for tracking',
  sendAt: 'Scheduled send time (Unix timestamp)',
  asm: 'Advanced Suppression Manager settings',

  // Telegram
  chatId: 'Telegram chat ID (can be negative for groups)',
  parseMode: 'Message format: Markdown, MarkdownV2, or HTML',
  replyToMessageId: 'Message ID to reply to',
  disableNotification: 'Send silently without notification',
  protectContent: 'Prevent forwarding and saving',
  replyMarkup: 'Inline keyboard or custom keyboard (JSON)',
  photo: 'Photo to send (URL or file_id)',
  document: 'Document to send (URL or file_id)',
  video: 'Video to send (URL or file_id)',
  audio: 'Audio to send (URL or file_id)',
  caption: 'Media caption text',

  // OpenAI
  model: 'Model to use (e.g., gpt-4, gpt-3.5-turbo)',
  prompt: 'The prompt or input text',
  messages: 'Chat messages array',
  systemMessage: 'System prompt to set AI behavior',
  temperature: 'Creativity level (0-2, lower is more focused)',
  maxTokens: 'Maximum response length in tokens',
  topP: 'Nucleus sampling parameter',
  frequencyPenalty: 'Penalty for repeating tokens',
  presencePenalty: 'Penalty for repeating topics',
  stop: 'Stop sequences (array of strings)',
  n: 'Number of completions to generate',
  imageUrl: 'Image URL for vision models',

  // Anthropic
  modelId: 'Anthropic model ID (e.g., claude-3-opus)',
  maxTokensToSample: 'Maximum response tokens',
  stopSequences: 'Sequences that stop generation',
  humanPrompt: 'The user/human message',
  assistantPrompt: 'Partial assistant response to continue',

  // FlowEngine LLM
  flowEngineModel: 'FlowEngine model to use (e.g., gpt-4, claude-3-sonnet, mistral-large)',
  flowEngineApiKey: 'Your FlowEngine API key (or leave blank to use environment variable)',

  // Dropbox
  dropboxPath: 'Path in Dropbox (starts with /)',
  folderPath: 'Folder path in Dropbox',
  downloadPath: 'Local path to download to',

  // Microsoft / Office 365
  mailFolderId: 'Outlook mail folder ID',
  msEventId: 'Calendar event ID',
  driveItemId: 'OneDrive item ID',
  siteId: 'SharePoint site ID',
  sharePointListId: 'SharePoint list ID',
  msTeamId: 'Microsoft Teams team ID',
  msChannelId: 'Microsoft Teams channel ID',

  // Zoom
  meetingId: 'Zoom meeting ID',
  webinarId: 'Zoom webinar ID',
  registrantId: 'Webinar registrant ID',
  startTime2: 'Meeting start time (ISO 8601)',
  duration: 'Meeting duration in minutes',
  timezone: 'Timezone (e.g., America/New_York)',
  agenda: 'Meeting agenda',
  hostEmail: 'Host email address',

  // Common IDs
  id: 'The unique identifier',
  userId: 'The user identifier',
  teamId: 'The team identifier',
  workspaceId: 'The workspace identifier',
  objectId: 'The object identifier',
  externalId2: 'External reference ID',

  // Common fields
  limit: 'Maximum number of results to return',
  offset: 'Number of results to skip (for pagination)',
  page: 'Page number for pagination',
  perPage: 'Results per page',
  cursor: 'Pagination cursor',
  startDate: 'Start date filter',
  endDate: 'End date filter',
  createdAt: 'Creation timestamp',
  updatedAt: 'Last update timestamp',
  status: 'Current status',
  state: 'Current state',
  type: 'Type or category',
  tags: 'Tags or labels (comma separated)',
  sort: 'Sort field',
  order: 'Sort order (asc or desc)',
  filter: 'Filter criteria',
  search: 'Search query',
  q: 'Search query',

  // ===== COMMUNITY NODE PARAMETERS =====

  // Explorium
  exploriumApiKey: 'Your Explorium API key from developers.explorium.ai',
  enrichmentType: 'Type of data enrichment (company, contact, lead)',
  companyDomain: 'Company domain to enrich (e.g., example.com)',
  companyName: 'Company name to look up',
  linkedInUrl: 'LinkedIn profile URL for enrichment',
  prospectEmail: 'Prospect email address for lead enrichment',
  targetAccount: 'Target account for enrichment',
  dataPoints: 'Specific data points to retrieve',

  // WhatsApp / WAHA / Evolution API
  wahaSessionId: 'WAHA session ID for WhatsApp connection',
  wahaApiUrl: 'WAHA server URL (e.g., http://localhost:3000)',
  recipientPhone: 'Recipient phone number with country code',
  whatsappMessage: 'Message content to send via WhatsApp',
  mediaBase64: 'Base64-encoded media content',
  mediaCaption: 'Caption for media message',
  groupId: 'WhatsApp group ID',
  instanceKey: 'Evolution API instance key',

  // ChatWoot
  chatwootAccountId: 'ChatWoot account ID',
  chatwootInboxId: 'ChatWoot inbox ID',
  chatwootConversationId: 'ChatWoot conversation ID',
  chatwootContactId: 'ChatWoot contact ID',

  // DeepSeek / Perplexity / AI Nodes
  deepSeekModel: 'DeepSeek model (deepseek-chat, deepseek-coder)',
  perplexityModel: 'Perplexity model to use',
  searchDomains: 'Domains to search (for Perplexity)',

  // ElevenLabs
  voiceId: 'ElevenLabs voice ID',
  voiceSettings: 'Voice settings (stability, similarity)',
  elevenLabsModelId: 'ElevenLabs model ID',
  outputFormat: 'Audio output format',

  // Web Scraping
  scrapeUrl: 'URL to scrape',
  scrapeSelector: 'CSS selector for scraping',
  waitForSelector: 'Selector to wait for before scraping',
  proxyCountry: 'Proxy country code',
  javascriptEnabled: 'Enable JavaScript rendering',
  screenshotOptions: 'Screenshot configuration',

  // Apify
  apifyActorId: 'Apify Actor ID to run',
  apifyInput: 'Input for the Apify Actor',
  apifyDatasetId: 'Apify dataset ID',
  apifyRunId: 'Apify run ID',

  // Firecrawl
  firecrawlMode: 'Crawl mode (scrape, crawl, map)',
  firecrawlFormats: 'Output formats (markdown, html)',
  firecrawlMaxDepth: 'Maximum crawl depth',

  // Vector Databases
  vectorCollection: 'Vector collection/index name',
  embeddingVector: 'Embedding vector array',
  vectorDimension: 'Vector dimension size',
  similarityMetric: 'Similarity metric (cosine, euclidean, dot)',
  topK: 'Number of nearest neighbors to return',
  vectorFilter: 'Metadata filter for vector search',

  // Apollo.io / Hunter.io / Lead Gen
  prospectDomain: 'Domain to find prospects from',
  prospectTitle: 'Job title to search for',
  prospectSeniority: 'Seniority level filter',
  verifyEmail: 'Verify email deliverability',
  leadScore: 'Minimum lead score',

  // HighLevel / GoHighLevel
  ghlLocationId: 'GoHighLevel location ID',
  ghlPipelineId: 'GoHighLevel pipeline ID',
  ghlOpportunityId: 'GoHighLevel opportunity ID',
  ghlWorkflowId: 'GoHighLevel workflow ID',
};

export interface DynamicNodeParam {
  name: string;
  value: any;
  displayValue: string; // Human-readable value for display
  displayName: string;
  isEmpty: boolean;
  required: boolean; // True if field is empty and needs to be filled
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'resourceLocator';
  isResourceLocator: boolean;
}

export interface DynamicCredentialInfo {
  credentialType: string;
  credentialName: string;
  displayName: string;
  icon: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  parameters: DynamicNodeParam[];
}

/**
 * Node type info from n8n API - contains parameter metadata
 */
export interface NodeTypeInfo {
  displayName?: string;
  description?: string;
  properties?: Array<{
    name: string;
    displayName?: string;
    type?: string;
    description?: string;
    placeholder?: string;
    default?: any;
    required?: boolean;
    noDataExpression?: boolean;
    options?: Array<{ name: string; value: string; description?: string }>;
    displayOptions?: {
      show?: Record<string, any[]>;
      hide?: Record<string, any[]>;
    };
    typeOptions?: {
      loadOptionsMethod?: string;
      minValue?: number;
      maxValue?: number;
      numberStepSize?: number;
      multipleValues?: boolean;
    };
  }>;
}

/**
 * Map n8n property type to our field type
 */
function mapN8nTypeToFieldType(n8nType: string | undefined, prop: any): string {
  if (!n8nType) return 'string';

  switch (n8nType) {
    case 'options':
      return 'select';
    case 'multiOptions':
      return 'multiselect';
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'dateTime':
      return 'datetime';
    case 'json':
      return 'json';
    case 'string':
      // Check for special string subtypes
      if (prop?.typeOptions?.editor === 'codeNodeEditor' || prop?.typeOptions?.rows) {
        return 'textarea';
      }
      return 'string';
    case 'resourceLocator':
      return 'resourceLocator';
    case 'collection':
    case 'fixedCollection':
      return 'collection';
    default:
      return 'string';
  }
}

/**
 * Check if a field should be shown based on displayOptions and current node parameters
 */
function shouldShowField(
  prop: any,
  nodeParams: Record<string, any>
): boolean {
  const displayOptions = prop.displayOptions;
  if (!displayOptions) return true;

  // Check 'show' conditions - ALL must match
  if (displayOptions.show) {
    for (const [paramName, allowedValues] of Object.entries(displayOptions.show)) {
      const currentValue = nodeParams[paramName];
      // If the parameter isn't set yet and we have allowed values,
      // check if default would match
      if (currentValue === undefined) {
        // For unset params, show the field if this is a common config field
        continue;
      }
      if (!Array.isArray(allowedValues)) continue;
      if (!allowedValues.includes(currentValue)) {
        return false;
      }
    }
  }

  // Check 'hide' conditions - ANY match hides the field
  if (displayOptions.hide) {
    for (const [paramName, hiddenValues] of Object.entries(displayOptions.hide)) {
      const currentValue = nodeParams[paramName];
      if (currentValue === undefined) continue;
      if (!Array.isArray(hiddenValues)) continue;
      if (hiddenValues.includes(currentValue)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Field type returned by extractFieldsFromNodeTypeInfo
 */
interface ExtractedField {
  name: string;
  displayName: string;
  type: string;
  placeholder?: string;
  description?: string;
  isResourceLocator?: boolean;
  required?: boolean;
  options?: Array<{ name: string; value: string; description?: string }>;
  default?: any;
  loadOptionsMethod?: string; // For dynamic options loading
  minValue?: number;
  maxValue?: number;
}

/**
 * Extract all configurable fields from node type info
 */
function extractFieldsFromNodeTypeInfo(
  nodeTypeInfo: NodeTypeInfo,
  nodeParams: Record<string, any>
): ExtractedField[] {
  const fields: ExtractedField[] = [];

  if (!nodeTypeInfo.properties) return fields;

  // Parameters to always exclude (internal n8n params)
  const excludeParams = new Set([
    'authentication', // Auth handled by credentials
  ]);

  // Priority params to show first
  const priorityParams = ['resource', 'operation'];

  for (const prop of nodeTypeInfo.properties) {
    if (!prop.name) continue;
    if (excludeParams.has(prop.name)) continue;

    // Check displayOptions to see if this field should be shown
    if (!shouldShowField(prop, nodeParams)) continue;

    // Skip notice/info type properties (not editable)
    if (prop.type === 'notice' || prop.type === 'info') continue;

    // Skip collection/fixedCollection for now (complex nested structures)
    // These need special handling - for now show them as JSON
    const fieldType = mapN8nTypeToFieldType(prop.type, prop);
    if (fieldType === 'collection') continue;

    const field: ExtractedField = {
      name: prop.name,
      displayName: prop.displayName || toDisplayName(prop.name),
      type: fieldType,
      placeholder: prop.placeholder,
      description: prop.description || PARAM_DESCRIPTIONS[prop.name],
      isResourceLocator: prop.type === 'resourceLocator',
      required: prop.required ?? (priorityParams.includes(prop.name)),
      default: prop.default,
    };

    // Track loadOptionsMethod for dynamic options
    if (prop.typeOptions?.loadOptionsMethod) {
      field.loadOptionsMethod = prop.typeOptions.loadOptionsMethod;
      // Mark as select type if it has dynamic options but no static options
      if (field.type === 'string') {
        field.type = 'select';
      }
    }

    // Track min/max for number fields
    if (prop.typeOptions?.minValue !== undefined) {
      field.minValue = prop.typeOptions.minValue;
    }
    if (prop.typeOptions?.maxValue !== undefined) {
      field.maxValue = prop.typeOptions.maxValue;
    }

    // Add options for select fields
    if (prop.options && Array.isArray(prop.options)) {
      field.options = prop.options.map(opt => ({
        name: opt.name || String(opt.value),
        value: String(opt.value),
        description: opt.description,
      }));
    }

    fields.push(field);
  }

  // Sort: priority params first, then required fields, then alphabetically
  fields.sort((a, b) => {
    const aPriority = priorityParams.indexOf(a.name);
    const bPriority = priorityParams.indexOf(b.name);

    if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;

    if (a.required && !b.required) return -1;
    if (!a.required && b.required) return 1;

    return a.displayName.localeCompare(b.displayName);
  });

  return fields;
}

/**
 * Convert parameter name to display name
 * e.g., "folderId" -> "Folder ID", "documentId" -> "Document ID"
 */
function toDisplayName(paramName: string): string {
  return paramName
    // Insert space before capital letters
    .replace(/([A-Z])/g, ' $1')
    // Capitalize first letter
    .replace(/^./, s => s.toUpperCase())
    // Handle common abbreviations
    .replace(/\bId\b/g, 'ID')
    .replace(/\bUrl\b/g, 'URL')
    .replace(/\bApi\b/g, 'API')
    .trim();
}

/**
 * Check if a value is an n8n Resource Locator (special object format)
 * These have structure like: { __rl: true, value: "...", mode: "list" }
 * or { __rl: true, mode: "id", value: "abc123" }
 */
function isResourceLocator(value: any): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value.__rl === true || value.mode !== undefined)
  );
}

/**
 * Extract the actual value from a resource locator or return as-is
 */
function extractValue(value: any): { actualValue: any; displayValue: string; isRL: boolean } {
  if (isResourceLocator(value)) {
    const actualValue = value.value ?? value.cachedResultName ?? '';
    const displayValue = value.cachedResultName || value.value || '';
    return { actualValue, displayValue: String(displayValue), isRL: true };
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    // Try to extract meaningful value from other object types
    if ('value' in value) {
      return { actualValue: value.value, displayValue: String(value.value || ''), isRL: false };
    }
    return { actualValue: value, displayValue: JSON.stringify(value), isRL: false };
  }

  return { actualValue: value, displayValue: String(value ?? ''), isRL: false };
}

/**
 * Check if a value is considered empty
 */
function isValueEmpty(value: any): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;

  // For resource locators, check the inner value
  if (isResourceLocator(value)) {
    const inner = value.value ?? value.cachedResultName;
    return isValueEmpty(inner);
  }

  return false;
}

/**
 * Determine parameter type from value
 */
function getParamType(value: any): 'string' | 'number' | 'boolean' | 'object' | 'array' | 'resourceLocator' {
  if (isResourceLocator(value)) return 'resourceLocator';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'object' && value !== null) return 'object';
  return 'string';
}

/**
 * Check if a value contains an n8n expression (dynamic value)
 */
function isExpression(value: any): boolean {
  if (typeof value === 'string') {
    return value.includes('{{') || value.startsWith('=');
  }
  // Check inside resource locators
  if (isResourceLocator(value)) {
    return isExpression(value.value);
  }
  return false;
}

/**
 * Extract a single parameter and add it to the parameters array
 * Handles flattening nested objects (like 'options')
 */
function extractParameter(
  paramName: string,
  value: any,
  parameters: DynamicNodeParam[],
  prefix: string = ''
): void {
  // Skip excluded parameters
  if (EXCLUDED_PARAMS.has(paramName)) return;

  const fullName = prefix ? `${prefix}.${paramName}` : paramName;

  // Handle nested objects (like 'options')
  // But NOT resource locators (they have __rl property)
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !isResourceLocator(value) &&
    !value.__rl
  ) {
    // Recursively extract nested parameters
    for (const [nestedName, nestedValue] of Object.entries(value)) {
      extractParameter(nestedName, nestedValue, parameters, fullName);
    }
    return;
  }

  // Extract value information
  const { actualValue, displayValue, isRL } = extractValue(value);
  const isEmpty = isValueEmpty(value) && !isExpression(value);

  // Required = empty and not a dynamic expression
  const required = isEmpty;

  parameters.push({
    name: fullName,
    value: isRL ? actualValue : value,
    displayValue,
    displayName: toDisplayName(fullName.replace(/^options\./, '')),
    isEmpty,
    required,
    type: getParamType(value),
    isResourceLocator: isRL,
  });
}

/**
 * Get parameter display name from node type info or generate from name
 */
function getParamDisplayName(
  paramName: string,
  nodeType: string,
  nodeTypeInfo?: Record<string, NodeTypeInfo>
): string {
  // Try to get from n8n node type info first
  const typeInfo = nodeTypeInfo?.[nodeType];
  if (typeInfo?.properties) {
    const baseName = paramName.replace(/^options\./, '');
    const prop = typeInfo.properties.find(p => p.name === baseName);
    if (prop?.displayName) {
      return prop.displayName;
    }
  }

  // Fall back to generated display name
  return toDisplayName(paramName.replace(/^options\./, ''));
}

/**
 * Extract dynamic parameters from a workflow node for a specific credential
 */
export function extractDynamicParams(
  workflowJson: any,
  credentialType: string,
  credentialName?: string,
  nodeTypeInfo?: Record<string, NodeTypeInfo>
): DynamicCredentialInfo | null {
  const nodes = workflowJson?.nodes || [];
  // Try to get nodeTypeInfo from workflowJson if not passed directly
  const typeInfo = nodeTypeInfo || workflowJson?.nodeTypeInfo;
  // Use dynamic display info - works for any credential, known or unknown
  const displayInfo = getCredentialDisplayInfo(credentialType);

  // Find a node that uses this credential
  for (const node of nodes) {
    const nodeType = node.type || '';
    const nodeTypeSimple = nodeType.split('.').pop()?.toLowerCase() || '';
    const nodeCredentials = node.credentials || {};

    let matches = false;
    let nodeCred: any = null;

    // Method 1: Check explicit credentials (if API returns them)
    if (Object.keys(nodeCredentials).length > 0) {
      const credKey = Object.keys(nodeCredentials).find(k => {
        // Match by credential type name
        if (k === credentialType) return true;
        // Also check variations (e.g., googleDriveOAuth2Api vs googleDrive)
        const baseType = credentialType.replace(/OAuth2Api$|Api$/i, '').toLowerCase();
        return k.toLowerCase().includes(baseType);
      });

      if (credKey) {
        matches = true;
        nodeCred = nodeCredentials[credKey];
      }
    }

    // Method 2: Infer from node type using CREDENTIAL_MAPPINGS
    if (!matches) {
      for (const [keyword, mapping] of Object.entries(CREDENTIAL_MAPPINGS)) {
        if (nodeTypeSimple.includes(keyword) && mapping.type === credentialType) {
          matches = true;
          break;
        }
      }
    }

    if (!matches) continue;

    // Extract parameters from this node
    const nodeParams = node.parameters || {};
    const parameters: DynamicNodeParam[] = [];

    // Extract all parameters, flattening nested objects
    for (const [paramName, value] of Object.entries(nodeParams)) {
      extractParameter(paramName, value, parameters);
    }

    // Enhance display names with node type info from n8n
    for (const param of parameters) {
      param.displayName = getParamDisplayName(param.name, node.type, typeInfo);
    }

    // Sort: empty fields first (required), then alphabetically
    parameters.sort((a, b) => {
      // Empty fields (required) come first
      if (a.isEmpty && !b.isEmpty) return -1;
      if (!a.isEmpty && b.isEmpty) return 1;
      // Then alphabetically
      return a.displayName.localeCompare(b.displayName);
    });

    return {
      credentialType,
      credentialName: nodeCred?.name || credentialName || displayInfo.displayName,
      displayName: displayInfo.displayName,
      icon: displayInfo.icon,
      nodeId: node.id,
      nodeName: node.name || displayInfo.displayName,
      nodeType: node.type,
      parameters,
    };
  }

  return null;
}

/**
 * Check if a credential type has any nodes in the workflow that use it
 * (Used to determine if the "configure" button should be shown)
 */
export function hasConfigurableParams(credentialType: string): boolean {
  // All credential types are potentially configurable -
  // the parameters come from the actual workflow
  return true;
}

/**
 * Param info interface for the modal
 */
export interface CredentialParamInfo {
  credentialType: string;
  credentialName: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  config: {
    displayName: string;
    description: string;
    icon: string;
    fields: Array<{
      name: string;
      displayName: string;
      type: string;
      placeholder?: string;
      description?: string;
      isResourceLocator?: boolean;
      required?: boolean;
      options?: Array<{ name: string; value: string; description?: string }>;
      loadOptionsMethod?: string; // For dynamic options that can be fetched
      minValue?: number;
      maxValue?: number;
    }>;
  };
  currentValues: Record<string, any>;
}

/**
 * Get parameter description from node type info or fallback sources
 * For unknown parameters, generates a smart description from the name
 */
function getParamDescription(
  paramName: string,
  nodeType: string,
  nodeTypeInfo?: Record<string, NodeTypeInfo>
): string | undefined {
  // First try to get from n8n node type info (dynamic)
  const typeInfo = nodeTypeInfo?.[nodeType];
  if (typeInfo?.properties) {
    const baseName = paramName.replace(/^options\./, '');
    const prop = typeInfo.properties.find(p => p.name === baseName);
    if (prop?.description) {
      return prop.description;
    }
  }

  // Fall back to our static descriptions
  const baseName = paramName.replace(/^options\./, '');
  if (PARAM_DESCRIPTIONS[baseName]) {
    return PARAM_DESCRIPTIONS[baseName];
  }

  // Dynamic fallback: generate description from parameter name
  return generateParamDescription(baseName);
}

/**
 * Generate a helpful description from a parameter name
 * Uses naming conventions to infer what the parameter is for
 */
function generateParamDescription(paramName: string): string | undefined {
  const lowerName = paramName.toLowerCase();

  // ID patterns
  if (lowerName.endsWith('id')) {
    const resource = paramName.replace(/Id$/i, '').replace(/([A-Z])/g, ' $1').trim();
    return `The ${resource} identifier`;
  }

  // URL patterns
  if (lowerName.endsWith('url') || lowerName.includes('url')) {
    return 'URL endpoint or link';
  }

  // Key/Token patterns
  if (lowerName.includes('key') || lowerName.includes('token') || lowerName.includes('secret')) {
    return 'Authentication credential (keep secure)';
  }

  // Name patterns
  if (lowerName.endsWith('name')) {
    const resource = paramName.replace(/Name$/i, '').replace(/([A-Z])/g, ' $1').trim();
    return `Name of the ${resource || 'resource'}`;
  }

  // Email patterns
  if (lowerName.includes('email')) {
    return 'Email address';
  }

  // Phone patterns
  if (lowerName.includes('phone') || lowerName.includes('mobile')) {
    return 'Phone number (with country code if international)';
  }

  // Date/Time patterns
  if (lowerName.includes('date') || lowerName.includes('time') || lowerName.includes('timestamp')) {
    return 'Date/time value (ISO 8601 format recommended)';
  }

  // Boolean patterns
  if (lowerName.startsWith('is') || lowerName.startsWith('has') || lowerName.startsWith('enable') || lowerName.startsWith('disable')) {
    return 'Enable or disable this option';
  }

  // Count/Limit patterns
  if (lowerName.includes('limit') || lowerName.includes('count') || lowerName.includes('max') || lowerName.includes('min')) {
    return 'Numeric limit or count value';
  }

  // Message/Content patterns
  if (lowerName.includes('message') || lowerName.includes('content') || lowerName.includes('body') || lowerName.includes('text')) {
    return 'Text content to send or process';
  }

  // Path patterns
  if (lowerName.includes('path') || lowerName.includes('folder') || lowerName.includes('directory')) {
    return 'File or folder path';
  }

  // Filter/Query patterns
  if (lowerName.includes('filter') || lowerName.includes('query') || lowerName.includes('search')) {
    return 'Search or filter criteria';
  }

  // No specific pattern matched
  return undefined;
}

/**
 * Get parameter placeholder from node type info
 */
function getParamPlaceholder(
  paramName: string,
  nodeType: string,
  nodeTypeInfo?: Record<string, NodeTypeInfo>
): string | undefined {
  const typeInfo = nodeTypeInfo?.[nodeType];
  if (typeInfo?.properties) {
    const baseName = paramName.replace(/^options\./, '');
    const prop = typeInfo.properties.find(p => p.name === baseName);
    if (prop?.placeholder) {
      return prop.placeholder;
    }
  }
  return undefined;
}


/**
 * Get credential params - extracts ALL configurable fields from n8n node type info
 * Priority order:
 * 1. Static NODE_REQUIRED_PARAMS (only for special nodes like HTTP Request)
 * 2. n8n node type info from API (comprehensive, includes all fields with options)
 * 3. Dynamic extraction from existing node.parameters (fallback)
 */
export function getCredentialParams(
  workflowJson: any,
  connectedCredentials: Array<{ type: string; name: string; id?: string }>
): CredentialParamInfo[] {
  const results: CredentialParamInfo[] = [];
  // Extract nodeTypeInfo from workflowJson if available (from API response)
  const nodeTypeInfo: Record<string, NodeTypeInfo> | undefined = workflowJson?.nodeTypeInfo;
  const nodes = workflowJson?.nodes || [];

  for (const cred of connectedCredentials) {
    try {

      // Find the node that uses this credential
      // Since workflow API doesn't always return node.credentials, we infer from node type
      const node = nodes.find((n: any) => {
        const nodeType = n.type || '';
        const nodeTypeSimple = nodeType.split('.').pop()?.toLowerCase() || '';

        // For flowEngineApi, check node type
        if (cred.type === 'flowEngineApi') {
          return nodeType.toLowerCase().includes('flowengine') || nodeType.toLowerCase().includes('flowenginellm');
        }

        // Method 1: Check explicit credentials (if API returns them)
        const nodeCredentials = n.credentials || {};
        if (Object.keys(nodeCredentials).length > 0) {
          const hasMatch = Object.keys(nodeCredentials).some(k => {
            // Exact match
            if (k === cred.type) return true;

            // Normalize and compare
            const normalizedCredType = cred.type
              .replace(/OAuth2Api$/i, '')
              .replace(/OAuth2$/i, '')
              .replace(/Api$/i, '')
              .toLowerCase();
            const normalizedKey = k
              .replace(/OAuth2Api$/i, '')
              .replace(/OAuth2$/i, '')
              .replace(/Api$/i, '')
              .toLowerCase();

            return normalizedKey === normalizedCredType || normalizedKey.includes(normalizedCredType);
          });

          if (hasMatch) return true;
        }

        // Method 2: Infer from node type using CREDENTIAL_MAPPINGS (primary method)
        for (const [keyword, mapping] of Object.entries(CREDENTIAL_MAPPINGS)) {
          if (nodeTypeSimple.includes(keyword) && mapping.type === cred.type) {
            return true;
          }
        }

        return false;
      });

      if (!node) {
        continue;
      }


      const displayInfo = getCredentialDisplayInfo(cred.type);
      const nodeParams = node.parameters || {};
      const typeInfo = nodeTypeInfo?.[node.type];

      // Priority 1: Check static NODE_REQUIRED_PARAMS only for specific nodes (e.g., FlowEngine LLM)
      // OAuth nodes should use dynamic extraction (Priority 2 & 3)
      const normalizedNodeType = node.type
        .replace(/^@[^/]+\//, '')  // Remove @scope/ prefix
        .replace(/@[^@]*$/, '');   // Remove version suffix

      // Only check exact matches for static configs - no complex lookup for OAuth
      const staticConfig = NODE_REQUIRED_PARAMS[node.type] || NODE_REQUIRED_PARAMS[normalizedNodeType];

      if (staticConfig) {

        // Use our curated static config
        const currentValues: Record<string, any> = {};
        for (const f of staticConfig.fields) {
          const nodeValue = nodeParams[f.name];
          if (nodeValue !== undefined) {
            if (isResourceLocator(nodeValue)) {
              currentValues[f.name] = nodeValue.value ?? nodeValue.cachedResultName ?? '';
            } else {
              currentValues[f.name] = nodeValue;
            }
          } else {
            currentValues[f.name] = f.default ?? '';
          }
        }

        results.push({
          credentialType: cred.type,
          credentialName: cred.name || displayInfo.displayName,
          nodeId: node.id,
          nodeName: node.name || staticConfig.displayName,
          nodeType: node.type,
          config: {
            displayName: staticConfig.displayName,
            description: staticConfig.description,
            icon: staticConfig.icon,
            fields: staticConfig.fields.map(f => ({
              name: f.name,
              displayName: f.displayName,
              type: f.type,
              placeholder: f.placeholder,
              description: f.description,
              isResourceLocator: false,
              required: f.required,
              options: f.options,
              loadOptionsMethod: (f as any).optionsUrl, // Support dynamic options from optionsUrl
            })),
          },
          currentValues,
        });
        continue;
      }

      // Priority 2: Use n8n node type info if available (comprehensive)
      if (typeInfo && typeInfo.properties && typeInfo.properties.length > 0) {
        const fields = extractFieldsFromNodeTypeInfo(typeInfo, nodeParams);

        // Build current values from node params + defaults
        const currentValues: Record<string, any> = {};
        for (const field of fields) {
          const nodeValue = nodeParams[field.name];
          if (nodeValue !== undefined) {
            // Extract value from resource locator if needed
            if (isResourceLocator(nodeValue)) {
              currentValues[field.name] = nodeValue.value ?? nodeValue.cachedResultName ?? '';
            } else {
              currentValues[field.name] = nodeValue;
            }
          } else if (field.default !== undefined) {
            currentValues[field.name] = field.default;
          } else {
            currentValues[field.name] = '';
          }
        }

        results.push({
          credentialType: cred.type,
          credentialName: cred.name || displayInfo.displayName,
          nodeId: node.id,
          nodeName: node.name || displayInfo.displayName,
          nodeType: node.type,
          config: {
            displayName: typeInfo.displayName || displayInfo.displayName,
            description: typeInfo.description || `Configure ${node.name || displayInfo.displayName} parameters`,
            icon: displayInfo.icon,
            fields: fields.map(f => ({
              name: f.name,
              displayName: f.displayName,
              type: f.type,
              placeholder: f.placeholder,
              description: f.description,
              isResourceLocator: f.isResourceLocator,
              required: f.required,
              options: f.options,
              loadOptionsMethod: f.loadOptionsMethod,
              minValue: f.minValue,
              maxValue: f.maxValue,
            })),
          },
          currentValues,
        });
        continue;
      }

      // Priority 3: Dynamic extraction from existing node.parameters
      const dynamicInfo = extractDynamicParams(workflowJson, cred.type, cred.name);
      if (dynamicInfo && dynamicInfo.parameters.length > 0) {
        results.push({
          credentialType: dynamicInfo.credentialType,
          credentialName: dynamicInfo.credentialName,
          nodeId: dynamicInfo.nodeId,
          nodeName: dynamicInfo.nodeName,
          nodeType: dynamicInfo.nodeType,
          config: {
            displayName: dynamicInfo.displayName,
            description: `Configure ${dynamicInfo.nodeName} parameters`,
            icon: dynamicInfo.icon,
            fields: dynamicInfo.parameters.map(p => {
              const paramDescription = getParamDescription(p.name, dynamicInfo.nodeType, nodeTypeInfo) ||
                (p.isResourceLocator ? 'Enter the ID or use an n8n expression' : undefined);
              const placeholder = getParamPlaceholder(p.name, dynamicInfo.nodeType, nodeTypeInfo) ||
                (p.isEmpty ? `Enter ${p.displayName.toLowerCase()}` : undefined);

              return {
                name: p.name,
                displayName: p.displayName,
                type: p.type === 'boolean' ? 'boolean' : 'string',
                placeholder,
                description: paramDescription,
                isResourceLocator: p.isResourceLocator,
                required: p.required,
              };
            }),
          },
          currentValues: dynamicInfo.parameters.reduce((acc, p) => {
            acc[p.name] = p.displayValue || p.value;
            return acc;
          }, {} as Record<string, any>),
        });
        continue;
      }

      // No fields found - show a message
      results.push({
        credentialType: cred.type,
        credentialName: cred.name || displayInfo.displayName,
        nodeId: node.id,
        nodeName: node.name || displayInfo.displayName,
        nodeType: node.type,
        config: {
          displayName: displayInfo.displayName,
          description: `Configure ${node.name || displayInfo.displayName}. Node type info not available - configure in n8n directly.`,
          icon: displayInfo.icon,
          fields: [],
        },
        currentValues: {},
      });
    } catch (e) {
      console.error('[credParams] Error processing credential:', cred.type, e);
    }
  }

  return results;
}

// Re-export types that are used elsewhere
export type { DynamicCredentialInfo as CredentialNodeConfig };
