/**
 * Node Parameters Configuration
 * Defines required parameters for n8n nodes that need user configuration
 *
 * ## Dynamic Options (optionsUrl)
 * For select fields that need dynamic options (e.g., AI models from /api/client/models):
 * 1. Set `optionsUrl` to the API endpoint that returns options
 * 2. Set `optionsFormat` to specify the response format:
 *    - 'openai-models': OpenAI /v1/models format with { data: [{ id: string }] }
 *    - 'simple': Simple array format [{ name: string, value: string }]
 * 3. Frontend fetches from optionsUrl and transforms based on optionsFormat
 */

export interface NodeParameterField {
  name: string;           // Parameter key in n8n
  displayName: string;    // Human-readable label
  type: 'string' | 'url' | 'number' | 'boolean' | 'select' | 'json' | 'array' | 'date' | 'datetime' | 'time' | 'folder' | 'email' | 'phone' | 'textarea';
  required: boolean;
  placeholder?: string;
  description?: string;
  default?: any;
  options?: Array<{ name: string; value: string }>;
  optionsUrl?: string;    // URL to fetch dynamic options (for select fields)
  optionsFormat?: 'openai-models' | 'simple'; // Format of the dynamic options response
}

export interface NodeParameterConfig {
  nodeType: string;
  displayName: string;
  icon: string;
  description: string;
  fields: NodeParameterField[];
}

/**
 * Registry of nodes that require parameter configuration
 * Only includes nodes that need user input (not nodes with sensible defaults)
 */
export const NODE_REQUIRED_PARAMS: Record<string, NodeParameterConfig> = {
  // RSS Feed Read
  'n8n-nodes-base.rssFeedRead': {
    nodeType: 'n8n-nodes-base.rssFeedRead',
    displayName: 'RSS Feed',
    icon: 'rss',
    description: 'Configure the RSS feed URL to read',
    fields: [
      {
        name: 'url',
        displayName: 'Feed URL',
        type: 'url',
        required: true,
        placeholder: 'https://example.com/feed.xml',
        description: 'The URL of the RSS feed to read',
      },
    ],
  },

  // RSS Feed Read Trigger
  'n8n-nodes-base.rssFeedReadTrigger': {
    nodeType: 'n8n-nodes-base.rssFeedReadTrigger',
    displayName: 'RSS Feed Trigger',
    icon: 'rss',
    description: 'Configure the RSS feed URL to monitor',
    fields: [
      {
        name: 'feedUrl',
        displayName: 'Feed URL',
        type: 'url',
        required: true,
        placeholder: 'https://example.com/feed.xml',
        description: 'The URL of the RSS feed to monitor for new items',
      },
    ],
  },

  // Form Trigger
  'n8n-nodes-base.formTrigger': {
    nodeType: 'n8n-nodes-base.formTrigger',
    displayName: 'Form Trigger',
    icon: 'form',
    description: 'Configure the form settings',
    fields: [
      {
        name: 'formTitle',
        displayName: 'Form Title',
        type: 'string',
        required: true,
        placeholder: 'Contact Form',
        description: 'The title displayed on the form',
      },
      {
        name: 'formDescription',
        displayName: 'Form Description',
        type: 'string',
        required: false,
        placeholder: 'Please fill out this form...',
        description: 'Optional description shown below the title',
      },
    ],
  },


  // HTTP Request (when URL is not set)
  'n8n-nodes-base.httpRequest': {
    nodeType: 'n8n-nodes-base.httpRequest',
    displayName: 'HTTP Request',
    icon: 'api',
    description: 'Configure the HTTP request',
    fields: [
      {
        name: 'url',
        displayName: 'URL',
        type: 'url',
        required: true,
        placeholder: 'https://api.example.com/endpoint',
        description: 'The URL to send the request to',
      },
      {
        name: 'requestMethod',
        displayName: 'Method',
        type: 'select',
        required: false, // Has default of GET
        default: 'GET',
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'PATCH', value: 'PATCH' },
          { name: 'DELETE', value: 'DELETE' },
        ],
      },
    ],
  },

  // GraphQL
  'n8n-nodes-base.graphql': {
    nodeType: 'n8n-nodes-base.graphql',
    displayName: 'GraphQL',
    icon: 'api',
    description: 'Configure the GraphQL endpoint',
    fields: [
      {
        name: 'endpoint',
        displayName: 'Endpoint',
        type: 'url',
        required: true,
        placeholder: 'https://api.example.com/graphql',
        description: 'The GraphQL endpoint URL',
      },
    ],
  },

  // Execute Command
  'n8n-nodes-base.executeCommand': {
    nodeType: 'n8n-nodes-base.executeCommand',
    displayName: 'Execute Command',
    icon: 'terminal',
    description: 'Configure the command to execute',
    fields: [
      {
        name: 'command',
        displayName: 'Command',
        type: 'string',
        required: true,
        placeholder: 'echo "Hello World"',
        description: 'The shell command to execute',
      },
    ],
  },

  // Send Email (SMTP)
  'n8n-nodes-base.emailSend': {
    nodeType: 'n8n-nodes-base.emailSend',
    displayName: 'Send Email',
    icon: 'email',
    description: 'Configure email settings',
    fields: [
      {
        name: 'toEmail',
        displayName: 'To Email',
        type: 'email',
        required: true,
        placeholder: 'recipient@example.com',
        description: 'Email address of the recipient',
      },
      {
        name: 'subject',
        displayName: 'Subject',
        type: 'string',
        required: true,
        placeholder: 'Email Subject',
        description: 'Subject line of the email',
      },
      {
        name: 'text',
        displayName: 'Message',
        type: 'textarea',
        required: false,
        placeholder: 'Enter your email message...',
        description: 'The body of the email',
      },
    ],
  },

  // Send Email (newer node - n8n v1+)
  'n8n-nodes-base.sendEmail': {
    nodeType: 'n8n-nodes-base.sendEmail',
    displayName: 'Send Email',
    icon: 'email',
    description: 'Configure email recipient and subject',
    fields: [
      {
        name: 'sendTo',
        displayName: 'To Email',
        type: 'email',
        required: true,
        placeholder: 'recipient@example.com',
        description: 'Email address of the recipient',
      },
      {
        name: 'subject',
        displayName: 'Subject',
        type: 'string',
        required: true,
        placeholder: 'Email Subject',
        description: 'Subject line of the email',
      },
      {
        name: 'emailBody',
        displayName: 'Message',
        type: 'textarea',
        required: false,
        placeholder: 'Enter your email message...',
        description: 'The body of the email',
      },
    ],
  },

  // FTP
  'n8n-nodes-base.ftp': {
    nodeType: 'n8n-nodes-base.ftp',
    displayName: 'FTP',
    icon: 'ftp',
    description: 'Configure FTP path',
    fields: [
      {
        name: 'path',
        displayName: 'Path',
        type: 'folder',
        required: true,
        placeholder: '/remote/path/',
        description: 'Remote path on the FTP server',
      },
    ],
  },

  // SSH
  'n8n-nodes-base.ssh': {
    nodeType: 'n8n-nodes-base.ssh',
    displayName: 'SSH',
    icon: 'terminal',
    description: 'Configure SSH command',
    fields: [
      {
        name: 'command',
        displayName: 'Command',
        type: 'string',
        required: true,
        placeholder: 'ls -la',
        description: 'Command to execute on the remote server',
      },
    ],
  },

  // Execute Workflow (only when source=database, not when using parameter mode)
  'n8n-nodes-base.executeWorkflow': {
    nodeType: 'n8n-nodes-base.executeWorkflow',
    displayName: 'Execute Workflow',
    icon: 'workflow',
    description: 'Configure which workflow to execute',
    fields: [
      {
        name: 'workflowId',
        displayName: 'Workflow ID',
        type: 'string',
        required: false, // Only required when source=database
        placeholder: 'abc123',
        description: 'The ID of the workflow to execute (required when using database mode)',
      },
    ],
  },

  // ========================================
  // AI Agent Tool Nodes
  // These are the *Tool versions of nodes used with AI Agents
  // ========================================

  // Google Calendar Tool
  'n8n-nodes-base.googleCalendarTool': {
    nodeType: 'n8n-nodes-base.googleCalendarTool',
    displayName: 'Google Calendar Tool',
    icon: 'google',
    description: 'Configure calendar operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'event',
        options: [
          { name: 'Calendar', value: 'calendar' },
          { name: 'Event', value: 'event' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
      {
        name: 'calendar',
        displayName: 'Calendar',
        type: 'string',
        required: true,
        placeholder: 'primary',
        description: 'Calendar ID or "primary" for your main calendar. Select from your connected calendars in n8n.',
      },
      {
        name: 'start',
        displayName: 'Start Time',
        type: 'datetime',
        required: false,
        placeholder: '2024-01-15T10:00:00',
        description: 'Event start date/time. Used for create/update operations.',
      },
      {
        name: 'end',
        displayName: 'End Time',
        type: 'datetime',
        required: false,
        placeholder: '2024-01-15T11:00:00',
        description: 'Event end date/time. Used for create/update operations.',
      },
      {
        name: 'useDefaultReminders',
        displayName: 'Use Default Reminders',
        type: 'boolean',
        required: false,
        default: true,
        description: 'Whether to use calendar default reminders',
      },
    ],
  },

  // Gmail Tool
  'n8n-nodes-base.gmailTool': {
    nodeType: 'n8n-nodes-base.gmailTool',
    displayName: 'Gmail Tool',
    icon: 'gmail',
    description: 'Configure Gmail operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'message',
        options: [
          { name: 'Message', value: 'message' },
          { name: 'Draft', value: 'draft' },
          { name: 'Label', value: 'label' },
          { name: 'Thread', value: 'thread' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Send', value: 'send' },
          { name: 'Reply', value: 'reply' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Delete', value: 'delete' },
          { name: 'Add Label', value: 'addLabels' },
          { name: 'Remove Label', value: 'removeLabels' },
        ],
        description: 'The operation to perform',
      },
      {
        name: 'sendTo',
        displayName: 'To',
        type: 'email',
        required: false,
        placeholder: 'recipient@example.com',
        description: 'Email address of the recipient (for send operation)',
      },
      {
        name: 'subject',
        displayName: 'Subject',
        type: 'string',
        required: false,
        placeholder: 'Email subject',
        description: 'Subject line of the email',
      },
      {
        name: 'message',
        displayName: 'Message',
        type: 'textarea',
        required: false,
        placeholder: 'Enter your message here...',
        description: 'Body of the email message',
      },
    ],
  },

  // Google Sheets Tool
  'n8n-nodes-base.googleSheetsTool': {
    nodeType: 'n8n-nodes-base.googleSheetsTool',
    displayName: 'Google Sheets Tool',
    icon: 'google',
    description: 'Configure Google Sheets operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'sheet',
        options: [
          { name: 'Sheet Within Document', value: 'sheet' },
          { name: 'Spreadsheet', value: 'spreadsheet' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'read',
        options: [
          { name: 'Append or Update Row', value: 'appendOrUpdate' },
          { name: 'Append Row', value: 'append' },
          { name: 'Clear', value: 'clear' },
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Read Rows', value: 'read' },
          { name: 'Update Row', value: 'update' },
        ],
        description: 'The operation to perform',
      },
      {
        name: 'documentId',
        displayName: 'Document ID',
        type: 'string',
        required: true,
        placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        description: 'The ID of the Google Sheets document',
      },
    ],
  },

  // Google Drive Tool
  'n8n-nodes-base.googleDriveTool': {
    nodeType: 'n8n-nodes-base.googleDriveTool',
    displayName: 'Google Drive Tool',
    icon: 'google',
    description: 'Configure Google Drive operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'file',
        options: [
          { name: 'File', value: 'file' },
          { name: 'Folder', value: 'folder' },
          { name: 'Drive', value: 'drive' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'list',
        options: [
          { name: 'Copy', value: 'copy' },
          { name: 'Create from Text', value: 'createFromText' },
          { name: 'Delete', value: 'delete' },
          { name: 'Download', value: 'download' },
          { name: 'List', value: 'list' },
          { name: 'Move', value: 'move' },
          { name: 'Share', value: 'share' },
          { name: 'Update', value: 'update' },
          { name: 'Upload', value: 'upload' },
        ],
        description: 'The operation to perform',
      },
      {
        name: 'folderId',
        displayName: 'Folder',
        type: 'folder',
        required: false,
        placeholder: 'root',
        description: 'The folder to operate in. Use "root" for My Drive root folder.',
      },
    ],
  },

  // Google Docs Tool
  'n8n-nodes-base.googleDocsTool': {
    nodeType: 'n8n-nodes-base.googleDocsTool',
    displayName: 'Google Docs Tool',
    icon: 'google',
    description: 'Configure Google Docs operations for AI Agent',
    fields: [
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'get',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Get', value: 'get' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Google Tasks Tool
  'n8n-nodes-base.googleTasksTool': {
    nodeType: 'n8n-nodes-base.googleTasksTool',
    displayName: 'Google Tasks Tool',
    icon: 'google',
    description: 'Configure Google Tasks operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'task',
        options: [
          { name: 'Task', value: 'task' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Notion Tool
  'n8n-nodes-base.notionTool': {
    nodeType: 'n8n-nodes-base.notionTool',
    displayName: 'Notion Tool',
    icon: 'notion',
    description: 'Configure Notion operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'page',
        options: [
          { name: 'Block', value: 'block' },
          { name: 'Database', value: 'database' },
          { name: 'Database Page', value: 'databasePage' },
          { name: 'Page', value: 'page' },
          { name: 'User', value: 'user' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Append After', value: 'append' },
          { name: 'Create', value: 'create' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Search', value: 'search' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Slack Tool
  'n8n-nodes-base.slackTool': {
    nodeType: 'n8n-nodes-base.slackTool',
    displayName: 'Slack Tool',
    icon: 'slack',
    description: 'Configure Slack operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'message',
        options: [
          { name: 'Channel', value: 'channel' },
          { name: 'Message', value: 'message' },
          { name: 'Reaction', value: 'reaction' },
          { name: 'User', value: 'user' },
          { name: 'File', value: 'file' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'post',
        options: [
          { name: 'Archive', value: 'archive' },
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Post', value: 'post' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
      {
        name: 'channel',
        displayName: 'Channel',
        type: 'string',
        required: false,
        placeholder: '#general or C024BE91L',
        description: 'Channel name or ID to post to',
      },
      {
        name: 'text',
        displayName: 'Message',
        type: 'textarea',
        required: false,
        placeholder: 'Enter your message...',
        description: 'The text of the message to send',
      },
    ],
  },

  // Discord Tool
  'n8n-nodes-base.discordTool': {
    nodeType: 'n8n-nodes-base.discordTool',
    displayName: 'Discord Tool',
    icon: 'discord',
    description: 'Configure Discord operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'message',
        options: [
          { name: 'Channel', value: 'channel' },
          { name: 'Message', value: 'message' },
          { name: 'Member', value: 'member' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'send',
        options: [
          { name: 'Send', value: 'send' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Delete', value: 'delete' },
        ],
        description: 'The operation to perform',
      },
      {
        name: 'channelId',
        displayName: 'Channel ID',
        type: 'string',
        required: false,
        placeholder: '123456789012345678',
        description: 'The ID of the channel to send the message to',
      },
      {
        name: 'content',
        displayName: 'Message',
        type: 'textarea',
        required: false,
        placeholder: 'Enter your message...',
        description: 'The text content of the message to send',
      },
    ],
  },

  // Telegram Tool
  'n8n-nodes-base.telegramTool': {
    nodeType: 'n8n-nodes-base.telegramTool',
    displayName: 'Telegram Tool',
    icon: 'telegram',
    description: 'Configure Telegram operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'message',
        options: [
          { name: 'Message', value: 'message' },
          { name: 'Chat', value: 'chat' },
          { name: 'File', value: 'file' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'sendMessage',
        options: [
          { name: 'Send Message', value: 'sendMessage' },
          { name: 'Edit Message', value: 'editMessageText' },
          { name: 'Delete Message', value: 'deleteMessage' },
          { name: 'Pin Message', value: 'pinChatMessage' },
          { name: 'Unpin Message', value: 'unpinChatMessage' },
        ],
        description: 'The operation to perform',
      },
      {
        name: 'chatId',
        displayName: 'Chat ID',
        type: 'string',
        required: false,
        placeholder: '-1001234567890',
        description: 'The ID of the chat to send the message to',
      },
      {
        name: 'text',
        displayName: 'Message',
        type: 'textarea',
        required: false,
        placeholder: 'Enter your message...',
        description: 'The text of the message to send',
      },
    ],
  },

  // GitHub Tool
  'n8n-nodes-base.githubTool': {
    nodeType: 'n8n-nodes-base.githubTool',
    displayName: 'GitHub Tool',
    icon: 'github',
    description: 'Configure GitHub operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'issue',
        options: [
          { name: 'File', value: 'file' },
          { name: 'Issue', value: 'issue' },
          { name: 'Repository', value: 'repository' },
          { name: 'Release', value: 'release' },
          { name: 'Review', value: 'review' },
          { name: 'User', value: 'user' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Edit', value: 'edit' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Lock', value: 'lock' },
        ],
        description: 'The operation to perform',
      },
      {
        name: 'owner',
        displayName: 'Repository Owner',
        type: 'string',
        required: true,
        placeholder: 'n8n-io',
        description: 'Owner of the repository',
      },
      {
        name: 'repository',
        displayName: 'Repository Name',
        type: 'string',
        required: true,
        placeholder: 'n8n',
        description: 'Name of the repository',
      },
    ],
  },

  // GitLab Tool
  'n8n-nodes-base.gitlabTool': {
    nodeType: 'n8n-nodes-base.gitlabTool',
    displayName: 'GitLab Tool',
    icon: 'gitlab',
    description: 'Configure GitLab operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'issue',
        options: [
          { name: 'Issue', value: 'issue' },
          { name: 'Repository', value: 'repository' },
          { name: 'Release', value: 'release' },
          { name: 'User', value: 'user' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Edit', value: 'edit' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Jira Tool
  'n8n-nodes-base.jiraTool': {
    nodeType: 'n8n-nodes-base.jiraTool',
    displayName: 'Jira Tool',
    icon: 'jira',
    description: 'Configure Jira operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'issue',
        options: [
          { name: 'Issue', value: 'issue' },
          { name: 'Issue Comment', value: 'issueComment' },
          { name: 'User', value: 'user' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Update', value: 'update' },
          { name: 'Changelog', value: 'changelog' },
          { name: 'Notify', value: 'notify' },
          { name: 'Status', value: 'status' },
          { name: 'Transition', value: 'transition' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Linear Tool
  'n8n-nodes-base.linearTool': {
    nodeType: 'n8n-nodes-base.linearTool',
    displayName: 'Linear Tool',
    icon: 'linear',
    description: 'Configure Linear operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'issue',
        options: [
          { name: 'Issue', value: 'issue' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Airtable Tool
  'n8n-nodes-base.airtableTool': {
    nodeType: 'n8n-nodes-base.airtableTool',
    displayName: 'Airtable Tool',
    icon: 'airtable',
    description: 'Configure Airtable operations for AI Agent',
    fields: [
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'list',
        options: [
          { name: 'Append', value: 'append' },
          { name: 'Delete', value: 'delete' },
          { name: 'List', value: 'list' },
          { name: 'Read', value: 'read' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
      {
        name: 'baseId',
        displayName: 'Base ID',
        type: 'string',
        required: true,
        placeholder: 'appXXXXXXXXXXXXXX',
        description: 'The Airtable base ID',
      },
      {
        name: 'tableId',
        displayName: 'Table ID',
        type: 'string',
        required: true,
        placeholder: 'tblXXXXXXXXXXXXXX',
        description: 'The Airtable table ID',
      },
    ],
  },

  // PostgreSQL Tool
  'n8n-nodes-base.postgresTool': {
    nodeType: 'n8n-nodes-base.postgresTool',
    displayName: 'PostgreSQL Tool',
    icon: 'postgres',
    description: 'Configure PostgreSQL operations for AI Agent',
    fields: [
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'select',
        options: [
          { name: 'Delete', value: 'deleteTable' },
          { name: 'Execute Query', value: 'executeQuery' },
          { name: 'Insert', value: 'insert' },
          { name: 'Insert or Update', value: 'upsert' },
          { name: 'Select', value: 'select' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // MySQL Tool
  'n8n-nodes-base.mySqlTool': {
    nodeType: 'n8n-nodes-base.mySqlTool',
    displayName: 'MySQL Tool',
    icon: 'mysql',
    description: 'Configure MySQL operations for AI Agent',
    fields: [
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'select',
        options: [
          { name: 'Delete', value: 'deleteTable' },
          { name: 'Execute Query', value: 'executeQuery' },
          { name: 'Insert', value: 'insert' },
          { name: 'Insert or Update', value: 'upsert' },
          { name: 'Select', value: 'select' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // HubSpot Tool
  'n8n-nodes-base.hubspotTool': {
    nodeType: 'n8n-nodes-base.hubspotTool',
    displayName: 'HubSpot Tool',
    icon: 'hubspot',
    description: 'Configure HubSpot operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'contact',
        options: [
          { name: 'Contact', value: 'contact' },
          { name: 'Company', value: 'company' },
          { name: 'Deal', value: 'deal' },
          { name: 'Engagement', value: 'engagement' },
          { name: 'Form', value: 'form' },
          { name: 'Ticket', value: 'ticket' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Get Recently Created', value: 'getRecentlyCreatedUpdated' },
          { name: 'Search', value: 'search' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Salesforce Tool
  'n8n-nodes-base.salesforceTool': {
    nodeType: 'n8n-nodes-base.salesforceTool',
    displayName: 'Salesforce Tool',
    icon: 'salesforce',
    description: 'Configure Salesforce operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'contact',
        options: [
          { name: 'Account', value: 'account' },
          { name: 'Attachment', value: 'attachment' },
          { name: 'Case', value: 'case' },
          { name: 'Contact', value: 'contact' },
          { name: 'Custom Object', value: 'customObject' },
          { name: 'Document', value: 'document' },
          { name: 'Flow', value: 'flow' },
          { name: 'Lead', value: 'lead' },
          { name: 'Opportunity', value: 'opportunity' },
          { name: 'Search', value: 'search' },
          { name: 'Task', value: 'task' },
          { name: 'User', value: 'user' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Create or Update', value: 'upsert' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Shopify Tool
  'n8n-nodes-base.shopifyTool': {
    nodeType: 'n8n-nodes-base.shopifyTool',
    displayName: 'Shopify Tool',
    icon: 'shopify',
    description: 'Configure Shopify operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'product',
        options: [
          { name: 'Order', value: 'order' },
          { name: 'Product', value: 'product' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Stripe Tool
  'n8n-nodes-base.stripeTool': {
    nodeType: 'n8n-nodes-base.stripeTool',
    displayName: 'Stripe Tool',
    icon: 'stripe',
    description: 'Configure Stripe operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'customer',
        options: [
          { name: 'Balance', value: 'balance' },
          { name: 'Charge', value: 'charge' },
          { name: 'Coupon', value: 'coupon' },
          { name: 'Customer', value: 'customer' },
          { name: 'Customer Card', value: 'customerCard' },
          { name: 'Source', value: 'source' },
          { name: 'Token', value: 'token' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Trello Tool
  'n8n-nodes-base.trelloTool': {
    nodeType: 'n8n-nodes-base.trelloTool',
    displayName: 'Trello Tool',
    icon: 'trello',
    description: 'Configure Trello operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'card',
        options: [
          { name: 'Attachment', value: 'attachment' },
          { name: 'Board', value: 'board' },
          { name: 'Card', value: 'card' },
          { name: 'Card Comment', value: 'cardComment' },
          { name: 'Checklist', value: 'checklist' },
          { name: 'Label', value: 'label' },
          { name: 'List', value: 'list' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Microsoft Outlook Tool
  'n8n-nodes-base.microsoftOutlookTool': {
    nodeType: 'n8n-nodes-base.microsoftOutlookTool',
    displayName: 'Microsoft Outlook Tool',
    icon: 'microsoft',
    description: 'Configure Microsoft Outlook operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'message',
        options: [
          { name: 'Calendar', value: 'calendar' },
          { name: 'Contact', value: 'contact' },
          { name: 'Draft', value: 'draft' },
          { name: 'Event', value: 'event' },
          { name: 'Folder', value: 'folder' },
          { name: 'Folder Message', value: 'folderMessage' },
          { name: 'Message', value: 'message' },
          { name: 'Message Attachment', value: 'messageAttachment' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Reply', value: 'reply' },
          { name: 'Send', value: 'send' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
      {
        name: 'toRecipients',
        displayName: 'To',
        type: 'email',
        required: false,
        placeholder: 'recipient@example.com',
        description: 'Email address of the recipient (for message/draft operations)',
      },
      {
        name: 'subject',
        displayName: 'Subject',
        type: 'string',
        required: false,
        placeholder: 'Email subject',
        description: 'Subject line of the email or event title',
      },
      {
        name: 'start',
        displayName: 'Start Time',
        type: 'datetime',
        required: false,
        description: 'Event start date/time (for event operations)',
      },
      {
        name: 'end',
        displayName: 'End Time',
        type: 'datetime',
        required: false,
        description: 'Event end date/time (for event operations)',
      },
      {
        name: 'bodyContent',
        displayName: 'Body',
        type: 'textarea',
        required: false,
        placeholder: 'Enter your message...',
        description: 'Body of the email or event description',
      },
    ],
  },

  // Microsoft Teams Tool
  'n8n-nodes-base.microsoftTeamsTool': {
    nodeType: 'n8n-nodes-base.microsoftTeamsTool',
    displayName: 'Microsoft Teams Tool',
    icon: 'microsoft',
    description: 'Configure Microsoft Teams operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'chatMessage',
        options: [
          { name: 'Channel', value: 'channel' },
          { name: 'Channel Message', value: 'channelMessage' },
          { name: 'Chat Message', value: 'chatMessage' },
          { name: 'Task', value: 'task' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'create',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Microsoft Excel Tool
  'n8n-nodes-base.microsoftExcelTool': {
    nodeType: 'n8n-nodes-base.microsoftExcelTool',
    displayName: 'Microsoft Excel Tool',
    icon: 'microsoft',
    description: 'Configure Microsoft Excel operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'table',
        options: [
          { name: 'Table', value: 'table' },
          { name: 'Workbook', value: 'workbook' },
          { name: 'Worksheet', value: 'worksheet' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getRows',
        options: [
          { name: 'Add Rows', value: 'addRows' },
          { name: 'Delete Rows', value: 'deleteRows' },
          { name: 'Get Columns', value: 'getColumns' },
          { name: 'Get Rows', value: 'getRows' },
          { name: 'Lookup', value: 'lookup' },
          { name: 'Update Row', value: 'updateRow' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Todoist Tool
  'n8n-nodes-base.todoistTool': {
    nodeType: 'n8n-nodes-base.todoistTool',
    displayName: 'Todoist Tool',
    icon: 'todoist',
    description: 'Configure Todoist operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'task',
        options: [
          { name: 'Task', value: 'task' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Close', value: 'close' },
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Reopen', value: 'reopen' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Asana Tool
  'n8n-nodes-base.asanaTool': {
    nodeType: 'n8n-nodes-base.asanaTool',
    displayName: 'Asana Tool',
    icon: 'asana',
    description: 'Configure Asana operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'task',
        options: [
          { name: 'Project', value: 'project' },
          { name: 'Subtask', value: 'subtask' },
          { name: 'Task', value: 'task' },
          { name: 'Task Comment', value: 'taskComment' },
          { name: 'Task Tag', value: 'taskTag' },
          { name: 'User', value: 'user' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Move', value: 'move' },
          { name: 'Search', value: 'search' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // ClickUp Tool
  'n8n-nodes-base.clickUpTool': {
    nodeType: 'n8n-nodes-base.clickUpTool',
    displayName: 'ClickUp Tool',
    icon: 'clickup',
    description: 'Configure ClickUp operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'task',
        options: [
          { name: 'Checklist', value: 'checklist' },
          { name: 'Checklist Item', value: 'checklistItem' },
          { name: 'Comment', value: 'comment' },
          { name: 'Folder', value: 'folder' },
          { name: 'Goal', value: 'goal' },
          { name: 'Goal Key Result', value: 'goalKeyResult' },
          { name: 'Guest', value: 'guest' },
          { name: 'List', value: 'list' },
          { name: 'Space', value: 'space' },
          { name: 'Space Tag', value: 'spaceTag' },
          { name: 'Task', value: 'task' },
          { name: 'Task Dependency', value: 'taskDependency' },
          { name: 'Task Tag', value: 'taskTag' },
          { name: 'Time Entry', value: 'timeEntry' },
          { name: 'Time Entry Tag', value: 'timeEntryTag' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Monday.com Tool
  'n8n-nodes-base.mondayTool': {
    nodeType: 'n8n-nodes-base.mondayTool',
    displayName: 'Monday.com Tool',
    icon: 'monday',
    description: 'Configure Monday.com operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'boardItem',
        options: [
          { name: 'Board', value: 'board' },
          { name: 'Board Column', value: 'boardColumn' },
          { name: 'Board Group', value: 'boardGroup' },
          { name: 'Board Item', value: 'boardItem' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Archive', value: 'archive' },
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Items', value: 'getItems' },
          { name: 'Get Many', value: 'getAll' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Zendesk Tool
  'n8n-nodes-base.zendeskTool': {
    nodeType: 'n8n-nodes-base.zendeskTool',
    displayName: 'Zendesk Tool',
    icon: 'zendesk',
    description: 'Configure Zendesk operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'ticket',
        options: [
          { name: 'Ticket', value: 'ticket' },
          { name: 'Ticket Field', value: 'ticketField' },
          { name: 'User', value: 'user' },
          { name: 'Organization', value: 'organization' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Recover', value: 'recover' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Twilio Tool
  'n8n-nodes-base.twilioTool': {
    nodeType: 'n8n-nodes-base.twilioTool',
    displayName: 'Twilio Tool',
    icon: 'twilio',
    description: 'Configure Twilio operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'sms',
        options: [
          { name: 'Call', value: 'call' },
          { name: 'SMS', value: 'sms' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'send',
        options: [
          { name: 'Make', value: 'make' },
          { name: 'Send', value: 'send' },
        ],
        description: 'The operation to perform',
      },
      {
        name: 'to',
        displayName: 'To',
        type: 'phone',
        required: true,
        placeholder: '+15551234567',
        description: 'The phone number to send to',
      },
      {
        name: 'from',
        displayName: 'From',
        type: 'phone',
        required: true,
        placeholder: '+15559876543',
        description: 'The Twilio phone number to send from',
      },
      {
        name: 'message',
        displayName: 'Message',
        type: 'textarea',
        required: false,
        placeholder: 'Enter your SMS message...',
        description: 'The text message to send',
      },
    ],
  },

  // Supabase Tool
  'n8n-nodes-base.supabaseTool': {
    nodeType: 'n8n-nodes-base.supabaseTool',
    displayName: 'Supabase Tool',
    icon: 'supabase',
    description: 'Configure Supabase operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'row',
        options: [
          { name: 'Row', value: 'row' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
      {
        name: 'tableId',
        displayName: 'Table Name',
        type: 'string',
        required: true,
        placeholder: 'users',
        description: 'The name of the table to operate on',
      },
    ],
  },

  // MongoDB Tool
  'n8n-nodes-base.mongoDbTool': {
    nodeType: 'n8n-nodes-base.mongoDbTool',
    displayName: 'MongoDB Tool',
    icon: 'mongodb',
    description: 'Configure MongoDB operations for AI Agent',
    fields: [
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'find',
        options: [
          { name: 'Aggregate', value: 'aggregate' },
          { name: 'Delete', value: 'delete' },
          { name: 'Find', value: 'find' },
          { name: 'Find And Replace', value: 'findOneAndReplace' },
          { name: 'Find And Update', value: 'findOneAndUpdate' },
          { name: 'Insert', value: 'insert' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
      {
        name: 'collection',
        displayName: 'Collection',
        type: 'string',
        required: true,
        placeholder: 'users',
        description: 'The name of the collection to operate on',
      },
    ],
  },

  // Redis Tool
  'n8n-nodes-base.redisTool': {
    nodeType: 'n8n-nodes-base.redisTool',
    displayName: 'Redis Tool',
    icon: 'redis',
    description: 'Configure Redis operations for AI Agent',
    fields: [
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'get',
        options: [
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Increment', value: 'incr' },
          { name: 'Info', value: 'info' },
          { name: 'Keys', value: 'keys' },
          { name: 'Pop', value: 'pop' },
          { name: 'Publish', value: 'publish' },
          { name: 'Push', value: 'push' },
          { name: 'Set', value: 'set' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Dropbox Tool
  'n8n-nodes-base.dropboxTool': {
    nodeType: 'n8n-nodes-base.dropboxTool',
    displayName: 'Dropbox Tool',
    icon: 'dropbox',
    description: 'Configure Dropbox operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'file',
        options: [
          { name: 'File', value: 'file' },
          { name: 'Folder', value: 'folder' },
          { name: 'Search', value: 'search' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'list',
        options: [
          { name: 'Copy', value: 'copy' },
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Download', value: 'download' },
          { name: 'List', value: 'list' },
          { name: 'Move', value: 'move' },
          { name: 'Query', value: 'query' },
          { name: 'Upload', value: 'upload' },
        ],
        description: 'The operation to perform',
      },
      {
        name: 'path',
        displayName: 'Folder Path',
        type: 'folder',
        required: false,
        placeholder: '/Documents',
        description: 'The folder path to operate in. Use "/" for root folder.',
      },
    ],
  },

  // WooCommerce Tool
  'n8n-nodes-base.wooCommerceTool': {
    nodeType: 'n8n-nodes-base.wooCommerceTool',
    displayName: 'WooCommerce Tool',
    icon: 'woocommerce',
    description: 'Configure WooCommerce operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'product',
        options: [
          { name: 'Customer', value: 'customer' },
          { name: 'Order', value: 'order' },
          { name: 'Product', value: 'product' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Update', value: 'update' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // YouTube Tool
  'n8n-nodes-base.youtubeTool': {
    nodeType: 'n8n-nodes-base.youtubeTool',
    displayName: 'YouTube Tool',
    icon: 'youtube',
    description: 'Configure YouTube operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'video',
        options: [
          { name: 'Channel', value: 'channel' },
          { name: 'Playlist', value: 'playlist' },
          { name: 'Playlist Item', value: 'playlistItem' },
          { name: 'Video', value: 'video' },
          { name: 'Video Category', value: 'videoCategory' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'getAll',
        options: [
          { name: 'Delete', value: 'delete' },
          { name: 'Get', value: 'get' },
          { name: 'Get Many', value: 'getAll' },
          { name: 'Rate', value: 'rate' },
          { name: 'Update', value: 'update' },
          { name: 'Upload', value: 'upload' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Spotify Tool
  'n8n-nodes-base.spotifyTool': {
    nodeType: 'n8n-nodes-base.spotifyTool',
    displayName: 'Spotify Tool',
    icon: 'spotify',
    description: 'Configure Spotify operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'track',
        options: [
          { name: 'Album', value: 'album' },
          { name: 'Artist', value: 'artist' },
          { name: 'Library', value: 'library' },
          { name: 'My Data', value: 'myData' },
          { name: 'Player', value: 'player' },
          { name: 'Playlist', value: 'playlist' },
          { name: 'Track', value: 'track' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'get',
        options: [
          { name: 'Add', value: 'add' },
          { name: 'Get', value: 'get' },
          { name: 'Get New Releases', value: 'getNewReleases' },
          { name: 'Get Tracks', value: 'getTracks' },
          { name: 'Search', value: 'search' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // Twitter/X Tool
  'n8n-nodes-base.twitterTool': {
    nodeType: 'n8n-nodes-base.twitterTool',
    displayName: 'Twitter/X Tool',
    icon: 'twitter',
    description: 'Configure Twitter/X operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'tweet',
        options: [
          { name: 'Direct Message', value: 'directMessage' },
          { name: 'Tweet', value: 'tweet' },
          { name: 'User', value: 'user' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'create',
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
          { name: 'Like', value: 'like' },
          { name: 'Retweet', value: 'retweet' },
          { name: 'Search', value: 'search' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

  // LinkedIn Tool
  'n8n-nodes-base.linkedInTool': {
    nodeType: 'n8n-nodes-base.linkedInTool',
    displayName: 'LinkedIn Tool',
    icon: 'linkedin',
    description: 'Configure LinkedIn operations for AI Agent',
    fields: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'select',
        required: true,
        default: 'post',
        options: [
          { name: 'Post', value: 'post' },
        ],
        description: 'The resource to operate on',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'select',
        required: true,
        default: 'create',
        options: [
          { name: 'Create', value: 'create' },
        ],
        description: 'The operation to perform',
      },
    ],
  },

};

/**
 * Node types that don't require parameter configuration
 * (they have sensible defaults or are configured elsewhere)
 */
export const NODES_WITH_DEFAULTS = new Set([
  'n8n-nodes-base.manualTrigger',
  'n8n-nodes-base.scheduleTrigger',
  'n8n-nodes-base.webhook',
  'n8n-nodes-base.cron',
  'n8n-nodes-base.start',
  'n8n-nodes-base.errorTrigger',
  'n8n-nodes-base.executeWorkflowTrigger',
  'n8n-nodes-base.set',
  'n8n-nodes-base.if',
  'n8n-nodes-base.switch',
  'n8n-nodes-base.merge',
  'n8n-nodes-base.splitInBatches',
  'n8n-nodes-base.noOp',
  'n8n-nodes-base.code',
  'n8n-nodes-base.function',
  'n8n-nodes-base.functionItem',
  'n8n-nodes-base.stickyNote',
  'n8n-nodes-base.wait',
  'n8n-nodes-base.respondToWebhook',
  // AI nodes with sub-node configuration
  '@n8n/n8n-nodes-langchain.chatTrigger',
  '@n8n/n8n-nodes-langchain.manualChatTrigger',
  '@n8n/n8n-nodes-langchain.agent',
  '@n8n/n8n-nodes-langchain.chainLlm',
]);

export interface MissingParameterInfo {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  displayName: string;
  icon: string;
  missingFields: string[];
  config: NodeParameterConfig;
}

/**
 * Check if a node has an expression (dynamic value) for a parameter
 */
function hasExpression(value: any): boolean {
  if (typeof value === 'string') {
    return value.includes('{{') || value.startsWith('=');
  }
  return false;
}

/**
 * Check if a parameter value is empty/missing
 */
function isEmptyValue(value: any): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * Check if a field is conditionally required based on other parameters
 */
function isFieldRequired(field: NodeParameterField, nodeType: string, parameters: any): boolean {
  // Base required check
  if (!field.required) return false;

  // Special cases for conditional requirements
  if (nodeType === 'n8n-nodes-base.executeWorkflow' && field.name === 'workflowId') {
    // Only required when source is 'database' (default) not 'parameter'
    const source = parameters?.source;
    return source !== 'parameter';
  }

  return true;
}

/**
 * Extract nodes that are missing required parameters
 */
export function extractMissingParameters(workflowJson: any): MissingParameterInfo[] {
  const missing: MissingParameterInfo[] = [];
  const nodes = workflowJson?.nodes || [];

  for (const node of nodes) {
    const nodeType = node.type;
    if (!nodeType) continue;

    // Skip nodes that don't need configuration
    if (NODES_WITH_DEFAULTS.has(nodeType)) continue;

    // Check if this node type has required parameters
    const config = NODE_REQUIRED_PARAMS[nodeType];
    if (!config) continue;

    // Check each required field
    const missingFields: string[] = [];
    for (const field of config.fields) {
      // Check if field is required (considering conditional requirements)
      if (!isFieldRequired(field, nodeType, node.parameters)) continue;

      const paramValue = node.parameters?.[field.name];

      // Skip if value has an expression (will be resolved at runtime)
      if (hasExpression(paramValue)) continue;

      // Check if value is empty
      if (isEmptyValue(paramValue)) {
        missingFields.push(field.name);
      }
    }

    if (missingFields.length > 0) {
      missing.push({
        nodeId: node.id,
        nodeName: node.name || config.displayName,
        nodeType,
        displayName: config.displayName,
        icon: config.icon,
        missingFields,
        config,
      });
    }
  }

  return missing;
}

/**
 * Format node type for display
 */
export function getNodeDisplayName(nodeType: string): string {
  const config = NODE_REQUIRED_PARAMS[nodeType];
  if (config) return config.displayName;

  // Fallback: extract from node type
  const parts = nodeType.split('.');
  const name = parts[parts.length - 1] || nodeType;
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}
