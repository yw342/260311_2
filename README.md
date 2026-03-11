# 중고 왼손 기타 매물 리스트업

뮬(mule) 등에서 중고 왼손 기타 매물을 크롤링해 한곳에서 보는 웹 서비스입니다.

## 포함 내용

- **기타 이름** · **사진** · **가격** · **출처 사이트** · **원본 게시물 등록 날짜**

## 사용 스택

- HTML (프론트)
- Vercel (호스팅 + Serverless API)
- Supabase (DB)

## 수동 작업 (필수)

1. **Supabase**
   - [Supabase](https://supabase.com)에서 새 프로젝트 생성
   - SQL Editor에서 `supabase/schema.sql` 내용 복사 후 실행
   - Project Settings > API에서 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 복사

2. **Vercel**
   - [Vercel](https://vercel.com)에서 이 저장소 연결 후 배포
   - 프로젝트 설정 > Environment Variables에 추가:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY` (크롤 API용, 쓰기 필요)
   - (선택) 리스트만 공개 읽기면 `SUPABASE_ANON_KEY`만 넣고, 크롤 시에만 service role 사용 가능

3. **크롤링**
   - 배포된 사이트에서 "크롤링 실행" 버튼으로 수집
   - 또는 `GET`/`POST` `https://your-app.vercel.app/api/crawl` 호출

## 로컬 실행

```bash
npm install
npx vercel dev
```

`.env`에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 설정 후 사용.

## 저장소

- GitHub: https://github.com/yw342/260311_2
