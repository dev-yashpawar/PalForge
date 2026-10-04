// Uses fictional context only. Requires the local API to be running.
const base = 'http://127.0.0.1:3001';
async function call(path, body) {
  const response = await fetch(`${base}/api${path}`, {method: body ? 'POST' : 'GET', headers: {'Content-Type': 'application/json'}, ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(250000)});
  const data = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${data.error}`);
  return data;
}
try {
  const health = await call('/health');
  if (health.ai?.provider !== 'google' || !health.ai.configured) throw new Error('Local API must be configured for Google AI Studio. Restart npm run dev after updating .env.');
  console.log(`Local API: ${health.ai.provider} / ${health.ai.model}`);
  let session = await call('/interviews', {candidateName: 'Local smoke test', targetRole: 'MERN Stack Developer', resume: 'Fictional candidate built a React job portal using Node.js, Express, MongoDB and JWT authentication. Implemented paginated job search and accessible application forms. Built a second project: a REST API task tracker with validation and error handling.', jobDescription: 'Build React interfaces and secure Express REST APIs; explain database trade-offs and debug production issues.', difficulty: 'pressure', questionCount: 5});
  const id = session.interviewId;
  console.log(`Generated ${session.questions.length} real model questions. Session: ${id}`);
  const questionId = session.questions[0].id;
  let result = await call(`/interviews/${id}/answers`, {questionId, answer: 'I would first identify the requirements and validate inputs, then use middleware to handle errors consistently. I would test the failure cases and measure latency before optimizing. I need to explore the database trade-offs in more detail.'});
  console.log(`Main answer evaluated: ${result.score}/10`);
  for (let depth = 0; result.followUpRequired; depth++) {
    if (depth >= 2) throw new Error('Follow-up cap exceeded.');
    console.log(`Follow-up ${depth + 1} generated.`);
    result = await call(`/interviews/${id}/answers`, {questionId, followUp: true, answer: 'I would compare consistency and availability requirements, investigate the query plan and indexes, and use transactions when multiple writes must be atomic. I would verify the behavior with integration tests and measure the result.'});
    console.log(`Follow-up evaluated: ${result.score}/10`);
  }
  session = result.session;
  for (const q of session.questions.filter(q => !q.completed)) await call(`/interviews/${id}/answers`, {questionId: q.id, skip: true});
  const results = await call(`/interviews/${id}/results`);
  console.log(`Final analysis: ${results.overallScore}/100; ${results.recommendations.length} practice recommendations. Remaining questions were deliberately skipped.`);
  console.log(`PASS: http://127.0.0.1:5173/results/${id}`);
} catch (error) {console.error(error.message); process.exitCode = 1;}
