# Orders upgrade — feature/orders-upgrade

This release is additive and backward-compatible with the existing CRM. Existing `Order`, `OrderItem`, customer, lead, inventory, service, and appointment fields were not removed.

## Included

- Extended order lifecycle statuses while retaining legacy statuses.
- Server-side status transition validation.
- Order status history with optional actor and reason.
- Lead, sales representative, technician, delivery/install address, internal/customer notes.
- Product-aware order items with installation/technician flags and line totals.
- Payments, attachments, shipments, approvals, and return-request models.
- Rich order GET endpoint and filtered order list (`?status=...&q=...`).
- Authorization checks for editing and approving status changes.
- Existing appointment synchronization retained.

## Safe rollout

1. Keep the current production database backup.
2. Push this branch as `feature/orders-upgrade`.
3. In a staging database, run:

```bash
npx prisma validate
npx prisma generate
npx prisma db push
npm run build
```

4. Smoke-test customers, leads, inventory, service calendar, map, and orders.
5. Apply the additive schema to production only after review.
6. Merge into `main` only after the staging checks pass.

## Database backup

Run this locally with your own Neon connection string available to the shell; never commit it or paste it into chat:

```bash
pg_dump --format=custom --file=backup-before-orders-upgrade.dump "$DATABASE_URL"
```

The uploaded archive did not contain database credentials, so no live database backup or migration was executed here.

