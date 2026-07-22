# ITS2026 — 로컬 실행

```bash
npm install
npm run dev      # http://localhost:5173 (Vite 기본)
```

- 빌드: `npm run build` → `dist/`
- 스택: Vite + React + TS + Tailwind(v3) + vite-plugin-pwa + react-router-dom
- 데이터는 목(mock). `src/lib/services.ts`가 데이터 경계 — 나중에 이 파일만 Supabase 호출로 교체.
- 화면: 좌측 네비 5개 중 "실시간 관제"(대시보드)만 구현, 나머지는 플레이스홀더.

## 머신 이동 (외장하드 BridgeNine)

프로젝트 폴더가 외장하드에 있어 여러 머신을 오간다. **원격 URL은 드라이브를 따라다니지만 인증 수단은 머신마다 다르다.**

- **원격 = HTTPS 고정** (`https://github.com/reverve9/its2026.git`)
  아무 설정 없는 새 머신에서도 기본 동작하는 쪽을 저장해 둔다.
- **커밋 신원은 리포 로컬에 고정** (`user.name`/`user.email`) — 머신별 전역 설정과 무관하게 작성자 일관.

### 머신별 최초 1회

**HTTPS 머신 (새 머신 포함)**
```bash
gh auth login        # 브라우저 인증
gh auth setup-git    # git이 gh 토큰을 쓰도록
```

**🔴 SSH 머신 (사무실 맥스튜디오) — 최우선 처리**
맥스튜디오엔 SSH 키가 있으므로 키를 그대로 쓰되, 리포의 HTTPS URL을 그 머신에서만 SSH로 재작성한다:
```bash
git config --global url."git@github.com:".insteadOf "https://github.com/"
```
→ 리포 설정은 안 건드리고 기존 키로 계속 push. **이걸 안 하면 push 시 인증 실패**한다.
(그 머신의 모든 github HTTPS 원격에 적용됨 — SSH 선호 시 의도한 동작)

## Vercel
- GitHub `reverve9/its2026`에 push → Vercel 자동 배포. 빌드 커맨드 `npm run build`, 출력 `dist`.

## 문서
- 설계·빌드 진실 소스: `_DEV/_doc/SPEC.md`
