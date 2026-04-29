The files in this directory are vendored from the official Supabase
self-hosted Docker setup:

  https://github.com/supabase/supabase/tree/master/docker/volumes

Supabase is licensed under the Apache License, Version 2.0:
https://www.apache.org/licenses/LICENSE-2.0

A copy of the license is included in this directory as LICENSE.

We include only the files required to bootstrap the trimmed Supabase
stack defined in `docker-compose.supabase.yml` (db init scripts and the
Kong API gateway declarative config). No source code modifications have
been made to these vendored files.

If you need to update them to a newer Supabase release, replace the files
in this directory with their counterparts from the upstream repo and
verify that `docker-compose.supabase.yml` still references compatible
image tags.
