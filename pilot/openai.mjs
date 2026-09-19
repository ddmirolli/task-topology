export function openAIAdapter(apiKey, { transport = fetch } = {}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for live attempts.');
  async function request(endpoint, body, signal) {
    const response = await transport(`https://api.openai.com/v1/responses${endpoint}`, {
      method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body), signal,
    });
    // Never copy provider error bodies or authorization headers into records.
    if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}`);
    return { data: await response.json(), requestId: response.headers.get('x-request-id') };
  }
  return {
    async count(body, signal) {
      const { data } = await request('/input_tokens', body, signal);
      if (!Number.isSafeInteger(data.input_tokens) || data.input_tokens < 0) throw new Error('Invalid input token count');
      return data.input_tokens;
    },
    async respond(body, signal) { return request('', body, signal); },
  };
}
