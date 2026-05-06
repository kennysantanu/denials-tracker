alter table "public"."patients_files"
	add constraint "patients_files_file_name_fkey"
	foreign key ("file_name") references "public"."files"("name")
	on update cascade
	on delete cascade
	not valid;

alter table "public"."patients_files"
	validate constraint "patients_files_file_name_fkey";