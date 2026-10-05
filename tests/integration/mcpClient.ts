import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

interface JsonRpcResponse {
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface ToolCallResult {
  isError: boolean;
  text: string;
}

/**
 * Minimal MCP stdio client that spawns the real `recipeMcpServer.ts` as a child
 * process and speaks JSON-RPC over stdio. Used by the integration tests to
 * exercise the actual `create_recipe` / `search_recipes` tools end to end.
 */
export class McpStdioClient {
  private child: ChildProcessWithoutNullStreams;
  private buf = '';
  private nextId = 1;
  private readonly pending = new Map<number, (res: JsonRpcResponse) => void>();

  constructor(env: Record<string, string>) {
    this.child = spawn(
      'node',
      ['--import', 'tsx/esm', 'src/mcp/recipeMcpServer.ts'],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    ) as ChildProcessWithoutNullStreams;

    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => this.onData(chunk));
    // Keep stderr drained; surface only on demand for debugging.
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', () => undefined);
  }

  private onData(chunk: string): void {
    this.buf += chunk;
    let idx: number;
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (!line) continue;
      let msg: JsonRpcResponse;
      try {
        msg = JSON.parse(line) as JsonRpcResponse;
      } catch {
        continue;
      }
      if (typeof msg.id === 'number' && this.pending.has(msg.id)) {
        const resolve = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        resolve(msg);
      }
    }
  }

  private request(method: string, params: unknown): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timed out: ${method}`));
      }, 15_000);
      this.pending.set(id, (res) => {
        clearTimeout(timer);
        resolve(res);
      });
      this.child.stdin.write(
        JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'
      );
    });
  }

  private notify(method: string, params?: unknown): void {
    this.child.stdin.write(
      JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'
    );
  }

  async initialize(): Promise<void> {
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'integration-test', version: '0.0.1' },
    });
    this.notify('notifications/initialized');
  }

  async listToolNames(): Promise<string[]> {
    const res = await this.request('tools/list', {});
    const tools = (res.result as { tools?: Array<{ name: string }> }).tools ?? [];
    return tools.map((t) => t.name).sort();
  }

  /**
   * Call a tool. Returns the first text content plus whether the call reported
   * an error — either an application-level `isError` result or a JSON-RPC error
   * (e.g. the SDK's strict input validation rejection).
   */
  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolCallResult> {
    const res = await this.request('tools/call', { name, arguments: args });
    if (res.error) {
      return { isError: true, text: res.error.message };
    }
    const result = res.result as {
      isError?: boolean;
      content?: Array<{ type: string; text?: string }>;
    };
    const text = result.content?.find((c) => c.type === 'text')?.text ?? '';
    return { isError: result.isError === true, text };
  }

  async close(): Promise<void> {
    this.child.kill();
    await new Promise<void>((resolve) => {
      this.child.on('close', () => resolve());
      // Fallback in case 'close' does not fire promptly.
      setTimeout(resolve, 1_000);
    });
  }
}
