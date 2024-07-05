drop policy "Enable all access for authenticated users" on "public"."denial_notes";

revoke delete on table "public"."denial_notes" from "anon";

revoke insert on table "public"."denial_notes" from "anon";

revoke references on table "public"."denial_notes" from "anon";

revoke select on table "public"."denial_notes" from "anon";

revoke trigger on table "public"."denial_notes" from "anon";

revoke truncate on table "public"."denial_notes" from "anon";

revoke update on table "public"."denial_notes" from "anon";

revoke delete on table "public"."denial_notes" from "authenticated";

revoke insert on table "public"."denial_notes" from "authenticated";

revoke references on table "public"."denial_notes" from "authenticated";

revoke select on table "public"."denial_notes" from "authenticated";

revoke trigger on table "public"."denial_notes" from "authenticated";

revoke truncate on table "public"."denial_notes" from "authenticated";

revoke update on table "public"."denial_notes" from "authenticated";

revoke delete on table "public"."denial_notes" from "service_role";

revoke insert on table "public"."denial_notes" from "service_role";

revoke references on table "public"."denial_notes" from "service_role";

revoke select on table "public"."denial_notes" from "service_role";

revoke trigger on table "public"."denial_notes" from "service_role";

revoke truncate on table "public"."denial_notes" from "service_role";

revoke update on table "public"."denial_notes" from "service_role";

alter table "public"."denial_notes" drop constraint "public_denial_notes_denial_id_fkey";

alter table "public"."denial_notes" drop constraint "public_denial_notes_note_id_fkey";

alter table "public"."notes" drop constraint "public_notes_user_id_fkey";

alter table "public"."denial_notes" drop constraint "denial_notes_pkey";

drop index if exists "public"."denial_notes_pkey";

drop table "public"."denial_notes";

alter table "public"."notes" drop column "user_id";

alter table "public"."notes" add column "created_by" uuid;

alter table "public"."notes" add column "denial_id" bigint not null;

alter table "public"."notes" add column "modified_by" uuid;

alter table "public"."notes" add constraint "public_notes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."notes" validate constraint "public_notes_created_by_fkey";

alter table "public"."notes" add constraint "public_notes_denial_id_fkey" FOREIGN KEY (denial_id) REFERENCES denials(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."notes" validate constraint "public_notes_denial_id_fkey";

alter table "public"."notes" add constraint "public_notes_modified_by_fkey" FOREIGN KEY (modified_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."notes" validate constraint "public_notes_modified_by_fkey";


