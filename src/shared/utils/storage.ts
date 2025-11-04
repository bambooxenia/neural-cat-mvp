// 统一封装 localStorage 的 JSON 读写与兜底

export const safeParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const setJSON = (k: string, v: unknown) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(k, JSON.stringify(v))
}

export const getJSON = <T>(k: string, fallback: T) => {
  if (typeof localStorage === 'undefined') return fallback
  return safeParse<T>(localStorage.getItem(k), fallback)
}

export const setLS = (k: string, v: string) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(k, v)
}

export const getLS = (k: string, fallback = '') => {
  if (typeof localStorage === 'undefined') return fallback
  return localStorage.getItem(k) ?? fallback
}
