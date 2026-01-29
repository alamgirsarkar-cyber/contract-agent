-- Safe Idempotent Migration Script
-- This script checks if tables exist before creating them
-- Can be run multiple times safely without dropping existing data
-- Execute this SQL in your Supabase SQL Editor

-- ============================================
-- 1. Enable Required Extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. Create Templates Table (if not exists)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'templates') THEN
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
        RAISE NOTICE 'Created templates table';
    ELSE
        RAISE NOTICE 'Templates table already exists';
    END IF;
END $$;

-- ============================================
-- 3. Create Template Embeddings Table (if not exists)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'template_embeddings') THEN
        CREATE TABLE template_embeddings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            template_id UUID NOT NULL,
            content TEXT NOT NULL,
            embedding vector(768),
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE 'Created template_embeddings table';
    ELSE
        RAISE NOTICE 'Template_embeddings table already exists';
    END IF;
END $$;

-- ============================================
-- 4. Add Foreign Key Constraint (if not exists)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'template_embeddings_template_id_fkey'
    ) THEN
        -- Check if templates table has id column before adding constraint
        IF EXISTS (
            SELECT FROM pg_tables
            WHERE schemaname = 'public' AND tablename = 'templates'
        ) THEN
            ALTER TABLE template_embeddings
            ADD CONSTRAINT template_embeddings_template_id_fkey
            FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint';
        END IF;
    ELSE
        RAISE NOTICE 'Foreign key constraint already exists';
    END IF;
END $$;

-- ============================================
-- 5. Create Indexes (if not exists)
-- ============================================

-- Templates table indexes
CREATE INDEX IF NOT EXISTS templates_category_idx ON templates(category);
CREATE INDEX IF NOT EXISTS templates_usage_count_idx ON templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS templates_created_at_idx ON templates(created_at DESC);
CREATE INDEX IF NOT EXISTS templates_title_idx ON templates(title);

-- Template embeddings indexes
CREATE INDEX IF NOT EXISTS template_embeddings_template_id_idx ON template_embeddings(template_id);
CREATE INDEX IF NOT EXISTS template_embeddings_created_at_idx ON template_embeddings(created_at DESC);

-- Vector similarity search index (IVFFlat)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'template_embeddings'
        AND indexname = 'template_embeddings_embedding_idx'
    ) THEN
        CREATE INDEX template_embeddings_embedding_idx
        ON template_embeddings
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
        RAISE NOTICE 'Created vector search index';
    ELSE
        RAISE NOTICE 'Vector search index already exists';
    END IF;
END $$;

-- ============================================
-- 6. Create Functions
-- ============================================

-- Function to increment template usage
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

-- Function for vector similarity search
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_template_embeddings_updated_at'
    ) THEN
        CREATE TRIGGER update_template_embeddings_updated_at
        BEFORE UPDATE ON template_embeddings
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created updated_at trigger';
    ELSE
        RAISE NOTICE 'Updated_at trigger already exists';
    END IF;
END $$;

-- ============================================
-- 7. Enable Row Level Security
-- ============================================

-- Enable RLS on tables
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_embeddings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. Create RLS Policies (Drop and Recreate)
-- ============================================

-- Templates table policies
DROP POLICY IF EXISTS "Allow public read access on templates" ON templates;
DROP POLICY IF EXISTS "Allow public insert on templates" ON templates;
DROP POLICY IF EXISTS "Allow public update on templates" ON templates;
DROP POLICY IF EXISTS "Allow public delete on templates" ON templates;

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

-- Template embeddings policies
DROP POLICY IF EXISTS "Allow public read access on template_embeddings" ON template_embeddings;
DROP POLICY IF EXISTS "Allow public insert on template_embeddings" ON template_embeddings;
DROP POLICY IF EXISTS "Allow public update on template_embeddings" ON template_embeddings;
DROP POLICY IF EXISTS "Allow public delete on template_embeddings" ON template_embeddings;

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

-- ============================================
-- 9. Grant Permissions
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant permissions on tables
GRANT ALL ON templates TO anon, authenticated;
GRANT ALL ON template_embeddings TO anon, authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION increment_template_usage(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION match_templates(vector, float, int) TO anon, authenticated;

-- ============================================
-- Migration Complete!
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Created tables:';
    RAISE NOTICE '  - templates';
    RAISE NOTICE '  - template_embeddings';
    RAISE NOTICE '';
    RAISE NOTICE 'Created functions:';
    RAISE NOTICE '  - increment_template_usage()';
    RAISE NOTICE '  - match_templates()';
    RAISE NOTICE '  - update_updated_at_column()';
    RAISE NOTICE '';
    RAISE NOTICE 'Enabled Row Level Security with public access policies';
    RAISE NOTICE '========================================';
END $$;
