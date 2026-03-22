export interface Node {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
}

export interface ConnectionData {
  node: string;
  type: string;
  index?: number;
}

export interface Connections {
  [outputName: string]: {
    [outputIndex: number]: ConnectionData[];
  };
}

export interface Workflow {
  name: string;
  nodes: Node[];
  connections: Connections;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalized?: Workflow;
  autofixed?: boolean;
}

export interface ValidationOptions {
  autofix?: boolean;
}