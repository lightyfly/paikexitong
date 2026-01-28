export async function withBackoffRetry<T>(
  fn: () => Promise<T>,
  opts?: { maxAttempts?: number; baseDelayMs?: number; shouldRetry?: (err: unknown) => boolean },
) {
  const maxAttempts = opts?.maxAttempts ?? 5
  const baseDelayMs = opts?.baseDelayMs ?? 1000
  const shouldRetry = opts?.shouldRetry ?? (() => true)

  let lastErr: unknown = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt >= maxAttempts || !shouldRetry(err)) break
      const delay = baseDelayMs * Math.pow(2, attempt - 1)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}
