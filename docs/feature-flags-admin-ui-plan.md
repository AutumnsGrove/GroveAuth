# Feature Flags Admin UI Plan

```
        ┌────────────────────────────────────────────┐
        │     🚩 Feature Flags Admin Interface       │
        │                                            │
        │   ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  │
        │   │ List │→│ Edit │→│ Rules│→│ Audit│  │
        │   └──────┘  └──────┘  └──────┘  └──────┘  │
        │                                            │
        │   Central control for Grove feature flags  │
        └────────────────────────────────────────────┘
```

**Created**: 2026-01-13
**Status**: Planning
**Priority**: Medium-High
**Location**: GroveAuth Dashboard (`/dashboard/flags`)
**Database**: ENGINE_DB (grove-engine-db via existing binding)

---

## Overview

Add a feature flags management interface to GroveAuth's admin dashboard, allowing Grove administrators to:

- View all feature flags and their current state
- Toggle flags on/off with a single click
- Configure percentage rollouts with visual slider
- Set up tier-gating rules (Seedling, Sapling, Oak, Evergreen)
- Manage beta tenant lists for invite-only features
- View audit log of flag changes

---

## Why GroveAuth?

| Reason | Detail |
|--------|--------|
| **Central admin hub** | All Grove admin functions in one place |
| **Auth already built** | Admin middleware, rate limiting, JWT verification |
| **ENGINE_DB binding** | Already has access to grove-engine-db |
| **Consistent UI** | Same design system, patterns, components |
| **Single sign-on** | Admins already authenticated via Heartwood |

---

## Database Access

GroveAuth's `ENGINE_DB` binding connects to `grove-engine-db` where feature flags live:

```typescript
// In wrangler.toml (already configured)
[[d1_databases]]
binding = "ENGINE_DB"
database_name = "grove-engine-db"
database_id = "a6394da2-b7a6-48ce-b7fe-b1eb3e730e68"
```

**Tables to access:**
- `feature_flags` — Flag definitions
- `flag_rules` — Rules (tier, tenant, percentage)
- `flag_audit_log` — Change history

---

## Route Structure

### Backend API (`src/routes/flags.ts`)

```typescript
// Mount in src/index.ts:
// import flags from './routes/flags.js';
// app.route('/flags', flags);

const flags = new Hono<{ Bindings: Env }>();

// Middleware: Admin-only access
flags.use('/*', adminMiddleware);

// List all flags
flags.get('/', async (c) => {
  const flags = await getAllFlags(c.env.ENGINE_DB);
  return c.json({ flags });
});

// Get single flag with rules
flags.get('/:id', async (c) => {
  const flag = await getFlagWithRules(c.env.ENGINE_DB, c.req.param('id'));
  if (!flag) return c.json({ error: 'not_found' }, 404);
  return c.json({ flag });
});

// Toggle flag enabled state
flags.post('/:id/toggle', async (c) => {
  const { enabled, reason } = await c.req.json();
  await toggleFlag(c.env.ENGINE_DB, c.req.param('id'), enabled, reason, adminUserId);
  await invalidateFlagCache(c.env.FLAGS_KV, c.req.param('id'));
  return c.json({ success: true });
});

// Update flag settings
flags.put('/:id', async (c) => {
  const updates = await c.req.json();
  await updateFlag(c.env.ENGINE_DB, c.req.param('id'), updates, adminUserId);
  await invalidateFlagCache(c.env.FLAGS_KV, c.req.param('id'));
  return c.json({ success: true });
});

// Create new flag
flags.post('/', async (c) => {
  const flagData = await c.req.json();
  const flag = await createFlag(c.env.ENGINE_DB, flagData, adminUserId);
  return c.json({ flag }, 201);
});

// CRUD for rules
flags.post('/:id/rules', async (c) => { /* Add rule */ });
flags.put('/:id/rules/:ruleId', async (c) => { /* Update rule */ });
flags.delete('/:id/rules/:ruleId', async (c) => { /* Delete rule */ });

// Audit log
flags.get('/:id/audit', async (c) => {
  const log = await getFlagAuditLog(c.env.ENGINE_DB, c.req.param('id'));
  return c.json({ log });
});

export default flags;
```

### Frontend Routes

```
frontend/src/routes/dashboard/flags/
├── +page.svelte           # Flag list with quick toggles
├── +page.server.ts        # Load all flags
├── [id]/
│   ├── +page.svelte       # Flag editor (settings + rules)
│   └── +page.server.ts    # Load single flag + rules + audit
└── new/
    ├── +page.svelte       # Create new flag form
    └── +page.server.ts    # Handle creation
```

---

## UI Components

### Flag List Page (`/dashboard/flags`)

```svelte
<script lang="ts">
  import Logo from '$lib/components/Logo.svelte';
  import { theme } from '$lib/theme';

  let { data } = $props();
  let flags = $state(data.flags);
  let search = $state('');

  const filteredFlags = $derived(
    flags.filter(f =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.id.toLowerCase().includes(search.toLowerCase())
    )
  );

  async function toggleFlag(id: string, enabled: boolean) {
    await fetch(`/flags/${id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, reason: 'Quick toggle from dashboard' })
    });
    // Update local state
    flags = flags.map(f => f.id === id ? { ...f, enabled } : f);
  }
</script>

<main class="min-h-screen p-6 md:p-8">
  <header class="flex items-center justify-between mb-8">
    <div class="flex items-center gap-4">
      <Logo size="sm" />
      <div>
        <h1 class="text-2xl font-serif text-bark dark:text-gray-100">Feature Flags</h1>
        <p class="text-sm text-bark/60 dark:text-gray-400">
          Manage feature rollouts and experiments
        </p>
      </div>
    </div>
    <a href="/dashboard/flags/new" class="btn-primary">
      + Create Flag
    </a>
  </header>

  <!-- Search -->
  <div class="mb-6">
    <input
      type="text"
      bind:value={search}
      placeholder="Search flags..."
      class="input-field w-full max-w-md"
    />
  </div>

  <!-- Flag List -->
  <div class="card">
    <table class="w-full">
      <thead class="border-b border-grove-200 dark:border-gray-700">
        <tr>
          <th class="text-left p-4 text-sm font-sans text-bark/60">Flag</th>
          <th class="text-left p-4 text-sm font-sans text-bark/60">Type</th>
          <th class="text-left p-4 text-sm font-sans text-bark/60">Status</th>
          <th class="text-left p-4 text-sm font-sans text-bark/60">Rules</th>
          <th class="text-right p-4 text-sm font-sans text-bark/60">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredFlags as flag}
          <tr class="border-b border-grove-100 dark:border-gray-800 hover:bg-grove-50 dark:hover:bg-gray-800/50">
            <td class="p-4">
              <div class="font-serif text-bark dark:text-gray-100">{flag.name}</div>
              <div class="text-sm text-bark/50 dark:text-gray-500 font-mono">{flag.id}</div>
            </td>
            <td class="p-4">
              <span class="badge badge-{flag.flag_type}">
                {flag.flag_type}
              </span>
            </td>
            <td class="p-4">
              <button
                onclick={() => toggleFlag(flag.id, !flag.enabled)}
                class="toggle {flag.enabled ? 'toggle-on' : 'toggle-off'}"
              >
                {flag.enabled ? 'ON' : 'OFF'}
              </button>
            </td>
            <td class="p-4 text-sm text-bark/60 dark:text-gray-400">
              {flag.rule_count} rule{flag.rule_count !== 1 ? 's' : ''}
            </td>
            <td class="p-4 text-right">
              <a href="/dashboard/flags/{flag.id}" class="btn-ghost text-sm">
                Edit →
              </a>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</main>
```

### Flag Editor Page (`/dashboard/flags/[id]`)

```svelte
<script lang="ts">
  let { data } = $props();
  let flag = $state(data.flag);
  let rules = $state(data.rules);
  let auditLog = $state(data.auditLog);

  let showAddRule = $state(false);
  let newRule = $state({ ruleType: 'always', ruleValue: {}, resultValue: true, priority: 0 });
</script>

<main class="min-h-screen p-6 md:p-8 max-w-4xl mx-auto">
  <!-- Header -->
  <header class="mb-8">
    <a href="/dashboard/flags" class="text-sm text-grove-600 hover:text-grove-700 mb-2 inline-block">
      ← Back to flags
    </a>
    <h1 class="text-2xl font-serif text-bark dark:text-gray-100">{flag.name}</h1>
    <p class="text-bark/60 dark:text-gray-400 font-mono text-sm">{flag.id}</p>
  </header>

  <!-- Flag Settings Card -->
  <div class="card p-6 mb-6">
    <h2 class="text-lg font-serif text-bark dark:text-gray-100 mb-4">Settings</h2>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-sans text-bark/60 mb-1">Display Name</label>
        <input type="text" bind:value={flag.name} class="input-field w-full" />
      </div>

      <div>
        <label class="block text-sm font-sans text-bark/60 mb-1">Description</label>
        <textarea bind:value={flag.description} class="input-field w-full" rows="2"></textarea>
      </div>

      <div class="flex items-center justify-between p-4 bg-grove-50 dark:bg-gray-800 rounded-lg">
        <div>
          <div class="font-sans text-bark dark:text-gray-100">Master Kill Switch</div>
          <div class="text-sm text-bark/60 dark:text-gray-400">
            When disabled, flag always returns default value
          </div>
        </div>
        <button
          onclick={() => flag.enabled = !flag.enabled}
          class="toggle {flag.enabled ? 'toggle-on' : 'toggle-off'}"
        >
          {flag.enabled ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  </div>

  <!-- Rules Card -->
  <div class="card p-6 mb-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-serif text-bark dark:text-gray-100">Rules</h2>
      <button onclick={() => showAddRule = true} class="btn-secondary text-sm">
        + Add Rule
      </button>
    </div>

    <p class="text-sm text-bark/60 dark:text-gray-400 mb-4">
      Rules are evaluated in priority order (highest first). First matching rule wins.
    </p>

    {#if rules.length === 0}
      <div class="text-center py-8 text-bark/50 dark:text-gray-500">
        No rules configured. Flag will always return default value.
      </div>
    {:else}
      <div class="space-y-3">
        {#each rules.sort((a, b) => b.priority - a.priority) as rule}
          <RuleCard {rule} onUpdate={updateRule} onDelete={deleteRule} />
        {/each}
      </div>
    {/if}
  </div>

  <!-- Audit Log Card -->
  <div class="card p-6">
    <h2 class="text-lg font-serif text-bark dark:text-gray-100 mb-4">Audit Log</h2>

    <div class="space-y-2">
      {#each auditLog.slice(0, 10) as entry}
        <div class="flex justify-between items-center p-3 bg-grove-50 dark:bg-gray-800 rounded">
          <div>
            <span class="badge badge-{entry.action}">{entry.action}</span>
            <span class="text-sm text-bark/60 dark:text-gray-400 ml-2">
              by {entry.changed_by || 'system'}
            </span>
          </div>
          <span class="text-sm text-bark/50 dark:text-gray-500">
            {formatRelativeTime(entry.changed_at)}
          </span>
        </div>
      {/each}
    </div>
  </div>
</main>
```

---

## Rule Types UI

### Percentage Rollout

```svelte
<!-- PercentageRule.svelte -->
<script lang="ts">
  let { value = $bindable(0) } = $props();
</script>

<div class="space-y-2">
  <div class="flex items-center gap-4">
    <input
      type="range"
      min="0"
      max="100"
      bind:value
      class="flex-1 accent-grove-600"
    />
    <span class="w-16 text-right font-mono text-bark dark:text-gray-100">
      {value}%
    </span>
  </div>

  <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
    <div
      class="h-full bg-grove-500 transition-all duration-300"
      style="width: {value}%"
    />
  </div>

  <p class="text-sm text-bark/50 dark:text-gray-500">
    {value > 0 ? `~${value}% of users will see this feature` : 'Feature disabled for all users'}
  </p>
</div>
```

### Tier Selector

```svelte
<!-- TierSelector.svelte -->
<script lang="ts">
  const TIERS = [
    { id: 'seedling', name: 'Seedling', icon: '🌱' },
    { id: 'sapling', name: 'Sapling', icon: '🌿' },
    { id: 'oak', name: 'Oak', icon: '🌳' },
    { id: 'evergreen', name: 'Evergreen', icon: '🌲' }
  ];

  let { selected = $bindable([]) } = $props();

  function toggle(tier: string) {
    if (selected.includes(tier)) {
      selected = selected.filter(t => t !== tier);
    } else {
      selected = [...selected, tier];
    }
  }
</script>

<div class="flex flex-wrap gap-2">
  {#each TIERS as tier}
    <button
      onclick={() => toggle(tier.id)}
      class="px-4 py-2 rounded-full text-sm font-sans transition-all
             {selected.includes(tier.id)
               ? 'bg-grove-600 text-white'
               : 'bg-grove-100 dark:bg-gray-800 text-bark dark:text-gray-300 hover:bg-grove-200'}"
    >
      {tier.icon} {tier.name}
    </button>
  {/each}
</div>
```

### Tenant List

```svelte
<!-- TenantListRule.svelte -->
<script lang="ts">
  let { tenantIds = $bindable([]) } = $props();
  let newTenant = $state('');

  function addTenant() {
    if (newTenant && !tenantIds.includes(newTenant)) {
      tenantIds = [...tenantIds, newTenant];
      newTenant = '';
    }
  }

  function removeTenant(id: string) {
    tenantIds = tenantIds.filter(t => t !== id);
  }
</script>

<div class="space-y-3">
  <div class="flex gap-2">
    <input
      type="text"
      bind:value={newTenant}
      placeholder="Tenant ID..."
      class="input-field flex-1"
    />
    <button onclick={addTenant} class="btn-secondary">
      Add
    </button>
  </div>

  {#if tenantIds.length > 0}
    <div class="flex flex-wrap gap-2">
      {#each tenantIds as tenant}
        <span class="inline-flex items-center gap-1 px-3 py-1 bg-grove-100 dark:bg-gray-800 rounded-full text-sm">
          {tenant}
          <button onclick={() => removeTenant(tenant)} class="text-bark/50 hover:text-red-500">
            ×
          </button>
        </span>
      {/each}
    </div>
  {:else}
    <p class="text-sm text-bark/50 dark:text-gray-500">
      No tenants added. Add tenant IDs to grant access.
    </p>
  {/if}
</div>
```

---

## CSS Additions

Add to `frontend/src/app.css`:

```css
/* Toggle Switch */
.toggle {
  @apply px-3 py-1 rounded-full text-sm font-sans transition-all cursor-pointer;
}

.toggle-on {
  @apply bg-grove-600 text-white;
}

.toggle-off {
  @apply bg-gray-200 dark:bg-gray-700 text-bark/60 dark:text-gray-400;
}

/* Badge variants for flag types */
.badge-boolean {
  @apply bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300;
}

.badge-percentage {
  @apply bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300;
}

.badge-tier {
  @apply bg-grove-100 text-grove-700 dark:bg-grove-900/30 dark:text-grove-300;
}

.badge-variant {
  @apply bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300;
}

/* Audit log action badges */
.badge-create {
  @apply bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300;
}

.badge-update {
  @apply bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300;
}

.badge-enable {
  @apply bg-grove-100 text-grove-700 dark:bg-grove-900/30 dark:text-grove-300;
}

.badge-disable {
  @apply bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300;
}
```

---

## Database Queries

Add to `src/db/queries.ts`:

```typescript
// ============================================================================
// FEATURE FLAGS QUERIES (ENGINE_DB)
// ============================================================================

export interface FeatureFlag {
  id: string;
  name: string;
  description: string | null;
  flag_type: 'boolean' | 'percentage' | 'variant' | 'tier' | 'json';
  default_value: string;
  enabled: number;
  created_at: string;
  updated_at: string;
  rule_count?: number;
}

export interface FlagRule {
  id: number;
  flag_id: string;
  priority: number;
  rule_type: 'tenant' | 'tier' | 'percentage' | 'user' | 'time' | 'always';
  rule_value: string; // JSON
  result_value: string; // JSON
  enabled: number;
}

export async function getAllFlags(db: D1Database): Promise<FeatureFlag[]> {
  const result = await db.prepare(`
    SELECT
      f.*,
      COUNT(r.id) as rule_count
    FROM feature_flags f
    LEFT JOIN flag_rules r ON f.id = r.flag_id
    GROUP BY f.id
    ORDER BY f.name
  `).all<FeatureFlag>();

  return result.results;
}

export async function getFlagWithRules(
  db: D1Database,
  flagId: string
): Promise<{ flag: FeatureFlag; rules: FlagRule[] } | null> {
  const flag = await db
    .prepare('SELECT * FROM feature_flags WHERE id = ?')
    .bind(flagId)
    .first<FeatureFlag>();

  if (!flag) return null;

  const rules = await db
    .prepare('SELECT * FROM flag_rules WHERE flag_id = ? ORDER BY priority DESC')
    .bind(flagId)
    .all<FlagRule>();

  return { flag, rules: rules.results };
}

export async function toggleFlag(
  db: D1Database,
  flagId: string,
  enabled: boolean,
  reason: string,
  changedBy: string
): Promise<void> {
  await db.batch([
    db.prepare(`
      UPDATE feature_flags
      SET enabled = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(enabled ? 1 : 0, flagId),

    db.prepare(`
      INSERT INTO flag_audit_log (flag_id, action, new_value, changed_by, reason)
      VALUES (?, ?, ?, ?, ?)
    `).bind(flagId, enabled ? 'enable' : 'disable', JSON.stringify({ enabled }), changedBy, reason)
  ]);
}

export async function updateFlag(
  db: D1Database,
  flagId: string,
  updates: Partial<FeatureFlag>,
  changedBy: string
): Promise<void> {
  // Get old value for audit
  const oldFlag = await db
    .prepare('SELECT * FROM feature_flags WHERE id = ?')
    .bind(flagId)
    .first();

  await db.batch([
    db.prepare(`
      UPDATE feature_flags
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          default_value = COALESCE(?, default_value),
          enabled = COALESCE(?, enabled),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(updates.name, updates.description, updates.default_value, updates.enabled, flagId),

    db.prepare(`
      INSERT INTO flag_audit_log (flag_id, action, old_value, new_value, changed_by)
      VALUES (?, 'update', ?, ?, ?)
    `).bind(flagId, JSON.stringify(oldFlag), JSON.stringify(updates), changedBy)
  ]);
}

export async function getFlagAuditLog(
  db: D1Database,
  flagId: string,
  limit = 50
): Promise<any[]> {
  const result = await db
    .prepare(`
      SELECT * FROM flag_audit_log
      WHERE flag_id = ?
      ORDER BY changed_at DESC
      LIMIT ?
    `)
    .bind(flagId, limit)
    .all();

  return result.results;
}

// Cache invalidation helper
export async function invalidateFlagCache(
  kv: KVNamespace,
  flagId: string
): Promise<void> {
  const list = await kv.list({ prefix: `flag:${flagId}:` });
  await Promise.all(list.keys.map(key => kv.delete(key.name)));
}
```

---

## Implementation Checklist

### Backend (`src/`)
- [ ] Create `routes/flags.ts` with CRUD endpoints
- [ ] Add queries to `db/queries.ts`
- [ ] Mount routes in `index.ts`
- [ ] Add FLAGS_KV binding to wrangler.toml (for cache invalidation)

### Frontend (`frontend/src/`)
- [ ] Create `/dashboard/flags/+page.svelte` (list view)
- [ ] Create `/dashboard/flags/+page.server.ts` (load flags)
- [ ] Create `/dashboard/flags/[id]/+page.svelte` (editor)
- [ ] Create `/dashboard/flags/[id]/+page.server.ts` (load single flag)
- [ ] Create `/dashboard/flags/new/+page.svelte` (create form)
- [ ] Add rule editor components (Percentage, Tier, Tenant)
- [ ] Add CSS classes to `app.css`

### Navigation
- [ ] Add "Feature Flags" link to dashboard sidebar/nav

### Testing
- [ ] Test flag list loading
- [ ] Test quick toggle functionality
- [ ] Test rule creation/editing
- [ ] Test cache invalidation
- [ ] Test audit logging

---

## Security Considerations

- [ ] Admin-only access (reuse existing middleware)
- [ ] Rate limiting on write operations
- [ ] Audit log all changes with user attribution
- [ ] Validate flag IDs (alphanumeric + underscore only)
- [ ] Sanitize rule values (JSON validation)

---

## Related Documents

- `GroveEngine/docs/plans/feature-flags-spec.md` — Core flag system spec
- `GroveEngine/docs/plans/feature-flags-expansion-roadmap.md` — Flag expansion plan
- `GroveEngine/migrations/018_feature_flags.sql` — Database schema

---

*Document version: 1.0*
*Created: 2026-01-13*
*Author: Claude (AI-assisted planning)*
