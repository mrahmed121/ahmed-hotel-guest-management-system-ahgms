# AHGMS Production Deployment

## Requirements

- PHP 8.3+, Composer
- Node.js 18+ (for building the frontend)
- A web server (Nginx/Apache) + MySQL 8 or PostgreSQL 14+
  (SQLite is fine for demos; not recommended for concurrent production use)

## Backend

```bash
cd backend
composer install --no-dev --optimize-autoloader

cp .env.example .env
# Edit .env:
#   APP_ENV=production
#   APP_DEBUG=false
#   APP_URL=https://your-domain.com
#   DB_CONNECTION=mysql  (or pgsql)
#   DB_HOST, DB_DATABASE, DB_USERNAME, DB_PASSWORD
#   CACHE_STORE=redis / SESSION_DRIVER=redis (recommended)

php artisan key:generate --force
php artisan jwt:secret --force
php artisan migrate --force
php artisan config:cache
php artisan route:cache
```

Point the web server document root at `backend/public`.

### Seeding

Production should **not** run the demo seeder. Create your hotel, roles, and
admin user explicitly:

```bash
php artisan db:seed --class=RolePermissionSeeder
# then create the hotel + admin via tinker or a one-off seeder
```

## Frontend

```bash
cd frontend
npm install
npm run build        # outputs to frontend/dist/
```

Serve `dist/` as static files, or proxy `/api` to the Laravel backend from
your web server. Example Nginx fragment:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8001;
}
location / {
    root /var/www/ahgms/frontend/dist;
    try_files $uri $uri/ /index.html;
}
```

## Nightly billing

Nightly room charges are posted by `POST /api/v1/billing/nightly` (permission
`folios.manage`). Schedule it — e.g. a cron entry or Laravel scheduler entry
running shortly after midnight hotel time:

```bash
* * * * * cd /var/www/ahgms/backend && php artisan schedule:run >> /dev/null 2>&1
```

(Idempotent per folio/date — safe to re-run.)

## Backups

Back up the database nightly and `backend/storage` if document uploads are
enabled. Test restores quarterly.

## Checklist

- [ ] `APP_DEBUG=false`, `APP_ENV=production`
- [ ] Fresh `APP_KEY` and `JWT_SECRET` (never reuse demo values)
- [ ] No `.env` or `*.sqlite` committed to git
- [ ] HTTPS enforced, secure session cookies
- [ ] Nightly billing scheduled
- [ ] Backups verified
