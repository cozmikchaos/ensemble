# Deploy ensemble++ on Vercel + Supabase

No separate Node host or paid Render plan is required. Supabase Free and Vercel Hobby are subject to their usage limits; OpenAI API usage is billed separately.

1. In your Supabase project SQL editor, run `supabase/schema.sql`. The tables have RLS enabled and deny anonymous/client access. Only the server secret can access them.
2. Import this GitHub repository in Vercel using the Next.js preset.
3. Add `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` as production environment variables. Add `OPENAI_API_KEY` to enable AI analysis. Never prefix secrets with `NEXT_PUBLIC_`.
4. Deploy. The browser fetches only the public URL/key from `/api/classroom`; commands run through protected server-side handlers. Supabase Realtime broadcasts contain invalidation signals only.
5. Test teacher and student in separate tabs, then export the report before ending the class.

Classroom data now persists in Supabase until the teacher ends the session. Server restarts and frontend redeployments do not delete it. The no-account flow uses random teacher/student capabilities stored in each browser tab. Keep the teacher tab to preserve access. There is no automatic expiry.

Storage is limited to 3 MB of serialized state per classroom to keep Vercel responses within its payload limit. Pictures count against this limit. PDF downloads are limited to 4.3 MB. Online presence can take up to 75 seconds to update after a tab closes. A 5-second refresh fallback recovers missed Realtime messages.

## Local verification

Copy `.env.example` to `.env.local`, supply project credentials, then run `pnpm install`, `pnpm dev`. Use `pnpm test` for unit tests and `TEST_URL=http://localhost:3000 pnpm test:integration` for a real backend test with synthetic records that are removed afterward.
