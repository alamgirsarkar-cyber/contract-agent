# Quick Start - Fix Database Error

## Problem
You're seeing this error:
```
Could not find the table 'public.template_embeddings' in the schema cache
```

## Solution (5 minutes)

### Step 1: Run Migration SQL in Supabase

1. **Open Supabase Dashboard**:
   - Go to: https://supabase.com/dashboard/project/yffkezvtjefhapvvckhr
   - Click **SQL Editor** (left sidebar)
   - Click **New Query**

2. **Copy the migration SQL**:
   - Open file: `supabase-safe-migration.sql`
   - Copy **ALL** contents (Ctrl+A, Ctrl+C)

3. **Paste and Run**:
   - Paste into Supabase SQL Editor
   - Click **Run** (or press Ctrl+Enter)
   - Wait for success message

### Step 2: Verify Setup

Run verification command:
```bash
npm run db:verify
```

You should see all green checkmarks ✅

### Step 3: Restart Server

```bash
npm run dev
```

The error should be gone! 🎉

## What This Does

The migration creates:
- ✅ `templates` table (stores template data)
- ✅ `template_embeddings` table (stores vector embeddings)
- ✅ Indexes for fast queries
- ✅ Functions for vector search
- ✅ Security policies

## Automatic Checks

From now on, **every time you start the server**, it will:
- ✅ Check if tables exist
- ✅ Show database status
- ✅ Warn if setup is incomplete

## Commands

```bash
# Check database status
npm run db:verify

# Start development server (auto-checks database)
npm run dev
```

## Need Help?

See detailed guide: `DATABASE_SETUP.md`
