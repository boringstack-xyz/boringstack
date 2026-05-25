-- Idempotent: creates the `glitchtip` database in the shared Postgres
-- instance. Mounted into postgres's /docker-entrypoint-initdb.d/ ONLY
-- when the glitchtip overlay is active. The init scripts run exactly
-- once, the first time the postgres data volume is initialized.
SELECT 'CREATE DATABASE glitchtip'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'glitchtip')\gexec
