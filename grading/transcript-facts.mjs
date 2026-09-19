export function transcriptFacts(transcript) {
  const events = [], parseErrors = [];
  transcript.split('\n').forEach((line, index) => {
    if (!line.trim()) return;
    try { events.push(JSON.parse(line)); } catch { parseErrors.push(index + 1); }
  });
  const completed = events.filter(e => e.type === 'item.completed').map(e => e.item).filter(Boolean);
  const calls = completed.filter(i => i.type === 'mcp_tool_call');
  const native = completed.filter(i => ['command_execution', 'file_change', 'web_search'].includes(i.type));
  const repetitions = []; let previous, count = 0;
  for (const call of completed.filter(i => ['mcp_tool_call', 'file_change'].includes(i.type))) {
    if (call.type === 'file_change') { previous = null; count = 0; continue; }
    let body;
    try { body = JSON.parse(call.result?.content?.find(c => c.type === 'text')?.text ?? 'null'); } catch {}
    const qualifies = call.tool === 'read_file' || ['run_command', 'run_tests'].includes(call.tool) && body?.code !== undefined && body.code !== 0;
    const key = qualifies ? JSON.stringify([call.tool, call.arguments]) : null;
    count = key && key === previous ? count + 1 : 1; previous = key;
    if (key && count === 6) repetitions.push({ tool: call.tool, arguments: call.arguments, itemId: call.id });
  }
  return { parseErrors, calls: calls.length, failedMcpCalls: calls.filter(c => c.error).length,
    nativeCalls: native.length, nativeEditCalls: native.filter(i => i.type === 'file_change').length, thrashCandidates: repetitions,
    finalMessages: completed.filter(i => i.type === 'agent_message').map(i => i.text),
    terminalUsage: events.filter(e => e.type === 'turn.completed').at(-1)?.usage ?? null };
}
