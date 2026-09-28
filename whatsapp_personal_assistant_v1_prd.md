# WhatsApp Personal Assistant SaaS
## V1 Product Requirements Document and Build Specification

**Document status:** Build-ready V1 specification  
**Primary implementation target:** Next.js + Supabase + Evolution API + OpenRouter + Google APIs  
**Primary user interface:** WhatsApp only  
**Admin interface:** Private web dashboard for the product owner  
**Customer registration:** Manual allowlisting by admin only  
**Language:** English only in V1  
**Working product name:** WhatsApp Personal Assistant  
**Default timezone:** Asia/Kolkata, configurable globally and per user

---

# 1. Instructions to the Builder

This document is intended to be sufficient for an AI coding agent such as Claude to build the V1 product without requiring additional product clarification.

Treat the product decisions in this document as authoritative.

Do not add customer-facing dashboards, public signup, payment gateways, team workspaces, CRM pipelines, document AI/RAG, or permanent media storage unless explicitly described as part of V1.

The implementation must:

1. Be written in TypeScript.
2. Use Next.js App Router.
3. Use Supabase PostgreSQL as the primary database.
4. Use Supabase Auth only for the private admin dashboard.
5. Use Evolution API as the WhatsApp transport.
6. Use OpenRouter initially for AI, but hide it behind an AI provider abstraction.
7. Use Google OAuth for each authorized user's Google Calendar and Google Sheets access.
8. Use Supabase Cron / pg_cron plus pg_net for reminder dispatch instead of depending on Vercel Hobby Cron.
9. Keep all sensitive customer content encrypted at application level before persistence.
10. Never provide the admin dashboard with a feature to read customer conversations, tasks, memories, prospect details, documents, sheet content, or calendar content.
11. Never permanently store WhatsApp document/media binaries.
12. Keep Google Drive document storage outside V1.
13. Store only WhatsApp/Evolution media metadata and references for document recall.
14. Gracefully ask the user to resend a document if the historic media reference is no longer usable.
15. Avoid logging raw customer messages, AI prompts, sheet row contents, calendar descriptions, memories, or file contents.
16. Build migrations, tests, setup documentation, `.env.example`, and a production deployment guide.

When a third-party API varies by Evolution API version, isolate the implementation inside an adapter and do not spread version-specific URLs throughout the codebase.

---

# 2. Product Summary

The product is a private, multi-user personal assistant that users interact with entirely through WhatsApp.

The product owner manually adds authorized WhatsApp numbers from an admin dashboard. Only those numbers can use the assistant.

Each authorized user gets their own isolated:

- tasks
- due dates
- one-time reminders
- recurring reminders
- personal and professional classifications
- long-term assistant memory
- prospect/contact records
- recent conversational context
- WhatsApp document/media references
- Google Calendar connection
- Google Sheets connection/resources

The assistant accepts natural English. Users should not need to learn commands.

Examples:

- "Remind me tomorrow at 11 to call Arun."
- "Every Monday at 10 remind me to check the ad reports."
- "What do I have pending today?"
- "Move my 3 PM task to tomorrow morning."
- "Add a meeting with Ravi Friday at 4 for 45 minutes."
- "When am I free tomorrow afternoon?"
- "Cancel my meeting with Ravi."
- "Ravi is my accountant. Remember that."
- "Add Karthik from ABC Foods as a prospect. His number is 9876543210."
- "Who was the prospect from ABC Foods?"
- "Create a sheet called Expenses."
- "Add ₹4,500 for website hosting to Expenses."
- "Send me the proposal PDF I sent you last month."
- "What personal work is pending?"
- "Mark the Gramiyum report done."

No customer web dashboard is required.

The only customer-facing web pages are short-lived Google connection pages that cannot reasonably be completed inside WhatsApp.

---

# 3. Product Goals

## 3.1 Primary goals

V1 must provide a reliable WhatsApp-native assistant for individual users that can:

1. Capture tasks from natural language.
2. Track due dates.
3. Proactively send reminders.
4. Support recurring reminders.
5. Automatically classify information as Personal or Professional.
6. Automatically decide whether useful information should become long-term memory.
7. Store simple prospect details.
8. Provide complete day-to-day Google Calendar management.
9. Create and manage assistant-controlled Google Sheets.
10. Remember references to previously received WhatsApp files and resend them later when the original Evolution/WhatsApp media reference is still valid.
11. Keep each user's information isolated from every other user.
12. Give the owner operational control without exposing customer content.
13. Support trial periods that can be set globally or overridden per user.
14. Allow important integration settings, including Evolution API, to be changed from the admin dashboard.

## 3.2 Success criteria

V1 is successful when:

- an admin can add a phone number and the user can immediately use the assistant
- an unknown number cannot access AI or another user's data
- a user can create and manage tasks only by speaking naturally
- scheduled reminders arrive without the user needing to open the product
- recurring reminders continue reliably
- Calendar CRUD and availability queries work through WhatsApp
- Google Sheets entries can be created through WhatsApp
- the assistant can recall relevant structured memories across conversations
- a previously received file can be resent when its stored media reference is still usable
- expired media does not cause crashes or hidden file copying
- trial expiry disables the assistant without deleting user data
- the admin can configure and test Evolution API through the dashboard
- the admin cannot browse user content in the normal product UI
- logs contain no customer message bodies

---

# 4. Explicit V1 Scope Decisions

These decisions must not be changed during implementation without an explicit product change.

## 4.1 Included

- Individual users only
- Manual user creation by admin
- One shared assistant WhatsApp number
- User identity based on inbound WhatsApp sender number
- English natural language
- Personal and Professional automatic classification
- Tasks
- Due dates
- One-time reminders
- Snoozing/rescheduling reminders
- Recurring reminders
- Task completion
- Automatic memory selection
- Simple prospects
- Recent conversational context
- WhatsApp media/document reference recall
- Google OAuth
- Full Calendar operations needed for personal scheduling
- Assistant-created Google Sheets
- Reading/writing assistant-created Sheets
- Trial periods
- Admin system configuration
- Integration health/testing
- Privacy-focused storage and logging
- Usage counters and operational audit logs

## 4.2 Excluded

- Public signup
- WhatsApp registration flow
- OTP onboarding
- Customer web dashboard
- Teams
- Organizations
- Shared workspaces
- Multi-member company accounts
- Paid subscriptions
- Razorpay/Stripe
- CRM pipeline stages
- Sales pipeline management
- Lead scoring
- Google Drive document storage
- Supabase Storage for WhatsApp files
- S3
- Vercel Blob
- permanent media binary storage
- PDF/document reading
- OCR
- RAG over documents
- audio transcription
- multilingual interaction
- arbitrary existing spreadsheet schema understanding
- automated email
- mobile application
- public API
- workflow builder
- end-user configurable AI personality
- zero-knowledge cryptography claims

---

# 5. User Types

## 5.1 Admin

The admin is the product owner.

The admin can:

- sign into the admin dashboard
- add users
- edit user metadata
- set trial periods
- activate/suspend users
- set per-user timezone
- extend trials
- permanently delete a user and their database records
- see integration connection status
- see aggregate usage/counts
- configure Evolution API
- configure OpenRouter/AI
- configure Google OAuth
- configure reminder defaults
- configure user-facing system messages
- configure retention/privacy settings
- view operational errors that do not expose content
- test integrations

The admin must not be given UI functionality to inspect:

- message text
- task titles/details
- memory content
- prospect names/details
- file names/captions if considered customer content
- Calendar event contents
- Sheet contents
- Google OAuth tokens
- OpenRouter API key after saving
- Evolution API key after saving

Secrets should be masked after saving.

## 5.2 Authorized user

An authorized user is a phone number manually created by the admin.

The user has no product password and no web account.

WhatsApp sender identity is mapped to one internal user.

The user can:

- use all assistant functions through WhatsApp
- connect/disconnect Google through a short-lived secure URL
- manage tasks
- manage reminders
- manage Calendar
- manage assistant-created Sheets
- manage prospects
- tell the assistant to remember/forget information
- ask for automatically stored information
- resend remembered WhatsApp files when still available
- ask for help/status
- request Google reconnection when tokens expire

---

# 6. V1 Access Model

## 6.1 Manual allowlist only

The admin creates users.

Required user fields:

- name
- WhatsApp phone number
- timezone
- access mode
- trial dates/status

Example:

```text
Name: Ravi Kumar
Phone: +919876543210
Timezone: Asia/Kolkata
Access: Trial
Trial expires: 2026-10-25
Status: Active
```

Once created, the phone number is authorized.

There is no customer registration.

## 6.2 Unknown numbers

When an unknown number messages the assistant:

1. do not call the AI provider
2. do not create a user
3. do not create memory
4. do not store the raw message
5. optionally return the configured unauthorized-number response

Default response:

> This assistant is available only to authorized users. Please contact the administrator for access.

To prevent spam loops, return this at most once per unknown sender per configurable period, default 24 hours.

### 6.2.1 Unknown-sender cooldown storage

Track cooldowns in the `unknown_sender_replies` table (see 33.20).

- Key the row by `sender_hash = HMAC-SHA256(CONFIG_MASTER_KEY-derived key, normalized E.164 phone)`. Never store the plaintext phone number of an unknown sender.
- On an inbound message from an unknown number, atomically upsert: reply only if no row exists or `last_replied_at < now() - cooldown`, then set `last_replied_at = now()`. Use a single `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE ... RETURNING` statement so concurrent webhooks cannot both reply.
- Do not store message content, message count, or any other data about the unknown sender.
- The daily cleanup job deletes rows older than the cooldown period plus 1 day.
- If the admin later adds that number as a user, the stale row is harmless and ages out.

## 6.3 Suspended users

A suspended user receives a fixed configurable message.

No AI call is made.

No proactive reminders are sent while suspended.

## 6.4 Trial expiry

The global setting defines default trial length.

When admin creates a user, options are:

- use global default trial
- custom expiry date/time
- no expiry

When trial expires:

- inbound messages receive the configured expiry response
- no AI calls
- no Google actions
- no reminder delivery
- existing data is retained
- no catch-up reminder flood occurs after reactivation

If trial is extended/reactivated, future reminders resume. Missed reminders remain visible as missed/overdue but are not all sent immediately.

The same rule applies when a SUSPENDED user is reactivated. The exact MISSED rules are defined in section 13.6.

---

# 7. WhatsApp Experience

WhatsApp is the only normal end-user interface.

There are no slash commands required.

The assistant should reply in short, clear English.

Example:

**User**
> Remind me tomorrow at 11 to call Karthik about the proposal.

**Assistant**
> Added. I’ll remind you tomorrow at 11:00 AM to call Karthik about the proposal.

Example:

**User**
> What is pending today?

**Assistant**
> You have 3 pending items today:
> 1. Send Gramiyum report, 10:00 AM
> 2. Call Karthik, 11:00 AM
> 3. Review website changes, 4:00 PM

Example:

**User**
> Ravi is my accountant and he usually handles GST.

**Assistant**
> Noted.

The assistant should not expose internal intent names, JSON, model reasoning, database IDs, or tool calls.

---

# 8. Natural Language and AI Behavior

## 8.1 AI responsibilities

The AI may:

- understand intent
- extract structured fields
- classify Personal vs Professional
- decide whether information deserves long-term memory
- identify relevant tool operations
- interpret relative dates/times
- resolve references using recent context
- generate concise WhatsApp responses
- select relevant stored memories
- generate metadata/tags for received files based only on filename/caption/message metadata
- map natural language into Sheet row data

## 8.2 AI must not directly mutate external systems

The AI must never receive direct database credentials or integration secrets.

The AI returns structured tool requests.

Application code:

1. validates tool arguments with Zod
2. verifies user ownership
3. performs the operation
4. records the operational result
5. returns result to the AI or formats a deterministic reply
6. only then tells the user it succeeded

Never say "done" before the database/Calendar/Sheet/Evolution action actually succeeds.

## 8.3 Structured intent/tool layer

At minimum support these internal tool groups:

```text
TASK_CREATE
TASK_LIST
TASK_UPDATE
TASK_COMPLETE
TASK_CANCEL
TASK_SNOOZE

REMINDER_CREATE
REMINDER_RESCHEDULE
REMINDER_CANCEL
RECURRING_TASK_CREATE
RECURRING_TASK_UPDATE
RECURRING_TASK_CANCEL

CALENDAR_LIST
CALENDAR_SEARCH
CALENDAR_CREATE
CALENDAR_UPDATE
CALENDAR_DELETE
CALENDAR_AVAILABILITY
CALENDAR_CREATE_RECURRING
CALENDAR_SET_DEFAULT

MEMORY_CREATE
MEMORY_UPDATE
MEMORY_SEARCH
MEMORY_DELETE

PROSPECT_CREATE
PROSPECT_UPDATE
PROSPECT_SEARCH
PROSPECT_LIST
PROSPECT_DELETE

SHEET_CREATE
SHEET_LIST
SHEET_APPEND_ROW
SHEET_SEARCH_ROWS
SHEET_UPDATE_ROW
SHEET_GET_LINK
SHEET_UNLINK

DOCUMENT_SEARCH
DOCUMENT_RESEND

GOOGLE_CONNECT
GOOGLE_DISCONNECT
GOOGLE_STATUS

HELP
ACCOUNT_STATUS

PENDING_RESOLVE
```

The implementation may use a smaller set of generic tools, but all user capabilities above must be covered.

## 8.4 Multi-action messages

One message may create multiple actions.

Example:

> Ravi from ABC Foods is interested in a website. Save him as a prospect and remind me Friday at 11 to call him.

Required result:

1. create prospect
2. create task/reminder
3. link task to prospect if possible
4. reply with both outcomes

## 8.5 Ambiguity

Ask a short clarification only when a material action cannot be performed safely.

Examples:

- two Calendar events match "cancel my Ravi meeting"
- two documents match "send the proposal"
- user says "remind me Friday" but timezone/date cannot be resolved
- destructive action targets many records

Do not ask unnecessary questions when reasonable defaults exist.

## 8.6 Pending clarifications and confirmations

When the assistant asks the user to choose between candidates or to confirm a destructive action, the server must remember exactly what was offered. Do not rely on the AI re-deriving candidates from conversation text, because the underlying records may change between turns.

Store this state in the `pending_actions` table (see 33.21).

### 8.6.1 Creating a pending action

When a tool returns an ambiguous or confirmation-required result:

1. build a server-side payload containing:
   - `kind`: `CHOOSE_CANDIDATE` or `CONFIRM_DESTRUCTIVE`
   - the original tool name and validated arguments
   - an ordered list of candidates, each with an internal id (task id, Google event id, document id, sheet row reference, etc.) and a short display label
2. encrypt the payload with the user's DEK
3. insert a `pending_actions` row with `expires_at = now() + pending action TTL` (default 15 minutes, configurable)
4. at most one OPEN pending action per user: creating a new one marks any existing OPEN row `SUPERSEDED`
5. send the numbered list or confirmation question to the user

Only display labels go to the user. Internal ids never appear in WhatsApp messages or AI output.

### 8.6.2 Resolving a pending action

On the next inbound message, if the user has an OPEN, unexpired pending action:

1. include a safe summary in the AI context: the pending kind and the numbered display labels only, never internal ids
2. the AI may call `PENDING_RESOLVE` with `{ choice: <number> }` or `{ confirm: true | false }`, or ignore it if the user moved on
3. the server maps the number to the stored candidate id, re-validates ownership, re-checks that the target still exists, and executes the original tool with the stored arguments
4. mark the row `RESOLVED` (or `CANCELLED` if the user declined)
5. if the user sends an unrelated request, mark the row `SUPERSEDED` without executing anything

A pending action is resolved at most once. Claim it with a conditional update (`UPDATE ... SET status = 'RESOLVED' WHERE id = ? AND status = 'OPEN' AND expires_at > now()`) before executing, so duplicate webhooks cannot run it twice.

If the user replies after expiry:

> That request expired. Please ask again.

### 8.6.3 Scope

Use pending actions for:

- multiple matching tasks, reminders, recurring series, events, documents, prospects, memories, or sheet rows
- broad destructive actions (section 47)
- deleting an actual Google file
- adding a new sheet column that needs confirmation (section 21.3)
- past-time clarification such as "this Friday already passed, did you mean next Friday?" (section 9.1)

Add `PENDING_RESOLVE` to the tool list in 8.3.

---

# 9. Date and Time Rules

Every user has a timezone.

Default:

```text
Asia/Kolkata
```

Admin can change it per user.

The assistant may also understand:

> My timezone is Dubai.

and update it after confirming a valid IANA timezone.

All dates stored in PostgreSQL must be UTC `timestamptz`.

All natural-language interpretation and display must use the user's timezone.

## 9.1 Defaults

Configurable global defaults:

- date-only task reminder time: 09:00 local
- meeting duration when omitted: 30 minutes
- "morning": 09:00
- "afternoon": 15:00
- "evening": 19:00
- "night": 21:00

When the user provides an explicit time, always use it.

When a date/time resolves into the past and the phrase clearly implies a future occurrence, choose the next valid future occurrence.

Example:

If it is Friday 6 PM and the user says:

> Remind me Friday at 4.

Do not silently create a reminder in the past. Ask whether they mean next Friday, unless context makes it clear.

---

# 10. Personal vs Professional Classification

Every task, memory, prospect, and relevant note receives a `category`:

```text
PERSONAL
PROFESSIONAL
```

Classification is automatic.

Examples:

```text
"Pay electricity bill" -> PERSONAL
"Book dentist" -> PERSONAL
"Call client about quotation" -> PROFESSIONAL
"Send Meta ads report" -> PROFESSIONAL
```

Prospects default to PROFESSIONAL.

If genuinely ambiguous and category matters, ask:

> Should I keep this under Personal or Professional?

Users can correct categorization naturally:

> Move this to personal.

---

# 11. Tasks

## 11.1 Required task capabilities

Users can:

- create task
- create task with due date/time
- create task without due date
- list pending tasks
- list today's tasks
- list tomorrow's tasks
- filter personal/professional
- search by text/context
- change due date
- change category
- edit title/details
- complete task
- cancel/delete task
- snooze reminder
- create recurring task/reminder

## 11.2 Examples

```text
"Add send invoice as a task."
"Remind me tomorrow at 10 to send the invoice."
"What professional tasks are pending?"
"What's overdue?"
"Mark send invoice done."
"Move the invoice task to Monday afternoon."
"Remind me about it again in 2 hours."
```

## 11.3 Task statuses

Use:

```text
PENDING
COMPLETED
CANCELLED
```

Do not use a complex Kanban workflow in V1.

## 11.4 Overdue

A task is overdue when:

- status = PENDING
- due_at is not null
- due_at < current time

---

# 12. Recurring Tasks and Reminders

Users can say:

```text
"Every Monday at 10 remind me to check Meta reports."
"On the 1st of every month remind me to send invoices."
"Every day at 8 PM remind me to update expenses."
```

Use RFC 5545 compatible recurrence rules internally where practical.

Recommended library:

```text
rrule
```

Use a separate recurring series record rather than relying on the LLM each time.

The AI translates natural language to a validated recurrence definition once.

The application schedules occurrences deterministically.

## 12.1 Recurrence rules

Store:

- timezone
- RRULE
- encrypted title/details
- category
- active flag
- next_occurrence_at

Materialize individual task/reminder occurrences.

Enforce a uniqueness constraint so the same recurring occurrence cannot be generated twice.

## 12.2 Editing

Support:

```text
"Stop the Monday Meta reminder."
"Change it to Tuesday at 9."
```

If multiple recurring rules match, ask which one.

---

# 13. Reminder Engine

Reminders must work even if the user is not actively messaging.

Do not depend on Vercel Hobby Cron.

Use Supabase Cron / `pg_cron` and `pg_net`.

Recommended architecture:

```text
Supabase Cron
every minute
    |
    v
POST /api/internal/reminders/dispatch
    |
    v
Claim due reminders atomically
    |
    v
Evolution API
    |
    v
WhatsApp user
```

The internal endpoint must require a strong `INTERNAL_CRON_SECRET`.

## 13.1 Reminder states

```text
PENDING
PROCESSING
SENT
FAILED
CANCELLED
MISSED
```

## 13.2 Claiming

Use a PostgreSQL function/RPC using row locking such as:

```sql
FOR UPDATE SKIP LOCKED
```

to prevent duplicate delivery when multiple requests overlap.

## 13.3 Retries

Default configurable policy:

- attempt 1 immediately
- retry after 1 minute
- retry after 5 minutes
- retry after 15 minutes
- then mark FAILED

Do not expose message content in retry logs.

## 13.4 Trial/access validation

Before sending:

- user exists
- user is active
- trial is valid or no-expiry
- reminder is still active
- task not cancelled

If not eligible, do not send.

## 13.5 Recurrence materialization

Each cron pass should also ensure upcoming recurring occurrences are materialized.

The materialization operation must be idempotent.

Materialize only occurrences from `now()` forward. Never back-fill occurrences that fell inside a period when the user was ineligible or the dispatcher was down; advance `next_occurrence_at` past them.

## 13.6 MISSED reminders

A reminder becomes `MISSED` when it can no longer be delivered usefully. It is never sent after being marked MISSED.

Configurable setting:

```text
Missed reminder grace period: 60 minutes (default)
```

Rules:

1. **Stale at claim time.** `claim_due_reminders` marks a PENDING reminder `MISSED` instead of claiming it when `scheduled_at < now() - grace period`. This covers dispatcher outages, cron downtime, and backlog.
2. **Ineligible user at due time.** When the dispatcher finds a due reminder whose user is SUSPENDED or trial-expired, it leaves it PENDING. Rule 1 turns it MISSED once the grace period passes. The reminder is therefore sent if access is restored within the grace period, and never flooded afterwards.
3. **Retries past grace.** A FAILED-retryable reminder whose next retry would fall later than `scheduled_at + grace period` is marked FAILED (final) rather than retried.
4. **Cancelled/completed task.** Reminders for a task that is COMPLETED or CANCELLED are marked `CANCELLED`, not MISSED.

MISSED reminders do not change their task. The task stays PENDING and shows as overdue in "What's overdue?" responses.

On reactivation (trial extended, user unsuspended), the admin action does not send anything. Future reminders resume through the normal dispatcher.

Optionally, on the user's first inbound message after reactivation, the assistant may mention the number of overdue tasks in one line. It must not list them unless asked.

---

# 14. Snooze and Reschedule

Example:

**Assistant**
> Reminder: Call Ravi about the website proposal.

**User**
> Remind me again in 2 hours.

Create a new reminder tied to the same task.

Example:

> Move this to tomorrow at 11.

Update the task due time and pending reminder.

Recent conversation context is used to determine what "this" means.

---

# 15. Long-Term Memory

## 15.1 Goal

The assistant automatically decides whether conversational information is valuable enough to retain.

Examples worth remembering:

- relationships
- role information
- recurring preferences
- business facts
- important personal preferences
- frequently referenced people
- user-specific terminology

Examples:

```text
"Ravi is my accountant."
"Gramiyum is one of my clients."
"I prefer meetings after 11 AM."
"My daughter's school is X."
```

Do not store low-value conversational filler such as:

```text
"Thanks."
"Okay."
"Good morning."
```

## 15.2 User control

Users can explicitly say:

```text
"Remember that..."
"Forget that..."
"What do you remember about Ravi?"
```

Automatic memory does not override explicit user deletion.

## 15.3 Memory fields

Conceptually:

- user_id
- type
- category
- encrypted content
- importance
- created_at
- updated_at
- last_used_at

Recommended types:

```text
PERSON
PREFERENCE
WORK_FACT
PERSONAL_FACT
REFERENCE
OTHER
```

## 15.4 Retrieval

Do not require a vector database in V1.

For each user:

1. load a bounded set of their memories
2. decrypt server-side
3. score locally using token overlap/entity match/recency
4. send only the top relevant memories to the AI

Initial cap:

```text
500 active memories per user
```

When the cap is approached, deduplicate/update old memories before creating more.

Do not send every memory to the AI on every turn.

---

# 16. Recent Conversation Context

Natural multi-turn interaction requires recent context.

Example:

```text
User: Remind me to call Ravi tomorrow at 10.
Assistant: Added.
User: Actually make it 11.
```

The assistant must understand what "it" refers to.

Store a small encrypted rolling context, not an unlimited permanent chat archive.

Default configurable policy:

```text
maximum recent turns per user: 40
retention: 7 days
```

A cleanup job deletes expired conversation turns.

The admin dashboard only shows counts, never message text.

Do not persist entire raw Evolution webhook payloads.

---

# 17. Prospects

V1 includes a simple prospect book, not a CRM.

## 17.1 Prospect fields

- id
- user_id
- name
- company
- phone
- email
- notes
- tags if useful
- created_at
- updated_at

Sensitive fields are encrypted.

No required pipeline stage.

No sales Kanban.

No scoring.

## 17.2 Examples

```text
"Add Ravi from ABC Foods as a prospect."
"Ravi's phone is 9876543210."
"Add a note that he needs a Shopify website."
"Who was the prospect from ABC Foods?"
"Show my prospects."
"Delete Ravi from prospects."
```

If the user mentions a follow-up date:

> Add Ravi as a prospect and remind me Friday at 11 to call him.

Create a normal linked task/reminder.

---

# 18. WhatsApp Documents and Media References

This section is mandatory and must be implemented exactly.

## 18.1 No file storage

V1 must never permanently store inbound WhatsApp media binaries.

Do not use:

- Supabase Storage
- S3
- Google Drive as a backup
- Vercel Blob
- local persistent disk
- database base64 blobs
- any hidden backup bucket

The product deliberately relies on the historic Evolution API / WhatsApp media reference or URL.

## 18.2 What may be stored

For an inbound document/media message, store only metadata/reference information such as:

- internal document id
- user_id
- Evolution message id/key/reference
- remote JID if required for replay
- media URL/reference returned by Evolution
- media type
- MIME type
- original filename
- caption
- user message text associated with it
- AI-generated tags based only on filename/caption/message metadata
- received_at
- last replay attempt status

Sensitive metadata and URLs/references must be encrypted.

Never store the binary.

Never store base64.

## 18.3 Supported media recall

At minimum support reference recall for:

- document
- image

If the configured Evolution version makes the same mechanism reliable for video/audio, the adapter may support them too, but no transcription or content understanding is required.

## 18.4 Automatic indexing

When an authorized user sends a document:

1. parse metadata from the Evolution webhook
2. store encrypted reference metadata
3. optionally generate small search tags from filename/caption only
4. do not download for storage
5. acknowledge the reference

Example:

> Got it. I can resend `ABC-Proposal.pdf` later while the WhatsApp media reference remains available.

Do not promise permanent availability.

## 18.5 Retrieval

Example:

> Send me the ABC proposal I sent last month.

Process:

1. search only this user's stored media metadata
2. resolve date/name/caption/tag match
3. if one strong match, attempt replay
4. if several matches, ask user to choose
5. use Evolution adapter to forward/resend from historic message reference when supported
6. otherwise use stored media URL/reference with Evolution's media send endpoint
7. do not create a permanent local copy

Transient network handling that is technically required to pass a file through an API is permitted, but no binary may be persisted or cached beyond request processing.

## 18.6 Expired or broken media

Historic WhatsApp/Evolution media links may expire.

This is an accepted V1 limitation.

If the file cannot be retrieved/replayed:

1. mark the reference status as `UNAVAILABLE`
2. do not search external storage
3. do not reconstruct the file
4. tell the user:

> I found the old file reference, but WhatsApp can no longer provide the file. Please resend it and I’ll remember the new reference.

This behavior is a required acceptance criterion.

## 18.7 Adapter requirement

Create a method conceptually similar to:

```ts
resendStoredMedia(user, documentReference): Promise<Result>
```

The Evolution adapter should try capabilities in a version-safe order:

1. direct forward/replay by message key if supported by the deployed Evolution version
2. send media using the saved Evolution/WhatsApp URL/reference if supported
3. return a typed `MEDIA_REFERENCE_UNAVAILABLE` error

Evolution-version-specific endpoint logic belongs only inside the adapter.

---

# 19. Google Connection

Each authorized user may connect their own Google account.

No admin Google account is shared across customers.

## 19.1 Connection trigger

User:

> Connect Google.

Assistant creates a one-time secure URL:

```text
https://app.example.com/connect/google?t=<opaque-token>
```

Token requirements:

- random
- stored hashed
- tied to user_id
- purpose-specific
- expires in 10 minutes by default
- one-time use
- cannot contain raw user data that can be modified client-side

## 19.2 OAuth

The connection page begins Google OAuth.

After successful callback:

- exchange authorization code
- securely store encrypted refresh token
- encrypted access token if stored
- token expiry
- connected Google email, encrypted
- granted scopes
- connection status

Then show:

```text
Google connected successfully.
You can return to WhatsApp.
```

Also send a WhatsApp confirmation.

## 19.3 Recommended scopes

Request the smallest practical set needed for V1.

Calendar:

```text
openid
email
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.freebusy
https://www.googleapis.com/auth/calendar.calendarlist.readonly
```

Sheets/files created or explicitly used by the app:

```text
https://www.googleapis.com/auth/drive.file
```

Do not request broad `drive` or `drive.readonly` in V1.

Do not request Gmail.

## 19.4 Disconnect

User:

> Disconnect Google.

Delete/revoke locally stored Google tokens.

Attempt Google token revocation where appropriate.

Keep local tasks/memories/prospects.

Mark Calendar/Sheet integrations disconnected.

---

# 20. Google Calendar

"Full Calendar" in V1 means complete assistant scheduling for normal personal/business usage, not Calendar administration/sharing ACL management.

## 20.1 Required capabilities

- connect Google
- list upcoming events
- search events
- create event
- update event
- move event
- change duration
- change title
- change description
- change location
- delete/cancel event
- create recurring event
- update recurring event when clearly requested
- check free/busy
- answer availability questions
- list accessible calendars
- choose default calendar
- optionally add attendees when explicit email addresses are supplied
- handle timezone correctly

## 20.2 Examples

```text
"What do I have tomorrow?"
"Add a meeting with Ravi Friday at 3."
"Make it one hour."
"Move Ravi's meeting to Monday at 11."
"Cancel tomorrow's meeting with Karthik."
"When am I free tomorrow afternoon?"
"Block every Friday from 4 to 5 for weekly review."
"Use my Work calendar as default."
```

## 20.3 Defaults

Default event duration:

```text
30 minutes
```

Admin-configurable.

Default calendar:

```text
primary
```

User may change by natural language.

## 20.4 Ambiguous event matching

Never cancel or modify the wrong event.

If more than one candidate reasonably matches, respond with a short numbered list including:

- title
- date
- time

and ask the user to choose.

## 20.5 Google unavailable

If token is invalid or revoked:

> Your Google connection needs to be refreshed. Reply "connect Google" to reconnect.

Do not repeatedly retry a revoked token.

---

# 21. Google Sheets

V1 supports simple assistant-managed Sheets.

The goal is not to understand arbitrary established business spreadsheets.

## 21.1 Supported V1 model

The preferred V1 workflow is:

```text
User asks assistant to create a Sheet
        |
        v
App creates Google Sheet in user's account
        |
        v
App stores spreadsheet reference
        |
        v
User adds/reads/updates rows through WhatsApp
```

These are blank sheets created/managed by the assistant.

Arbitrary pre-existing, populated Sheets are outside V1.

This avoids requiring whole-Drive access.

## 21.2 Examples

```text
"Create a sheet called Expenses."
"Create a sheet called Lead List."
"Add ₹4500, hosting renewal, today to Expenses."
"Add Ravi, ABC Foods, 9876543210 to Lead List."
"Show my latest 10 expense entries."
"Update Ravi's phone number in Lead List."
"Send me the Expenses sheet link."
```

## 21.3 Schema behavior

A new spreadsheet starts blank.

On the first structured row insertion:

1. AI returns a field/value object
2. backend validates values
3. backend creates headers from field names
4. backend writes the first row
5. store the encrypted schema metadata

Example first row:

```json
{
  "date": "2026-09-25",
  "description": "Hosting renewal",
  "amount": 4500
}
```

Sheet becomes:

```text
Date | Description | Amount
```

If a later row includes a new field:

- if it is clearly useful and safe, append a new column
- otherwise ask for confirmation

Do not silently rename/remove existing columns.

## 21.4 Supported operations

- create spreadsheet
- list assistant-managed spreadsheets
- append row
- read bounded ranges
- search/filter rows
- update a matched row
- return sheet URL
- unlink sheet from assistant

Deleting an actual Google file must require an explicit request plus confirmation.

## 21.5 Safety limits

Default maximum rows read into one assistant operation:

```text
500
```

Configurable.

For larger sheets, paginate/filter through API rather than sending the entire sheet to the AI.

## 21.6 Out of scope

- charts
- formulas
- macros
- formatting automation
- Apps Script
- pivot tables
- arbitrary existing sheet schema understanding
- full Drive listing
- bulk analytics platform

---

# 22. Admin Dashboard

The admin dashboard is required even though users do not have dashboards.

Use a clean responsive web interface.

Recommended routes:

```text
/admin
/admin/users
/admin/users/[id]
/admin/settings/general
/admin/settings/evolution
/admin/settings/ai
/admin/settings/google
/admin/settings/reminders
/admin/settings/privacy
/admin/operations
```

---

# 23. Admin Authentication

Use Supabase Auth.

V1 may have one admin, but schema should allow multiple admins later.

No public admin signup page.

Admin accounts are created through secure bootstrap/seed instructions.

Recommended:

- Supabase email/password or magic link
- `admins` table tied to `auth.users.id`
- middleware protecting `/admin/*`
- server-side authorization on every admin action

Never rely only on hidden navigation.

---

# 24. Admin Dashboard: Overview

Show operational metadata only:

```text
Total users
Active users
Trial users
Expired users
Suspended users
Google connected count
Messages processed today
AI requests today
Reminders sent today
Reminder failures
Evolution connection status
Google OAuth configuration status
AI configuration status
```

Do not show recent user messages.

Do not show "latest conversations."

Do not show task names.

---

# 25. Admin Dashboard: User Management

## 25.1 Users list

Columns:

- name
- masked phone
- status
- access type
- trial expiry
- timezone
- Google connected yes/no
- last active
- task count
- memory count
- prospect count
- document reference count
- created date

Counts are acceptable. Content is not.

## 25.2 Add user

Fields:

```text
Name
WhatsApp phone number
Timezone
Status
Trial option:
    Use default
    Custom end date
    No expiry
```

Normalize and validate phone to E.164.

Phone must be unique.

## 25.3 Edit user

Admin can:

- change display name
- correct phone number
- change timezone
- activate
- suspend
- change trial expiry
- switch to no-expiry
- delete account/data

If phone number is changed, future WhatsApp identity uses the new number.

## 25.4 Delete user

Require confirmation.

Deletion should remove:

- tasks
- reminders
- recurrence series
- memories
- prospects
- recent conversation context
- document references
- sheet references
- Google tokens
- per-user encryption key record
- usage details where privacy requires

Operational audit records may retain a pseudonymous user id and action timestamp but no content.

---

# 26. Admin Dashboard: General Settings

Configurable:

```text
Assistant display name
Default timezone
Default trial days
Unauthorized-number response
Expired-trial response
Suspended-user response
Generic system error response
Default date-only reminder time
Default meeting duration
Morning time
Afternoon time
Evening time
Night time
Unknown number reply cooldown
Maximum AI requests/user/day
Maximum inbound messages/user/minute
Pending action (clarification/confirmation) TTL
Inbound job timeout
Stale inbound job cutoff
```

Defaults should be sensible.

Changes apply to future operations, not retroactively unless clearly appropriate.

---

# 27. Admin Dashboard: Evolution API Settings

Evolution API must be configurable from the dashboard.

Do not hardcode deployment-specific Evolution values in source files.

## 27.1 Settings

At minimum:

```text
Enabled
Base URL
API key
Instance name
Assistant WhatsApp number
Request timeout
Webhook route secret/token
Webhook mode
Messages event name/mapping if required
Media replay strategy setting: AUTO
```

Secrets:

- API key
- webhook secret

must be encrypted at rest and masked in the UI.

After saving, display:

```text
API Key: ••••••••••••abcd
```

Never return the complete saved secret to the browser again.

## 27.2 Actions

Admin must have buttons for:

```text
Test API connection
Check instance status
Configure/update webhook
Verify webhook configuration
Send test text message
```

For test send, admin enters a destination number and harmless test text.

Do not save test message content in logs.

## 27.3 Webhook events

At minimum listen for:

```text
MESSAGES_UPSERT
CONNECTION_UPDATE
MESSAGES_UPDATE
```

The adapter should normalize variations such as event naming style where possible.

Only `MESSAGES_UPSERT` needs to enter the AI message pipeline.

## 27.4 Evolution adapter

Create a dedicated interface, for example:

```ts
interface WhatsAppProvider {
  getConnectionStatus(): Promise<ConnectionStatus>;
  configureWebhook(url: string): Promise<void>;
  sendText(to: string, text: string): Promise<SendResult>;
  sendMedia(to: string, media: MediaSendInput): Promise<SendResult>;
  resendStoredMedia(to: string, ref: StoredMediaReference): Promise<SendResult>;
  normalizeInbound(payload: unknown): NormalizedInboundEvent;
}
```

All Evolution endpoint construction belongs in this adapter.

---

# 28. Admin Dashboard: AI Settings

V1 provider:

```text
OpenRouter
```

But implement a provider abstraction.

## 28.1 Configurable fields

```text
Provider
API base URL
API key
Primary model
Fallback model
Temperature
Maximum output tokens
Request timeout
Maximum tool iterations
Enable fallback model
```

Recommended default temperature:

```text
0.1
```

The actual default model should be configured at deployment time rather than hardcoded as a permanent product assumption.

## 28.2 Test action

Button:

```text
Test AI connection
```

Send a harmless fixed prompt such as:

```text
Return the word OK as JSON.
```

Do not use customer content.

## 28.3 Provider interface

Example:

```ts
interface AIProvider {
  runAssistant(input: AssistantInput): Promise<AssistantDecision>;
  healthCheck(): Promise<HealthResult>;
}
```

OpenRouter implementation may use the OpenAI-compatible SDK/API.

---

# 29. Admin Dashboard: Google Settings

Configurable:

```text
Google integration enabled
OAuth Client ID
OAuth Client Secret
Google Cloud Project Number / App ID if needed
Public API key if Google Picker is added later
OAuth callback URL (read-only generated value)
Calendar enabled
Sheets enabled
```

OAuth client secret must be encrypted and masked.

The exact OAuth scopes are code-controlled and displayed for transparency, not freely editable by the admin.

Provide:

```text
Validate configuration
```

This should check whether required values exist and whether OAuth start can be generated. Do not attempt to access a user's Google data from the admin configuration test.

---

# 30. Admin Dashboard: Reminder Settings

Configurable:

```text
Dispatcher enabled
Batch size
Max retry attempts
Retry delays
Default date-only reminder time
Missed reminder grace period
Cron health threshold
```

Display:

```text
Last dispatcher run
Last successful send
Pending reminders count
Failed reminders count
Missed reminders count (last 7 days)
```

Do not display reminder titles.

---

# 31. Admin Dashboard: Privacy and Retention

Configurable:

```text
Recent conversation retention days
Maximum recent turns/user
Maximum active memories/user
Document reference retention: indefinite by default
Operational log retention days
Usage data retention days
```

Important fixed rule:

```text
WhatsApp binary storage = DISABLED
```

Show this as informational, not a toggle.

Do not create a dashboard switch that can silently enable media storage in V1.

---

# 32. Admin Dashboard: System Messages

Allow admin to edit fixed non-AI messages:

- unauthorized sender
- suspended account
- expired trial
- generic failure
- Google reconnect required
- media reference unavailable
- integration disabled
- rate limit reached
- pending request expired

This lets product copy change without redeployment.

---

# 33. Database Design

Use UUID primary keys unless otherwise stated.

Use `timestamptz`.

Create SQL migrations in version control.

The schema below is conceptual but should be implemented closely.

---

## 33.1 `admins`

```text
id uuid PK -> auth.users.id
email text
created_at timestamptz
```

---

## 33.2 `users`

```text
id uuid PK
name text
phone_e164 text UNIQUE NOT NULL
phone_jid text NULL
timezone text NOT NULL
status text NOT NULL
access_mode text NOT NULL
trial_start_at timestamptz NULL
trial_end_at timestamptz NULL
last_active_at timestamptz NULL
created_at timestamptz
updated_at timestamptz
```

Allowed `status`:

```text
ACTIVE
SUSPENDED
```

Allowed `access_mode`:

```text
TRIAL
NO_EXPIRY
```

Expired is derived from `trial_end_at`, not manually duplicated unless needed for reporting.

---

## 33.3 `user_keys`

```text
user_id uuid PK/FK
encrypted_dek text NOT NULL
key_version integer NOT NULL
created_at timestamptz
rotated_at timestamptz NULL
```

---

## 33.4 `system_settings`

```text
key text PK
value_json jsonb NULL
encrypted_secret text NULL
is_secret boolean NOT NULL
updated_at timestamptz
updated_by uuid NULL
```

Never store a secret both in plaintext and encrypted form.

---

## 33.5 `processed_messages`

For webhook idempotency.

```text
message_id_hash text PK
user_id uuid NULL
event_type text
status text
processed_at timestamptz
```

No raw body.

---

## 33.6 `conversation_turns`

```text
id uuid PK
user_id uuid FK
direction text
content_enc text
message_id_hash text NULL
created_at timestamptz
expires_at timestamptz
```

Directions:

```text
INBOUND
OUTBOUND
```

---

## 33.7 `tasks`

```text
id uuid PK
user_id uuid FK
series_id uuid NULL
prospect_id uuid NULL
title_enc text NOT NULL
details_enc text NULL
category text NOT NULL
status text NOT NULL
due_at timestamptz NULL
has_explicit_time boolean DEFAULT true
completed_at timestamptz NULL
cancelled_at timestamptz NULL
source_message_id_hash text NULL
created_at timestamptz
updated_at timestamptz
```

Index:

```text
(user_id, status, due_at)
```

---

## 33.8 `task_series`

```text
id uuid PK
user_id uuid FK
title_enc text NOT NULL
details_enc text NULL
category text NOT NULL
rrule text NOT NULL
timezone text NOT NULL
active boolean NOT NULL
next_occurrence_at timestamptz NOT NULL
created_at timestamptz
updated_at timestamptz
```

---

## 33.9 `reminders`

```text
id uuid PK
user_id uuid FK
task_id uuid NULL
series_id uuid NULL
scheduled_at timestamptz NOT NULL
status text NOT NULL
attempts integer NOT NULL DEFAULT 0
next_attempt_at timestamptz NULL
sent_at timestamptz NULL
last_error_code text NULL
unique_key text UNIQUE NOT NULL
created_at timestamptz
updated_at timestamptz
```

Index:

```text
(status, next_attempt_at)
(user_id, scheduled_at)
```

### 33.9.1 `unique_key` format

`unique_key` makes reminder creation idempotent. It contains only ids and timestamps, never content. Formats:

```text
Recurring occurrence:  series:<series_id>:<occurrence_utc_iso>
Task reminder:         task:<task_id>:v<revision>
Snooze:                snooze:<task_id>:<source_message_id_hash>
Standalone reminder:   msg:<source_message_id_hash>:<index>
```

Rules:

- **Recurring occurrence.** `occurrence_utc_iso` is the rrule-computed occurrence start in UTC, second precision (for example `2026-10-05T03:30:00Z`). Re-running materialization produces the same key, so the insert uses `ON CONFLICT (unique_key) DO NOTHING`.
- **Task reminder.** A task has at most one active (PENDING/PROCESSING) primary reminder. `revision` is an integer on the task, starting at 1, that increments whenever the task's due time is rescheduled. Rescheduling cancels the existing PENDING reminder and inserts a new one with the next revision, in one transaction.
- **Snooze.** Keyed by the inbound message that requested the snooze, so a duplicate webhook delivery cannot create two snoozes. Snoozing a task with an active reminder cancels that reminder first.
- **Standalone reminder.** For reminders created without a task (if the implementation allows it). `index` is the 0-based position of the reminder among those created by the same message, which supports multi-action messages.
- Reminders created by internal jobs without a source message use `job:<uuid>`.

Add to `tasks`:

```text
reminder_revision integer NOT NULL DEFAULT 1
```

Enforce at most one active primary reminder per task with a partial unique index:

```sql
CREATE UNIQUE INDEX reminders_one_active_per_task
  ON reminders (task_id)
  WHERE status IN ('PENDING', 'PROCESSING') AND task_id IS NOT NULL;
```

---

## 33.10 `memories`

```text
id uuid PK
user_id uuid FK
memory_type text NOT NULL
category text NOT NULL
content_enc text NOT NULL
importance smallint NOT NULL DEFAULT 5
created_at timestamptz
updated_at timestamptz
last_used_at timestamptz NULL
```

No plaintext content index.

---

## 33.11 `prospects`

```text
id uuid PK
user_id uuid FK
name_enc text NOT NULL
company_enc text NULL
phone_enc text NULL
email_enc text NULL
notes_enc text NULL
tags_enc text NULL
created_at timestamptz
updated_at timestamptz
```

No CRM pipeline stage required.

---

## 33.12 `document_references`

```text
id uuid PK
user_id uuid FK
media_type text NOT NULL
mime_type text NULL
filename_enc text NULL
caption_enc text NULL
tags_enc text NULL
media_reference_enc text NULL
media_url_enc text NULL
evolution_message_key_enc text NULL
source_message_id_hash text NULL
received_at timestamptz NOT NULL
last_replay_attempt_at timestamptz NULL
availability_status text NOT NULL DEFAULT 'UNKNOWN'
replaces_document_id uuid NULL
created_at timestamptz
updated_at timestamptz
```

Allowed availability:

```text
UNKNOWN
AVAILABLE
UNAVAILABLE
```

No blob column.

No base64 column.

---

## 33.13 `google_connections`

```text
id uuid PK
user_id uuid UNIQUE FK
google_email_enc text NULL
access_token_enc text NULL
refresh_token_enc text NOT NULL
token_expiry_at timestamptz NULL
scopes text[] NOT NULL
status text NOT NULL
created_at timestamptz
updated_at timestamptz
```

Statuses:

```text
CONNECTED
REAUTH_REQUIRED
DISCONNECTED
```

---

## 33.14 `calendar_preferences`

```text
user_id uuid PK/FK
default_calendar_id_enc text NULL
updated_at timestamptz
```

Default to `primary` if unset.

---

## 33.15 `managed_sheets`

```text
id uuid PK
user_id uuid FK
spreadsheet_id_enc text NOT NULL
title_enc text NOT NULL
spreadsheet_url_enc text NULL
schema_enc text NULL
status text NOT NULL
created_at timestamptz
updated_at timestamptz
```

Status:

```text
ACTIVE
UNLINKED
DELETED
```

---

## 33.16 `one_time_tokens`

```text
id uuid PK
user_id uuid FK
purpose text NOT NULL
token_hash text UNIQUE NOT NULL
expires_at timestamptz NOT NULL
used_at timestamptz NULL
created_at timestamptz
```

---

## 33.17 `usage_daily`

```text
id uuid PK
user_id uuid FK
usage_date date NOT NULL
inbound_messages integer DEFAULT 0
outbound_messages integer DEFAULT 0
ai_requests integer DEFAULT 0
ai_input_tokens integer DEFAULT 0
ai_output_tokens integer DEFAULT 0
google_requests integer DEFAULT 0
reminders_sent integer DEFAULT 0
created_at timestamptz
updated_at timestamptz
UNIQUE(user_id, usage_date)
```

---

## 33.18 `operational_events`

```text
id uuid PK
user_id uuid NULL
integration text NOT NULL
event_type text NOT NULL
status text NOT NULL
error_code text NULL
latency_ms integer NULL
safe_metadata jsonb NULL
created_at timestamptz
```

`safe_metadata` must never contain customer message text or content.

---

## 33.19 `admin_audit_logs`

```text
id uuid PK
admin_id uuid FK
action text NOT NULL
target_user_id uuid NULL
safe_metadata jsonb NULL
created_at timestamptz
```

Examples:

```text
USER_CREATED
USER_SUSPENDED
TRIAL_EXTENDED
EVOLUTION_SETTINGS_UPDATED
GOOGLE_SETTINGS_UPDATED
```

Never store secret values in audit metadata.

---

## 33.20 `unknown_sender_replies`

Cooldown tracking for unauthorized senders (see 6.2.1).

```text
sender_hash text PK          -- HMAC of normalized E.164 phone, never plaintext
last_replied_at timestamptz NOT NULL
```

No other columns. No message data.

---

## 33.21 `pending_actions`

Open clarifications and confirmations (see 8.6).

```text
id uuid PK
user_id uuid FK
kind text NOT NULL                -- CHOOSE_CANDIDATE | CONFIRM_DESTRUCTIVE
payload_enc text NOT NULL         -- tool name, validated args, candidate ids + labels
status text NOT NULL              -- OPEN | RESOLVED | CANCELLED | SUPERSEDED | EXPIRED
source_message_id_hash text NULL
expires_at timestamptz NOT NULL
resolved_at timestamptz NULL
created_at timestamptz
```

Index / constraint:

```sql
CREATE UNIQUE INDEX pending_actions_one_open_per_user
  ON pending_actions (user_id) WHERE status = 'OPEN';
```

The daily cleanup deletes non-OPEN rows older than 24 hours and marks expired OPEN rows `EXPIRED`.

---

## 33.22 `rate_limit_windows`

Fixed-window counters (see 45.1).

```text
user_id uuid FK
bucket text NOT NULL              -- e.g. inbound_msg
window_start timestamptz NOT NULL
count integer NOT NULL DEFAULT 0
PRIMARY KEY (user_id, bucket, window_start)
```

---

## 33.23 `inbound_jobs`

Short-lived work queue for async message processing (see 36.2).

```text
id uuid PK
user_id uuid FK
message_id_hash text UNIQUE NOT NULL
payload_enc text NULL             -- normalized message, nulled after completion
status text NOT NULL              -- QUEUED | PROCESSING | DONE | FAILED
attempts integer NOT NULL DEFAULT 0
side_effects_started boolean NOT NULL DEFAULT false
locked_until timestamptz NULL
last_error_code text NULL
received_at timestamptz NOT NULL
created_at timestamptz
updated_at timestamptz
```

Index:

```text
(user_id, status, received_at)
(status, locked_until)
```

Never store the raw webhook body.

---

# 34. Encryption Model

## 34.1 Objective

The admin product interface must not expose customer content, and direct database browsing should not reveal sensitive user content in plaintext.

This is privacy-by-architecture, not a claim of mathematically zero-knowledge hosting.

Because the application server must decrypt content to perform AI/Calendar/Sheet operations, a sufficiently privileged infrastructure operator who controls application code and master keys could technically modify the software to capture plaintext.

Do not market V1 as "even the company can never technically access your content."

## 34.2 Encryption

Use application-level AES-256-GCM.

Each user gets a random 256-bit Data Encryption Key (DEK).

The user's DEK is encrypted by an application Key Encryption Key (KEK/master key).

The master key is an environment secret and is never stored in Supabase.

Flow:

```text
APP_MASTER_KEY
    |
decrypt
    v
User DEK
    |
encrypt/decrypt
    v
User sensitive fields
```

Every encrypted value must have authenticated encryption and include nonce/IV and auth tag in a versioned serialization format.

Example serialized structure:

```text
v1:<iv-base64>:<ciphertext-base64>:<tag-base64>
```

Use Node's `crypto` module.

Do not invent custom cryptography.

## 34.3 System integration secrets

Evolution API key, OpenRouter key, Google OAuth client secret and similar configuration secrets must also be encrypted before database storage using a dedicated config encryption utility.

---

# 35. Supabase Security

Users never connect directly to Supabase from WhatsApp.

All customer data access goes through server-side Next.js code.

The Supabase service role key:

- server only
- never browser bundle
- never admin page source
- never logs

Enable RLS on customer tables and deny direct anon/authenticated access by default.

The admin dashboard should use server-side routes/actions.

Even with RLS, repository code must always require a `userId`.

Never provide a method such as:

```ts
getAllTasks()
```

to the assistant layer.

Use:

```ts
getTasksForUser(userId, ...)
```

Add automated cross-user isolation tests.

---

# 36. Webhook Architecture

Recommended route:

```text
POST /api/webhooks/evolution/[webhookToken]
```

The token is a long high-entropy secret configured in the admin settings.

If Evolution supports custom auth headers in the deployed version, support that too, but do not depend on undocumented behavior.

## 36.1 Inbound processing order

Steps 1–11 run in the webhook request. Steps 12–17 run asynchronously in the inbound job worker (see 36.2).

1. validate webhook route token
2. parse JSON safely
3. normalize event through Evolution adapter
4. ignore unsupported event types
5. ignore `fromMe` messages
6. ignore group chats in V1
7. normalize sender number
8. hash message id
9. idempotency check
10. find manually authorized user
11. validate status/trial, then rate limit, then enqueue job
12. identify message type
13. process media reference or natural-language message
14. save minimal encrypted recent context
15. execute assistant tools
16. send reply
17. record safe usage/operational telemetry

## 36.2 Fast webhook response (required)

An AI turn with several tool iterations and Google calls can take longer than Evolution's webhook timeout. A slow response can also make Evolution redeliver the event. V1 therefore always acknowledges fast and processes afterwards.

### 36.2.1 Webhook handler (fast path)

The webhook route does only steps 1–11 of 36.1 plus enqueueing, then returns `200`:

1. steps 1–9 (token, parse, normalize, filters, sender, hash, idempotency). Insert the `processed_messages` row with status `QUEUED`.
2. steps 10–11 (allowlist, status/trial). Unknown, suspended, and expired senders get their fixed reply here (short Evolution call) and no job is created.
3. per-minute rate limit check (45.1)
4. insert an `inbound_jobs` row (see 33.23) containing the encrypted normalized message, never the raw webhook body
5. schedule processing with Next.js `after()` so it runs after the response is sent, within the same invocation
6. return `200`

Target: respond within 2 seconds.

### 36.2.2 Job processing

The worker (`processInboundJobs(userId)`):

1. claims the oldest QUEUED job for that user through an RPC using `FOR UPDATE SKIP LOCKED`, only if that user has no job in PROCESSING. This keeps each user's messages in order, so "actually make it 11" is never handled before the message it corrects.
2. marks it PROCESSING with `locked_until = now() + job timeout` (default 90 seconds)
3. runs steps 12–17 of 36.1 (AI, tools, reply, context, telemetry)
4. on success: marks it DONE and sets `payload_enc = NULL` immediately
5. loops to the user's next QUEUED job, if any, while the invocation's time budget allows

Set the route's `maxDuration` to the maximum the deployment plan allows. The job timeout must stay below it.

### 36.2.3 Recovery sweeper

The existing every-minute Supabase Cron call also invokes `POST /api/internal/jobs/sweep` (same `INTERNAL_CRON_SECRET`). The sweep:

- processes QUEUED jobs older than 30 seconds (the `after()` callback did not run)
- reclaims PROCESSING jobs whose `locked_until` has passed

Retry policy:

- **Failed before any tool ran** (AI unavailable, timeout before a decision): retry up to 2 more times.
- **Failed after a tool changed data or sent a message:** do not re-run the AI turn, because that could create duplicate tasks or events. Mark the job FAILED and send the generic error message once.
- Track this with a `side_effects_started` flag, set on the job just before the first mutating tool runs.
- **Jobs older than 10 minutes** are marked FAILED without processing. Answering a stale message late is worse than asking the user to retry. Send the generic error message once.

### 36.2.4 Privacy

- `payload_enc` holds only the normalized fields the pipeline needs (text, caption, filename, mime type, media reference, message key), encrypted with the user's DEK.
- Payloads are nulled on DONE or FAILED. The daily cleanup job deletes job rows older than 24 hours.
- The admin sees only job counts by status and error codes.

---

# 37. Normalized Inbound Message Shape

The Evolution adapter should normalize provider payloads into a stable internal object.

Example:

```ts
type NormalizedInboundMessage = {
  providerMessageId: string;
  senderPhone: string;
  senderJid?: string;
  fromMe: boolean;
  isGroup: boolean;
  timestamp: Date;
  type: 'text' | 'document' | 'image' | 'video' | 'audio' | 'unknown';
  text?: string;
  caption?: string;
  filename?: string;
  mimeType?: string;
  mediaUrl?: string;
  mediaReference?: string;
  providerMessageKey?: unknown;
};
```

Provider-specific nested payloads must not leak beyond the adapter.

---

# 38. Message Processing Pipeline

For an authorized text message:

```text
Inbound message
    |
validate access
    |
load recent context
    |
load relevant memories
    |
load connection capabilities
    |
AI/tool decision
    |
validate requested tool calls
    |
execute tools
    |
generate/format response
    |
send WhatsApp reply
    |
store limited recent encrypted context
```

The context sent to AI should contain only what is necessary.

Do not send Google tokens, API keys, encrypted secrets, or irrelevant customer records.

---

# 39. AI Prompt Requirements

The system prompt must clearly define:

- current exact date/time
- user's timezone
- user name
- English-only behavior
- concise WhatsApp style
- Personal vs Professional definitions
- no hallucinated success
- no disclosure of internal implementation
- memory selection criteria
- available tools
- how to handle ambiguity
- how to resolve relative time
- what integrations are connected
- what features are unavailable
- no claims about document contents because documents are not read

Important document rule:

If the user asks:

> What is inside the PDF I sent?

The assistant must say it does not read stored documents in V1. It can resend the file if the reference is still available.

It must never infer document contents from the filename.

---

# 40. Static/Rule-Based Messages That Do Not Need AI

To save cost and improve reliability, intercept:

- unknown user
- expired trial
- suspended user
- simple Google connection state
- media replay unavailable
- system disabled
- integration unavailable
- health/test responses

AI is not required for these.

---

# 41. Google OAuth Token Handling

- tokens are per user
- refresh token encrypted
- access token encrypted if persisted
- refresh automatically server-side
- if Google returns revoked/invalid grant, mark `REAUTH_REQUIRED`
- do not repeatedly retry revoked tokens
- never expose token values to client/admin UI
- one user can never use another user's tokens

---

# 42. Sheet and Calendar Isolation

All Google operations start from the authenticated internal `userId`.

The code resolves:

```text
userId -> google_connections -> decrypted user token
```

Never accept a `google_connection_id` from AI and trust it without ownership validation.

Same principle for:

- task ids
- prospect ids
- sheet ids
- document ids
- memory ids
- calendar ids

---

# 43. Operational Logging

Create a central logger with strict redaction.

Allowed log examples:

```text
Webhook received
event=MESSAGES_UPSERT
user_id=uuid
message_type=text
status=success
latency_ms=812
```

Forbidden:

```text
message="Remind me to call my doctor..."
prompt="..."
calendar_description="..."
sheet_row={...}
api_key="..."
refresh_token="..."
media_url="..."
```

When logging third-party errors, extract safe fields such as HTTP status and known error code. Do not dump the whole response if it may echo customer content.

---

# 44. Trial and Usage Enforcement

Before every AI or Google operation:

```ts
assertUserCanUseAssistant(user)
```

Conditions:

- ACTIVE
- if TRIAL, current time <= trial_end_at
- if NO_EXPIRY, allowed
- not rate-limited

Use the same access check in proactive reminder dispatch.

Do not enforce only at the WhatsApp webhook layer because internal jobs also act for users.

---

# 45. Rate Limiting

No Redis is required for V1.

Use lightweight database counters/checks.

Configurable:

```text
max AI requests per user per day
max inbound messages per user per minute
```

If rate exceeded:

> You’ve reached the current assistant usage limit. Please try again later.

Do not reveal infrastructure details.

Unknown senders should not consume AI quota.

## 45.1 Counter storage

**Daily AI limit.** Use `usage_daily.ai_requests`. Before each AI call, atomically increment and check it in one statement:

```sql
INSERT INTO usage_daily (user_id, usage_date, ai_requests)
VALUES ($1, $2, 1)
ON CONFLICT (user_id, usage_date)
DO UPDATE SET ai_requests = usage_daily.ai_requests + 1, updated_at = now()
RETURNING ai_requests;
```

If the returned value exceeds the limit, do not call the AI. `usage_date` is the user's local date in their timezone, so the limit resets at local midnight.

**Per-minute inbound limit.** Use the `rate_limit_windows` table (see 33.22), a fixed-window counter:

- `window_start` = the current UTC minute (`date_trunc('minute', now())`)
- atomically upsert `count = count + 1` with `RETURNING count` via an RPC such as `rate_limit_hit(user_id, bucket, limit)`
- bucket `inbound_msg` for authorized inbound messages
- if the count exceeds the limit, skip AI and tools

Send the rate-limit message at most once per window: reply only when the returned count equals `limit + 1`. Further messages in that window are dropped silently, which prevents reply loops.

The daily cleanup job deletes `rate_limit_windows` rows older than 1 hour.

Rate-limit checks run after the idempotency check, so duplicate webhook deliveries do not consume quota.

---

# 46. Error Handling

Use typed application errors.

Examples:

```text
USER_NOT_AUTHORIZED
TRIAL_EXPIRED
USER_SUSPENDED
AI_UNAVAILABLE
AI_INVALID_TOOL_OUTPUT
EVOLUTION_UNAVAILABLE
EVOLUTION_SEND_FAILED
MEDIA_REFERENCE_UNAVAILABLE
GOOGLE_NOT_CONNECTED
GOOGLE_REAUTH_REQUIRED
CALENDAR_EVENT_AMBIGUOUS
SHEET_NOT_FOUND
SHEET_ACCESS_DENIED
REMINDER_SEND_FAILED
RATE_LIMITED
```

User responses should be helpful and short.

Operational error codes may be logged without content.

---

# 47. Destructive Actions

Require confirmation for broad destructive operations.

Examples requiring confirmation:

```text
"Delete all my tasks."
"Clear all memories."
"Delete the entire Expenses Google Sheet."
"Remove all prospects."
```

A unique explicitly named single item can be removed without a second confirmation when the user's intent is clear.

Example:

> Cancel tomorrow's 3 PM dentist appointment.

If exactly one event matches, cancellation can proceed.

---

# 48. Privacy Behavior

V1 privacy requirements:

1. admin UI contains no content viewer
2. content encrypted before database persistence
3. Google tokens encrypted
4. API secrets encrypted
5. no raw chat logs
6. no raw AI prompts in logs
7. no WhatsApp binary media storage
8. minimal recent conversation retention
9. customer data isolation tests
10. data deletion available to admin upon request
11. no broad Google Drive permission
12. all integration actions scoped to the current user

---

# 49. API / Route Specification

Suggested Next.js routes.

## Public/provider routes

```text
POST /api/webhooks/evolution/[token]
GET  /connect/google?t=...
GET  /api/auth/google/callback
GET  /connect/success
```

## Internal protected route

```text
POST /api/internal/reminders/dispatch
POST /api/internal/jobs/sweep
```

Require internal secret.

## Admin routes/server actions

Prefer server actions or protected route handlers.

Examples:

```text
/admin/users/*
/admin/settings/*
/api/admin/evolution/test
/api/admin/evolution/configure-webhook
/api/admin/evolution/send-test
/api/admin/ai/test
```

Do not expose an end-user REST API in V1.

---

# 50. Minimal Customer Web Pages

There is no customer dashboard.

Required pages only:

## 50.1 Google connect

```text
/connect/google?t=<token>
```

Behavior:

- validate token
- token not expired
- token not used
- show minimal "Connect Google" page
- redirect to OAuth

## 50.2 Connection success

Display:

```text
Google connected successfully.
You can close this page and return to WhatsApp.
```

No customer navigation/sidebar.

## 50.3 Error

Examples:

```text
This connection link has expired.
Return to WhatsApp and ask the assistant to connect Google again.
```

---

# 51. Recommended Tech Stack

```text
Framework: Next.js App Router
Language: TypeScript
UI: Tailwind CSS
Admin components: shadcn/ui or similarly lightweight components
Database: Supabase PostgreSQL
Auth: Supabase Auth for admins only
Database client: @supabase/supabase-js
Validation: Zod
Google: googleapis
AI client: OpenAI-compatible client pointed to OpenRouter
Date/time: Luxon
Recurrence: rrule
Encryption: Node crypto, AES-256-GCM
Testing: Vitest + Playwright
Deployment: Vercel
Scheduling: Supabase Cron + pg_net
```

Do not require n8n.

---

# 52. Environment Variables

Infrastructure bootstrap values must remain environment variables because the application cannot safely configure its own database/master encryption before startup.

Example `.env.example`:

```bash
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

APP_MASTER_KEY=
CONFIG_MASTER_KEY=
INTERNAL_CRON_SECRET=

# Optional bootstrap admin
ADMIN_BOOTSTRAP_EMAIL=
```

Evolution/OpenRouter/Google credentials should be entered through the admin dashboard after initial application setup and stored encrypted.

For development, optional environment fallbacks may be supported, but database dashboard settings should take precedence in normal operation.

Never commit real secrets.

---

# 53. Suggested Project Structure

```text
src/
  app/
    admin/
      page.tsx
      users/
      settings/
      operations/
    api/
      webhooks/
        evolution/
          [token]/
            route.ts
      internal/
        reminders/
          dispatch/
            route.ts
      auth/
        google/
          callback/
            route.ts
      admin/
    connect/
      google/
        page.tsx
      success/
        page.tsx

  components/
    admin/

  lib/
    ai/
      provider.ts
      openrouter.ts
      prompts.ts
      tools.ts
      schemas.ts

    whatsapp/
      provider.ts
      evolution.ts
      normalize.ts

    google/
      oauth.ts
      calendar.ts
      sheets.ts
      tokens.ts

    assistant/
      orchestrator.ts
      context.ts
      intent.ts
      executor.ts
      response.ts

    crypto/
      user-encryption.ts
      config-encryption.ts

    db/
      supabase-admin.ts
      repositories/
        users.ts
        tasks.ts
        reminders.ts
        memories.ts
        prospects.ts
        documents.ts
        google.ts
        sheets.ts
        settings.ts
        usage.ts
        audit.ts

    reminders/
      dispatcher.ts
      recurrence.ts

    security/
      access.ts
      rate-limit.ts
      webhook.ts
      admin.ts

    logger/
      index.ts
      redaction.ts

    time/
      index.ts

supabase/
  migrations/
  functions-or-sql/
    claim_due_reminders.sql
    cron_setup.sql
    cleanup_context.sql

tests/
  unit/
  integration/
  e2e/
```

---

# 54. Admin Settings Loading

Use a typed configuration service.

Example concept:

```ts
const evolution = await settings.getEvolutionConfig();
const ai = await settings.getAIConfig();
const google = await settings.getGoogleConfig();
```

Cache non-user settings briefly in memory where safe, but support invalidation after admin changes.

Never cache decrypted secrets in client/browser storage.

---

# 55. Evolution Webhook Setup Flow

Admin saves:

- Base URL
- API key
- instance name
- webhook token

Application constructs:

```text
https://<app-domain>/api/webhooks/evolution/<high-entropy-token>
```

When admin clicks "Configure Webhook":

1. call Evolution API webhook configuration endpoint through adapter
2. subscribe required events
3. save safe status
4. verify if API provides webhook lookup
5. show success/failure

Do not ask the admin to manually edit source code.

---

# 56. Google Sheets Creation Flow

Example:

**User**
> Create a sheet called Expenses.

Process:

1. assert Google connected
2. call Sheets API to create blank spreadsheet
3. save encrypted spreadsheet id/title/url
4. reply with success and link

**Assistant**
> Created "Expenses". Send me an expense anytime and I can add it there.
> <Google Sheet link>

If Google is not connected:

> Connect Google first: <short-lived link>

---

# 57. Calendar Create Flow

**User**
> Meeting with Ravi tomorrow at 3 for an hour.

AI tool arguments:

```json
{
  "title": "Meeting with Ravi",
  "start": "resolved ISO timestamp",
  "end": "resolved ISO timestamp",
  "timezone": "Asia/Kolkata"
}
```

Backend:

1. validate timestamps
2. resolve user's Google connection
3. create event on default calendar
4. store no unnecessary local copy of Calendar content
5. return event id only if needed for conversation handling
6. respond after API success

The assistant does not need to mirror all Calendar events in Supabase.

---

# 58. Calendar Availability Flow

**User**
> When am I free tomorrow afternoon?

Process:

1. resolve tomorrow in user timezone
2. define configured afternoon window, default from 15:00
3. optionally treat a reasonable work window as ending 18:00 unless user specified otherwise
4. query Google FreeBusy/events
5. calculate free slots locally
6. return useful slots

If user has not specified a preferred working-hours window, phrase result accurately rather than assuming the entire day.

Example:

> Between 3 PM and 6 PM tomorrow, you’re free from 3:00-4:30 PM and 5:15-6:00 PM.

---

# 59. Memory Extraction Flow

After a meaningful user message, the AI may return memory candidates in addition to the main action.

Example input:

> Ravi is my accountant. Remind me Saturday to send him the GST files.

Actions:

1. memory candidate: Ravi is user's accountant
2. task: send Ravi GST files Saturday
3. category likely PROFESSIONAL

Before inserting memory:

- compare with decrypted existing relevant memories
- update an existing memory instead of creating duplicates where appropriate

---

# 60. Prospect Flow

**User**
> Add Ravi from ABC Foods, 9876543210. He's looking for a website.

Create:

```text
name: Ravi
company: ABC Foods
phone: 9876543210
notes: Looking for a website
category: PROFESSIONAL
```

Reply:

> Added Ravi from ABC Foods to your prospects.

No pipeline stage is required.

---

# 61. Document Reference Flow

Inbound Evolution message includes a PDF.

Example caption:

> ABC website proposal.

Store metadata/reference only.

Later:

**User**
> Send the ABC website proposal.

Backend:

1. load/decrypt this user's document metadata
2. locally score filename/caption/tags/date
3. choose one match or ask
4. call Evolution `resendStoredMedia`
5. if successful, update availability to AVAILABLE
6. if historic reference failed, mark UNAVAILABLE
7. ask user to resend

No Supabase Storage.

---

# 62. Search Strategy for Encrypted Content

Because sensitive content is encrypted, PostgreSQL full-text search cannot be used directly on plaintext.

For V1 data volumes:

## Memories

- retrieve bounded user-only memory rows
- decrypt server-side
- local text/entity scoring
- select top matches

## Prospects

- retrieve user-only prospects up to a reasonable cap
- decrypt server-side
- local normalized matching
- exact phone/email match where supplied

## Documents

- retrieve user-only metadata
- decrypt server-side
- fuzzy filename/caption/tag/date matching

## Tasks

Tasks may similarly be loaded for the relevant status/time range and locally matched when the user references a task by name.

Optimize later if data volume requires blind indexes or encrypted search indexes.

Do not weaken encryption merely to make V1 search easier.

---

# 63. Data Minimization

Do not store data unless the feature needs it.

Examples:

- Calendar event data can normally be fetched from Google when needed
- Sheet content remains in Google Sheets, not copied to Supabase
- WhatsApp media binary remains with WhatsApp/Evolution
- raw webhook payload is not stored
- long-term chat transcript is not stored
- only bounded recent conversation context is stored
- structured memories are stored instead of entire conversations

---

# 64. Usage Accounting

Increment usage counters for:

- inbound authorized messages
- outbound assistant messages
- AI requests
- AI token counts if returned by provider
- Google API actions
- reminder sends

Admin sees usage counts only.

This provides a foundation for future subscriptions without implementing billing in V1.

---

# 65. Future Billing Readiness

Do not implement payment.

User table/access code should be extensible to future states such as:

```text
TRIAL
PAID
PAST_DUE
SUSPENDED
```

But V1 UI requires only trial/no-expiry plus active/suspended.

Avoid hardwiring trial logic in a way that makes future plans impossible.

---

# 66. Help Behavior

If user asks:

```text
help
what can you do
```

Assistant should summarize V1 features, for example:

> I can manage your tasks and reminders, recurring reminders, Personal and Professional lists, prospects, Google Calendar, assistant-managed Google Sheets, memories, and references to files you’ve sent me.

Keep it concise.

---

# 67. Important Edge Cases

The implementation must handle at least these.

## WhatsApp

- duplicate webhook delivery
- `fromMe` message
- group message
- unknown number
- malformed webhook
- missing text
- unsupported media
- Evolution outage
- Evolution API key changed
- instance disconnected
- invalid phone formatting

## Task/reminder

- date without time
- relative time
- past requested time
- duplicate recurring job generation
- reminder retry
- user suspended before reminder
- trial expires before reminder
- task completed before reminder
- user asks to snooze already-sent reminder
- user deletes recurring series

## Calendar

- Google not connected
- refresh token revoked
- multiple matching events
- daylight savings timezone
- recurring event
- conflict/availability
- event already deleted
- attendee email invalid

## Sheets

- Google not connected
- sheet removed by user
- app loses permission
- blank sheet first row
- new field not in schema
- multiple row matches for update
- row read cap exceeded

## Memory

- duplicate fact
- contradictory fact
- user explicitly corrects memory
- user asks to forget
- memory cap reached

## Documents

- filename missing
- caption missing
- duplicate filename
- old media URL expired
- Evolution cannot replay old message
- more than one file matches
- media reference unavailable
- user asks what is inside a document

## Admin

- invalid Evolution settings
- lost AI provider key
- Google client secret changed
- changing default trial
- deleting user
- secret masking
- admin session expiry

---

# 68. Idempotency Requirements

At-least-once webhook delivery must not create duplicate tasks.

Hash provider message id using a server-side hash.

Before processing:

```text
if processed_messages contains hash:
    return 200
```

For recurring reminders, unique occurrence keys prevent duplicates.

For Google operations caused by a webhook, do not retry blindly after an unknown timeout if doing so could duplicate an event. Use request metadata/idempotency strategy where possible and check for recently created matching operation when necessary.

---

# 69. Security Requirements

Required:

- HTTPS only in production
- secure cookies
- CSRF-safe admin mutations
- server-side admin authorization
- input validation with Zod
- encryption at rest at application layer
- masked secrets
- no secrets in browser JavaScript
- no service role key in browser
- safe webhook authentication/token
- rate limiting
- idempotency
- minimal Google scopes
- per-user data isolation
- audit admin actions
- sanitized logs
- short-lived OAuth linking tokens
- no binary file persistence
- dependency updates
- `.env` excluded from git

---

# 70. Admin Content Restrictions

The admin dashboard must not contain:

```text
View Chats
View Tasks
View Memory
View Prospect Details
View Calendar
View Sheet Contents
Download User Files
Read Documents
```

User details page may show:

```text
Tasks: 42
Memories: 18
Prospects: 7
Document references: 11
Google: Connected
Last active: ...
```

It may not show the underlying values.

---

# 71. Health / Operations Page

Show:

```text
Application: Healthy
Database: Healthy
Evolution: Connected/Disconnected
AI: Configured/Error
Google OAuth: Configured/Error
Reminder dispatcher last run
Reminder failures last 24h
Webhook events processed last 24h
```

Do not expose content.

Provide safe integration re-test buttons.

---

# 72. Supabase Cron Setup

Create migration/setup SQL that:

1. enables `pg_cron`
2. enables `pg_net`
3. schedules a call to the reminder endpoint every minute
4. supplies `INTERNAL_CRON_SECRET` securely

Where practical, store cron HTTP secret using Supabase Vault rather than embedding it in migration source.

Document the required one-time production setup.

Cron must also run:

- reminder dispatch (every minute)
- recurrence materialization (every minute)
- inbound job sweep, `POST /api/internal/jobs/sweep` (every minute, see 36.2.3)
- recent conversation cleanup
- pending action expiry/cleanup
- `unknown_sender_replies`, `rate_limit_windows`, and `inbound_jobs` cleanup
- optional operational log cleanup

Cleanup can run daily.

---

# 73. Reminder Claim RPC

Create an RPC/function similar in behavior to:

```text
claim_due_reminders(batch_size)
```

It should:

- first mark stale PENDING reminders MISSED per section 13.6
- find PENDING/FAILED-retryable reminders due now
- lock them
- mark PROCESSING
- increment attempts appropriately
- return only operational identifiers needed by the server

The server then retrieves/decrypts task text for only the claimed user's reminder.

On success -> SENT.

On retryable failure -> FAILED with next_attempt_at.

On final failure -> FAILED with no next retry.

---

# 74. Message Reply Formatting

WhatsApp replies should generally be:

- short
- no markdown tables
- numbered lists where useful
- one confirmation sentence after simple actions
- local time display
- no excessive explanations

Example:

> Added under Professional. I’ll remind you tomorrow at 10:00 AM.

Not:

> I have successfully processed your request and created a new task object in your professional workspace.

---

# 75. User Account Status Through WhatsApp

User can ask:

> Is my Google connected?
> When does my trial end?

Assistant can answer only that user's metadata.

Example:

> Google is connected. Your trial is active until 25 October 2026.

No admin/dashboard needed.

---

# 76. Google Reconnection

If a Google operation fails due to revoked credentials:

1. mark connection `REAUTH_REQUIRED`
2. return a new short-lived OAuth link
3. do not delete local non-Google data
4. after successful OAuth, restore `CONNECTED`

---

# 77. AI Provider Failure

If primary model fails:

- optionally call configured fallback model
- avoid duplicate tool execution
- tool execution should occur only after a valid structured decision
- if both fail, send fixed generic response

Example:

> I couldn't process that right now. Please try again.

Never expose provider/model name unless admin is testing.

---

# 78. Evolution Failure

If Evolution cannot send response:

- log safe failure
- do not mark reminder SENT
- retry proactive reminder according to retry policy
- interactive inbound reply may be retried conservatively
- avoid infinite loops

Connection-update webhook should update a safe operational status.

---

# 79. Testing Requirements

## 79.1 Unit tests

At minimum:

- phone normalization
- trial/access checks
- date/time conversions
- encryption round-trip
- encryption wrong-key failure
- config secret masking
- task classification validation
- recurrence calculation
- reminder retry schedule
- document metadata search
- user isolation repository checks
- webhook normalization
- AI tool schema validation

## 79.2 Integration tests

Mock external APIs.

Test:

- Evolution inbound -> task create -> Evolution reply
- duplicate Evolution webhook
- unknown number blocked
- expired trial blocked
- task reminder dispatch
- recurring reminder next occurrence
- stale reminder marked MISSED, not sent, after reactivation
- snooze/reschedule idempotent under duplicate webhook
- ambiguous match → pending action → numbered reply resolves correct record
- pending action cannot execute twice; expired pending action does not execute
- unknown sender receives at most one reply per cooldown under concurrent webhooks
- per-minute rate limit replies once per window
- webhook returns before AI processing; per-user job ordering preserved
- job with side effects started is not re-run by sweeper
- Google OAuth state validation
- Calendar create/update/delete
- Google token refresh
- Sheet creation and append
- media replay success
- media reference expired
- AI fallback

## 79.3 E2E admin tests

- admin login
- add user
- edit user
- extend trial
- suspend user
- configure Evolution
- secret remains masked
- configure AI
- configure Google
- delete user
- verify no customer-content viewer exists

## 79.4 Cross-user privacy test

Create User A and User B.

Prove through automated tests that:

- A cannot retrieve B's task
- A cannot retrieve B's memory
- A cannot retrieve B's prospect
- A cannot retrieve B's document reference
- A cannot use B's Google token
- A cannot update B's sheet

This is a release blocker.

---

# 80. Acceptance Criteria by Feature

## 80.1 User allowlist

- admin can create a user
- authorized number is immediately recognized
- unregistered number never invokes AI
- duplicate phone number rejected

## 80.2 Tasks

- natural language task create works
- date/time resolved in correct timezone
- list/filter works
- complete works
- reschedule works
- Personal/Professional auto classification works

## 80.3 Reminders

- proactive reminder delivered
- snooze works
- retries do not duplicate sends
- expired/suspended users do not receive reminders

## 80.4 Recurrence

- weekly/monthly/daily examples work
- no duplicate occurrence
- cancelling series stops future reminders

## 80.5 Memory

- meaningful facts retained
- filler not retained
- relevant memory recalled later
- "forget" deletes target memory

## 80.6 Prospects

- add/search/update/delete
- no CRM pipeline introduced
- prospect follow-up can create linked task

## 80.7 Documents

- inbound file metadata/reference saved
- no binary exists in Supabase Storage or DB
- later request can replay valid historic reference
- expired historic reference produces resend request
- assistant does not claim to read file contents

## 80.8 Google

- user receives secure connect link
- OAuth connects only that user
- token refresh works
- disconnect works

## 80.9 Calendar

- create
- read
- search
- update
- delete
- recurring
- free/busy
- ambiguous matches prompt clarification

## 80.10 Sheets

- create blank Sheet
- initialize headers on first row
- append
- search/read
- update
- return link
- sheet permission loss handled gracefully

## 80.11 Admin

- user CRUD
- trials
- settings
- Evolution configurable/testable
- AI configurable/testable
- Google configurable
- reminder operational status
- admin cannot read customer content

---

# 81. Development Order

Build in this order.

## Milestone 1: Foundation

- Next.js app
- Tailwind/admin layout
- Supabase project connectivity
- migrations
- admin auth
- admin route protection
- encryption utilities
- settings repository
- logger/redaction

## Milestone 2: User access

- users table
- user CRUD
- phone normalization
- trial logic
- allowlist checks
- usage counters
- audit logs

## Milestone 3: Evolution API

- provider interface
- Evolution adapter
- dashboard settings
- connection test
- webhook configure action
- inbound normalization
- webhook route
- outbound text
- idempotency

At this point, a manually added user should be able to send a WhatsApp message and receive a deterministic test reply.

## Milestone 4: AI orchestration

- OpenRouter provider
- dashboard AI settings
- tool schemas
- orchestrator
- recent context
- safe system prompt
- error handling

## Milestone 5: Tasks

- task repository
- create/list/update/complete/cancel
- category classification
- conversational references

## Milestone 6: Reminder engine

- reminders table
- task series
- recurrence
- Supabase Cron
- claim RPC
- dispatch endpoint
- Evolution proactive sends
- retries
- snooze

## Milestone 7: Memory and prospects

- automatic memory extraction
- memory search/update/delete
- prospect CRUD
- linked follow-up task

## Milestone 8: Media references

- document/media webhook parsing
- metadata/reference encryption
- document search
- Evolution replay adapter
- expired reference handling
- prove no binary persistence

## Milestone 9: Google OAuth

- Google admin config
- one-time connection tokens
- OAuth start/callback
- encrypted refresh tokens
- reconnect/disconnect

## Milestone 10: Calendar

- event CRUD
- search
- recurring events
- free/busy
- default calendar
- ambiguous matching

## Milestone 11: Sheets

- create spreadsheet
- managed sheet registry
- schema initialization
- append/search/update rows
- link return
- permission failure

## Milestone 12: Hardening

- security tests
- cross-user tests
- secret masking
- log review
- rate limiting
- cleanup jobs
- health page
- deployment documentation
- E2E tests

---

# 82. Definition of Done

V1 is complete only when:

1. project builds without TypeScript errors
2. database migrations work from a clean Supabase project
3. admin can log in
4. admin can fully configure Evolution API without editing code
5. admin can add an authorized user
6. unknown users are blocked
7. WhatsApp natural-language task management works
8. reminder delivery works through Supabase Cron
9. recurrence works
10. Personal/Professional classification works
11. automatic memory works
12. prospects work
13. historic media reference replay works when provider reference remains valid
14. media expiry is handled without backup storage
15. Google connection works
16. full Calendar functions work
17. assistant-managed Sheets work
18. trial enforcement works
19. all customer-sensitive DB fields specified as encrypted are actually encrypted
20. raw customer content is absent from logs
21. admin dashboard has no customer content viewer
22. cross-user isolation tests pass
23. README contains complete local and production setup
24. `.env.example` is included
25. no real secrets are committed
26. basic integration health is visible to admin
27. required automated tests pass

---

# 83. Deployment Checklist

## Supabase

- create project
- run migrations
- enable pg_cron
- enable pg_net
- configure Vault secret for cron endpoint if used
- create reminder cron
- create cleanup cron
- confirm RLS
- confirm no Storage bucket is required

## Vercel

Set bootstrap environment secrets:

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
APP_MASTER_KEY
CONFIG_MASTER_KEY
INTERNAL_CRON_SECRET
```

Deploy.

## Admin

- bootstrap admin account
- log into admin dashboard
- configure Evolution
- configure webhook
- test Evolution connection
- configure OpenRouter
- test AI
- configure Google OAuth
- verify callback URL
- set default trial/timezone
- add first authorized user

## Google Cloud

Enable the APIs required for:

- Google Calendar
- Google Sheets
- Google Drive file-level access needed for app-created Sheets
- OAuth consent

Configure exact production OAuth redirect URI.

During testing, use Google test users as required by the OAuth app state.

---

# 84. README Requirements

The generated repository README must include:

- product description
- architecture diagram
- prerequisites
- local setup
- Supabase setup
- migration instructions
- admin bootstrap
- Vercel deployment
- Evolution configuration
- webhook configuration
- Google Cloud setup
- OpenRouter setup
- reminder cron setup
- environment variables
- security/privacy notes
- document-reference limitation
- common troubleshooting

Include a clear warning:

> This V1 does not store WhatsApp media binaries. File recall depends on the historic WhatsApp/Evolution media reference remaining available. Users may need to resend old files when provider references expire.

---

# 85. Non-Negotiable Product Rules

These rules override implementation convenience.

1. **No public signup in V1.**
2. **Only admin-added phone numbers become users.**
3. **WhatsApp is the customer interface.**
4. **No customer dashboard.**
5. **English only.**
6. **Natural language, not command syntax.**
7. **Personal/Professional classification is automatic.**
8. **Memory selection is automatic.**
9. **Prospects are simple records, not a CRM.**
10. **Calendar supports full normal scheduling CRUD and availability.**
11. **Sheets are assistant-managed blank Sheets in V1.**
12. **No WhatsApp binary file storage anywhere controlled by the product.**
13. **Document recall relies on old Evolution/WhatsApp references.**
14. **If an old reference expires, ask the user to resend.**
15. **The assistant does not read stored document contents.**
16. **Evolution API configuration must be editable/testable in admin.**
17. **Trial duration must be globally configurable and individually overrideable.**
18. **Owner/admin dashboard must not expose user content.**
19. **Sensitive persisted content must be encrypted.**
20. **No raw customer messages in production logs.**
21. **Every customer record/action must be scoped to user_id.**
22. **No n8n dependency.**
23. **External integrations must sit behind adapters/services.**
24. **Never claim an action succeeded until the tool/API confirms success.**

---

# 86. Example End-to-End Scenarios

## Scenario A: First use

Admin adds:

```text
Haroon
+9198XXXXXXXX
Trial ends: 25 Oct 2026
```

Haroon sends:

> Hi

System:

- recognizes authorized number
- trial valid
- replies with assistant introduction/help
- does not run registration flow

---

## Scenario B: Natural task

User:

> Tomorrow 10 remind me to send the client report.

System:

- resolves tomorrow in user timezone
- classification PROFESSIONAL
- creates task
- creates reminder
- replies confirmation

At 10 tomorrow:

> Reminder: Send the client report.

---

## Scenario C: Recurring

User:

> Every Monday at 9 remind me to review pending leads.

System:

- creates recurring series
- computes next Monday 9 AM
- creates occurrence/reminder
- continues weekly

---

## Scenario D: Memory

User:

> Ravi is my CA.

System:

- recognizes valuable person relationship
- stores encrypted memory

Weeks later:

> What was Ravi helping me with?

Assistant:

> You told me Ravi is your CA.

---

## Scenario E: Prospect

User:

> Add Arun from XYZ, 9876543210, interested in website redesign.

System stores prospect.

User:

> Remind me Friday morning to call Arun.

System finds likely prospect context and creates linked task.

---

## Scenario F: Google Calendar

User:

> Connect Google.

Assistant sends one-time OAuth link.

After connection:

> Google is connected.

User:

> Schedule Ravi Friday at 3 for an hour.

Calendar event is created.

User:

> Am I free Friday at 5?

Assistant queries Calendar and answers.

---

## Scenario G: Google Sheet

User:

> Create a sheet called Expenses.

Assistant creates blank Google Sheet and sends link.

User:

> Add domain renewal ₹1,200 today.

AI maps row:

```text
Date
Description
Amount
```

Headers and row are written.

---

## Scenario H: Document reference succeeds

User sends:

```text
ABC-Proposal.pdf
caption: ABC website quotation
```

System stores metadata/reference only.

One week later:

> Send me the ABC website quotation.

System finds reference and Evolution successfully resends it.

---

## Scenario I: Document reference expired

Three months later:

> Send me ABC-Proposal.pdf.

System finds reference.

Evolution/WhatsApp can no longer provide media.

Assistant:

> I found the old file reference, but WhatsApp can no longer provide the file. Please resend it and I’ll remember the new reference.

No hidden backup exists.

---

## Scenario J: Trial expires

User sends:

> What are my tasks today?

Access check detects trial expiry.

No AI request.

Assistant:

> Your assistant trial has ended. Please contact the administrator to continue.

Admin extends trial.

User resumes using existing data.

---

# 87. Architecture Overview

```text
                         ADMIN WEB
                            |
                            v
                      Next.js Admin
                            |
                      Supabase Auth
                            |
                            v
                    System Configuration
                    Users / Trial Control
                            |
                            |
WhatsApp User               |
     |                      |
     v                      |
 Evolution API              |
     |                      |
     v                      |
Next.js Evolution Webhook <-+
     |
     v
Access / Trial / Rate Check
     |
     v
Assistant Orchestrator
     |
     +-------------------+-------------------+------------------+
     |                   |                   |                  |
     v                   v                   v                  v
Supabase DB          OpenRouter          Google APIs       Evolution API
Tasks                Intent/tools        Calendar          Replies
Reminders                                Sheets            Reminders
Memory
Prospects
Recent context
Media references only
     ^
     |
Supabase Cron
Reminder Dispatcher
```

---

# 88. External Documentation References

Implementation should verify current provider-specific endpoint formats at build time because external APIs can evolve.

Useful official/current references:

- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Supabase Cron: https://supabase.com/docs/guides/cron
- Supabase pg_net: https://supabase.com/docs/guides/database/extensions/pg_net
- Google Calendar OAuth scopes: https://developers.google.com/workspace/calendar/api/auth
- Google Sheets scopes: https://developers.google.com/workspace/sheets/api/scopes
- Google Sheets create spreadsheet: https://developers.google.com/workspace/sheets/api/guides/create
- Google Sheets values API: https://developers.google.com/workspace/sheets/api/guides/values
- Evolution API repository/docs: verify against the exact deployed Evolution version before finalizing adapter endpoint paths

Do not alter product behavior merely because a provider API has a different route. Adapt the provider adapter.

---

# 89. Final Builder Directive

Build V1 as a privacy-conscious WhatsApp assistant, not as a generic chatbot and not as a conventional SaaS dashboard product.

The product's value is that an authorized user can simply save one WhatsApp number and naturally manage their tasks, reminders, Calendar, Sheets, prospects, memories, and previously sent file references without learning another application.

The admin dashboard exists only to operate the service.

When implementation choices conflict, prefer in this order:

1. tenant/user data isolation
2. data minimization and privacy
3. action correctness and idempotency
4. reliable reminder delivery
5. natural WhatsApp experience
6. simple maintainable architecture
7. lower infrastructure cost
8. future extensibility

Do not trade privacy or correctness for convenience.

