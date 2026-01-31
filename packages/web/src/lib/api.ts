const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    return response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export function createSSEConnection(
  endpoint: string,
  body: unknown,
  onMessage: (data: unknown) => void,
  onDone?: () => void,
  onError?: (error: string) => void
) {
  fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
    .then(async (response) => {
      if (!response.ok) {
        onError?.(`HTTP ${response.status}: ${response.statusText}`);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        onError?.('No response body');
        return;
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'done') {
                onDone?.();
              } else if (data.type === 'error') {
                onError?.(data.message);
              } else {
                onMessage(data);
              }
            } catch {
              // 忽略无效 JSON
            }
          }
        }
      }

      // 处理最后一行
      if (buffer.startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.slice(6));
          if (data.type === 'done') {
            onDone?.();
          } else if (data.type === 'error') {
            onError?.(data.message);
          } else {
            onMessage(data);
          }
        } catch {
          // 忽略无效 JSON
        }
      }
    })
    .catch((error) => {
      onError?.(String(error));
    });
}

export async function analyzeRemoteRepo(repoUrl: string, branch?: string) {
  return fetchApi<import('@dext7r/npvm-shared').RemoteAnalysisResult>('/remote/analyze', {
    method: 'POST',
    body: JSON.stringify({ repoUrl, branch }),
  });
}
