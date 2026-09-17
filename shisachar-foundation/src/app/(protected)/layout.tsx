import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { sidebarFor } from "@/lib/permissions";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as any).role || "VIEWER";
  const name = session.user?.name || "משתמש";
  const sidebar = sidebarFor(role);

  return (
    <div className="flex h-screen">
      <aside className="w-56 flex-shrink-0 flex flex-col bg-ink text-white">
        <div className="p-5 border-b border-white/10">
          <div className="text-xl font-bold">שי סחר</div>
          <div className="text-xs text-white/50">מערכת ניהול</div>
        </div>
        <nav className="flex-1 py-4">
          {sidebar.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-white/5"
              style={{ color: "rgba(255,255,255,0.75)" }}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="text-sm font-medium">{name}</div>
          <div className="text-xs text-white/50">{role}</div>
          <form action="/api/auth/signout" method="post" className="mt-2">
            <button
              type="submit"
              className="text-xs hover:underline"
              style={{ color: "var(--rust)" }}
            >
              יציאה
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}

