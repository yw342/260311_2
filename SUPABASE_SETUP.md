# Supabase 연동 가이드

## 1. 프로젝트 생성

1. [supabase.com](https://supabase.com) 로그인 후 **New project** 클릭
2. **Organization** 선택, **Name** 입력(예: `lefty-guitar`)
3. **Database Password** 설정 후 저장해 두기
4. **Region** 선택 후 **Create new project** (생성까지 1~2분 소요)

## 2. 테이블 생성

1. 왼쪽 메뉴 **SQL Editor** 클릭
2. **New query** 선택
3. 아래 경로의 `supabase/schema.sql` 파일 내용을 **전부 복사**해 SQL Editor에 붙여넣기
4. **Run** (또는 Ctrl+Enter) 실행

정상이면 `Success. No rows returned` 메시지가 나옵니다.

## 3. API 키 확인 및 복사

### 3-1. 설정 화면으로 이동

1. Supabase 대시보드 왼쪽 **아래쪽**에 있는 **톱니바퀴 아이콘** 클릭  
   → 메뉴 이름: **Project Settings**
2. 왼쪽 세부 메뉴에서 **API** 를 클릭  
   → **Project API keys** 라는 제목의 페이지로 이동합니다.

---

### 3-2. Project URL (→ `SUPABASE_URL`)

- **위치**: 페이지 **맨 위**의 **Configuration** 섹션 안에 있습니다.
- **표시 이름**: **Project URL** (또는 **API URL**)
- **형태**: `https://abcdefghijk.supabase.co` 처럼  
  `https://` + 영문/숫자 + `.supabase.co` 로 끝나는 주소입니다.
- **확인 방법**:
  - 값을 클릭하면 전체가 선택되거나, 옆 **복사 버튼**으로 복사할 수 있습니다.
  - 반드시 `https://` 로 시작하고, 중간에 프로젝트 ID가 들어가며, `.supabase.co` 로 끝나면 올바른 값입니다.
- **Vercel에 넣을 이름**: `SUPABASE_URL`  
  → 이 값을 그대로 붙여넣으면 됩니다 (공백이나 줄바꿈 없이).

---

### 3-3. service_role 키 (→ `SUPABASE_SERVICE_ROLE_KEY`)

- **위치**: 같은 **Project API keys** 페이지에서 아래로 내려가면  
  **Project API keys** 표가 나옵니다. 그 안에 **anon** 과 **service_role** 두 행이 있습니다.
- **선택할 행**: **service_role** 이라고 적힌 행  
  (anon 이 아니라 **service_role** 만 사용합니다.)
- **키 값**:
  - **Key** 열에 `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.` 로 시작하는 긴 문자열이 있습니다.
  - 옆에 **Reveal** / **복사(Copy)** 버튼이 있습니다. **Reveal** 을 누르면 전체 키가 보이고, **복사** 로 복사할 수 있습니다.
- **주의**:
  - 이 키는 **비밀(Secret)** 이므로 채팅이나 공개 저장소에 붙여넣지 마세요.
  - **anon public** 키는 목록 조회용으로만 쓰이고, **크롤링으로 DB에 저장**하려면 반드시 **service_role** 키를 사용해야 합니다.
- **형태 확인**: `eyJ` 로 시작하고, 점(`.`)이 두 번 들어가며, 한 줄로 된 JWT 형태면 올바릅니다.
- **Vercel에 넣을 이름**: `SUPABASE_SERVICE_ROLE_KEY`  
  → 복사한 **service_role** 키 전체를 그대로 붙여넣으면 됩니다 (앞뒤 공백 없이).

---

### 3-4. 한 번에 확인하는 체크리스트

| 넣을 환경 변수 이름           | Supabase에서 보는 위치                    | 올바른 형태 예시                          |
|-----------------------------|-------------------------------------------|-------------------------------------------|
| `SUPABASE_URL`              | Configuration → **Project URL**           | `https://xxxxxxxx.supabase.co`            |
| `SUPABASE_SERVICE_ROLE_KEY` | Project API keys 표 → **service_role** 행 | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

두 값 모두 **공백 없이**, **한 줄 전체**를 복사해 Vercel 환경 변수 Value 란에 붙여넣으면 됩니다.

## 4. Vercel에 환경 변수 설정

1. [vercel.com](https://vercel.com) → 해당 프로젝트 선택
2. **Settings** → **Environment Variables**
3. 아래 두 개 추가:

| Name | Value | 적용 환경 |
|------|--------|-----------|
| `SUPABASE_URL` | (복사한 Project URL) | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | (복사한 service_role 키) | Production, Preview, Development |

4. 저장 후 **Redeploy** 한 번 실행하면 연동 완료입니다.

## 5. 연동 확인

- 배포된 사이트에서 **목록 새로고침** → DB에 데이터가 있으면 카드가 보입니다.
- **크롤링 실행** 버튼 → 성공 시 "N건 수집 후 DB 반영 완료" 알림이 뜹니다.
- 문제가 있으면 브라우저 개발자 도구(F12) → Network 탭에서 `/api/listings` 또는 `/api/crawl` 응답을 확인하세요.

## 로컬에서 테스트할 때

프로젝트 루트에 `.env` 파일을 만들고 같은 변수를 넣은 뒤:

```bash
npm install
npx vercel dev
```

`.env` 예시:

```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
