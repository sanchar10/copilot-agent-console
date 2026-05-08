import type { ChatStep } from '../types/message';

/**
 * Tool names that have a dedicated UI channel and should not be rendered
 * as raw "Tool: <name>" / "Tool done" steps in the desktop chat views.
 *
 * - ask_user / elicitation: rendered as a styled Q&A block by MessageBubble's
 *   inline parser, and as the AskUserCard / ElicitationCard during streaming.
 * - report_intent: surfaced live via the 📌 indicator (latestIntent in chatStore)
 *   and inside the streaming bubble.
 *
 * The mobile path uses its own filter (mobileStepParser.ts) — keep this list
 * in sync if you add a new tool here.
 */
export const STEPS_WITH_DEDICATED_UI = ['ask_user', 'elicitation', 'report_intent'] as const;

const TOOL_ID_REGEX = /(?:^|\s)id=(\S+)/;

function extractToolId(detail: string | undefined): string | null {
  if (!detail) return null;
  const m = detail.match(TOOL_ID_REGEX);
  return m ? m[1] : null;
}

/**
 * Filter out raw "Tool: <name>" and matching "Tool done" rows for the given
 * tool names. Pairs unnamed "Tool done" rows to their start by tool_call_id.
 *
 * Pure function — does not mutate input. Stable order preserved for kept rows.
 *
 * @param steps Steps to filter
 * @param toolNames Tool names to hide (e.g., ['report_intent'])
 * @returns New array with filtered rows removed
 */
export function hideStepsByToolName(steps: ChatStep[] | undefined, toolNames: readonly string[]): ChatStep[] {
  if (!steps || steps.length === 0) return [];
  if (toolNames.length === 0) return steps.slice();

  const hideTitleStarts = new Set(toolNames.map((n) => `Tool: ${n}`));
  const hideTitleDones = new Set(toolNames.map((n) => `Tool done: ${n}`));

  // First pass: collect tool_call_ids of hidden starts so we can match
  // unnamed "Tool done" rows back to them.
  const hiddenIds = new Set<string>();
  for (const s of steps) {
    if (s.title && hideTitleStarts.has(s.title)) {
      const id = extractToolId(s.detail);
      if (id) hiddenIds.add(id);
    }
  }

  // Second pass: drop hidden starts, named-hidden dones, and unnamed dones
  // whose id maps back to a hidden start. Unnamed dones with no matching
  // hidden start (orphans) are preserved — diagnostic value.
  const result: ChatStep[] = [];
  for (const s of steps) {
    const title = s.title || '';
    if (hideTitleStarts.has(title)) continue;
    if (hideTitleDones.has(title)) continue;
    if (title === 'Tool done') {
      const id = extractToolId(s.detail);
      if (id && hiddenIds.has(id)) continue;
    }
    result.push(s);
  }
  return result;
}
