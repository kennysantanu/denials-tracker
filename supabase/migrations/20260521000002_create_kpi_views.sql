-- Phase 7: KPI views over app_events
--
-- These views aggregate `app_events` for the reports dashboard. They use
-- `security_invoker = true` so that the existing RLS on `app_events`
-- (own rows + admins with audit.read / legacy audit_read) is respected:
--   * A user querying `user_daily_kpis` only sees their own rows.
--   * An admin (audit.read) sees all rows.
--
-- The reports page additionally gates UI access with:
--   * kpi.read.self  -> show own KPIs
--   * kpi.read.team  -> show team KPIs (one row per peer)
--   * kpi.read.all   -> show org-wide KPIs
--
-- Tables consulted: public.app_events, public.users, public.roles.
-- Heavy aggregations are cheap because of the existing indexes:
--   idx_app_events_actor_created, idx_app_events_event_created,
--   idx_app_events_outcome_created.
-- =============================================================================


-- =============================================================================
-- user_daily_kpis
-- One row per (user, day) summarizing the operational counters used by the
-- "denials worked today" / activity dashboard.
-- =============================================================================
CREATE OR REPLACE VIEW public.user_daily_kpis
WITH (security_invoker = true) AS
SELECT
  ae.actor_user_id                                                AS user_id,
  date_trunc('day', ae.created_at)::date                          AS day,
  COUNT(*) FILTER (WHERE ae.outcome = 'success')                  AS events_total,
  COUNT(*) FILTER (WHERE ae.event_name = 'denial.created')        AS denials_created,
  COUNT(*) FILTER (WHERE ae.event_name = 'denial.updated')        AS denials_updated,
  COUNT(*) FILTER (WHERE ae.event_name = 'denial.closed')         AS denials_closed,
  COUNT(*) FILTER (WHERE ae.event_name = 'denial.reopened')       AS denials_reopened,
  COUNT(*) FILTER (WHERE ae.event_name = 'denial.deleted')        AS denials_deleted,
  COUNT(*) FILTER (WHERE ae.event_name IN (
    'denial.created','denial.updated','denial.closed',
    'denial.reopened','denial.deleted'
  ))                                                              AS denials_worked,
  COUNT(DISTINCT ae.subject_denial_id) FILTER (
    WHERE ae.subject_denial_id IS NOT NULL AND ae.outcome = 'success'
  )                                                               AS distinct_denials_touched,
  COUNT(DISTINCT ae.subject_patient_id) FILTER (
    WHERE ae.subject_patient_id IS NOT NULL AND ae.outcome = 'success'
  )                                                               AS distinct_patients_touched,
  COUNT(*) FILTER (WHERE ae.event_name = 'note.created')          AS notes_created,
  COUNT(*) FILTER (WHERE ae.event_name = 'note.updated')          AS notes_updated,
  COUNT(*) FILTER (WHERE ae.event_name = 'note.deleted')          AS notes_deleted,
  COUNT(*) FILTER (WHERE ae.event_name = 'file.uploaded')         AS files_uploaded,
  COUNT(*) FILTER (WHERE ae.event_name = 'file.deleted')          AS files_deleted,
  COUNT(*) FILTER (WHERE ae.event_name = 'patient.created')       AS patients_created,
  COUNT(*) FILTER (WHERE ae.event_name = 'patient.updated')       AS patients_updated,
  COUNT(*) FILTER (WHERE ae.feature_area = 'ai' AND ae.outcome = 'success') AS ai_invocations,
  COUNT(*) FILTER (WHERE ae.outcome = 'denied')                   AS auth_denials,
  COUNT(*) FILTER (WHERE ae.outcome = 'failed')                   AS failures
FROM public.app_events ae
WHERE ae.actor_user_id IS NOT NULL
GROUP BY ae.actor_user_id, date_trunc('day', ae.created_at);

GRANT SELECT ON public.user_daily_kpis TO authenticated;


-- =============================================================================
-- role_daily_kpis
-- One row per (role, day). Uses the unnest of `actor_role_ids` so that users
-- with multiple active roles contribute to every role they belong to at
-- event time. Joins to `roles` to expose the human role name.
-- =============================================================================
CREATE OR REPLACE VIEW public.role_daily_kpis
WITH (security_invoker = true) AS
SELECT
  r.id                                                            AS role_id,
  r.role_name                                                     AS role_name,
  date_trunc('day', ae.created_at)::date                          AS day,
  COUNT(DISTINCT ae.actor_user_id)                                AS active_users,
  COUNT(*) FILTER (WHERE ae.outcome = 'success')                  AS events_total,
  COUNT(*) FILTER (WHERE ae.event_name IN (
    'denial.created','denial.updated','denial.closed',
    'denial.reopened','denial.deleted'
  ))                                                              AS denials_worked,
  COUNT(DISTINCT ae.subject_denial_id) FILTER (
    WHERE ae.subject_denial_id IS NOT NULL AND ae.outcome = 'success'
  )                                                               AS distinct_denials_touched,
  COUNT(*) FILTER (WHERE ae.event_name = 'note.created')          AS notes_created,
  COUNT(*) FILTER (WHERE ae.event_name = 'file.uploaded')         AS files_uploaded,
  COUNT(*) FILTER (WHERE ae.feature_area = 'ai' AND ae.outcome = 'success') AS ai_invocations,
  COUNT(*) FILTER (WHERE ae.outcome = 'denied')                   AS auth_denials,
  COUNT(*) FILTER (WHERE ae.outcome = 'failed')                   AS failures
FROM public.app_events ae
CROSS JOIN LATERAL unnest(
  CASE WHEN cardinality(ae.actor_role_ids) = 0
       THEN ARRAY[NULL]::bigint[]
       ELSE ae.actor_role_ids
  END
) AS role_id_unnested
JOIN public.roles r ON r.id = role_id_unnested
GROUP BY r.id, r.role_name, date_trunc('day', ae.created_at);

GRANT SELECT ON public.role_daily_kpis TO authenticated;


-- =============================================================================
-- permission_usage_daily
-- One row per (permission_key, day, outcome). Surfaces which permissions
-- are actually exercised and where outcomes skew toward denied / failed.
-- =============================================================================
CREATE OR REPLACE VIEW public.permission_usage_daily
WITH (security_invoker = true) AS
SELECT
  ae.permission_key                                               AS permission_key,
  date_trunc('day', ae.created_at)::date                          AS day,
  ae.outcome                                                      AS outcome,
  ae.permission_source                                            AS permission_source,
  COUNT(*)                                                        AS event_count,
  COUNT(DISTINCT ae.actor_user_id)                                AS distinct_actors
FROM public.app_events ae
WHERE ae.permission_key IS NOT NULL
GROUP BY ae.permission_key, date_trunc('day', ae.created_at),
         ae.outcome, ae.permission_source;

GRANT SELECT ON public.permission_usage_daily TO authenticated;


-- =============================================================================
-- authorization_denials_daily
-- One row per (user, permission_key, day) for `outcome = 'denied'` events,
-- so admins can spot users who routinely hit the gate on a permission they
-- should probably be granted (or, conversely, attack patterns).
-- =============================================================================
CREATE OR REPLACE VIEW public.authorization_denials_daily
WITH (security_invoker = true) AS
SELECT
  ae.actor_user_id                                                AS user_id,
  ae.permission_key                                               AS permission_key,
  date_trunc('day', ae.created_at)::date                          AS day,
  COUNT(*)                                                        AS denial_count,
  COUNT(DISTINCT ae.resource_id)                                  AS distinct_resources,
  MAX(ae.created_at)                                              AS last_denied_at
FROM public.app_events ae
WHERE ae.outcome = 'denied'
GROUP BY ae.actor_user_id, ae.permission_key,
         date_trunc('day', ae.created_at);

GRANT SELECT ON public.authorization_denials_daily TO authenticated;
