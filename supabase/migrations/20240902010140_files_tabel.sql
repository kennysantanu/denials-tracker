create table "public"."files" (
    "name" text not null,
    "created_at" timestamp with time zone not null default now(),
    "size" bigint,
    "mimetype" text,
    "metadata" jsonb
);


alter table "public"."files" enable row level security;

create table "public"."notes_files" (
    "created_at" timestamp with time zone not null default now(),
    "note_id" bigint not null,
    "file_name" text not null
);


alter table "public"."notes_files" enable row level security;

CREATE UNIQUE INDEX files_pkey ON public.files USING btree (name);

CREATE UNIQUE INDEX notes_files_pkey ON public.notes_files USING btree (note_id, file_name);

alter table "public"."files" add constraint "files_pkey" PRIMARY KEY using index "files_pkey";

alter table "public"."notes_files" add constraint "notes_files_pkey" PRIMARY KEY using index "notes_files_pkey";

alter table "public"."notes_files" add constraint "notes_files_file_name_fkey" FOREIGN KEY (file_name) REFERENCES files(name) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."notes_files" validate constraint "notes_files_file_name_fkey";

alter table "public"."notes_files" add constraint "notes_files_note_id_fkey" FOREIGN KEY (note_id) REFERENCES notes(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."notes_files" validate constraint "notes_files_note_id_fkey";

grant delete on table "public"."files" to "anon";

grant insert on table "public"."files" to "anon";

grant references on table "public"."files" to "anon";

grant select on table "public"."files" to "anon";

grant trigger on table "public"."files" to "anon";

grant truncate on table "public"."files" to "anon";

grant update on table "public"."files" to "anon";

grant delete on table "public"."files" to "authenticated";

grant insert on table "public"."files" to "authenticated";

grant references on table "public"."files" to "authenticated";

grant select on table "public"."files" to "authenticated";

grant trigger on table "public"."files" to "authenticated";

grant truncate on table "public"."files" to "authenticated";

grant update on table "public"."files" to "authenticated";

grant delete on table "public"."files" to "postgres";

grant insert on table "public"."files" to "postgres";

grant references on table "public"."files" to "postgres";

grant select on table "public"."files" to "postgres";

grant trigger on table "public"."files" to "postgres";

grant truncate on table "public"."files" to "postgres";

grant update on table "public"."files" to "postgres";

grant delete on table "public"."files" to "service_role";

grant insert on table "public"."files" to "service_role";

grant references on table "public"."files" to "service_role";

grant select on table "public"."files" to "service_role";

grant trigger on table "public"."files" to "service_role";

grant truncate on table "public"."files" to "service_role";

grant update on table "public"."files" to "service_role";

grant delete on table "public"."notes_files" to "anon";

grant insert on table "public"."notes_files" to "anon";

grant references on table "public"."notes_files" to "anon";

grant select on table "public"."notes_files" to "anon";

grant trigger on table "public"."notes_files" to "anon";

grant truncate on table "public"."notes_files" to "anon";

grant update on table "public"."notes_files" to "anon";

grant delete on table "public"."notes_files" to "authenticated";

grant insert on table "public"."notes_files" to "authenticated";

grant references on table "public"."notes_files" to "authenticated";

grant select on table "public"."notes_files" to "authenticated";

grant trigger on table "public"."notes_files" to "authenticated";

grant truncate on table "public"."notes_files" to "authenticated";

grant update on table "public"."notes_files" to "authenticated";

grant delete on table "public"."notes_files" to "postgres";

grant insert on table "public"."notes_files" to "postgres";

grant references on table "public"."notes_files" to "postgres";

grant select on table "public"."notes_files" to "postgres";

grant trigger on table "public"."notes_files" to "postgres";

grant truncate on table "public"."notes_files" to "postgres";

grant update on table "public"."notes_files" to "postgres";

grant delete on table "public"."notes_files" to "service_role";

grant insert on table "public"."notes_files" to "service_role";

grant references on table "public"."notes_files" to "service_role";

grant select on table "public"."notes_files" to "service_role";

grant trigger on table "public"."notes_files" to "service_role";

grant truncate on table "public"."notes_files" to "service_role";

grant update on table "public"."notes_files" to "service_role";

create policy "Enable all access for authenticated users"
on "public"."files"
as permissive
for all
to authenticated
using (true);

create policy "Enable all access for authenticated users"
on "public"."notes_files"
as permissive
for all
to authenticated
using (true);

create policy "Enable all access for authenticated users"
on "storage"."objects"
as permissive
for all 
to authenticated
using (true);

create policy "Enable all access for authenticated users"
on "storage"."buckets"
as permissive
for all 
to authenticated
using (true);

