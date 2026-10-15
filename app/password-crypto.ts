const iterations = 100_000;
const encoder = new TextEncoder();

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decode(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function derive(password: string, salt: Uint8Array, rounds: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: rounds }, key, 256));
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: encode(salt), passwordHash: encode(await derive(password, salt, iterations)), iterations };
}

export async function verifyPassword(password: string, account?: { salt: string; passwordHash: string; iterations: number } | null): Promise<boolean> {
  const salt = account ? decode(account.salt) : new Uint8Array(16);
  const rounds = account?.iterations ?? iterations;
  if (rounds < 100_000 || rounds > 1_000_000 || salt.length !== 16) return false;
  const actual = await derive(password, salt, rounds);
  const expected = account ? decode(account.passwordHash) : new Uint8Array(32);
  let difference = actual.length ^ expected.length;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ (expected[i] ?? 0);
  return !!account && difference === 0;
}
