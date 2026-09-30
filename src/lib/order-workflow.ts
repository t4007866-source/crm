import { OrderStatus } from "@prisma/client";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "טיוטה",
  PENDING_APPROVAL: "ממתינה לאישור",
  APPROVED: "אושרה",
  CONFIRMED: "אושרה",
  PENDING_PAYMENT: "ממתינה לתשלום",
  PARTIALLY_PAID: "שולמה חלקית",
  PAID: "שולמה",
  PENDING_STOCK: "ממתינה למלאי",
  READY_FOR_INSTALLATION: "מוכנה להתקנה",
  INSTALLATION_SCHEDULED: "נקבעה התקנה",
  IN_PROGRESS: "בוצעה",
  INSTALLATION_COMPLETED: "הושלמה",
  COMPLETED: "הושלמה",
  CANCELLED: "בוטלה",
  RETURNED: "הוחזרה",
};

const transitions: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "CONFIRMED", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "CANCELLED"],
  APPROVED: ["PENDING_PAYMENT", "PAID", "PENDING_STOCK", "CANCELLED"],
  CONFIRMED: ["PENDING_PAYMENT", "PAID", "PENDING_STOCK", "IN_PROGRESS", "CANCELLED"],
  PENDING_PAYMENT: ["PARTIALLY_PAID", "PAID", "CANCELLED"],
  PARTIALLY_PAID: ["PAID", "PENDING_STOCK", "CANCELLED"],
  PAID: ["PENDING_STOCK", "READY_FOR_INSTALLATION", "IN_PROGRESS", "CANCELLED"],
  PENDING_STOCK: ["READY_FOR_INSTALLATION", "CANCELLED"],
  READY_FOR_INSTALLATION: ["INSTALLATION_SCHEDULED", "IN_PROGRESS", "CANCELLED"],
  INSTALLATION_SCHEDULED: ["IN_PROGRESS", "INSTALLATION_COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["INSTALLATION_COMPLETED", "COMPLETED", "CANCELLED"],
  INSTALLATION_COMPLETED: ["COMPLETED", "RETURNED"],
  COMPLETED: ["RETURNED"],
  CANCELLED: ["RETURNED"],
  RETURNED: [],
};

export function canMoveOrder(from: OrderStatus, to: OrderStatus) {
  return from === to || transitions[from]?.includes(to) === true;
}

export function getAllowedOrderTransitions(status: OrderStatus) {
  return transitions[status] ?? [];
}

