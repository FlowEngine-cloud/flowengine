/**
 * Helper for making API calls to individual n8n instances
 * Handles self-signed certificates and provides verification
 */

import https from 'https';
import http from 'http';
import { extractMissingParameters, type MissingParameterInfo } from './n8n/nodeParameters';

interface N8nFetchOptions {
  instanceUrl: string;
  apiKey: string;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  timeout?: number;
}

interface N8nFetchResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

/**
 * Make a request to an n8n instance API with SSL bypass
 * Uses Node.js https/http modules directly to properly handle self-signed certificates
 */
export function n8nFetch<T = any>(options: N8nFetchOptions): Promise<N8nFetchResult<T>> {
  const { instanceUrl, apiKey, path, method = 'GET', body, timeout = 10000 } = options;

  if (!instanceUrl || !apiKey) {
    return Promise.resolve({ success: false, error: 'Instance URL and API key are required' });
  }

  // Parse the URL - ensure we don't double up paths
  let baseUrl = instanceUrl.endsWith('/') ? instanceUrl.slice(0, -1) : instanceUrl;
  const fullPath = path.startsWith('/') ? path : `/${path}`;

  let url: URL;
  try {
    url = new URL(fullPath, baseUrl);
  } catch (e) {
    return Promise.resolve({ success: false, error: 'Invalid instance URL' });
  }

  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise((resolve) => {
    const requestOptions: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      timeout,
      rejectUnauthorized: process.env.N8N_ALLOW_SELF_SIGNED === 'true' ? false : true,
    };

    const req = lib.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const statusCode = res.statusCode || 0;

        if (statusCode >= 400) {
          // Try to parse error response body for more details
          let errorMessage = `API returned ${statusCode}: ${res.statusMessage}`;
          let errorDetails: any = undefined;
          try {
            const parsed = JSON.parse(data);
            // n8n typically returns { message: "...", ... } for errors
            if (parsed.message) {
              errorMessage = `${statusCode}: ${parsed.message}`;
            }
            errorDetails = parsed;
          } catch (e) {
            // If not JSON, include raw response if short enough
            if (data && data.length < 500) {
              errorMessage = `${statusCode}: ${data}`;
            }
          }
          resolve({
            success: false,
            error: errorMessage,
            statusCode,
            data: errorDetails, // Include error details for debugging
          });
          return;
        }

        try {
          const parsed = JSON.parse(data);
          resolve({ success: true, data: parsed, statusCode });
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse response', statusCode });
        }
      });
    });

    req.on('error', (error) => {
      const errorMessage = error.message || 'Unknown error';

      // Handle specific error types
      if (errorMessage.includes('self-signed certificate') || errorMessage.includes('DEPTH_ZERO_SELF_SIGNED_CERT')) {
        resolve({ success: false, error: 'SSL certificate error' });
        return;
      }
      if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
        resolve({ success: false, error: 'Request timed out - instance may be unreachable' });
        return;
      }
      if (errorMessage.includes('ECONNREFUSED')) {
        resolve({ success: false, error: 'Connection refused - instance may be offline' });
        return;
      }
      if (errorMessage.includes('ENOTFOUND')) {
        resolve({ success: false, error: 'Host not found - check instance URL' });
        return;
      }
      if (errorMessage.includes('ECONNRESET')) {
        resolve({ success: false, error: 'Connection reset - instance may be restarting' });
        return;
      }

      resolve({ success: false, error: errorMessage });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Request timed out' });
    });

    // Send body for POST/PUT requests
    if (body && method !== 'GET') {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Verify n8n API key by making a simple API call
 */
export async function verifyN8nApiKey(instanceUrl: string, apiKey: string): Promise<{
  valid: boolean;
  error?: string;
  version?: string;
}> {
  // Try to get workflows list as a simple verification
  const result = await n8nFetch<{ data: any[] }>({
    instanceUrl,
    apiKey,
    path: '/api/v1/workflows',
    timeout: 8000,
  });

  if (result.success) {
    return { valid: true };
  }

  // Check specific error conditions
  if (result.statusCode === 401 || result.statusCode === 403) {
    return { valid: false, error: 'Invalid API key' };
  }

  return { valid: false, error: result.error };
}

/**
 * Fetch a single workflow by ID from n8n to get webhook details
 */
export async function fetchN8nWorkflowById(
  instanceUrl: string,
  apiKey: string,
  workflowId: string
): Promise<{
  workflow?: {
    id: string;
    name: string;
    active: boolean;
    webhookUrl?: string;
  };
  error?: string;
}> {
  const result = await n8nFetch<any>({
    instanceUrl,
    apiKey,
    path: `/api/v1/workflows/${workflowId}`,
  });

  if (!result.success) {
    return { error: result.error };
  }

  const wf = result.data;
  if (!wf) return { error: 'Workflow not found' };

  const baseUrl = instanceUrl.endsWith('/') ? instanceUrl.slice(0, -1) : instanceUrl;

  // Find webhook node and construct URL
  let webhookUrl: string | undefined;
  if (wf.nodes) {
    const webhookNode = wf.nodes.find((node: any) =>
      node.type?.includes('webhook') ||
      node.type?.includes('Webhook') ||
      node.type?.includes('Trigger') ||
      node.type?.includes('chatTrigger') ||
      node.type?.includes('ChatTrigger') ||
      node.type === 'n8n-nodes-base.webhook' ||
      node.type === 'n8n-nodes-base.formTrigger' ||
      node.type === '@n8n/n8n-nodes-langchain.chatTrigger'
    );

    if (webhookNode) {
      const isChatTrigger = webhookNode.type?.includes('chatTrigger') || webhookNode.type?.includes('ChatTrigger');

      // For Chat Triggers: use webhookId (UUID assigned by n8n on activation)
      // parameters.path returns "chat" for Chat Triggers which is wrong
      // For other triggers: use parameters.path (user-defined) first
      const path = isChatTrigger
        ? (webhookNode.webhookId || webhookNode.parameters?.webhookId)
        : (webhookNode.parameters?.path || webhookNode.webhookId || webhookNode.parameters?.webhookId);

      if (path) {
        if (webhookNode.type === 'n8n-nodes-base.formTrigger') {
          // Form Trigger: /webhook/{path}/n8n-form
          webhookUrl = `${baseUrl}/webhook/${path}/n8n-form`;
        } else if (isChatTrigger) {
          // Chat Trigger uses /webhook/{webhookId}/chat endpoint
          webhookUrl = `${baseUrl}/webhook/${path}/chat`;
        } else {
          webhookUrl = `${baseUrl}/webhook/${path}`;
        }
      }
    }
  }

  return {
    workflow: {
      id: wf.id,
      name: wf.name,
      active: wf.active,
      webhookUrl,
    }
  };
}

// Supported HTTP methods for webhooks
export type WebhookMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Determine HTTP method for a webhook node
 * - Form triggers and chat triggers always use POST
 * - Standard webhooks default to GET unless configured otherwise
 * - Supports all HTTP methods: GET, POST, PUT, PATCH, DELETE
 */
function getWebhookMethod(node: any): WebhookMethod {
  const nodeType = node.type || '';

  // Form triggers and chat triggers always use POST
  if (nodeType === 'n8n-nodes-base.formTrigger' ||
      nodeType.includes('chatTrigger') ||
      nodeType.includes('ChatTrigger')) {
    return 'POST';
  }

  // Standard webhook: check options.httpMethod, defaults to GET
  const httpMethod = node.parameters?.options?.httpMethod ||
                     node.parameters?.httpMethod;

  if (httpMethod) {
    // n8n can store as uppercase or with array notation
    const method = (Array.isArray(httpMethod) ? httpMethod[0] : httpMethod).toUpperCase();
    // Validate it's a supported method
    if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return method as WebhookMethod;
    }
  }

  // Default for standard webhook is GET
  return 'GET';
}

// n8n Form Trigger field type
export interface N8nFormField {
  fieldLabel: string;
  fieldType?: 'text' | 'textarea' | 'number' | 'email' | 'password' | 'date' | 'dropdown' | 'file' | 'html';
  requiredField?: boolean;
  placeholder?: string;
  fieldOptions?: { values: Array<{ option: string }> };
}

/**
 * Node type to credential type mapping
 * n8n Public API doesn't expose credentials in workflow exports for security,
 * so we infer required credentials from node types
 */
const NODE_TYPE_CREDENTIALS: Record<string, { type: string; name: string }> = {
  // AI & LLM - Chat Models
  'n8n-nodes-base.openAi': { type: 'openAiApi', name: 'OpenAI' },
  '@n8n/n8n-nodes-langchain.lmChatOpenAi': { type: 'openAiApi', name: 'OpenAI' },
  '@n8n/n8n-nodes-langchain.lmOpenAi': { type: 'openAiApi', name: 'OpenAI' },
  '@n8n/n8n-nodes-langchain.openAi': { type: 'openAiApi', name: 'OpenAI' },
  'n8n-nodes-base.anthropic': { type: 'anthropicApi', name: 'Anthropic' },
  '@n8n/n8n-nodes-langchain.lmChatAnthropic': { type: 'anthropicApi', name: 'Anthropic' },
  '@n8n/n8n-nodes-langchain.lmChatGroq': { type: 'groqApi', name: 'Groq' },
  '@n8n/n8n-nodes-langchain.lmChatMistralCloud': { type: 'mistralCloudApi', name: 'Mistral' },
  '@n8n/n8n-nodes-langchain.lmChatGoogleGemini': { type: 'googleGeminiApi', name: 'Google Gemini' },
  '@n8n/n8n-nodes-langchain.lmChatGoogleVertex': { type: 'googleVertexAi', name: 'Google Vertex AI' },
  '@n8n/n8n-nodes-langchain.lmCohere': { type: 'cohereApi', name: 'Cohere' },
  '@n8n/n8n-nodes-langchain.lmChatCohere': { type: 'cohereApi', name: 'Cohere' },
  '@n8n/n8n-nodes-langchain.lmChatOllama': { type: 'ollamaApi', name: 'Ollama' },
  '@n8n/n8n-nodes-langchain.lmOllama': { type: 'ollamaApi', name: 'Ollama' },
  '@n8n/n8n-nodes-langchain.lmChatAzureOpenAi': { type: 'azureOpenAiApi', name: 'Azure OpenAI' },
  '@n8n/n8n-nodes-langchain.lmChatDeepSeek': { type: 'deepSeekApi', name: 'DeepSeek' },
  '@n8n/n8n-nodes-langchain.lmChatOpenRouter': { type: 'openRouterApi', name: 'OpenRouter' },
  '@n8n/n8n-nodes-langchain.lmChatXAiGrok': { type: 'xAiApi', name: 'xAI Grok' },
  '@n8n/n8n-nodes-langchain.lmChatAwsBedrock': { type: 'awsApi', name: 'AWS Bedrock' },
  '@n8n/n8n-nodes-langchain.lmChatVercelAiGateway': { type: 'vercelAiGatewayApi', name: 'Vercel AI Gateway' },
  '@n8n/n8n-nodes-langchain.lmOpenHuggingFaceInference': { type: 'huggingFaceApi', name: 'Hugging Face' },
  'n8n-nodes-base.huggingFace': { type: 'huggingFaceApi', name: 'Hugging Face' },

  // AI & LLM - Embeddings
  '@n8n/n8n-nodes-langchain.embeddingsOpenAi': { type: 'openAiApi', name: 'OpenAI' },
  '@n8n/n8n-nodes-langchain.embeddingsCohere': { type: 'cohereApi', name: 'Cohere' },
  '@n8n/n8n-nodes-langchain.embeddingsOllama': { type: 'ollamaApi', name: 'Ollama' },
  '@n8n/n8n-nodes-langchain.embeddingsGoogleGemini': { type: 'googleGeminiApi', name: 'Google Gemini' },
  '@n8n/n8n-nodes-langchain.embeddingsGoogleVertex': { type: 'googleVertexAi', name: 'Google Vertex AI' },
  '@n8n/n8n-nodes-langchain.embeddingsAzureOpenAi': { type: 'azureOpenAiApi', name: 'Azure OpenAI' },
  '@n8n/n8n-nodes-langchain.embeddingsAwsBedrock': { type: 'awsApi', name: 'AWS Bedrock' },
  '@n8n/n8n-nodes-langchain.embeddingsMistralCloud': { type: 'mistralCloudApi', name: 'Mistral' },
  '@n8n/n8n-nodes-langchain.embeddingsHuggingFaceInference': { type: 'huggingFaceApi', name: 'Hugging Face' },

  // FlowEngine custom nodes
  'CUSTOM.flowEngineLlm': { type: 'flowEngineApi', name: 'FlowEngine LLM' },
  'n8n-nodes-flowengine.flowEngineLlm': { type: 'flowEngineApi', name: 'FlowEngine LLM' },

  // Community nodes
  '@exploriumai/n8n-nodes-explorium-ai.exploriumApiNode': { type: 'exploriumApi', name: 'Explorium' },

  // Langchain Tool Nodes (AI Agent Tools)
  '@n8n/n8n-nodes-langchain.toolTavily': { type: 'tavilyApi', name: 'Tavily' },
  'n8n-nodes-base.tavily': { type: 'tavilyApi', name: 'Tavily' },
  '@n8n/n8n-nodes-langchain.toolSerpApi': { type: 'serpApi', name: 'SerpApi' },
  '@n8n/n8n-nodes-langchain.toolWolframAlpha': { type: 'wolframAlphaApi', name: 'Wolfram Alpha' },
  '@n8n/n8n-nodes-langchain.toolSearXng': { type: 'none', name: 'SearXng' }, // Self-hosted, no API key needed
  '@n8n/n8n-nodes-langchain.toolHttpRequest': { type: 'none', name: 'HTTP Request Tool' }, // Uses inline config
  '@n8n/n8n-nodes-langchain.toolCode': { type: 'none', name: 'Code Tool' },
  '@n8n/n8n-nodes-langchain.toolCalculator': { type: 'none', name: 'Calculator' },
  '@n8n/n8n-nodes-langchain.toolWikipedia': { type: 'none', name: 'Wikipedia' },
  '@n8n/n8n-nodes-langchain.toolThink': { type: 'none', name: 'Think Tool' },
  '@n8n/n8n-nodes-langchain.toolWorkflow': { type: 'none', name: 'Workflow Tool' },
  '@n8n/n8n-nodes-langchain.toolVectorStore': { type: 'none', name: 'Vector Store Tool' },

  // Langchain Google Tool Nodes (AI Agent Tools for Google services)
  '@n8n/n8n-nodes-langchain.toolGoogleCalendar': { type: 'googleCalendarOAuth2Api', name: 'Google Calendar' },
  '@n8n/n8n-nodes-langchain.toolGmail': { type: 'gmailOAuth2', name: 'Gmail' },
  '@n8n/n8n-nodes-langchain.toolGoogleSheets': { type: 'googleSheetsOAuth2Api', name: 'Google Sheets' },
  '@n8n/n8n-nodes-langchain.toolGoogleDrive': { type: 'googleDriveOAuth2Api', name: 'Google Drive' },
  '@n8n/n8n-nodes-langchain.toolGoogleDocs': { type: 'googleDocsOAuth2Api', name: 'Google Docs' },
  '@n8n/n8n-nodes-langchain.toolGoogleTasks': { type: 'googleTasksOAuth2Api', name: 'Google Tasks' },
  '@n8n/n8n-nodes-langchain.toolGoogleContacts': { type: 'googleContactsOAuth2Api', name: 'Google Contacts' },
  '@n8n/n8n-nodes-langchain.toolGoogleTranslate': { type: 'googleTranslateOAuth2Api', name: 'Google Translate' },
  '@n8n/n8n-nodes-langchain.toolGoogleSlides': { type: 'googleSlidesOAuth2Api', name: 'Google Slides' },
  '@n8n/n8n-nodes-langchain.toolGoogleBigQuery': { type: 'googleBigQueryOAuth2Api', name: 'Google BigQuery' },
  '@n8n/n8n-nodes-langchain.toolGoogleAds': { type: 'googleAdsOAuth2Api', name: 'Google Ads' },
  '@n8n/n8n-nodes-langchain.toolGoogleAnalytics': { type: 'googleAnalyticsOAuth2', name: 'Google Analytics' },
  '@n8n/n8n-nodes-langchain.toolGoogleChat': { type: 'googleChatOAuth2Api', name: 'Google Chat' },

  // Langchain Other Service Tool Nodes
  '@n8n/n8n-nodes-langchain.toolSlack': { type: 'slackOAuth2Api', name: 'Slack' },
  '@n8n/n8n-nodes-langchain.toolDiscord': { type: 'discordOAuth2Api', name: 'Discord' },
  '@n8n/n8n-nodes-langchain.toolNotion': { type: 'notionOAuth2Api', name: 'Notion' },
  '@n8n/n8n-nodes-langchain.toolAirtable': { type: 'airtableOAuth2Api', name: 'Airtable' },
  '@n8n/n8n-nodes-langchain.toolGithub': { type: 'githubOAuth2Api', name: 'GitHub' },
  '@n8n/n8n-nodes-langchain.toolJira': { type: 'jiraSoftwareCloudApi', name: 'Jira' },
  '@n8n/n8n-nodes-langchain.toolHubspot': { type: 'hubspotOAuth2Api', name: 'HubSpot' },
  '@n8n/n8n-nodes-langchain.toolPostgres': { type: 'postgres', name: 'PostgreSQL' },
  '@n8n/n8n-nodes-langchain.toolMySql': { type: 'mySql', name: 'MySQL' },

  // Langchain agents/memory/triggers (don't need credentials directly)
  '@n8n/n8n-nodes-langchain.agent': { type: 'none', name: 'AI Agent' },
  '@n8n/n8n-nodes-langchain.chainLlm': { type: 'none', name: 'LLM Chain' },
  '@n8n/n8n-nodes-langchain.chainSummarization': { type: 'none', name: 'Summarization Chain' },
  '@n8n/n8n-nodes-langchain.chatTrigger': { type: 'none', name: 'Chat Trigger' },
  '@n8n/n8n-nodes-langchain.manualChatTrigger': { type: 'none', name: 'Manual Chat Trigger' },

  // Memory nodes
  '@n8n/n8n-nodes-langchain.memoryBufferWindow': { type: 'none', name: 'Buffer Window Memory' },
  '@n8n/n8n-nodes-langchain.memoryVectorStore': { type: 'none', name: 'Vector Store Memory' },
  '@n8n/n8n-nodes-langchain.memoryChatRetriever': { type: 'none', name: 'Chat Memory Retriever' },
  '@n8n/n8n-nodes-langchain.memoryManager': { type: 'none', name: 'Memory Manager' },
  '@n8n/n8n-nodes-langchain.memoryPostgresChat': { type: 'postgresApi', name: 'Postgres Chat Memory' },
  '@n8n/n8n-nodes-langchain.memoryRedisChat': { type: 'redisApi', name: 'Redis Chat Memory' },
  '@n8n/n8n-nodes-langchain.memoryMongoDbChat': { type: 'mongoDbApi', name: 'MongoDB Chat Memory' },
  '@n8n/n8n-nodes-langchain.memoryXata': { type: 'xataApi', name: 'Xata Memory' },
  '@n8n/n8n-nodes-langchain.memoryZep': { type: 'zepApi', name: 'Zep Memory' },
  '@n8n/n8n-nodes-langchain.memoryMotorhead': { type: 'motorheadApi', name: 'Motorhead Memory' },

  // MCP (Model Context Protocol) nodes
  '@n8n/n8n-nodes-langchain.mcpClientTool': { type: 'none', name: 'MCP Client Tool' },
  '@n8n/n8n-nodes-langchain.mcpTrigger': { type: 'none', name: 'MCP Server Trigger' },
  '@n8n/n8n-nodes-langchain.mcpClient': { type: 'none', name: 'MCP Client' },

  // Vector Stores
  '@n8n/n8n-nodes-langchain.vectorStorePinecone': { type: 'pineconeApi', name: 'Pinecone' },
  '@n8n/n8n-nodes-langchain.vectorStoreQdrant': { type: 'qdrantApi', name: 'Qdrant' },
  '@n8n/n8n-nodes-langchain.vectorStoreWeaviate': { type: 'weaviateApi', name: 'Weaviate' },
  '@n8n/n8n-nodes-langchain.vectorStoreSupabase': { type: 'supabaseApi', name: 'Supabase' },
  '@n8n/n8n-nodes-langchain.vectorStoreMilvus': { type: 'milvusApi', name: 'Milvus' },
  '@n8n/n8n-nodes-langchain.vectorStoreMongoDBAtlas': { type: 'mongoDbApi', name: 'MongoDB Atlas' },
  '@n8n/n8n-nodes-langchain.vectorStorePGVector': { type: 'postgresApi', name: 'PGVector' },
  '@n8n/n8n-nodes-langchain.vectorStoreInMemory': { type: 'none', name: 'In-Memory Vector Store' },
  '@n8n/n8n-nodes-langchain.vectorStoreInMemoryInsert': { type: 'none', name: 'In-Memory Vector Store Insert' },
  '@n8n/n8n-nodes-langchain.vectorStoreInMemoryLoad': { type: 'none', name: 'In-Memory Vector Store Load' },
  '@n8n/n8n-nodes-langchain.vectorStorePineconeInsert': { type: 'pineconeApi', name: 'Pinecone Insert' },

  // Communication
  'n8n-nodes-base.slack': { type: 'slackOAuth2Api', name: 'Slack' },
  'n8n-nodes-base.slackTrigger': { type: 'slackOAuth2Api', name: 'Slack' },
  'n8n-nodes-base.discord': { type: 'discordOAuth2Api', name: 'Discord' },
  'n8n-nodes-base.telegram': { type: 'telegramApi', name: 'Telegram' },
  'n8n-nodes-base.telegramTrigger': { type: 'telegramApi', name: 'Telegram' },
  'n8n-nodes-base.whatsApp': { type: 'whatsAppBusinessCloudApi', name: 'WhatsApp' },
  'n8n-nodes-base.twilio': { type: 'twilioApi', name: 'Twilio' },

  // Google Services - Regular Nodes
  'n8n-nodes-base.googleSheets': { type: 'googleSheetsOAuth2Api', name: 'Google Sheets' },
  'n8n-nodes-base.googleSheetsTrigger': { type: 'googleSheetsOAuth2Api', name: 'Google Sheets' },
  'n8n-nodes-base.gmail': { type: 'gmailOAuth2', name: 'Gmail' },
  'n8n-nodes-base.gmailTrigger': { type: 'gmailOAuth2', name: 'Gmail' },
  'n8n-nodes-base.googleDrive': { type: 'googleDriveOAuth2Api', name: 'Google Drive' },
  'n8n-nodes-base.googleDriveTrigger': { type: 'googleDriveOAuth2Api', name: 'Google Drive' },
  'n8n-nodes-base.googleCalendar': { type: 'googleCalendarOAuth2Api', name: 'Google Calendar' },
  'n8n-nodes-base.googleCalendarTrigger': { type: 'googleCalendarOAuth2Api', name: 'Google Calendar' },
  'n8n-nodes-base.googleDocs': { type: 'googleDocsOAuth2Api', name: 'Google Docs' },

  // Google Services - AI Agent Tool Nodes (same credential types as regular nodes)
  'n8n-nodes-base.googleCalendarTool': { type: 'googleCalendarOAuth2Api', name: 'Google Calendar' },
  'n8n-nodes-base.gmailTool': { type: 'gmailOAuth2', name: 'Gmail' },
  'n8n-nodes-base.googleSheetsTool': { type: 'googleSheetsOAuth2Api', name: 'Google Sheets' },
  'n8n-nodes-base.googleDriveTool': { type: 'googleDriveOAuth2Api', name: 'Google Drive' },
  'n8n-nodes-base.googleDocsTool': { type: 'googleDocsOAuth2Api', name: 'Google Docs' },
  'n8n-nodes-base.googleTasksTool': { type: 'googleTasksOAuth2Api', name: 'Google Tasks' },
  'n8n-nodes-base.googleContactsTool': { type: 'googleContactsOAuth2Api', name: 'Google Contacts' },
  'n8n-nodes-base.googleTranslateTool': { type: 'googleTranslateOAuth2Api', name: 'Google Translate' },
  'n8n-nodes-base.googleSlidesTool': { type: 'googleSlidesOAuth2Api', name: 'Google Slides' },
  'n8n-nodes-base.googleBigQueryTool': { type: 'googleBigQueryOAuth2Api', name: 'Google BigQuery' },
  'n8n-nodes-base.googleAdsTool': { type: 'googleAdsOAuth2Api', name: 'Google Ads' },
  'n8n-nodes-base.googleAnalyticsTool': { type: 'googleAnalyticsOAuth2', name: 'Google Analytics' },
  'n8n-nodes-base.googleChatTool': { type: 'googleChatOAuth2Api', name: 'Google Chat' },

  // Google Services - Regular nodes for additional services
  'n8n-nodes-base.googleContacts': { type: 'googleContactsOAuth2Api', name: 'Google Contacts' },
  'n8n-nodes-base.googleTranslate': { type: 'googleTranslateOAuth2Api', name: 'Google Translate' },
  'n8n-nodes-base.googleSlides': { type: 'googleSlidesOAuth2Api', name: 'Google Slides' },
  'n8n-nodes-base.googleBigQuery': { type: 'googleBigQueryOAuth2Api', name: 'Google BigQuery' },
  'n8n-nodes-base.googleAds': { type: 'googleAdsOAuth2Api', name: 'Google Ads' },
  'n8n-nodes-base.googleAnalytics': { type: 'googleAnalyticsOAuth2', name: 'Google Analytics' },
  'n8n-nodes-base.googleChat': { type: 'googleChatOAuth2Api', name: 'Google Chat' },
  'n8n-nodes-base.googleTasks': { type: 'googleTasksOAuth2Api', name: 'Google Tasks' },

  // Social Media
  'n8n-nodes-base.linkedIn': { type: 'linkedInOAuth2Api', name: 'LinkedIn' },
  'n8n-nodes-base.twitter': { type: 'twitterOAuth2Api', name: 'Twitter/X' },
  'n8n-nodes-base.facebook': { type: 'facebookGraphApi', name: 'Facebook' },
  'n8n-nodes-base.instagram': { type: 'instagramBasicDisplayApi', name: 'Instagram' },

  // Productivity - Regular Nodes
  'n8n-nodes-base.notion': { type: 'notionOAuth2Api', name: 'Notion' },
  'n8n-nodes-base.notionTrigger': { type: 'notionOAuth2Api', name: 'Notion' },
  'n8n-nodes-base.airtable': { type: 'airtableOAuth2Api', name: 'Airtable' },
  'n8n-nodes-base.airtableTrigger': { type: 'airtableOAuth2Api', name: 'Airtable' },
  'n8n-nodes-base.trello': { type: 'trelloApi', name: 'Trello' },
  'n8n-nodes-base.asana': { type: 'asanaOAuth2Api', name: 'Asana' },
  'n8n-nodes-base.clickUp': { type: 'clickUpOAuth2Api', name: 'ClickUp' },
  'n8n-nodes-base.todoist': { type: 'todoistOAuth2Api', name: 'Todoist' },
  'n8n-nodes-base.monday': { type: 'mondayComOAuth2Api', name: 'Monday.com' },

  // Productivity - AI Agent Tool Nodes (same credential types as regular nodes)
  'n8n-nodes-base.notionTool': { type: 'notionOAuth2Api', name: 'Notion' },
  'n8n-nodes-base.airtableTool': { type: 'airtableOAuth2Api', name: 'Airtable' },
  'n8n-nodes-base.slackTool': { type: 'slackOAuth2Api', name: 'Slack' },
  'n8n-nodes-base.discordTool': { type: 'discordOAuth2Api', name: 'Discord' },
  'n8n-nodes-base.telegramTool': { type: 'telegramApi', name: 'Telegram' },
  'n8n-nodes-base.postgresTool': { type: 'postgres', name: 'PostgreSQL' },
  'n8n-nodes-base.mySqlTool': { type: 'mySql', name: 'MySQL' },

  // Development - Regular Nodes
  'n8n-nodes-base.github': { type: 'githubOAuth2Api', name: 'GitHub' },
  'n8n-nodes-base.githubTrigger': { type: 'githubOAuth2Api', name: 'GitHub' },
  'n8n-nodes-base.gitlab': { type: 'gitlabOAuth2Api', name: 'GitLab' },
  'n8n-nodes-base.gitlabTrigger': { type: 'gitlabOAuth2Api', name: 'GitLab' },
  'n8n-nodes-base.jira': { type: 'jiraSoftwareCloudApi', name: 'Jira' },
  'n8n-nodes-base.linear': { type: 'linearApi', name: 'Linear' },

  // Development - AI Agent Tool Nodes (same credential types as regular nodes)
  'n8n-nodes-base.githubTool': { type: 'githubOAuth2Api', name: 'GitHub' },
  'n8n-nodes-base.gitlabTool': { type: 'gitlabOAuth2Api', name: 'GitLab' },
  'n8n-nodes-base.jiraTool': { type: 'jiraSoftwareCloudApi', name: 'Jira' },
  'n8n-nodes-base.linearTool': { type: 'linearApi', name: 'Linear' },

  // CRM & Marketing
  'n8n-nodes-base.hubspot': { type: 'hubspotOAuth2Api', name: 'HubSpot' },
  'n8n-nodes-base.hubspotTrigger': { type: 'hubspotOAuth2Api', name: 'HubSpot' },
  'n8n-nodes-base.salesforce': { type: 'salesforceOAuth2Api', name: 'Salesforce' },
  'n8n-nodes-base.mailchimp': { type: 'mailchimpApi', name: 'Mailchimp' },
  'n8n-nodes-base.sendGrid': { type: 'sendGridApi', name: 'SendGrid' },
  'n8n-nodes-base.activeCampaign': { type: 'activeCampaignApi', name: 'ActiveCampaign' },
  'n8n-nodes-base.pipedrive': { type: 'pipedriveOAuth2Api', name: 'Pipedrive' },
  'n8n-nodes-base.intercom': { type: 'intercomApi', name: 'Intercom' },
  'n8n-nodes-base.zendesk': { type: 'zendeskApi', name: 'Zendesk' },
  'n8n-nodes-base.freshdesk': { type: 'freshdeskApi', name: 'Freshdesk' },

  // E-commerce
  'n8n-nodes-base.shopify': { type: 'shopifyOAuth2Api', name: 'Shopify' },
  'n8n-nodes-base.shopifyTrigger': { type: 'shopifyOAuth2Api', name: 'Shopify' },
  'n8n-nodes-base.stripe': { type: 'stripeApi', name: 'Stripe' },
  'n8n-nodes-base.stripeTrigger': { type: 'stripeApi', name: 'Stripe' },
  'n8n-nodes-base.wooCommerce': { type: 'wooCommerceApi', name: 'WooCommerce' },
  'n8n-nodes-base.wooCommerceTrigger': { type: 'wooCommerceApi', name: 'WooCommerce' },

  // Databases
  'n8n-nodes-base.postgres': { type: 'postgres', name: 'PostgreSQL' },
  'n8n-nodes-base.postgresTrigger': { type: 'postgres', name: 'PostgreSQL' },
  'n8n-nodes-base.mySql': { type: 'mySql', name: 'MySQL' },
  'n8n-nodes-base.mongoDb': { type: 'mongoDb', name: 'MongoDB' },
  'n8n-nodes-base.redis': { type: 'redis', name: 'Redis' },
  'n8n-nodes-base.supabase': { type: 'supabaseApi', name: 'Supabase' },

  // Cloud Storage
  'n8n-nodes-base.dropbox': { type: 'dropboxOAuth2Api', name: 'Dropbox' },
  'n8n-nodes-base.box': { type: 'boxOAuth2Api', name: 'Box' },
  'n8n-nodes-base.s3': { type: 'aws', name: 'AWS S3' },

  // Other
  'n8n-nodes-base.httpRequest': { type: 'httpHeaderAuth', name: 'HTTP Auth' },
  'n8n-nodes-base.rss': { type: 'none', name: 'RSS (No Auth)' },
  'n8n-nodes-base.rssFeedRead': { type: 'none', name: 'RSS (No Auth)' },
  'n8n-nodes-base.ftp': { type: 'ftp', name: 'FTP' },
  'n8n-nodes-base.ssh': { type: 'sshPassword', name: 'SSH' },
  'n8n-nodes-base.aws': { type: 'aws', name: 'AWS' },
  'n8n-nodes-base.deepL': { type: 'deepLApi', name: 'DeepL' },

  // ========================================
  // AI Agent Tool Nodes (n8n-nodes-base.*Tool)
  // Comprehensive mapping for all 111+ service tools
  // ========================================

  // Langchain Tool Nodes (additional)
  '@n8n/n8n-nodes-langchain.toolWebScraper': { type: 'none', name: 'Web Scraper Tool' },

  // Action/CRM Tools
  'n8n-nodes-base.actionNetworkTool': { type: 'actionNetworkApi', name: 'Action Network Tool' },
  'n8n-nodes-base.activeCampaignTool': { type: 'activeCampaignApi', name: 'ActiveCampaign Tool' },
  'n8n-nodes-base.affinityTool': { type: 'affinityApi', name: 'Affinity Tool' },
  'n8n-nodes-base.agileCrmTool': { type: 'agileCrmApi', name: 'Agile CRM Tool' },

  // API/Dev Tools
  'n8n-nodes-base.apiTemplateTool': { type: 'apiTemplateIoApi', name: 'APITemplate.io Tool' },

  // Productivity Tools
  'n8n-nodes-base.asanaTool': { type: 'asanaOAuth2Api', name: 'Asana Tool' },
  'n8n-nodes-base.clickUpTool': { type: 'clickUpOAuth2Api', name: 'ClickUp Tool' },
  'n8n-nodes-base.todoistTool': { type: 'todoistOAuth2Api', name: 'Todoist Tool' },
  'n8n-nodes-base.trelloTool': { type: 'trelloApi', name: 'Trello Tool' },
  'n8n-nodes-base.mondayTool': { type: 'mondayComOAuth2Api', name: 'Monday.com Tool' },

  // AWS Tools
  'n8n-nodes-base.awsLambdaTool': { type: 'aws', name: 'AWS Lambda Tool' },
  'n8n-nodes-base.awsS3Tool': { type: 'aws', name: 'AWS S3 Tool' },
  'n8n-nodes-base.awsSesTool': { type: 'aws', name: 'AWS SES Tool' },
  'n8n-nodes-base.awsTextractTool': { type: 'aws', name: 'AWS Textract Tool' },
  'n8n-nodes-base.awsTranscribeTool': { type: 'aws', name: 'AWS Transcribe Tool' },
  'n8n-nodes-base.s3Tool': { type: 'aws', name: 'S3 Tool' },

  // Database Tools
  'n8n-nodes-base.baserowTool': { type: 'baserowApi', name: 'Baserow Tool' },
  'n8n-nodes-base.nocoDbTool': { type: 'nocoDbApiToken', name: 'NocoDB Tool' },
  'n8n-nodes-base.mongoDbTool': { type: 'mongoDb', name: 'MongoDB Tool' },
  'n8n-nodes-base.redisTool': { type: 'redis', name: 'Redis Tool' },
  'n8n-nodes-base.elasticsearchTool': { type: 'elasticsearchApi', name: 'Elasticsearch Tool' },
  'n8n-nodes-base.supabaseTool': { type: 'supabaseApi', name: 'Supabase Tool' },
  'n8n-nodes-base.microsoftSqlTool': { type: 'microsoftSql', name: 'Microsoft SQL Tool' },

  // No-Code/Low-Code Platform Tools
  'n8n-nodes-base.bubbleTool': { type: 'bubbleApi', name: 'Bubble Tool' },

  // Utility Tools (no auth needed)
  'n8n-nodes-base.coinGeckoTool': { type: 'none', name: 'CoinGecko Tool' },
  'n8n-nodes-base.compressionTool': { type: 'none', name: 'Compression Tool' },
  'n8n-nodes-base.cryptoTool': { type: 'none', name: 'Crypto Tool' },
  'n8n-nodes-base.hackerNewsTool': { type: 'none', name: 'Hacker News Tool' },
  'n8n-nodes-base.nasaTool': { type: 'none', name: 'NASA Tool' },
  'n8n-nodes-base.quickChartTool': { type: 'none', name: 'QuickChart Tool' },
  'n8n-nodes-base.totpTool': { type: 'none', name: 'TOTP Tool' },
  'n8n-nodes-base.jwtTool': { type: 'none', name: 'JWT Tool' },
  'n8n-nodes-base.gitTool': { type: 'none', name: 'Git Tool' },
  'n8n-nodes-base.graphqlTool': { type: 'none', name: 'GraphQL Tool' },

  // Translation/Language Tools
  'n8n-nodes-base.deepLTool': { type: 'deepLApi', name: 'DeepL' },

  // Shipping/Logistics Tools
  'n8n-nodes-base.dhlTool': { type: 'dhlApi', name: 'DHL Tool' },

  // Cloud Storage Tools
  'n8n-nodes-base.dropboxTool': { type: 'dropboxOAuth2Api', name: 'Dropbox Tool' },
  'n8n-nodes-base.nextcloudTool': { type: 'nextCloudApi', name: 'Nextcloud Tool' },

  // CMS/Publishing Tools
  'n8n-nodes-base.ghostTool': { type: 'ghostAdminApi', name: 'Ghost Tool' },
  'n8n-nodes-base.mediumTool': { type: 'mediumOAuth2Api', name: 'Medium Tool' },
  'n8n-nodes-base.wordpressTool': { type: 'wordpressApi', name: 'WordPress Tool' },
  'n8n-nodes-base.webflowTool': { type: 'webflowOAuth2Api', name: 'Webflow Tool' },

  // ERP/Business Tools
  'n8n-nodes-base.erpNextTool': { type: 'abortsn', name: 'ERPNext Tool' },
  'n8n-nodes-base.odooTool': { type: 'odooApi', name: 'Odoo Tool' },
  'n8n-nodes-base.quickBooksOnlineTool': { type: 'quickBooksOAuth2Api', name: 'QuickBooks Online Tool' },

  // Social/Graph Tools
  'n8n-nodes-base.facebookGraphApiTool': { type: 'facebookGraphApi', name: 'Facebook Graph API Tool' },
  'n8n-nodes-base.linkedInTool': { type: 'linkedInOAuth2Api', name: 'LinkedIn Tool' },
  'n8n-nodes-base.twitterTool': { type: 'twitterOAuth2Api', name: 'Twitter/X Tool' },
  'n8n-nodes-base.redditTool': { type: 'redditOAuth2Api', name: 'Reddit Tool' },

  // Database File Tools
  'n8n-nodes-base.fileMakerTool': { type: 'fileMaker', name: 'FileMaker Tool' },

  // Google Services Tools (additional - Firebase, Workspace)
  'n8n-nodes-base.googleFirestoreTool': { type: 'googleFirebaseCloudFirestoreOAuth2Api', name: 'Google Firestore' },
  'n8n-nodes-base.googleRealtimeDatabaseTool': { type: 'googleFirebaseRealtimeDatabaseOAuth2Api', name: 'Google Realtime Database' },
  'n8n-nodes-base.googleWorkspaceAdminTool': { type: 'gSuiteAdminOAuth2Api', name: 'Google Workspace Admin' },

  // Notification/Alert Tools
  'n8n-nodes-base.gotifyTool': { type: 'gotifyApi', name: 'Gotify Tool' },
  'n8n-nodes-base.pushoverTool': { type: 'pushoverApi', name: 'Pushover Tool' },

  // Monitoring/Infra Tools
  'n8n-nodes-base.grafanaTool': { type: 'grafanaApi', name: 'Grafana Tool' },
  'n8n-nodes-base.jenkinsTool': { type: 'jenkinsApi', name: 'Jenkins Tool' },

  // Smart Home Tools
  'n8n-nodes-base.homeAssistantTool': { type: 'homeAssistantApi', name: 'Home Assistant Tool' },

  // CRM/Marketing Tools
  'n8n-nodes-base.hubspotTool': { type: 'hubspotOAuth2Api', name: 'HubSpot Tool' },
  'n8n-nodes-base.pipedriveTool': { type: 'pipedriveOAuth2Api', name: 'Pipedrive Tool' },
  'n8n-nodes-base.salesforceTool': { type: 'salesforceOAuth2Api', name: 'Salesforce Tool' },
  'n8n-nodes-base.zohoCrmTool': { type: 'zohoOAuth2Api', name: 'Zoho CRM Tool' },
  'n8n-nodes-base.mauticTool': { type: 'mauticApi', name: 'Mautic Tool' },

  // Message Queue Tools
  'n8n-nodes-base.kafkaTool': { type: 'kafka', name: 'Kafka Tool' },
  'n8n-nodes-base.mqttTool': { type: 'mqtt', name: 'MQTT Tool' },
  'n8n-nodes-base.rabbitMqTool': { type: 'rabbitmq', name: 'RabbitMQ Tool' },

  // Directory/Auth Tools
  'n8n-nodes-base.ldapTool': { type: 'ldap', name: 'LDAP Tool' },

  // Messaging Tools
  'n8n-nodes-base.lineTool': { type: 'lineNotifyOAuth2Api', name: 'LINE Tool' },
  'n8n-nodes-base.mattermostTool': { type: 'mattermostApi', name: 'Mattermost Tool' },
  'n8n-nodes-base.rocketChatTool': { type: 'rocketchatApi', name: 'Rocket.Chat Tool' },

  // Email Tools
  'n8n-nodes-base.mailcheckTool': { type: 'mailcheckApi', name: 'Mailcheck Tool' },
  'n8n-nodes-base.mailgunTool': { type: 'mailgunApi', name: 'Mailgun Tool' },
  'n8n-nodes-base.sendGridTool': { type: 'sendGridApi', name: 'SendGrid Tool' },
  'n8n-nodes-base.emailSendTool': { type: 'smtp', name: 'Email Send Tool' },

  // Microsoft Tools
  'n8n-nodes-base.microsoftExcelTool': { type: 'microsoftExcelOAuth2Api', name: 'Microsoft Excel Tool' },
  'n8n-nodes-base.microsoftOneDriveTool': { type: 'microsoftOneDriveOAuth2Api', name: 'Microsoft OneDrive Tool' },
  'n8n-nodes-base.microsoftOutlookTool': { type: 'microsoftOutlookOAuth2Api', name: 'Microsoft Outlook Tool' },
  'n8n-nodes-base.microsoftTeamsTool': { type: 'microsoftTeamsOAuth2Api', name: 'Microsoft Teams Tool' },
  'n8n-nodes-base.microsoftToDoTool': { type: 'microsoftToDoOAuth2Api', name: 'Microsoft To Do Tool' },

  // Weather/Data Tools
  'n8n-nodes-base.openWeatherMapTool': { type: 'openWeatherMapApi', name: 'OpenWeatherMap Tool' },

  // E-commerce Tools
  'n8n-nodes-base.shopifyTool': { type: 'shopifyOAuth2Api', name: 'Shopify Tool' },
  'n8n-nodes-base.wooCommerceTool': { type: 'wooCommerceApi', name: 'WooCommerce Tool' },
  'n8n-nodes-base.stripeTool': { type: 'stripeApi', name: 'Stripe Tool' },

  // Music/Media Tools
  'n8n-nodes-base.spotifyTool': { type: 'spotifyOAuth2Api', name: 'Spotify Tool' },
  'n8n-nodes-base.youtubeTool': { type: 'youTubeOAuth2Api', name: 'YouTube Tool' },

  // Communication Tools (additional)
  'n8n-nodes-base.twilioTool': { type: 'twilioApi', name: 'Twilio Tool' },

  // Security/URL Tools
  'n8n-nodes-base.urlscanTool': { type: 'urlScanIoApi', name: 'urlscan.io Tool' },

  // Support Tools
  'n8n-nodes-base.zendeskTool': { type: 'zendeskApi', name: 'Zendesk Tool' },

  // Video Conferencing Tools
  'n8n-nodes-base.zoomTool': { type: 'zoomOAuth2Api', name: 'Zoom Tool' },

  // ========================================
  // Additional Regular Nodes (missing)
  // ========================================

  // Microsoft Regular Nodes
  'n8n-nodes-base.microsoftExcel': { type: 'microsoftExcelOAuth2Api', name: 'Microsoft Excel' },
  'n8n-nodes-base.microsoftOneDrive': { type: 'microsoftOneDriveOAuth2Api', name: 'Microsoft OneDrive' },
  'n8n-nodes-base.microsoftOneDriveTrigger': { type: 'microsoftOneDriveOAuth2Api', name: 'Microsoft OneDrive' },
  'n8n-nodes-base.microsoftOutlook': { type: 'microsoftOutlookOAuth2Api', name: 'Microsoft Outlook' },
  'n8n-nodes-base.microsoftOutlookTrigger': { type: 'microsoftOutlookOAuth2Api', name: 'Microsoft Outlook' },
  'n8n-nodes-base.microsoftTeams': { type: 'microsoftTeamsOAuth2Api', name: 'Microsoft Teams' },
  'n8n-nodes-base.microsoftTeamsTrigger': { type: 'microsoftTeamsOAuth2Api', name: 'Microsoft Teams' },
  'n8n-nodes-base.microsoftToDo': { type: 'microsoftToDoOAuth2Api', name: 'Microsoft To Do' },
  'n8n-nodes-base.microsoftSharePoint': { type: 'microsoftSharePointOAuth2Api', name: 'Microsoft SharePoint' },
  'n8n-nodes-base.microsoftDynamicsCrm': { type: 'microsoftDynamicsOAuth2Api', name: 'Microsoft Dynamics CRM' },
  'n8n-nodes-base.microsoftEntra': { type: 'microsoftEntraOAuth2Api', name: 'Microsoft Entra' },

  // Additional Google Nodes (unique ones not defined above)
  'n8n-nodes-base.googleBooks': { type: 'googleBooksOAuth2Api', name: 'Google Books' },
  'n8n-nodes-base.googleBusinessProfile': { type: 'googleBusinessProfileOAuth2Api', name: 'Google Business Profile' },
  'n8n-nodes-base.googleBusinessProfileTrigger': { type: 'googleBusinessProfileOAuth2Api', name: 'Google Business Profile' },
  'n8n-nodes-base.googleCloudNaturalLanguage': { type: 'googleCloudNaturalLanguageOAuth2Api', name: 'Google Cloud Natural Language' },
  'n8n-nodes-base.googleCloudStorage': { type: 'googleCloudStorageOAuth2Api', name: 'Google Cloud Storage' },
  'n8n-nodes-base.googleFirebaseCloudFirestore': { type: 'googleFirebaseCloudFirestoreOAuth2Api', name: 'Google Firebase Firestore' },
  'n8n-nodes-base.googleFirebaseRealtimeDatabase': { type: 'googleFirebaseRealtimeDatabaseOAuth2Api', name: 'Google Firebase Realtime Database' },
  'n8n-nodes-base.googlePerspective': { type: 'googlePerspectiveOAuth2Api', name: 'Google Perspective' },
  'n8n-nodes-base.gSuiteAdmin': { type: 'gSuiteAdminOAuth2Api', name: 'Google Workspace Admin' },

  // Additional Social Media
  'n8n-nodes-base.reddit': { type: 'redditOAuth2Api', name: 'Reddit' },
  'n8n-nodes-base.youtube': { type: 'youTubeOAuth2Api', name: 'YouTube' },
  'n8n-nodes-base.youTube': { type: 'youTubeOAuth2Api', name: 'YouTube' },
  'n8n-nodes-base.spotify': { type: 'spotifyOAuth2Api', name: 'Spotify' },

  // Additional Messaging
  'n8n-nodes-base.line': { type: 'lineNotifyOAuth2Api', name: 'LINE' },
  'n8n-nodes-base.mattermost': { type: 'mattermostApi', name: 'Mattermost' },
  'n8n-nodes-base.rocketchat': { type: 'rocketchatApi', name: 'Rocket.Chat' },
  'n8n-nodes-base.matrix': { type: 'matrixApi', name: 'Matrix' },
  'n8n-nodes-base.zulip': { type: 'zulipApi', name: 'Zulip' },

  // Additional Databases/Storage
  'n8n-nodes-base.baserow': { type: 'baserowApi', name: 'Baserow' },
  'n8n-nodes-base.nocoDb': { type: 'nocoDbApiToken', name: 'NocoDB' },
  'n8n-nodes-base.grist': { type: 'gristApi', name: 'Grist' },
  'n8n-nodes-base.seaTable': { type: 'seaTableApi', name: 'SeaTable' },
  'n8n-nodes-base.seaTableTrigger': { type: 'seaTableApi', name: 'SeaTable' },
  'n8n-nodes-base.snowflake': { type: 'snowflake', name: 'Snowflake' },
  'n8n-nodes-base.elasticsearch': { type: 'elasticsearchApi', name: 'Elasticsearch' },
  'n8n-nodes-base.timescaleDb': { type: 'postgres', name: 'TimescaleDB' },
  'n8n-nodes-base.questDb': { type: 'questDb', name: 'QuestDB' },
  'n8n-nodes-base.crateDb': { type: 'crateDb', name: 'CrateDB' },

  // Additional CRM/Marketing
  'n8n-nodes-base.zohoCrm': { type: 'zohoOAuth2Api', name: 'Zoho CRM' },
  'n8n-nodes-base.mautic': { type: 'mauticApi', name: 'Mautic' },
  'n8n-nodes-base.mauticTrigger': { type: 'mauticApi', name: 'Mautic' },
  'n8n-nodes-base.keap': { type: 'keapOAuth2Api', name: 'Keap' },
  'n8n-nodes-base.keapTrigger': { type: 'keapOAuth2Api', name: 'Keap' },
  'n8n-nodes-base.copper': { type: 'copperApi', name: 'Copper' },
  'n8n-nodes-base.copperTrigger': { type: 'copperApi', name: 'Copper' },
  'n8n-nodes-base.drift': { type: 'driftOAuth2Api', name: 'Drift' },
  'n8n-nodes-base.affinity': { type: 'affinityApi', name: 'Affinity' },
  'n8n-nodes-base.affinityTrigger': { type: 'affinityApi', name: 'Affinity' },
  'n8n-nodes-base.agileCrm': { type: 'agileCrmApi', name: 'Agile CRM' },
  'n8n-nodes-base.freshworksCrm': { type: 'freshworksCrmApi', name: 'Freshworks CRM' },
  'n8n-nodes-base.monicaCrm': { type: 'monicaCrmApi', name: 'Monica CRM' },

  // Email Marketing
  'n8n-nodes-base.mailchimpTrigger': { type: 'mailchimpOAuth2Api', name: 'Mailchimp' },
  'n8n-nodes-base.mailerLite': { type: 'mailerLiteApi', name: 'MailerLite' },
  'n8n-nodes-base.mailerLiteTrigger': { type: 'mailerLiteApi', name: 'MailerLite' },
  'n8n-nodes-base.mailjet': { type: 'mailjetEmailApi', name: 'Mailjet' },
  'n8n-nodes-base.mailjetTrigger': { type: 'mailjetEmailApi', name: 'Mailjet' },
  'n8n-nodes-base.mailgun': { type: 'mailgunApi', name: 'Mailgun' },
  'n8n-nodes-base.convertKit': { type: 'convertKitApi', name: 'ConvertKit' },
  'n8n-nodes-base.convertKitTrigger': { type: 'convertKitApi', name: 'ConvertKit' },
  'n8n-nodes-base.lemlist': { type: 'lemlistApi', name: 'Lemlist' },
  'n8n-nodes-base.lemlistTrigger': { type: 'lemlistApi', name: 'Lemlist' },
  'n8n-nodes-base.brevo': { type: 'brevoApi', name: 'Brevo' },
  'n8n-nodes-base.brevoTrigger': { type: 'brevoApi', name: 'Brevo' },

  // E-commerce (additional)
  'n8n-nodes-base.magento2': { type: 'magento2Api', name: 'Magento 2' },
  'n8n-nodes-base.payPal': { type: 'payPalApi', name: 'PayPal' },
  'n8n-nodes-base.payPalTrigger': { type: 'payPalApi', name: 'PayPal' },
  'n8n-nodes-base.chargebee': { type: 'chargebeeApi', name: 'Chargebee' },
  'n8n-nodes-base.chargebeeTrigger': { type: 'chargebeeApi', name: 'Chargebee' },
  'n8n-nodes-base.paddle': { type: 'paddleApi', name: 'Paddle' },
  'n8n-nodes-base.gumroadTrigger': { type: 'gumroadApi', name: 'Gumroad' },

  // Video Conferencing
  'n8n-nodes-base.zoom': { type: 'zoomOAuth2Api', name: 'Zoom' },
  'n8n-nodes-base.goToWebinar': { type: 'goToWebinarOAuth2Api', name: 'GoToWebinar' },
  'n8n-nodes-base.ciscoWebex': { type: 'ciscoWebexOAuth2Api', name: 'Cisco Webex' },
  'n8n-nodes-base.ciscoWebexTrigger': { type: 'ciscoWebexOAuth2Api', name: 'Cisco Webex' },

  // Cloud Platforms
  'n8n-nodes-base.awsS3': { type: 'aws', name: 'AWS S3' },
  'n8n-nodes-base.awsLambda': { type: 'aws', name: 'AWS Lambda' },
  'n8n-nodes-base.awsSes': { type: 'aws', name: 'AWS SES' },
  'n8n-nodes-base.awsSns': { type: 'aws', name: 'AWS SNS' },
  'n8n-nodes-base.awsSnsTrigger': { type: 'aws', name: 'AWS SNS' },
  'n8n-nodes-base.awsSqs': { type: 'aws', name: 'AWS SQS' },
  'n8n-nodes-base.awsDynamoDb': { type: 'aws', name: 'AWS DynamoDB' },
  'n8n-nodes-base.awsTextract': { type: 'aws', name: 'AWS Textract' },
  'n8n-nodes-base.awsTranscribe': { type: 'aws', name: 'AWS Transcribe' },
  'n8n-nodes-base.awsRekognition': { type: 'aws', name: 'AWS Rekognition' },
  'n8n-nodes-base.awsComprehend': { type: 'aws', name: 'AWS Comprehend' },
  'n8n-nodes-base.awsCertificateManager': { type: 'aws', name: 'AWS Certificate Manager' },
  'n8n-nodes-base.awsCognito': { type: 'aws', name: 'AWS Cognito' },
  'n8n-nodes-base.awsElb': { type: 'aws', name: 'AWS ELB' },
  'n8n-nodes-base.awsiam': { type: 'aws', name: 'AWS IAM' },
  'n8n-nodes-base.azureCosmosDb': { type: 'azureCosmosDbSharedKeyApi', name: 'Azure Cosmos DB' },
  'n8n-nodes-base.azureStorage': { type: 'azureStorageApi', name: 'Azure Storage' },

  // CI/CD and DevOps
  'n8n-nodes-base.jenkins': { type: 'jenkinsApi', name: 'Jenkins' },
  'n8n-nodes-base.circleCi': { type: 'circleCiApi', name: 'CircleCI' },
  'n8n-nodes-base.travisCi': { type: 'travisCiApi', name: 'Travis CI' },
  'n8n-nodes-base.bitbucketTrigger': { type: 'bitbucketApi', name: 'Bitbucket' },
  'n8n-nodes-base.netlify': { type: 'netlifyApi', name: 'Netlify' },
  'n8n-nodes-base.netlifyTrigger': { type: 'netlifyApi', name: 'Netlify' },

  // Support/Helpdesk
  'n8n-nodes-base.helpScout': { type: 'helpScoutOAuth2Api', name: 'Help Scout' },
  'n8n-nodes-base.helpScoutTrigger': { type: 'helpScoutOAuth2Api', name: 'Help Scout' },
  'n8n-nodes-base.freshservice': { type: 'freshserviceApi', name: 'Freshservice' },
  'n8n-nodes-base.serviceNow': { type: 'serviceNowOAuth2Api', name: 'ServiceNow' },
  'n8n-nodes-base.zammad': { type: 'zammadApi', name: 'Zammad' },

  // Project Management (additional)
  'n8n-nodes-base.linearTrigger': { type: 'linearApi', name: 'Linear' },
  'n8n-nodes-base.jiraTrigger': { type: 'jiraSoftwareCloudApi', name: 'Jira' },
  'n8n-nodes-base.asanaTrigger': { type: 'asanaOAuth2Api', name: 'Asana' },
  'n8n-nodes-base.clickUpTrigger': { type: 'clickUpOAuth2Api', name: 'ClickUp' },
  'n8n-nodes-base.trelloTrigger': { type: 'trelloApi', name: 'Trello' },
  'n8n-nodes-base.mondayCom': { type: 'mondayComOAuth2Api', name: 'Monday.com' },
  'n8n-nodes-base.taiga': { type: 'taigaApi', name: 'Taiga' },
  'n8n-nodes-base.taigaTrigger': { type: 'taigaApi', name: 'Taiga' },
  'n8n-nodes-base.kitemaker': { type: 'kitemakerApi', name: 'Kitemaker' },
  'n8n-nodes-base.wekan': { type: 'wekanApi', name: 'Wekan' },

  // Misc Cloud Services
  'n8n-nodes-base.cloudflare': { type: 'cloudflareApi', name: 'Cloudflare' },
  'n8n-nodes-base.nextCloud': { type: 'nextCloudApi', name: 'Nextcloud' },
  'n8n-nodes-base.webflow': { type: 'webflowOAuth2Api', name: 'Webflow' },
  'n8n-nodes-base.webflowTrigger': { type: 'webflowOAuth2Api', name: 'Webflow' },
  'n8n-nodes-base.contentful': { type: 'contentfulApi', name: 'Contentful' },
  'n8n-nodes-base.storyblok': { type: 'storyblokApi', name: 'Storyblok' },
  'n8n-nodes-base.strapi': { type: 'strapiApi', name: 'Strapi' },
  'n8n-nodes-base.ghost': { type: 'ghostAdminApi', name: 'Ghost' },
  'n8n-nodes-base.cockpit': { type: 'cockpitApi', name: 'Cockpit' },
  'n8n-nodes-base.coda': { type: 'codaApi', name: 'Coda' },
  'n8n-nodes-base.bubble': { type: 'bubbleApi', name: 'Bubble' },
  'n8n-nodes-base.xero': { type: 'xeroOAuth2Api', name: 'Xero' },
  'n8n-nodes-base.quickbooks': { type: 'quickBooksOAuth2Api', name: 'QuickBooks' },
  'n8n-nodes-base.wise': { type: 'wiseApi', name: 'Wise' },
  'n8n-nodes-base.wiseTrigger': { type: 'wiseApi', name: 'Wise' },

  // Form/Survey Tools
  'n8n-nodes-base.typeformTrigger': { type: 'typeformOAuth2Api', name: 'Typeform' },
  'n8n-nodes-base.jotFormTrigger': { type: 'jotFormApi', name: 'JotForm' },
  'n8n-nodes-base.formstackTrigger': { type: 'formstackApi', name: 'Formstack' },
  'n8n-nodes-base.surveyMonkeyTrigger': { type: 'surveyMonkeyOAuth2Api', name: 'SurveyMonkey' },
  'n8n-nodes-base.koBoToolbox': { type: 'koBoToolboxApi', name: 'KoBoToolbox' },
  'n8n-nodes-base.koBoToolboxTrigger': { type: 'koBoToolboxApi', name: 'KoBoToolbox' },
  'n8n-nodes-base.calendlyTrigger': { type: 'calendlyApi', name: 'Calendly' },
  'n8n-nodes-base.calTrigger': { type: 'calApi', name: 'Cal.com' },
  'n8n-nodes-base.acuitySchedulingTrigger': { type: 'acuitySchedulingApi', name: 'Acuity Scheduling' },

  // Message Queues
  'n8n-nodes-base.kafka': { type: 'kafka', name: 'Kafka' },
  'n8n-nodes-base.kafkaTrigger': { type: 'kafka', name: 'Kafka' },
  'n8n-nodes-base.rabbitmq': { type: 'rabbitmq', name: 'RabbitMQ' },
  'n8n-nodes-base.rabbitmqTrigger': { type: 'rabbitmq', name: 'RabbitMQ' },
  'n8n-nodes-base.amqp': { type: 'amqp', name: 'AMQP' },
  'n8n-nodes-base.amqpTrigger': { type: 'amqp', name: 'AMQP' },
  'n8n-nodes-base.mqtt': { type: 'mqtt', name: 'MQTT' },
  'n8n-nodes-base.mqttTrigger': { type: 'mqtt', name: 'MQTT' },
  'n8n-nodes-base.redisTrigger': { type: 'redis', name: 'Redis' },

  // Analytics/Monitoring
  'n8n-nodes-base.grafana': { type: 'grafanaApi', name: 'Grafana' },
  'n8n-nodes-base.postHog': { type: 'postHogApi', name: 'PostHog' },
  'n8n-nodes-base.segment': { type: 'segmentApi', name: 'Segment' },
  'n8n-nodes-base.metabase': { type: 'metabaseApi', name: 'Metabase' },
  'n8n-nodes-base.sentryIo': { type: 'sentryIoOAuth2Api', name: 'Sentry' },
  'n8n-nodes-base.splunk': { type: 'splunkApi', name: 'Splunk' },
  'n8n-nodes-base.pagerDuty': { type: 'pagerDutyApi', name: 'PagerDuty' },
  'n8n-nodes-base.uptimeRobot': { type: 'uptimeRobotApi', name: 'UptimeRobot' },

  // AI Services (additional)
  'n8n-nodes-base.mistralAi': { type: 'mistralCloudApi', name: 'Mistral AI' },
  'n8n-nodes-base.perplexity': { type: 'perplexityApi', name: 'Perplexity' },
  'n8n-nodes-base.jinaAi': { type: 'jinaAiApi', name: 'Jina AI' },
  'n8n-nodes-base.humanticAi': { type: 'humanticAiApi', name: 'Humantic AI' },
  'n8n-nodes-base.mindee': { type: 'mindeeReceiptApi', name: 'Mindee' },

  // Miscellaneous Services
  'n8n-nodes-base.toggl': { type: 'togglApi', name: 'Toggl' },
  'n8n-nodes-base.togglTrigger': { type: 'togglApi', name: 'Toggl' },
  'n8n-nodes-base.harvest': { type: 'harvestApi', name: 'Harvest' },
  'n8n-nodes-base.clockify': { type: 'clockifyApi', name: 'Clockify' },
  'n8n-nodes-base.clockifyTrigger': { type: 'clockifyApi', name: 'Clockify' },
  'n8n-nodes-base.strava': { type: 'stravaOAuth2Api', name: 'Strava' },
  'n8n-nodes-base.stravaTrigger': { type: 'stravaOAuth2Api', name: 'Strava' },
  'n8n-nodes-base.oura': { type: 'ouraApi', name: 'Oura' },
  'n8n-nodes-base.beeminder': { type: 'beeminderApi', name: 'Beeminder' },
  'n8n-nodes-base.orbit': { type: 'orbitApi', name: 'Orbit' },
  'n8n-nodes-base.raindrop': { type: 'raindropApi', name: 'Raindrop' },
  'n8n-nodes-base.pushcut': { type: 'pushcutApi', name: 'Pushcut' },
  'n8n-nodes-base.pushcutTrigger': { type: 'pushcutApi', name: 'Pushcut' },
  'n8n-nodes-base.pushbullet': { type: 'pushbulletOAuth2Api', name: 'Pushbullet' },
  'n8n-nodes-base.gotify': { type: 'gotifyApi', name: 'Gotify' },
  'n8n-nodes-base.spontit': { type: 'spontitApi', name: 'Spontit' },
  'n8n-nodes-base.pushover': { type: 'pushoverApi', name: 'Pushover' },
  'n8n-nodes-base.signl4': { type: 'signl4Api', name: 'SIGNL4' },
  'n8n-nodes-base.demio': { type: 'demioApi', name: 'Demio' },
  'n8n-nodes-base.eventbriteTrigger': { type: 'eventbriteApi', name: 'Eventbrite' },
  'n8n-nodes-base.gong': { type: 'gongApi', name: 'Gong' },

  // SMS/Phone
  'n8n-nodes-base.vonage': { type: 'vonageApi', name: 'Vonage' },
  'n8n-nodes-base.twilioTrigger': { type: 'twilioApi', name: 'Twilio' },
  'n8n-nodes-base.plivo': { type: 'plivoApi', name: 'Plivo' },
  'n8n-nodes-base.messageBird': { type: 'messageBirdApi', name: 'MessageBird' },
  'n8n-nodes-base.sms77': { type: 'sms77Api', name: 'SMS77' },
  'n8n-nodes-base.msg91': { type: 'msg91Api', name: 'MSG91' },
  'n8n-nodes-base.mocean': { type: 'moceanApi', name: 'Mocean' },

  // Data/Enrichment
  'n8n-nodes-base.clearbit': { type: 'clearbitApi', name: 'Clearbit' },
  'n8n-nodes-base.hunter': { type: 'hunterApi', name: 'Hunter' },
  'n8n-nodes-base.uplead': { type: 'upleadApi', name: 'UpLead' },
  'n8n-nodes-base.dropcontact': { type: 'dropcontactApi', name: 'Dropcontact' },
  'n8n-nodes-base.peekalink': { type: 'peekalinkApi', name: 'Peekalink' },
  'n8n-nodes-base.phantombuster': { type: 'phantombusterApi', name: 'Phantombuster' },
  'n8n-nodes-base.disqus': { type: 'disqusApi', name: 'Disqus' },

  // No Auth Utility Nodes
  'n8n-nodes-base.openWeatherMap': { type: 'openWeatherMapApi', name: 'OpenWeatherMap' },
  'n8n-nodes-base.nasa': { type: 'none', name: 'NASA' },
  'n8n-nodes-base.coinGecko': { type: 'none', name: 'CoinGecko' },
  'n8n-nodes-base.hackerNews': { type: 'none', name: 'Hacker News' },
  'n8n-nodes-base.openThesaurus': { type: 'none', name: 'OpenThesaurus' },
  'n8n-nodes-base.oneSimpleApi': { type: 'oneSimpleApi', name: 'One Simple API' },
  'n8n-nodes-base.marketstack': { type: 'marketstackApi', name: 'Marketstack' },
  'n8n-nodes-base.profitWell': { type: 'profitWellApi', name: 'ProfitWell' },

  // Security
  'n8n-nodes-base.bitwarden': { type: 'bitwardenApi', name: 'Bitwarden' },
  'n8n-nodes-base.ldap': { type: 'ldap', name: 'LDAP' },
  'n8n-nodes-base.okta': { type: 'oktaApi', name: 'Okta' },
  'n8n-nodes-base.misp': { type: 'mispApi', name: 'MISP' },
  'n8n-nodes-base.cortex': { type: 'cortexApi', name: 'Cortex' },
  'n8n-nodes-base.theHive': { type: 'theHiveApi', name: 'TheHive' },
  'n8n-nodes-base.theHiveProject': { type: 'theHiveProjectApi', name: 'TheHive Project' },
  'n8n-nodes-base.theHiveProjectTrigger': { type: 'theHiveProjectApi', name: 'TheHive Project' },
  'n8n-nodes-base.theHiveTrigger': { type: 'theHiveApi', name: 'TheHive' },
  'n8n-nodes-base.elasticSecurity': { type: 'elasticsearchApi', name: 'Elastic Security' },
  'n8n-nodes-base.securityScorecard': { type: 'securityScorecardApi', name: 'SecurityScorecard' },
  'n8n-nodes-base.venafiTlsProtectCloud': { type: 'venafiTlsProtectCloudApi', name: 'Venafi TLS Protect Cloud' },
  'n8n-nodes-base.venafiTlsProtectCloudTrigger': { type: 'venafiTlsProtectCloudApi', name: 'Venafi TLS Protect Cloud' },
  'n8n-nodes-base.venafiTlsProtectDatacenter': { type: 'venafiTlsProtectDatacenterApi', name: 'Venafi TLS Protect Datacenter' },
  'n8n-nodes-base.urlScanIo': { type: 'urlScanIoApi', name: 'urlscan.io' },

  // IoT/Smart Home
  'n8n-nodes-base.homeAssistant': { type: 'homeAssistantApi', name: 'Home Assistant' },
  'n8n-nodes-base.philipsHue': { type: 'philipsHueOAuth2Api', name: 'Philips Hue' },

  // Automation/Integration
  'n8n-nodes-base.onfleet': { type: 'onfleetApi', name: 'Onfleet' },
  'n8n-nodes-base.onfleetTrigger': { type: 'onfleetApi', name: 'Onfleet' },
  'n8n-nodes-base.workableTrigger': { type: 'workableApi', name: 'Workable' },
  'n8n-nodes-base.lonescale': { type: 'lonescaleApi', name: 'Lonescale' },
  'n8n-nodes-base.lonescaleTrigger': { type: 'lonescaleApi', name: 'Lonescale' },
  'n8n-nodes-base.wufooTrigger': { type: 'wufooApi', name: 'Wufoo' },
  'n8n-nodes-base.autopilot': { type: 'autopilotApi', name: 'Autopilot' },
  'n8n-nodes-base.autopilotTrigger': { type: 'autopilotApi', name: 'Autopilot' },
  'n8n-nodes-base.customerIo': { type: 'customerIoApi', name: 'Customer.io' },
  'n8n-nodes-base.customerIoTrigger': { type: 'customerIoApi', name: 'Customer.io' },
  'n8n-nodes-base.getResponse': { type: 'getResponseApi', name: 'GetResponse' },
  'n8n-nodes-base.getResponseTrigger': { type: 'getResponseApi', name: 'GetResponse' },
  'n8n-nodes-base.iterable': { type: 'iterableApi', name: 'Iterable' },
  'n8n-nodes-base.vero': { type: 'veroApi', name: 'Vero' },
  'n8n-nodes-base.automizy': { type: 'automizyApi', name: 'Automizy' },
  'n8n-nodes-base.egoi': { type: 'egoiApi', name: 'E-goi' },
  'n8n-nodes-base.sendy': { type: 'sendyApi', name: 'Sendy' },
  'n8n-nodes-base.emelia': { type: 'emeliaApi', name: 'Emelia' },
  'n8n-nodes-base.emeliaTrigger': { type: 'emeliaApi', name: 'Emelia' },
  'n8n-nodes-base.tapfiliate': { type: 'tapfiliateApi', name: 'Tapfiliate' },
  'n8n-nodes-base.crowdDev': { type: 'crowdDevApi', name: 'crowd.dev' },
  'n8n-nodes-base.crowdDevTrigger': { type: 'crowdDevApi', name: 'crowd.dev' },
  'n8n-nodes-base.flow': { type: 'flowApi', name: 'Flow' },
  'n8n-nodes-base.flowTrigger': { type: 'flowApi', name: 'Flow' },
  'n8n-nodes-base.invoiceNinja': { type: 'invoiceNinjaApi', name: 'Invoice Ninja' },
  'n8n-nodes-base.invoiceNinjaTrigger': { type: 'invoiceNinjaApi', name: 'Invoice Ninja' },
  'n8n-nodes-base.unleashedSoftware': { type: 'unleashedSoftwareApi', name: 'Unleashed Software' },
  'n8n-nodes-base.salesmate': { type: 'salesmateApi', name: 'Salesmate' },
  'n8n-nodes-base.syncroMsp': { type: 'syncroMspApi', name: 'SyncroMSP' },
  'n8n-nodes-base.haloPSA': { type: 'haloPSAApi', name: 'HaloPSA' },
  'n8n-nodes-base.stackby': { type: 'stackbyApi', name: 'Stackby' },
  'n8n-nodes-base.quickbase': { type: 'quickbaseApi', name: 'Quickbase' },
  'n8n-nodes-base.adalo': { type: 'adaloApi', name: 'Adalo' },
  'n8n-nodes-base.apiTemplateIo': { type: 'apiTemplateIoApi', name: 'APITemplate.io' },
  'n8n-nodes-base.bannerbear': { type: 'bannerbearApi', name: 'Bannerbear' },
  'n8n-nodes-base.bitly': { type: 'bitlyApi', name: 'Bitly' },
  'n8n-nodes-base.yourls': { type: 'yourlsApi', name: 'YOURLS' },
  'n8n-nodes-base.discourse': { type: 'discourseApi', name: 'Discourse' },
  'n8n-nodes-base.twist': { type: 'twistOAuth2Api', name: 'Twist' },
  'n8n-nodes-base.twake': { type: 'twakeCloudApi', name: 'Twake' },
  'n8n-nodes-base.figmaTrigger': { type: 'figmaApi', name: 'Figma' },
  'n8n-nodes-base.facebookTrigger': { type: 'facebookGraphApi', name: 'Facebook' },
  'n8n-nodes-base.facebookLeadAdsTrigger': { type: 'facebookLeadAdsOAuth2Api', name: 'Facebook Lead Ads' },
  'n8n-nodes-base.odoo': { type: 'odooApi', name: 'Odoo' },
  'n8n-nodes-base.erpNext': { type: 'erpNextApi', name: 'ERPNext' },
  'n8n-nodes-base.dhl': { type: 'dhlApi', name: 'DHL' },
  'n8n-nodes-base.mandrill': { type: 'mandrillApi', name: 'Mandrill' },
  'n8n-nodes-base.postmarkTrigger': { type: 'postmarkApi', name: 'Postmark' },
  'n8n-nodes-base.lingvaNex': { type: 'lingvaNexApi', name: 'LingvaNex' },
  'n8n-nodes-base.medium': { type: 'mediumOAuth2Api', name: 'Medium' },
  'n8n-nodes-base.wordpress': { type: 'wordpressApi', name: 'WordPress' },
  'n8n-nodes-base.actionNetwork': { type: 'actionNetworkApi', name: 'Action Network' },
  'n8n-nodes-base.activeCampaignTrigger': { type: 'activeCampaignApi', name: 'ActiveCampaign' },
  'n8n-nodes-base.rundeck': { type: 'rundeckApi', name: 'Rundeck' },
  'n8n-nodes-base.n8n': { type: 'n8nApi', name: 'n8n' },
  'n8n-nodes-base.n8nTrigger': { type: 'n8nApi', name: 'n8n' },
  'n8n-nodes-base.netscalerAdc': { type: 'citrixAdcApi', name: 'Citrix ADC' },
  'n8n-nodes-base.uproc': { type: 'uprocApi', name: 'uProc' },
  'n8n-nodes-base.whatsAppTrigger': { type: 'whatsAppBusinessCloudApi', name: 'WhatsApp' },
  'n8n-nodes-base.formIoTrigger': { type: 'formIoApi', name: 'Form.io' },
  'n8n-nodes-base.highLevel': { type: 'highLevelApi', name: 'HighLevel' },
  'n8n-nodes-base.airtop': { type: 'airtopApi', name: 'Airtop' },
  'n8n-nodes-base.emailReadImap': { type: 'imap', name: 'IMAP' },
  'n8n-nodes-base.emailSend': { type: 'smtp', name: 'SMTP' },
  'n8n-nodes-base.git': { type: 'none', name: 'Git' },
  'n8n-nodes-base.quickChart': { type: 'none', name: 'QuickChart' },
  'n8n-nodes-base.graphql': { type: 'none', name: 'GraphQL' },
};

/**
 * Extract required credentials from workflow nodes
 * Since n8n Public API doesn't expose credentials, we infer from node types
 */
function extractWorkflowCredentials(
  nodes: any[],
  workflowName?: string,
  nodeTypeCredentials?: Map<string, NodeTypeCredential[]>
): Array<{ type: string; name: string }> {
  const credMap = new Map<string, string>();
  const nodeTypes: string[] = [];

  for (const node of nodes || []) {
    const nodeType = node.type;
    if (!nodeType) continue;

    nodeTypes.push(nodeType);

    // Method 1: Check direct mapping first (known node types)
    const mapping = NODE_TYPE_CREDENTIALS[nodeType];
    if (mapping && mapping.type !== 'none') {
      if (!credMap.has(mapping.type)) {
        credMap.set(mapping.type, mapping.name);
      }
      // Don't continue - also check actual credentials object below
    }

    // Method 2: Check node's actual credentials object
    // This detects community nodes and any nodes not in our mappings
    // When a node requires credentials, n8n stores the credential type as a key
    if (node.credentials && typeof node.credentials === 'object') {
      for (const credType of Object.keys(node.credentials)) {
        if (!credMap.has(credType)) {
          // Try to find a friendly name from our mappings
          const { CREDENTIAL_MAPPINGS } = require('./n8n/credentialExtractor') as {
            CREDENTIAL_MAPPINGS: Record<string, { type: string; name: string; icon: string }>
          };
          const knownCred = Object.values(CREDENTIAL_MAPPINGS).find(m => m.type === credType);
          const friendlyName = knownCred?.name || formatCredentialTypeName(credType);
          credMap.set(credType, friendlyName);
        }
      }
    }

    // Method 3: Check n8n's node type definitions (for community nodes without credentials configured yet)
    // This catches nodes that require credentials but haven't been configured
    if (nodeTypeCredentials && !mapping) {
      const nodeCredReqs = nodeTypeCredentials.get(nodeType);
      if (nodeCredReqs && nodeCredReqs.length > 0) {
        for (const credReq of nodeCredReqs) {
          if (!credMap.has(credReq.name)) {
            const friendlyName = credReq.displayName || formatCredentialTypeName(credReq.name);
            credMap.set(credReq.name, friendlyName);
            console.log(`[extractCreds] Found credential ${credReq.name} from n8n node type definition for ${nodeType}`);
          }
        }
      }
    }

    // Method 4: Try to infer from node type name (fallback for unmapped nodes without credentials object)
    // e.g., 'n8n-nodes-base.linkedIn' -> 'linkedin'
    if (!mapping && !nodeTypeCredentials?.has(nodeType)) {
      const typeParts = nodeType.split('.');
      const nodeName = typeParts[typeParts.length - 1]?.toLowerCase();

      if (nodeName) {
        // Skip trigger nodes and utility nodes that don't need credentials
        if (['webhook', 'cron', 'start', 'manualTrigger', 'scheduleTrigger', 'set', 'if', 'switch', 'merge', 'splitInBatches', 'noOp', 'code', 'function', 'functionItem', 'executeWorkflow', 'executeWorkflowTrigger', 'stickyNote', 'n8nTrigger', 'respondToWebhook', 'wait'].includes(nodeName)) {
          continue;
        }

        // Try to match known credential patterns
        const { CREDENTIAL_MAPPINGS } = require('./n8n/credentialExtractor');
        const credInfo = CREDENTIAL_MAPPINGS[nodeName];
        if (credInfo && !credMap.has(credInfo.type)) {
          credMap.set(credInfo.type, credInfo.name);
        }
      }
    }
  }

  const result = Array.from(credMap.entries()).map(([type, name]) => ({ type, name }));

  // Debug logging
  if (result.length > 0) {
    console.log(`[extractCreds] ${workflowName || 'unknown'}: Found ${result.length} credentials from ${nodeTypes.length} nodes:`, result.map(r => r.type));
  } else {
    console.log(`[extractCreds] ${workflowName || 'unknown'}: No credentials detected from node types:`, nodeTypes.slice(0, 5));
  }

  return result;
}

/**
 * Format a credential type string into a human-readable name
 * e.g., 'firefliesApi' -> 'Fireflies'
 */
function formatCredentialTypeName(credentialType: string): string {
  return credentialType
    .replace(/OAuth2Api$/i, '')
    .replace(/Api$/i, '')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format node type string for display
 * e.g., "n8n-nodes-base.formTrigger" -> "Form Trigger"
 * e.g., "@n8n/n8n-nodes-langchain.agent" -> "AI Agent"
 */
function formatNodeTypeName(nodeType: string): string {
  // Extract the last part after the last dot
  const parts = nodeType.split('.');
  const baseName = parts[parts.length - 1] || nodeType;

  // Common node type mappings for cleaner display
  const mappings: Record<string, string> = {
    'webhook': 'Webhook',
    'formTrigger': 'Form Trigger',
    'chatTrigger': 'Chat Trigger',
    'agent': 'AI Agent',
    'lmChatOpenAi': 'OpenAI',
    'lmChatAnthropic': 'Anthropic',
    'lmChatGoogleGemini': 'Gemini',
    'lmChatGroq': 'Groq',
    'lmChatOllama': 'Ollama',
    'memoryBufferWindow': 'Memory',
    'toolCode': 'Code Tool',
    'toolCalculator': 'Calculator',
    'toolWikipedia': 'Wikipedia',
    'toolWorkflow': 'Workflow Tool',
    'httpRequest': 'HTTP Request',
    'code': 'Code',
    'set': 'Set',
    'if': 'IF',
    'switch': 'Switch',
    'merge': 'Merge',
    'splitInBatches': 'Split Batches',
    'respondToWebhook': 'Respond',
    'gmail': 'Gmail',
    'slack': 'Slack',
    'discord': 'Discord',
    'telegram': 'Telegram',
    'googleSheets': 'Google Sheets',
    'airtable': 'Airtable',
    'notion': 'Notion',
    'postgres': 'PostgreSQL',
    'mysql': 'MySQL',
    'mongodb': 'MongoDB',
    'redis': 'Redis',
    'supabase': 'Supabase',
    'openAi': 'OpenAI',
    'flowEngineLlm': 'FlowEngine LLM',
  };

  if (mappings[baseName]) {
    return mappings[baseName];
  }

  // Convert camelCase to Title Case with spaces
  return baseName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Process a single workflow to extract trigger info and credentials
 */
function processWorkflowData(wf: any, baseUrl: string): {
  id: string;
  name: string;
  active: boolean;
  webhookUrl?: string;
  webhookMethod?: WebhookMethod;
  triggerType?: 'webhook' | 'formTrigger' | 'chatTrigger';
  formFields?: N8nFormField[];
  requiredCredentials?: Array<{ type: string; name: string }>;
  missingParameters?: MissingParameterInfo[];
  nodeTypes?: Array<{ type: string; name: string }>;
  createdAt?: string;
  updatedAt?: string;
} {
  let webhookUrl: string | undefined;
  let webhookMethod: WebhookMethod | undefined;
  let triggerType: 'webhook' | 'formTrigger' | 'chatTrigger' | undefined;
  let formFields: N8nFormField[] | undefined;

  // Extract required credentials from all nodes
  const requiredCredentials = extractWorkflowCredentials(wf.nodes, wf.name);

  // Extract nodes with missing required parameters
  const missingParameters = extractMissingParameters(wf);

  // Extract unique node types for display
  const nodeTypes: Array<{ type: string; name: string }> = [];
  if (wf.nodes && Array.isArray(wf.nodes)) {
    const seenTypes = new Set<string>();
    for (const node of wf.nodes) {
      if (node.type && !seenTypes.has(node.type)) {
        seenTypes.add(node.type);
        // Format the node type for display
        const name = formatNodeTypeName(node.type);
        nodeTypes.push({ type: node.type, name });
      }
    }
  }

  if (wf.nodes && Array.isArray(wf.nodes)) {
    const webhookNode = wf.nodes.find((node: any) =>
      node.type === 'n8n-nodes-base.webhook' ||
      node.type === 'n8n-nodes-base.formTrigger' ||
      node.type === '@n8n/n8n-nodes-langchain.chatTrigger' ||
      node.type?.includes('webhook') ||
      node.type?.includes('Webhook') ||
      node.type?.includes('chatTrigger') ||
      node.type?.includes('ChatTrigger')
    );
    if (webhookNode) {
      const isChatTrigger = webhookNode.type?.includes('chatTrigger') || webhookNode.type?.includes('ChatTrigger');
      const isFormTrigger = webhookNode.type === 'n8n-nodes-base.formTrigger';

      const path = isChatTrigger
        ? (webhookNode.webhookId || webhookNode.parameters?.webhookId)
        : (webhookNode.parameters?.path || webhookNode.webhookId || webhookNode.parameters?.webhookId);

      if (path) {
        if (isFormTrigger) {
          webhookUrl = `${baseUrl}/webhook/${path}/n8n-form`;
        } else if (isChatTrigger) {
          webhookUrl = `${baseUrl}/webhook/${path}/chat`;
        } else {
          webhookUrl = `${baseUrl}/webhook/${path}`;
        }
        webhookMethod = getWebhookMethod(webhookNode);
      }

      triggerType = isChatTrigger ? 'chatTrigger' : isFormTrigger ? 'formTrigger' : 'webhook';

      if (isFormTrigger && webhookNode.parameters?.formFields?.values) {
        formFields = webhookNode.parameters.formFields.values as N8nFormField[];
      }
    }
  }

  return {
    id: wf.id,
    name: wf.name,
    active: wf.active,
    webhookUrl,
    webhookMethod,
    triggerType,
    formFields,
    requiredCredentials,
    missingParameters: missingParameters.length > 0 ? missingParameters : undefined,
    nodeTypes,
    createdAt: wf.createdAt,
    updatedAt: wf.updatedAt,
  };
}

/**
 * Fetch workflows from n8n instance
 * Note: The list endpoint may not return full node data, so we fetch individual workflows
 * to ensure we get credential information from all nodes.
 */
export async function fetchN8nWorkflows(instanceUrl: string, apiKey: string): Promise<{
  workflows: Array<{
    id: string;
    name: string;
    active: boolean;
    webhookUrl?: string;
    webhookMethod?: WebhookMethod;
    triggerType?: 'webhook' | 'formTrigger' | 'chatTrigger';
    formFields?: N8nFormField[];
    requiredCredentials?: Array<{ type: string; name: string }>;
    missingParameters?: MissingParameterInfo[];
    nodeTypes?: Array<{ type: string; name: string }>;
    credentialDetectionFailed?: boolean; // True if we couldn't fetch full workflow details
    createdAt?: string;
    updatedAt?: string;
  }>;
  error?: string;
  warning?: string; // Warning when some data couldn't be fetched
}> {
  const result = await n8nFetch<{ data: any[] }>({
    instanceUrl,
    apiKey,
    path: '/api/v1/workflows',
  });

  if (!result.success) {
    return { workflows: [], error: result.error };
  }

  // Normalize instanceUrl for webhook construction
  const baseUrl = instanceUrl.endsWith('/') ? instanceUrl.slice(0, -1) : instanceUrl;

  // Filter out archived workflows
  const workflowList = (result.data?.data || []).filter((wf: any) => !wf.isArchived);

  // Debug: Check first workflow structure from list endpoint
  if (workflowList.length > 0) {
    const sample = workflowList[0];
    console.log(`[n8n] Workflow list sample - id: ${sample.id}, hasNodes: ${!!sample.nodes}, nodeCount: ${sample.nodes?.length || 0}`);
    console.log(`[n8n] List workflow keys:`, Object.keys(sample));
    if (sample.nodes && sample.nodes.length > 0) {
      const firstNode = sample.nodes[0];
      console.log(`[n8n] First node keys:`, Object.keys(firstNode));
      console.log(`[n8n] First node credentials:`, firstNode.credentials);
    }
  }

  // Check if the list endpoint returns nodes data WITH credential info
  // The list endpoint may return nodes but without credential IDs - we need to check for actual credential data
  let needsIndividualFetch = workflowList.some((wf: any) => !wf.nodes || !Array.isArray(wf.nodes) || wf.nodes.length === 0);
  
  // Even if nodes exist, check if they have credential data (list endpoint often omits this)
  if (!needsIndividualFetch && workflowList.length > 0) {
    // Look for any node with actual credential ID references
    let hasCredentialData = false;
    for (const wf of workflowList) {
      for (const node of (wf.nodes || [])) {
        if (node.credentials && typeof node.credentials === 'object') {
          const hasIds = Object.values(node.credentials).some(
            (cred: any) => cred && typeof cred === 'object' && 'id' in cred
          );
          if (hasIds) {
            hasCredentialData = true;
            break;
          }
        }
      }
      if (hasCredentialData) break;
    }
    // If no credential data found but workflows have nodes that need credentials, fetch individually
    if (!hasCredentialData) {
      needsIndividualFetch = true;
    }
  }
  console.log(`[n8n] needsIndividualFetch: ${needsIndividualFetch}, workflowCount: ${workflowList.length}`);

  if (needsIndividualFetch && workflowList.length > 0) {
    // Fetch individual workflow details in parallel (limited concurrency)
    const batchSize = 5; // Limit concurrent requests
    const workflows: any[] = [];
    let failedFetches = 0;
    let successfulFetches = 0;

    for (let i = 0; i < workflowList.length; i += batchSize) {
      const batch = workflowList.slice(i, i + batchSize);
      const batchPromises = batch.map(async (wf: any) => {
        const detailResult = await n8nFetch<any>({
          instanceUrl,
          apiKey,
          path: `/api/v1/workflows/${wf.id}`,
          timeout: 8000,
        });

        if (detailResult.success && detailResult.data) {
          successfulFetches++;
          const wfData = detailResult.data;
          // Debug: Check if individual workflow has nodes with credentials
          if (i === 0 && batch.indexOf(wf) === 0) {
            const nodesWithCreds = (wfData.nodes || []).filter((n: any) => n.credentials);
            console.log(`[n8n] First workflow detail - id: ${wfData.id}, nodes: ${wfData.nodes?.length || 0}, nodesWithCreds: ${nodesWithCreds.length}`);
            if (nodesWithCreds.length > 0) {
              console.log(`[n8n] Sample node credentials:`, nodesWithCreds.slice(0, 2).map((n: any) => ({
                type: n.type,
                credentials: Object.keys(n.credentials || {})
              })));
            }
          }
          return processWorkflowData(wfData, baseUrl);
        }
        // Fallback to basic info if fetch fails - mark that credential detection failed
        failedFetches++;
        console.log(`[n8n] Failed to fetch workflow ${wf.id}: ${detailResult.error}`);
        const processed = processWorkflowData(wf, baseUrl);
        return { ...processed, credentialDetectionFailed: true };
      });

      const batchResults = await Promise.all(batchPromises);
      workflows.push(...batchResults);
    }

    console.log(`[n8n] Individual fetches - success: ${successfulFetches}, failed: ${failedFetches}`);

    // Add warning if some workflows couldn't be fully fetched
    const warning = failedFetches > 0
      ? `Could not detect credentials for ${failedFetches} workflow(s). The n8n API may need to be updated.`
      : undefined;

    return { workflows, warning };
  }

  // List endpoint returned full data, process directly
  const workflows = workflowList.map((wf: any) => processWorkflowData(wf, baseUrl));

  return { workflows };
}

/**
 * Fetch recent executions from n8n instance with metrics
 */
export async function fetchN8nExecutions(
  instanceUrl: string,
  apiKey: string,
  limit = 10
): Promise<{
  executions: Array<{
    id: string;
    workflowName: string;
    workflowId: string;
    status: 'success' | 'error' | 'running';
    startedAt: string;
  }>;
  metrics?: {
    total: number;
    success: number;
    failed: number;
    running: number;
  };
  error?: string;
}> {
  // Build query string - include workflow data for names
  const queryString = `limit=${limit}&includeData=true`;

  // Fetch executions with includeData to get workflow info
  const result = await n8nFetch<{ data: any[]; nextCursor?: string }>({
    instanceUrl,
    apiKey,
    path: `/api/v1/executions?${queryString}`,
  });

  if (!result.success) {
    return { executions: [], error: result.error };
  }

  // n8n API can return { data: [...] } or just [...] depending on version
  const rawExecutions = Array.isArray(result.data)
    ? result.data
    : (result.data?.data || []);

  // Fetch workflows to get their names (since executions may not include full workflow data)
  const workflowsResult = await n8nFetch<{ data: any[] } | any[]>({
    instanceUrl,
    apiKey,
    path: '/api/v1/workflows',
  });

  // Build a map of workflow IDs to names
  const workflowNameMap: Record<string, string> = {};
  if (workflowsResult.success) {
    const workflowsData = Array.isArray(workflowsResult.data)
      ? workflowsResult.data
      : (workflowsResult.data?.data || []);
    for (const wf of workflowsData) {
      if (wf.id && wf.name) {
        workflowNameMap[String(wf.id)] = wf.name;
      }
    }
  }

  // Calculate metrics from fetched data
  let successCount = 0;
  let failedCount = 0;
  let runningCount = 0;

  const executions = rawExecutions.map((exec: any) => {
    // Determine status based on n8n status field
    // n8n status values: 'success', 'error', 'crashed', 'waiting', 'running', 'new', 'canceled'
    let status: 'success' | 'error' | 'running';
    const n8nStatus = exec.status?.toLowerCase();

    if (n8nStatus === 'running' || n8nStatus === 'new' || n8nStatus === 'waiting') {
      // Only mark as running if truly still in progress
      status = 'running';
      runningCount++;
    } else if (n8nStatus === 'error' || n8nStatus === 'crashed' || n8nStatus === 'canceled' || n8nStatus === 'failed') {
      // Failed executions: error, crashed, canceled, or failed
      status = 'error';
      failedCount++;
    } else if (n8nStatus === 'success') {
      status = 'success';
      successCount++;
    } else {
      // Fallback: check finished flag for unknown statuses
      if (exec.finished === false) {
        status = 'running';
        runningCount++;
      } else if (exec.data?.resultData?.error) {
        status = 'error';
        failedCount++;
      } else {
        status = 'success';
        successCount++;
      }
    }

    // Get workflow name - prioritize our fetched workflow map
    const workflowId = exec.workflowId ? String(exec.workflowId) : '';
    const workflowName =
      workflowNameMap[workflowId] ||
      exec.workflowData?.name ||
      exec.workflowName ||
      exec.workflow?.name ||
      (workflowId ? `Workflow ${workflowId}` : 'Unknown');

    return {
      id: exec.id,
      workflowName,
      workflowId,
      status,
      startedAt: exec.startedAt,
    };
  });

  return {
    executions,
    metrics: {
      total: rawExecutions.length,
      success: successCount,
      failed: failedCount,
      running: runningCount,
    }
  };
}

/**
 * Fetch single execution details including output data
 * GET /api/v1/executions/{id}
 */
export async function fetchN8nExecutionDetail(
  instanceUrl: string,
  apiKey: string,
  executionId: string
): Promise<{
  success: boolean;
  execution?: {
    id: string;
    workflowId: string;
    workflowName: string;
    status: 'success' | 'error' | 'running';
    startedAt: string;
    stoppedAt?: string;
    mode: string;
    input?: any; // The input to the workflow (first node's data)
    output?: any; // The final output from the workflow
    error?: string; // Error message if failed
    nodeOutputs?: Record<string, any>; // Output from each node
  };
  error?: string;
}> {
  // includeData=true is required to get the actual execution output data
  const result = await n8nFetch<any>({
    instanceUrl,
    apiKey,
    path: `/api/v1/executions/${executionId}?includeData=true`,
    timeout: 15000, // Larger timeout for execution data
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const exec = result.data;
  if (!exec) {
    return { success: false, error: 'Execution not found' };
  }

  // Determine status
  let status: 'success' | 'error' | 'running';
  const n8nStatus = exec.status?.toLowerCase();
  if (n8nStatus === 'running' || n8nStatus === 'new' || n8nStatus === 'waiting') {
    status = 'running';
  } else if (n8nStatus === 'error' || n8nStatus === 'crashed' || n8nStatus === 'canceled' || n8nStatus === 'failed') {
    status = 'error';
  } else {
    status = 'success';
  }

  // Extract input and output from the workflow
  // n8n stores node outputs in data.resultData.runData
  let input: any = null;
  let output: any = null;
  let errorMessage: string | undefined;
  const nodeOutputs: Record<string, any> = {};

  if (exec.data?.resultData) {
    const runData = exec.data.resultData.runData;

    // If there's an error, capture it
    if (exec.data.resultData.error) {
      errorMessage = exec.data.resultData.error.message || 'Execution failed';
    }

    // Process each node's output
    // n8n structure: runData[nodeName][runIndex].data.main[outputIndex][itemIndex].json
    if (runData && typeof runData === 'object') {
      const nodeNames = Object.keys(runData);
      for (const nodeName of nodeNames) {
        const nodeRuns = runData[nodeName];
        if (Array.isArray(nodeRuns) && nodeRuns.length > 0) {
          // Get the last run's output (main[0] is first output branch)
          const lastRun = nodeRuns[nodeRuns.length - 1];
          if (lastRun?.data?.main?.[0] && Array.isArray(lastRun.data.main[0])) {
            // Extract .json from each item in the output array
            const items = lastRun.data.main[0];
            const jsonItems = items
              .map((item: any) => item?.json)
              .filter((json: any) => json !== undefined);

            // Store as array if multiple items, single object if just one
            nodeOutputs[nodeName] = jsonItems.length === 1 ? jsonItems[0] : jsonItems;
          }
        }
      }

      // The "input" is typically the first node's output (trigger/webhook data)
      // The "output" is typically the last node's result
      if (nodeNames.length > 0) {
        const firstNodeName = nodeNames[0];
        const lastNodeName = nodeNames[nodeNames.length - 1];
        input = nodeOutputs[firstNodeName];
        output = nodeOutputs[lastNodeName];
      }
    }
  }

  return {
    success: true,
    execution: {
      id: exec.id,
      workflowId: exec.workflowId ? String(exec.workflowId) : '',
      workflowName: exec.workflowData?.name || exec.workflowName || 'Unknown',
      status,
      startedAt: exec.startedAt,
      stoppedAt: exec.stoppedAt,
      mode: exec.mode || 'unknown',
      input,
      output,
      error: errorMessage,
      nodeOutputs,
    },
  };
}

/**
 * Create a new workflow in n8n
 * Saves workflow definition to the instance
 */
export async function createN8nWorkflow(
  instanceUrl: string,
  apiKey: string,
  workflow: any
): Promise<{
  success: boolean;
  workflowId?: string;
  workflowUrl?: string;
  error?: string
}> {
  // Ensure workflow has required fields
  if (!workflow.name) {
    return { success: false, error: 'Workflow name is required' };
  }

  // Prepare workflow payload for n8n API
  const payload = {
    name: workflow.name,
    nodes: workflow.nodes || [],
    connections: workflow.connections || {},
    settings: workflow.settings || { executionOrder: 'v1' },
    active: false, // Start as inactive
  };

  const result = await n8nFetch<any>({
    instanceUrl,
    apiKey,
    path: '/api/v1/workflows',
    method: 'POST',
    body: payload,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const createdWorkflow = result.data;
  if (!createdWorkflow || !createdWorkflow.id) {
    return { success: false, error: 'Failed to create workflow - no ID returned' };
  }

  // Construct the workflow URL based on instance
  const baseUrl = instanceUrl.endsWith('/') ? instanceUrl.slice(0, -1) : instanceUrl;
  const workflowUrl = `${baseUrl}/workflow/${createdWorkflow.id}`;

  return {
    success: true,
    workflowId: createdWorkflow.id,
    workflowUrl,
  };
}

/**
 * Toggle workflow active state (activate/deactivate)
 */
export async function toggleN8nWorkflow(
  instanceUrl: string,
  apiKey: string,
  workflowId: string,
  activate: boolean
): Promise<{ success: boolean; error?: string }> {
  const endpoint = activate ? 'activate' : 'deactivate';
  const result = await n8nFetch({
    instanceUrl,
    apiKey,
    path: `/api/v1/workflows/${workflowId}/${endpoint}`,
    method: 'POST',
  });

  return { success: result.success, error: result.error };
}

/**
 * Archive (delete) a workflow in n8n
 * Note: Uses DELETE since n8n public API doesn't have archive endpoint
 */
export async function archiveN8nWorkflow(
  instanceUrl: string,
  apiKey: string,
  workflowId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await n8nFetch({
    instanceUrl,
    apiKey,
    path: `/api/v1/workflows/${workflowId}`,
    method: 'DELETE',
  });

  return { success: result.success, error: result.error };
}

/**
 * Unarchive a workflow - not supported since we use DELETE
 * Returns error to inform the user
 */
export async function unarchiveN8nWorkflow(
  _instanceUrl: string,
  _apiKey: string,
  _workflowId: string
): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Unarchive not supported - workflows are permanently deleted' };
}


/**
 * Fetch archived workflows from n8n instance
 */
export async function fetchN8nArchivedWorkflows(instanceUrl: string, apiKey: string): Promise<{
  workflows: Array<{
    id: string;
    name: string;
    active: boolean;
    webhookUrl?: string;
    webhookMethod?: WebhookMethod;
    triggerType?: 'webhook' | 'formTrigger' | 'chatTrigger';
    formFields?: N8nFormField[];
    requiredCredentials?: Array<{ type: string; name: string }>;
    createdAt?: string;
    updatedAt?: string;
  }>;
  error?: string;
}> {
  const result = await n8nFetch<{ data: any[] }>({
    instanceUrl,
    apiKey,
    path: '/api/v1/workflows',
  });

  if (!result.success) {
    return { workflows: [], error: result.error };
  }

  const baseUrl = instanceUrl.endsWith('/') ? instanceUrl.slice(0, -1) : instanceUrl;

  // Only get archived workflows
  const archivedList = (result.data?.data || []).filter((wf: any) => wf.isArchived === true);

  const workflows = archivedList.map((wf: any) => processWorkflowData(wf, baseUrl));

  return { workflows };
}

// ============================================================================
// CREDENTIALS API
// ============================================================================

/**
 * n8n Credential type returned from the API
 */
export interface N8nCredential {
  id: string;
  name: string;
  type: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Required credential info with workflow context
 */
interface RequiredCredential {
  type: string;
  name: string;
  workflows: Array<{ id: string; name: string }>;
}

/**
 * Extract credentials from workflow nodes
 * Returns both:
 * - connected: credentials actually connected to nodes (have id)
 * - required: credentials needed by node types (may or may not be connected)
 *
 * Structure: node.credentials = { credentialType: { id: "...", name: "..." } }
 */
export async function extractCredentialsFromWorkflows(
  instanceUrl: string,
  apiKey: string
): Promise<{
  credentials: N8nCredential[];
  required: RequiredCredential[];
  error?: string;
}> {
  console.log(`[n8n] Starting credential extraction from ${instanceUrl}`);

  // Fetch node type definitions from n8n (for community node support)
  // This allows us to detect credential requirements for any node, not just hardcoded ones
  let nodeTypeCredentials: Map<string, NodeTypeCredential[]> | undefined;
  const nodeTypesResult = await getNodeTypesWithCredentials(instanceUrl, apiKey);
  if (nodeTypesResult.success && nodeTypesResult.nodeCredentials) {
    nodeTypeCredentials = nodeTypesResult.nodeCredentials;
  }

  // First get list of workflows
  const listResult = await n8nFetch<{ data: any[] }>({
    instanceUrl,
    apiKey,
    path: '/api/v1/workflows',
  });

  if (!listResult.success) {
    console.log(`[n8n] Failed to fetch workflows: ${listResult.error}`);
    return { credentials: [], required: [], error: listResult.error };
  }

  const allWorkflows = listResult.data?.data || [];
  const workflowList = allWorkflows.filter((wf: any) => !wf.isArchived);
  console.log(`[n8n] Found ${workflowList.length} non-archived workflows (${allWorkflows.length} total)`);

  // Connected credentials (have actual id)
  const connectedMap = new Map<string, N8nCredential>();

  // Required credentials by type (inferred from node types)
  // Store workflow objects with id+name for clickable navigation
  const requiredMap = new Map<string, { type: string; name: string; workflows: Map<string, { id: string; name: string }> }>();

  // Check if workflow list already has nodes with credentials
  // We need to check if ANY node has credential IDs, not just the first node
  // Tool nodes and other nodes with credentials might not be the first node
  let needsIndividualFetch = true;
  if (workflowList.length > 0) {
    // Check if we can find any node with actual credential ID references
    for (const wf of workflowList) {
      if (wf.nodes && Array.isArray(wf.nodes)) {
        for (const node of wf.nodes) {
          if (node.credentials && typeof node.credentials === 'object') {
            // Check if credentials have the structure we need (with id field)
            const hasCredentialIds = Object.values(node.credentials).some(
              (cred: any) => cred && typeof cred === 'object' && 'id' in cred
            );
            if (hasCredentialIds) {
              needsIndividualFetch = false;
              break;
            }
          }
        }
        if (!needsIndividualFetch) break;
      }
    }
  }

  // Process workflows
  for (const wf of workflowList) {
    const workflowName = wf.name || 'Unnamed';
    let nodes = wf.nodes || [];

    // Fetch details if list doesn't include credential info
    if (needsIndividualFetch) {
      const detailResult = await n8nFetch<any>({
        instanceUrl,
        apiKey,
        path: `/api/v1/workflows/${wf.id}`,
        timeout: 8000,
      });

      if (!detailResult.success) {
        console.log(`[n8n] Failed to fetch workflow ${wf.id}: ${detailResult.error}`);
        continue;
      }
      nodes = detailResult.data?.nodes || [];
    }

    // Extract connected credentials (have actual id references)
    for (const node of nodes) {
      if (!node.credentials) continue;

      for (const [credType, credRef] of Object.entries(node.credentials as Record<string, any>)) {
        if (credRef?.id && !connectedMap.has(credRef.id)) {
          connectedMap.set(credRef.id, {
            id: credRef.id,
            name: credRef.name || `${credType} credential`,
            type: credType,
          });
        }
      }
    }

    // Extract required credentials (inferred from node types + n8n node definitions)
    const workflowCreds = extractWorkflowCredentials(nodes, workflowName, nodeTypeCredentials);
    for (const cred of workflowCreds) {
      if (!requiredMap.has(cred.type)) {
        requiredMap.set(cred.type, {
          type: cred.type,
          name: cred.name,
          workflows: new Map([[wf.id, { id: wf.id, name: workflowName }]]),
        });
      } else {
        requiredMap.get(cred.type)!.workflows.set(wf.id, { id: wf.id, name: workflowName });
      }
    }
  }

  const candidateCredentials = Array.from(connectedMap.values());

  // Note: Cannot verify credentials exist - n8n returns 405 for GET /credentials/{id}
  // Trust workflow node references as source of truth
  const verifiedCredentials = candidateCredentials;

  const required = Array.from(requiredMap.values()).map(r => ({
    type: r.type,
    name: r.name,
    workflows: Array.from(r.workflows.values()),
  }));

  console.log(`[n8n] Extracted ${verifiedCredentials.length} connected credentials from workflow nodes:`,
    verifiedCredentials.map(c => ({ type: c.type, name: c.name, id: c.id }))
  );
  console.log(`[n8n] Found ${required.length} required credential types:`,
    required.map(r => ({ type: r.type, workflowCount: r.workflows.length }))
  );

  return { credentials: verifiedCredentials, required };
}

/**
 * Connect a credential to all workflow nodes that need it
 * Uses PUT /workflows/{id} to update node credentials
 *
 * @param instanceUrl - n8n instance URL
 * @param apiKey - n8n API key
 * @param credentialId - The credential ID to connect
 * @param credentialName - The credential name
 * @param credentialType - The credential type (e.g., 'googleDriveOAuth2Api')
 * @returns Object with connected workflow count and any errors
 */
export async function connectCredentialToWorkflows(
  instanceUrl: string,
  apiKey: string,
  credentialId: string,
  credentialName: string,
  credentialType: string
): Promise<{
  connectedWorkflows: number;
  errors: string[];
}> {
  console.log(`[n8n] Connecting credential ${credentialType} (${credentialId}) to workflows...`);

  const errors: string[] = [];
  let connectedWorkflows = 0;

  // Get all workflows
  const listResult = await n8nFetch<{ data: any[] }>({
    instanceUrl,
    apiKey,
    path: '/api/v1/workflows',
  });

  if (!listResult.success || !listResult.data?.data) {
    console.error('[n8n] Failed to fetch workflows for credential connection:', listResult.error);
    return { connectedWorkflows: 0, errors: [listResult.error || 'Failed to fetch workflows'] };
  }

  const workflows = listResult.data.data.filter((wf: any) => !wf.isArchived);

  // Find which node types need this credential type
  const nodeTypesNeedingCred = Object.entries(NODE_TYPE_CREDENTIALS)
    .filter(([_, cred]) => cred.type === credentialType)
    .map(([nodeType]) => nodeType);

  console.log(`[n8n] Node types needing ${credentialType}:`, nodeTypesNeedingCred);

  for (const wf of workflows) {
    // Fetch full workflow details
    const detailResult = await n8nFetch<any>({
      instanceUrl,
      apiKey,
      path: `/api/v1/workflows/${wf.id}`,
    });

    if (!detailResult.success || !detailResult.data) {
      console.warn(`[n8n] Failed to fetch workflow ${wf.id}: ${detailResult.error}`);
      continue;
    }

    const workflow = detailResult.data;
    const nodes = workflow.nodes || [];
    let workflowModified = false;

    // Debug: log ALL node types in this workflow to see what we're working with
    console.log(`[n8n] Workflow "${workflow.name}" has ${nodes.length} nodes:`,
      nodes.map((n: any) => n.type).filter((t: string, i: number, arr: string[]) => arr.indexOf(t) === i)
    );

    // Debug: log all nodes with credentials
    const nodesWithCreds = nodes.filter((n: any) => n.credentials);
    if (nodesWithCreds.length > 0) {
      console.log(`[n8n] Workflow "${workflow.name}" nodes with credentials:`,
        nodesWithCreds.map((n: any) => ({ name: n.name, type: n.type, credKeys: Object.keys(n.credentials || {}) }))
      );
    }

    // Check each node to see if it needs this credential type
    for (const node of nodes) {
      const nodeType = node.type;

      // Check if this node needs the credential by:
      // 1. Node type is in our mapping for this credential type
      // 2. OR node already has this credential type in its credentials object (even if empty/deleted)
      // 3. OR node type name suggests it needs this credential (fallback for unmapped Tool nodes)
      const nodeCredMapping = NODE_TYPE_CREDENTIALS[nodeType];
      const mappingMatches = nodeCredMapping?.type === credentialType;
      const nodeHasCredType = node.credentials && credentialType in node.credentials;
      
      // Fallback: check if node type name suggests it needs this credential
      // e.g., toolGoogleCalendar should match googleCalendarOAuth2Api
      const nodeTypeLower = nodeType.toLowerCase();
      const credTypeLower = credentialType.toLowerCase().replace('oauth2api', '').replace('oauth2', '').replace('api', '');
      const nodeTypeMatchesCred = nodeTypeLower.includes(credTypeLower) || 
        (credTypeLower.includes('google') && nodeTypeLower.includes('google') && 
         nodeTypeLower.includes(credTypeLower.replace('google', '')));

      if (!mappingMatches && !nodeHasCredType && !nodeTypeMatchesCred) {
        continue;
      }
      
      // Log when we find a match via fallback
      if (!mappingMatches && !nodeHasCredType && nodeTypeMatchesCred) {
        console.log(`[n8n] Node "${node.name}" (${nodeType}) matched via name pattern for ${credentialType}`);
      }

      // Check if credential is already connected
      const existingCred = node.credentials?.[credentialType];
      if (existingCred?.id) {
        // Node already has a credential of this type - don't replace it
        // This prevents accidentally overwriting a valid credential with a new one
        if (existingCred.id === credentialId) {
          console.log(`[n8n] Node "${node.name}" already has this exact credential connected`);
        } else {
          console.log(`[n8n] Node "${node.name}" already has a different ${credentialType} credential (${existingCred.id}), skipping`);
        }
        continue;
      }

      // Only connect if node has no credential or has an empty/deleted reference
      if (!node.credentials) {
        node.credentials = {};
      }
      node.credentials[credentialType] = {
        id: credentialId,
        name: credentialName,
      };
      workflowModified = true;
      console.log(`[n8n] Connected ${credentialType} to node "${node.name}" in workflow "${workflow.name}"`);
    }

    // If we modified the workflow, update it
    if (workflowModified) {
      // n8n API requires exactly: name, nodes, connections, settings
      const updateBody = {
        name: workflow.name,
        nodes: workflow.nodes,
        connections: workflow.connections,
        settings: workflow.settings || {},
      };

      console.log(`[n8n] Updating workflow "${workflow.name}"`);

      const updateResult = await n8nFetch<any>({
        instanceUrl,
        apiKey,
        path: `/api/v1/workflows/${wf.id}`,
        method: 'PUT',
        body: updateBody,
      });

      if (updateResult.success) {
        connectedWorkflows++;
        console.log(`[n8n] Successfully updated workflow "${workflow.name}"`);
      } else {
        const errorMsg = `Failed to update workflow "${workflow.name}": ${updateResult.error}`;
        console.error(`[n8n] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
  }

  console.log(`[n8n] Connected credential to ${connectedWorkflows} workflow(s)`);
  return { connectedWorkflows, errors };
}

/**
 * Disconnect a credential from all workflow nodes before deletion
 * This prevents workflows from having broken credential references
 */
export async function disconnectCredentialFromWorkflows(
  instanceUrl: string,
  apiKey: string,
  credentialId: string,
  credentialType: string
): Promise<{
  disconnectedWorkflows: number;
  errors: string[];
}> {
  console.log(`[n8n] Disconnecting credential ${credentialId} (${credentialType}) from workflows...`);

  const errors: string[] = [];
  let disconnectedWorkflows = 0;

  // Get all workflows
  const listResult = await n8nFetch<{ data: any[] }>({
    instanceUrl,
    apiKey,
    path: '/api/v1/workflows',
  });

  if (!listResult.success || !listResult.data?.data) {
    console.error('[n8n] Failed to fetch workflows for credential disconnection:', listResult.error);
    return { disconnectedWorkflows: 0, errors: [listResult.error || 'Failed to fetch workflows'] };
  }

  const workflows = listResult.data.data.filter((wf: any) => !wf.isArchived);

  for (const wf of workflows) {
    // Fetch full workflow details
    const detailResult = await n8nFetch<any>({
      instanceUrl,
      apiKey,
      path: `/api/v1/workflows/${wf.id}`,
    });

    if (!detailResult.success || !detailResult.data) {
      console.warn(`[n8n] Failed to fetch workflow ${wf.id}: ${detailResult.error}`);
      continue;
    }

    const workflow = detailResult.data;
    const nodes = workflow.nodes || [];
    let workflowModified = false;

    // Check each node to see if it has this credential
    for (const node of nodes) {
      if (!node.credentials) continue;

      // Check if this node has the credential we're deleting
      const credEntry = node.credentials[credentialType];
      if (credEntry?.id === credentialId) {
        // Remove the credential reference
        delete node.credentials[credentialType];
        workflowModified = true;
        console.log(`[n8n] Disconnected credential from node "${node.name}" in workflow "${workflow.name}"`);
      }
    }

    // If we modified the workflow, update it
    if (workflowModified) {
      // n8n API requires exactly: name, nodes, connections, settings
      const updateBody = {
        name: workflow.name,
        nodes: workflow.nodes,
        connections: workflow.connections,
        settings: workflow.settings || {},
      };

      const updateResult = await n8nFetch<any>({
        instanceUrl,
        apiKey,
        path: `/api/v1/workflows/${wf.id}`,
        method: 'PUT',
        body: updateBody,
      });

      if (updateResult.success) {
        disconnectedWorkflows++;
        console.log(`[n8n] Successfully updated workflow "${workflow.name}"`);
      } else {
        const errorMsg = `Failed to update workflow "${workflow.name}": ${updateResult.error}`;
        console.error(`[n8n] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
  }

  console.log(`[n8n] Disconnected credential from ${disconnectedWorkflows} workflow(s)`);
  return { disconnectedWorkflows, errors };
}

/**
 * Try to auto-connect any unlinked credentials to workflow nodes
 * This helps when user creates OAuth credentials in n8n but they're not yet linked to nodes
 */
export async function tryAutoConnectCredentials(
  instanceUrl: string,
  apiKey: string,
  missingTypes: string[]
): Promise<{
  connectedTypes: string[];
  errors: string[];
}> {
  const connectedTypes: string[] = [];
  const errors: string[] = [];

  console.log(`[n8n] Trying to auto-connect credentials for types:`, missingTypes);

  // Try to fetch all credentials from n8n
  const { credentials: allCredentials, error: fetchError } = await fetchN8nCredentials(instanceUrl, apiKey);

  if (fetchError) {
    console.log(`[n8n] Could not list credentials: ${fetchError}`);
    // Can't list credentials, so we can't auto-connect
    return { connectedTypes, errors: [fetchError] };
  }

  console.log(`[n8n] Found ${allCredentials.length} credentials in n8n`);

  // For each missing type, find a credential of that type and connect it
  for (const missingType of missingTypes) {
    const matchingCredential = allCredentials.find(c => c.type === missingType);

    if (matchingCredential) {
      console.log(`[n8n] Found credential for ${missingType}: ${matchingCredential.name} (${matchingCredential.id})`);

      try {
        const connectResult = await connectCredentialToWorkflows(
          instanceUrl,
          apiKey,
          matchingCredential.id,
          matchingCredential.name,
          matchingCredential.type
        );

        if (connectResult.connectedWorkflows > 0) {
          connectedTypes.push(missingType);
          console.log(`[n8n] Auto-connected ${missingType} to ${connectResult.connectedWorkflows} workflow(s)`);
        }

        if (connectResult.errors.length > 0) {
          errors.push(...connectResult.errors);
        }
      } catch (e) {
        const errorMsg = `Failed to auto-connect ${missingType}: ${e}`;
        console.error(`[n8n] ${errorMsg}`);
        errors.push(errorMsg);
      }
    } else {
      console.log(`[n8n] No credential found for type ${missingType}`);
    }
  }

  return { connectedTypes, errors };
}

/**
 * Fetch a single credential by ID from n8n instance
 * Returns the credential metadata including its type (needed for deletion)
 */
export async function getN8nCredential(
  instanceUrl: string,
  apiKey: string,
  credentialId: string
): Promise<{
  credential?: N8nCredential;
  error?: string;
}> {
  const result = await n8nFetch<N8nCredential>({
    instanceUrl,
    apiKey,
    path: `/api/v1/credentials/${encodeURIComponent(credentialId)}`,
  });

  if (!result.success) {
    return { error: result.error };
  }

  return { credential: result.data };
}

/**
 * Verify if a credential exists in n8n by trying to update it
 * n8n's GET endpoint returns 405, but PATCH should return 404 if credential doesn't exist
 * Returns true if credential exists, false if it doesn't (404), undefined if check failed
 */
export async function verifyCredentialExists(
  instanceUrl: string,
  apiKey: string,
  credentialId: string
): Promise<boolean | undefined> {
  // Try PATCH with empty body - n8n should return 404 if credential doesn't exist
  const result = await n8nFetch<any>({
    instanceUrl,
    apiKey,
    path: `/api/v1/credentials/${encodeURIComponent(credentialId)}`,
    method: 'PATCH',
    body: {}, // Empty update - just checking if it exists
    timeout: 5000,
  });

  console.log(`[n8n] Verify credential ${credentialId}: status=${result.statusCode}, success=${result.success}, error=${result.error}`);

  // 404 means credential doesn't exist
  if (result.statusCode === 404) {
    return false;
  }

  // Success or 400 (bad request but credential exists) means it exists
  if (result.success || result.statusCode === 400 || result.statusCode === 200) {
    return true;
  }

  // 405 means PATCH not supported - can't verify
  if (result.statusCode === 405) {
    return undefined;
  }

  // Other errors - assume can't verify
  return undefined;
}

/**
 * Batch verify which credentials exist in n8n
 * Returns a Set of credential IDs that definitely exist
 */
export async function verifyCredentialsExist(
  instanceUrl: string,
  apiKey: string,
  credentialIds: string[]
): Promise<{
  existingIds: Set<string>;
  canVerify: boolean;
}> {
  if (credentialIds.length === 0) {
    return { existingIds: new Set(), canVerify: true };
  }

  const existingIds = new Set<string>();
  let anyVerified = false;
  let anyUnverifiable = false;

  // Check each credential in parallel (with limit to avoid overwhelming)
  const batchSize = 5;
  for (let i = 0; i < credentialIds.length; i += batchSize) {
    const batch = credentialIds.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (id) => {
        const exists = await verifyCredentialExists(instanceUrl, apiKey, id);
        return { id, exists };
      })
    );

    for (const { id, exists } of results) {
      if (exists === true) {
        existingIds.add(id);
        anyVerified = true;
      } else if (exists === false) {
        anyVerified = true;
        // Don't add to existingIds - credential doesn't exist
      } else {
        anyUnverifiable = true;
      }
    }
  }

  // We can verify if we got at least one definitive result and no unverifiable ones
  const canVerify = anyVerified && !anyUnverifiable;

  return { existingIds, canVerify };
}

/**
 * Fetch all credentials from n8n instance
 * Note: Credential data (secrets) are never returned by n8n API - only metadata
 * Tries multiple endpoints for compatibility with different n8n versions/configurations
 */
export async function fetchN8nCredentials(
  instanceUrl: string,
  apiKey: string
): Promise<{
  credentials: N8nCredential[];
  error?: string;
}> {
  // Try the public API endpoint first
  let result = await n8nFetch<{ data: N8nCredential[] } | N8nCredential[]>({
    instanceUrl,
    apiKey,
    path: '/api/v1/credentials',
  });

  console.log('[n8n] GET /api/v1/credentials result:', {
    success: result.success,
    statusCode: result.statusCode,
    error: result.error,
    hasData: !!result.data,
  });

  // If primary endpoint fails (405 usually means API not enabled), try alternative
  if (!result.success && (result.statusCode === 405 || result.statusCode === 404)) {
    console.log('[n8n] Primary credentials endpoint failed with', result.statusCode, '- trying alternative...');

    // Try the internal REST API (some deployments expose this)
    result = await n8nFetch<{ data: N8nCredential[] } | N8nCredential[]>({
      instanceUrl,
      apiKey,
      path: '/rest/credentials',
    });

    console.log('[n8n] GET /rest/credentials result:', {
      success: result.success,
      statusCode: result.statusCode,
      error: result.error,
    });
  }

  if (!result.success) {
    return { credentials: [], error: result.error };
  }

  // Handle both response formats: { data: [...] } and direct array
  const credentials = Array.isArray(result.data)
    ? result.data
    : (result.data?.data || []);

  return { credentials };
}

/**
 * Hardcoded schema fallback for common OAuth2 credential types
 * Maps credential type to required properties
 */
const KNOWN_OAUTH2_SCHEMAS: Record<string, string[]> = {
  // Social Media
  'slackOAuth2Api': ['clientId', 'clientSecret', 'oauthTokenData'],
  'twitterOAuth2Api': ['clientId', 'clientSecret', 'oauthTokenData', 'serverUrl'],
  'linkedInOAuth2Api': ['clientId', 'clientSecret', 'oauthTokenData', 'serverUrl'],
  'redditOAuth2Api': ['clientId', 'clientSecret', 'oauthTokenData', 'serverUrl'],

  // Microsoft
  'microsoftOAuth2Api': ['clientId', 'clientSecret', 'oauthTokenData', 'serverUrl', 'sendAdditionalBodyProperties', 'additionalBodyProperties', 'allowedDomains'],
  'microsoftOutlookOAuth2Api': ['clientId', 'clientSecret', 'oauthTokenData', 'serverUrl', 'sendAdditionalBodyProperties', 'additionalBodyProperties', 'allowedDomains', 'userPrincipalName'],
  'microsoftTeamsOAuth2Api': ['clientId', 'clientSecret', 'oauthTokenData', 'serverUrl', 'sendAdditionalBodyProperties', 'additionalBodyProperties', 'allowedDomains'],

  // Google
  'googleCalendarOAuth2Api': ['clientId', 'clientSecret', 'oauthTokenData', 'serverUrl', 'allowedDomains', 'sendAdditionalBodyProperties', 'additionalBodyProperties'],
  'googleSheetsOAuth2Api': ['clientId', 'clientSecret', 'oauthTokenData', 'serverUrl', 'allowedDomains', 'sendAdditionalBodyProperties', 'additionalBodyProperties'],
  'googleDriveOAuth2Api': ['clientId', 'clientSecret', 'oauthTokenData', 'serverUrl', 'allowedDomains', 'sendAdditionalBodyProperties', 'additionalBodyProperties'],
  'gmailOAuth2': ['clientId', 'clientSecret', 'oauthTokenData', 'serverUrl', 'allowedDomains', 'sendAdditionalBodyProperties', 'additionalBodyProperties'],
  'googleDocsOAuth2Api': ['clientId', 'clientSecret', 'oauthTokenData', 'serverUrl', 'allowedDomains', 'sendAdditionalBodyProperties', 'additionalBodyProperties'],
  'googleSlidesOAuth2Api': ['clientId', 'clientSecret', 'oauthTokenData', 'serverUrl', 'allowedDomains', 'sendAdditionalBodyProperties', 'additionalBodyProperties'],

  // Default fallback - include all standard OAuth2 properties for unknown types
  // This is permissive and lets n8n filter what it needs
  '_default': ['clientId', 'clientSecret', 'oauthTokenData', 'serverUrl', 'allowedDomains', 'sendAdditionalBodyProperties', 'additionalBodyProperties'],
};

/**
 * Get credential schema for a specific credential type
 * Returns the JSON schema describing what fields are required for this credential type
 * Tries multiple endpoints for compatibility across n8n versions
 */
export async function fetchN8nCredentialSchema(
  instanceUrl: string,
  apiKey: string,
  credentialType: string
): Promise<{
  schema?: any;
  error?: string;
  source?: string;
}> {
  // Try multiple endpoints in order of preference
  const endpoints = [
    { path: `/api/v1/credentials/schema/${encodeURIComponent(credentialType)}`, name: 'public-api' },
    { path: `/rest/credential-types/${encodeURIComponent(credentialType)}`, name: 'internal-rest' },
  ];

  for (const endpoint of endpoints) {
    const result = await n8nFetch<any>({
      instanceUrl,
      apiKey,
      path: endpoint.path,
      timeout: 5000, // 5 second timeout per endpoint
    });

    if (result.success && result.data) {
      console.log(`[OAuth Schema] Fetched schema for ${credentialType} from ${endpoint.name}`);
      return { schema: result.data, source: endpoint.name };
    }
  }

  // All endpoints failed - return hardcoded fallback if available
  const knownSchema = KNOWN_OAUTH2_SCHEMAS[credentialType] || KNOWN_OAUTH2_SCHEMAS['_default'];
  console.log(`[OAuth Schema] Using hardcoded schema for ${credentialType} (${knownSchema.length} properties)`);
  return {
    schema: {
      properties: Object.fromEntries(knownSchema.map(prop => [prop, { type: 'string' }])),
    },
    source: 'hardcoded-fallback',
  };
}

/**
 * Build OAuth2 credential data that conforms to the n8n schema for the credential type
 *
 * Strategy (tiered fallbacks):
 * 1. Try to fetch schema from n8n API (multiple endpoints)
 * 2. Use hardcoded schema for known credential types
 * 3. Include all provided properties (permissive fallback)
 *
 * This ensures maximum compatibility across n8n versions and node types.
 */
export async function buildOAuth2CredentialData(
  instanceUrl: string,
  apiKey: string,
  credentialType: string,
  providedData: {
    clientId: string;
    clientSecret: string;
    oauthTokenData: Record<string, any>;
    serverUrl?: string;
    allowedDomains?: string;
    sendAdditionalBodyProperties?: boolean;
    additionalBodyProperties?: any;
    [key: string]: any; // Allow additional provider-specific properties
  }
): Promise<Record<string, any>> {
  // Try to fetch the schema for this credential type (includes hardcoded fallbacks)
  const { schema, source } = await fetchN8nCredentialSchema(
    instanceUrl,
    apiKey,
    credentialType
  );

  // Always start with required core properties + working Google OAuth defaults
  const credentialData: Record<string, any> = {
    clientId: providedData.clientId,
    clientSecret: providedData.clientSecret,
    oauthTokenData: providedData.oauthTokenData,
    // Required by n8n's OAuth2 credential schema (from commit 196e9634 - GOOGLE WORKING)
    sendAdditionalBodyProperties: false,
    additionalBodyProperties: {},
  };

  // If schema is available (from API or hardcoded), use it to filter properties
  if (schema && schema.properties) {
    const schemaProperties = schema.properties;

    // Include standard properties if they exist in the schema
    const standardDefaults: Record<string, any> = {
      serverUrl: '',
      allowedDomains: '',
      sendAdditionalBodyProperties: false,
      additionalBodyProperties: {},
    };

    for (const [prop, defaultVal] of Object.entries(standardDefaults)) {
      if (schemaProperties[prop] !== undefined) {
        // Use provided value if available, otherwise use default
        credentialData[prop] = providedData[prop] !== undefined ? providedData[prop] : defaultVal;
      }
    }

    // Add any additional provider-specific properties that are in the schema
    for (const [key, value] of Object.entries(providedData)) {
      // Skip already processed properties
      if (['clientId', 'clientSecret', 'oauthTokenData', ...Object.keys(standardDefaults)].includes(key)) {
        continue;
      }
      // Only add if it's in the schema
      if (schemaProperties[key] !== undefined) {
        credentialData[key] = value;
      }
    }

    console.log(`[OAuth] Built credential data for ${credentialType} from ${source} (${Object.keys(credentialData).length} properties)`);
    return credentialData;
  }

  // Ultimate fallback: schema not available - include all provided properties
  // This is permissive and lets n8n decide what's valid
  console.warn(`[OAuth] No schema available for ${credentialType}, including all provided properties`);
  return { ...providedData };
}

/**
 * Credential type info from n8n
 */
export interface N8nCredentialType {
  name: string;  // Internal name e.g., 'slackOAuth2Api'
  displayName: string;  // Display name e.g., 'Slack OAuth2 API'
  properties?: any[];
  documentationUrl?: string;
  // n8n returns additional fields we may not need
}

/**
 * Fetch all available credential types from n8n instance
 * Returns the list of all credential types that can be created
 * Tries multiple endpoints for compatibility with different n8n versions
 */
export async function fetchN8nCredentialTypes(
  instanceUrl: string,
  apiKey: string
): Promise<{
  credentialTypes: N8nCredentialType[];
  error?: string;
  source?: string; // Which endpoint succeeded
}> {
  // List of endpoints to try in order - n8n has different APIs for different versions/licenses
  const endpoints = [
    { path: '/rest/credential-types', name: 'internal-rest' },      // Internal REST API (most reliable, requires session)
    { path: '/api/v1/credentials/schema', name: 'public-api-schema' }, // Public API schema endpoint
    { path: '/types/credentials.json', name: 'static-types' },      // Static types file (older n8n versions)
  ];

  const errors: string[] = [];

  for (const endpoint of endpoints) {
    const result = await n8nFetch<N8nCredentialType[] | { data: N8nCredentialType[] } | Record<string, any>>({
      instanceUrl,
      apiKey,
      path: endpoint.path,
      timeout: 10000,
    });

    if (result.success && result.data) {
      // Handle different response formats
      let types: N8nCredentialType[] = [];

      if (Array.isArray(result.data)) {
        types = result.data;
      } else if (result.data?.data && Array.isArray(result.data.data)) {
        types = result.data.data;
      } else if (typeof result.data === 'object' && !Array.isArray(result.data)) {
        // Some endpoints return { credentialTypeName: { properties: [...] } }
        types = Object.entries(result.data).map(([name, config]: [string, any]) => ({
          name,
          displayName: config.displayName || formatDisplayName(name),
          properties: config.properties,
          documentationUrl: config.documentationUrl,
        }));
      }

      if (types.length > 0) {
        console.log(`[n8n] Fetched ${types.length} credential types from ${endpoint.name}`);
        return { credentialTypes: types, source: endpoint.name };
      }
    } else {
      errors.push(`${endpoint.name}: ${result.error || 'No data'}`);
    }
  }

  // All endpoints failed - return empty with error
  // The API route will use the fallback list from CREDENTIAL_MAPPINGS
  console.warn('[n8n] Could not fetch credential types from any endpoint:', errors);
  return {
    credentialTypes: [],
    error: `All endpoints failed: ${errors.join('; ')}`,
  };
}

/**
 * Format a credential type name to display name
 */
function formatDisplayName(name: string): string {
  return name
    .replace(/Api$/, '')
    .replace(/OAuth2$/, ' OAuth2')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Create a credential in n8n instance
 * The credential data is sent directly to n8n which handles encryption
 */
export async function createN8nCredential(
  instanceUrl: string,
  apiKey: string,
  credential: {
    type: string;
    name: string;
    data: Record<string, any>;
  }
): Promise<{
  credential?: N8nCredential;
  error?: string;
}> {
  const result = await n8nFetch<N8nCredential>({
    instanceUrl,
    apiKey,
    path: '/api/v1/credentials',
    method: 'POST',
    body: credential,
    timeout: 30000, // 30s timeout for credential creation (critical operation)
  });

  if (!result.success) {
    return { error: result.error };
  }

  return { credential: result.data };
}

/**
 * Delete a credential from n8n instance
 */
export async function deleteN8nCredential(
  instanceUrl: string,
  apiKey: string,
  credentialId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const result = await n8nFetch({
    instanceUrl,
    apiKey,
    path: `/api/v1/credentials/${credentialId}`,
    method: 'DELETE',
  });

  return { success: result.success, error: result.error };
}

/**
 * Get documentation URL for a credential type
 * n8n docs follow a consistent URL pattern
 */
export function getCredentialDocUrl(credentialType: string): string {
  // Map credential type to documentation slug
  const typeToSlug: Record<string, string> = {
    // Google services
    'googleSheetsOAuth2Api': 'google',
    'gmailOAuth2': 'google',
    'googleDriveOAuth2Api': 'google',
    'googleCalendarOAuth2Api': 'google',
    // Communication
    'slackOAuth2Api': 'slack',
    'slackApi': 'slack',
    'discordOAuth2Api': 'discord',
    'discordApi': 'discord',
    'telegramApi': 'telegram',
    // Productivity
    'notionOAuth2Api': 'notion',
    'notionApi': 'notion',
    'airtableOAuth2Api': 'airtable',
    'airtableApi': 'airtable',
    'asanaOAuth2Api': 'asana',
    // Development
    'githubOAuth2Api': 'github',
    'githubApi': 'github',
    'gitlabOAuth2Api': 'gitlab',
    'gitlabApi': 'gitlab',
    // E-commerce
    'shopifyOAuth2Api': 'shopify',
    'shopifyApi': 'shopify',
    'stripeApi': 'stripe',
    // Marketing
    'hubspotOAuth2Api': 'hubspot',
    'hubspotApi': 'hubspot',
    'mailchimpApi': 'mailchimp',
    // Databases
    'postgres': 'postgres',
    'mySql': 'mysql',
    'mongoDb': 'mongodb',
    'redis': 'redis',
    // AI
    'openAiApi': 'openai',
    'anthropicApi': 'anthropic',
    // HTTP
    'httpHeaderAuth': 'http-request-credentials',
    'httpBasicAuth': 'http-request-credentials',
    'httpDigestAuth': 'http-request-credentials',
    'oAuth2Api': 'http-request-credentials',
  };

  const slug = typeToSlug[credentialType] ||
    credentialType
      .replace(/OAuth2Api$/i, '')
      .replace(/Api$/i, '')
      .toLowerCase()
      .replace(/([A-Z])/g, '-$1')
      .replace(/^-/, '')
      .toLowerCase();

  return `https://docs.n8n.io/integrations/builtin/credentials/${slug}/`;
}

/**
 * Fetch node type information from n8n including parameter descriptions
 * This provides dynamic parameter info for any node type
 */
/**
 * Credential requirement from a node type definition
 */
export interface NodeTypeCredential {
  name: string;      // Credential type (e.g., 'firefliesApi')
  required?: boolean;
  displayName?: string;
}

/**
 * Fetch credential requirements for node types from n8n
 * Note: n8n's node type endpoints require session auth, not API key auth
 * This function attempts multiple endpoints but may not work on all n8n versions
 */
export async function getNodeTypesWithCredentials(
  instanceUrl: string,
  apiKey: string
): Promise<{
  success: boolean;
  nodeCredentials?: Map<string, NodeTypeCredential[]>;
  error?: string;
}> {
  // Try the public API endpoint (n8n 1.x+) - may not work with API key
  const result = await n8nFetch<{ data: any[] } | any[]>({
    instanceUrl,
    apiKey,
    path: '/api/v1/node-types',
    timeout: 10000,
  });

  // Handle both wrapped and unwrapped response formats
  const nodeTypes = result.data && 'data' in result.data
    ? (result.data as { data: any[] }).data
    : (Array.isArray(result.data) ? result.data : null);

  if (!result.success || !nodeTypes) {
    // This is expected - n8n node type endpoints often require session auth
    console.log('[n8n] Node types endpoint not available (requires session auth)');
    return { success: false, error: 'Node types endpoint requires session authentication' };
  }

  const nodeCredentials = new Map<string, NodeTypeCredential[]>();

  for (const nodeType of nodeTypes) {
    if (nodeType.name && nodeType.credentials && Array.isArray(nodeType.credentials)) {
      nodeCredentials.set(nodeType.name, nodeType.credentials.map((c: any) => ({
        name: c.name,
        required: c.required,
        displayName: c.displayName,
      })));
    }
  }

  console.log(`[n8n] Loaded credential info for ${nodeCredentials.size} node types`);
  return { success: true, nodeCredentials };
}

export interface NodeTypeParameter {
  name: string;
  displayName: string;
  type: string;
  description?: string;
  placeholder?: string;
  default?: any;
  required?: boolean;
  options?: Array<{ name: string; value: string; description?: string }>;
}

export interface NodeTypeInfo {
  name: string;
  displayName: string;
  description?: string;
  parameters: NodeTypeParameter[];
}

export async function getNodeTypeInfo(
  instanceUrl: string,
  apiKey: string,
  nodeType: string
): Promise<{ success: boolean; data?: NodeTypeInfo; error?: string }> {
  // n8n's node type API endpoint
  // Try to get node type info - this may not be available on all n8n versions
  const result = await n8nFetch<any>({
    instanceUrl,
    apiKey,
    path: `/api/v1/node-types/${encodeURIComponent(nodeType)}`,
    timeout: 5000,
  });

  if (!result.success) {
    // Fallback: try the older format
    const altResult = await n8nFetch<any>({
      instanceUrl,
      apiKey,
      path: `/types/nodes.json`,
      timeout: 5000,
    });

    if (altResult.success && Array.isArray(altResult.data)) {
      const nodeInfo = altResult.data.find((n: any) => n.name === nodeType);
      if (nodeInfo) {
        return {
          success: true,
          data: {
            name: nodeInfo.name,
            displayName: nodeInfo.displayName || nodeInfo.name,
            description: nodeInfo.description,
            parameters: (nodeInfo.properties || []).map((p: any) => ({
              name: p.name,
              displayName: p.displayName || p.name,
              type: p.type || 'string',
              description: p.description,
              placeholder: p.placeholder,
              default: p.default,
              required: p.required,
              options: p.options,
            })),
          },
        };
      }
    }

    return { success: false, error: result.error || 'Node type not found' };
  }

  const nodeData = result.data;
  return {
    success: true,
    data: {
      name: nodeData.name,
      displayName: nodeData.displayName || nodeData.name,
      description: nodeData.description,
      parameters: (nodeData.properties || []).map((p: any) => ({
        name: p.name,
        displayName: p.displayName || p.name,
        type: p.type || 'string',
        description: p.description,
        placeholder: p.placeholder,
        default: p.default,
        required: p.required,
        options: p.options,
      })),
    },
  };
}
