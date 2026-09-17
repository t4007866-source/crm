export default function AutomationsPage() { return <Page title="אוטומציות" text="תזכורות החלפת סננים, אישורי WhatsApp, Follow-up והתראות." />; }
function Page({ title, text }: { title: string; text: string }) { return <div className="card p-8"><h1 className="text-2xl font-bold">{title}</h1><p className="mt-3" style={{ color: "var(--muted)" }}>{text}</p></div>; }

