import test from 'node:test';
import assert from 'node:assert/strict';
import { generateInterview, evaluateAnswer, generateFollowUp, generateFinalAnalysis } from '../services/gemmaService.js';
test('Gemma adapter validates generation, evaluation, follow-up and analysis contracts', async t => {
  const questions = Array.from({length: 5}, () => ({topic: 'React', type: 'project', difficulty: 'standard', question: 'Why did you choose this state management approach for your project?'}));
  const outputs = [{questions}, {score: 7.5, strengths: ['Identified state ownership'], missingPoints: ['Trade-offs'], feedback: 'Explain alternatives.', followUpRequired: true, followUpQuestion: ''}, {question: 'What would change if two distant components needed the same state?'}, {headline: 'State ownership is clear; explore trade-offs.', recommendations: Array.from({length: 3}, () => ({topic: 'React', exercise: 'Compare context and local state.'}))}];
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {calls.push(JSON.parse(options.body)); return new Response(JSON.stringify({message: {content: JSON.stringify(outputs.shift())}}), {status: 200});});
  const generated = await generateInterview({resume: 'A React project', targetRole: 'Frontend developer', difficulty: 'standard', questionCount: 5});
  assert.equal(generated.length, 5); assert.equal(generated[0].id, 'q1');
  const evaluated = await evaluateAnswer(generated[0].question, 'Use local state.', {}); assert.equal(evaluated.score, 7.5);
  assert.match((await generateFollowUp(generated[0].question, 'Use local state.', evaluated, [])).question, /components/);
  assert.equal((await generateFinalAnalysis({questions: generated}, [])).recommendations.length, 3);
  assert.ok(calls.every(c => c.stream === false && c.format === 'json'));
});
test('malformed model JSON retries once; invalid score is rejected', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {calls++; return new Response(JSON.stringify({message: {content: '{"score":99}'}}));});
  await assert.rejects(evaluateAnswer('Question', 'Answer', {}), {status: 502});
  assert.equal(calls, 2);
});
test('unavailable Ollama produces the actionable error without fake evaluation', async t => {
  t.mock.method(globalThis, 'fetch', async () => {throw new Error('Unavailable');});
  await assert.rejects(evaluateAnswer('Question', 'Answer', {}), {status: 503});
});
