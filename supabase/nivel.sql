-- Nível da conta (XP por partida da carreira e do online).
-- Rodar UMA vez no Supabase (SQL Editor → New query → colar → Run), depois do amigos.sql.

alter table public.profiles add column if not exists xp integer not null default 0 check (xp >= 0);

-- o XP só muda pela função add_xp (ninguém escreve o próprio XP direto)
revoke insert, update on public.profiles from authenticated;
grant insert (user_id, username) on public.profiles to authenticated;
grant update (username) on public.profiles to authenticated;

-- soma XP na própria conta (no máximo 2000 por vez: partidas jogadas sem estar logado sobem juntas) e devolve o total
create or replace function public.add_xp(n integer) returns integer
language sql security definer set search_path = public as $$
  update profiles set xp = xp + greatest(0, least(n, 2000)) where user_id = auth.uid() returning xp;
$$;
revoke all on function public.add_xp(integer) from public, anon;
grant execute on function public.add_xp(integer) to authenticated;
