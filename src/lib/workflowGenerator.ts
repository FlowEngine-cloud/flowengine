/**
 * Enhanced Workflow Generation Engine
 *
 * This module creates clean, connected, functional n8n workflows with:
 * - Mandatory connections for AI agents
 * - Organized node layout
 * - Comprehensive validation
 * - Template-based generation (LEGACY - see below)
 *
 * ⚠️ IMPORTANT: This file contains hardcoded NODE_TEMPLATES for backward compatibility.
 * The SINGLE SOURCE OF TRUTH for available n8n nodes is:
 * → /src/lib/n8n/nodeCategories.generated.ts
 *
 * New features should use nodeRegistry from nodeCategories.generated.ts instead of
 * expanding NODE_TEMPLATES.
 */

import { v4 as uuidv4 } from 'uuid';
import { validateWithN8n } from './n8n/localValidator';

/**
 * Node type constants from n8n-workflow
 *
 * These constants are defined directly because n8n-workflow has Node.js dependencies
 * (os, timers, xml2js, recast) that cannot be bundled for Next.js browser/edge runtime.
 *
 * Values sourced from: node_modules/n8n-workflow/dist/cjs/constants.js
 * To verify/update: run `node -e "const c = require('n8n-workflow'); console.log(c.MANUAL_TRIGGER_NODE_TYPE)"`
 */
const n8nWorkflow = {
  MANUAL_TRIGGER_NODE_TYPE: 'n8n-nodes-base.manualTrigger',
  MANUAL_CHAT_TRIGGER_LANGCHAIN_NODE_TYPE: '@n8n/n8n-nodes-langchain.manualChatTrigger',
  // Chat Trigger - can be made PUBLIC for production chatbots (different from manualChatTrigger which is for testing)
  CHAT_TRIGGER_LANGCHAIN_NODE_TYPE: '@n8n/n8n-nodes-langchain.chatTrigger',
  AGENT_LANGCHAIN_NODE_TYPE: '@n8n/n8n-nodes-langchain.agent',
  OPENAI_LANGCHAIN_NODE_TYPE: '@n8n/n8n-nodes-langchain.openAi',
  CHAIN_LLM_LANGCHAIN_NODE_TYPE: '@n8n/n8n-nodes-langchain.chainLlm',
  CHAIN_SUMMARIZATION_LANGCHAIN_NODE_TYPE: '@n8n/n8n-nodes-langchain.chainSummarization',
  CODE_TOOL_LANGCHAIN_NODE_TYPE: '@n8n/n8n-nodes-langchain.toolCode',
  HTTP_REQUEST_TOOL_LANGCHAIN_NODE_TYPE: '@n8n/n8n-nodes-langchain.toolHttpRequest',
  WORKFLOW_TOOL_LANGCHAIN_NODE_TYPE: '@n8n/n8n-nodes-langchain.toolWorkflow',
};

export interface WorkflowGenerationRequest {
  description: string;
  nodeTypes?: string[];
  includeAIAgent?: boolean;
  layoutType?: 'linear' | 'branched' | 'parallel';
  triggers?: string[];
  actions?: string[];
}

export interface GeneratedWorkflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnections;
  meta: {
    instanceId: string;
  };
  active: boolean;
  settings: Record<string, any>;
}

/**
 * n8n Workflow Node structure
 * IMPORTANT: Property order matters for n8n API import
 * Expected order: parameters, id, name, type, position, typeVersion, webhookId
 */
export interface WorkflowNode {
  parameters: Record<string, any>;
  id: string;
  name: string;
  type: string;
  position: [number, number];
  typeVersion?: number;  // Optional - n8n auto-generates if omitted
  webhookId?: string;    // Optional - n8n assigns after activation
  credentials?: Record<string, any>;
}

export interface WorkflowConnections {
  [sourceNodeName: string]: {
    [connectionType: string]: Array<Array<{
      node: string;
      type: string;
      index: number;
    }>>;
  };
}

export interface LayoutConfiguration {
  startX: number;
  startY: number;
  horizontalSpacing: number;
  verticalSpacing: number;
  rowHeight: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  autofixed: boolean;
  workflow?: GeneratedWorkflow;
}

/**
 * Main Workflow Generation Engine
 */
export class WorkflowGenerator {
  private static readonly DEFAULT_LAYOUT: LayoutConfiguration = {
    startX: 100,
    startY: 200,
    horizontalSpacing: 250,
    verticalSpacing: 120,
    rowHeight: 160
  };

  /**
   * @deprecated This is a LEGACY hardcoded template system.
   *
   * ⚠️ DO NOT EXPAND THIS LIST - it creates bloat and maintenance burden.
   *
   * The SINGLE SOURCE OF TRUTH for available n8n nodes is:
   * → /src/lib/n8n/nodeCategories.generated.ts
   *
   * This template list is kept only for backward compatibility with
   * WorkflowGenerator's internal usage. All NEW code should use
   * nodeCategories.generated.ts instead.
   *
   * Future TODO: Refactor WorkflowGenerator to use nodeRegistry dynamically.
   */
  private static readonly NODE_TEMPLATES = {
    // ===== TRIGGERS =====
    MANUAL_TRIGGER: {
      type: n8nWorkflow.MANUAL_TRIGGER_NODE_TYPE,
      name: 'Manual Trigger',
      parameters: {},
      position: 'trigger'
    },
    MANUAL_CHAT_TRIGGER: {
      type: n8nWorkflow.MANUAL_CHAT_TRIGGER_LANGCHAIN_NODE_TYPE,
      name: 'Manual Chat Trigger',
      parameters: {},
      position: 'trigger'
    },
    // Chat Trigger - PUBLIC endpoint for production chatbots (different from manualChatTrigger which is for testing)
    // URL format: /webhook/{path}/chat (note the /chat suffix)
    CHAT_TRIGGER: {
      type: n8nWorkflow.CHAT_TRIGGER_LANGCHAIN_NODE_TYPE,
      name: 'When chat message received',
      typeVersion: 1.4,
      parameters: {
        public: true,  // Makes it accessible without authentication
        path: 'chat',  // Default webhook path - creates /webhook/chat/chat endpoint
        options: {}
      },
      position: 'trigger'
    },
    WEBHOOK: {
      type: 'n8n-nodes-base.webhook',
      name: 'Webhook Trigger',
      parameters: {
        httpMethod: 'POST',
        path: 'webhook'
      },
      position: 'trigger'
    },
    SCHEDULE_TRIGGER: {
      type: 'n8n-nodes-base.scheduleTrigger',
      name: 'Schedule Trigger',
      parameters: {
        rule: {
          interval: [{ field: 'hours', hoursInterval: 1 }]
        }
      },
      position: 'trigger'
    },
    CRON_TRIGGER: {
      type: 'n8n-nodes-base.cron',
      name: 'Cron Trigger',
      parameters: {
        cronExpression: '0 0 * * *'
      },
      position: 'trigger'
    },
    FORM_TRIGGER: {
      type: 'n8n-nodes-base.formTrigger',
      name: 'Form Trigger',
      typeVersion: 1,
      parameters: {
        path: 'contact-form',
        formTitle: 'Contact Form',
        formDescription: 'Please fill out the form',
        formFields: {
          values: [
            { fieldLabel: 'Name', fieldType: 'text', requiredField: true, placeholder: 'Your name' },
            { fieldLabel: 'Email', fieldType: 'email', requiredField: true, placeholder: 'Your email' },
            { fieldLabel: 'Message', fieldType: 'textarea', requiredField: false, placeholder: 'Your message' }
          ]
        },
        options: {}
      },
      position: 'trigger'
    },
    ERROR_TRIGGER: {
      type: 'n8n-nodes-base.errorTrigger',
      name: 'Error Trigger',
      parameters: {},
      position: 'trigger'
    },

    // ===== AI AGENTS & MODELS =====
    AI_AGENT: {
      type: n8nWorkflow.AGENT_LANGCHAIN_NODE_TYPE,
      name: 'AI Agent',
      typeVersion: 3.1, // n8n v2.x requires 3.1 for proper import
      parameters: {
        agent: 'conversationalAgent',
        promptType: 'auto',
        systemMessage: 'You are a helpful AI assistant.'
      },
      position: 'main',
      requires: ['language_model', 'tools']
    },
    // ⭐ FLOWENGINE LLM - PREFERRED DEFAULT (pre-configured, no API key needed)
    FLOWENGINE_LLM: {
      type: 'CUSTOM.flowEngineLlm',
      typeVersion: 1,
      name: 'FlowEngine LLM Chat Model',
      parameters: {
        provider: 'openai',
        model: 'gpt-5-nano',
        options: {}
      },
      position: 'support',
      connectionType: 'ai_languageModel'
    },
    OPENAI_LLM: {
      type: n8nWorkflow.OPENAI_LANGCHAIN_NODE_TYPE,
      name: 'OpenAI Chat Model',
      parameters: {
        options: {}  // User configures model in n8n UI
      },
      position: 'support',
      connectionType: 'ai_languageModel'
    },
    OPENAI_CHAT_MODEL: {
      type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
      name: 'OpenAI Chat Model',
      parameters: {
        options: {}  // User configures model in n8n UI
      },
      position: 'support',
      connectionType: 'ai_languageModel'
    },
    ANTHROPIC_CHAT_MODEL: {
      type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
      name: 'Anthropic Chat Model',
      parameters: {
        options: {}  // User configures model in n8n UI
      },
      position: 'support',
      connectionType: 'ai_languageModel'
    },
    GOOGLE_GEMINI_CHAT_MODEL: {
      type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
      name: 'Google Gemini Chat Model',
      parameters: {
        options: {}  // User configures model in n8n UI
      },
      position: 'support',
      connectionType: 'ai_languageModel'
    },
    GROQ_CHAT_MODEL: {
      type: '@n8n/n8n-nodes-langchain.lmChatGroq',
      name: 'Groq Chat Model',
      parameters: {
        options: {}  // User configures model in n8n UI
      },
      position: 'support',
      connectionType: 'ai_languageModel'
    },
    OLLAMA_CHAT_MODEL: {
      type: '@n8n/n8n-nodes-langchain.lmChatOllama',
      name: 'Ollama Chat Model',
      parameters: {
        options: {}  // User configures model in n8n UI
      },
      position: 'support',
      connectionType: 'ai_languageModel'
    },
    SIMPLE_MEMORY: {
      parameters: {
        sessionIdOption: 'fromInput',
        contextWindowLength: 10
      },
      type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
      position: 'support',
      connectionType: 'ai_memory',
      name: 'Simple Memory',
      typeVersion: 1.3
    },
    CHAIN_LLM: {
      type: n8nWorkflow.CHAIN_LLM_LANGCHAIN_NODE_TYPE,
      name: 'LLM Chain',
      parameters: {},
      position: 'main'
    },
    CHAIN_SUMMARIZATION: {
      type: n8nWorkflow.CHAIN_SUMMARIZATION_LANGCHAIN_NODE_TYPE,
      name: 'Summarization Chain',
      parameters: {},
      position: 'main'
    },

    // ===== AI TOOLS =====
    CODE_TOOL: {
      type: n8nWorkflow.CODE_TOOL_LANGCHAIN_NODE_TYPE,
      name: 'Code Execution Tool',
      parameters: {
        language: 'javascript'
      },
      position: 'support',
      connectionType: 'ai_tool'
    },
    HTTP_TOOL: {
      type: n8nWorkflow.HTTP_REQUEST_TOOL_LANGCHAIN_NODE_TYPE,
      name: 'HTTP Request Tool',
      parameters: {},
      position: 'support',
      connectionType: 'ai_tool'
    },
    WORKFLOW_TOOL: {
      type: n8nWorkflow.WORKFLOW_TOOL_LANGCHAIN_NODE_TYPE,
      name: 'Workflow Tool',
      parameters: {},
      position: 'support',
      connectionType: 'ai_tool'
    },
    SERP_API_TOOL: {
      type: '@n8n/n8n-nodes-langchain.toolSerpApi',
      name: 'SerpAPI Search Tool',
      parameters: {},
      position: 'support',
      connectionType: 'ai_tool'
    },
    CALCULATOR_TOOL: {
      type: '@n8n/n8n-nodes-langchain.toolCalculator',
      name: 'Calculator Tool',
      parameters: {},
      position: 'support',
      connectionType: 'ai_tool'
    },
    WIKIPEDIA_TOOL: {
      type: '@n8n/n8n-nodes-langchain.toolWikipedia',
      name: 'Wikipedia Tool',
      parameters: {},
      position: 'support',
      connectionType: 'ai_tool'
    },

    // ===== CORE PROCESSING =====
    SET_NODE: {
      type: 'n8n-nodes-base.set',
      name: 'Set Data',
      parameters: {
        values: {}
      },
      position: 'main'
    },
    CODE: {
      type: 'n8n-nodes-base.code',
      name: 'Code',
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: ''
      },
      position: 'main'
    },
    FUNCTION: {
      type: 'n8n-nodes-base.function',
      name: 'Function',
      parameters: {},
      position: 'main'
    },
    FUNCTION_ITEM: {
      type: 'n8n-nodes-base.functionItem',
      name: 'Function Item',
      parameters: {},
      position: 'main'
    },
    HTTP_REQUEST: {
      type: 'n8n-nodes-base.httpRequest',
      name: 'HTTP Request',
      parameters: {
        method: 'GET',
        url: ''
      },
      position: 'main'
    },
    MERGE: {
      type: 'n8n-nodes-base.merge',
      name: 'Merge',
      parameters: {
        mode: 'append'
      },
      position: 'main'
    },
    AI_TRANSFORM: {
      type: 'n8n-nodes-base.aiTransform',
      name: 'AI Transform',
      parameters: {},
      position: 'main'
    },
    WAIT: {
      type: 'n8n-nodes-base.wait',
      name: 'Wait',
      parameters: {
        resume: 'webhook'
      },
      position: 'main'
    },
    NO_OP: {
      type: 'n8n-nodes-base.noOp',
      name: 'No Operation',
      parameters: {},
      position: 'main'
    },

    // ===== CONTROL FLOW NODES (Advanced Patterns) =====
    IF_NODE: {
      type: 'n8n-nodes-base.if',
      name: 'Decision Router',
      parameters: {
        conditions: {
          string: [{
            value1: '={{ $json.decision }}',
            operation: 'contains'
          }]
        }
      },
      position: 'main'
    },
    SWITCH_NODE: {
      type: 'n8n-nodes-base.switch',
      name: 'Multi-way Router',
      parameters: {
        mode: 'expression',
        output: 'multiplex',
        rules: {
          rules: [
            { value: 'option1' },
            { value: 'option2' },
            { value: 'option3' }
          ]
        }
      },
      position: 'main'
    },
    LOOP_NODE: {
      type: 'n8n-nodes-base.splitInBatches',
      name: 'Loop Control',
      parameters: {
        batchSize: 1,
        options: {
          reset: false
        }
      },
      position: 'main'
    },
    WAIT_FOR_WEBHOOK: {
      type: 'n8n-nodes-base.wait',
      name: 'Wait for Approval',
      parameters: {
        resume: 'webhook',
        options: {}
      },
      position: 'main'
    },
    SLACK_APPROVAL: {
      type: 'n8n-nodes-base.slack',
      name: 'Send Slack Approval',
      parameters: {
        resource: 'message',
        operation: 'post',
        text: '={{ "Approval needed: " + $json.summary }}'
      },
      position: 'main'
    },

    // ===== COMMUNICATION =====
    GMAIL: {
      type: 'n8n-nodes-base.gmail',
      name: 'Gmail',
      parameters: {
        operation: 'send'
      },
      position: 'action'
    },
    SLACK: {
      type: 'n8n-nodes-base.slack',
      name: 'Slack',
      parameters: {
        operation: 'postMessage'
      },
      position: 'action'
    },
    DISCORD: {
      type: 'n8n-nodes-base.discord',
      name: 'Discord',
      parameters: {
        operation: 'sendMessage'
      },
      position: 'action'
    },
    MICROSOFT_TEAMS: {
      type: 'n8n-nodes-base.microsoftTeams',
      name: 'Microsoft Teams',
      parameters: {
        operation: 'postMessage'
      },
      position: 'action'
    },
    TELEGRAM: {
      type: 'n8n-nodes-base.telegram',
      name: 'Telegram',
      parameters: {
        operation: 'sendMessage'
      },
      position: 'action'
    },

    // ===== SOCIAL MEDIA =====
    TWITTER: {
      type: 'n8n-nodes-base.twitter',
      name: 'Twitter',
      parameters: {
        operation: 'tweet'
      },
      position: 'action'
    },
    LINKEDIN: {
      type: 'n8n-nodes-base.linkedIn',
      name: 'LinkedIn',
      parameters: {
        operation: 'post'
      },
      position: 'action'
    },
    FACEBOOK: {
      type: 'n8n-nodes-base.facebookPages',
      name: 'Facebook Pages',
      parameters: {
        operation: 'post'
      },
      position: 'action'
    },
    INSTAGRAM: {
      type: 'n8n-nodes-base.instagram',
      name: 'Instagram',
      parameters: {
        operation: 'post'
      },
      position: 'action'
    },

    // ===== PRODUCTIVITY =====
    GOOGLE_SHEETS: {
      type: 'n8n-nodes-base.googleSheets',
      name: 'Google Sheets',
      parameters: {
        operation: 'append'
      },
      position: 'action'
    },
    GOOGLE_DOCS: {
      type: 'n8n-nodes-base.googleDocs',
      name: 'Google Docs',
      parameters: {
        operation: 'get'
      },
      position: 'action'
    },
    GOOGLE_DRIVE: {
      type: 'n8n-nodes-base.googleDrive',
      name: 'Google Drive',
      parameters: {
        operation: 'upload'
      },
      position: 'action'
    },
    NOTION: {
      type: 'n8n-nodes-base.notion',
      name: 'Notion',
      parameters: {
        operation: 'create'
      },
      position: 'action'
    },
    AIRTABLE: {
      type: 'n8n-nodes-base.airtable',
      name: 'Airtable',
      parameters: {
        operation: 'append'
      },
      position: 'action'
    },
    TRELLO: {
      type: 'n8n-nodes-base.trello',
      name: 'Trello',
      parameters: {
        operation: 'createCard'
      },
      position: 'action'
    },
    ASANA: {
      type: 'n8n-nodes-base.asana',
      name: 'Asana',
      parameters: {
        operation: 'create'
      },
      position: 'action'
    },

    // ===== DEVELOPMENT =====
    GITHUB: {
      type: 'n8n-nodes-base.github',
      name: 'GitHub',
      parameters: {
        operation: 'getIssue'
      },
      position: 'action'
    },
    GITLAB: {
      type: 'n8n-nodes-base.gitLab',
      name: 'GitLab',
      parameters: {
        operation: 'getIssue'
      },
      position: 'action'
    },
    JIRA: {
      type: 'n8n-nodes-base.jira',
      name: 'Jira',
      parameters: {
        operation: 'getIssue'
      },
      position: 'action'
    },

    // ===== DATABASES =====
    MYSQL: {
      type: 'n8n-nodes-base.mySql',
      name: 'MySQL',
      parameters: {
        operation: 'executeQuery'
      },
      position: 'action'
    },
    POSTGRES: {
      type: 'n8n-nodes-base.postgres',
      name: 'PostgreSQL',
      parameters: {
        operation: 'executeQuery'
      },
      position: 'action'
    },
    MONGODB: {
      type: 'n8n-nodes-base.mongoDb',
      name: 'MongoDB',
      parameters: {
        operation: 'find'
      },
      position: 'action'
    },
    REDIS: {
      type: 'n8n-nodes-base.redis',
      name: 'Redis',
      parameters: {
        operation: 'get'
      },
      position: 'action'
    },

    // ===== CLOUD STORAGE =====
    AWS_S3: {
      type: 'n8n-nodes-base.awsS3',
      name: 'AWS S3',
      parameters: {
        operation: 'upload'
      },
      position: 'action'
    },
    DROPBOX: {
      type: 'n8n-nodes-base.dropbox',
      name: 'Dropbox',
      parameters: {
        operation: 'upload'
      },
      position: 'action'
    },

    // ===== E-COMMERCE =====
    SHOPIFY: {
      type: 'n8n-nodes-base.shopify',
      name: 'Shopify',
      parameters: {
        operation: 'getAll'
      },
      position: 'action'
    },
    STRIPE: {
      type: 'n8n-nodes-base.stripe',
      name: 'Stripe',
      parameters: {
        operation: 'get'
      },
      position: 'action'
    },

    // ===== CRM =====
    HUBSPOT: {
      type: 'n8n-nodes-base.hubspot',
      name: 'HubSpot',
      parameters: {
        operation: 'get'
      },
      position: 'action'
    },
    SALESFORCE: {
      type: 'n8n-nodes-base.salesforce',
      name: 'Salesforce',
      parameters: {
        operation: 'getSObject'
      },
      position: 'action'
    },

    // ===== ANALYTICS =====
    GOOGLE_ANALYTICS: {
      type: 'n8n-nodes-base.googleAnalytics',
      name: 'Google Analytics',
      parameters: {
        operation: 'getReport'
      },
      position: 'action'
    },

    // ===== FILE PROCESSING =====
    PDF: {
      type: 'n8n-nodes-base.pdf',
      name: 'PDF',
      parameters: {
        operation: 'read'
      },
      position: 'main'
    },
    CSV: {
      type: 'n8n-nodes-base.csv',
      name: 'CSV',
      parameters: {
        operation: 'read'
      },
      position: 'main'
    },
    XML: {
      type: 'n8n-nodes-base.xml',
      name: 'XML',
      parameters: {
        operation: 'parse'
      },
      position: 'main'
    },
    JSON: {
      type: 'n8n-nodes-base.json',
      name: 'JSON',
      parameters: {
        operation: 'parse'
      },
      position: 'main'
    },

    // ===== WORKFLOW CONTROL =====
    EXECUTE_WORKFLOW: {
      type: 'n8n-nodes-base.executeWorkflow',
      name: 'Execute Workflow',
      parameters: {},
      position: 'main'
    },
    EXECUTE_WORKFLOW_TRIGGER: {
      type: 'n8n-nodes-base.executeWorkflowTrigger',
      name: 'Execute Workflow Trigger',
      parameters: {},
      position: 'trigger'
    },
    FORM: {
      type: 'n8n-nodes-base.form',
      name: 'Form',
      parameters: {},
      position: 'main'
    },
    STICKY_NOTE: {
      type: 'n8n-nodes-base.stickyNote',
      name: 'Sticky Note',
      parameters: {},
      position: 'main'
    },
    START: {
      type: 'n8n-nodes-base.start',
      name: 'Start',
      parameters: {},
      position: 'trigger'
    }
  };

  /**
   * Generate a complete, functional workflow based on the request
   */
  static async generateWorkflow(request: WorkflowGenerationRequest): Promise<ValidationResult> {
    try {
      console.log('[WORKFLOW_GENERATOR] Starting workflow generation:', request);

      // Step 1: Create basic workflow structure
      const workflow = this.createBaseWorkflow(request);

      // Step 2: Add nodes based on request
      const nodes = this.generateNodes(request);
      workflow.nodes = nodes;

      // Step 3: Create proper connections
      const connections = this.generateConnections(nodes);
      workflow.connections = connections;

      // Step 4: Apply organized layout
      this.applyLayout(workflow.nodes, request.layoutType || 'linear');

      // Step 5: Validate and auto-fix
      const validationResult = await this.validateAndFix(workflow);

      console.log('[WORKFLOW_GENERATOR] Generation complete:', {
        nodeCount: workflow.nodes.length,
        connectionCount: Object.keys(workflow.connections).length,
        isValid: validationResult.isValid
      });

      return validationResult;

    } catch (error) {
      console.error('[WORKFLOW_GENERATOR] Generation failed:', error);
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown generation error'],
        warnings: [],
        autofixed: false
      };
    }
  }

  /**
   * Extract the main task/purpose from workflow description
   */
  private static extractTaskFromDescription(description: string): string {
    const lowerDesc = description.toLowerCase();

    if (lowerDesc.includes('research') || lowerDesc.includes('search')) return 'research and information gathering';
    if (lowerDesc.includes('data') || lowerDesc.includes('analyz')) return 'data analysis and insights';
    if (lowerDesc.includes('email') || lowerDesc.includes('gmail')) return 'email management and processing';
    if (lowerDesc.includes('customer') || lowerDesc.includes('support')) return 'customer support and assistance';
    if (lowerDesc.includes('schedule') || lowerDesc.includes('calendar')) return 'scheduling and calendar management';
    if (lowerDesc.includes('write') || lowerDesc.includes('content')) return 'content creation and writing';

    return 'general task automation';
  }

  /**
   * Get human-readable description for a tool type
   */
  private static getToolDescription(toolType: string): string {
    const toolMap: Record<string, string> = {
      'code': 'Execute custom code for calculations and data processing',
      'http': 'Make HTTP requests to external APIs',
      'workflow': 'Execute sub-workflows for complex operations',
      'calculator': 'Perform mathematical calculations',
      'wikipedia': 'Search Wikipedia for factual information',
      'serpapi': 'Search the web using Google Search',
    };

    return toolMap[toolType] || `Use ${toolType} tool`;
  }

  /**
   * Build intelligent system prompt based on workflow context
   * Uses user intent, workflow pattern, and available tools
   */
  private static buildIntelligentSystemPrompt(
    agentName: string,
    workflowDescription: string,
    workflowPattern: 'SINGLE_AGENT' | 'MULTI_AGENT_SEQUENTIAL' | 'MULTI_AGENT_HIERARCHICAL',
    availableTools: string[]
  ): string {
    // Base prompt structure
    const baseRole = `You are ${agentName}, an AI assistant specialized in ${this.extractTaskFromDescription(workflowDescription)}.`;

    // Add role-specific guidance
    let roleGuidance = '\n\nYour responsibilities:\n';

    // Intelligent guidance based on workflow pattern
    if (workflowPattern === 'SINGLE_AGENT') {
      roleGuidance += '- Handle the complete user request from start to finish\n';
      roleGuidance += '- Use available tools efficiently to gather information\n';
      roleGuidance += '- Provide clear, comprehensive responses\n';
    } else if (workflowPattern === 'MULTI_AGENT_SEQUENTIAL') {
      roleGuidance += '- Focus on your specific task in the workflow chain\n';
      roleGuidance += '- Pass relevant context to the next agent\n';
      roleGuidance += '- Be concise but thorough in your analysis\n';
    } else if (workflowPattern === 'MULTI_AGENT_HIERARCHICAL') {
      roleGuidance += '- Delegate specialized tasks to appropriate sub-agents\n';
      roleGuidance += '- Coordinate and synthesize results from specialists\n';
      roleGuidance += '- Make intelligent decisions about which agents to invoke\n';
    }

    // Add tool capabilities
    if (availableTools.length > 0) {
      roleGuidance += '\nAvailable capabilities:\n';
      availableTools.forEach(tool => {
        roleGuidance += `- ${this.getToolDescription(tool)}\n`;
      });
    }

    // Add behavioral guidance
    const behaviorGuidance = '\n\nBehavioral guidelines:\n' +
      '- Be accurate and cite sources when relevant\n' +
      '- Ask clarifying questions if the request is ambiguous\n' +
      '- Use tools efficiently without unnecessary repetition\n' +
      '- Provide structured, easy-to-understand responses\n';

    return baseRole + roleGuidance + behaviorGuidance;
  }

  /**
   * Generate contextual agent name based on workflow purpose
   */
  private static generateAgentName(
    workflowDescription: string,
    agentIndex: number = 0,
    totalAgents: number = 1
  ): string {
    const lowerDesc = workflowDescription.toLowerCase();

    // Single agent - use primary purpose
    if (totalAgents === 1) {
      if (lowerDesc.includes('research')) return 'Research Assistant';
      if (lowerDesc.includes('email') || lowerDesc.includes('gmail')) return 'Email Manager';
      if (lowerDesc.includes('customer') || lowerDesc.includes('support')) return 'Customer Support Agent';
      if (lowerDesc.includes('data') || lowerDesc.includes('analyz')) return 'Data Analyst';
      if (lowerDesc.includes('schedule') || lowerDesc.includes('calendar')) return 'Scheduling Assistant';
      if (lowerDesc.includes('write') || lowerDesc.includes('content')) return 'Content Writer';
      return 'AI Assistant';
    }

    // Multi-agent - use role-based names
    const roles = [
      'Intake Specialist',
      'Processing Agent',
      'Analysis Expert',
      'Output Coordinator'
    ];

    return roles[agentIndex] || `Agent ${agentIndex + 1}`;
  }

  /**
   * Generate a complete agent cluster (agent + model + memory)
   * This function works for ANY agent (single or multi-agent workflow)
   */
  private static generateAgentCluster(
    agentName: string,
    systemMessage: string,
    options: {
      modelType?: 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama';
      position?: { x: number; y: number };
      workflowDescription?: string;
      workflowPattern?: 'SINGLE_AGENT' | 'MULTI_AGENT_SEQUENTIAL' | 'MULTI_AGENT_HIERARCHICAL';
      tools?: string[];
      includeMemory?: boolean;  // If true, include memory node
    } = {}
  ): {
    agent: WorkflowNode;
    model: WorkflowNode;
    memory: WorkflowNode | null;  // Memory is optional
  } {
    const baseX = options.position?.x || 0;
    const baseY = options.position?.y || 0;

    // BUILD INTELLIGENT PROMPT if context provided
    const enhancedSystemMessage = options.workflowDescription
      ? this.buildIntelligentSystemPrompt(
          agentName,
          options.workflowDescription,
          options.workflowPattern || 'SINGLE_AGENT',
          options.tools || []
        )
      : systemMessage;  // Fallback to provided message

    // 1. Create agent node with ENHANCED system message
    // Use promptType: 'auto' with options.systemMessage for static prompts (recommended)
    const agent = this.createNode('AI_AGENT', {
      customName: agentName,
      parameters: {
        agent: 'conversationalAgent',
        promptType: 'auto',
        options: {
          systemMessage: enhancedSystemMessage
        }
      }
    });
    agent.position = [baseX, baseY];

    // 2. Create model node (positioned below-left of agent)
    // Default to FlowEngine LLM (pre-configured, no API key needed)
    const modelType = options.modelType || 'flowengine';
    let modelTemplate = 'FLOWENGINE_LLM';
    let modelName = `${agentName} Model`;

    switch (modelType) {
      case 'flowengine':
        modelTemplate = 'FLOWENGINE_LLM';
        break;
      case 'openai':
        modelTemplate = 'OPENAI_CHAT_MODEL';
        break;
      case 'anthropic':
        modelTemplate = 'ANTHROPIC_CHAT_MODEL';
        break;
      case 'gemini':
        modelTemplate = 'GOOGLE_GEMINI_CHAT_MODEL';
        break;
      case 'groq':
        modelTemplate = 'GROQ_CHAT_MODEL';
        break;
      case 'ollama':
        modelTemplate = 'OLLAMA_CHAT_MODEL';
        break;
    }

    const model = this.createNode(modelTemplate, {
      customName: modelName
    });
    model.position = [baseX - 272, baseY + 192];

    // 3. Create memory node ONLY if explicitly requested
    // Memory is OPTIONAL - only for multi-turn conversations
    let memory: WorkflowNode | null = null;
    if (options.includeMemory === true) {
      memory = this.createNode('SIMPLE_MEMORY', {
        customName: `${agentName} Memory`
      });
      memory.position = [baseX + 48, baseY + 192];
    }

    return { agent, model, memory };
  }

  /**
   * Generate workflow with N agents (1 = single-agent, 2+ = multi-agent)
   * Uses the SAME agent cluster generation for all agents
   */
  static generateCompleteAIAgentWorkflow(
    configOrSystemMessage: string | {
      agents: Array<{
        name: string;
        systemMessage: string;
      }>;
      modelType?: 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama';
      tools?: string[];
      triggerType?: 'manual' | 'webhook' | 'gmail';
      outputNodes?: Array<{ type: string; name: string }>;
    },
    tools?: string[],
    options?: {
      model?: 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama';
      enableMultiAgent?: boolean;
      subAgents?: Array<{
        name: string;
        description: string;
        tools: string[];
      }>;
      workflowDescription?: string;
      workflowPattern?: 'SINGLE_AGENT' | 'MULTI_AGENT_SEQUENTIAL' | 'MULTI_AGENT_HIERARCHICAL';
      includeMemory?: boolean;  // Optional - if false, don't add memory node
    }
  ): GeneratedWorkflow {
    // Handle both old and new API
    if (typeof configOrSystemMessage === 'object') {
      // New unified API for multi-agent workflows
      const config = configOrSystemMessage;
      const workflowId = uuidv4();
      const nodes: WorkflowNode[] = [];
      const connections: WorkflowConnections = {};

      // Step 1: Create trigger
      let trigger: WorkflowNode;

      switch (config.triggerType) {
        case 'webhook':
          trigger = this.createNode('WEBHOOK', { customName: 'Webhook Trigger' });
          break;
        case 'gmail':
          trigger = this.createNode('GMAIL', { customName: 'Gmail Trigger' });
          trigger.parameters = { operation: 'trigger' };
          break;
        default:
          trigger = this.createNode('MANUAL_CHAT_TRIGGER', { customName: 'Chat Trigger' });
      }

      trigger.position = [-384, 0];
      nodes.push(trigger);

      // Step 2: Generate N agent clusters (using SAME function for all)
      const agentClusters = config.agents.map((agentConfig, index) => {
        // Position agents based on workflow pattern
        let baseX, baseY;

        if (options?.workflowPattern === 'MULTI_AGENT_SEQUENTIAL') {
          // Sequential: Agents cascade vertically (down)
          baseX = -224; // Same X for all (vertical alignment)
          baseY = index * 400; // 400px vertical spacing between agents
        } else {
          // Hierarchical or default: Agents spread horizontally
          baseX = -224 + (index * 288); // 288px horizontal spacing
          baseY = 0; // Same Y for all (horizontal alignment)
        }

        const cluster = this.generateAgentCluster(
          agentConfig.name,
          agentConfig.systemMessage,
          {
            modelType: config.modelType,
            position: { x: baseX, y: baseY },
            workflowDescription: options?.workflowDescription,
            workflowPattern: options?.workflowPattern,
            tools: config.tools
          }
        );

        // Add all nodes from cluster
        nodes.push(cluster.agent);
        nodes.push(cluster.model);
        if (cluster.memory) {
          nodes.push(cluster.memory);
        }

        return cluster;
      });

      // Step 3: Connect trigger to first agent
      connections[trigger.name] = {
        main: [[{
          node: agentClusters[0].agent.name,
          type: 'main',
          index: 0
        }]]
      };

      // Step 4: Connect each agent's model and memory
      agentClusters.forEach((cluster) => {
        // Model → Agent (ai_languageModel)
        connections[cluster.model.name] = {
          ai_languageModel: [[{
            node: cluster.agent.name,
            type: 'ai_languageModel',
            index: 0
          }]]
        };

        // Memory → Agent (ai_memory) - only if memory exists
        if (cluster.memory) {
          connections[cluster.memory.name] = {
            ai_memory: [[{
              node: cluster.agent.name,
              type: 'ai_memory',
              index: 0
            }]]
          };
        }
      });

      // Step 5: Chain agents together (Agent1 → Agent2 → Agent3 → ...)
      for (let i = 0; i < agentClusters.length - 1; i++) {
        const currentAgent = agentClusters[i].agent;
        const nextAgent = agentClusters[i + 1].agent;

        connections[currentAgent.name] = {
          main: [[{
            node: nextAgent.name,
            type: 'main',
            index: 0
          }]]
        };
      }

      // Step 6: Add output nodes (if specified)
      if (config.outputNodes && config.outputNodes.length > 0) {
        const lastAgent = agentClusters[agentClusters.length - 1].agent;
        const outputNode = this.createNode('SET_NODE', {
          customName: config.outputNodes[0].name
        });

        outputNode.position = [
          lastAgent.position[0] + 288,
          lastAgent.position[1]
        ];

        nodes.push(outputNode);

        // Connect last agent to output
        connections[lastAgent.name] = {
          main: [[{
            node: outputNode.name,
            type: 'main',
            index: 0
          }]]
        };
      }

      return {
        id: workflowId,
        name: `Multi-Agent Workflow (${config.agents.length} agents)`,
        nodes,
        connections,
        meta: {
          instanceId: uuidv4()
        },
        active: false,
        settings: {}
      };
    }

    // OLD API - Keep for backwards compatibility
    const systemMessage = configOrSystemMessage as string;
    const toolsList = tools || [];  // No default tools - only add if explicitly requested
    const opts = options || {};

    const workflowId = uuidv4();
    const nodes: WorkflowNode[] = [];
    const connections: WorkflowConnections = {};

    // 1. Chat Trigger
    const chatTrigger = this.createNode('MANUAL_CHAT_TRIGGER', {
      customName: 'Chat Trigger'
    });
    nodes.push(chatTrigger);

    // 2. AI Agent with intelligent system message
    const workflowDescription = opts.workflowDescription || 'general task automation';
    const workflowPattern = opts.workflowPattern || 'SINGLE_AGENT';

    // Build intelligent system message if description provided
    const enhancedSystemMessage = opts.workflowDescription
      ? this.buildIntelligentSystemPrompt(
          this.generateAgentName(workflowDescription, 0, 1),
          workflowDescription,
          workflowPattern,
          toolsList
        )
      : systemMessage;

    const aiAgent = this.createNode('AI_AGENT', {
      customName: opts.workflowDescription ? this.generateAgentName(workflowDescription, 0, 1) : 'AI Assistant',
      parameters: {
        agent: 'conversationalAgent',
        promptType: 'auto',
        options: {
          systemMessage: enhancedSystemMessage
        }
      }
    });
    nodes.push(aiAgent);

    // 3. Language Model (required for AI agent) - support multiple providers
    // Default to FlowEngine LLM (pre-configured, no API key needed)
    const modelType = opts.model || 'flowengine';
    let modelTemplate = 'FLOWENGINE_LLM';
    let modelName = 'FlowEngine LLM Chat Model';

    switch (modelType) {
      case 'flowengine':
        modelTemplate = 'FLOWENGINE_LLM';
        modelName = 'FlowEngine LLM Chat Model';
        break;
      case 'openai':
        modelTemplate = 'OPENAI_CHAT_MODEL';
        modelName = 'OpenAI Chat Model';
        break;
      case 'anthropic':
        modelTemplate = 'ANTHROPIC_CHAT_MODEL';
        modelName = 'Anthropic Chat Model';
        break;
      case 'gemini':
        modelTemplate = 'GOOGLE_GEMINI_CHAT_MODEL';
        modelName = 'Google Gemini Chat Model';
        break;
      case 'groq':
        modelTemplate = 'GROQ_CHAT_MODEL';
        modelName = 'Groq Chat Model';
        break;
      case 'ollama':
        modelTemplate = 'OLLAMA_CHAT_MODEL';
        modelName = 'Ollama Chat Model';
        break;
      default:
        modelTemplate = 'FLOWENGINE_LLM';
        modelName = 'FlowEngine LLM Chat Model';
    }

    const languageModel = this.createNode(modelTemplate, {
      customName: modelName
    });
    nodes.push(languageModel);

    // 4. Memory - only add if EXPLICITLY requested
    // Per n8n best practices: Memory is for multi-turn conversations, NOT single-turn processing
    // - Add memory for: chatbots, conversational agents, multi-turn dialogues
    // - Skip memory for: single question/answer, one-off processing, webhooks
    let memory: WorkflowNode | null = null;
    if (opts.includeMemory === true) {
      memory = this.createNode('SIMPLE_MEMORY', {
        customName: 'Chat Memory'
      });
      nodes.push(memory);
    }

    // 5. Add requested tools (only if explicitly specified)
    const toolNodes: WorkflowNode[] = [];
    toolsList.forEach((toolType, index) => {
      let toolNode: WorkflowNode;
      switch (toolType.toLowerCase()) {
        case 'code':
          toolNode = this.createNode('CODE_TOOL', {
            customName: `Code Tool`
          });
          break;
        case 'http':
          toolNode = this.createNode('HTTP_TOOL', {
            customName: `HTTP Request Tool`
          });
          break;
        case 'workflow':
          toolNode = this.createNode('WORKFLOW_TOOL', {
            customName: `Workflow Tool`
          });
          break;
        case 'calculator':
          toolNode = this.createNode('CALCULATOR_TOOL', {
            customName: `Calculator Tool`
          });
          break;
        case 'wikipedia':
          toolNode = this.createNode('WIKIPEDIA_TOOL', {
            customName: `Wikipedia Tool`
          });
          break;
        case 'agent':
          toolNode = this.createNode('AGENT_TOOL', {
            customName: `Specialist Agent ${index + 1}`
          });
          break;
        default:
          toolNode = this.createNode('CODE_TOOL', {
            customName: `Code Tool`
          });
      }
      toolNodes.push(toolNode);
      nodes.push(toolNode);
    });

    // 6. Add sub-agents if multi-agent is enabled
    if (opts.enableMultiAgent && opts.subAgents && opts.subAgents.length > 0) {
      opts.subAgents.forEach((subAgentConfig, index) => {
        // Create AI Agent Tool for each sub-agent
        const subAgentTool = this.createNode('AGENT_TOOL', {
          customName: subAgentConfig.name,
          parameters: {
            name: subAgentConfig.name,
            description: subAgentConfig.description
          }
        });
        toolNodes.push(subAgentTool);
        nodes.push(subAgentTool);

        // Create sub-agent's AI agent node
        const subAgent = this.createNode('AI_AGENT', {
          customName: `${subAgentConfig.name} (Sub-Agent)`,
          parameters: {
            agent: 'conversationalAgent',
            promptType: 'auto',
            systemMessage: subAgentConfig.description
          }
        });
        nodes.push(subAgent);

        // Create dedicated model for sub-agent
        const subAgentModel = this.createNode(modelTemplate, {
          customName: `${subAgentConfig.name} Model`
        });
        nodes.push(subAgentModel);

        // Memory for sub-agent is optional - only add if sub-agent has tools (suggests complex use case)
        // Simple sub-agents without tools don't need memory
        let subAgentMemory: WorkflowNode | null = null;
        if (subAgentConfig.tools && subAgentConfig.tools.length > 0) {
          subAgentMemory = this.createNode('SIMPLE_MEMORY', {
            customName: `${subAgentConfig.name} Memory`
          });
          nodes.push(subAgentMemory);
        }

        // Add sub-agent's tools
        subAgentConfig.tools.forEach((toolType) => {
          let subAgentToolNode: WorkflowNode;
          switch (toolType.toLowerCase()) {
            case 'code':
              subAgentToolNode = this.createNode('CODE_TOOL', {
                customName: `${subAgentConfig.name} Code Tool`
              });
              break;
            case 'http':
              subAgentToolNode = this.createNode('HTTP_TOOL', {
                customName: `${subAgentConfig.name} HTTP Tool`
              });
              break;
            case 'calculator':
              subAgentToolNode = this.createNode('CALCULATOR_TOOL', {
                customName: `${subAgentConfig.name} Calculator`
              });
              break;
            default:
              subAgentToolNode = this.createNode('CODE_TOOL', {
                customName: `${subAgentConfig.name} Tool`
              });
          }
          nodes.push(subAgentToolNode);

          // Connect sub-agent's tool to sub-agent
          if (!connections[subAgentToolNode.name]) {
            connections[subAgentToolNode.name] = {};
          }
          connections[subAgentToolNode.name].ai_tool = [[{
            node: subAgent.name,
            type: 'ai_tool',
            index: 0
          }]];
        });

        // Connect sub-agent model to sub-agent
        connections[subAgentModel.name] = {
          ai_languageModel: [[{
            node: subAgent.name,
            type: 'ai_languageModel',
            index: 0
          }]]
        };

        // Connect sub-agent memory to sub-agent (only if memory exists)
        if (subAgentMemory) {
          connections[subAgentMemory.name] = {
            ai_memory: [[{
              node: subAgent.name,
              type: 'ai_memory',
              index: 0
            }]]
          };
        }

        // Connect Agent Tool (sub-agent wrapper) to main AI agent and sub-agent
        connections[subAgentTool.name] = {
          ai_tool: [[{
            node: aiAgent.name,
            type: 'ai_tool',
            index: index + toolNodes.length - opts.subAgents!.length
          }]],
          ai_agent: [[{
            node: subAgent.name,
            type: 'main',
            index: 0
          }]]
        };
      });
    }

    // 6. Create mandatory connections
    // Chat trigger -> AI Agent
    connections[chatTrigger.name] = {
      main: [[{
        node: aiAgent.name,
        type: 'main',
        index: 0
      }]]
    };

    // Language Model -> AI Agent
    connections[languageModel.name] = {
      ai_languageModel: [[{
        node: aiAgent.name,
        type: 'ai_languageModel',
        index: 0
      }]]
    };

    // Memory -> AI Agent (only if memory was added)
    if (memory) {
      connections[memory.name] = {
        ai_memory: [[{
          node: aiAgent.name,
          type: 'ai_memory',
          index: 0
        }]]
      };
    }

    // Tools -> AI Agent
    toolNodes.forEach((toolNode, index) => {
      connections[toolNode.name] = {
        ai_tool: [[{
          node: aiAgent.name,
          type: 'ai_tool',
          index: index
        }]]
      };
    });

    // 7. Apply organized layout with proper sub-node positioning
    this.applyAIAgentLayout(nodes, connections, aiAgent);

    return {
      id: workflowId,
      name: 'Complete AI Agent Workflow',
      nodes,
      connections,
      meta: {
        instanceId: uuidv4()
      },
      active: true,
      settings: {}
    };
  }

  /**
   * Create basic workflow structure
   */
  private static createBaseWorkflow(request: WorkflowGenerationRequest): GeneratedWorkflow {
    return {
      id: uuidv4(),
      name: this.generateWorkflowName(request.description),
      nodes: [],
      connections: {},
      meta: {
        instanceId: uuidv4()
      },
      active: true,
      settings: {}
    };
  }

  /**
   * Generate nodes based on request
   */
  private static generateNodes(request: WorkflowGenerationRequest): WorkflowNode[] {
    const nodes: WorkflowNode[] = [];

    // Always start with a trigger
    const triggerType = this.determineTriggerType(request);
    const trigger = this.createNode(triggerType);
    nodes.push(trigger);

    // Add AI agent if requested
    if (request.includeAIAgent) {
      const aiAgent = this.createNode('AI_AGENT');
      nodes.push(aiAgent);

      // Required: Add language model for AI agent (using proper chat model)
      const languageModel = this.createNode('OPENAI_CHAT_MODEL');
      nodes.push(languageModel);

      // Memory and tools are OPTIONAL - only add if workflow needs them
      // Don't auto-add Code Tool or Memory unless explicitly requested
    }

    // Add processing nodes based on description
    const processingNodes = this.determineProcessingNodes(request);
    nodes.push(...processingNodes);

    // Add action nodes
    const actionNodes = this.determineActionNodes(request);
    nodes.push(...actionNodes);

    // Note: Memory is optional for AI agents - single-turn workflows don't need it
    // Only log for debugging, don't auto-add
    const hasAIAgent = nodes.some(n => n.type === n8nWorkflow.AGENT_LANGCHAIN_NODE_TYPE);
    const hasMemory = nodes.some(n => n.type === '@n8n/n8n-nodes-langchain.memoryBufferWindow');

    if (hasAIAgent && !hasMemory) {
      console.log('[WORKFLOW_GENERATOR] Note: AI Agent without memory (single-turn mode)');
    }

    return nodes;
  }

  /**
   * Generate proper connections between nodes
   */
  private static generateConnections(nodes: WorkflowNode[]): WorkflowConnections {
    const connections: WorkflowConnections = {};

    // Group nodes by type/role
    const triggerNodes = nodes.filter(n => this.getNodeRole(n) === 'trigger');
    const aiAgentNodes = nodes.filter(n => n.type === n8nWorkflow.AGENT_LANGCHAIN_NODE_TYPE);
    const languageModelNodes = nodes.filter(n =>
      n.type === n8nWorkflow.OPENAI_LANGCHAIN_NODE_TYPE ||
      n.type === '@n8n/n8n-nodes-langchain.lmChatOpenAi' ||
      n.type === '@n8n/n8n-nodes-langchain.lmChatAnthropic' ||
      n.type === '@n8n/n8n-nodes-langchain.lmChatGoogleGemini'
    );
    const memoryNodes = nodes.filter(n => n.type === '@n8n/n8n-nodes-langchain.memoryBufferWindow');
    const toolNodes = nodes.filter(n => this.isToolNode(n));
    const processingNodes = nodes.filter(n => this.getNodeRole(n) === 'main' && !this.isAINode(n));
    const actionNodes = nodes.filter(n => this.getNodeRole(n) === 'action');

    // Connect triggers to first processing node or AI agent
    triggerNodes.forEach(trigger => {
      if (aiAgentNodes.length > 0) {
        connections[trigger.name] = {
          main: [[{
            node: aiAgentNodes[0].name,
            type: 'main',
            index: 0
          }]]
        };
      } else if (processingNodes.length > 0) {
        connections[trigger.name] = {
          main: [[{
            node: processingNodes[0].name,
            type: 'main',
            index: 0
          }]]
        };
      } else if (actionNodes.length > 0) {
        connections[trigger.name] = {
          main: [[{
            node: actionNodes[0].name,
            type: 'main',
            index: 0
          }]]
        };
      }
    });

    // Connect language models to AI agents (MANDATORY)
    languageModelNodes.forEach(languageModel => {
      if (aiAgentNodes.length > 0) {
        connections[languageModel.name] = {
          ai_languageModel: [[{
            node: aiAgentNodes[0].name,
            type: 'ai_languageModel',
            index: 0
          }]]
        };
      }
    });

    // Connect memory to AI agents (MANDATORY for conversational agents)
    memoryNodes.forEach(memory => {
      if (aiAgentNodes.length > 0) {
        connections[memory.name] = {
          ai_memory: [[{
            node: aiAgentNodes[0].name,
            type: 'ai_memory',
            index: 0
          }]]
        };
      }
    });

    // Connect tools to AI agents (MANDATORY)
    toolNodes.forEach((tool, index) => {
      if (aiAgentNodes.length > 0) {
        connections[tool.name] = {
          ai_tool: [[{
            node: aiAgentNodes[0].name,
            type: 'ai_tool',
            index: index
          }]]
        };
      }
    });

    // Connect AI agents to next processing or action nodes
    aiAgentNodes.forEach(aiAgent => {
      if (actionNodes.length > 0) {
        if (!connections[aiAgent.name]) connections[aiAgent.name] = {};
        connections[aiAgent.name].main = [[{
          node: actionNodes[0].name,
          type: 'main',
          index: 0
        }]];
      }
    });

    // Connect processing nodes in sequence
    for (let i = 0; i < processingNodes.length - 1; i++) {
      connections[processingNodes[i].name] = {
        main: [[{
          node: processingNodes[i + 1].name,
          type: 'main',
          index: 0
        }]]
      };
    }

    // Connect last processing node to first action node
    if (processingNodes.length > 0 && actionNodes.length > 0) {
      const lastProcessing = processingNodes[processingNodes.length - 1];
      if (!connections[lastProcessing.name]) {
        connections[lastProcessing.name] = {
          main: [[{
            node: actionNodes[0].name,
            type: 'main',
            index: 0
          }]]
        };
      }
    }

    return connections;
  }

  /**
   * Apply AI Agent specific layout - positions sub-nodes correctly
   * In n8n, sub-nodes connect via specific ports BELOW the AI Agent node
   */
  private static applyAIAgentLayout(
    nodes: WorkflowNode[],
    connections: WorkflowConnections,
    mainAgent: WorkflowNode
  ): void {
    // Main agent position - centered higher up so sub-nodes fit below
    const agentX = 900;
    const agentY = 250;
    mainAgent.position = [agentX, agentY];

    // Find trigger nodes - position to the left
    const triggers = nodes.filter(n =>
      n.type.includes('Trigger') || n.type.includes('trigger')
    );
    triggers.forEach((trigger, index) => {
      trigger.position = [400, agentY + (index * 100)];
    });

    // Memory nodes - positioned BELOW right of agent (connects to Memory port on bottom)
    const mainMemoryNodes = nodes.filter(n =>
      this.isMemoryNode(n) &&
      this.isConnectedTo(connections, n.name, mainAgent.name)
    );
    mainMemoryNodes.forEach((memory, index) => {
      memory.position = [agentX + 200, agentY + 300 + (index * 150)];
    });

    // Chat model nodes - positioned BELOW left of agent (connects to Chat Model port on bottom)
    const mainModelNodes = nodes.filter(n =>
      this.isChatModelNode(n) &&
      this.isConnectedTo(connections, n.name, mainAgent.name)
    );
    mainModelNodes.forEach((model, index) => {
      model.position = [agentX - 200, agentY + 300 + (index * 150)];
    });

    // Tool nodes - positioned BELOW center of agent in a row (connects to Tool port on bottom)
    const mainToolNodes = nodes.filter(n =>
      this.isToolNode(n) &&
      this.isConnectedTo(connections, n.name, mainAgent.name)
    );

    mainToolNodes.forEach((tool, index) => {
      tool.position = [
        agentX + (index - Math.floor(mainToolNodes.length / 2)) * 200,
        agentY + 300
      ];
    });
  }

  /**
   * Check if sourceNode is connected TO targetNode
   */
  private static isConnectedTo(
    connections: WorkflowConnections,
    sourceNode: string,
    targetNode: string
  ): boolean {
    const nodeConns = connections[sourceNode];
    if (!nodeConns) return false;

    for (const outputs of Object.values(nodeConns)) {
      if (!Array.isArray(outputs)) continue;
      for (const outputArray of outputs) {
        if (!Array.isArray(outputArray)) continue;
        for (const conn of outputArray) {
          if (conn.node === targetNode) return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if there's a connection FROM sourceNode that leads to targetNode
   */
  private static isConnectedFrom(
    connections: WorkflowConnections,
    sourceNode: string,
    targetNode: string
  ): boolean {
    // Check if sourceNode has any connection that points to a node that connects to targetNode
    for (const [nodeName, nodeConns] of Object.entries(connections)) {
      if (nodeName === sourceNode) {
        for (const outputs of Object.values(nodeConns)) {
          if (!Array.isArray(outputs)) continue;
          for (const outputArray of outputs) {
            if (!Array.isArray(outputArray)) continue;
            for (const conn of outputArray) {
              if (conn.node === targetNode) return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Check if node is a chat model
   */
  private static isChatModelNode(node: WorkflowNode | string): boolean {
    const nodeType = typeof node === 'string' ? node : node.type;
    return nodeType.includes('lmChat') ||
           nodeType.includes('ChatModel') ||
           nodeType.includes('flowEngineLlm') ||
           nodeType.includes('FlowEngine');
  }

  /**
   * Check if node is a memory node
   */
  private static isMemoryNode(node: WorkflowNode | string): boolean {
    const nodeType = typeof node === 'string' ? node : node.type;
    return nodeType.includes('memory') || nodeType.includes('Memory');
  }

  /**
   * Check if node is a tool node
   */
  private static isToolNode(node: WorkflowNode | string): boolean {
    const nodeType = typeof node === 'string' ? node : node.type;
    return nodeType.includes('tool') || nodeType.includes('Tool');
  }

  /**
   * Apply organized layout to nodes
   * Uses AI Agent layout if AI agents are present, otherwise uses standard flow layout
   */
  private static applyLayout(nodes: WorkflowNode[], layoutType: string): void {
    // Check if workflow has AI agents
    const aiAgentNodes = nodes.filter(n => n.type === n8nWorkflow.AGENT_LANGCHAIN_NODE_TYPE);

    if (aiAgentNodes.length > 0) {
      // Use AI Agent specific layout for proper sub-node positioning
      const connections = this.generateConnections(nodes);
      this.applyAIAgentLayout(nodes, connections, aiAgentNodes[0]);
      return;
    }

    // Standard layout for non-AI workflows
    const layout = this.DEFAULT_LAYOUT;

    // Group nodes by role for organized positioning
    const nodesByRole = {
      trigger: nodes.filter(n => this.getNodeRole(n) === 'trigger'),
      support: nodes.filter(n => this.getNodeRole(n) === 'support'),
      main: nodes.filter(n => this.getNodeRole(n) === 'main'),
      action: nodes.filter(n => this.getNodeRole(n) === 'action')
    };

    let currentX = layout.startX;
    let currentY = layout.startY;

    // Position triggers
    nodesByRole.trigger.forEach((node, index) => {
      node.position = [currentX, currentY];
      currentY += layout.verticalSpacing;
    });

    currentX += layout.horizontalSpacing;
    currentY = layout.startY;

    // Position main processing nodes
    nodesByRole.main.forEach((node, index) => {
      node.position = [currentX, currentY];
      currentY += layout.verticalSpacing;
    });

    currentX += layout.horizontalSpacing;
    currentY = layout.startY;

    // Position action nodes
    nodesByRole.action.forEach((node, index) => {
      node.position = [currentX, currentY];
      currentY += layout.verticalSpacing;
    });
  }

  /**
   * Validate workflow and apply auto-fixes
   */
  private static async validateAndFix(workflow: GeneratedWorkflow): Promise<ValidationResult> {
    try {
      // First, check for critical structural issues
      const structuralErrors = this.validateStructure(workflow);
      if (structuralErrors.length > 0) {
        return {
          isValid: false,
          errors: structuralErrors,
          warnings: [],
          autofixed: false
        };
      }

      // Use n8n validator with autofix enabled
      const validationResult = await validateWithN8n(workflow, { autofix: true });

      if (validationResult.normalized) {
        return {
          isValid: true,
          errors: [],
          warnings: validationResult.warnings,
          autofixed: validationResult.autofixed || false,
          workflow: validationResult.normalized
        };
      }

      return {
        isValid: validationResult.valid,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        autofixed: validationResult.autofixed || false,
        workflow: validationResult.valid ? workflow : undefined
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Validation failed'],
        warnings: [],
        autofixed: false
      };
    }
  }

  /**
   * Validate critical workflow structure
   */
  private static validateStructure(workflow: GeneratedWorkflow): string[] {
    const errors: string[] = [];

    // Check for AI agents without required connections
    const aiAgents = workflow.nodes.filter(n => n.type === n8nWorkflow.AGENT_LANGCHAIN_NODE_TYPE);

    aiAgents.forEach(agent => {
      const hasLanguageModel = this.hasRequiredConnection(workflow.connections, agent.name, 'ai_languageModel');
      const hasMemory = this.hasRequiredConnection(workflow.connections, agent.name, 'ai_memory');
      const hasTools = this.hasRequiredConnection(workflow.connections, agent.name, 'ai_tool');

      // Only language model is required - memory and tools are optional
      if (!hasLanguageModel) {
        errors.push(`AI Agent "${agent.name}" missing required language model connection`);
      }
      // Memory and tools are optional - don't error if missing
      // if (!hasMemory) { // Memory is optional for single-turn workflows }
      // if (!hasTools) { // Tools are optional for simple chat agents }
    });

    // Check for disconnected nodes
    const connectedNodes = new Set<string>();
    Object.entries(workflow.connections).forEach(([sourceNode, connections]) => {
      connectedNodes.add(sourceNode);
      Object.values(connections).forEach(outputs => {
        outputs.forEach(outputArray => {
          outputArray.forEach(connection => {
            connectedNodes.add(connection.node);
          });
        });
      });
    });

    const disconnectedNodes = workflow.nodes.filter(node =>
      !connectedNodes.has(node.name) && !this.isStandaloneNode(node)
    );

    if (disconnectedNodes.length > 0) {
      errors.push(`Disconnected nodes: ${disconnectedNodes.map(n => n.name).join(', ')}`);
    }

    return errors;
  }

  /**
   * Helper methods for node classification and validation
   */
  /**
   * Create a node from hardcoded template
   * @deprecated Use nodeCategories.generated.ts for node type lookups in new code
   */
  private static createNode(templateKey: string, options: {
    customName?: string;
    parameters?: Record<string, any>;
  } = {}): WorkflowNode {
    const template = this.NODE_TEMPLATES[templateKey as keyof typeof this.NODE_TEMPLATES];
    if (!template) {
      throw new Error(`Unknown node template: ${templateKey}`);
    }

    // n8n expected property order: parameters, id, name, type, position, typeVersion
    return {
      parameters: { ...template.parameters, ...options.parameters },
      id: uuidv4(),
      name: options.customName || template.name,
      type: template.type,
      position: [0, 0], // Will be set by layout engine
      ...((template as any).typeVersion && { typeVersion: (template as any).typeVersion }),
    };
  }

  private static getNodeRole(node: WorkflowNode): 'trigger' | 'main' | 'support' | 'action' {
    const nodeType = node.type.toLowerCase();

    if (nodeType.includes('trigger') || nodeType.includes('webhook')) {
      return 'trigger';
    }
    if (nodeType.includes('langchain') && !nodeType.includes('agent')) {
      return 'support';
    }
    if (nodeType.includes('email') || nodeType.includes('slack') || nodeType.includes('sheets')) {
      return 'action';
    }
    return 'main';
  }

  private static isAINode(node: WorkflowNode): boolean {
    return node.type.includes('langchain') || node.type.includes('ai');
  }

  private static isStandaloneNode(node: WorkflowNode): boolean {
    // Some nodes can exist standalone (like certain triggers)
    return node.type.includes('manualTrigger');
  }

  private static hasRequiredConnection(connections: WorkflowConnections, targetNode: string, connectionType: string): boolean {
    return Object.values(connections).some(nodeConnections =>
      Object.entries(nodeConnections).some(([type, outputs]) =>
        type === connectionType && outputs.some(outputArray =>
          outputArray.some(connection => connection.node === targetNode)
        )
      )
    );
  }

  private static determineTriggerType(request: WorkflowGenerationRequest): string {
    if (request.includeAIAgent) {
      return 'MANUAL_CHAT_TRIGGER';
    }
    if (request.triggers?.includes('webhook')) {
      return 'WEBHOOK';
    }
    return 'MANUAL_TRIGGER';
  }

  private static determineProcessingNodes(request: WorkflowGenerationRequest): WorkflowNode[] {
    const nodes: WorkflowNode[] = [];
    const desc = request.description.toLowerCase();

    // Core Processing
    if (desc.includes('data') || desc.includes('transform') || desc.includes('modify')) {
      nodes.push(this.createNode('SET_NODE', { customName: 'Process Data' }));
    }
    if (desc.includes('http') || desc.includes('api') || desc.includes('request') || desc.includes('fetch')) {
      nodes.push(this.createNode('HTTP_REQUEST', { customName: 'API Request' }));
    }
    if (desc.includes('code') || desc.includes('script') || desc.includes('javascript')) {
      nodes.push(this.createNode('CODE', { customName: 'Execute Code' }));
    }
    if (desc.includes('merge') || desc.includes('combine') || desc.includes('join')) {
      nodes.push(this.createNode('MERGE', { customName: 'Merge Data' }));
    }
    if (desc.includes('wait') || desc.includes('pause') || desc.includes('delay')) {
      nodes.push(this.createNode('WAIT', { customName: 'Wait' }));
    }

    // File Processing
    if (desc.includes('pdf')) {
      nodes.push(this.createNode('PDF', { customName: 'Process PDF' }));
    }
    if (desc.includes('csv')) {
      nodes.push(this.createNode('CSV', { customName: 'Process CSV' }));
    }
    if (desc.includes('xml')) {
      nodes.push(this.createNode('XML', { customName: 'Parse XML' }));
    }
    if (desc.includes('json')) {
      nodes.push(this.createNode('JSON', { customName: 'Parse JSON' }));
    }

    // AI Processing
    if (desc.includes('summarize') || desc.includes('summary')) {
      nodes.push(this.createNode('CHAIN_SUMMARIZATION', { customName: 'Summarize Text' }));
    }
    if (desc.includes('ai transform') || desc.includes('ai process')) {
      nodes.push(this.createNode('AI_TRANSFORM', { customName: 'AI Transform' }));
    }

    return nodes;
  }

  private static determineActionNodes(request: WorkflowGenerationRequest): WorkflowNode[] {
    const nodes: WorkflowNode[] = [];
    const desc = request.description.toLowerCase();

    // Communication
    if (desc.includes('email') || desc.includes('gmail')) {
      nodes.push(this.createNode('GMAIL', { customName: 'Send Email' }));
    }
    if (desc.includes('slack')) {
      nodes.push(this.createNode('SLACK', { customName: 'Send Slack Message' }));
    }
    if (desc.includes('discord')) {
      nodes.push(this.createNode('DISCORD', { customName: 'Send Discord Message' }));
    }
    if (desc.includes('teams') || desc.includes('microsoft teams')) {
      nodes.push(this.createNode('MICROSOFT_TEAMS', { customName: 'Send Teams Message' }));
    }
    if (desc.includes('telegram')) {
      nodes.push(this.createNode('TELEGRAM', { customName: 'Send Telegram Message' }));
    }

    // Social Media
    if (desc.includes('twitter') || desc.includes('tweet')) {
      nodes.push(this.createNode('TWITTER', { customName: 'Post Tweet' }));
    }
    if (desc.includes('linkedin')) {
      nodes.push(this.createNode('LINKEDIN', { customName: 'Post to LinkedIn' }));
    }
    if (desc.includes('facebook')) {
      nodes.push(this.createNode('FACEBOOK', { customName: 'Post to Facebook' }));
    }
    if (desc.includes('instagram')) {
      nodes.push(this.createNode('INSTAGRAM', { customName: 'Post to Instagram' }));
    }

    // Productivity
    if (desc.includes('sheets') || desc.includes('google sheets') || desc.includes('spreadsheet')) {
      nodes.push(this.createNode('GOOGLE_SHEETS', { customName: 'Update Google Sheets' }));
    }
    if (desc.includes('google docs') || desc.includes('document')) {
      nodes.push(this.createNode('GOOGLE_DOCS', { customName: 'Update Google Docs' }));
    }
    if (desc.includes('google drive') || desc.includes('drive')) {
      nodes.push(this.createNode('GOOGLE_DRIVE', { customName: 'Upload to Google Drive' }));
    }
    if (desc.includes('notion')) {
      nodes.push(this.createNode('NOTION', { customName: 'Create Notion Page' }));
    }
    if (desc.includes('airtable')) {
      nodes.push(this.createNode('AIRTABLE', { customName: 'Add to Airtable' }));
    }
    if (desc.includes('trello')) {
      nodes.push(this.createNode('TRELLO', { customName: 'Create Trello Card' }));
    }
    if (desc.includes('asana')) {
      nodes.push(this.createNode('ASANA', { customName: 'Create Asana Task' }));
    }

    // Development
    if (desc.includes('github')) {
      nodes.push(this.createNode('GITHUB', { customName: 'GitHub Action' }));
    }
    if (desc.includes('gitlab')) {
      nodes.push(this.createNode('GITLAB', { customName: 'GitLab Action' }));
    }
    if (desc.includes('jira')) {
      nodes.push(this.createNode('JIRA', { customName: 'Create Jira Issue' }));
    }

    // Databases
    if (desc.includes('mysql') || desc.includes('mariadb')) {
      nodes.push(this.createNode('MYSQL', { customName: 'MySQL Query' }));
    }
    if (desc.includes('postgres') || desc.includes('postgresql')) {
      nodes.push(this.createNode('POSTGRES', { customName: 'PostgreSQL Query' }));
    }
    if (desc.includes('mongodb') || desc.includes('mongo')) {
      nodes.push(this.createNode('MONGODB', { customName: 'MongoDB Query' }));
    }
    if (desc.includes('redis')) {
      nodes.push(this.createNode('REDIS', { customName: 'Redis Operation' }));
    }

    // Cloud Storage
    if (desc.includes('s3') || desc.includes('aws s3')) {
      nodes.push(this.createNode('AWS_S3', { customName: 'Upload to S3' }));
    }
    if (desc.includes('dropbox')) {
      nodes.push(this.createNode('DROPBOX', { customName: 'Upload to Dropbox' }));
    }

    // E-commerce
    if (desc.includes('shopify')) {
      nodes.push(this.createNode('SHOPIFY', { customName: 'Shopify Action' }));
    }
    if (desc.includes('stripe') || desc.includes('payment')) {
      nodes.push(this.createNode('STRIPE', { customName: 'Process Payment' }));
    }

    // CRM
    if (desc.includes('hubspot')) {
      nodes.push(this.createNode('HUBSPOT', { customName: 'Update HubSpot' }));
    }
    if (desc.includes('salesforce')) {
      nodes.push(this.createNode('SALESFORCE', { customName: 'Update Salesforce' }));
    }

    // Analytics
    if (desc.includes('analytics') || desc.includes('google analytics')) {
      nodes.push(this.createNode('GOOGLE_ANALYTICS', { customName: 'Get Analytics Data' }));
    }

    return nodes;
  }

  private static generateWorkflowName(description: string): string {
    // Extract key words from description to create a meaningful name
    const words = description.toLowerCase().split(/\s+/);
    const keyWords = words.filter(word =>
      !['a', 'an', 'the', 'is', 'are', 'was', 'were', 'to', 'for', 'with', 'by'].includes(word)
    ).slice(0, 3);

    const name = keyWords.map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    return name || 'Generated Workflow';
  }
}