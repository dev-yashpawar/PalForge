import * as gemma from './gemmaService.js';
import { demoEvaluate } from './demoService.js';
export async function answerQuestion(session, input) {
  const question = session.questions.find(q => !q.completed);
  if (!question || question.id !== input.questionId) throw Object.assign(new Error('This question is no longer active. Refresh the interview.'), {status: 409});
  const pending = question.followUps.find(f => !f.evaluation && !f.skipped);
  if (Boolean(pending) !== Boolean(input.followUp)) throw Object.assign(new Error('Answer the current question before continuing.'), {status: 409});
  if (input.skip) {
    if (pending) { pending.skipped = true; pending.answer = ''; }
    else { question.skipped = true; question.answer = ''; question.evaluation = {score: 0, strengths: [], missingPoints: ['Question skipped.'], feedback: 'Try this topic in your next session.', followUpRequired: false, followUpQuestion: ''}; }
    question.completed = true;
    return {evaluation: pending ? null : question.evaluation, completed: true};
  }
  const depth = pending ? question.followUps.length : 0;
  const evaluation = session.demo ? demoEvaluate(question, input.answer, depth) : await gemma.evaluateAnswer(pending?.question || question.question, input.answer, {targetRole: session.targetRole, resume: session.resumeText, history: question.followUps});
  const shouldFollow = session.difficulty === 'pressure' && depth < 2 && (evaluation.score < 8 || evaluation.followUpRequired);
  let next = '';
  if (shouldFollow) next = session.demo ? evaluation.followUpQuestion : (await gemma.generateFollowUp(question.question, input.answer, evaluation, question.followUps)).question;
  evaluation.followUpRequired = Boolean(next);
  evaluation.followUpQuestion = next;
  if (pending) { pending.answer = input.answer; pending.evaluation = evaluation; } else { question.answer = input.answer; question.evaluation = evaluation; }
  if (next) question.followUps.push({question: next}); else question.completed = true;
  return {evaluation, completed: question.completed};
}
export function aggregate(session) {
  const groups = new Map();
  for (const q of session.questions) {
    const scores = [q.evaluation?.score ?? 0, ...q.followUps.filter(f => f.evaluation).map(f => f.evaluation.score)];
    const score = scores.reduce((a, b) => a + b, 0) / scores.length;
    groups.set(q.topic, [...(groups.get(q.topic) || []), score]);
  }
  const topicScores = [...groups].map(([topic, scores]) => ({topic, score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10)})).sort((a, b) => b.score - a.score);
  return {topicScores, overallScore: Math.round(session.questions.reduce((sum, q) => {const s = [q.evaluation?.score ?? 0, ...q.followUps.filter(f => f.evaluation).map(f => f.evaluation.score)]; return sum + s.reduce((a, b) => a + b, 0) / s.length;}, 0) / session.questions.length * 10), weakTopics: topicScores.filter(t => t.score < 70).sort((a, b) => a.score - b.score), strongTopics: topicScores.filter(t => t.score >= 70)};
}
