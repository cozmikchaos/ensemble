-- Only the Vercel backend may read or write classroom records.
create table if not exists public.ensemble_sessions (
  code text primary key check (code ~ '^[0-9]{6}$'),
  version bigint not null default 1,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.ensemble_sessions enable row level security;
revoke all on public.ensemble_sessions from anon, authenticated;
grant select, insert, update, delete on public.ensemble_sessions to service_role;

-- Atomic, shared rate limits for serverless instances. No client access.
create table if not exists public.ensemble_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);
alter table public.ensemble_rate_limits enable row level security;
revoke all on public.ensemble_rate_limits from anon, authenticated;
create or replace function public.ensemble_rate_limit(p_key text, p_limit integer, p_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into ensemble_rate_limits as limits (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when limits.window_start < now() - make_interval(secs => p_seconds) then 1 else limits.hits + 1 end,
    window_start = case when limits.window_start < now() - make_interval(secs => p_seconds) then now() else limits.window_start end
  returning hits into n;
  delete from ensemble_rate_limits where window_start < now() - interval '1 day';
  return n <= p_limit;
end;
$$;
revoke all on function public.ensemble_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.ensemble_rate_limit(text, integer, integer) to service_role;
