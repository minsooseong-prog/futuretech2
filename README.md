# Future Tech — 우리의 다음

한국 미래공학 학급을 위한 Next.js 전체 프로젝트입니다. GitHub에 올리고 Vercel에 연결해 배포할 수 있습니다. 실제 계정/게시물은 Neon PostgreSQL에, 사진은 Supabase의 비공개 Storage에 저장합니다. 별도의 Supabase Auth 또는 Supabase PostgreSQL 테이블을 사용하지 않습니다.

## 1. 구조

```text
브라우저
 └─ Next.js App Router (Vercel Node.js Functions)
     ├─ React 화면 / 서버 컴포넌트
     ├─ 인증·권한·Zod 검증 → Drizzle → Neon PostgreSQL
     └─ 인증된 사진 업로드/조회 → 서버 전용 Supabase SDK → Private Storage
```

- Next.js 16 / React 19 / TypeScript / Tailwind CSS 4 / Lucide
- Drizzle + `pg`, 프로세스당 최대 3개의 연결, Vercel `attachDatabasePool`
- bcrypt cost 12, HTTP-only 세션 쿠키, DB에는 세션 토큰의 HMAC만 저장
- 사진: 브라우저에서 최대 1920px WebP 압축 후 한 장씩 전송 → 서버 Sharp 재검증/재인코딩 → 원본용 WebP와 480px 썸네일
- 로컬 파일 시스템에는 사용자 데이터를 저장하지 않음
- 초기 데이터는 실제 관리자 계정과 작성 비밀번호만 생성. 가짜 학생·사진·게시물 없음

### DB 테이블

| 테이블             | 저장하는 데이터 / 관계                                               |
| ------------------ | -------------------------------------------------------------------- |
| `users`            | 이름·고유 학번·해시 비밀번호·역할·자동 해석된 학년/반/번호           |
| `user_profiles`    | 사용자별 소개·아바타 media ID                                        |
| `user_preferences` | 사용자별 light/dark 선택                                             |
| `entries`          | `board`, `album`, `notice`, `profile` 유형의 제목·내용·작성자·조회수 |
| `media`            | 사진 소유자·용도·게시물·Storage 경로·썸네일 경로·업로드 상태         |
| `comments`         | 게시판 글의 댓글·작성자                                              |
| `calendar_events`  | 한국 시간 기준으로 입력한 일정의 UTC 타임스탬프                      |
| `site_settings`    | 공지/일정 작성 비밀번호 해시, 단일 행                                |
| `alumni`           | 탈퇴한 구성원의 이름·졸업일만 보존                                   |
| `sessions`         | 토큰 HMAC·사용자·7일 만료 시각                                       |
| `rate_limits`      | 서버 인스턴스가 공유하는 DB 기반 요청 제한                           |
| `post_views`       | 사용자·글·한국 날짜별 조회 중복 방지                                 |
| `storage_jobs`     | 사진 삭제를 재시도하는 영속 대기열                                   |

명세의 `board_posts`, `album_posts`, `notices`, `profile_posts`는 `entries.kind`로 통합했습니다. 각 이미지 테이블은 `media.purpose` 및 `entry_id`로 통합했습니다. 화면과 API의 소유권 검사는 유형별로 적용됩니다. 사진 바이너리는 DB에 저장하지 않습니다.

사용자 삭제 시 프로필·선호도·세션·개인 글·댓글·사진 메타데이터는 FK cascade로 삭제됩니다. 학급 공용 일정은 유지하고 작성자 FK를 NULL로 익명화합니다. 사진의 실제 바이트는 삭제 대기열을 통해 정리합니다.

### 디렉터리

```text
future-tech/
├─ app/
│  ├─ layout.tsx, page.tsx, globals.css, error.tsx, not-found.tsx
│  ├─ login/, register/
│  ├─ (community)/
│  │  ├─ layout.tsx, loading.tsx
│  │  ├─ home/, album/, board/, notices/
│  │  ├─ members/, calendar/, profile/, settings/, search/
│  └─ api/
│     ├─ actions/[action]/route.ts
│     ├─ upload/route.ts
│     ├─ media/[id]/route.ts
│     └─ maintenance/route.ts
├─ components/
│  ├─ auth-screen.tsx, navigation.tsx, ui.tsx
│  ├─ forms.tsx, entry-pages.tsx, gallery.tsx, calendar.tsx
├─ lib/
│  ├─ db/schema.ts, db/index.ts
│  ├─ auth.ts, service.ts, storage.ts, queries.ts
│  └─ validation.ts, errors.ts, format.ts
├─ drizzle/                     # 실행 가능한 SQL + Drizzle journal/snapshot
├─ scripts/                     # migration, seed, Storage setup, cleanup
├─ tests/                       # 입력 검증 및 DB/API 통합 테스트
├─ public/fonts/                # 로컬 Caveat 글꼴과 OFL 라이선스
├─ public/favicon.svg
├─ .env.example, .gitignore
├─ next.config.ts, drizzle.config.ts, vercel.json
├─ package.json, package-lock.json
├─ DEPLOYMENT_CHECKLIST.md, VALIDATION.md, SOURCE_INDEX.md
└─ README.md
```

`(community)`는 URL에 포함되지 않는 App Router route group입니다. 미들웨어의 쿠키 존재 여부만으로 보안을 판단하지 않습니다. 보호된 레이아웃, 페이지의 데이터 접근 함수, 모든 변경 API에서 DB 세션과 사용자 권한을 확인합니다.

## 2. 로컬 설치

Node.js 22 이상과 npm을 설치합니다.

```bash
cd future-tech
npm install
cp .env.example .env.local
```

Windows PowerShell에서는 `Copy-Item .env.example .env.local`을 사용합니다. 재현 가능한 CI 설치에는 `npm ci`를 사용합니다.

`.env.local` 값을 채워 주세요.

| 변수                        | 설정                                                                |
| --------------------------- | ------------------------------------------------------------------- |
| `DATABASE_URL`              | Neon의 pooled connection string. TLS가 포함된 제공 URL 사용         |
| `DATABASE_URL_UNPOOLED`     | 마이그레이션용 direct connection string. 생략하면 DATABASE_URL 사용 |
| `SUPABASE_URL`              | Supabase Project URL                                                |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 service_role 키. 브라우저용 anon 키가 아님                |
| `SUPABASE_STORAGE_BUCKET`   | 기본값 `future-tech-private`                                        |
| `SESSION_SECRET`            | 최소 32자 이상의 무작위 비밀 값                                     |
| `APP_URL`                   | 로컬은 `http://localhost:3000`; 배포는 실제 HTTPS origin            |
| `REGISTRATION_CODE`         | 선택. 설정하면 회원가입에 초대 코드 필수                            |
| `INITIAL_ADMIN_PASSWORD`    | 첫 seed의 관리자 비밀번호. 명세 기본값 `NNNNN`                      |
| `INITIAL_NOTICE_PASSWORD`   | 첫 seed의 공지 작성 비밀번호. 명세 기본값 `00000`                   |
| `INITIAL_CALENDAR_PASSWORD` | 첫 seed의 일정 작성 비밀번호. 명세 기본값 `00000`                   |
| `CRON_SECRET`               | 정리 작업 인증용 무작위 비밀 값                                     |

`.env.example`의 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`는 호환성을 위해 표시한 선택 변수입니다. 이 프로젝트는 브라우저에서 Supabase에 직접 접근하지 않으므로 비워 두어도 됩니다. 서버 전용 변수에는 `NEXT_PUBLIC_`를 붙이지 마세요.

비밀 값은 아래 명령을 각각 실행해 별도로 생성합니다.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`REGISTRATION_CODE`가 비어 있으면 누구나 조건에 맞는 학번으로 가입할 수 있습니다. 학급 구성원으로 가입을 제한하려면 배포 전에 별도의 코드를 설정해 구성원에게 전달하세요. 학번 입력 자체로 재학 여부를 검증하는 기능은 없습니다.

## 3. Neon 초기화

1. Neon 프로젝트와 DB를 생성합니다.
2. pooled URL을 `DATABASE_URL`, direct URL을 `DATABASE_URL_UNPOOLED`에 설정합니다.
3. 프로젝트 폴더에서 아래를 실행합니다.

```bash
npm run db:migrate
npm run db:seed
```

SQL 마이그레이션은 이미 포함되어 있습니다. 첫 설치에서 다시 생성할 필요는 없습니다. 이후 `lib/db/schema.ts`를 변경한 경우에만:

```bash
npm run db:generate
npm run db:migrate
```

seed는 트랜잭션과 고유 키/`ON CONFLICT DO NOTHING`을 사용합니다. 다시 실행해도 계정이 중복 생성되지 않고 변경된 비밀번호를 덮어쓰지 않습니다. 관리자는:

```text
이름: N
학번: 00000
초기 비밀번호: INITIAL_ADMIN_PASSWORD 값 (.env.example 기본값: NNNNN)
역할: admin
```

`00000`은 학생 학번으로 해석하지 않으며 일반 회원가입에서 거부됩니다. 관리자 첫 로그인 후 **설정 → 비밀번호 변경**을 해야 글쓰기·관리 기능을 사용할 수 있습니다. 비밀번호 변경 시 모든 세션이 폐기되므로 다시 로그인하세요. 공지/일정 비밀번호도 관리자 설정에서 변경하세요.

DB migration/seed를 `npm run build`에 연결하지 않았습니다. 운영 DB에 대해 동시 실행하거나 preview 배포가 운영 데이터를 변경하는 것을 피하기 위해 명시적으로 실행합니다.

## 4. Supabase Storage 초기화

Supabase 프로젝트를 생성하고 서버 전용 URL과 service_role 키를 설정한 뒤:

```bash
npm run storage:setup
```

하나의 **비공개** 버킷 `future-tech-private`을 사용합니다. 이 스크립트는 버킷이 이미 있으면 비공개 및 업로드 제한 설정을 업데이트합니다. 앱 전용 버킷 이름을 사용하세요.

```text
avatar/{userId}/{uuid}.webp
avatar/{userId}/{uuid}-thumb.webp
album/{userId}/{uuid}.webp
board/{userId}/{uuid}.webp
profile/{userId}/{uuid}.webp
```

버킷은 `public: false`, 허용 MIME `image/webp`, 최대 파일 크기 3,000,000 bytes입니다. 사용자용 `storage.objects` 공개 정책이나 anon INSERT/SELECT 정책을 만들 필요가 없습니다. SDK의 특권 접근은 모두 서버에서만 수행합니다.

이미지 표시 방식은 signed URL 대신 **인증된 다운로드 프록시**입니다. `/api/media/{id}`가 로그인과 메타데이터 상태를 확인하고 Storage에서 바이트를 읽습니다. 아직 게시물에 연결되지 않은 업로드는 소유자만 볼 수 있습니다. 응답은 `Cache-Control: private, no-store`입니다. 사용자가 경로 문자열을 입력해 임의의 Storage 파일을 요청할 수 없습니다.

### 사진 업로드와 정리

- 원본 JPG/PNG/WebP 최대 25MB, 압축 결과 최대 3MB.
- 브라우저가 1920px / WebP 80%로 압축하며 여러 사진도 한 장씩 전송합니다.
- 서버가 실제 파일 포맷과 픽셀 수를 확인하고 재인코딩합니다. EXIF는 보존하지 않습니다.
- 아바타 최대 512px, 나머지 최대 1920px. 리스트는 480px 썸네일을 사용합니다.
- 앨범은 1~10장, 게시판/개인 기록은 0~10장입니다. 공지는 텍스트 전용입니다.
- 사진은 pending → ready → attached 상태로 전환됩니다. 게시물에 첨부할 때 소유자와 용도를 다시 검증합니다.
- 업로드 중단/게시물 저장 실패로 남은 미연결 사진은 24시간 후 정리 대상이 됩니다.
- 게시물/계정 삭제 시 DB 트랜잭션에서 파일 경로를 삭제 대기열에 복사하고 메타데이터 접근을 제거합니다. 파일 삭제 실패가 개인정보를 다시 노출시키지 않습니다.
- 대기열은 최소 10분 뒤부터 처리합니다. 진행 중이던 업로드 요청과 계정 삭제 간 경합을 흡수하는 유예 시간입니다.
- `vercel.json`의 작업은 매일 19:00 UTC(다음 날 04:00 KST)에 최대 1,000개 경로를 처리합니다. 실패한 항목은 다음 실행에서 재시도합니다. 삭제량이 많으면 정리 명령을 추가 실행하세요.

```bash
npm run storage:cleanup
```

Neon의 `storage_jobs`에 대기 항목이 계속 남는다면 Supabase 키, 버킷 상태, 네트워크를 확인하세요. DB와 Storage 사이에는 분산 트랜잭션이 없으므로 물리적 삭제는 대기열 기반 최종 일관성을 사용합니다. Supabase/Neon 서비스 자체의 백업 보존 정책은 별도입니다.

## 5. 실행 / 검증

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)을 엽니다.

```bash
npm run typecheck
npm test
npm run build
npm start
```

`npm start`는 이미 빌드된 앱을 production 모드로 실행합니다. 운영 HTTPS 환경에서 secure 쿠키를 사용합니다. 로컬 개발에는 `npm run dev`를 사용하세요.

자동 테스트는 실제 PostgreSQL 엔진인 PGlite에 포함된 SQL migration을 적용하여 인증·소유권·트랜잭션·탈퇴 흐름을 검증합니다. 사진 테스트는 실제 Sharp 인코딩을 실행하고 Supabase 전송만 메모리 어댑터로 대체합니다. 상세 범위와 미검증 항목은 `VALIDATION.md`에 있습니다.

## 6. GitHub → Vercel 배포

### GitHub

GitHub에서 빈 저장소를 생성한 뒤 프로젝트 폴더에서:

```bash
git init
git add .
git commit -m "Build Future Tech class community"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/future-tech.git
git push -u origin main
```

`YOUR_ACCOUNT`는 본인 계정으로 바꿉니다. `.gitignore`가 `.env.local`, 다른 `.env` 파일, `node_modules`, `.next`를 제외합니다. `.env.example`만 커밋합니다. `package-lock.json`과 `drizzle/`은 반드시 포함하세요.

### Vercel

1. **Add New → Project → Import Git Repository**에서 저장소를 선택합니다.
2. Framework는 Next.js, Root Directory는 `package.json`이 있는 폴더로 설정합니다. ZIP을 풀 때 `future-tech/` 한 단계가 추가되었다면 해당 폴더를 선택합니다.
3. Node.js는 22 이상을 선택합니다. Install은 `npm ci`, Build는 `npm run build`를 사용합니다.
4. 위 환경변수 표의 서버 변수를 Production에 설정합니다. `APP_URL`은 실제 `https://프로젝트.vercel.app` 주소 또는 사용할 커스텀 도메인의 origin이어야 합니다.
5. **Preview 환경은 별도의 Neon DB/branch와 Supabase 버킷을 권장합니다.** Preview URL로 테스트할 때도 APP_URL을 그 origin에 정확하게 맞춥니다. CSRF 검증을 제거하지 마세요.
6. 신뢰할 수 있는 로컬 셸에서 **배포 대상 DB URL**을 사용해 `db:migrate`, `db:seed`, `storage:setup`을 한 번 실행합니다.
7. Deploy합니다. 환경변수를 나중에 추가/변경했다면 Redeploy합니다.
8. 관리자 로그인 → 초기 계정 비밀번호 변경 → 재로그인 → 공지/일정 작성 비밀번호 변경.
9. `CRON_SECRET`이 설정되어 있고 Vercel Cron이 활성화되었는지 확인합니다. Vercel Cron은 해당 secret을 Authorization Bearer 헤더로 보냅니다. Cron을 사용하지 못하는 환경에서는 정리 CLI를 정기 실행하세요.
10. 일반 학생 계정 두 개로 `DEPLOYMENT_CHECKLIST.md`의 실제 서비스 연결 검증을 수행합니다.

환경변수는 서버에서 읽습니다. DB URL이나 service_role 키를 소스코드·스크린샷·클라이언트 컴포넌트에 입력하지 마세요.

## 7. 제공 기능과 권한

| 기능                                         | 학생/교사                                     | 관리자                         |
| -------------------------------------------- | --------------------------------------------- | ------------------------------ |
| 대시보드·앨범·게시판·공지·캘린더·구성원 열람 | 로그인 후 가능                                | 가능                           |
| 게시판/앨범/개인 기록 생성                   | 가능                                          | 가능                           |
| 글 수정                                      | 작성자만                                      | 본인 글만                      |
| 글/댓글 삭제                                 | 작성자만                                      | 모든 글/댓글                   |
| 프로필 사진·소개 수정                        | 본인만                                        | 본인만                         |
| 공지 작성·수정                               | 공지 비밀번호 필요, 수정은 작성자만           | 비밀번호 생략, 수정은 작성자만 |
| 일정 생성                                    | 일정 비밀번호 필요                            | 비밀번호 생략                  |
| 일정 수정                                    | 작성자 + 일정 비밀번호                        | 모든 일정, 비밀번호 생략       |
| 일정 삭제                                    | 작성자                                        | 모든 일정                      |
| 교사 역할 지정 / 작성 비밀번호 변경          | 불가                                          | 가능                           |
| 졸업·계정 삭제                               | 현재 비밀번호 두 번 + 정확한 문구 + 최종 확인 | 관리자 계정 삭제 차단          |

명세의 “누구나 공지를 읽을 수 있음”은 **로그인한 모든 구성원**으로 해석했습니다. 첫 방문은 로그인 화면이며 학생 정보가 있는 커뮤니티 전체는 인증 후 접근합니다.

졸업 확인 문구는 정확히 `학교를 졸업하겠습니다`입니다. 버튼은 두 입력 비밀번호가 서로 일치하고 문구가 맞으면 활성화됩니다. 실제 계정 비밀번호와의 일치 여부는 서버에서 최종 검증합니다.

학급 규모에 맞춘 제목/본문/이름 검색, 게시판 말머리 필터, 게시물 페이지당 20개, 개인 기록 페이지당 20개를 제공합니다. 좋아요·대댓글·이메일 알림·이메일 비밀번호 재설정은 요청의 선택 범위이거나 별도 서비스가 필요하므로 포함하지 않았습니다. 알림 아이콘은 실제 공지사항으로 연결됩니다.

## 8. 운영 보안

- 7일 고정 만료 세션. 운영 쿠키는 `__Host-ft-session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`입니다.
- 변경 요청은 `Origin`과 `APP_URL`을 대조합니다. HTTP GET으로 글 작성/삭제/조회수 변경을 수행하지 않습니다.
- 로그인 학번당 15분 10회, 인증 요청 IP당 15분 50회, 공지/일정 암호 확인은 사용자당 15분 5회 제한입니다.
- 비밀번호 변경 및 졸업 비밀번호 검증도 사용자당 15분 5회 제한입니다. 사진은 사용자당 시간당 40개, 일반 변경 요청은 분당 180회 제한입니다.
- Vercel에서는 플랫폼이 제공하는 `x-vercel-forwarded-for`를 IP 기준으로 사용합니다. 다른 호스팅에서 사용한다면 신뢰할 수 있는 프록시 헤더 정책에 맞춰 `clientIp()`를 변경하세요. 로컬에서는 공통 `local` 키를 사용합니다.
- 일반 비밀번호는 10자 이상 및 bcrypt의 UTF-8 72바이트 한도 이내입니다. 명세의 짧은 초기 관리자/작성 암호는 seed에서만 허용합니다.
- 사용자 입력은 React 텍스트로 출력합니다. `dangerouslySetInnerHTML`을 사용하지 않습니다.
- 주요 변경은 사용자 행을 잠근 트랜잭션에서 처리해 탈퇴/변경 경합을 줄입니다.
- CSP, frame 차단, MIME sniffing 차단, 최소 referrer 정책을 설정했습니다. CSP의 inline script 허용은 Next 기본 부트스트랩에 필요하며 엄격한 nonce 기반 CSP를 구현한 것은 아닙니다.
- 의존성 변경 시 `npm audit --omit=dev` 및 테스트/빌드를 다시 수행하세요.

## 9. 공식 참고 문서

- [Next.js App Router](https://nextjs.org/docs/app)
- [Drizzle / Neon 연결](https://orm.drizzle.team/docs/connect-neon)
- [Supabase 비공개 버킷](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Vercel Functions 제한](https://vercel.com/docs/functions/limitations)

Caveat 글꼴은 OFL 라이선스로 `public/fonts/Caveat-LICENSE.txt`에 포함되어 있습니다. 글꼴은 로컬에서 제공하므로 외부 Google Fonts 연결이 필요 없습니다.
