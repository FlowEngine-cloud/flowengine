// Node.js globals for server-side code
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';

      // AI Provider (any OpenAI-compatible API, e.g. OpenRouter)
      AI_BASE_URL?: string;
      AI_API_KEY?: string;
      AI_MODEL?: string;

      // Supabase
      NEXT_PUBLIC_SUPABASE_URL: string;
      NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
      SUPABASE_SERVICE_ROLE_KEY: string;
      SUPABASE_URL?: string;

      // Workflow validation
      VALIDATE_WORKFLOW?: string;
      WORKFLOW_AUTOFIX?: string;
      WORKFLOW_TOOL_SEARCH?: string;
      LOG_VALIDATION_STATS?: string;

      [key: string]: string | undefined;
    }

    interface Process {
      env: ProcessEnv;
    }
  }

  var process: NodeJS.Process;
}

export {};
