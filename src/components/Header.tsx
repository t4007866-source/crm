"use client";
import { signOut } from "next-auth/react";

export default function Header({ userName, role }: { userName: string; role: string }) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b" style={{ background: "white", borderColor: "var(--border-light)" }}>
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="חיפוש לקוחות, לידים..."
          className="input-field"
          style={{ width: 300 }}
        />
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-md hover:bg-gray-100">
          <span className="text-lg">התראות</span>
          <span className="absolute top-0 right-0 w-2 h-2 rounded-full" style={{ background: "var(--accent-rust)" }} />
        </button>
        <div className="flex items-center gap-2">
          <div className="text-sm">
            <div className="font-medium">{userName}</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{role}</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm px-3 py-1.5 rounded-md hover:bg-gray-100"
            style={{ color: "var(--accent-rust)" }}
          >
            יציאה
          </button>
        </div>
      </div>
    </header>
  );
}

