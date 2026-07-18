# Prisma and PostgreSQL report

## Current configuration

The project uses Prisma ORM 7.8.0 with PostgreSQL through `@prisma/adapter-pg`.

- `DATABASE_URL` is the **runtime** connection used by `lib/client.ts` for application queries, scheduler jobs, and API routes.
- `DIRECT_URL` is the **migration/admin** connection used by `prisma.config.ts` for `prisma migrate deploy`, introspection, and other Prisma CLI database operations.
- In local development both values may point at the same local PostgreSQL database.
- In production with Prisma Postgres, `DATABASE_URL` must be the pooled URL and `DIRECT_URL` must be the direct URL.

This separation prevents migrations from running through a transaction pooler, where advisory locks and session behaviour can fail. It also prevents the production application from needlessly consuming direct database connections.

## Production files added

- `prisma.config.ts` now requires `DIRECT_URL` for Prisma CLI migrations.
- `.env.production.example` documents the production-only database variables without exposing credentials.
- `.env.example` now contains `DIRECT_URL` for local development.
- The ignored local `.env` has a matching local `DIRECT_URL`.

Never commit a real `.env.production` file or production connection strings.

## Recommended production database: Prisma Postgres

Prisma provides **Prisma Postgres**, a managed PostgreSQL service. It is the recommended option for this project because it is PostgreSQL-compatible, works directly with the existing Prisma ORM schema and migrations, includes connection pooling, and provides daily backups with point-in-time recovery.

Create a Prisma Postgres database in Prisma Console, then select **Connect** and generate both connection strings. Store them in the secret manager of the platform that hosts the Next.js application:

```env
# Runtime queries: pooled connection
DATABASE_URL="postgres://USER:PASSWORD@pooled.db.prisma.io:5432/postgres?sslmode=require"

# Migrations and administrative commands: direct connection
DIRECT_URL="postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require"
```

`sslmode=require` is mandatory for Prisma Postgres. URL-encode any reserved characters in credentials. Do not swap the two URLs: pooled connections are for runtime traffic; direct connections are for migrations and tools.

## Deployment procedure

1. Create separate Prisma Postgres databases for staging and production. Do not let staging share production credentials or data.
2. Add `DATABASE_URL`, `DIRECT_URL`, and all existing application secrets from `.env.example` to the hosting provider's secret manager. Set `NODE_ENV=production`.
3. Commit every generated migration under `prisma/migrations`. Generate schema changes locally with `bun run prisma:migrate --name descriptive_change`; review the SQL before merging.
4. In CI/CD, install dependencies from the lockfile and build the application:

   ```powershell
   bun install --frozen-lockfile
   bun run build
   ```

5. Run migrations exactly once per release, before application instances are started:

   ```powershell
   bun run prisma:deploy
   ```

   This command uses `DIRECT_URL` and applies only committed pending migrations. Do not run `prisma migrate dev`, `db push`, or `migrate reset` against production.
6. Start the release with `bun run start`. Do not run the current test-user seed in production.
7. Confirm application health and watch migration/database logs. Use forward-only corrective migrations for rollback wherever possible; restoring a database backup is a last resort.

## Alternatives

If Prisma Postgres does not meet regional, compliance, pricing, or vendor requirements, use a managed PostgreSQL service such as Neon, Supabase, AWS RDS, Google Cloud SQL, Azure Database for PostgreSQL, or a managed Postgres offering from the application host. The same principles apply: TLS required, private/restricted network access where possible, backups/PITR enabled, a least-privilege application role, a pooled runtime URL where applicable, and a direct migration URL.

For this Prisma-first Next.js project, Prisma Postgres is the simplest operational choice. Choose a major-cloud managed PostgreSQL service when your organisation already requires a particular cloud, VPC/private networking, regional residency, or enterprise compliance controls.

## Local database commands

After installing/running a local PostgreSQL server and setting matching local `DATABASE_URL` and `DIRECT_URL` values:

```powershell
bun run prisma:validate
bun run prisma:generate
bun run prisma:deploy
bun run prisma:seed
```

`prisma:deploy` applies the existing committed migrations to a fresh local database. Use `bun run prisma:migrate --name change_name` only when intentionally creating a new development migration.

## Version policy

Keep `prisma`, `@prisma/client`, and `@prisma/adapter-pg` on exactly the same version. The project currently pins all three to stable Prisma ORM `7.8.0`. Upgrade them together, regenerate the client, validate the schema, test migrations against staging, then deploy.