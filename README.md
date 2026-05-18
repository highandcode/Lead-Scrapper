# Clinic Lead Intelligence System
### by [clinicgrowthwithankit.com](https://clinicgrowthwithankit.com)

AI-powered clinic lead discovery, scoring, and outreach platform.

---

## Quick Start

### 1. Clone & Install
```bash
git clone <repo>
cd clinic-lead-intelligence
npm install
```

### 2. Set Up Environment Variables
```bash
cp .env.example .env.local
```
Fill in your keys (see below).

### 3. Set Up Supabase Database
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor**
3. Paste and run the contents of `supabase/schema.sql`

### 4. Run Locally
```bash
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI (GPT-4o-mini for cost-efficiency)
OPENAI_API_KEY=sk-...

# Apify (for Google Maps + Instagram scraping)
APIFY_API_TOKEN=apify_api_...

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## How to Get API Keys

### Supabase
1. Go to [supabase.com](https://supabase.com) → New Project
2. Settings → API → copy `URL`, `anon key`, `service_role key`

### OpenAI
1. Go to [platform.openai.com](https://platform.openai.com)
2. API Keys → Create new key

### Apify
1. Go to [apify.com](https://apify.com) → Sign up (free tier available)
2. Settings → Integrations → API token

---

## Usage Workflow

### Step 1: Find Leads
→ Navigate to **Find Leads**  
→ Select city + clinic type (e.g., "Dermatologist", "Mumbai")  
→ Click **Find Leads** — scrapes Google Maps via Apify

### Step 2: Analyze Leads
→ Go to **All Leads**  
→ Select multiple leads → **Analyze All** (batch AI analysis)  
→ Or click a lead → **Run Analysis** (single)

AI analysis does:
- Website crawl and gap detection
- Instagram discovery
- Lead scoring (1–100)
- Outreach message generation

### Step 3: Review & Outreach
→ Click any lead → **Outreach Messages** tab  
→ Copy Instagram DM / WhatsApp / Email  
→ Manually send (always review before sending)

### Step 4: Track Pipeline
→ Update lead status: New → Contacted → Replied → Meeting Set → Closed  
→ Add notes to each lead  
→ Export CSV for reporting

---

## Lead Score Interpretation
| Score | Meaning |
|-------|---------|
| 80–100 | 🔥 Hot lead — poor marketing, big opportunity |
| 60–79 | 🟡 Good lead — some gaps you can fill |
| 40–59 | 🟠 Moderate — needs specific niche pitch |
| 1–39 | ⚪ Low priority — already well-marketed |

**Higher score = worse their marketing = bigger opportunity for your agency**

---

## Deployment

### Vercel (Frontend + API Routes)
```bash
npm install -g vercel
vercel
# Add all env vars in Vercel dashboard
```

### Environment Variables in Vercel
1. Project Settings → Environment Variables
2. Add all variables from `.env.example`

---

## Tech Stack
- **Frontend:** Next.js 14, TailwindCSS, shadcn/ui, Framer Motion
- **Backend:** Next.js API Routes (serverless)
- **Database:** Supabase (PostgreSQL)
- **AI:** OpenAI GPT-4o-mini
- **Scraping:** Apify (Google Maps + Instagram actors)

---

## Important Notes
- This tool is for **manual outreach assistance only** — never auto-send messages
- Respect Instagram and Google rate limits — use delays between scrapes
- Always personalize AI-generated messages before sending
- Apify free tier: ~10k actor compute units/month (sufficient for testing)

---

## Folder Structure
```
src/
├── app/                    # Next.js 14 App Router
│   ├── (dashboard)/       # All dashboard pages
│   │   ├── dashboard/     # Home dashboard
│   │   ├── search/        # Lead search
│   │   ├── leads/         # Leads table + [id] detail page
│   │   └── export/        # CSV export
│   └── api/               # API routes
│       ├── leads/          # CRUD for leads
│       ├── scrape/maps/    # Google Maps scraper
│       ├── analyze/        # AI analysis trigger
│       ├── outreach/       # Outreach message generator
│       └── export/         # CSV export
├── components/
│   ├── ui/                # Base UI components
│   ├── dashboard/         # Sidebar, Header, StatsCards
│   ├── search/            # SearchPanel
│   ├── leads/             # LeadsTable, AnalysisPanel, OutreachPanel
│   └── shared/            # ScoreRing, etc.
├── services/
│   ├── scraping/          # Google Maps, Instagram, Website
│   ├── ai/                # Scorer, Analyzer, Outreach
│   └── export/            # CSV generator
├── lib/                   # Supabase, OpenAI, Apify clients
└── types/                 # TypeScript types
```
