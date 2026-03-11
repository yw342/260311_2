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

-- RLS: 익명(anon)은 읽기만, 쓰기는 service_role만 (크롤 API에서 service_role 사용)
alter table listings enable row level security;

create policy "Allow public read"
  on listings for select
  using (true);

-- insert/update/delete 정책 없음 → anon 키로는 쓰기 불가, service_role 키는 RLS 우회로 쓰기 가능
