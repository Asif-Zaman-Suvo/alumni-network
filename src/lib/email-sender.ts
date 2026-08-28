/** dotenv strips wrapping quotes; the Vercel UI stores them if you paste from `.env`. */
export function unquoteEnvValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

export function parseSender(from: string): { name: string; email: string } {
  const unquoted = unquoteEnvValue(from);
  const angled = unquoted.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (angled?.[1] !== undefined && angled[2] !== undefined) {
    const name = unquoteEnvValue(angled[1]);
    return { name: name || "Alumni Network", email: unquoteEnvValue(angled[2]) };
  }
  return { name: "Alumni Network", email: unquoted };
}
