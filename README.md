# Ensemble

A real-time classroom participation app built with Next.js App Router, TypeScript, Tailwind, shadcn-style Radix buttons, Socket.IO, OpenAI, Zod, and pdf-lib. No accounts, authentication provider, database, or persistent classroom storage.

## Run

Requires Node.js 20.9+ and pnpm (or npm).

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000. Choose **For Teachers**, name a class, and share its six-digit code. Students open the same URL on their devices, choose **Join a Class**, and enter their name and code. For local testing use separate browser tabs; on other devices use your computer's LAN address and allow port 3000 through your firewall.

`OPENAI_API_KEY` is optional. Without it, every feature except AI works. Set it in `.env.local`, never a `NEXT_PUBLIC_` variable. The optional model defaults to `gpt-4.1-mini`. Restart after changing environment variables.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

## Classroom flow

1. Teacher creates a session; no username or password is used.
2. Students join with code and name. Duplicate normalized names are rejected. Their browser tab receives a random reconnect capability stored in sessionStorage; it survives refreshes in that tab.
3. Teacher asks a question verbally or elsewhere, then clicks **Start New Question**.
4. Students submit and edit answers until **Close Submissions**. The teacher board displays anonymous answers only.
5. **Randomly Select Answer** uses cryptographic randomness. Award **1 or 0 points** before choosing another response or starting the next question. The selected response stays anonymous until the teacher clicks Reveal name; every new selection hides the name again; the response board below remains anonymous. A response can be selected and scored once per round.
6. Optional AI analysis accepts the original question. Without it the model is instructed to summarize themes without judging correctness. Requests contain answer text and optional question, never roster objects or student identifiers; exact roster names in that text are redacted. Personal details voluntarily typed into answers cannot all be detected. Teacher should review AI conclusions.
7. **Export Class Report** works anytime, including before the first question. PDF includes class/date, names, points, submissions, selections, statistics, every student’s response for each round (including missing-response entries), formatted text, rendered equations, attached pictures, and all generated round analyses.
8. **End session** opens a deletion warning and offers export. Nothing automatically ends a session. Ending deletes all room data and disconnects participants.

## Temporary data and access

All classroom state lives only in the custom Node server's memory. A server restart, crash, redeployment, or teacher ending the session permanently deletes it. Exported PDFs are downloaded to the teacher's device; the server retains no report files. No idle expiration runs. Closing a browser does not end a class. Keep the teacher tab: its sessionStorage reconnect capability is required to regain controls. Losing that capability has no account-based recovery.

This intentionally has no identity verification: anyone with a class code can initially join under an unused name. Teacher can rename or remove roster entries; removal deletes that student's responses and scoring. Never treat participation points as verified identity. Opaque random capabilities protect existing entries and teacher controls from other participants; they are session ownership tokens, not user accounts. Never share or log them. Student payloads exclude the roster and other students' answers. The anonymous response list excludes student identifiers; only the selected response exposes its name to the teacher; reports and roster contain participation aggregates only.

Participation = submitted answers / (current roster size × questions started). Students joining late count against every question in this simple session metric. Empty denominators display 0%. PDF built-in fonts replace unsupported non-Latin characters with `?`; extend font embedding for a multilingual deployment.

## Deployment

Deploy **one long-running Node.js process** with `pnpm build` and `pnpm start`, HTTPS, and WebSocket proxy support. For a Vercel frontend connected to this server, follow DEPLOY.md. Do not run the in-memory backend on multiple replicas: each process has isolated memory. Bind to `0.0.0.0` (default); set `PORT` as needed. Configure your proxy to forward Host and WebSocket Upgrade headers. Socket.IO accepts the server’s own origin and exact origins configured in ALLOWED_ORIGINS. In-memory request throttling limits each connection to 35 events per 10 seconds; sessions cap at 100 students and 200 rounds, with 200 active sessions per process. Add infrastructure-level connection/IP limits for an internet-facing deployment.

The custom server owns Socket.IO and Next.js. Classroom state is never passed to a Next API route or written to disk. Credentials from earlier project directions are not used. No third-party analytics are included.

## Formatted answers

Students can use the toolbar for bold, italics, lists, LaTeX equations, and up to two PNG/JPEG pictures. The live preview, response board, and selected response render formatting safely without raw HTML or remote image URLs. Answers allow 4,000 characters. Pictures are resized and re-encoded as JPEG in the browser and validated again on the server; all picture data remains in session memory (approximately 28 MB total encoded picture limit per session). AI analysis receives answer text, equations, and attached pictures; students should avoid including personal information in uploaded pictures.
