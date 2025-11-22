-- FIX: Drop existing table and recreate with correct schema
-- Run this in Supabase SQL Editor

-- 1. Drop existing tables if they exist (this will delete any existing data)
DROP TABLE IF EXISTS template_embeddings CASCADE;
DROP TABLE IF EXISTS templates CASCADE;

-- 2. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 3. Create templates table with CORRECT schema
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  content TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  embedding TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create template_embeddings table for vector search
CREATE TABLE template_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create indexes for performance
CREATE INDEX templates_category_idx ON templates(category);
CREATE INDEX templates_usage_count_idx ON templates(usage_count DESC);
CREATE INDEX templates_created_at_idx ON templates(created_at DESC);

-- Create vector similarity search index
CREATE INDEX template_embeddings_embedding_idx
ON template_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 6. Create function to increment template usage
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

-- 7. Create vector search function
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

-- 8. Enable Row Level Security
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_embeddings ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies for public access
CREATE POLICY "Allow public read access on templates"
  ON templates FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on templates"
  ON templates FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on templates"
  ON templates FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete on templates"
  ON templates FOR DELETE
  USING (true);

CREATE POLICY "Allow public read access on template_embeddings"
  ON template_embeddings FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on template_embeddings"
  ON template_embeddings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on template_embeddings"
  ON template_embeddings FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete on template_embeddings"
  ON template_embeddings FOR DELETE
  USING (true);

-- Done! Your templates table is now ready
