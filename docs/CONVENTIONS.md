# Engineering conventions

Single source of truth for how this codebase is structured. Read it before
adding a module.

## Stack

- Next.js 16 (App Router, React 19, Server Components by default)
- TypeScript in `strict` mode, `noUncheckedIndexedAccess` enabled
- Tailwind CSS v4 (theme tokens in `src/app/globals.css`)
- Supabase: PostgreSQL + Auth + Storage, **all** data access is RLS-protected

## Layering

```
supabase/migrations/*.sql      schema, triggers, business rules, RLS policies
src/types/database.ts          typed mirror of the schema (Row / Insert / Update)
src/lib/db/<module>.ts         server-only queries (import 'server-only')
src/lib/actions/<module>.ts    'use server' mutations, called by forms
src/lib/validation/<module>.ts zod schemas for every user input
src/components/ui/*            design system (server-renderable primitives)
src/components/<module>/*      module specific components
src/app/(app)/<module>/...     routes (already wrapped by the app shell)
src/lib/domain/*               pure business logic (money, status, permissions)
```

Rules:

1. Pages are Server Components. They resolve the session, call `src/lib/db/*`,
   and render. No Supabase calls in presentational components.
2. Mutations are Server Actions that (a) resolve the session, (b) validate with
   zod, (c) re-check authorisation, (d) write, (e) `revalidatePath`.
3. Components never write derived money columns (`line_total`, `line_vat`,
   `total`, …). PostgreSQL triggers own them
   (`supabase/migrations/20250101000007_quotes.sql`).
4. `src/lib/domain/*` holds pure functions so business rules are unit testable
   without a database.

## Session & authorization

```ts
const session = await requireOrganization();        // redirects if no session/org
const session = await requireCapability('quotes.manage');
session.organization.id   // tenant id — always filter by it
session.role              // 'admin' | 'manager' | 'technician'
session.user.id           // auth user id
session.profile           // ProfileRow | null
```

Defence in depth: the UI hides what a role cannot do
(`can(capability, role)`), the Server Action re-checks, and the RLS policy is
the final gate. Every query must be scoped with
`.eq('organization_id', session.organization.id)` even though RLS already
filters — it makes intent explicit and keeps queries index-friendly.

## Server Action shape

```ts
'use server';

export async function saveThingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = thingSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireCapability('things.manage');
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from('things').insert({ ...parsed.data, organization_id: session.organization.id });
    if (error) return toActionError(error);
    revalidatePath('/things');
  } catch (error) {
    return toActionError(error, 'We could not save this record.');
  }

  return actionSuccess('Saved.');
}
```

Client side:

```tsx
const [state, formAction] = useActionState(saveThingAction, IDLE_ACTION_STATE);
<form action={formAction}>
  <ActionAlert status={state.status} message={state.message} />
  <Field htmlFor="name" label="Name" error={state.fieldErrors?.name?.[0]}>
    <Input id="name" name="name" hasError={Boolean(state.fieldErrors?.name)} />
  </Field>
  <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
</form>
```

## Validation

`src/lib/validation/common.ts` provides `requiredText`, `nullableText`,
`nullableEmail`, `nullablePhone`, `decimalNumber`, `nullableUuid`,
`nullableDate`, `nullableDateTime`, `checkbox`, `commaSeparatedList`,
`hexColor`, `countryCode`, `currencyCode` and `formDataToObject(formData)`.
Empty form strings are normalised to `null` so the database stores clean data.

## UI kit

`src/components/ui/`: `Button`/`ButtonLink`/`buttonClasses`, `SubmitButton`,
`Input`/`Textarea`/`Select`/`Checkbox`/`Field`/`FieldErrors`, `Card*`,
`Badge`/`StatusDot`, `Table*`/`MetaList`/`MetaItem`/`SummaryRow`,
`EmptyState`/`Skeleton`/`CardSkeleton`/`TableSkeleton`, `Alert`/`ActionAlert`,
`Modal`/`DangerSubmitButton`, `LinkTabs`/`SegmentedLinks`, `Pagination`,
`FilterForm`/`ResetFiltersButton`, `PageHeader`/`PageContainer`/`Toolbar`,
`Avatar`/`StatCard`/`ProgressBar`.

Responsive rules: tables inside `TableWrapper`, forms in
`grid gap-4 sm:grid-cols-2`, header actions in `PageHeader actions`, one
`loading.tsx` per heavy route, `EmptyState` for every empty list.

Accessibility rules: every control has a `<Field htmlFor label>`; errors set
`aria-invalid` and are announced with `role="alert"`; interactive elements are
real `<button>`/`<Link>`; the mobile drawer traps focus via `<dialog>` or
explicit aria attributes.

## Formatting helpers

`sFormatCurrency`, `formatNumber`, `formatDate`, `formatDateTime`, `formatTime`,
`formatDayLabel`, `formatRelative`, `toDateInputValue`, `toDateTimeInputValue`,
`isPastDate` live in `src/lib/utils/format.ts`.

## Error handling

`toActionError` maps PostgreSQL error codes and the custom error messages raised
by our SQL functions (`quote_must_be_accepted`, `cross_tenant_reference_blocked`,
…) to human readable text. Add new database messages to `DATABASE_MESSAGES` in
`src/lib/errors.ts` instead of leaking raw errors.

## Verification

```bash
npx tsc --noEmit     # must be clean
npx eslint .         # must be clean
npm run test         # vitest unit tests
npm run build        # production build
```
