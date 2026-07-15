/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // ── 폰트 역할 (웨이트는 컴포넌트에서 결정) ─────────────────
      fontFamily: {
        // 국문 타이틀 — Paperlogy(개성 있는 모던 지오메트릭)
        title: ['Paperlogy', 'Pretendard Variable', 'Pretendard', 'sans-serif'],
        // 본문·서브·UI 기본 — Pretendard
        sans: ['Pretendard Variable', 'Pretendard', 'system-ui', 'sans-serif'],
        // 영문 타이틀·디스플레이 — Raleway (Thin·자간 벌려 사용)
        latin: ['Raleway', 'Pretendard Variable', 'sans-serif'],
      },
      // ── 컬러 v4 (딥 틸그린 · 라이트 단일, 다크 없음) ───────────
      colors: {
        // Primary — 배경 워터컬러 텍스처(_DEV/design)에서 추출한 색조에 정렬.
        // 이미지 실측: h=177.5° · s≈25% · l=40~53%. 램프는 이 색조를 고정하고 명도만 전개한다.
        // 텍스처 위 흰 텍스트는 원본 그대로면 3.5:1(AA 미달) → 사이드바·헤더는 900 오버레이로 어둡게.
        primary: {
          50: '#f4f6f6', 100: '#e1eae9', 200: '#c2d6d5', 300: '#9bc0bf', 400: '#6ca7a5',
          500: '#508b89', 600: '#3c6d6b', 700: '#2a504f', 800: '#1d3a38', 900: '#142928',
        },
        // Neutral — 쿨 슬레이트 (배경·텍스트위계·구분선)
        neutral: {
          50: '#f5f7f8', 100: '#e9edf0', 200: '#d7dde1', 300: '#b7c0c6', 400: '#8c979e',
          500: '#667077', 600: '#4d565c', 700: '#3a4247', 800: '#262c30', 900: '#151a1d',
        },
        // Status — 진한 텍스트용 5색 (DEFAULT=solid, soft=배경). 항상 아이콘+텍스트 동반
        ok: { DEFAULT: '#15803d', soft: '#dcfce7' }, // 정상
        warn: { DEFAULT: '#a16207', soft: '#fef9c3' }, // 주의
        serious: { DEFAULT: '#c2410c', soft: '#ffedd5' }, // 심각
        critical: { DEFAULT: '#b91c1c', soft: '#fee2e2' }, // 경보
        info: { DEFAULT: '#1d4ed8', soft: '#dbeafe' }, // 정보
        // Categorical — 거점/차트 구분 (실사용 4 + 예비 2). 지도 all-pairs 색맹 통과
        cat: { 1: '#3a6ea5', 2: '#c8663c', 3: '#a65f86', 4: '#c39a2e', 5: '#6a5aa3', 6: '#b34a4a' },
        // Surface / Ink (라이트)
        page: '#f6f7f7', // 페이지 배경
        surface: '#ffffff', // 카드
        ink: { strong: '#151a1d', base: '#3a4247', muted: '#667077', faint: '#8c979e' },
        line: { DEFAULT: '#d7dde1', soft: '#e9edf0' }, // 구분선 / 약한구분
      },
      // ── 타입스케일 (SPEC §7-2) — 크기+행간만, 굵기는 컴포넌트에서 ──
      fontSize: {
        caption: ['12px', { lineHeight: '16px' }],
        label: ['13px', { lineHeight: '18px' }],
        body: ['14px', { lineHeight: '22px' }],
        section: ['16px', { lineHeight: '24px' }],
        title: ['20px', { lineHeight: '28px' }],
        kpi: ['30px', { lineHeight: '34px' }],
      },
      // radius: Tailwind 기본이 이미 lg=8·xl=12·full=pill 이라 그대로 사용
      // ── shadow (잉크 틴트) ───────────────────────────────────
      boxShadow: {
        sm: '0 1px 2px 0 rgb(21 26 29 / 0.06), 0 1px 3px 0 rgb(21 26 29 / 0.08)',
        md: '0 4px 8px -2px rgb(21 26 29 / 0.10), 0 2px 4px -2px rgb(21 26 29 / 0.06)',
        lg: '0 12px 24px -6px rgb(21 26 29 / 0.12), 0 4px 8px -4px rgb(21 26 29 / 0.08)',
      },
    },
  },
  plugins: [],
}
