# SplitAI — AI-Powered Bill Splitting App

A production-ready mobile application built with React Native (Expo), Node.js, PostgreSQL, and OpenAI featuring real-time group expense management with AI-powered bill scanning and intelligent item allocation.

---

## 🏗️ Architecture Overview

```
splitwise-ai/
├── backend/                         # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts          # PostgreSQL pool + query helpers
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts   # Register, Login, Profile
│   │   │   ├── group.controller.ts  # CRUD + member management
│   │   │   ├── expense.controller.ts# Expenses + split calculation
│   │   │   ├── balance.controller.ts# Balance engine
│   │   │   ├── settlement.controller.ts
│   │   │   ├── chat.controller.ts   # AI Chat + commands
│   │   │   └── bill.controller.ts   # Bill upload + Vision OCR
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts   # JWT + group auth guards
│   │   │   ├── error.middleware.ts  # Global error handler
│   │   │   ├── validate.middleware.ts
│   │   │   └── notFound.middleware.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── group.routes.ts
│   │   │   ├── expense.routes.ts
│   │   │   ├── balance.routes.ts
│   │   │   ├── settlement.routes.ts
│   │   │   ├── chat.routes.ts
│   │   │   └── bill.routes.ts
│   │   ├── services/
│   │   │   ├── ai.service.ts        # OpenAI Vision + GPT-4o integration
│   │   │   ├── balance.service.ts   # Greedy transaction minimization
│   │   │   └── socket.service.ts    # Socket.io real-time events
│   │   ├── utils/
│   │   │   └── logger.ts            # Winston logger
│   │   └── server.ts                # Express app + HTTP server
│   └── migrations/
│       └── 001_initial.sql          # Complete PostgreSQL schema
│
├── frontend/                        # React Native + Expo SDK 51
│   ├── App.tsx                      # Entry point
│   └── src/
│       ├── navigation/
│       │   ├── RootNavigator.tsx    # Auth vs App branching
│       │   ├── AuthNavigator.tsx    # Login/Register stack
│       │   └── AppNavigator.tsx     # Main app with tab bar
│       ├── screens/
│       │   ├── AuthScreen.tsx       # Login + Register with animations
│       │   ├── HomeScreen.tsx       # Groups dashboard
│       │   ├── GroupScreen.tsx      # Group detail + expenses
│       │   ├── AddExpenseScreen.tsx # Add expense with split modes
│       │   ├── ChatScreen.tsx       # AI chat + bill scanning
│       │   ├── BalanceScreen.tsx    # Global balance overview
│       │   ├── SettlementScreen.tsx # Settle up with animation
│       │   ├── CreateGroupScreen.tsx# Group creation
│       │   └── ProfileScreen.tsx    # User settings
│       ├── components/
│       │   └── index.tsx            # Avatar, GlassCard, Button, etc.
│       ├── navigation/
│       ├── services/
│       │   ├── api.ts               # Axios client + all API calls
│       │   ├── api.extensions.ts    # Additional endpoints
│       │   └── socket.ts            # Socket.io client
│       ├── store/
│       │   └── index.ts             # Zustand stores (auth, groups, expenses, chat)
│       ├── theme/
│       │   └── index.ts             # B&W luxury design tokens
│       └── utils/
│           └── formatters.ts        # Currency, date, string formatters
│
└── shared/
    └── types.ts                     # Shared TypeScript interfaces
```

---

## 🚀 Tech Stack

| Layer      | Technology                            |
|------------|---------------------------------------|
| Mobile     | React Native 0.74 + Expo SDK 51       |
| Backend    | Node.js 20 + Express 4 + TypeScript   |
| Database   | PostgreSQL 15 (via Supabase)          |
| ORM        | `pg` with typed query helpers         |
| Auth       | JWT (bcrypt passwords)                |
| Storage    | Cloudinary (bill images)              |
| AI         | OpenAI GPT-4o Vision + GPT-4o        |
| Real-time  | Socket.io 4                           |
| State      | Zustand 4                             |
| Animations | React Native Animated + Reanimated 3  |
| UI Theme   | Black & White minimal luxury          |

---

## 📦 Quick Start

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials

npm install
# Run PostgreSQL migrations
psql $DATABASE_URL -f migrations/001_initial.sql
# Start dev server
npm run dev
```

### 2. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Edit .env with your API URL

npm install
npx expo start
```

---

## 🔑 Environment Variables

### Backend `.env`
```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:8081

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
OPENAI_VISION_MODEL=gpt-4o

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

### Frontend `.env`
```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EXPO_PUBLIC_SOCKET_URL=http://localhost:3000
```

---

## 📊 Database Schema

**Core tables:**

| Table            | Purpose                                     |
|------------------|---------------------------------------------|
| `users`          | User profiles + auth                        |
| `groups`         | Expense groups with currency                |
| `group_members`  | User ↔ Group memberships (admin/member)     |
| `expenses`       | Expense records with split type             |
| `expense_splits` | Per-user split amounts (settled tracking)   |
| `settlements`    | Payment records + confirmation flow         |
| `bill_scans`     | AI-extracted receipt data (JSONB)           |
| `messages`       | AI chat history                             |
| `ai_sessions`    | Conversation state per group                |

---

## ⚡ API Reference

### Auth
```
POST /api/auth/register   — Create account
POST /api/auth/login      — Get JWT token
GET  /api/auth/me         — Current user
PATCH /api/auth/me        — Update profile
```

### Groups
```
GET    /api/groups              — My groups
POST   /api/groups              — Create group
GET    /api/groups/:id          — Group detail + members + balance
PATCH  /api/groups/:id          — Update group
DELETE /api/groups/:id          — Delete group
POST   /api/groups/:id/members  — Add member by email
DELETE /api/groups/:id/members/:userId
```

### Expenses
```
GET    /api/groups/:id/expenses          — Paginated expense list
POST   /api/groups/:id/expenses          — Create expense (equal/custom/pct/AI)
PUT    /api/expenses/:id                 — Update expense
DELETE /api/expenses/:id                 — Soft delete
```

### Balances
```
GET /api/groups/:id/balances  — Group balances (minimized graph)
GET /api/balances/all         — Global balances across all groups
```

### Settlements
```
POST /api/settlements                — Record settlement
PUT  /api/settlements/:id/complete   — Confirm receipt
GET  /api/groups/:id/settlements     — Group settlement history
```

### Chat + AI
```
GET  /api/groups/:id/messages     — Message history
POST /api/groups/:id/messages     — Send message
POST /api/groups/:id/ai-command   — Process AI command
```

### Bill Scanning
```
POST /api/expenses/scan-bill      — Upload image → Vision OCR
GET  /api/expenses/bill-scans/:id — Get scan result
```

---

## 🤖 AI Features Deep Dive

### Bill Scanning (GPT-4o Vision)
1. User uploads receipt image
2. Image uploaded to Cloudinary
3. GPT-4o Vision extracts: items, quantities, prices, tax, tip, total
4. Returns structured JSON saved to `bill_scans` table

### AI Chat Commands
| Command | Description |
|---------|-------------|
| `/split-equal` | Split active bill equally among all members |
| `/split-custom` | Prompt for custom amounts |
| `/analyze-bill` | Request bill upload and analyze |
| `/assign-items` | Interactive item → person assignment dialog |
| `/summary` | Natural language balance summary |

### Item Assignment Flow
```
User: /assign-items
AI: "Who had Margherita Pizza ($14.99)? [Alice, Bob, Carol]"
User: "Alice and Bob"
AI: "Who had Coke ($3.50)? [Alice, Bob, Carol]"
User: "Everyone"
AI: "Got it! Calculating splits... 
     Alice: $11.74 (Pizza ½ + Coke ⅓)
     Bob: $11.74 (Pizza ½ + Coke ⅓)
     Carol: $1.17 (Coke ⅓)"
```

### Balance Minimization Algorithm
Uses a **greedy creditor-debtor matching** algorithm:
1. Calculate net balance for each user (positive = owed, negative = owes)
2. Sort creditors and debtors by amount
3. Match largest creditor with largest debtor
4. Repeat until all settled
- O(n log n) time complexity
- Minimizes number of transactions

---

## 🎨 Design System

**Black & White Minimal Luxury**
- Pure `#000000` background
- `#FFFFFF` primary text + actions
- Glassmorphism cards with `rgba(255,255,255,0.04)` background
- Subtle `rgba(255,255,255,0.08)` borders
- `#22C55E` positive balances
- `#EF4444` negative balances
- Smooth spring animations throughout
- Floating action buttons with glow effect
- Blur-backed navigation bars

---

## 🔌 Socket.io Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `join:group` | Client→Server | `groupId` |
| `leave:group` | Client→Server | `groupId` |
| `chat:message` | Server→Client | `Message` |
| `ai:typing` | Server→Client | `{ typing: boolean }` |
| `expense:created` | Server→Client | `Expense` |
| `settlement:created` | Server→Client | `Settlement` |
| `settlement:completed` | Server→Client | `Settlement` |
| `balance:updated` | Server→Client | `BalanceSummary` |

---

## 🚢 Deployment

### Backend (Railway / Render / Fly.io)
```bash
npm run build
# Set environment variables in dashboard
# Deploy dist/ folder
```

### Frontend (Expo EAS)
```bash
npm install -g eas-cli
eas login
eas build --platform all
eas submit
```

### Database (Supabase)
1. Create new project at supabase.com
2. Run `migrations/001_initial.sql` in SQL editor
3. Copy connection string to `DATABASE_URL`

---

## 📱 Screens Overview

| Screen | Features |
|--------|----------|
| AuthScreen | Email/password login + register, field validation, smooth transitions |
| HomeScreen | Groups list with balance chips, total net balance header, pull-to-refresh |
| GroupScreen | Expense feed, member avatars, balance card, FAB, chat button |
| AddExpenseScreen | Manual entry, 4 split modes, paid-by selector, bill scan integration |
| ChatScreen | AI chat, command palette, bill upload, typing indicator, scan animation |
| BalanceScreen | Net balance summary, owe/owed tabs, settle button, pending confirmations |
| SettlementScreen | Payment method picker, confirmation animation with ripple effect |
| CreateGroupScreen | Emoji picker, currency selector, batch email invites |
| ProfileScreen | Avatar, stats, notification toggle, logout |
