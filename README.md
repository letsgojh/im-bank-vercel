# 전세대출 서류 위험도 점검

병합 PDF 1개를 올리면 Upstage Studio 워크플로우(Agent)를 호출해 파일 위험도 등급과 문서별 근거를 보여주는 Next.js 페이지.

## 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:3000
```

데모 모드(Upstage 호출 없이 `mock/response.json`으로 queued → in_progress → completed 재현, 약 9초):

```bash
DEMO_MODE=true npm run dev   # 또는 .env.local에서 DEMO_MODE=true
```

빌드: `npm run build && npm start` · 타입 검사: `npm run typecheck`

## 배포 (무료)

환경변수는 레포에 넣지 않고 각 대시보드에 입력한다: `UPSTAGE_API_KEY`, `UPSTAGE_PROJECT_ID`, `UPSTAGE_AGENT_ID`, `UPSTAGE_CONFIG_ID`(7), `DEMO_MODE`(false), `APP_PASSWORD`(선택).

**Vercel (Hobby)** — 잠들지 않음. 업로드는 4MB까지(Vercel 요청 본문 4.5MB 제한).
1. vercel.com → Add New → Project → GitHub 레포 선택 (Framework: Next.js 자동 인식)
2. Environment Variables에 위 값 입력 → Deploy

**Render (Free)** — 업로드 50MB까지. 15분간 접속이 없으면 잠들고 첫 접속에 30초~1분 걸림.
1. render.com → New → Blueprint → GitHub 레포 선택 (`render.yaml` 사용)
2. 비어 있는 값(`UPSTAGE_API_KEY` 등) 입력 → Apply

`APP_PASSWORD`를 넣으면 접속 시 브라우저 로그인 창이 뜬다(아이디는 아무거나, 비밀번호만 확인). 넣지 않으면 URL을 아는 누구나 업로드해서 Upstage 사용량을 쓸 수 있다.

## 구조

```
app/
  page.tsx               업로드 · 진행 상태 · 결과 (클라이언트, 5초 간격 조회, 10분 초과 시 중단)
  api/analyze/route.ts   PDF 검증 → 1단계 파일 업로드 → 2단계 Job 생성 → job_id 반환
  api/status/route.ts    3단계 Job 조회 1회 → status, 완료 시 화면용 결과 + 정제된 원본
components/
  Progress.tsx           업로드 중 → 대기 중 → 분석 중 → 완료
  Results.tsx            결론 카드, 문서별 카드(펼치면 항목 표), 안내문 초안, 원본 JSON
  GradeBadge.tsx         등급 색상
lib/
  upstage.ts             Upstage API 호출 (server-only, 키는 여기서만 읽음)
  upstage-types.ts       Upstage 응답 타입 (mock/response.json 기준)
  parse.ts               응답 → 화면 구조 변환, 원값 제거
  analysis-types.ts      화면용 타입
  demo.ts                데모 모드
  errors.ts              오류 코드별 한국어 안내
mock/response.json       실제 completed 응답 (include[]=all, 개인정보는 가짜 값, 파싱 원문 제거)
```

## 응답 해석 (실제 응답 기준)

config 7 워크플로우의 결과는 단계별로 `output[]`에 담겨 오고 `output_text`는 비어 있다. 그래서 조회는 `?include[]=all`로 한다.

| 화면 | 응답 위치 |
|---|---|
| 파일 등급 | `Instruct - 위험등급산정` 단계 `additional_values.enum` (없으면 본문 "전체 확인 위험등급") |
| 결론 요약, 추가 확인 사항 | 같은 단계 `text`(마크다운)의 ①, ③ 절 |
| 문서별 등급·근거 | 같은 단계 ② 절 표 (문서 / 탐지 항목 / 원본 노출 상태 / 위험등급 / 판독 상태 / 페이지 / 근거) |
| 문서별 항목 표, 페이지 | `Information Extract - *` 단계 `sensitive_findings[]`, `additional_values.page_ranges` |
| 안내문 초안 | 마지막 instruct 단계(`Instruct - 높음_초안`) |

- 등급 문구(낮음/보통/높음/매우 높음 등)는 응답 그대로 표시하고 색상만 매핑한다. 다시 계산하지 않는다.
- `observed_value`, `evidence_excerpt` 및 문서별 원값 필드는 서버에서 제거하고 브라우저로 보내지 않는다. 응답에 `masked_value`가 오면 그 열만 표시한다.
- 등급산정 단계를 찾지 못하거나 해석하지 못하면 "응답 파싱 실패" 안내와 함께 원문을 보여준다.
