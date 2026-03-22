import nodeSchemas from './nodeSchemas.generated.json';
import { categorizeNode, getRequiredSubNodes, NodeCategory } from './nodeCategories';

interface Node {
  name: string;
  type: string;
}

interface ConnectionRef {
  node: string;
  type: string;
  index: number;
}

type ConnectionMatrix = Record<string, ConnectionRef[][]>;
type ConnectionMap = Record<string, ConnectionMatrix>;

interface NodeSchemaInput {
  acceptedTypes?: string[];
}

interface NodeSchema {
  requiredInputs?: Record<string, NodeSchemaInput>;
}

interface NodeSchemasFile {
  schemas: Record<string, NodeSchema>;
}

const schemaData = nodeSchemas as NodeSchemasFile;

export interface NormalizationResult {
  connections: ConnectionMap;
  adjustments: string[];
}

/**
 * Infer the correct port type between two nodes.
 * Uses schema data first, then category heuristics.
 */
export function inferConnectionType(sourceType: string, targetType: string): string | undefined {
  const schema = schemaData.schemas[targetType];

  if (schema?.requiredInputs) {
    for (const [connectionType, inputDef] of Object.entries(schema.requiredInputs)) {
      if (inputDef.acceptedTypes?.includes(sourceType)) {
        return connectionType;
      }
    }
  }

  const sourceCategory = categorizeNode(sourceType);
  const requiredSubNodes = getRequiredSubNodes(targetType);
  const requirementMatch = requiredSubNodes.find(req => req.category === sourceCategory);
  if (requirementMatch) {
    return requirementMatch.connection;
  }

  const targetCategory = categorizeNode(targetType);
  const sourceTypeLower = sourceType.toLowerCase();
  const targetTypeLower = targetType.toLowerCase();

  if (targetCategory === NodeCategory.AI_AGENT) {
    if (sourceCategory === NodeCategory.AI_CHAT_MODEL) return 'ai_languageModel';
    if (sourceCategory === NodeCategory.AI_MEMORY) return 'ai_memory';
    if (sourceCategory === NodeCategory.TOOL) return 'ai_tool';
  }

  if (targetCategory === NodeCategory.TOOL && targetType.includes('toolVectorStore')) {
    if (sourceCategory === NodeCategory.VECTOR_STORE) return 'ai_vectorStore';
    if (sourceCategory === NodeCategory.EMBEDDINGS) return 'ai_embedding';
    if (sourceCategory === NodeCategory.AI_CHAT_MODEL) return 'ai_languageModel';
  }

  if (targetCategory === NodeCategory.VECTOR_STORE) {
    if (sourceCategory === NodeCategory.EMBEDDINGS) return 'ai_embedding';
    if (sourceTypeLower.includes('loader') || sourceTypeLower.includes('document')) return 'ai_document';
    if (sourceTypeLower.includes('textsplitter')) return 'ai_textSplitter';
  }

  if (targetTypeLower.includes('document') && sourceTypeLower.includes('splitter')) {
    return 'ai_textSplitter';
  }

  if (targetTypeLower.includes('retriever')) {
    if (sourceCategory === NodeCategory.VECTOR_STORE) return 'ai_vectorStore';
    if (sourceCategory === NodeCategory.EMBEDDINGS) return 'ai_embedding';
  }

  // Retriever connecting to Agent or Tool
  if (sourceTypeLower.includes('retriever')) {
    if (targetCategory === NodeCategory.AI_AGENT) return 'ai_tool';
    if (targetCategory === NodeCategory.TOOL) return 'ai_tool';
  }

  return undefined;
}

/**
 * Normalize connections so AI sub-nodes use their correct ports instead of `main`.
 */
export function normalizeConnectionsForPorts(
  nodes: Node[],
  connections: ConnectionMap | undefined
): NormalizationResult {
  if (!connections) {
    return { connections: {}, adjustments: [] };
  }

  const nodeMap = new Map(nodes.map(node => [node.name, node]));
  const clonedConnections = cloneConnections(connections);
  const adjustments: string[] = [];

  for (const [sourceName, outputMap] of Object.entries(clonedConnections)) {
    const sourceNode = nodeMap.get(sourceName);
    if (!sourceNode) continue;

    const mainOutputs = outputMap.main;
    if (!Array.isArray(mainOutputs)) continue;

    for (let outputIndex = 0; outputIndex < mainOutputs.length; outputIndex++) {
      const connectionArray = mainOutputs[outputIndex];
      if (!Array.isArray(connectionArray)) continue;

      const filteredConnections: ConnectionRef[] = [];

      for (const connection of connectionArray) {
        const targetNode = nodeMap.get(connection.node);
        if (!targetNode) {
          filteredConnections.push(connection);
          continue;
        }

        const inferredType = inferConnectionType(sourceNode.type, targetNode.type);
        if (!inferredType || inferredType === 'main') {
          filteredConnections.push(connection);
          continue;
        }

        const added = addConnection(outputMap, inferredType, {
          node: connection.node,
          type: inferredType,
          index: 0
        });

        if (added) {
          adjustments.push(`${sourceName} → ${connection.node}: main → ${inferredType}`);
        }
      }

      if (filteredConnections.length > 0) {
        mainOutputs[outputIndex] = filteredConnections;
      } else {
        mainOutputs[outputIndex] = [];
      }
    }

    // Clean up empty main connections
    outputMap.main = outputMap.main.filter(connArray => connArray.length > 0);
    if (outputMap.main.length === 0) {
      delete outputMap.main;
    }
  }

  return { connections: clonedConnections, adjustments };
}

function addConnection(
  outputMap: ConnectionMatrix,
  connectionType: string,
  connection: ConnectionRef
): boolean {
  if (!outputMap[connectionType]) {
    outputMap[connectionType] = [];
  }

  if (outputMap[connectionType].length === 0) {
    outputMap[connectionType].push([]);
  }

  const targetArray = outputMap[connectionType][0];
  const exists = targetArray.some(existing => existing.node === connection.node);
  if (exists) {
    return false;
  }

  targetArray.push(connection);
  return true;
}

function cloneConnections(connections: ConnectionMap): ConnectionMap {
  return JSON.parse(JSON.stringify(connections));
}
