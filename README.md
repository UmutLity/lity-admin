# Lity Admin Panel

Modern admin panel for Lity Software - built with Next.js 14, TypeScript, Tailwind CSS, and shadcn/ui.

## Features

- **Authentication**: NextAuth with Credentials provider, JWT sessions
- **RBAC**: Admin and Editor roles with granular permissions
- **Product Management**: Full CRUD with status badges, pricing plans, quick status change
- **Changelog System**: Markdown support, draft/publish, product relations
- **Site Settings**: Runtime-configurable site name, hero text, social links, theme
- **Media Library**: Image upload, gallery view, copy URL
- **User Management**: Create, activate/deactivate, delete users (Admin only)
- **Audit Log**: Full activity tracking with before/after diffs
- **Modern UI**: Dark theme, responsive, toast notifications, loading states

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js v4
- **Validation**: Zod
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### 1. Install dependencies

```bash
cd lity-admin
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your values:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/lity_admin?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-secret-here"
```

Generate a secret:
```bash
openssl rand -base64 32
```

### 3. Setup database

```bash
# Generate Prisma client
npx prisma generate

# Create tables
npx prisma db push

# Seed with demo data
npm run db:seed
```

### 4. Start development server

```bash
npm run dev
```

Open [http://localhost:3000/admin](http://localhost:3000/admin)

### Demo Credentials

| Role   | Email                      | Password  |
|--------|----------------------------|-----------|
| Admin  | admin@litysoftware.shop    | admin123  |
| Editor | editor@litysoftware.shop   | editor123 |

## RBAC Permissions

| Resource     | Admin | Editor |
|--------------|-------|--------|
| Products     | ✅    | ✅     |
| Changelog    | ✅    | ✅     |
| Media        | ✅    | ✅     |
| Site Settings| ✅    | ❌     |
| Users        | ✅    | ❌     |
| Audit Log    | ✅    | ❌     |

## API Endpoints

### Public (no auth required)

| Method | Endpoint              | Description           |
|--------|-----------------------|-----------------------|
| GET    | /api/products         | Active products list  |
| GET    | /api/products/[slug]  | Product detail        |
| GET    | /api/changelog        | Published changelogs  |
| GET    | /api/settings         | Site settings (k/v)   |

### Admin (auth required)

| Method | Endpoint                          | Description              |
|--------|-----------------------------------|--------------------------|
| GET    | /api/admin/products               | All products             |
| POST   | /api/admin/products               | Create product           |
| GET    | /api/admin/products/[id]          | Product detail           |
| PUT    | /api/admin/products/[id]          | Update product           |
| DELETE | /api/admin/products/[id]          | Delete product           |
| PATCH  | /api/admin/products/[id]/status   | Quick status change      |
| GET    | /api/admin/changelog              | All changelogs           |
| POST   | /api/admin/changelog              | Create changelog         |
| PUT    | /api/admin/changelog/[id]         | Update changelog         |
| DELETE | /api/admin/changelog/[id]         | Delete changelog         |
| GET    | /api/admin/settings               | All settings             |
| PUT    | /api/admin/settings               | Update settings          |
| GET    | /api/admin/media                  | All media                |
| POST   | /api/admin/media                  | Upload file              |
| DELETE | /api/admin/media/[id]             | Delete media             |
| GET    | /api/admin/users                  | All users                |
| POST   | /api/admin/users                  | Create user              |
| PUT    | /api/admin/users/[id]             | Update user              |
| DELETE | /api/admin/users/[id]             | Delete user              |
| GET    | /api/admin/audit                  | Audit logs               |

## Production Security Notes

- Change `NEXTAUTH_SECRET` to a strong random value
- Set proper CSP headers in `next.config.js`
- Configure upload size limits via `UPLOAD_MAX_SIZE_MB`
- Input sanitization is handled by Zod validations
- Rate limiting is implemented for login attempts
- Passwords are hashed with bcrypt (12 rounds)
- Consider using S3-compatible storage for media in production
- Enable HTTPS in production
- Set `NEXTAUTH_URL` to your production URL

## Project Structure

```
lity-admin/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Seed data
├── src/
│   ├── app/
│   │   ├── admin/             # Admin panel pages
│   │   │   ├── login/
│   │   │   ├── products/
│   │   │   ├── changelog/
│   │   │   ├── settings/
│   │   │   ├── media/
│   │   │   ├── users/
│   │   │   └── audit/
│   │   ├── api/
│   │   │   ├── auth/          # NextAuth
│   │   │   ├── products/      # Public API
│   │   │   ├── changelog/     # Public API
│   │   │   ├── settings/      # Public API
│   │   │   └── admin/         # Protected admin API
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── admin/             # Admin-specific components
│   │   ├── ui/                # shadcn/ui components
│   │   └── providers.tsx
│   ├── lib/
│   │   ├── auth.ts            # NextAuth config + helpers
│   │   ├── prisma.ts          # Prisma client
│   │   ├── audit.ts           # Audit logging
│   │   ├── upload.ts          # File upload
│   │   ├── rate-limit.ts      # Rate limiter
│   │   ├── utils.ts           # Utilities
│   │   └── validations/       # Zod schemas
│   ├── types/                 # TypeScript types
│   └── middleware.ts          # Auth + RBAC middleware
├── .env.example
├── package.json
└── README.md
```
