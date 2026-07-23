/**
 * Schema barrel — re-exports all tables, relations, and enums.
 * Import order matters: tables that are referenced via FK must be defined
 * before tables that reference them. Drizzle resolves relations lazily,
 * but the Neon/pg driver needs the pg-schema registration order to be correct.
 *
 * Order:
 *  1. enums          (no dependencies)
 *  2. organisation   (depends on enums)
 *  3. staff          (depends on organisation)
 *  4. suppliers      (depends on organisation, staff)
 *  5. inventory      (depends on organisation, staff, suppliers)
 *  6. customers      (depends on staff)
 *  7. sales          (depends on organisation, staff, customers, inventory)
 *  8. expenses       (depends on organisation, staff)
 *  9. accounting     (depends on organisation, staff)
 * 10. ai-insights    (depends on inventory, organisation)
 * 11. notifications  (depends on organisation, staff)
 * 12. eod            (depends on organisation, staff)
 * 13. audit          (depends on organisation, staff)
 */

export * from './enums';
export * from './organisation';
export * from './staff';
export * from './suppliers';
export * from './inventory';
export * from './customers';
export * from './sales';
export * from './expenses';
export * from './accounting';
export * from './ai-insights';
export * from './notifications';
export * from './eod';
export * from './audit';
