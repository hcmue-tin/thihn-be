## Manual DB Migrations

This project currently uses manual SQL migrations.

Apply the session-based soft-reset migration:

```bash
mysql -h <host> -P <port> -u <user> -p <database> < migrations/20260422_add_session_columns.sql
```

Notes:
- Run from the backend root directory.
- The SQL is idempotent and can be re-run safely.
- Back up production database before schema changes.
