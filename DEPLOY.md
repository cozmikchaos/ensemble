# Deploy Ensemble with a Vercel frontend

Vercel serves the website. A single running Node service keeps the temporary classroom state and Socket.IO connections, generates PDFs, and calls OpenAI. No database is required. Vercel Functions now support WebSockets, but function instance memory is not shared or durable across connections; it cannot provide this app's classroom state guarantees by itself.

## 1. Upload the source to a private GitHub repository

Use the supplied source ZIP or this project folder. Do not upload `.env.local`, `node_modules`, `.next`, or `tmp`. The ZIP excludes them and does not contain your API key.

## 2. Deploy the live server on Render

In Render, choose **New → Blueprint** and select that repository. `render.yaml` supplies the configuration.

- The blueprint uses **Starter**, a paid continuously running service. Review Render's price before confirming. It has one instance and automatic deployments disabled to avoid resetting a class on every push. A free sleeping service can discard the in-memory session during inactivity.
- Enter your `OPENAI_API_KEY` as the backend's secret environment variable.
- For `ALLOWED_ORIGINS`, initially enter `https://placeholder.invalid`. After deploying Vercel, replace this with your exact Vercel production URL, e.g. `https://your-ensemble.vercel.app`, with no trailing slash.
- Copy the backend URL shown by Render, e.g. `https://ensemble-live-example.onrender.com`.
- Open its `/healthz` URL; it should return `{"status":"ok"}`.

The backend also serves the full website, so its URL can be used directly if you need to start a class before connecting Vercel.

## 3. Deploy the frontend on Vercel

Choose **Add New → Project**, import the same repository, and keep the detected **Next.js** preset.

Add this environment variable before deploying:

```text
NEXT_PUBLIC_SOCKET_URL=https://YOUR-LIVE-SERVER.onrender.com
```

Use the actual backend URL. Do not add your OpenAI key to the frontend; the backend is the only service that needs it.

Deploy, then set Render's `ALLOWED_ORIGINS` to the exact Vercel production origin and restart that backend **before creating any classroom sessions**. You can allow multiple exact origins separated by commas. Arbitrary Vercel preview deployments are intentionally not allowed. If the backend URL changes, update `NEXT_PUBLIC_SOCKET_URL` and redeploy the frontend; Next.js embeds public variables at build time.

## 4. Check before class

Open the Vercel URL in two browser tabs. Create a teacher session in one and join as a student in the other. Start a question, submit a response, close submissions, select it, award points, and export the PDF. Share the Vercel URL and six-digit code with students.

Keep exactly one backend instance. Restarting, redeploying, crashing, or ending a session deletes all its temporary data. Export before those actions. Frontend-only deployments do not deliberately reset the backend, but refreshing an old page may be needed after a UI update.

## Local development

Leave `NEXT_PUBLIC_SOCKET_URL` and `ALLOWED_ORIGINS` blank and run `pnpm dev`. The frontend and Socket.IO server share the same URL, as before.
