# ITS2026 — 로컬 실행

```bash
npm install
npm run dev      # http://localhost:5173 (Vite 기본)
```

- 빌드: `npm run build` → `dist/`
- 스택: Vite + React + TS + Tailwind(v3) + vite-plugin-pwa + react-router-dom
- 데이터는 목(mock). `src/lib/services.ts`가 데이터 경계 — 나중에 이 파일만 Supabase 호출로 교체.
- 화면: 좌측 네비 5개 중 "실시간 관제"(대시보드)만 구현, 나머지는 플레이스홀더.

## Vercel
- GitHub `reverve9/its2026`에 push → Vercel 자동 배포. 빌드 커맨드 `npm run build`, 출력 `dist`.

## 문서
- 설계·빌드 진실 소스: `_DEV/_doc/SPEC.md`
