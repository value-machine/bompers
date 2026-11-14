# TanStack Query – Server State Management

## Overview

TanStack Query manages server state with caching, deduplication, and stale-while-revalidate. This addresses the following problems:

- Slow back navigation (data reloading)
- Duplicate API calls for the same data
- Stale information without refresh

## Query Keys

### Shared keys (cross-cutting)

None yet. Add `src/shared/utils/queryKeys.ts` when two or more features share a resource.

### Feature-based keys

Per feature: `features/[feature]/api/keys.ts`:

```typescript
export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
} as const;
```

### Conventions

- Hierarchy: `[resource, subResource?, ...params]`
- Use `as const` for type-safety
- Use spread for derived keys: `[...keys.all, "detail", id]`

## Mutations and Invalidation Patterns

### Rule

Only invalidate directly related keys. Avoid broad `invalidateQueries({ queryKey: [] })`.

### Patterns per mutation type

| Mutation            | Invalidate                                      | Do not invalidate         |
| ------------------- | ----------------------------------------------- | ------------------------- |
| Create project      | `projectKeys.lists()`                           | Detail (not yet existing) |
| Update project      | `projectKeys.detail(id)`, `projectKeys.lists()` | Other features            |
| Delete project      | `projectKeys.detail(id)`, `projectKeys.lists()` | User, config              |
| Update project (canonical) | Merge via `setQueryData` on mutation result | Same detail key on happy path |

### Example mutation

Pattern only (not shipped). Add a service function such as `updateProject(id, data)` that returns the canonical row.

```typescript
// features/projects/hooks/useUpdateProject.ts (example)
type ProjectUpdate = Partial<Omit<Project, "id">>;

export const useUpdateProject = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProjectUpdate) => updateProject(id, data),
    onSuccess: (result) => {
      queryClient.setQueryData(projectKeys.detail(id), result);
    },
  });
};
```

### Optimistic updates (optional)

Only for fast, reversible actions (toggles, likes). Not for: payments, account changes.

```typescript
onMutate: async (newData) => {
  await queryClient.cancelQueries({ queryKey: projectKeys.detail(id) });
  const previous = queryClient.getQueryData(projectKeys.detail(id));
  queryClient.setQueryData(projectKeys.detail(id), newData);
  return { previous };
},
onError: (_err, _vars, context) => {
  if (context?.previous) {
    queryClient.setQueryData(projectKeys.detail(id), context.previous);
  }
},
```

## Plain optimistic + server-canonical response (playbook)

**SSOT** for mutation UX (summary + trigger: `.claude/rules/architecture.md` § Plain optimistic + server-canonical response). Goal: one optimistic render, then one committed render that matches persisted data — no third render from a refetch that disagrees with the patch. Same model in other libraries: Apollo `optimisticResponse`, RTK Query `updateQueryData`, SWR `mutate` with `optimisticData` + `populateCache`.

### Playbook steps (in order)

1. **Canonical API contracts**  
   Server mutation paths should return the **canonical projection** the UI renders (updated row(s), counts, or list slice), e.g. PostgREST `.select(...)` after `.update()` / `.insert()`. Avoid **204 No Content / void success + mandatory refetch** as the default contract for row-level edits when the UI already holds query cache for that entity.

2. **Optimistic phase** (`onMutate`, before `await`)  
   - `cancelQueries` for affected keys if needed to avoid races.  
   - Snapshot previous cache via `getQueryData` (or equivalent).  
   - Apply a cache **patch** that uses the **same field shape and normalizers** the server response will use.  
   - Return rollback context (e.g. `{ previous }`) from `onMutate`.

3. **Error phase** (`onError`)  
   - Restore the snapshot with `setQueryData` using stored context.  
   - Surface **one** non-blocking error (toast/snackbar); do not stack multiple error UIs from the same gesture.

4. **Success phase** (`onSuccess` / `onSettled` when error-corrected)  
   - Merge the **mutation result** into the cache with `setQueryData` (or targeted `setQueriesData`) so cache matches the server response **byte-for-byte** for that projection.  
   - **Do not** call `invalidateQueries` or `refetch` on the **happy path** for the **same** list/detail keys you just reconciled—this is the main cause of an extra refetch render that does not match the optimistic patch and produces flashes.

5. **Pending / “saving” chrome**  
   Clear loading or “saving” indicators only after the cache holds **server-canonical** data for the relevant keys (e.g. after `setQueryData` from the response), not merely when the mutation `Promise` resolves if you still rely on a follow-up refetch.

6. **React rendering**  
   - Wrap non-urgent success-path updates in `startTransition` when they might defer heavy tree work.  
   - Keep **stable list keys** (`id`-based; avoid array index keys) through optimistic → server merge so React does not remount rows unnecessarily.

7. **When `invalidateQueries` / refetch *is* acceptable**  
   - Unknown or large blast radius (bulk operations, admin actions touching many rows).  
   - Cross-table aggregates or summaries where the mutation response does not carry the full derived state.  
   - **Secondary staleness**: refresh other caches **after** the user-visible path has already merged canonical data for the focused query—optionally deferred (`queueMicrotask`, `setTimeout(0)`, or transition).

8. **Hybrid escape hatch**  
   Reconcile the **focused** query from the **response body** first. If other caches might be stale, **invalidate only secondary keys**, preferably **deferred**, never in the same tick as a redundant invalidation of the key you just `setQueryData`’d.

### Anti-patterns (treat as bugs when fixing flashes)

- Optimistic patch followed immediately by **`invalidateQueries` / `refetch` on the same list or detail key** on success.  
- **Multiple concurrent refresh mechanisms** on one gesture (`refetch()` + `invalidateQueries()` + resetting local duplicated state) without a **single** canonical merge step into TanStack Query cache.  
- **Divergent data shapes** between optimistic updates and server normalizers (different sort keys, computed fields, `null` vs. `[]`, missing timestamps).  
- Clearing “saving” state before the cache reflects the server response while a refetch is still the planned source of truth.

## Stale/gc Times

- Defaults: 5 min stale, 30 min gc (in `queryClient.ts`)
- Override per query when needed (e.g. `staleTime: 0` for realtime data)

| Data type             | staleTime       | gcTime           | Notes                              |
| --------------------- | --------------- | ---------------- | ---------------------------------- |
| Lists (e.g. projects) | 5 min           | 30 min           | Invalidate on create/update/delete |
| Detail (e.g. project) | 2–5 min         | 30 min           | Invalidate on update/delete        |
| Realtime data         | 0               | 5 min            | Polling or websocket-driven        |

## Intentional exceptions

**`/tasks` dev backlog** (`src/features/tasks`) uses local React state and direct fetch to the Vite dev middleware — not TanStack Query. This is intentional: the backlog is a dev-only tool backed by local JSON, not user-facing server state. See `src/features/tasks/README.md`.

## Testing

**File:** `tests/test-utils.tsx`

- `createTestQueryClient()` – QueryClient with `retry: false`, `gcTime: 0` for fast, deterministic tests
- `createQueryClientWrapper()` – Returns a wrapper component for `render(..., { wrapper })`

### Example

```tsx
import { render, screen } from "@testing-library/react";
import { createQueryClientWrapper } from "@/../tests/test-utils";
import { ItemList } from "../ItemList";

// When testing components that use useQuery/useMutation without mocking:
render(<ItemList />, {
  wrapper: createQueryClientWrapper(),
});
```

### When to use

- **Use wrapper:** When rendering components that call query hooks without mocking them
- **Mock instead:** When you want to control the returned data (e.g. `vi.mock("@/features/projects/hooks/useProjectList")`)

### Service tests

Mock `queryClient` in service tests when the service uses it.

### Not covered by automated tests

Unit tests cover hooks and services. The following require **manual verification**:

- Cached data when navigating back

## Lazy loading + Suspense

- Lazy load heavy pages: `lazy(() => import("@/pages/tasks/TasksPage"))`
- Wrap routes in `<Suspense fallback={<PageLoadingState />}>`
- Cached query data + code splitting = fast navigation on return visits

## Error Boundary

**File:** `src/components/common/QueryErrorBoundary/QueryErrorBoundary.tsx`

- Wraps route-level content to catch render errors (including failed lazy loads)
- Default fallback: "Something went wrong" + Retry button (reloads page)
- **Placement:** Around `Suspense` + `Routes` in App.tsx

## Retry Logic

Configured in `queryClient.ts`:

- **Queries:** Retry up to 2 times, exponential backoff (1s, 2s, max 30s). No retry on 404.
- **Mutations:** No retry (default).
- **Tests:** `createTestQueryClient()` uses `retry: false` for deterministic tests.

## Migration Strategy for New Features

For new features that fetch server data, use these patterns:

### useEntityList

```typescript
// features/projects/hooks/useProjectList.ts
export const useProjectList = (filters?: ProjectFilters) => {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: () => ProjectService.list(filters),
    staleTime: 5 * 60 * 1000,
  });
};
```

### useEntityDetail

```typescript
// features/projects/hooks/useProjectDetail.ts
export const useProjectDetail = (id: string | null) => {
  return useQuery({
    queryKey: projectKeys.detail(id ?? ""),
    queryFn: () => ProjectService.getById(id!),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
};
```

### Checklist for new features

1. Add query keys in `features/[feature]/api/keys.ts`
2. Create fetch function in service (or use existing)
3. Create `useXxxQuery` hook with `useQuery`
4. Optionally keep legacy `useXxx` as thin wrapper for backward compatibility
5. Add mutation hooks with `onSuccess` invalidation

## Plain optimistic + server-canonical response

**SSOT** for mutation UX and cache merge vs. invalidation on success. Trigger line lives in `.claude/rules/architecture.md` § Plain optimistic + server-canonical response.

**Default pattern** for mutations that must feel instant without stutters, flashes, or snapbacks: one optimistic render, then one committed render that matches persisted data. Avoid a third render from refetch that disagrees with the optimistic patch.

This repo uses **TanStack Query** for server state (`@tanstack/react-query`). The same mental model maps to other libraries if introduced later: Apollo `optimisticResponse`, RTK Query `updateQueryData`, SWR `mutate` with `optimisticData` + `populateCache`, etc.—**optimistic patch first, server payload merges into cache as truth**.

### Playbook steps (in order)

1. **Canonical API contracts**
   Server mutation paths should return the **canonical projection** the UI renders (updated row(s), counts, or list slice), e.g. PostgREST `.select(...)` after `.update()` / `.insert()`. Avoid **204 No Content / void success + mandatory refetch** as the default contract for row-level edits when the UI already holds query cache for that entity.

2. **Optimistic phase** (`onMutate`, before `await`)
   - `cancelQueries` for affected keys if needed to avoid races.
   - Snapshot previous cache via `getQueryData` (or equivalent).
   - Apply a cache **patch** that uses the **same field shape and normalizers** the server response will use.
   - Return rollback context (e.g. `{ previous }`) from `onMutate`.

3. **Error phase** (`onError`)
   - Restore the snapshot with `setQueryData` using stored context.
   - Surface **one** non-blocking error (toast/snackbar); do not stack multiple error UIs from the same gesture.

4. **Success phase** (`onSuccess` / `onSettled` when error-corrected)
   - Merge the **mutation result** into the cache with `setQueryData` (or targeted `setQueriesData`) so cache matches the server response **byte-for-byte** for that projection.
   - **Do not** call `invalidateQueries` or `refetch` on the **happy path** for the **same** list/detail keys you just reconciled—this is the main cause of an extra refetch render that does not match the optimistic patch and produces flashes.

5. **Pending / "saving" chrome**
   Clear loading or "saving" indicators only after the cache holds **server-canonical** data for the relevant keys (e.g. after `setQueryData` from the response), not merely when the mutation `Promise` resolves if you still rely on a follow-up refetch.

6. **React rendering**
   - Wrap non-urgent success-path updates in `startTransition` when they might defer heavy tree work.
   - Keep **stable list keys** (`id`-based; avoid array index keys) through optimistic → server merge so React does not remount rows unnecessarily.

7. **When `invalidateQueries` / refetch *is* acceptable**
   - Unknown or large blast radius (bulk operations, admin actions touching many rows).
   - Cross-table aggregates or summaries where the mutation response does not carry the full derived state.
   - **Secondary staleness**: refresh other caches **after** the user-visible path has already merged canonical data for the focused query—optionally deferred (`queueMicrotask`, `setTimeout(0)`, or transition).

8. **Hybrid escape hatch**
   Reconcile the **focused** query from the **response body** first. If other caches might be stale, **invalidate only secondary keys**, preferably **deferred**, never in the same tick as a redundant invalidation of the key you just `setQueryData`'d.

### Anti-patterns (treat as bugs when fixing flashes)

- Optimistic patch followed immediately by **`invalidateQueries` / `refetch` on the same list or detail key** on success.
- **Multiple concurrent refresh mechanisms** on one gesture (`refetch()` + `invalidateQueries()` + resetting local duplicated state) without a **single** canonical merge step into TanStack Query cache.
- **Divergent data shapes** between optimistic updates and server normalizers (different sort keys, computed fields, `null` vs. `[]`, missing timestamps).
- Clearing "saving" state before the cache reflects the server response while a refetch is still the planned source of truth.

### Related implementation in this repo

- Mutation pattern: § Example mutation above (not shipped; mutations get their own category name in the owning feature). Prefer `setQueryData` from the mutation result over invalidation for the same key.
- `src/shared/utils/queryClient.ts` — shared `QueryClient` defaults (`createQueryClient`, app singleton).
- Per-feature keys follow the factory pattern above (e.g. `features/<feature>/api/keys.ts` when a feature adds queries).
