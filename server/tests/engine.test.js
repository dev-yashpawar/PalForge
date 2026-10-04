import test from 'node:test';
import assert from 'node:assert/strict';
import { answerQuestion, aggregate } from '../services/interviewEngine.js';
import { demoQuestions } from '../services/demoService.js';
import { extractJSON } from '../services/gemmaService.js';
const session = (difficulty = 'pressure') => ({demo: true, difficulty, questions: demoQuestions(5)});
test('pressure mode stops after exactly two follow-ups', async () => {
  const s = session();
  let result = await answerQuestion(s, {questionId: 'q1', answer: 'Not sure.'});
  assert.equal(result.evaluation.followUpRequired, true);
  result = await answerQuestion(s, {questionId: 'q1', answer: 'Not sure.', followUp: true});
  assert.equal(result.evaluation.followUpRequired, true);
  result = await answerQuestion(s, {questionId: 'q1', answer: 'Not sure.', followUp: true});
  assert.equal(result.evaluation.followUpRequired, false);
  assert.equal(s.questions[0].followUps.length, 2);
  assert.equal(s.questions[0].completed, true);
});
test('standard mode completes the main question without a follow-up', async () => {
  const s = session('standard');
  const result = await answerQuestion(s, {questionId: 'q1', answer: 'Not sure.'});
  assert.equal(result.completed, true);
  assert.equal(s.questions[0].followUps.length, 0);
});
test('out-of-order and wrong-stage answers do not change the session', async () => {
  const s = session();
  await assert.rejects(answerQuestion(s, {questionId: 'q2', answer: 'Hello'}), {status: 409});
  await answerQuestion(s, {questionId: 'q1', answer: 'Not sure.'});
  await assert.rejects(answerQuestion(s, {questionId: 'q1', answer: 'Hello'}), {status: 409});
  assert.equal(s.questions[0].followUps.length, 1);
});
test('skips close a question and all skipped main answers score zero', async () => {
  const s = session();
  for (const q of s.questions) await answerQuestion(s, {questionId: q.id, skip: true});
  assert.equal(aggregate(s).overallScore, 0);
  assert.equal(aggregate(s).weakTopics.length, 5);
});
test('a skipped follow-up preserves the main score', async () => {
  const s = session();
  await answerQuestion(s, {questionId: 'q1', answer: 'Document schemas are flexible.'});
  await answerQuestion(s, {questionId: 'q1', skip: true, followUp: true});
  assert.equal(s.questions[0].completed, true);
  assert.equal(s.questions[0].followUps[0].skipped, true);
  assert.ok(s.questions[0].evaluation.score > 0);
});
test('JSON extraction accepts fences and surrounding commentary, rejects invalid content', () => {
  assert.deepEqual(extractJSON('```json\n{"score":7}\n```'), {score: 7});
  assert.deepEqual(extractJSON('Here is the result: {"score":7} Done.'), {score: 7});
  assert.throws(() => extractJSON('No JSON here'));
});
test('adaptive demo prioritizes weak topics and keeps the requested count', () => {
  const questions = demoQuestions(7, ['JavaScript']);
  assert.equal(questions[0].topic, 'JavaScript');
  assert.equal(questions.length, 7);
  assert.equal(new Set(questions.map(q => q.id)).size, 7);
});
