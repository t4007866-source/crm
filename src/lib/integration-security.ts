import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

function keyMaterial() {
  const value = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("INTEGRATION_ENCRYPTION_KEY או NEXTAUTH_SECRET לא מוגדר");
  return createHash("sha256").update(value).digest();
}

export function encryptConfig(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptConfig<T = Record<string, unknown>>(encoded: string): T {
  const [ivText, tagText, ciphertextText] = encoded.split(".");
  if (!ivText || !tagText || !ciphertextText) throw new Error("הגדרת אינטגרציה מוצפנת לא תקינה");
  const decipher = createDecipheriv("aes-256-gcm", keyMaterial(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  const plain = Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]);
  return JSON.parse(plain.toString("utf8")) as T;
}

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function safeCompare(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function maskSecret(value: string | null | undefined) {
  if (!value) return "—";
  return `••••••••••••${value.slice(-4)}`;
}

export function retryDelayMs(attempt: number) {
  return [0, 30_000, 300_000, 1_800_000][Math.min(Math.max(attempt, 0), 3)];
}

export function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

