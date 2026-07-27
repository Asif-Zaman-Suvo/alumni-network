# School Alumni Website - Implementation Plan

## Context
Building a modern school alumni networking platform focused on connecting alumni through profiles and a searchable directory. The user has advanced technical experience and prefers a modern JavaScript stack (Next.js, React, Node.js).

## Requirements

### Core Features
1. **User Profiles**
   - Alumni can create and manage detailed profiles
   - Education history, graduation year, degree
   - Professional information (company, role, LinkedIn)
   - Profile photos
   - Privacy settings for profile visibility

2. **Alumni Directory**
   - Searchable database of all registered alumni
   - Filter by graduation year, department, location
   - Browse functionality
   - View other alumni profiles (respecting privacy settings)

### Additional Considerations
- Authentication system (registration, login, password recovery)
- Admin panel for managing users and content
- Responsive design (mobile-friendly)
- Data privacy and security
- Future-proof architecture for potential feature expansion

## Recommended Tech Stack

### Frontend
- **Next.js (Latest Stable)** - Latest version with App Router, React 19 support, and improved performance
- **React 19** - Latest React with enhanced features
- **TypeScript** - Type safety and better developer experience
- **Tailwind CSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Accessible component library built on Radix UI

### Backend
- **Next.js API Routes** - Serverless functions for API endpoints
- **Prisma ORM** - Type-safe database access
- **PostgreSQL** - Robust relational database (alternatives: MySQL, SQLite for development)

### Authentication
- **NextAuth.js v5 (Auth.js)** - Authentication library for Next.js
- Supports email/password and **Google OAuth**

### Deployment
- **Vercel** - Best integration with Next.js
- **Supabase** - Managed PostgreSQL database with built-in features

### Development Tools
- **ESLint + Prettier** - Code quality and formatting
- **Husky + lint-staged** - Git hooks for pre-commit checks

## Architecture Overview

```
alumni-site/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/            # Auth route group
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── layout.tsx
│   │   ├── (main)/            # Main application routes
│   │   │   ├── directory/
│   │   │   ├── profile/
│   │   │   └── page.tsx
│   │   ├── api/               # API routes
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   └── search/
│   │   └── layout.tsx
│   ├── components/            # Reusable components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── auth/
│   │   ├── profile/
│   │   └── directory/
│   ├── lib/                  # Utilities and configurations
│   │   ├── auth.ts           # NextAuth configuration
│   │   ├── prisma.ts         # Prisma client
│   │   └── utils.ts
│   └── types/                # TypeScript types
├── prisma/
│   └── schema.prisma         # Database schema
└── public/                    # Static assets
```

## Database Schema Design

```prisma
// Prisma Schema Overview

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  password      String?
  image         String?
  role          Role      @default(ALUMNI)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  profile       Profile?
  accounts      Account[]
  sessions      Session[]
}

model Profile {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])

  // Education
  graduationYear  Int?
  degree          String?
  department      String?

  // Professional
  company         String?
  position        String?
  linkedInUrl     String?

  // Location
  city            String?
  country         String?

  // Privacy
  visibility      Privacy  @default(PUBLIC)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum Role {
  ADMIN
  ALUMNI
}

enum Privacy {
  PUBLIC
  REGISTERED_ONLY
  PRIVATE
}
```

## Implementation Phases

### Phase 1: Project Setup & Core Infrastructure
1. Initialize Next.js project with TypeScript
2. Set up Prisma with PostgreSQL
3. Configure Tailwind CSS and shadcn/ui
4. Set up project structure and base layouts
5. Configure ESLint and Prettier

### Phase 2: Authentication System
1. Install and configure NextAuth.js v5
2. Create database schema for users
3. Implement registration flow (email/password)
4. Configure **Google OAuth** provider
5. Implement login/logout functionality
6. Add password recovery
7. Create protected route middleware
8. Build auth UI components (login form, register form, OAuth buttons)

### Phase 3: User Profile System
1. Create Profile model in Prisma schema
2. Build profile creation/editing flow
3. Implement **optional** profile photo upload (using UploadThing or Vercel Blob)
4. Add profile visibility settings
5. Create profile viewing pages
6. Build profile editing interface

### Phase 4: Alumni Directory
1. Create directory listing page with grid/list views
2. Implement search functionality (name, year, department)
3. Add advanced filters (graduation year range, location, etc.)
4. Build pagination for large result sets
5. Implement privacy-aware profile display
6. Add sorting options

### Phase 5: Admin Panel
1. Create admin authentication and role-based access
2. Build user management interface
3. Add content moderation capabilities
4. Create analytics dashboard (basic stats)

### Phase 6: Polish & Launch
1. Add error handling and loading states
2. Implement SEO optimization
3. Add analytics tracking
4. Performance optimization
5. Set up deployment pipeline
6. Configure environment variables
7. Launch testing

## Key Libraries to Use

| Purpose | Library |
|---------|---------|
| Authentication | NextAuth.js v5 |
| Database ORM | Prisma |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Forms | React Hook Form + Zod validation |
| File Uploads | uploadthing or Vercel Blob |
| Date Handling | date-fns |
| Icons | Lucide React |

## Environment Variables

```env
# Database (Supabase)
DATABASE_URL="postgresql://...@...supabase.co/..."
DIRECT_URL="postgresql://...@...pooler.supabase.com:6543/..."

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# File Uploads
UPLOADTHING_SECRET=""
UPLOADTHING_APP_ID=""
```

## Verification Plan

1. **Testing Strategy**
   - Unit tests for utility functions
   - Integration tests for API routes
   - E2E tests with Playwright for critical flows

2. **Manual Testing Checklist**
   - [ ] User registration flow works
   - [ ] Email verification (if implemented)
   - [ ] Login/logout functionality
   - [ ] Profile creation and editing
   - [ ] Directory search and filters
   - [ ] Privacy settings respected
   - [ ] Admin panel accessible
   - [ ] Mobile responsive design
   - [ ] All forms have proper validation

3. **Deployment Verification**
   - [ ] Environment variables configured
   - [ ] Database migrations run successfully
   - [ ] OAuth providers configured (if used)
   - [ ] Production build runs without errors
