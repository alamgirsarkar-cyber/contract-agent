# Database Setup Guide

This guide explains how to set up and verify your Supabase database for the Contract Agent application.

## Overview

The application uses **Supabase** (PostgreSQL with pgvector) to store:
- **Templates**: Contract templates with metadata
- **Template Embeddings**: Vector embeddings for semantic search (RAG)

## Automatic Setup on Server Start ✨

**The server now automatically checks the database when it starts!**

When you run `npm run dev`, the server will:
1. ✅ Check if Supabase is configured
2. ✅ Verify if required tables exist
3. ✅ Display a clear status report
4. ✅ Provide instructions if setup is needed

### Example Output

```
🔍 Checking database status...

📊 Database Status:
  ├─ Supabase: ✅
  ├─ templates table: ✅
  ├─ template_embeddings table: ✅
  ├─ match_templates function: ✅
  └─ vector extension: ✅

✅ Database is ready!
```

## Initial Setup (First Time Only)

### Step 1: Configure Environment Variables

Make sure your `.env` file has:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-or-service-key
```

### Step 2: Run the Migration SQL

Since Supabase doesn't allow direct SQL execution from the client, you need to run the migration SQL manually **once**:

1. **Go to Supabase Dashboard**:
   ```
   https://supabase.com/dashboard
   ```

2. **Select your project**

3. **Open SQL Editor**:
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

4. **Copy and paste** the contents of `supabase-safe-migration.sql`

5. **Click "Run"** or press `Ctrl+Enter`

6. **Verify success** - you should see:
   - ✅ "Created templates table" (or "already exists")
   - ✅ "Created template_embeddings table" (or "already exists")
   - ✅ "Migration completed successfully!"

### Step 3: Verify Setup

Run the verification script:
```bash
npm run db:verify
```

Or:
```bash
npm run db:check
```

This will show you a detailed status of your database configuration.

## What Gets Created

### Tables

#### `templates`
Stores all template data:
- `id` (UUID) - Primary key
- `title` (TEXT) - Template name
- `category` (TEXT) - Template category
- `description` (TEXT) - Template description
- `content` (TEXT) - Template content
- `usage_count` (INTEGER) - How many times used
- `embedding` (TEXT) - Optional embedding storage
- `created_at` (TIMESTAMP) - Creation timestamp

#### `template_embeddings`
Stores vector embeddings for RAG:
- `id` (UUID) - Primary key
- `template_id` (UUID) - References templates(id)
- `content` (TEXT) - Content that was embedded
- `embedding` (vector(768)) - Vector embedding
- `metadata` (JSONB) - Additional metadata
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

### Indexes

- Category, usage_count, and created_at indexes for fast queries
- **IVFFlat vector index** for similarity search (pgvector)

### Functions

- `match_templates(query_embedding, threshold, count)` - Vector similarity search
- `increment_template_usage(template_id)` - Increment usage counter
- `update_updated_at_column()` - Auto-update updated_at timestamp

### Security

- **Row Level Security (RLS)** enabled on both tables
- **Public access policies** (for development)
  - For production, update these policies to require authentication

## Verification Commands

### Check Database Status
```bash
npm run db:verify
```

Shows detailed information about:
- Environment variables
- Database connection
- Table existence
- Function availability
- Extension status

### Start Development Server
```bash
npm run dev
```

The server will automatically check the database on startup and display the status.

## Troubleshooting

### ❌ "Supabase client not available"

**Problem**: `SUPABASE_URL` or `SUPABASE_KEY` not set

**Solution**: Check your `.env` file and ensure both variables are set correctly

### ❌ "Could not find the table 'template_embeddings'"

**Problem**: Migration SQL hasn't been run

**Solution**: Run the migration SQL in Supabase SQL Editor (see Step 2 above)

### ❌ "Cannot connect to Supabase"

**Problem**: Invalid credentials or network issue

**Solution**:
1. Verify your `SUPABASE_URL` and `SUPABASE_KEY`
2. Check if your Supabase project is active
3. Test connection in Supabase dashboard

### ❌ "match_templates function missing"

**Problem**: Function wasn't created

**Solution**: Re-run the migration SQL completely

### ⚠️ Vector extension missing

**Problem**: pgvector extension not enabled

**Solution**:
1. Go to Supabase Dashboard > Database > Extensions
2. Search for "vector"
3. Enable the extension
4. Or re-run the migration SQL (it includes `CREATE EXTENSION IF NOT EXISTS vector`)

## Migration Files

### `supabase-safe-migration.sql` (Recommended)
- ✅ Safe to run multiple times
- ✅ Checks if tables exist before creating
- ✅ Idempotent (won't duplicate data)
- ✅ Creates everything needed

### `supabase-migration.sql`
- Original migration file
- Creates tables with `IF NOT EXISTS`

### `supabase-fix-schema.sql` ⚠️
- **WARNING**: Drops and recreates tables
- **WILL DELETE ALL DATA**
- Only use if you need to completely reset

### `supabase-add-function.sql`
- Minimal setup
- Only creates `template_embeddings` table and functions
- Useful if you already have the `templates` table

## Development Workflow

1. **First time setup**:
   ```bash
   # Run migration SQL in Supabase dashboard (one time only)
   # Then verify
   npm run db:verify
   ```

2. **Daily development**:
   ```bash
   # Just start the server - it checks automatically!
   npm run dev
   ```

3. **Before deployment**:
   ```bash
   # Verify everything is configured
   npm run db:verify
   ```

## Production Checklist

Before deploying to production:

- [ ] Run migration SQL in production Supabase project
- [ ] Update RLS policies for authentication (remove public access)
- [ ] Set production environment variables
- [ ] Test vector search functionality
- [ ] Verify embedding storage works
- [ ] Test template creation and retrieval

## Architecture

```
User uploads template
       ↓
   routes.ts (POST /api/templates/upload)
       ↓
storage.createTemplate() → Supabase templates table
       ↓
generateEmbedding() → LLM provider (Ollama/Gemini/OpenAI)
       ↓
storeTemplateEmbedding() → Supabase template_embeddings table
       ↓
   Success response
```

## Need Help?

1. Run verification: `npm run db:verify`
2. Check server logs when starting: `npm run dev`
3. Review this guide
4. Check Supabase dashboard for errors

## Summary

✅ **Automatic checks** on server startup
✅ **Safe migration** SQL (run once)
✅ **Verification tools** (`npm run db:verify`)
✅ **Clear error messages** with instructions
✅ **Idempotent setup** (safe to run multiple times)
