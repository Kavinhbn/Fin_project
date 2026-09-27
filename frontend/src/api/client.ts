// ─── Adapter selection: VITE_API_MODE=mock (default) | live ───
import { mockApi } from './mock'
import { ApiError } from './types'
import type { Api } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  })
  if (!res.ok) {
    let fieldErrors: Record<string, string> = {}
    let message = res.statusText
    try {
      const body = (await res.json()) as { detail?: unknown }
      if (Array.isArray(body.detail)) {
        fieldErrors = Object.fromEntries(
          (body.detail as { loc: (string | number)[]; msg: string }[]).map((d) => [
            String(d.loc[d.loc.length - 1]), d.msg,
          ]),
        )
        message = 'Some fields are invalid'
      } else if (typeof body.detail === 'string') {
        message = body.detail
      }
    } catch {
      // non-JSON error body: keep statusText
    }
    throw new ApiError(res.status, message, fieldErrors)
  }
  return (await res.json()) as T
}

const liveApi: Api = {
  isMock: false,
  me: () => request('/me'),
  disclaimer: async () => (await request<{ disclaimer: string }>('/disclaimer')).disclaimer,
  notice: async () => (await request<{ notice: string | null }>('/disclaimer')).notice,
  createAssessment: (input, mode) =>
    request('/assessments', { method: 'POST', body: JSON.stringify({ input, mode }) }),
  listAssessments: (mode) => request(`/assessments?mode=${mode}`),
  getAssessment: (id) => request(`/assessments/${id}`),
  generateNote: (id) => request(`/assessments/${id}/note`, { method: 'POST' }),
  markReviewed: (id, version) =>
    request(`/assessments/${id}/review`, { method: 'POST', body: JSON.stringify({ version }) }),
  modelCard: (mode) => request(`/model/card?mode=${mode}`),
  audit: () => request('/audit'),
}

export const api: Api = import.meta.env.VITE_API_MODE === 'live' ? liveApi : mockApi
