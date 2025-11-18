# Inventory Backend (Express + MongoDB)

This service replaces the Supabase SQL layer with a modular Node.js/Express backend that fits a MERN stack deployment. It provides REST APIs for authentication, user and role management, inventory catalog maintenance, purchasing, sales, reporting dashboards, and supporting reference data. The backend is intentionally decoupled from the existing React frontend—no frontend integration code is included.

## Features

- Authentication & authorization via JWT access/refresh tokens, bcrypt password hashing, and role-based permission checks.
- Company-scoped domain models (users, roles, suppliers, categories, items, stores, customers, inventory, purchase orders, and sales invoices).
- Modular project structure with dedicated folders for configuration, models, controllers, routes, middlewares, services, and utilities.
- Consistent CRUD APIs with filtering, pagination, search, and soft-delete behaviour where applicable.
- Dashboard aggregates mimicking the previous Supabase reports (inventory metrics, purchase order totals, time series sales, stock alerts).
- Request validation using `express-validator`, centralized error handling, rate-limiting, and logging via `pino`.

## Project Structure

```
inventoryBackend/
├─ src/
│  ├─ app.ts                # Express app factory
│  ├─ index.ts              # Entry point / bootstrap
│  ├─ config/               # Environment + database configuration
│  ├─ controllers/          # Route handlers
│  ├─ middlewares/          # Auth, validation, error handlers
│  ├─ models/               # Mongoose schemas
│  ├─ routes/               # Versioned API routes
│  ├─ services/             # Token service, helpers
│  ├─ utils/                # Async wrapper, logger, pagination helpers
│  └─ types/                # Express type augmentation
├─ package.json
├─ tsconfig.json
├─ .eslintrc.cjs
└─ env.example             # Sample environment variables
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the sample env file and adjust values as necessary:

```bash
cp env.example .env
```

Set at minimum:

- `MONGODB_URI` – MongoDB connection string
- `JWT_SECRET` and `REFRESH_TOKEN_SECRET` – strong random secrets
- `PASSWORD_SALT_ROUNDS` – bcrypt cost factor (defaults to 10)

### 3. Seed the developer Super Admin (optional)

A developer-only `Super Admin` role and user can be created via the seed script. This role is hidden from the UI but retains full access for troubleshooting.

```bash
npm run seed:superadmin
```

Credentials created by the seed:

- Email: `superadmin@gmail.com`
- Password: `superadmin`

### 4. Run in development

```bash
npm run dev
```

This uses `ts-node-dev` for hot reloading. The API listens on `http://localhost:5000` by default.

### 5. Build & run in production

```bash
npm run build
npm start
```

The build step compiles TypeScript into the `dist/` directory. The `start` script runs the compiled JavaScript with Node.

## Authentication Flow

- `POST /api/v1/auth/register` – bootstrap a new company + super admin user.
- `POST /api/v1/auth/login` – authenticate and receive access/refresh tokens.
- `POST /api/v1/auth/refresh` – rotate tokens using a valid refresh token.
- `POST /api/v1/auth/logout` – revoke a refresh token.
- `GET /api/v1/auth/me` – fetch the session user profile.
- `POST /api/v1/auth/change-password` – update password for the authenticated user.

All protected routes expect an `Authorization: Bearer <token>` header. Roles declare permissions (e.g. `manage_users`, `manage_inventory`); a wildcard `*` grants full access.

## Available API Groups

- `/api/v1/users` – manage company users (CRUD, filters, pagination).
- `/api/v1/roles` – manage role definitions and permissions.
- `/api/v1/suppliers` – supplier records with status tracking.
- `/api/v1/categories` & `/api/v1/items` – product catalog management.
- `/api/v1/stores` – warehouse/store definitions.
- `/api/v1/customers` – customer directory.
- `/api/v1/inventory` – per-store stock levels, SKU pricing, and adjustments.
- `/api/v1/purchase-orders` – purchase order lifecycle with line-item totals.
- `/api/v1/sales-invoices` – sales documents with pricing, discounts, and tax.
- `/api/v1/dashboard` – aggregated metrics for dashboards and alerts.

Refer to the route definitions in `src/routes` for validation rules and request/response formats.

## Notes & Next Steps

- The backend does not seed data; integrate a seeding script or migration layer if you need initial roles/items.
- Add automated tests (unit + integration) before deployment.
- Configure CI to run `npm run lint` and `npm run build`.
- Hook these endpoints into the React frontend by replacing the Supabase service calls with HTTP requests.

This backend is self-contained and ready to serve as the Node/Express layer for the inventory system in a MERN architecture.

