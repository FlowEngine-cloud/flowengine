import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/n8nInstanceApi', () => ({
  getCredentialDocUrl: vi.fn((type: string) => `https://docs.n8n.io/credentials/${type}`),
}));

import {
  CREDENTIAL_MAPPINGS,
  extractRequiredCredentials,
  checkCredentialStatus,
} from '../credentialExtractor';

// ─── CREDENTIAL_MAPPINGS ──────────────────────────────────────────────────────

describe('CREDENTIAL_MAPPINGS', () => {
  it('contains slack mapping', () => {
    expect(CREDENTIAL_MAPPINGS.slack).toEqual({
      type: 'slackOAuth2Api',
      name: 'Slack',
      icon: 'slack',
    });
  });

  it('contains github mapping', () => {
    expect(CREDENTIAL_MAPPINGS.github).toEqual({
      type: 'githubOAuth2Api',
      name: 'GitHub',
      icon: 'github',
    });
  });

  it('all entries have type, name and icon', () => {
    for (const [, mapping] of Object.entries(CREDENTIAL_MAPPINGS)) {
      expect(mapping.type).toBeTruthy();
      expect(mapping.name).toBeTruthy();
      expect(mapping.icon).toBeTruthy();
    }
  });
});

// ─── extractRequiredCredentials ───────────────────────────────────────────────

describe('extractRequiredCredentials', () => {
  it('returns empty array for null/undefined workflow', () => {
    expect(extractRequiredCredentials(null)).toEqual([]);
    expect(extractRequiredCredentials(undefined)).toEqual([]);
  });

  it('returns empty array for workflow with no nodes', () => {
    expect(extractRequiredCredentials({ nodes: [] })).toEqual([]);
  });

  it('extracts explicit credentials from a node', () => {
    const workflow = {
      nodes: [
        {
          type: 'n8n-nodes-base.slack',
          credentials: { slackOAuth2Api: { id: 'cred-1', name: 'My Slack' } },
        },
      ],
    };
    const result = extractRequiredCredentials(workflow);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('slackOAuth2Api');
    expect(result[0].name).toBe('Slack');
    expect(result[0].icon).toBe('slack');
  });

  it('deduplicates same credential used in multiple nodes', () => {
    const workflow = {
      nodes: [
        {
          type: 'n8n-nodes-base.gmail',
          credentials: { gmailOAuth2: { id: 'cred-1', name: 'Gmail' } },
        },
        {
          type: 'n8n-nodes-base.gmail',
          credentials: { gmailOAuth2: { id: 'cred-1', name: 'Gmail' } },
        },
      ],
    };
    const result = extractRequiredCredentials(workflow);
    expect(result).toHaveLength(1);
  });

  it('infers credential from node type when no explicit credentials', () => {
    const workflow = {
      nodes: [
        { type: 'n8n-nodes-base.slack', credentials: {} },
      ],
    };
    const result = extractRequiredCredentials(workflow);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('slackOAuth2Api');
  });

  it('skips manualTrigger nodes without explicit credentials', () => {
    const workflow = {
      nodes: [
        { type: 'n8n-nodes-base.manualTrigger' },
      ],
    };
    expect(extractRequiredCredentials(workflow)).toEqual([]);
  });

  it('skips scheduleTrigger nodes without explicit credentials', () => {
    const workflow = {
      nodes: [{ type: 'n8n-nodes-base.scheduleTrigger' }],
    };
    expect(extractRequiredCredentials(workflow)).toEqual([]);
  });

  it('skips webhook nodes without explicit credentials', () => {
    const workflow = {
      nodes: [{ type: 'n8n-nodes-base.webhook' }],
    };
    expect(extractRequiredCredentials(workflow)).toEqual([]);
  });

  it('collects nodeTypes for a credential', () => {
    const workflow = {
      nodes: [
        {
          type: 'n8n-nodes-base.slack',
          credentials: { slackOAuth2Api: { id: '1' } },
        },
        {
          type: 'n8n-nodes-base.slackTool',
          credentials: { slackOAuth2Api: { id: '1' } },
        },
      ],
    };
    const result = extractRequiredCredentials(workflow);
    expect(result).toHaveLength(1);
    expect(result[0].nodeTypes).toContain('n8n-nodes-base.slack');
    expect(result[0].nodeTypes).toContain('n8n-nodes-base.slackTool');
  });

  it('includes docUrl from getCredentialDocUrl', () => {
    const workflow = {
      nodes: [
        { type: 'n8n-nodes-base.slack', credentials: { slackOAuth2Api: {} } },
      ],
    };
    const result = extractRequiredCredentials(workflow);
    expect(result[0].docUrl).toContain('slackOAuth2Api');
  });

  it('handles nodes property missing gracefully', () => {
    expect(extractRequiredCredentials({})).toEqual([]);
  });
});

// ─── checkCredentialStatus ────────────────────────────────────────────────────

describe('checkCredentialStatus', () => {
  const requiredCreds = [
    { type: 'slackOAuth2Api', name: 'Slack', icon: 'slack', docUrl: '', nodeTypes: ['n8n-nodes-base.slack'] },
    { type: 'gmailOAuth2', name: 'Gmail', icon: 'gmail', docUrl: '', nodeTypes: ['n8n-nodes-base.gmail'] },
  ];

  it('marks credential as available when user has it', () => {
    const userCreds = [{ id: 'c1', name: 'My Slack', type: 'slackOAuth2Api' }];
    const result = checkCredentialStatus(requiredCreds, userCreds);
    const slack = result.find(r => r.type === 'slackOAuth2Api')!;
    expect(slack.status).toBe('available');
    expect(slack.existingCredentialId).toBe('c1');
  });

  it('marks credential as missing when user does not have it', () => {
    const result = checkCredentialStatus(requiredCreds, []);
    expect(result.every(r => r.status === 'missing')).toBe(true);
  });

  it('returns all available options when multiple credentials of same type exist', () => {
    const userCreds = [
      { id: 'c1', name: 'Slack 1', type: 'slackOAuth2Api' },
      { id: 'c2', name: 'Slack 2', type: 'slackOAuth2Api' },
    ];
    const result = checkCredentialStatus(requiredCreds, userCreds);
    const slack = result.find(r => r.type === 'slackOAuth2Api')!;
    expect(slack.availableCredentials).toHaveLength(2);
  });

  it('returns empty array for no required credentials', () => {
    expect(checkCredentialStatus([], [])).toEqual([]);
  });
});
