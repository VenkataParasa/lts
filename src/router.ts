import { useEffect, useState } from 'react'

export interface Route { path: string; seg: string[]; q: URLSearchParams }

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [path, qs] = raw.split('?')
  return { path, seg: path.split('/').filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(qs ?? '') }
}

export function useRoute(): Route {
  const [r, setR] = useState(parse)
  useEffect(() => {
    const on = () => { setR(parse()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}

export const href = (p: string) => '#' + p
export const go = (p: string) => { window.location.hash = p }
