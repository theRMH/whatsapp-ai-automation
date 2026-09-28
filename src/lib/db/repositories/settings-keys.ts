/**
 * Canonical system_settings key names. Centralized so repositories,
 * admin server actions, and tests all reference the same strings.
 */
export const SettingsKeys = {
  // General (PRD 26)
  ASSISTANT_DISPLAY_NAME: "general.assistant_display_name",
  DEFAULT_TIMEZONE: "general.default_timezone",
  DEFAULT_TRIAL_DAYS: "general.default_trial_days",
  UNKNOWN_NUMBER_REPLY_COOLDOWN_HOURS: "general.unknown_number_reply_cooldown_hours",
  MAX_AI_REQUESTS_PER_USER_PER_DAY: "general.max_ai_requests_per_user_per_day",
  MAX_INBOUND_MESSAGES_PER_USER_PER_MINUTE: "general.max_inbound_messages_per_user_per_minute",
  PENDING_ACTION_TTL_MINUTES: "general.pending_action_ttl_minutes",
  INBOUND_JOB_TIMEOUT_SECONDS: "general.inbound_job_timeout_seconds",
  STALE_INBOUND_JOB_CUTOFF_MINUTES: "general.stale_inbound_job_cutoff_minutes",
  DEFAULT_DATE_ONLY_REMINDER_TIME: "general.default_date_only_reminder_time",
  DEFAULT_MEETING_DURATION_MINUTES: "general.default_meeting_duration_minutes",
  TIME_OF_DAY_MORNING: "general.time_of_day_morning",
  TIME_OF_DAY_AFTERNOON: "general.time_of_day_afternoon",
  TIME_OF_DAY_EVENING: "general.time_of_day_evening",
  TIME_OF_DAY_NIGHT: "general.time_of_day_night",

  // Evolution API (PRD 27)
  EVOLUTION_ENABLED: "evolution.enabled",
  EVOLUTION_BASE_URL: "evolution.base_url",
  EVOLUTION_API_KEY: "evolution.api_key", // secret
  EVOLUTION_INSTANCE_NAME: "evolution.instance_name",
  EVOLUTION_ASSISTANT_NUMBER: "evolution.assistant_number",
  EVOLUTION_REQUEST_TIMEOUT_MS: "evolution.request_timeout_ms",
  EVOLUTION_WEBHOOK_TOKEN: "evolution.webhook_token", // secret
  EVOLUTION_WEBHOOK_MODE: "evolution.webhook_mode",
  EVOLUTION_MEDIA_REPLAY_STRATEGY: "evolution.media_replay_strategy",

  // AI / OpenRouter (PRD 28)
  AI_PROVIDER: "ai.provider",
  AI_API_BASE_URL: "ai.api_base_url",
  AI_API_KEY: "ai.api_key", // secret
  AI_PRIMARY_MODEL: "ai.primary_model",
  AI_FALLBACK_MODEL: "ai.fallback_model",
  AI_ENABLE_FALLBACK: "ai.enable_fallback",
  AI_TEMPERATURE: "ai.temperature",
  AI_MAX_OUTPUT_TOKENS: "ai.max_output_tokens",
  AI_REQUEST_TIMEOUT_MS: "ai.request_timeout_ms",
  AI_MAX_TOOL_ITERATIONS: "ai.max_tool_iterations",

  // Google (PRD 29)
  GOOGLE_ENABLED: "google.enabled",
  GOOGLE_CLIENT_ID: "google.client_id",
  GOOGLE_CLIENT_SECRET: "google.client_secret", // secret
  GOOGLE_PROJECT_NUMBER: "google.project_number",
  GOOGLE_CALENDAR_ENABLED: "google.calendar_enabled",
  GOOGLE_SHEETS_ENABLED: "google.sheets_enabled",

  // Reminders (PRD 30)
  REMINDER_DISPATCHER_ENABLED: "reminders.dispatcher_enabled",
  REMINDER_BATCH_SIZE: "reminders.batch_size",
  REMINDER_MAX_RETRY_ATTEMPTS: "reminders.max_retry_attempts",
  REMINDER_RETRY_DELAYS_MINUTES: "reminders.retry_delays_minutes",
  REMINDER_MISSED_GRACE_PERIOD_MINUTES: "reminders.missed_grace_period_minutes",
  REMINDER_CRON_HEALTH_THRESHOLD_MINUTES: "reminders.cron_health_threshold_minutes",

  // Privacy / retention (PRD 31)
  RETENTION_CONVERSATION_DAYS: "privacy.conversation_retention_days",
  RETENTION_MAX_RECENT_TURNS: "privacy.max_recent_turns_per_user",
  RETENTION_MAX_ACTIVE_MEMORIES: "privacy.max_active_memories_per_user",
  RETENTION_OPERATIONAL_LOG_DAYS: "privacy.operational_log_retention_days",
  RETENTION_USAGE_DATA_DAYS: "privacy.usage_data_retention_days",

  // System messages (PRD 32)
  MESSAGE_UNAUTHORIZED_SENDER: "messages.unauthorized_sender",
  MESSAGE_SUSPENDED_ACCOUNT: "messages.suspended_account",
  MESSAGE_EXPIRED_TRIAL: "messages.expired_trial",
  MESSAGE_GENERIC_FAILURE: "messages.generic_failure",
  MESSAGE_GOOGLE_RECONNECT_REQUIRED: "messages.google_reconnect_required",
  MESSAGE_MEDIA_REFERENCE_UNAVAILABLE: "messages.media_reference_unavailable",
  MESSAGE_INTEGRATION_DISABLED: "messages.integration_disabled",
  MESSAGE_RATE_LIMITED: "messages.rate_limited",
  MESSAGE_PENDING_EXPIRED: "messages.pending_expired",
} as const;

/** Sensible defaults, applied when a setting has never been saved. */
export const SettingsDefaults = {
  ASSISTANT_DISPLAY_NAME: "Assistant",
  DEFAULT_TIMEZONE: "Asia/Kolkata",
  DEFAULT_TRIAL_DAYS: 14,
  UNKNOWN_NUMBER_REPLY_COOLDOWN_HOURS: 24,
  MAX_AI_REQUESTS_PER_USER_PER_DAY: 200,
  MAX_INBOUND_MESSAGES_PER_USER_PER_MINUTE: 15,
  PENDING_ACTION_TTL_MINUTES: 15,
  INBOUND_JOB_TIMEOUT_SECONDS: 90,
  STALE_INBOUND_JOB_CUTOFF_MINUTES: 10,
  DEFAULT_DATE_ONLY_REMINDER_TIME: "09:00",
  DEFAULT_MEETING_DURATION_MINUTES: 30,
  TIME_OF_DAY_MORNING: "09:00",
  TIME_OF_DAY_AFTERNOON: "15:00",
  TIME_OF_DAY_EVENING: "19:00",
  TIME_OF_DAY_NIGHT: "21:00",

  EVOLUTION_ENABLED: false,
  EVOLUTION_REQUEST_TIMEOUT_MS: 15_000,
  EVOLUTION_WEBHOOK_MODE: "MESSAGES_UPSERT",
  EVOLUTION_MEDIA_REPLAY_STRATEGY: "AUTO",

  AI_PROVIDER: "openrouter",
  AI_API_BASE_URL: "https://openrouter.ai/api/v1",
  AI_TEMPERATURE: 0.1,
  AI_MAX_OUTPUT_TOKENS: 1024,
  AI_REQUEST_TIMEOUT_MS: 30_000,
  AI_MAX_TOOL_ITERATIONS: 6,
  AI_ENABLE_FALLBACK: false,

  GOOGLE_ENABLED: false,
  GOOGLE_CALENDAR_ENABLED: true,
  GOOGLE_SHEETS_ENABLED: true,

  REMINDER_DISPATCHER_ENABLED: true,
  REMINDER_BATCH_SIZE: 25,
  REMINDER_MAX_RETRY_ATTEMPTS: 3,
  REMINDER_RETRY_DELAYS_MINUTES: [1, 5, 15],
  REMINDER_MISSED_GRACE_PERIOD_MINUTES: 60,
  REMINDER_CRON_HEALTH_THRESHOLD_MINUTES: 5,

  RETENTION_CONVERSATION_DAYS: 7,
  RETENTION_MAX_RECENT_TURNS: 40,
  RETENTION_MAX_ACTIVE_MEMORIES: 500,
  RETENTION_OPERATIONAL_LOG_DAYS: 90,
  RETENTION_USAGE_DATA_DAYS: 400,

  MESSAGE_UNAUTHORIZED_SENDER:
    "This assistant is available only to authorized users. Please contact the administrator for access.",
  MESSAGE_SUSPENDED_ACCOUNT:
    "Your access has been suspended. Please contact the administrator.",
  MESSAGE_EXPIRED_TRIAL:
    "Your assistant trial has ended. Please contact the administrator to continue.",
  MESSAGE_GENERIC_FAILURE: "I couldn't process that right now. Please try again.",
  MESSAGE_GOOGLE_RECONNECT_REQUIRED:
    'Your Google connection needs to be refreshed. Reply "connect Google" to reconnect.',
  MESSAGE_MEDIA_REFERENCE_UNAVAILABLE:
    "I found the old file reference, but WhatsApp can no longer provide the file. Please resend it and I'll remember the new reference.",
  MESSAGE_INTEGRATION_DISABLED: "This feature is currently unavailable. Please try again later.",
  MESSAGE_RATE_LIMITED: "You've reached the current assistant usage limit. Please try again later.",
  MESSAGE_PENDING_EXPIRED: "That request expired. Please ask again.",
} as const;
