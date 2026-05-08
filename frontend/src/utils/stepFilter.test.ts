import { describe, it, expect } from 'vitest';
import { hideStepsByToolName, STEPS_WITH_DEDICATED_UI } from './stepFilter';
import type { ChatStep } from '../types/message';

const mk = (title: string, detail?: string): ChatStep => ({ title, detail });

describe('hideStepsByToolName', () => {
  it('returns empty array for undefined / empty input', () => {
    expect(hideStepsByToolName(undefined, ['report_intent'])).toEqual([]);
    expect(hideStepsByToolName([], ['report_intent'])).toEqual([]);
  });

  it('returns input copy when toolNames is empty', () => {
    const steps = [mk('Tool: edit'), mk('Tool done: edit')];
    expect(hideStepsByToolName(steps, [])).toEqual(steps);
  });

  it('hides named start and named done for a filtered tool', () => {
    const steps = [
      mk('Tool: report_intent', 'id=abc\nInput: {"intent":"foo"}'),
      mk('Tool done: report_intent', 'id=abc\nOutput: ok'),
      mk('Tool: edit', 'id=xyz'),
    ];
    const out = hideStepsByToolName(steps, ['report_intent']);
    expect(out.map((s) => s.title)).toEqual(['Tool: edit']);
  });

  it('hides bare "Tool done" by tool_call_id pairing', () => {
    const steps = [
      mk('Tool: report_intent', 'id=call_4URO\nInput: {"intent":"foo"}'),
      mk('Tool done', 'id=call_4URO\nOutput: ok'),
    ];
    const out = hideStepsByToolName(steps, ['report_intent']);
    expect(out).toEqual([]);
  });

  it('preserves orphan "Tool done" with no matching hidden start', () => {
    const steps = [
      mk('Tool: edit', 'id=call_edit'),
      mk('Tool done', 'id=call_unknown\nOutput: stale'),
    ];
    const out = hideStepsByToolName(steps, ['report_intent']);
    expect(out.map((s) => s.title)).toEqual(['Tool: edit', 'Tool done']);
  });

  it('preserves unrelated tools untouched', () => {
    const steps = [
      mk('Tool: edit', 'id=1\nInput: {"path":"a.ts"}'),
      mk('Tool done: edit', 'id=1\nOutput: ok'),
      mk('Reasoning', 'thinking...'),
    ];
    const out = hideStepsByToolName(steps, ['report_intent']);
    expect(out).toEqual(steps);
  });

  it('hides multiple invocations of the same tool by id', () => {
    const steps = [
      mk('Tool: report_intent', 'id=a\nInput: {"intent":"first"}'),
      mk('Tool done', 'id=a\nOutput: ok'),
      mk('Tool: report_intent', 'id=b\nInput: {"intent":"second"}'),
      mk('Tool done', 'id=b\nOutput: ok'),
      mk('Tool: edit', 'id=c'),
    ];
    const out = hideStepsByToolName(steps, ['report_intent']);
    expect(out.map((s) => s.title)).toEqual(['Tool: edit']);
  });

  it('hides ask_user and elicitation when requested', () => {
    const steps = [
      mk('Tool: ask_user', 'id=u1\nInput: {"question":"q?"}'),
      mk('Tool done', 'id=u1\nOutput: User responded: hi'),
      mk('Tool: elicitation', 'id=e1\nInput: {"message":"m"}'),
      mk('Tool done: elicitation', 'id=e1\nOutput: ok'),
      mk('Tool: edit', 'id=ed1'),
    ];
    const out = hideStepsByToolName(steps, STEPS_WITH_DEDICATED_UI);
    expect(out.map((s) => s.title)).toEqual(['Tool: edit']);
  });

  it('handles in-flight start (no matching done yet) — hides the start', () => {
    const steps = [
      mk('Tool: ask_user', 'id=u1\nInput: {"question":"waiting"}'),
    ];
    const out = hideStepsByToolName(steps, ['ask_user']);
    expect(out).toEqual([]);
  });

  it('handles step with missing detail (no id) — hides start by title alone', () => {
    const steps = [
      mk('Tool: report_intent'),
      mk('Tool done'),
    ];
    const out = hideStepsByToolName(steps, ['report_intent']);
    // Start hidden by title; bare "Tool done" with no id is orphan — preserved.
    expect(out.map((s) => s.title)).toEqual(['Tool done']);
  });

  it('does not mutate input array', () => {
    const steps = [
      mk('Tool: report_intent', 'id=a'),
      mk('Tool done', 'id=a'),
      mk('Tool: edit'),
    ];
    const before = JSON.stringify(steps);
    hideStepsByToolName(steps, ['report_intent']);
    expect(JSON.stringify(steps)).toBe(before);
  });
});
