# Supabase Vector Database Setup for Templates

This guide will help you set up Supabase to store templates in a vector database.

## Prerequisites

- Supabase account and project created
- `SUPABASE_URL` and `SUPABASE_KEY` already configured in your `.env` file ✅

## Setup Steps

### 1. Run the Migration SQL

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the entire content from `supabase-migration.sql`
6. Click **Run** to execute the migration

This will create:
- `templates` table - stores all template data
- `template_embeddings` table - stores vector embeddings
- Indexes for performance
- `increment_template_usage()` function
- `match_templates()` function for vector similarity search
- Row Level Security policies

### 2. Verify Tables Created

In the Supabase Dashboard:
1. Go to **Table Editor**
2. You should see:
   - `templates`
   - `template_embeddings`

### 3. Test the Integration

Restart your application:
```bash
npm run dev
```

Try creating a template:
- Go to your application
- Upload or create a new template
- The template will now be stored in Supabase instead of memory

### 4. Verify Data in Supabase

1. Go to Supabase Dashboard > **Table Editor**
2. Click on `templates` table
3. You should see your newly created templates

## How It Works

### Before (Memory Storage)
- Templates stored in RAM (lost on server restart)
- Only embeddings stored in Supabase

### After (Vector Database Storage)
- **Template data**: Stored in Supabase `templates` table (persistent)
- **Embeddings**: Stored in Supabase `template_embeddings` table (for RAG/vector search)
- Both are linked via `template_id`

## Architecture

```
User uploads template
       ↓
   routes.ts
       ↓
storage.createTemplate() → Supabase templates table
       ↓
generateEmbedding()
       ↓
storeTemplateEmbedding() → Supabase template_embeddings table (vector)
```

## Features

✅ Persistent template storage (survives restarts)
✅ Vector similarity search for RAG
✅ Usage tracking
✅ Category-based organization
✅ Scalable cloud storage

## Troubleshooting

### Templates not appearing?
- Check Supabase dashboard > Table Editor > templates
- Verify `SUPABASE_URL` and `SUPABASE_KEY` in `.env`
- Check server logs for errors

### Vector search not working?
- Ensure `match_templates()` function exists (run migration again)
- Verify embeddings are being generated and stored
- Check embedding dimensions match (default: 768 for nomic-embed-text)

### RLS (Row Level Security) Issues?
- The migration creates public policies for development
- For production, implement proper authentication-based policies

## Next Steps (Optional)

Want to also migrate contracts and validations to Supabase? The storage class is ready - just need to create the tables in Supabase!

## Support

If you encounter issues:
1. Check server console logs
2. Verify Supabase connection in the logs
3. Check Supabase dashboard for errors
