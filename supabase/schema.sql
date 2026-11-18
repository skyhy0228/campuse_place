-- 교통대 꿀팁 모음: Supabase 스키마
-- 사용법: Supabase 대시보드 → SQL Editor → New query → 이 파일 전체를 붙여 넣고 Run.
--         여러 번 다시 실행해도 안전하다. (테이블은 있으면 그대로 두고, 함수·정책은 새로 만든다)
--
-- 권한은 화면이 아니라 여기(RLS)가 지킨다.
-- - 누구나: 승인된 제보와 정보 수정, 숨기지 않은 후기와 별점 통계, '아직 맞아요' 통계, 학식·버스 시간표 읽기
-- - 회원(이메일 로그인): 내 즐겨찾기·목록 읽기/쓰기, 후기 남기기·고치기·지우기·신고, 제보(사진 3장까지), '아직 맞아요'
-- - 운영자(admins 표에 등록된 회원): 제보 승인·수정·거절, 후기 숨기기·지우기, 회원 글쓰기 정지, 학식·버스 입력, 통계
-- 쓰기는 대부분 security definer 함수로만 받아 금칙어·속도 제한·정지 여부를 서버에서 확인한다.
-- 함수는 search_path 를 비워 두고 모든 이름을 스키마와 함께 쓴다.
--
-- 이 스키마는 팀원 프로젝트 '교통여지도'의 schema.sql(학번 토큰 방식)을 Supabase Auth(auth.uid()) 기반으로 다시 설계한 것이다.

-- ============================================================
-- 1. 운영자
-- ============================================================
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ============================================================
-- 2. 금칙어
-- ============================================================
create table if not exists public.banned_words (word text primary key);
alter table public.banned_words enable row level security;
revoke all on public.banned_words from anon, authenticated;

-- 한 글자 낱말은 넣지 않는다. ('2026년', '씹히는 식감' 같은 정상 문장을 막지 않게)
insert into public.banned_words (word) values
  ('시발'), ('씨발'), ('씨바'), ('씨팔'), ('시팔'), ('ㅅㅂ'), ('ㅆㅂ'), ('ㅅㅂㄹㅁ'),
  ('병신'), ('븅신'), ('ㅂㅅ'), ('등신'), ('좆'), ('존나'), ('졸라'), ('ㅈㄴ'), ('지랄'), ('ㅈㄹ'),
  ('개새끼'), ('개새기'), ('개색기'), ('개색히'), ('개쌔끼'), ('미친놈'), ('미친년'), ('또라이'),
  ('엠창'), ('느금마'), ('니애미'), ('니미럴'), ('애미뒤'), ('썅년'), ('썅놈'), ('꺼져라'), ('닥쳐라'),
  ('fuck'), ('fuk'), ('shit'), ('bitch'), ('asshole'), ('motherfucker'), ('pussy'), ('dickhead'),
  ('傻逼'), ('操你'), ('他妈的'), ('草泥马'), ('王八蛋')
on conflict do nothing;

-- 띄어쓰기·기호·숫자를 넣어 피하는 것을 막으려고 한글·영문·한자만 남겨 비교한다.
create or replace function public.has_profanity(t text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s text;
begin
  if t is null then
    return false;
  end if;
  s := regexp_replace(lower(t), '[^가-힣ㄱ-ㅎㅏ-ㅣa-z一-鿿]', '', 'g');
  -- '시발점', '시발역' 같은 정상 낱말
  s := regexp_replace(s, '시발(견|표|달|생|전|점|역|매|송)', '', 'g');
  return exists (select 1 from public.banned_words w where position(w.word in s) > 0);
end;
$$;
revoke all on function public.has_profanity(text) from public, anon, authenticated;

-- ============================================================
-- 3. 회원 프로필 (auth.users 와 1:1)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 2 and 12),
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_nickname_key on public.profiles (lower(nickname));
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select (id, nickname, suspended, created_at) on public.profiles to authenticated;
grant update (suspended) on public.profiles to authenticated;

drop policy if exists "본인 또는 운영자 보기" on public.profiles;
create policy "본인 또는 운영자 보기" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "운영자 글쓰기 정지" on public.profiles;
create policy "운영자 글쓰기 정지" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 닉네임 검사: 문제가 없으면 null, 있으면 안내 문구. (가입 전에 화면에서 미리 부른다)
create or replace function public.nickname_check(p_nickname text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  nick text := btrim(coalesce(p_nickname, ''));
begin
  if char_length(nick) not between 2 and 12 then
    return '닉네임은 2~12자로 정해 주세요.';
  end if;
  if public.has_profanity(nick) then
    return '닉네임에 쓸 수 없는 말이 들어 있어요.';
  end if;
  if exists (select 1 from public.profiles where lower(nickname) = lower(nick) and id is distinct from auth.uid()) then
    return '이미 쓰고 있는 닉네임이에요.';
  end if;
  return null;
end;
$$;
revoke all on function public.nickname_check(text) from public;
grant execute on function public.nickname_check(text) to anon, authenticated;

-- 가입하면 프로필을 만든다. 닉네임에 문제가 있으면 임시 닉네임을 주고, 회원이 나중에 바꾼다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nick text := btrim(coalesce(new.raw_user_meta_data ->> 'nickname', ''));
begin
  if public.nickname_check(nick) is not null then
    nick := '학생' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  insert into public.profiles (id, nickname) values (new.id, nick) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 글을 쓰는 회원. 로그인과 정지 여부를 확인하고, 스키마보다 먼저 가입한 회원이면 프로필을 만든다. (내부용)
create or replace function public.writer()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.profiles;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요.' using errcode = 'P0001';
  end if;
  select * into p from public.profiles where id = auth.uid();
  if not found then
    insert into public.profiles (id, nickname)
    values (auth.uid(), '학생' || substr(replace(auth.uid()::text, '-', ''), 1, 6))
    returning * into p;
  end if;
  if p.suspended then
    raise exception '운영자가 글쓰기를 정지한 계정이에요.' using errcode = 'P0001';
  end if;
  return p;
end;
$$;
revoke all on function public.writer() from public, anon, authenticated;

create or replace function public.my_profile()
returns table (nickname text, suspended boolean, is_admin boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  perform public.writer_or_suspended();
  return query select p.nickname, p.suspended, public.is_admin() from public.profiles p where p.id = auth.uid();
end;
$$;

-- my_profile 이 정지된 회원도 읽을 수 있게, 정지 여부를 묻지 않고 프로필만 보장한다.
create or replace function public.writer_or_suspended()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname)
  values (auth.uid(), '학생' || substr(replace(auth.uid()::text, '-', ''), 1, 6))
  on conflict (id) do nothing;
end;
$$;
revoke all on function public.writer_or_suspended() from public, anon, authenticated;
revoke all on function public.my_profile() from public;
grant execute on function public.my_profile() to authenticated;

create or replace function public.profile_set_nickname(p_nickname text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  msg text;
  me public.profiles := public.writer();
begin
  msg := public.nickname_check(p_nickname);
  if msg is not null then
    raise exception '%', msg using errcode = 'P0001';
  end if;
  update public.profiles set nickname = btrim(p_nickname) where id = me.id;
  update public.reviews set nickname = btrim(p_nickname) where user_id = me.id;
  update public.submissions set nickname = btrim(p_nickname) where user_id = me.id;
end;
$$;

-- 회원 탈퇴: 로그인 계정을 지우면 프로필·즐겨찾기·후기가 함께 지워지고, 제보는 이름 없이 남는다.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요.' using errcode = 'P0001';
  end if;
  update public.submissions set nickname = null where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

-- ============================================================
-- 4. 즐겨찾기·내 목록 (회원마다 한 행, 화면의 UserData 형식 그대로)
-- ============================================================
create table if not exists public.user_data (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null default '{"favorites": [], "collections": []}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_data_size check (pg_column_size(data) < 65536),
  constraint user_data_shape check (jsonb_typeof(data -> 'favorites') = 'array' and jsonb_typeof(data -> 'collections') = 'array')
);
alter table public.user_data enable row level security;
revoke all on public.user_data from anon, authenticated;
grant select, insert, update, delete on public.user_data to authenticated;
drop policy if exists "내 목록만" on public.user_data;
create policy "내 목록만" on public.user_data
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- 5. 후기 (별점 1~5 + 한줄 후기)
-- ============================================================
-- 장소 id: 원본 데이터 'p' + 8자리, 승인된 학생 제보 'q' + 8자리
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  nickname text not null,
  place_id text not null check (place_id ~ '^[pq][0-9a-f]{8}$'),
  rating int not null check (rating between 1 and 5),
  body text check (body is null or char_length(body) <= 300),
  hidden boolean not null default false,
  report_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, place_id)
);
create index if not exists reviews_place_idx on public.reviews (place_id, created_at desc);
alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
grant select (id, nickname, place_id, rating, body, hidden, created_at) on public.reviews to anon;
grant select on public.reviews to authenticated;
grant update (hidden), delete on public.reviews to authenticated;

drop policy if exists "후기 읽기" on public.reviews;
create policy "후기 읽기" on public.reviews
  for select to anon, authenticated using (not hidden or user_id = auth.uid() or public.is_admin());
drop policy if exists "운영자 후기 숨기기" on public.reviews;
create policy "운영자 후기 숨기기" on public.reviews
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "운영자 후기 지우기" on public.reviews;
create policy "운영자 후기 지우기" on public.reviews
  for delete to authenticated using (public.is_admin());

create table if not exists public.review_reports (
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);
alter table public.review_reports enable row level security;
revoke all on public.review_reports from anon, authenticated;

-- 장소별 별점 통계 (숨긴 후기는 빼고)
create or replace view public.review_stats
with (security_invoker = true)
as
  select place_id, count(*)::int as n, sum(rating)::int as total
  from public.reviews
  where not hidden
  group by place_id;
grant select on public.review_stats to anon, authenticated;

create or replace function public.review_save(p_place text, p_rating int, p_body text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.profiles := public.writer();
  clean text := nullif(btrim(coalesce(p_body, '')), '');
begin
  if public.has_profanity(clean) then
    raise exception '후기에 쓸 수 없는 말이 들어 있어요.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.reviews where user_id = me.id and updated_at > now() - interval '10 minutes') >= 20 then
    raise exception '후기를 너무 자주 남기고 있어요. 잠시 뒤에 다시 해 주세요.' using errcode = 'P0001';
  end if;
  insert into public.reviews (user_id, nickname, place_id, rating, body)
  values (me.id, me.nickname, p_place, p_rating, clean)
  on conflict (user_id, place_id) do update
    set rating = excluded.rating, body = excluded.body, nickname = excluded.nickname, updated_at = now();
end;
$$;

create or replace function public.review_delete(p_place text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요.' using errcode = 'P0001';
  end if;
  delete from public.reviews where user_id = auth.uid() and place_id = p_place;
end;
$$;

-- 서로 다른 회원 3명이 신고하면 자동으로 숨긴다. 내 후기는 신고할 수 없다.
create or replace function public.review_report(p_review uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.profiles := public.writer();
begin
  if exists (select 1 from public.reviews where id = p_review and user_id = me.id) then
    return;
  end if;
  insert into public.review_reports (review_id, user_id) values (p_review, me.id) on conflict do nothing;
  if found then
    update public.reviews
      set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3
      where id = p_review;
  end if;
end;
$$;

-- ============================================================
-- 6. 제보 (새 장소 'new' / 정보 수정 'fix') — 운영자가 승인한 'new' 만 사이트에 보인다
-- ============================================================
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  nickname text,
  kind text not null check (kind in ('new', 'fix')),
  place_id text check (place_id is null or place_id ~ '^[pq][0-9a-f]{8}$'),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  category text not null check (category in ('식당', '카페', '학교시설', '숨은장소', '생활꿀팁', '관광지', '자유')),
  location text check (location is null or char_length(location) <= 120),
  body text not null check (char_length(btrim(body)) between 10 and 500),
  map_url text check (map_url is null or map_url ~ '^https://(naver\.me|map\.naver\.com)/'),
  lat double precision check (lat is null or lat between 36.85 and 37.15),
  lng double precision check (lng is null or lng between 127.75 and 128.05),
  photos text[] not null default '{}' check (cardinality(photos) <= 3),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 300),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists submissions_status_idx on public.submissions (status, created_at desc);
-- '정보가 달라요' 제보의 바뀐 값. 운영자가 승인하면 place_overrides() 로 사이트에 바로 반영된다. (나중에 추가된 열)
alter table public.submissions add column if not exists changes jsonb;
alter table public.submissions drop constraint if exists submissions_changes_check;
alter table public.submissions add constraint submissions_changes_check
  check (changes is null or (jsonb_typeof(changes) = 'object' and pg_column_size(changes) < 4096));
alter table public.submissions enable row level security;
revoke all on public.submissions from anon, authenticated;
grant select (id, nickname, kind, place_id, name, category, location, body, map_url, lat, lng, photos, status, created_at, reviewed_at)
  on public.submissions to anon;
grant select, update, delete on public.submissions to authenticated;

drop policy if exists "제보 읽기" on public.submissions;
create policy "제보 읽기" on public.submissions
  for select to anon, authenticated
  using ((status = 'approved' and kind = 'new') or user_id = auth.uid() or public.is_admin());
drop policy if exists "운영자 제보 처리" on public.submissions;
create policy "운영자 제보 처리" on public.submissions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "운영자 제보 지우기" on public.submissions;
create policy "운영자 제보 지우기" on public.submissions
  for delete to authenticated using (public.is_admin());

-- 상태가 바뀌면 처리한 시각을 남긴다.
create or replace function public.submissions_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at := case when new.status = 'pending' then null else now() end;
  end if;
  return new;
end;
$$;
drop trigger if exists submissions_touch on public.submissions;
create trigger submissions_touch before update on public.submissions
  for each row execute function public.submissions_touch();

-- 바뀐 값은 정해진 칸만 받는다: 글자 칸(운영시간·휴무일·가격·대표메뉴·위치)은 200자 이하, closed 는 true 일 때만.
create or replace function public.clean_changes(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  v text;
  result jsonb := '{}'::jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return null;
  end if;
  foreach k in array array['hours', 'closedDays', 'price', 'menu', 'location'] loop
    if jsonb_typeof(p -> k) = 'string' then
      v := btrim(p ->> k);
      if v <> '' then
        result := result || jsonb_build_object(k, left(v, 200));
      end if;
    end if;
  end loop;
  if (p -> 'closed') = 'true'::jsonb then
    result := result || '{"closed": true}'::jsonb;
  end if;
  return nullif(result, '{}'::jsonb);
end;
$$;
revoke all on function public.clean_changes(jsonb) from public, anon, authenticated;

-- 회원이 보내든 운영자가 고치든, 저장하기 전에 바뀐 값을 거른다. 새 장소 제보에는 쓰지 않는다.
-- 운영자가 화면에서 직접 고칠 때도 clean_changes 를 부를 수 있게 security definer 로 둔다. (clean_changes 는 직접 부를 수 없다)
create or replace function public.submissions_clean()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.changes := case when new.kind = 'fix' then public.clean_changes(new.changes) else null end;
  return new;
end;
$$;
revoke all on function public.submissions_clean() from public, anon, authenticated;
drop trigger if exists submissions_clean on public.submissions;
create trigger submissions_clean before insert or update on public.submissions
  for each row execute function public.submissions_clean();

create or replace function public.submission_create(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.profiles := public.writer();
  photo text;
  photos text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'photos', '[]'::jsonb))), '{}');
  new_id uuid;
begin
  foreach photo in array photos loop
    if photo !~ ('^u/' || me.id::text || '/[0-9a-f-]{36}\.(webp|jpg)$') then
      raise exception '사진 경로가 올바르지 않아요.' using errcode = 'P0001';
    end if;
  end loop;
  if public.has_profanity(coalesce(p ->> 'name', '') || ' ' || coalesce(p ->> 'body', '') || ' ' || coalesce(p ->> 'location', '') || ' ' || coalesce(p ->> 'changes', '')) then
    raise exception '제보에 쓸 수 없는 말이 들어 있어요.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.submissions where user_id = me.id and created_at > now() - interval '10 minutes') >= 5 then
    raise exception '제보를 너무 자주 보내고 있어요. 잠시 뒤에 다시 해 주세요.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.submissions where status = 'pending' and created_at > now() - interval '10 minutes') >= 50 then
    raise exception '지금은 제보가 많이 밀려 있어요. 잠시 뒤에 다시 해 주세요.' using errcode = 'P0001';
  end if;
  insert into public.submissions (user_id, nickname, kind, place_id, name, category, location, body, map_url, lat, lng, photos, changes)
  values (
    me.id,
    me.nickname,
    p ->> 'kind',
    nullif(p ->> 'place_id', ''),
    btrim(p ->> 'name'),
    p ->> 'category',
    nullif(btrim(coalesce(p ->> 'location', '')), ''),
    btrim(p ->> 'body'),
    nullif(p ->> 'map_url', ''),
    (p ->> 'lat')::double precision,
    (p ->> 'lng')::double precision,
    photos,
    -- 거르는 일은 submissions_clean 트리거가 한다.
    p -> 'changes'
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- 운영자가 승인한 정보 수정 (누구나 읽기). 제보한 사람과 내용 글은 빼고 장소·바뀐 값·승인 시각만 돌려준다.
create or replace function public.place_overrides()
returns table (place_id text, changes jsonb, reviewed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.place_id, s.changes, s.reviewed_at
  from public.submissions s
  where s.kind = 'fix' and s.status = 'approved' and s.changes is not null and s.place_id is not null
  order by s.reviewed_at asc nulls first
  limit 2000;
$$;

-- ============================================================
-- 7. 제보 사진 보관함 (공개 읽기, 회원은 자기 폴더에만 올리기, 운영자만 지우기)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-photos', 'place-photos', true, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "제보 사진 올리기" on storage.objects;
create policy "제보 사진 올리기" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'place-photos' and name ~ ('^u/' || auth.uid()::text || '/[0-9a-f-]{36}\.(webp|jpg)$'));
drop policy if exists "제보 사진 운영자 지우기" on storage.objects;
create policy "제보 사진 운영자 지우기" on storage.objects
  for delete to authenticated using (bucket_id = 'place-photos' and public.is_admin());

-- ============================================================
-- 8. '아직 맞아요' 확인 (회원마다 장소당 한 행, 다시 누르면 시각만 바뀐다)
-- ============================================================
create table if not exists public.place_confirms (
  user_id uuid not null references public.profiles (id) on delete cascade,
  place_id text not null check (place_id ~ '^[pq][0-9a-f]{8}$'),
  confirmed_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
create index if not exists place_confirms_place_idx on public.place_confirms (place_id, confirmed_at desc);
alter table public.place_confirms enable row level security;
revoke all on public.place_confirms from anon, authenticated;

create or replace function public.place_confirm(p_place text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.profiles := public.writer();
begin
  if p_place is null or p_place !~ '^[pq][0-9a-f]{8}$' then
    raise exception '장소가 올바르지 않아요.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.place_confirms where user_id = me.id and confirmed_at > now() - interval '10 minutes') >= 30 then
    raise exception '너무 자주 누르고 있어요. 잠시 뒤에 다시 해 주세요.' using errcode = 'P0001';
  end if;
  insert into public.place_confirms (user_id, place_id) values (me.id, p_place)
  on conflict (user_id, place_id) do update set confirmed_at = now();
end;
$$;

-- 최근 1년 동안 확인한 사람 수와 마지막 확인 시각 (누구나 읽기, 누가 눌렀는지는 돌려주지 않는다)
create or replace function public.confirm_stats()
returns table (place_id text, n int, last_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.place_id, count(*)::int, max(c.confirmed_at)
  from public.place_confirms c
  where c.confirmed_at > now() - interval '365 days'
  group by c.place_id;
$$;

-- ============================================================
-- 9. 조회수 (관리자 통계용). 장소·날짜별 숫자만 남기고 누가 봤는지는 남기지 않는다.
--    로그인 없이 부를 수 있어 숫자를 부풀릴 수 있다. 참고용 통계로만 쓴다.
-- ============================================================
create table if not exists public.place_view_counts (
  place_id text not null check (place_id ~ '^[pq][0-9a-f]{8}$'),
  day date not null,
  n int not null default 0,
  primary key (place_id, day)
);
alter table public.place_view_counts enable row level security;
revoke all on public.place_view_counts from anon, authenticated;

create or replace function public.place_view(p_place text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_place is null or p_place !~ '^[pq][0-9a-f]{8}$' then
    return;
  end if;
  insert into public.place_view_counts (place_id, day, n)
  values (p_place, (now() at time zone 'Asia/Seoul')::date, 1)
  on conflict (place_id, day) do update set n = public.place_view_counts.n + 1;
end;
$$;

-- ============================================================
-- 10. 학식 메뉴 · 버스 시간표 (운영자가 관리자 화면에서 입력, 누구나 읽기)
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

create table if not exists public.cafeteria_menus (
  id uuid primary key default gen_random_uuid(),
  served_on date not null,
  cafeteria text not null check (char_length(btrim(cafeteria)) between 1 and 30),
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner')),
  items text not null check (char_length(btrim(items)) between 1 and 500),
  price text check (price is null or char_length(price) <= 40),
  note text check (note is null or char_length(note) <= 200),
  updated_at timestamptz not null default now(),
  unique (served_on, cafeteria, meal)
);
create index if not exists cafeteria_menus_day_idx on public.cafeteria_menus (served_on);
alter table public.cafeteria_menus enable row level security;
revoke all on public.cafeteria_menus from anon, authenticated;
grant select on public.cafeteria_menus to anon, authenticated;
grant insert, update, delete on public.cafeteria_menus to authenticated;
drop policy if exists "학식 읽기" on public.cafeteria_menus;
create policy "학식 읽기" on public.cafeteria_menus for select to anon, authenticated using (true);
drop policy if exists "운영자 학식 쓰기" on public.cafeteria_menus;
create policy "운영자 학식 쓰기" on public.cafeteria_menus
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop trigger if exists cafeteria_menus_touch on public.cafeteria_menus;
create trigger cafeteria_menus_touch before update on public.cafeteria_menus
  for each row execute function public.touch_updated_at();

-- times: 'HH:MM' 목록 (정렬은 화면에서 한다)
create table if not exists public.bus_times (
  id uuid primary key default gen_random_uuid(),
  line text not null check (char_length(btrim(line)) between 1 and 40),
  stop text not null check (char_length(btrim(stop)) between 1 and 40),
  direction text check (direction is null or char_length(direction) <= 40),
  day_type text not null default 'weekday' check (day_type in ('weekday', 'weekend', 'everyday')),
  times text[] not null check (
    cardinality(times) between 1 and 200
    and array_to_string(times, ',') ~ '^([01][0-9]|2[0-3]):[0-5][0-9](,([01][0-9]|2[0-3]):[0-5][0-9])*$'
  ),
  note text check (note is null or char_length(note) <= 200),
  source text check (source is null or char_length(source) <= 200),
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.bus_times enable row level security;
revoke all on public.bus_times from anon, authenticated;
grant select on public.bus_times to anon, authenticated;
grant insert, update, delete on public.bus_times to authenticated;
drop policy if exists "버스 읽기" on public.bus_times;
create policy "버스 읽기" on public.bus_times for select to anon, authenticated using (true);
drop policy if exists "운영자 버스 쓰기" on public.bus_times;
create policy "운영자 버스 쓰기" on public.bus_times
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop trigger if exists bus_times_touch on public.bus_times;
create trigger bus_times_touch before update on public.bus_times
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 11. 관리자 통계 (운영자만)
-- ============================================================
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '운영자만 볼 수 있어요.' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'members', (select count(*) from public.profiles),
    'members7', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'reviews', (select count(*) from public.reviews),
    'reviewsHidden', (select count(*) from public.reviews where hidden),
    'submissions', (
      select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
      from (select status, count(*) as n from public.submissions group by status) s
    ),
    'confirms30', (select count(*) from public.place_confirms where confirmed_at > now() - interval '30 days'),
    'views30', (select coalesce(sum(n), 0) from public.place_view_counts where day > current_date - 30),
    'topViews', (
      select coalesce(jsonb_agg(jsonb_build_object('id', v.place_id, 'n', v.total) order by v.total desc), '[]'::jsonb)
      from (
        select place_id, sum(n)::int as total from public.place_view_counts
        where day > current_date - 30 group by place_id order by total desc limit 10
      ) v
    ),
    'topFavorites', (
      select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'n', f.n) order by f.n desc), '[]'::jsonb)
      from (
        select fav.id, count(*)::int as n
        from public.user_data u
        cross join lateral jsonb_array_elements_text(u.data -> 'favorites') as fav(id)
        group by fav.id order by n desc limit 10
      ) f
    )
  );
end;
$$;

-- ============================================================
-- 12. 함수 실행 권한 (기본값인 public 실행 권한을 거두고 필요한 역할에만 준다)
-- ============================================================
revoke all on function public.profile_set_nickname(text) from public;
revoke all on function public.delete_account() from public;
revoke all on function public.review_save(text, int, text) from public;
revoke all on function public.review_delete(text) from public;
revoke all on function public.review_report(uuid) from public;
revoke all on function public.submission_create(jsonb) from public;
revoke all on function public.submissions_touch() from public, anon, authenticated;
grant execute on function public.profile_set_nickname(text) to authenticated;
grant execute on function public.delete_account() to authenticated;
grant execute on function public.review_save(text, int, text) to authenticated;
grant execute on function public.review_delete(text) to authenticated;
grant execute on function public.review_report(uuid) to authenticated;
grant execute on function public.submission_create(jsonb) to authenticated;

revoke all on function public.place_overrides() from public;
revoke all on function public.place_confirm(text) from public;
revoke all on function public.confirm_stats() from public;
revoke all on function public.place_view(text) from public;
revoke all on function public.admin_stats() from public;
grant execute on function public.place_overrides() to anon, authenticated;
grant execute on function public.place_confirm(text) to authenticated;
grant execute on function public.confirm_stats() to anon, authenticated;
grant execute on function public.place_view(text) to anon, authenticated;
grant execute on function public.admin_stats() to authenticated;

-- ============================================================
-- 운영자 등록 (이 파일에 이메일을 쓰지 말고, SQL Editor 에서 따로 한 번 실행한다)
--   insert into public.admins (user_id)
--   select id from auth.users where email = '내이메일@example.com'
--   on conflict do nothing;
-- ============================================================
