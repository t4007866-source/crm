import { can } from "@/lib/permissions";

export function canUseAi(role: string, overrides?: Record<string, string[]>): boolean {
  return can(role, "ai", "view", overrides);
}

export function canSeeFinancials(role: string): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

export function canActWithApproval(role: string): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

