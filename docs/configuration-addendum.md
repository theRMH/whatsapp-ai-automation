# Rabbot configuration addendum

Addendum to `whatsapp_personal_assistant_v1_prd.md`. Where this file and the PRD disagree, this file wins for the items listed under "Changes to the PRD". Owner decisions of 2026-10-26 are marked **Decision**.

## 1. Goal

Make Rabbot configurable enough to run as a SaaS: the owner (admin) controls system behaviour, plans control limits and features, and each user controls their own preferences (reminder and summary times, quiet hours, language, style) without a redeploy.

## 2. Decisions

1. **Plans.** Contents of plans are decided later, but the structure ships now: a `plans` table, a plan on every user, and entitlement keys that the code checks. One default plan exists at first. **Decision.**
2. **Settings page.** Users can change settings by chatting, and also through a link-based settings page opened from a one-time link sent on WhatsApp. **Decision.**
3. **Model choice.** The AI provider and model are admin-only. No per-user or per-plan model override in this version. **Decision.**

## 3. Three layers

Lookup order for any setting, first value found wins:

```text
user value  ->  plan value  ->  system value  ->  registry default
```

- **System**: set by the admin in the dashboard (the existing `system_settings` table).
- **Plan**: set by the admin per plan (`plan_settings`).
- **User**: set by the user (`user_settings`), only for keys marked user-editable.

A setting that is not user-editable ignores any user value, even if one is somehow stored. Safety and cost limits are never user-editable.

## 4. The settings registry

One file, `src/lib/settings/registry.ts`, defines every setting. Nothing reads a setting by a bare string.

Each entry:

```ts
{
  key: "summary.morning.time",        // dot-separated, unique
  type: "time",                       // string | int | bool | time | enum | duration | json
  default: "08:00",
  scopes: ["system", "plan", "user"], // layers allowed to set it
  userEditable: true,
  validate: z.string().regex(/^\d{2}:\d{2}$/),  // Zod, also gives min/max and allowed values
  group: "Summaries",
  label: "Morning summary time",
  help: "Local time of your morning summary.",
  secret: false,                      // secrets stay system-only and encrypted
  appliesTo: "future"                 // "future" or "immediate"
}
```

The admin screens are generated from the registry (labels, groups, validation, help). The existing `SettingsKeys` constants migrate into the registry; existing keys keep their names so stored data keeps working.

Resolver: `getEffectiveSetting(userId, key)` and `getEffectiveSettings(userId)`, with a short in-memory cache that is cleared when a value changes.

## 5. Settings catalogue

User-editable unless stated. Defaults are suggestions the owner can change.

### Time and language
| Key | Type | Default | Notes |
|---|---|---|---|
| `time.timezone` | IANA zone | owner default | Already on `users` |
| `time.week_start` | enum mon/sun | mon | |
| `time.working_hours` | json (days, start, end) | Mon-Fri 09:00-18:00 | Used by availability |
| `time.quiet_hours` | json (start, end) | 22:00-07:00 | Reminders held until quiet hours end |
| `time.morning` / `afternoon` / `evening` / `night` | time | existing | Meaning of "tomorrow morning" |
| `language.reply` | enum en / hinglish | en | Needs the product change below |

### Summaries
| Key | Type | Default |
|---|---|---|
| `summary.morning.enabled` / `summary.morning.time` | bool / time | on / 08:00 |
| `summary.evening.enabled` / `summary.evening.time` | bool / time | on / 19:00 |
| `summary.weekly.enabled` / `.day` / `.time` | bool / enum / time | off / sun / 18:00 |
| `summary.include` | set of tasks_due, overdue, calendar, reminders | all |
| `summary.weekdays_only` | bool | false |
| `summary.skip_when_empty` | bool | true |

### Reminders
| Key | Type | Default |
|---|---|---|
| `reminders.event_lead_times` | list of minutes | [60, 30] |
| `reminders.snooze_default_minutes` | int | 10 |
| `reminders.overdue_nudge_enabled` / `.interval_hours` | bool / int | off / 24 |
| `reminders.proactive_daily_cap` | int | 10 (admin max) |

### Calendar and tasks
| Key | Type | Default |
|---|---|---|
| `calendar.default_calendar` | string | primary |
| `calendar.default_meeting_minutes` | int | 30 |
| `calendar.buffer_minutes` | int | 0 |
| `tasks.default_classification` | enum personal / professional / auto | auto |
| `memory.auto_extract` | bool | true |

### Assistant style and privacy
| Key | Type | Default |
|---|---|---|
| `style.reply_length` | enum short / normal | short |
| `style.emoji` | bool | false |
| `safety.confirm_destructive` | enum always / ambiguous | always |
| `privacy.conversation_retention_days` | int, bounded by admin max | system value |
| `assistant.paused` | bool | false |

### Admin-only (system or plan)
| Key | Notes |
|---|---|
| `ai.provider`, `ai.api_base_url`, `ai.api_key`, `ai.primary_model`, `ai.fallback_model`, `ai.temperature`, `ai.max_output_tokens`, `ai.request_timeout_ms`, `ai.max_tool_iterations` | Existing. Admin only. **Decision: no user override.** |
| `limits.ai_requests_per_day`, `limits.inbound_per_minute`, `limits.max_memories`, `limits.max_reminders`, `limits.max_tasks` | System default, plan override |
| `features.calendar`, `features.sheets`, `features.documents`, `features.voice`, `features.summaries` | Plan entitlements (bool) |
| `trial.days`, messages, retention, Evolution and Google settings | Existing |

## 6. Plans

New tables:

```text
plans(id, key, name, is_default bool, sort_order, created_at)
plan_settings(plan_id, key, value_json)        -- overrides limits and features
users.plan_id -> plans.id                      -- non-null, defaults to the default plan
```

- One default plan is created by migration (`standard`), with no overrides, so behaviour is unchanged.
- The admin can create plans and edit their limits and features. The contents of real plans are decided later.
- Code asks `hasFeature(user, "features.calendar")` and `getLimit(user, "limits.ai_requests_per_day")`; it never reads a plan name.
- Billing is out of scope. `access_mode` and `status` keep working as in the PRD.

## 7. How users change settings

### 7.1 By chat
Two new tools, handled by code like every other tool:

- `SETTINGS_GET`: "what are my settings", "when is my morning summary".
- `SETTINGS_UPDATE`: "send my summary at 7:30", "no reminders after 10 pm". The AI proposes `{key, value}`; code validates it against the registry, shows the user the change in plain words, and applies it only after the user confirms (uses `pending_actions`). Keys that are not user-editable are refused with a polite reply.
- `SETTINGS_LINK`: "open my settings" sends the link below.

### 7.2 Link-based settings page
This is a product change: the PRD allows only short-lived Google connection pages. The settings page is another such page.

- Opened from a one-time link sent in WhatsApp, created like the Google connect links (`one_time_tokens`, purpose `settings`).
- The link is valid for 15 minutes and exchanges for a session cookie valid for 30 minutes, bound to the user. After that the user asks for a new link.
- The page lists only user-editable settings, grouped as in the catalogue, generated from the registry. Shows the effective value and whether it comes from the plan or system default.
- No customer content is shown. No login, no password.
- Every save is validated by the same Zod schema as chat, written to `user_settings`, and confirmed to the user on WhatsApp.
- CSRF protection on every form, `Cache-Control: no-store`, no third-party scripts, no settings visible in URLs.
- Works on a phone; large touch targets; plain language.

## 8. Scheduling that follows the settings

Summaries and event-lead reminders are scheduled per user, in the user's timezone, using the existing reminder engine:

- Each recurring item is a `task_series`/reminder row of kind `SUMMARY_MORNING`, `SUMMARY_EVENING`, `SUMMARY_WEEKLY` or `EVENT_LEAD`, with its next run materialised in `reminders` (same `unique_key` rules as the PRD).
- Changing a setting recalculates the next run immediately and cancels the old pending row.
- Quiet hours: a reminder due inside quiet hours is delivered at the end of quiet hours, unless the reminder is marked urgent by the user.
- Respect the daily proactive cap. Over the cap, summaries still send; nudges are dropped.
- Event-lead reminders are created when a calendar event is created, moved or read, and re-checked by the dispatcher so a missed webhook cannot lose them.
- All times are stored in UTC and computed from the user's timezone, including daylight-saving changes.

## 9. Audit and safety

- Table `settings_audit(id, actor_type user|admin|system, actor_id, scope, scope_id, key, old_json, new_json, at)`. Secret values are never written to it.
- Admin can view a user's effective settings and the history, never any message or note content.
- Admin changes to system or plan settings apply to future operations (as in the PRD) and are reversible from the audit view.
- Export: "export my settings" returns the user's stored settings. Deleting a user deletes their settings.
- Validation limits are enforced on the server for every write, regardless of source.

## 10. Changes to the PRD (explicit product changes)

| PRD item | Change |
|---|---|
| 4.2 excluded: customer web dashboard; 50 minimal customer pages | Add a short-lived, link-opened settings page (section 7.2) |
| 4.2 excluded: multilingual interaction | Allow reply language setting `en` and `hinglish` |
| 4.2 excluded: audio transcription | Allow voice-note transcription behind `features.voice` (provider chosen later, admin-configured) |
| 4.2 excluded: paid subscriptions | Plans and entitlements are added; payment stays excluded |
| 26 and 30 | Per-user overrides for the keys marked user-editable here; admin keeps system defaults |
| 28 AI settings | Unchanged, plus an explicit rule that models are admin-only |
| 85 non-negotiable rules | No change |

## 11. Tests

- Resolver: user over plan over system over default; non-editable keys ignore user values.
- Registry: every key has a default that passes its own validation.
- Chat settings: valid change needs confirmation; invalid, out-of-range or admin-only change is refused; unknown key is refused.
- Settings page: expired or reused link is refused; session expires; CSRF required; cannot read another user's settings.
- Scheduling: changing a summary time moves the next run; timezone and DST cases; quiet hours deferral; proactive cap.
- Cross-user privacy: user A cannot read or change B's settings through any route, tool or link (release blocker, as in PRD 79.4).
- Plans: a feature off in a plan blocks the tool and gives the system message; limit changes apply to the next call.

## 12. Build order

1. Registry, resolver, `user_settings`, `plans`, `plan_settings`, `settings_audit`; migrate existing keys; admin screens generated from the registry.
2. `SETTINGS_GET`, `SETTINGS_UPDATE`, `SETTINGS_LINK` tools and the settings page.
3. Scheduling of summaries and event-lead reminders from the settings.
4. Features that read the settings: calendar, notes and memory, voice, Hinglish.
5. Cost and usage per user in the admin dashboard (include cached tokens).
