# PalForge — an interview built for a friend

> Draft for review. Add your repository URL, live demo, screenshots, and first-hand details before publishing. Confirm the challenge’s submission format and dates with the organizer.

## Who I built it for

A friend preparing for software engineering placements had something a question bank couldn’t see: his own projects. He needed practice explaining why he chose his technologies, how his authentication worked, and what he would change under real-world constraints.

## What PalForge does

Paste a resume, add a target role and job description, and choose a practice style. Gemma generates questions grounded in that context. Each answer gets technical feedback. Pressure Mode asks up to two deeper follow-ups when the reasoning needs work. At the end, the candidate sees topic scores, practice exercises, and can start a session weighted toward weak areas.

Judges can try a fictional MERN developer interview immediately. That demo uses authored content and disclosed keyword scoring; personal interviews use the configured Gemma model.

## Why open-weight AI

Gemma with Ollama keeps local inference practical and lets the developer change model behavior without relying on a proprietary interview API. The frontend never calls the model directly. An Express engine validates structured responses and controls the follow-up limit. MongoDB persistence is optional, with local files as the default.

## The experience

Warm paper, deep green, coral accents, condensed headings, and hard shadows make preparation feel like a focused developer workshop. There are only five screens: home, setup, interview, results, and progress.

## Links to add

- Public source repository
- Live demo containing fictional data
- Screenshots of the landing page, interview, and results
- Short walkthrough video, if required by the challenge
- Your friend’s feedback and what changed after testing

Built for Hacktoberfest 2026 · Weekend Challenge · Build for a Friend.
