// 라이브 구독 훅 — 화면이 services 를 통해 데이터를 읽고,
// 시각 변경·store 뮤테이션이 일어나면 자동으로 다시 읽어온다.
// (services 가 async(R2)이므로 훅도 Promise 를 다룬다.)

import { useEffect, useState, useSyncExternalStore } from 'react'
import { subscribe, getVersion, getNowMin } from './clock'

// 라이브 버전 — 시각·store 어느 쪽이 바뀌어도 증가.
export function useLiveVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion)
}

// 현재 시각(분) — 스크러버·헤더 시계용. 변경 시 리렌더.
export function useNowMin(): number {
  return useSyncExternalStore(subscribe, getNowMin, getNowMin)
}

// async fetcher 를 라이브 버전에 묶어 재조회. 최초/변경 시 재실행.
// fetcher 는 매 렌더 새로 만들어지므로 deps 로만 재실행을 통제한다(라이브 버전 포함).
export function useLive<T>(fetcher: () => Promise<T>, deps: unknown[] = []): T | null {
  const v = useLiveVersion()
  const [data, setData] = useState<T | null>(null)

  useEffect(() => {
    let alive = true
    fetcher().then((d) => {
      if (alive) setData(d)
    })
    return () => {
      alive = false
    }
    // fetcher 는 의도적으로 deps 에서 제외(매 렌더 재조회 방지). v + 외부 deps 로만 재실행.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, ...deps])

  return data
}
