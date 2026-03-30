import { describe, it, expect } from 'vitest';
import { extractNodeConfigs, applyNodeConfigs, type NodeConfigSnapshot } from '@/lib/templateUpdates';

// ─── extractNodeConfigs ───────────────────────────────────────────────────────

describe('extractNodeConfigs', () => {
  it('returns empty array for empty nodes list', () => {
    expect(extractNodeConfigs({ nodes: [] })).toEqual([]);
    expect(extractNodeConfigs({})).toEqual([]);
    expect(extractNodeConfigs(null)).toEqual([]);
  });

  it('skips stickyNote and noOp utility nodes', () => {
    const workflow = {
      nodes: [
        { name: 'Note', type: 'n8n-nodes-base.stickyNote', parameters: { content: 'hello' } },
        { name: 'Noop', type: 'n8n-nodes-base.noOp', parameters: {} },
      ],
    };
    expect(extractNodeConfigs(workflow)).toEqual([]);
  });

  it('extracts credentials from nodes', () => {
    const workflow = {
      nodes: [{
        name: 'Send Email',
        type: 'n8n-nodes-base.emailSend',
        credentials: {
          smtp: { id: 'cred-1', name: 'My SMTP' },
        },
        parameters: {},
      }],
    };
    const configs = extractNodeConfigs(workflow);
    expect(configs).toHaveLength(1);
    expect(configs[0].credentials).toEqual({ smtp: { id: 'cred-1', name: 'My SMTP' } });
  });

  it('extracts parameters, skipping empty values and "authentication" key', () => {
    const workflow = {
      nodes: [{
        name: 'HTTP Request',
        type: 'n8n-nodes-base.httpRequest',
        credentials: {},
        parameters: {
          url: 'https://example.com/api',
          method: 'GET',
          authentication: 'none', // should be skipped
          emptyParam: '',         // should be skipped
          nullParam: null,        // should be skipped
          undefinedParam: undefined, // should be skipped
        },
      }],
    };
    const configs = extractNodeConfigs(workflow);
    expect(configs).toHaveLength(1);
    expect(configs[0].parameters).toEqual({ url: 'https://example.com/api', method: 'GET' });
    expect(configs[0].parameters).not.toHaveProperty('authentication');
    expect(configs[0].parameters).not.toHaveProperty('emptyParam');
  });

  it('skips nodes with no meaningful config (no creds, no non-empty params)', () => {
    const workflow = {
      nodes: [{
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        parameters: {},
      }],
    };
    expect(extractNodeConfigs(workflow)).toEqual([]);
  });

  it('captures both nodeName and nodeType', () => {
    const workflow = {
      nodes: [{
        name: 'Slack Message',
        type: 'n8n-nodes-base.slack',
        credentials: { slackApi: { id: 'cred-slack', name: 'Slack' } },
        parameters: { channel: '#general' },
      }],
    };
    const [config] = extractNodeConfigs(workflow);
    expect(config.nodeName).toBe('Slack Message');
    expect(config.nodeType).toBe('n8n-nodes-base.slack');
  });

  it('handles credentials without .id (skips them)', () => {
    const workflow = {
      nodes: [{
        name: 'Some Node',
        type: 'n8n-nodes-base.something',
        credentials: { api: { name: 'No ID cred' } }, // no .id
        parameters: { key: 'value' },
      }],
    };
    const [config] = extractNodeConfigs(workflow);
    expect(config.credentials).toEqual({});
    expect(config.parameters).toEqual({ key: 'value' });
  });
});

// ─── applyNodeConfigs ─────────────────────────────────────────────────────────

describe('applyNodeConfigs', () => {
  const baseWorkflow = {
    nodes: [
      {
        name: 'Send Email',
        type: 'n8n-nodes-base.emailSend',
        credentials: {},
        parameters: { toEmail: '' },
      },
      {
        name: 'HTTP Request',
        type: 'n8n-nodes-base.httpRequest',
        credentials: {},
        parameters: { url: 'https://new-url.com' },
      },
    ],
  };

  const savedConfigs: NodeConfigSnapshot[] = [
    {
      nodeName: 'Send Email',
      nodeType: 'n8n-nodes-base.emailSend',
      credentials: { smtp: { id: 'cred-1', name: 'My SMTP' } },
      parameters: { toEmail: 'user@example.com' },
    },
    {
      nodeName: 'HTTP Request',
      nodeType: 'n8n-nodes-base.httpRequest',
      credentials: {},
      parameters: { url: 'https://old-url.com', method: 'POST' },
    },
  ];

  it('restores credentials to matched nodes', () => {
    const result = applyNodeConfigs(baseWorkflow, savedConfigs);
    const emailNode = result.workflow.nodes.find((n: any) => n.name === 'Send Email');
    expect(emailNode.credentials).toMatchObject({ smtp: { id: 'cred-1', name: 'My SMTP' } });
  });

  it('restores parameters to matched nodes (merge over new defaults)', () => {
    const result = applyNodeConfigs(baseWorkflow, savedConfigs);
    const httpNode = result.workflow.nodes.find((n: any) => n.name === 'HTTP Request');
    expect(httpNode.parameters.url).toBe('https://old-url.com'); // saved value wins
    expect(httpNode.parameters.method).toBe('POST'); // from saved config
  });

  it('lists matched node names', () => {
    const result = applyNodeConfigs(baseWorkflow, savedConfigs);
    expect(result.matched).toContain('Send Email');
    expect(result.matched).toContain('HTTP Request');
  });

  it('does not mutate the original workflow (deep clone)', () => {
    const original = JSON.parse(JSON.stringify(baseWorkflow));
    applyNodeConfigs(baseWorkflow, savedConfigs);
    expect(baseWorkflow).toEqual(original);
  });

  it('marks unmatched when saved node type changed', () => {
    const changedTypeConfigs: NodeConfigSnapshot[] = [{
      nodeName: 'Send Email',
      nodeType: 'n8n-nodes-base.oldEmailNode', // different type than in workflow
      credentials: { smtp: { id: 'cred-1', name: 'SMTP' } },
      parameters: {},
    }];
    const result = applyNodeConfigs(baseWorkflow, changedTypeConfigs);
    expect(result.unmatched.some((u: string) => u.includes('Send Email') && u.includes('type changed'))).toBe(true);
    expect(result.changedNodes.some((n: any) => n.nodeName === 'Send Email' && n.changeType === 'type_changed')).toBe(true);
  });

  it('marks unmatched when saved node no longer exists in workflow', () => {
    const extraConfig: NodeConfigSnapshot[] = [{
      nodeName: 'Deleted Node',
      nodeType: 'n8n-nodes-base.something',
      credentials: {},
      parameters: { key: 'val' },
    }];
    const result = applyNodeConfigs(baseWorkflow, extraConfig);
    expect(result.unmatched.some((u: string) => u.includes('Deleted Node') && u.includes('node removed'))).toBe(true);
    expect(result.changedNodes.some((n: any) => n.nodeName === 'Deleted Node' && n.changeType === 'removed')).toBe(true);
  });

  it('detects new nodes added in updated workflow', () => {
    const workflowWithNewNode = {
      nodes: [
        ...baseWorkflow.nodes,
        {
          name: 'New Slack Node',
          type: 'n8n-nodes-base.slack',
          credentials: { slackApi: { id: 'cred-2', name: 'Slack' } },
          parameters: { channel: '#new' },
        },
      ],
    };
    const result = applyNodeConfigs(workflowWithNewNode, savedConfigs);
    expect(result.newNodes).toContain('New Slack Node');
    expect(result.addedNodes.some((n: any) => n.name === 'New Slack Node')).toBe(true);
  });

  it('returns empty arrays when no saved configs', () => {
    const result = applyNodeConfigs(baseWorkflow, []);
    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual([]);
    expect(result.preservedNodes).toEqual([]);
  });

  it('includes preservedNodes detail for matched nodes', () => {
    const result = applyNodeConfigs(baseWorkflow, savedConfigs);
    const emailPreserved = result.preservedNodes.find((n: any) => n.name === 'Send Email');
    expect(emailPreserved).toBeDefined();
    expect(emailPreserved.hasCredentials).toBe(true);
  });
});
