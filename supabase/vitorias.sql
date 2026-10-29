-- Vitórias e derrotas no online (aparecem no seu perfil dos Amigos como V–D).
-- Rodar UMA vez no Supabase (SQL Editor → New query → colar → Run), depois do nivel.sql.

alter table public.profiles add column if not exists wins integer not null default 0 check (wins >= 0);
alter table public.profiles add column if not exists losses integer not null default 0 check (losses >= 0);

-- só muda pela função add_result (ninguém escreve o próprio placar direto); w/l = quantas somar (partidas jogadas
-- sem conexão sobem juntas, no máximo 50 por vez) e devolve o total
create or replace function public.add_result(w integer, l integer) returns table (wins integer, losses integer)
language sql security definer set search_path = public as $$
  update profiles set wins = profiles.wins + greatest(0, least(w, 50)), losses = profiles.losses + greatest(0, least(l, 50))
  where user_id = auth.uid() returning profiles.wins, profiles.losses;
$$;
revoke all on function public.add_result(integer, integer) from public, anon;
grant execute on function public.add_result(integer, integer) to authenticated;
