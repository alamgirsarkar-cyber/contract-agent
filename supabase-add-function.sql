-- Minimal setup: Create template_embeddings table and match_templates function
-- This enables RAG/vector search WITHOUT touching your existing templates table
-- Run this in Supabase SQL Editor

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create template_embeddings table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS template_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create index for vector similarity search
CREATE INDEX IF NOT EXISTS template_embeddings_embedding_idx
ON template_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 4. Enable Row Level Security and allow public access
ALTER TABLE template_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on template_embeddings" ON template_embeddings;
DROP POLICY IF EXISTS "Allow public insert on template_embeddings" ON template_embeddings;
DROP POLICY IF EXISTS "Allow public update on template_embeddings" ON template_embeddings;

CREATE POLICY "Allow public read access on template_embeddings"
  ON template_embeddings FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on template_embeddings"
  ON template_embeddings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on template_embeddings"
  ON template_embeddings FOR UPDATE
  USING (true);

-- 5. Create the match_templates function for RAG vector search
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

-- Done! RAG/Vector search is now enabled
-- Next: Upload templates to populate the embeddings table
