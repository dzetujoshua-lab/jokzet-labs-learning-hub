/**
 * The programme rules forbid storing passwords, API keys, tokens or private keys as evidence. This is a best-effort
 * guard (it cannot catch everything) that blocks the common, recognisable shapes in text and links.
 */
const PATTERNS: [label: string, re: RegExp][] = [
  ["a private key", /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/],
  ["an AWS access key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["a GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b/],
  ["a Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ["a Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["an API secret key", /\bsk-(?:live|proj|ant)?-?[A-Za-z0-9_-]{24,}\b/],
  ["a password or secret assignment", /\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\b\s*[:=]\s*["']?[^\s"'<>]{8,}/i],
  ["a connection string with a password", /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@/]{4,}@[^\s/]+/i],
];

const SECRET_QUERY = /[?&](?:token|access_token|api[_-]?key|apikey|key|secret|password|pwd|auth|sig)=[^&\s]{6,}/i;

/** Returns the human-readable kinds of secret found (empty array = clean). */
export function detectSecrets(text: string): string[] {
  return PATTERNS.filter(([, re]) => re.test(text)).map(([label]) => label);
}

export function detectSecretInUrl(url: string): boolean {
  return SECRET_QUERY.test(url) || detectSecrets(url).length > 0;
}

export function secretMessage(found: string[]): string {
  return `This looks like it contains ${found[0]}. Remove secrets before saving evidence (the programme rules forbid storing them).`;
}

/** For schemas: the message to show when `value` looks like it contains a secret, or null when it is clean. */
export function secretIssue(value: string): string | null {
  const found = detectSecrets(value);
  return found.length ? secretMessage(found) : null;
}
