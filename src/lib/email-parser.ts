export type EmailInput = {
  from?: string;
  replyTo?: string;
  subject?: string;
  text?: string;
  body?: string;
  html?: string;
  date?: string;
  headers?: Record<string, string | undefined>;
};

export type ParsedEmailLead = {
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  company: string | null;
  interests: string[];
  currentSystem: string | null;
  notes: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
};

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_RE = /(?:\+?972[- .]?)?(?:0?5\d)[- .]?\d{3}[- .]?\d{4}\b/;
const LABELS = {
  name: ["שם מלא", "שם", "name", "full name", "contact name", "customer"],
  firstName: ["שם פרטי", "first name", "firstname"],
  lastName: ["שם משפחה", "last name", "lastname"],
  phone: ["טלפון", "טלפון נייד", "נייד", "phone", "mobile", "cell", "telephone"],
  email: ["אימייל", "דואל", "דואר אלקטרוני", "email", "e-mail"],
  city: ["עיר", "יישוב", "city", "town"],
  company: ["חברה", "ארגון", "company", "business"],
  interest: ["מוצר", "עניין", "תחום עניין", "product", "interest", "service"],
  system: ["מערכת קיימת", "מערכת", "סוג מערכת", "existing system", "system"],
};

type EmailField = keyof typeof LABELS;
export type EmailMappingProfile = {
  labels?: Partial<Record<EmailField, string[]>>;
};

function clean(value: string | undefined | null) {
  return (value || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function textFromHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function linesOf(input: EmailInput) {
  const body = clean(input.text || input.body || (input.html ? textFromHtml(input.html) : ""));
  return body.split(/\r?\n/).map(clean).filter(Boolean);
}

function valueAfterLabel(lines: string[], labels: string[]) {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`^(?:${escaped})\\s*(?:[:=\\-]|：)\\s*(.+)$`, "i");
  for (const line of lines) {
    const match = line.match(re);
    if (match?.[1]) return clean(match[1]);
  }
  return null;
}

function normalizePhone(raw: string | null) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+972${digits.slice(1)}`;
  return digits.length >= 9 ? `+${digits}` : null;
}

function nameFrom(input: EmailInput, lines: string[], labels = LABELS) {
  const labeled = valueAfterLabel(lines, labels.name);
  if (labeled) return labeled;
  const first = valueAfterLabel(lines, labels.firstName);
  const last = valueAfterLabel(lines, labels.lastName);
  if (first || last) return clean(`${first || ""} ${last || ""}`);
  const from = clean(input.from).replace(EMAIL_RE, "").replace(/[<>"']/g, "").trim();
  if (from && !/^(no-?reply|noreply|info|office|sales|support)$/i.test(from)) return from;
  return "ליד מאימייל";
}

function parseEmailWithLabels(input: EmailInput, labels: typeof LABELS): ParsedEmailLead {
  const lines = linesOf(input);
  const body = lines.join("\n");
  const phone = normalizePhone(valueAfterLabel(lines, labels.phone) || body.match(PHONE_RE)?.[0] || null);
  const labeledEmail = valueAfterLabel(lines, labels.email);
  const emailMatch = (labeledEmail || input.replyTo || input.from || input.text || "").match(EMAIL_RE);
  const email = emailMatch ? emailMatch[0].toLowerCase() : null;
  const city = valueAfterLabel(lines, labels.city);
  const company = valueAfterLabel(lines, labels.company);
  const interest = valueAfterLabel(lines, labels.interest);
  const currentSystem = valueAfterLabel(lines, labels.system);
  const subject = clean(input.subject);
  const notes = [subject && `נושא: ${subject}`, body].filter(Boolean).join("\n\n");
  const confidence = phone && (email || city) ? "HIGH" : phone || email ? "MEDIUM" : "LOW";

  return {
    name: nameFrom(input, lines, labels),
    email,
    phone,
    city,
    company,
    interests: interest ? [interest] : [],
    currentSystem,
    notes,
    confidence,
  };
}

export function parseEmailLead(input: EmailInput): ParsedEmailLead {
  return parseEmailWithLabels(input, LABELS);
}

/** Converts a user-supplied field mapping into a validated parser profile. */
export function profileFromMapping(mapping: unknown): EmailMappingProfile | undefined {
  if (!mapping || typeof mapping !== "object") return undefined;
  const raw = mapping as Record<string, unknown>;
  const source = raw.labels && typeof raw.labels === "object" ? raw.labels as Record<string, unknown> : raw;
  const labels: Partial<Record<EmailField, string[]>> = {};

  for (const field of Object.keys(LABELS) as EmailField[]) {
    const value = source[field];
    const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
    const cleaned = values
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim());
    if (cleaned.length) labels[field] = cleaned;
  }

  return Object.keys(labels).length ? { labels } : undefined;
}

export function parseEmail(input: EmailInput & { profile?: EmailMappingProfile }): ParsedEmailLead {
  const profileLabels = input.profile?.labels || {};
  const labels = { ...LABELS, ...profileLabels };
  return parseEmailWithLabels(input, labels);
}

export function sourceFromEmail(from?: string) {
  const address = (from || "").toLowerCase();
  if (address.includes("facebook")) return "FACEBOOK" as const;
  if (address.includes("instagram")) return "INSTAGRAM" as const;
  if (address.includes("whatsapp")) return "WHATSAPP" as const;
  return "GMAIL" as const;
}



