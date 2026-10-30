"""Run pgTAP in a disposable database inside an existing LOCAL Supabase container.

Copies auth/storage structure only (no records), applies the repository migrations
to a fresh database, and always drops that database. Never resets the local app or
uses a linked/hosted project. Requires Docker and a running local Supabase stack.
"""

from pathlib import Path
import argparse
import re
import subprocess
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container", default="supabase_db_SGHomie")
    parser.add_argument("--output", type=Path, help="Save TAP output for the test report")
    args = parser.parse_args()
    database = "sghomie_test_" + uuid.uuid4().hex
    supabase = Path(__file__).resolve().parents[1] / "BackEnd" / "supabase"

    def docker(*command, sql=None):
        result = subprocess.run(
            ["docker", "exec", "-i", args.container, *command],
            input=sql, capture_output=True, text=True,
        )
        if result.returncode:
            raise RuntimeError(result.stderr.strip() or "Docker test command failed")
        return result.stdout

    def psql(sql, db=database):
        return docker("psql", "-X", "-U", "postgres", "-d", db,
                      "-v", "ON_ERROR_STOP=1", "-At", sql=sql)

    # Only pre-data structure: existing application policies/data are excluded.
    base = docker("pg_dump", "-U", "postgres", "-d", "postgres",
                  "--schema-only", "--section=pre-data", "--schema=auth",
                  "--schema=storage", "--no-owner", "--no-privileges")
    created = False
    try:
        psql(f'CREATE DATABASE "{database}" TEMPLATE template0;', db="postgres")
        created = True
        psql('CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions; '
             'CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;')
        psql(base)
        # pg_dump pre-data omits keys. The application FK needs this real key;
        # auth/storage post-data is excluded because it contains app policies.
        psql('ALTER TABLE auth.users ADD PRIMARY KEY (id); '
             'ALTER TABLE storage.buckets ADD PRIMARY KEY (id); '
             'ALTER TABLE storage.objects ADD PRIMARY KEY (id); '
             'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;')
        # Match Supabase's public Data API default grants. Policies and triggers
        # themselves come exclusively from the real application migrations.
        psql('GRANT USAGE ON SCHEMA public, auth, storage, extensions TO anon, authenticated, service_role; '
             'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role; '
             'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role; '
             'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;')
        migrations = sorted((supabase / "migrations").glob("*.sql"))
        for migration in migrations:
            psql(migration.read_text())
        print(f"Applied {len(migrations)} repository migrations in an isolated local test database.")
        output = []
        for case_file in sorted((supabase / "tests" / "database").glob("*.sql")):
            result = psql(case_file.read_text())
            plans = re.findall(r"^1\.\.(\d+)$", result, re.MULTILINE)
            assertions = re.findall(r"^(?:ok|not ok) \d+\b", result, re.MULTILINE)
            if len(plans) != 1 or int(plans[0]) != len(assertions):
                raise RuntimeError(f"Incomplete TAP output in {case_file.name}")
            output.append(result)
        if not output:
            raise RuntimeError("No database test files found")
        tap = "\n".join(output)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(tap)
        print(tap)
        if re.search(r"^(not ok\b|Bail out!)", tap, re.MULTILINE):
            return 1
        return 0
    finally:
        if created:
            psql(f'DROP DATABASE "{database}" WITH (FORCE);', db="postgres")


if __name__ == "__main__":
    raise SystemExit(main())
