create table "public"."patients_files" (
    "created_at" timestamp with time zone not null default now(),
    "patient_id" bigint not null,
    "file_name" text not null
);


alter table "public"."patients_files" enable row level security;

CREATE UNIQUE INDEX patients_files_pkey ON public.patients_files USING btree (patient_id, file_name);

alter table "public"."patients_files" add constraint "patients_files_pkey" PRIMARY KEY using index "patients_files_pkey";

alter table "public"."patients_files" add constraint "patients_files_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."patients_files" validate constraint "patients_files_patient_id_fkey";

grant delete on table "public"."patients_files" to "anon";

grant insert on table "public"."patients_files" to "anon";

grant references on table "public"."patients_files" to "anon";

grant select on table "public"."patients_files" to "anon";

grant trigger on table "public"."patients_files" to "anon";

grant truncate on table "public"."patients_files" to "anon";

grant update on table "public"."patients_files" to "anon";

grant delete on table "public"."patients_files" to "authenticated";

grant insert on table "public"."patients_files" to "authenticated";

grant references on table "public"."patients_files" to "authenticated";

grant select on table "public"."patients_files" to "authenticated";

grant trigger on table "public"."patients_files" to "authenticated";

grant truncate on table "public"."patients_files" to "authenticated";

grant update on table "public"."patients_files" to "authenticated";

grant delete on table "public"."patients_files" to "postgres";

grant insert on table "public"."patients_files" to "postgres";

grant references on table "public"."patients_files" to "postgres";

grant select on table "public"."patients_files" to "postgres";

grant trigger on table "public"."patients_files" to "postgres";

grant truncate on table "public"."patients_files" to "postgres";

grant update on table "public"."patients_files" to "postgres";

grant delete on table "public"."patients_files" to "service_role";

grant insert on table "public"."patients_files" to "service_role";

grant references on table "public"."patients_files" to "service_role";

grant select on table "public"."patients_files" to "service_role";

grant trigger on table "public"."patients_files" to "service_role";

grant truncate on table "public"."patients_files" to "service_role";

grant update on table "public"."patients_files" to "service_role";

create policy "Enable all access for authenticated users"
on "public"."patients_files"
as permissive
for all
to authenticated
using (true);



