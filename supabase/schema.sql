-- Supabase 대시보드 SQL Editor에서 실행하세요.

-- 중고 왼손 기타 매물 테이블
create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text,
  price text,
  source_site text not null,
  source_url text not null unique,
  posted_at timestamptz,
  created_at timestamptz default now()
);

-- source_url로 빠른 조회/중복 방지
create index if not exists idx_listings_source_url on listings(source_url);
create index if not exists idx_listings_posted_at on listings(posted_at desc);
create index if not exists idx_listings_source_site on listings(source_site);

-- RLS: 익명 읽기 허용 (공개 리스트업)
alter table listings enable row level security;

create policy "Allow public read"
  on listings for select
  using (true);

-- 크롤러 API만 쓰려면 service_role 키 사용 권장. 쓰기 정책은 필요 시 추가.
create policy "Allow insert for service"
  on listings for insert
  with check (true);

create policy "Allow update for service"
  on listings for update
  using (true);

create policy "Allow delete for service"
  on listings for delete
  using (true);
