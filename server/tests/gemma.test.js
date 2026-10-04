import test from 'node:test';
import assert from 'node:assert/strict';
import { generateInterview, evaluateAnswer, generateFollowUp, generateFinalAnalysis, getAIConfiguration } from '../services/gemmaService.js';
function providerEnv(t, values) {
  const keys = ['GEMMA_PROVIDER', 'GEMMA_MODEL', 'GEMMA_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API_KEY', 'OLLAMA_URL', 'OLLAMA_API_KEY', 'RENDER'];
  const before = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, values);
  t.after(() => {for (const key of keys) {if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key];}});
}
test('Gemma adapter validates generation, evaluation, follow-up and analysis contracts', async t => {
  providerEnv(t, {GEMMA_PROVIDER: 'ollama'});
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
  providerEnv(t, {GEMMA_PROVIDER: 'ollama'});
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {calls++; return new Response(JSON.stringify({message: {content: '{"score":99}'}}));});
  await assert.rejects(evaluateAnswer('Question', 'Answer', {}), {status: 502});
  assert.equal(calls, 2);
});
test('unavailable Ollama produces the actionable error without fake evaluation', async t => {
  providerEnv(t, {GEMMA_PROVIDER: 'ollama'});
  t.mock.method(globalThis, 'fetch', async () => {throw new Error('Unavailable');});
  await assert.rejects(evaluateAnswer('Question', 'Answer', {}), {status: 503});
});
test('Google AI Studio uses its API key and returns validated interview questions', async t => {
  providerEnv(t, {GEMMA_PROVIDER: 'google', GEMMA_API_KEY: 'test-only-key', GEMMA_MODEL: 'models/gemma-3-27b-it'});
  let call;
  const questions = Array.from({length: 5}, () => ({topic: 'React', type: 'project', difficulty: 'standard', question: 'Why did you choose local state for your React project?'}));
  const output = JSON.stringify({questions});
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    call = {url, headers: options.headers, body: JSON.parse(options.body)};
    return new Response(JSON.stringify({candidates: [{content: {parts: [{text: 'hidden reasoning', thought: true}, {text: output.slice(0, 40)}, {text: output.slice(40)}]}}]}));
  });
  const result = await generateInterview({resume: 'Built a React project.', targetRole: 'Frontend Developer', difficulty: 'standard', questionCount: 5});
  assert.equal(result.length, 5);
  assert.equal(call.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent');
  assert.equal(call.headers['x-goog-api-key'], 'test-only-key');
  assert.ok(!call.url.includes('test-only-key'));
  assert.match(call.body.contents[0].parts[0].text, /Frontend Developer/);
  assert.equal(call.body.systemInstruction, undefined);
  assert.equal(call.body.generationConfig.responseMimeType, undefined);
});
test('Google provider handles all evaluation, follow-up and final-analysis responses', async t => {
  providerEnv(t, {GEMMA_PROVIDER: 'gemini', GEMMA_API_KEY: 'test-only-key'});
  const outputs = [
    {score: 6, strengths: ['Explained state'], missingPoints: ['Discuss trade-offs'], feedback: 'Give a concrete example.', followUpRequired: true, followUpQuestion: ''},
    {question: 'How would you share this state across unrelated components?'},
    {headline: 'Practice React trade-offs.', recommendations: Array.from({length: 3}, () => ({topic: 'React', exercise: 'Compare local state and context.'}))},
  ];
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({candidates: [{content: {parts: [{text: `\`\`\`json\n${JSON.stringify(outputs.shift())}\n\`\`\``}]}}]})));
  assert.equal((await evaluateAnswer('Question', 'Answer', {})).score, 6);
  assert.match((await generateFollowUp('Question', 'Answer', {}, [])).question, /state/);
  assert.equal((await generateFinalAnalysis({questions: []}, [])).recommendations.length, 3);
});
test('Google errors distinguish credentials, model names and quota; never leak the key', async t => {
  providerEnv(t, {GEMMA_PROVIDER: 'google', GEMMA_API_KEY: 'test-only-key'});
  for (const [status, message] of [[401, /credentials/], [403, /permissions/], [404, /configured model/], [429, /quota/], [400, /rejected the model request/], [500, /temporarily unavailable/]]) {
    t.mock.method(globalThis, 'fetch', async () => new Response('secret upstream diagnostic', {status}));
    await assert.rejects(evaluateAnswer('Question', 'Answer', {}), error => error.status === 503 && message.test(error.message) && !error.message.includes('test-only-key') && !error.message.includes('secret upstream'));
    t.mock.restoreAll();
  }
});
test('misconfigured Google fails before a request; Render loopback Ollama is flagged', async t => {
  assert.equal(getAIConfiguration({}).provider, 'google');
  assert.equal(getAIConfiguration({}).configured, false);
  providerEnv(t, {GEMMA_PROVIDER: 'google'});
  const mock = t.mock.method(globalThis, 'fetch', () => {throw new Error('Should not fetch');});
  await assert.rejects(evaluateAnswer('Question', 'Answer', {}), /GEMMA_API_KEY is missing/);
  assert.equal(mock.mock.callCount(), 0);
  assert.equal(getAIConfiguration({GEMMA_PROVIDER: 'google', GEMMA_API_KEY: 'secret', GEMMA_MODEL: 'gemma3:4b'}).configured, false);
  assert.equal(getAIConfiguration({RENDER: 'true', GEMMA_PROVIDER: 'ollama'}).configured, false);
  assert.equal(getAIConfiguration({GEMMA_PROVIDER: 'typo'}).configured, false);
  const publicConfig = getAIConfiguration({GEMMA_PROVIDER: 'google', GEMMA_API_KEY: 'secret'});
  assert.equal(publicConfig.provider, 'google');
  assert.equal(publicConfig.configured, true);
  assert.ok(!JSON.stringify(publicConfig).includes('secret'));
});
test('Google malformed responses are validated and retried once', async t => {
  providerEnv(t, {GEMMA_PROVIDER: 'google', GEMMA_API_KEY: 'test-only-key'});
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({candidates: [{content: {parts: [{text: '{"score":99}'}]}}]})));
  await assert.rejects(evaluateAnswer('Question', 'Answer', {}), {status: 502});
  assert.equal(mock.mock.callCount(), 2);
});
test('remote Ollama supports a bearer key and an /api base URL', async t => {
  providerEnv(t, {GEMMA_PROVIDER: 'ollama', OLLAMA_URL: 'https://model.example/api/', OLLAMA_API_KEY: 'test-only-key'});
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://model.example/api/chat');
    assert.equal(options.headers.Authorization, 'Bearer test-only-key');
    return new Response(JSON.stringify({message: {content: JSON.stringify({question: 'What happens if this operation fails halfway through?'})}}));
  });
  assert.match((await generateFollowUp('Question', 'Answer', {}, [])).question, /fails/);
});
