// supabase/functions/deno.d.ts
// Ambient definitions for Deno runtime globals and remote URL imports.
// This allows standard TypeScript editors/linters to recognize Deno APIs without errors
// when the VS Code Deno extension is not active.

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): Record<string, string>;
  }

  export const env: Env;

  export function serve(
    handler: (req: Request) => Response | Promise<Response>
  ): void;
  export function serve(
    options: {
      port?: number;
      hostname?: string;
      signal?: AbortSignal;
      onError?: (error: unknown) => Response | Promise<Response>;
      onListen?: (params: { hostname: string; port: number }) => void;
    },
    handler: (req: Request) => Response | Promise<Response>
  ): void;
}

declare module 'https://esm.sh/@supabase/supabase-js*' {
  export * from '@supabase/supabase-js';
}

declare module 'https://*' {
  const content: any;
  export default content;
  export const createClient: any;
}
