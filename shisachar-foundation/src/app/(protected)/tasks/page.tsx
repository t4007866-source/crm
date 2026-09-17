export default function TasksPage() { return <Page title="משימות" text="משימות מכירה, שירות, תיאום, Follow-up והסלמות." />; }
function Page({ title, text }: { title: string; text: string }) { return <div className="card p-8"><h1 className="text-2xl font-bold">{title}</h1><p className="mt-3" style={{ color: "var(--muted)" }}>{text}</p></div>; }

