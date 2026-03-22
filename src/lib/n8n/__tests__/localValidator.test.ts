import { validateWithN8n } from '../localValidator';

describe('Local Validator', () => {
  it('should auto-fix a workflow with an unknown node type', async () => {
    const workflowWithBogusNode = {
      nodes: [{
        id: '1',
        name: 'My Trigger',
        type: 'This.Node.Does.Not.Exist', // Invalid type
        typeVersion: 1,
        position: [100, 100],
        parameters: {},
      }],
      connections: {},
    };

    const result = await validateWithN8n(workflowWithBogusNode);

    // Should be auto-fixed
    expect(result.valid).toBe(true);
    expect(result.autofixed).toBe(true);
    expect(result.normalized).toBeDefined();
    expect(result.normalized.nodes[0].type).not.toBe('This.Node.Does.Not.Exist');
    expect(result.normalized.nodes[0].type).toMatch(/^n8n-nodes-base\./);
  });

  it('should validate a simple valid workflow', async () => {
    const validWorkflow = {
      nodes: [{
        id: '1',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        typeVersion: 1,
        position: [100, 100],
        parameters: {},
      }],
      connections: {},
    };

    const result = await validateWithN8n(validWorkflow);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should autofix a workflow with missing required properties', async () => {
    const workflowWithMissingProps = {
      nodes: [{
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        // Missing id, typeVersion, position, parameters
      }],
      connections: {},
    };

    const result = await validateWithN8n(workflowWithMissingProps, { autofix: true });

    // Should be fixed automatically
    expect(result.autofixed).toBe(true);
    expect(result.normalized).toBeDefined();
    expect(result.normalized.nodes[0]).toMatchObject({
      name: 'Manual Trigger',
      type: 'n8n-nodes-base.manualTrigger',
      id: expect.any(String),
      typeVersion: 1,
      position: expect.any(Array),
      parameters: expect.any(Object),
    });
  });

  it('should handle workflows with no nodes', async () => {
    const emptyWorkflow = {
      nodes: [],
      connections: {},
    };

    const result = await validateWithN8n(emptyWorkflow);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('at least one node'),
      ])
    );
  });

  it('should handle invalid workflow structure', async () => {
    const invalidWorkflow = null;

    const result = await validateWithN8n(invalidWorkflow);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Invalid workflow format'),
      ])
    );
  });

  it('should auto-fix workflows with fake n8n-nodes-base nodes', async () => {
    const workflowWithFakeNodes = {
      nodes: [
        {
          id: '1',
          name: 'Watch Folders',
          type: 'n8n-nodes-base.watchFolders', // Fake node
          typeVersion: 1,
          position: [100, 100],
          parameters: {},
        },
        {
          id: '2',
          name: 'Process Image',
          type: 'n8n-nodes-base.imageManipulation', // Fake node
          typeVersion: 1,
          position: [200, 200],
          parameters: {},
        }
      ],
      connections: {},
    };

    const result = await validateWithN8n(workflowWithFakeNodes);

    // Should be auto-fixed
    expect(result.valid).toBe(true);
    expect(result.autofixed).toBe(true);
    expect(result.normalized).toBeDefined();

    // Check that fake node types were replaced with real ones
    expect(result.normalized.nodes[0].type).not.toBe('n8n-nodes-base.watchFolders');
    expect(result.normalized.nodes[1].type).not.toBe('n8n-nodes-base.imageManipulation');

    // Both should be valid real node types
    expect(result.normalized.nodes[0].type).toMatch(/^n8n-nodes-base\./);
    expect(result.normalized.nodes[1].type).toMatch(/^n8n-nodes-base\./);
  });

  it('should auto-fix completely broken workflow to 100% valid', async () => {
    const brokenWorkflow = {
      nodes: [
        {
          // Missing everything except invalid type
          type: 'broken.fake.node'
        },
        {
          // Missing type and other properties
          name: '',
          id: null,
          parameters: null
        },
        {
          // Invalid format and fake node
          name: 'Node1',
          type: 'invalidFormat',
          typeVersion: 'invalid',
          position: 'invalid'
        }
      ],
      connections: {},
    };

    const result = await validateWithN8n(brokenWorkflow);

    // Should be completely fixed
    expect(result.valid).toBe(true);
    expect(result.autofixed).toBe(true);
    expect(result.normalized).toBeDefined();

    // Check that all nodes are now valid
    const nodes = result.normalized.nodes;
    expect(nodes).toHaveLength(3);

    // All nodes should have valid properties
    nodes.forEach((node: any, index: number) => {
      expect(node.name).toBeTruthy();
      expect(node.type).toMatch(/^n8n-nodes-base\.|^@n8n\//);
      expect(node.id).toBeTruthy();
      expect(typeof node.typeVersion).toBe('number');
      expect(Array.isArray(node.position)).toBe(true);
      expect(node.position).toHaveLength(2);
      expect(typeof node.parameters).toBe('object');
      expect(node.parameters).not.toBeNull();
    });
  });

  it('should show zero warnings for completely auto-fixed workflows', async () => {
    const messyWorkflow = {
      nodes: [
        {
          name: 'Node1', // Generic name
          type: 'n8n-nodes-base.fakeNode', // Fake node type
          // Missing most properties
        }
      ],
      // Missing connections
    };

    const result = await validateWithN8n(messyWorkflow);

    // Should be auto-fixed with zero warnings
    expect(result.valid).toBe(true);
    expect(result.autofixed).toBe(true);
    expect(result.warnings).toHaveLength(0); // This is the key test!
    expect(result.fixes?.length).toBeGreaterThan(0); // Should have fixes instead
  });

  it('should properly validate real social media nodes', async () => {
    const socialWorkflow = {
      "nodes": [
        {
          "parameters": {},
          "id": "facebook-post",
          "name": "Post to Facebook",
          "type": "n8n-nodes-base.facebookPages",
          "position": [1280, 592],
          "typeVersion": 1
        },
        {
          "parameters": {},
          "id": "instagram-post",
          "name": "Post to Instagram",
          "type": "n8n-nodes-base.instagram",
          "position": [1440, 528],
          "typeVersion": 1
        }
      ],
      "connections": {
        "Post to Facebook": {
          "main": [[]]
        },
        "Post to Instagram": {
          "main": [[]]
        }
      }
    };

    const result = await validateWithN8n(socialWorkflow);

    // These are legitimate n8n nodes - should be valid
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});