export class ApiError extends Error {
  readonly status: number

  constructor(
    message: string,
    status: number,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    const message = contentType.includes('json')
      ? await response.json().then((problem: { title?: string; detail?: string }) =>
          problem.detail ?? problem.title ?? `Request failed (${response.status}).`,
        )
      : `Request failed (${response.status}).`

    throw new ApiError(message, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export async function postWithCsrf<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  const { requestToken } = await apiRequest<{ requestToken: string }>('/api/auth/csrf')
  return apiRequest<T>(path, {
    method: 'POST',
    headers: { 'X-CSRF-TOKEN': requestToken },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
