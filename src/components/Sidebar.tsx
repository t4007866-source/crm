"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const iconMap: Record<string, string> = {
  LayoutDashboard: "לוח",
  Users: "קהל",
  UserPlus: "פלוס",
  Filter: "פילטר",
  Settings: "גלגל",
};

export default function Sidebar({
  items,
  userName,
  role,
}: {
  items: { id: string; label: string; href: string; icon: string }[];
  userName: string;
  role: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col" style={{ background: "var(--text-ink)", color: "white" }}>
      <div className="p-5 border-b border-white/10">
        <div className="text-xl font-bold">שי סחר</div>
        <div className="text-xs text-white/50">מערכת ניהול</div>
      </div>

      <nav className="flex-1 py-4">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 px-5 py-2.5 text-sm transition-colors"
              style={{
                background: active ? "rgba(255,255,255,0.08)" : "transparent",
                borderRight: active ? "3px solid var(--accent-rust)" : "3px solid transparent",
                color: active ? "white" : "rgba(255,255,255,0.65)",
              }}
            >
              <span className="w-5 text-center">{iconMap[item.icon] || "•"}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="text-sm font-medium">{userName}</div>
        <div className="text-xs text-white/50">{role}</div>
      </div>
    </aside>
  );
}

