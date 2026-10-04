export const demoProfile = {
  candidateName: 'Alex', targetRole: 'MERN Stack Developer',
  resume: 'Built a job portal with React, Node.js, Express, MongoDB, and REST APIs. Implemented JWT authentication, role-based access, job search, pagination, and a responsive React interface. Used JavaScript throughout.',
  jobDescription: 'Build maintainable full-stack features, secure REST APIs, and responsive React interfaces. Understand database design, authentication, JavaScript, and debugging.',
  difficulty: 'pressure', questionCount: 7,
};
const bank = [
  ['MongoDB', 'project', 'Your job portal stores jobs and applications in MongoDB. Why did you choose a document database, and what trade-offs would change your decision?', ['document', 'schema', 'transaction', 'join', 'index'], 'How would you keep a job application and its associated records consistent if one write failed?', 'What would change if reporting required joins across several collections?'],
  ['React', 'project', 'In your job portal, how would you prevent stale search results when a user types quickly and requests arrive out of order?', ['abort', 'debounce', 'effect', 'cleanup', 'request'], 'Debouncing reduces requests, but can an older request still overwrite the latest result?', 'How would you clean up a pending request when the component unmounts?'],
  ['Authentication', 'trade-off', 'You implemented JWT authentication. Where would you store tokens, and how would you protect the application from XSS and CSRF?', ['cookie', 'httponly', 'csrf', 'samesite', 'xss'], 'How does a signed JWT differ from an encrypted token?', 'How would you revoke a session before its access token expires?'],
  ['Node.js', 'debugging', 'Your Express job-search endpoint slows down under load. How would you find out whether the bottleneck is Node.js or the database?', ['profile', 'index', 'query', 'event loop', 'latency'], 'What happens to other requests if you perform CPU-heavy work on the event loop?', 'How would you confirm that a new database index actually improved the query?'],
  ['JavaScript', 'fundamentals', 'Explain a closure using an example from your project. What can go wrong when a React callback captures an older state value?', ['scope', 'closure', 'state', 'dependency', 'functional'], 'Why does a timer sometimes see the state from an earlier render?', 'How would a functional state update change your example?'],
  ['REST APIs', 'scenario', 'How would you design a paginated jobs endpoint so clients get predictable results while new jobs are being posted?', ['cursor', 'sort', 'limit', 'offset', 'validation'], 'What happens to offset pagination when a new job is inserted between page requests?', 'What fields would you use for a stable cursor when timestamps are equal?'],
  ['System Design', 'scenario', 'Your job portal grows from 100 to 100,000 daily users. What would you measure first, and which parts would you scale?', ['cache', 'measure', 'queue', 'index', 'load'], 'How would you invalidate cached job listings when an employer updates a job?', 'How would you prevent duplicate applications when a request is retried?'],
  ['Express', 'fundamentals', 'How do you organize middleware and error handling in your job portal API?', ['middleware', 'next', 'error', 'validation', 'status'], 'How would you handle an error in an asynchronous route?', 'Which error details should be hidden from API clients?'],
  ['MongoDB', 'scenario', 'Which indexes would you add for searching jobs by location and creation date, and how would you validate them?', ['compound', 'index', 'explain', 'sort', 'write'], 'How does the order of fields in a compound index affect this query?', 'What is the cost of keeping too many indexes?'],
  ['React', 'fundamentals', 'How would you separate server data, form state, and derived state in the job portal?', ['state', 'derive', 'cache', 'effect', 'form'], 'When is storing a derived value in state unnecessary?', 'How would you avoid showing stale data after a mutation?'],
];
export function demoQuestions(count, weakTopics = []) {
  const priority = topic => weakTopics.includes(topic) ? weakTopics.indexOf(topic) : weakTopics.length;
  const sorted = [...bank].sort((a, b) => priority(a[0]) - priority(b[0]));
  return sorted.slice(0, count).map(([topic, type, question, keywords, first, second], i) => ({id: `q${i + 1}`, topic, type, difficulty: 'pressure', question, keywords, demoFollowUps: [first, second], followUps: [], completed: false}));
}
export function demoEvaluate(question, answer, depth = 0) {
  const lower = answer.toLowerCase();
  const matched = question.keywords.filter(k => lower.includes(k));
  const score = Math.min(9, Math.round((matched.length / question.keywords.length * 7 + Math.min(answer.trim().length / 180, 2)) * 10) / 10);
  return {score, strengths: matched.map(k => `Touched on ${k}.`), missingPoints: question.keywords.filter(k => !matched.includes(k)).map(k => `Explain ${k} with a concrete example.`), feedback: 'Demo feedback uses a simple keyword rubric. It illustrates the experience and does not verify technical correctness. Start a Gemma interview for model-based evaluation.', followUpRequired: score < 8 && depth < 2, followUpQuestion: question.demoFollowUps[depth] || ''};
}
