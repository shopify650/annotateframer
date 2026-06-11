# Remark 📌

**Client collaboration & commenting plugin for Framer.**  
Agencies install it → clients visit the live URL → click anywhere → leave pinned comments.

---

## 📁 Project Location

```
C:\Users\Muhammad hamza\.gemini\antigravity\scratch\annotateframe\
├── src/                        ← Framer Plugin UI (React + TypeScript)
│   ├── main.tsx                ← Entry point
│   ├── App.tsx                 ← Auth gate
│   ├── globals.css             ← Premium dark UI styles
│   ├── types.ts                ← Shared TypeScript types
│   ├── lib/
│   │   ├── supabase.ts         ← Supabase client
│   │   └── inject.ts           ← framer.setCustomCode() injection
│   └── components/
│       ├── Setup.tsx           ← Login / Signup screen
│       ├── Dashboard.tsx       ← Main dashboard (tabs, comments, realtime)
│       ├── CommentThread.tsx   ← Comment card with replies
│       ├── InviteLink.tsx      ← Client review link + QR
│       └── Settings.tsx        ← Account, project, pricing
├── client-script/              ← Injected script (vanilla TS → CDN)
│   └── src/index.ts            ← Full click-to-comment engine
├── backend/
│   ├── schema.sql              ← Full Supabase DB schema + RLS + indexes
│   └── functions/
│       ├── send-notification/  ← Email on new comment (Resend)
│       └── resolve-comment/    ← Email client when resolved
└── .env                        ← Add your Supabase credentials here
```

---

## 🚀 Quick Start

### 1. Add Supabase Credentials
Edit `.env`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 2. Set Up Database
- Go to [supabase.com](https://supabase.com) → your project → SQL Editor
- Paste and run the contents of `backend/schema.sql`

### 3. Run the Plugin Dev Server
```bash
cd annotateframe
npm run dev
```

### 4. Open in Framer
- Open Framer → **Main Menu → Plugins → Development → Open Development Plugin**
- URL: `https://localhost:5173`

### 5. Build & Deploy Client Script
```bash
cd client-script
npm install
npm run build
# Upload build/remark.min.js to your CDN
# Update the URL in src/lib/inject.ts
```

### 6. Deploy Edge Functions
```bash
supabase functions deploy send-notification
supabase functions deploy resolve-comment
supabase secrets set RESEND_API_KEY=re_your_key
```

---

---

## 📦 Version History

### v1.0.0 (Latest Release)
- **Google OAuth Database Relay Flow**: Resolved Framer OAuth popup limitations (COOP/COEP) by introducing `public/callback.html` which writes session tokens directly to `login_sessions` table in Supabase, and a polling handshake in `Setup.tsx`.
- **Simplified Upgrade Flow**: Replaced the multi-plan pricing grid with a single high-converting "Upgrade to Pro" button in the Settings panel linked directly to Whop Checkout.
- **Improved Alert Design**: Redesigned all banners (such as Domain Mismatch warnings and Monthly Limit reminders) with soft gradients, rounded badge icons, and high contrast typography.

---

## 💰 Pro Plan Upgrade (via Whop)

- **Pro Plan Subscription:** $25/mo
- **Features:** Unlimited projects, unlimited comments, reply to clients, custom domains.
- ⚠️ **Important:** Users must sign up on Whop using the same email address as in this plugin to ensure automatic subscription sync.
- 🛒 **Checkout Link:** https://whop.com/buildhaus-templates/annotate-framer-15/

---

## 🔑 How It Works

```
Agency installs plugin in Framer editor
  → Plugin injects script via framer.setCustomCode()
  → Agency shares invite link with client
  → Client visits link → commenting toolbar activates
  → Client clicks anywhere → pin drops → comment saved to Supabase
  → Agency gets email → sees it in dashboard → replies/resolves
  → Client gets "Resolved" email ✅
```
