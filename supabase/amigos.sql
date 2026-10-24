-- Amigos, chat, convites e nome de usuário.
-- Rodar UMA vez no Supabase: painel do projeto → SQL Editor → New query → colar tudo → Run.
-- (pode rodar de novo sem problema: só cria o que ainda não existe)

-- ---------- nome de usuário (único entre todas as contas) ----------
create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9_.]{3,16}$'),
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_username_key on public.profiles (username);
alter table public.profiles enable row level security;
drop policy if exists "perfis: ler" on public.profiles;
create policy "perfis: ler" on public.profiles for select to authenticated using (true);
drop policy if exists "perfis: criar o seu" on public.profiles;
create policy "perfis: criar o seu" on public.profiles for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "perfis: mudar o seu" on public.profiles;
create policy "perfis: mudar o seu" on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- amizades (pedido pendente → aceito) ----------
create table if not exists public.friendships (
  requester uuid not null default auth.uid() references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
-- um par só (em qualquer direção)
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
alter table public.friendships enable row level security;
drop policy if exists "amizades: ver as suas" on public.friendships;
create policy "amizades: ver as suas" on public.friendships for select to authenticated using (auth.uid() in (requester, addressee));
drop policy if exists "amizades: pedir" on public.friendships;
create policy "amizades: pedir" on public.friendships for insert to authenticated with check (requester = auth.uid() and status = 'pending');
drop policy if exists "amizades: aceitar" on public.friendships;
create policy "amizades: aceitar" on public.friendships for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');
drop policy if exists "amizades: desfazer" on public.friendships;
create policy "amizades: desfazer" on public.friendships for delete to authenticated using (auth.uid() in (requester, addressee));

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships where status = 'accepted'
    and ((requester = a and addressee = b) or (requester = b and addressee = a)));
$$;

-- ---------- mensagens (só do dia: o histórico não passa de um dia para o outro) ----------
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipient uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'msg' check (kind in ('msg', 'invite')),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists messages_recipient on public.messages (recipient, created_at);
create index if not exists messages_sender on public.messages (sender, created_at);
alter table public.messages enable row level security;
-- só as conversas de hoje (horário de Brasília) aparecem, mesmo antes da limpeza
drop policy if exists "mensagens: ver as de hoje" on public.messages;
create policy "mensagens: ver as de hoje" on public.messages for select to authenticated using (
  auth.uid() in (sender, recipient)
  and (created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date);
drop policy if exists "mensagens: enviar para amigo" on public.messages;
create policy "mensagens: enviar para amigo" on public.messages for insert to authenticated with check (
  sender = auth.uid() and public.are_friends(sender, recipient));

-- apaga as mensagens de dias anteriores (o jogo chama ao entrar; ninguém lê mensagens antigas de qualquer jeito)
create or replace function public.purge_old_messages() returns void
language sql security definer set search_path = public as $$
  delete from messages where (created_at at time zone 'America/Sao_Paulo')::date < (now() at time zone 'America/Sao_Paulo')::date;
$$;
revoke all on function public.purge_old_messages() from public, anon;
grant execute on function public.purge_old_messages() to authenticated;

-- ---------- tempo real: mensagens novas e pedidos de amizade chegam na hora ----------
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.friendships;
exception when duplicate_object then null; end $$;
