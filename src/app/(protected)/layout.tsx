import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { sidebarFor } from "@/lib/permissions";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = (session.user as any).role || "VIEWER";
  const name = session.user?.name || "משתמש";
  const customPermissions = (session.user as any).permissions as Record<string, string[]> | undefined;
  const sidebar = sidebarFor(role, customPermissions);
  return (
    <div className="flex h-screen">
      <aside className="w-64 flex-shrink-0 flex flex-col text-white" style={{ background: "linear-gradient(180deg,#16213e 0%,#263b68 55%,#3b2b76 100%)" }}>
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black" style={{ background: "linear-gradient(135deg,#f15a3a,#7657d9)" }}>U</div>
            <div><div className="text-xl font-bold">underbar</div><div className="text-xs text-white/55">מערכת ניהול חכמה</div></div>
          </div>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          {sidebar.map((item, index) => (
            <a key={item.id} href={item.href} className="flex items-center gap-3 mx-3 my-1 px-4 py-3 text-sm rounded-xl hover:bg-white/12" style={{ color: "rgba(255,255,255,.82)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: ["#f15a3a","#3d8bfd","#17a99a","#f3b638","#e9578f","#7657d9"][index % 6] }} />
              {item.label}
            </a>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold" style={{ background: "#ffffff22" }}>{name.slice(0, 1)}</div>
            <div><div className="text-sm font-medium">{name}</div><div className="text-xs text-white/50">{role}</div></div>
          </div>
          <form action="/api/auth/signout" method="post" className="mt-3">
            <button type="submit" className="text-xs hover:underline" style={{ color: "#ff9b83" }}>יציאה</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6"><div className="page-enter">{children}</div></main>
    </div>
  );
}



