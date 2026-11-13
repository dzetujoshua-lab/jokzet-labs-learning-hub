/**
 * The rate limiter counts in fixed wall-clock windows. A test that makes many calls and then expects a limit to have
 * been reached would flake if the window rolled over half-way through, so such tests first wait until enough of the
 * current window is left.
 */
export async function waitForWindowRoom(windowSeconds: number, marginMs = 30_000): Promise<void> {
  const size = windowSeconds * 1000;
  const left = size - (Date.now() % size);
  if (left < marginMs) await new Promise((resolve) => setTimeout(resolve, left + 500));
}
