-- Supabase Migration for Template Storage in Vector Database
-- Execute this SQL in your Supabase SQL Editor
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Create templates table to store all template data
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  content TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  embedding TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create template_embeddings table for vector search (already exists, but ensuring it's correct)
CREATE TABLE IF NOT EXISTS template_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS templates_category_idx ON templates(category);
CREATE INDEX IF NOT EXISTS templates_usage_count_idx ON templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS templates_created_at_idx ON templates(created_at DESC);

-- Create vector similarity search index
CREATE INDEX IF NOT EXISTS template_embeddings_embedding_idx
ON template_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 4. Create function to increment template usage
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE templates
  SET usage_count = usage_count + 1
  WHERE id = template_id;
END;
$$;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_embeddings ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for public access
-- Note: Adjust these policies based on your security requirements
-- For a production app, you'd want proper authentication

-- Allow public read access
CREATE POLICY "Allow public read access on templates"
  ON templates FOR SELECT
  USING (true);

-- Allow public insert access
CREATE POLICY "Allow public insert on templates"
  ON templates FOR INSERT
  WITH CHECK (true);

-- Allow public update access
CREATE POLICY "Allow public update on templates"
  ON templates FOR UPDATE
  USING (true);

-- Template embeddings policies
CREATE POLICY "Allow public read access on template_embeddings"
  ON template_embeddings FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on template_embeddings"
  ON template_embeddings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on template_embeddings"
  ON template_embeddings FOR UPDATE
  USING (true);

-- 7. Verify the match_templates function exists (for vector search)
-- This should already exist from your previous setup, but here's the complete version:
CREATE OR REPLACE FUNCTION match_templates(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  template_id UUID,
  content TEXT,
  similarity float,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    te.template_id,
    te.content,
    1 - (te.embedding <=> query_embedding) AS similarity,
    te.metadata
  FROM template_embeddings te
  WHERE 1 - (te.embedding <=> query_embedding) > match_threshold
  ORDER BY te.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Migration complete!
-- Your templates will now be stored in the Supabase vector database
