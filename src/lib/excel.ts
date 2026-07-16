// 엑셀 내보내기 — SheetJS 래퍼. 화면은 여기만 호출한다.
//
// 동적 import 인 이유: 라이브러리가 ~480KB 다. 정적으로 물면 콘솔을 열기만 해도 전원이 받는다.
// 버튼을 누른 사람만 받게 한다 → 초기 번들 +0(빌드에서 xlsx 청크가 갈리는 걸로 확인).
//
// ⚠️ npm 레지스트리의 xlsx 는 0.18.5(2022)에서 멈춰 있고 prototype pollution·ReDoS 가 그대로 남아
// 있다(수정본은 SheetJS 자체 CDN 에만 있다). package.json 의 tarball URL 이 그 패치본(0.20.3)이다
// — `npm i xlsx` 로 되돌리지 말 것. audit 이 즉시 high 로 바뀐다.
//
// ⚠️ 라이브러리가 둘인 건 실수가 아니다. 쓰기는 SheetJS, 읽기는 read-excel-file 이다.
// 위 취약점이 전부 '파싱' 경로에 있어서, SheetJS 로 남의 파일을 열지 않는 동안만 공격면이 0 이다.
// 임포트는 사용자가 올린 파일을 여는 일이라 정확히 그 경로다 → SheetJS 로 읽지 말 것.

// 화면 컬럼 = 파일 컬럼. 파일에만 있는 칸은 화면이 숨긴 게 되고, 화면에만 있는 칸은 파일이
// 명부가 아니게 된다. label 은 화면 헤더를 그대로 쓴다.
//
// value 가 문자열을 돌려주는 건 의도다 — 화면이 배지·링크로 렌더한 걸 파일은 글자로 적는다.
// 숫자 칸이 생기면 그때 number 를 허용하고 셀 서식(#,##0)을 붙일 것. 지금 3개 리스트엔 0 개다.
//
// i = 필터 결과 안에서의 순번(페이지 아님). 화면 No. 가 페이지를 넘어도 이어지듯 파일도 1행부터 잇는다.
export interface ExcelColumn<T> {
  label: string
  value: (row: T, i: number) => string
}

// 한글은 라틴 문자의 두 배 폭을 먹는다. 글자수로 재면 한글 컬럼이 전부 좁게 나온다.
const cellWidth = (s: string): number => {
  let w = 0
  for (const ch of s) w += /[ᄀ-ᇿ㄰-㆏가-힯一-鿿　-〿＀-￯]/.test(ch) ? 2 : 1
  return w
}

// 화면에 걸린 필터 결과를 그대로 .xlsx 로 내린다.
// rows 는 호출측이 필터·정렬을 끝낸 배열 — 페이지는 자르지 않는다(파일은 전 페이지다).
export async function exportExcel<T>(rows: T[], columns: ExcelColumn<T>[], fileName: string): Promise<void> {
  const XLSX = await import('xlsx')

  const header = columns.map((c) => c.label)
  const body = rows.map((row, i) => columns.map((c) => c.value(row, i)))
  const ws = XLSX.utils.aoa_to_sheet([header, ...body])

  // 컬럼 폭 — 헤더와 값 중 가장 넓은 것에 맞춘다. 40 을 넘기면 한 칸이 화면을 다 먹는다.
  ws['!cols'] = columns.map((c, i) => ({
    wch: Math.min(Math.max(cellWidth(c.label), ...body.map((r) => cellWidth(r[i]))) + 2, 40),
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, `${fileName}.xlsx`)
}

// ── 임포트 ──────────────────────────────────────────────

// 예시파일 — 헤더만 있는 빈 장부. 받아서 셀을 채워 다시 올리는 게 최초 작성 경로다.
//
// 예시 행을 안 넣는 건 의도다. 넣으면 지우지 않고 올리는 사람이 반드시 나오고, 그날 명부에
// 존재하지 않는 사람이 한 명 생긴다. 값의 규칙은 검증 오류가 알려준다 — 파일이 가르치지 않는다.
export async function exportTemplate(headers: string[], fileName: string): Promise<void> {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([headers])
  ws['!cols'] = headers.map((h) => ({ wch: Math.min(cellWidth(h) + 4, 40) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, `${fileName}.xlsx`)
}

// 올라온 .xlsx 를 헤더 기준 행 객체로. 헤더가 안 맞으면 행을 읽기 전에 던진다 —
// 컬럼이 밀린 파일을 그대로 삼키면 연락처가 이름 칸에 들어간 명부가 조용히 만들어진다.
export async function readExcel(file: File, headers: string[]): Promise<Record<string, string>[]> {
  // ⚠️ 루트 export 가 없는 패키지다 — 진입점을 브라우저용으로 명시해야 한다(node 용은 fs 를 문다).
  // ⚠️ readSheet 다. v9 의 기본 export(readXlsxFile)는 행이 아니라 '시트 배열'을 돌려준다.
  //
  // ⚠️ trim:false 가 없으면 빈 칸 하나에 파일 전체가 TypeError 로 죽는다 — 라이브러리 버그다:
  //     parseString(value){ if(options.trim!==false) value = value.trim() }  ← value 가 undefined
  // 빈 칸은 SheetJS 가 쓴 빈 공유문자열에서 나온다(우리 양식파일이 SheetJS 산이다).
  // 끄는 대가는 없다 — 아래에서 우리가 직접 trim 한다.
  const { readSheet } = await import('read-excel-file/browser')
  const grid = await readSheet(file, { trim: false })
  if (!grid.length) throw new Error('빈 파일입니다.')

  const got = grid[0].map((c) => String(c ?? '').trim())
  const missing = headers.filter((h) => !got.includes(h))
  if (missing.length) throw new Error(`헤더가 예시파일과 다릅니다 — 없는 칸: ${missing.join(' · ')}`)

  // '-' = 값 없음. 엑셀 장부의 관행이라 빈 칸 대신 '-' 로 채워 온다 — 둘을 같게 읽지 않으면
  // 같은 '없음'이 어떤 칸은 빈 문자열, 어떤 칸은 '-' 라는 글자 하나로 들어온다.
  const blank = (v: unknown): string => {
    const s = String(v ?? '').trim()
    return s === '-' || s === '—' ? '' : s
  }

  const at = headers.map((h) => got.indexOf(h))
  return grid
    .slice(1)
    .map((row) => Object.fromEntries(headers.map((h, i) => [h, blank(row[at[i]])])))
    .filter((r) => Object.values(r).some((v) => v)) // 엑셀이 흘리는 빈 꼬리 행
}
