// Structural evidence checks do not replace the seven-rule transcript review.
export function sessionEvidence(bytes, prompt) {
  const entries = bytes.toString().trim().split('\n').map(JSON.parse);
  const items = entries.filter(e => e.type === 'response_item').map(e => e.payload);
  const messageText = item => (item.content ?? []).map(c => c.text ?? '').join('').trim();
  const users = items.filter(i => i.type === 'message' && i.role === 'user').map(messageText);
  const taskMessages = users.filter(text => text === prompt.trim());
  const extraUserMessages = users.filter(text => text !== prompt.trim()
    && !/^<environment_context>[\s\S]*<\/environment_context>$/.test(text));
  const skillCatalogs = items.filter(i => i.role === 'developer' && messageText(i).includes('### Available skills'));
  const calls = new Map(items.filter(i => ['custom_tool_call', 'function_call'].includes(i.type)).map(i => [i.call_id, i]));
  const outputs = items.filter(i => ['custom_tool_call_output', 'function_call_output'].includes(i.type));
  const rejectedNativePatches = outputs.filter(i => {
    const call = calls.get(i.call_id), input = call?.input ?? call?.arguments ?? '';
    return (call?.name === 'apply_patch' || /\bapply_patch\s*\(/.test(input))
      && /apply_patch[\s\S]*(?:failed|denied|not permitted|rejected)/i.test(JSON.stringify(i.output));
  }).map(i => i.call_id);
  return { taskMessageCount: taskMessages.length, extraUserMessageCount: extraUserMessages.length,
    skillCatalogCount: skillCatalogs.length, rejectedNativePatches,
    contextMatches: taskMessages.length === 1 && extraUserMessages.length === 0 && skillCatalogs.length === 0,
    fullRubricStatus: 'pending_review', customCodeInterpretation: 'requires_review' };
}
