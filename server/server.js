import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import * as store from './services/store.js';
import * as gemma from './services/gemmaService.js';
import { demoProfile, demoQuestions } from './services/demoService.js';
import { answerQuestion, aggregate } from './services/interviewEngine.js';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

const profileSchema = z.object({
  candidateName: z.string().trim().min(1).max(100),
  targetRole: z.string().trim().min(2).max(150),
  resume: z.string().trim().min(20).max(30000),
  jobDescription: z.string().trim().max(20000).default(''),
  difficulty: z.enum(['warm-up', 'standard', 'pressure']),
  questionCount: z.union([
    z.literal(5),
    z.literal(7),
    z.literal(10)
  ])
});

const answerSchema = z
  .object({
    questionId: z.string(),
    answer: z.string().trim().max(15000).default(''),
    followUp: z.boolean().default(false),
    skip: z.boolean().default(false)
  })
  .refine(
    value => value.skip || value.answer.length > 0,
    'Write an answer before submitting.'
  );

const wrap = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const locks = new Set();

async function locked(id, fn) {
  if (locks.has(id)) {
    throw Object.assign(
      new Error('This session is processing an answer. Please wait.'),
      { status: 409 }
    );
  }

  locks.add(id);

  try {
    return await fn();
  } finally {
    locks.delete(id);
  }
}

async function load(id) {
  const session = await store.get(id);

  if (!session) {
    throw Object.assign(
      new Error('This session was not found. Start a new interview.'),
      { status: 404 }
    );
  }

  return session;
}

function publicSession(session, persistence = {}) {
  return {
    ...session,
    questions: session.questions.map(
      ({ keywords, demoFollowUps, ...question }) => question
    ),
    ...persistence
  };
}

async function create(profile, demo, weak = [], sourceSessionId) {
  const questions = demo
    ? demoQuestions(profile.questionCount, weak)
    : await gemma.generateInterview(profile, weak);

  const session = {
    _id: randomUUID(),
    ...profile,
    resumeText: profile.resume,
    questions,
    demo,
    createdAt: new Date().toISOString(),
    sourceSessionId
  };

  delete session.resume;

  const persistence = await store.save(session);

  return {
    interviewId: session._id,
    ...publicSession(session, persistence)
  };
}

/* =========================================================
   HEALTH
========================================================= */

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    app: 'PalForge',
    model: process.env.GEMMA_MODEL || 'gemma3:1b',
    storage: process.env.MONGODB_URI
      ? 'mongodb-with-local-fallback'
      : 'local'
  });
});

/* =========================================================
   INTERVIEW ROUTES
========================================================= */

app.post(
  '/api/interviews/demo',
  wrap(async (req, res) => {
    const interview = await create(demoProfile, true);

    res.status(201).json(interview);
  })
);

app.post(
  '/api/interviews',
  wrap(async (req, res) => {
    const profile = profileSchema.parse(req.body);
    const interview = await create(profile, false);

    res.status(201).json(interview);
  })
);

app.get(
  '/api/interviews/:id',
  wrap(async (req, res) => {
    const session = await load(req.params.id);

    res.json(publicSession(session));
  })
);

app.post(
  '/api/interviews/:id/answers',
  wrap(async (req, res) =>
    locked(req.params.id, async () => {
      const input = answerSchema.parse(req.body);
      const session = await load(req.params.id);

      const result = await answerQuestion(session, input);

      const persistence = await store.save(session);

      res.json({
        ...result,
        ...(result.evaluation || {}),
        session: publicSession(session, persistence)
      });
    })
  )
);

app.get(
  '/api/interviews/:id/results',
  wrap(async (req, res) =>
    locked(req.params.id, async () => {
      const session = await load(req.params.id);

      if (!session.questions.every(question => question.completed)) {
        throw Object.assign(
          new Error('Finish your interview to see your results.'),
          { status: 409 }
        );
      }

      if (!session.results) {
        const stats = aggregate(session);

        const weakest = [...stats.topicScores]
          .sort((a, b) => a.score - b.score)
          .slice(0, 3);

        const analysis = session.demo
          ? {
              headline:
                stats.overallScore >= 70
                  ? 'A solid start. Now go deeper on the trade-offs.'
                  : 'You found your starting point. Build depth, one topic at a time.',

              recommendations: weakest.map(topic => ({
                topic: topic.topic,
                exercise: `Revisit ${topic.topic}, then explain one project decision, its trade-offs, and how you would test it in production.`
              }))
            }
          : await gemma.generateFinalAnalysis(
              session,
              stats.topicScores
            );

        session.results = {
          ...stats,
          ...analysis
        };

        Object.assign(session, {
          weakTopics: stats.weakTopics,
          strongTopics: stats.strongTopics,
          overallScore: stats.overallScore
        });

        await store.save(session);
      }

      res.json({
        ...session.results,
        session: publicSession(session)
      });
    })
  )
);

app.post(
  '/api/interviews/:id/next-session',
  wrap(async (req, res) => {
    const old = await load(req.params.id);

    if (!old.results) {
      throw Object.assign(
        new Error('Complete the results first.'),
        { status: 409 }
      );
    }

    const nextInterview = await create(
      {
        candidateName: old.candidateName,
        targetRole: old.targetRole,
        resume: old.resumeText,
        jobDescription: old.jobDescription,
        difficulty: old.difficulty,
        questionCount: old.questionCount
      },
      old.demo,
      old.weakTopics.map(topic => topic.topic),
      old._id
    );

    res.status(201).json(nextInterview);
  })
);

/* =========================================================
   API 404
========================================================= */

app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found.'
  });
});

/* =========================================================
   FRONTEND
========================================================= */

const distPath = path.resolve('dist');

app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((err, req, res, next) => {
  console.error(err);

  const status =
    err instanceof z.ZodError
      ? 400
      : err.status || 500;

  let message;

  if (err instanceof z.ZodError) {
    message = err.issues
      .map(
        issue =>
          `${issue.path.join('.')}: ${issue.message}`
      )
      .join('; ');
  } else if (status < 500) {
    message = err.message;
  } else if (status === 502 || status === 503) {
    message = err.message;
  } else {
    message =
      'Something went wrong saving this session. Please try again.';
  }

  res.status(status).json({
    error: message
  });
});

/* =========================================================
   START SERVER
========================================================= */

await store.connectStore();

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`PalForge running on ${HOST}:${PORT}`);
});