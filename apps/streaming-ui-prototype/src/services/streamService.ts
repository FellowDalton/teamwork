/**
 * Stream Service
 *
 * Connects to the backend SSE endpoint and feeds NDJSON lines
 * into the streaming pipeline. Handles both real API and mock fallback.
 */

export interface StreamOptions {
  onChunk: (text: string) => void;
  onFlush: () => void;
  onError?: (error: string) => void;
  signal?: AbortSignal;
}

const API_BASE = '/api';

/**
 * Send a message to the agent and stream the NDJSON response.
 * Falls back to mock simulation if the backend is unavailable.
 */
export async function streamFromAgent(
  message: string,
  { onChunk, onFlush, onError, signal }: StreamOptions
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        const lines = event.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);

          if (data === '[DONE]') {
            onFlush();
            return;
          }

          // Try to parse as JSON
          try {
            const parsed = JSON.parse(data);

            // Skip init and error events
            if (parsed.type === 'init') continue;
            if (parsed.type === 'error') {
              onError?.(parsed.message);
              continue;
            }

            // For text_delta events, extract and feed the text
            if (parsed.type === 'text_delta' && parsed.text) {
              onChunk(parsed.text);
              continue;
            }

            // For direct NDJSON lines (from result), feed as-is
            if (parsed.type && parsed.type !== 'text_delta') {
              onChunk(JSON.stringify(parsed) + '\n');
            }
          } catch {
            // Not JSON, skip
          }
        }
      }
    }

    onFlush();
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;

    // If backend unavailable, fall back to mock
    const errorMsg = (err as Error).message;
    if (errorMsg.includes('fetch') || errorMsg.includes('Failed') || errorMsg.includes('NetworkError')) {
      console.warn('Backend unavailable, using mock stream');
      onError?.('Backend unavailable — using demo mode');
      await mockFallback(message, onChunk, onFlush);
    } else {
      onError?.(errorMsg);
    }
  }
}

/**
 * Mock fallback when no backend is running.
 * Intelligently picks a scenario based on the user's message.
 */
async function mockFallback(
  message: string,
  onChunk: (text: string) => void,
  onFlush: () => void,
): Promise<void> {
  const { simulateStream } = await import('../mock/streamSimulator');
  const msg = message.toLowerCase();

  let scenario: 'project' | 'dashboard' | 'both' = 'dashboard';
  if (msg.includes('project') || msg.includes('plan') || msg.includes('build') || msg.includes('create')) {
    scenario = 'project';
  } else if (msg.includes('both') || msg.includes('everything') || msg.includes('overview and plan')) {
    scenario = 'both';
  }

  await simulateStream(scenario, onChunk, { speedMs: 60 });
  onFlush();
}
