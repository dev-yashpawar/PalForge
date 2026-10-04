import test from 'node:test';
import assert from 'node:assert/strict';
const base = process.env.TEST_API_URL;
test('API demo round-trip: validation, follow-ups, results, persistence and next session', {skip: !base}, async () => {
  async function call(url, body) { const r = await fetch(`${base}${url}`, body ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : undefined); return {status: r.status, data: await r.json()}; }
  assert.equal((await call('/api/interviews', {})).status, 400);
  const {data: s, status} = await call('/api/interviews/demo', {});
  assert.equal(status, 201); assert.equal(s.questions.length, 7); assert.equal(s.demo, true);
  const prefix = `/api/interviews/${s.interviewId}`;
  assert.equal((await call(`${prefix}/results`)).status, 409);
  assert.equal((await call(`${prefix}/answers`, {questionId: 'q1', answer: ''})).status, 400);
  for (let i = 0; i < s.questions.length; i++) {
    let result = await call(`${prefix}/answers`, {questionId: `q${i + 1}`, answer: 'I would need to investigate.'});
    assert.equal(result.status, 200);
    for (let depth = 0; result.data.followUpRequired; depth++) {
      assert.ok(depth < 2);
      result = await call(`${prefix}/answers`, {questionId: `q${i + 1}`, answer: 'I would measure and test this.', followUp: true});
      assert.equal(result.status, 200);
    }
  }
  const {data: result} = await call(`${prefix}/results`);
  assert.equal(result.recommendations.length, 3); assert.ok(result.overallScore >= 0 && result.overallScore <= 100);
  assert.ok((await call(prefix)).data.questions.every(q => q.completed));
  const {data: next} = await call(`${prefix}/next-session`, {});
  assert.equal(next.sourceSessionId, s.interviewId); assert.notEqual(next.interviewId, s.interviewId);
  assert.equal(next.questions[0].topic, result.weakTopics[0].topic);
  assert.equal((await call('/api/interviews/not-an-id')).status, 404);
});
