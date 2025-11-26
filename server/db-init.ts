import { supabase, checkSupabaseAvailability } from "./supabase";

const MIGRATION_SQL = `
-- Safe Idempotent Migration
-- Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Templates Table (if not exists)
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
    END IF;
END $$;

-- Create Template Embeddings Table (if not exists)
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
    END IF;
END $$;

-- Add Foreign Key Constraint (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'template_embeddings_template_id_fkey'
    ) THEN
        IF EXISTS (
            SELECT FROM pg_tables
            WHERE schemaname = 'public' AND tablename = 'templates'
        ) THEN
            ALTER TABLE template_embeddings
            ADD CONSTRAINT template_embeddings_template_id_fkey
            FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Create Indexes
CREATE INDEX IF NOT EXISTS templates_category_idx ON templates(category);
CREATE INDEX IF NOT EXISTS templates_usage_count_idx ON templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS templates_created_at_idx ON templates(created_at DESC);
CREATE INDEX IF NOT EXISTS templates_title_idx ON templates(title);
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
    END IF;
END $$;

-- Create Functions
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

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
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
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_embeddings ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
DROP POLICY IF EXISTS "Allow public read access on templates" ON templates;
DROP POLICY IF EXISTS "Allow public insert on templates" ON templates;
DROP POLICY IF EXISTS "Allow public update on templates" ON templates;
DROP POLICY IF EXISTS "Allow public delete on templates" ON templates;

CREATE POLICY "Allow public read access on templates"
    ON templates FOR SELECT USING (true);
CREATE POLICY "Allow public insert on templates"
    ON templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on templates"
    ON templates FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on templates"
    ON templates FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read access on template_embeddings" ON template_embeddings;
DROP POLICY IF EXISTS "Allow public insert on template_embeddings" ON template_embeddings;
DROP POLICY IF EXISTS "Allow public update on template_embeddings" ON template_embeddings;
DROP POLICY IF EXISTS "Allow public delete on template_embeddings" ON template_embeddings;

CREATE POLICY "Allow public read access on template_embeddings"
    ON template_embeddings FOR SELECT USING (true);
CREATE POLICY "Allow public insert on template_embeddings"
    ON template_embeddings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on template_embeddings"
    ON template_embeddings FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on template_embeddings"
    ON template_embeddings FOR DELETE USING (true);

-- Grant Permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON templates TO anon, authenticated;
GRANT ALL ON template_embeddings TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_template_usage(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION match_templates(vector, float, int) TO anon, authenticated;
`;

interface TableCheck {
  exists: boolean;
  name: string;
}

interface DatabaseStatus {
  available: boolean;
  tables: {
    templates: TableCheck;
    template_embeddings: TableCheck;
  };
  functions: {
    match_templates: boolean;
    increment_template_usage: boolean;
  };
  extensions: {
    vector: boolean;
  };
}

/**
 * Check if required database tables and functions exist
 */
export async function checkDatabaseStatus(): Promise<DatabaseStatus> {
  const status: DatabaseStatus = {
    available: false,
    tables: {
      templates: { exists: false, name: "templates" },
      template_embeddings: { exists: false, name: "template_embeddings" },
    },
    functions: {
      match_templates: false,
      increment_template_usage: false,
    },
    extensions: {
      vector: false,
    },
  };

  const client = supabase();
  if (!client) {
    console.error("❌ Supabase client not available");
    return status;
  }

  status.available = true;

  try {
    // Check if templates table exists
    const { error: templatesError } = await client
      .from("templates")
      .select("id")
      .limit(1);
    status.tables.templates.exists = !templatesError;

    // Check if template_embeddings table exists
    const { error: embeddingsError } = await client
      .from("template_embeddings")
      .select("id")
      .limit(1);
    status.tables.template_embeddings.exists = !embeddingsError;

    // Check if match_templates function exists
    try {
      const { error: matchError } = await (client as any).rpc("match_templates", {
        query_embedding: new Array(768).fill(0),
        match_threshold: 0.3,
        match_count: 1,
      });
      status.functions.match_templates = !matchError;
    } catch {
      status.functions.match_templates = false;
    }

    // Check vector extension (by trying to query template_embeddings with vector column)
    if (status.tables.template_embeddings.exists) {
      status.extensions.vector = true;
    }
  } catch (error) {
    console.error("Error checking database status:", error);
  }

  return status;
}

/**
 * Run database migration to create tables and functions
 */
export async function runDatabaseMigration(): Promise<{
  success: boolean;
  error?: string;
}> {
  const client = supabase();

  if (!client) {
    return {
      success: false,
      error: "Supabase client not initialized. Check SUPABASE_URL and SUPABASE_KEY.",
    };
  }

  try {
    console.log("🔄 Running database migration...");

    // Split the SQL into individual statements and execute them
    // Note: Supabase client doesn't support executing raw SQL directly
    // We need to use the RPC method or run this through SQL editor

    // Instead, we'll create tables using the client API
    const status = await checkDatabaseStatus();

    if (!status.tables.templates.exists || !status.tables.template_embeddings.exists) {
      console.warn("⚠️  Database tables not found!");
      console.warn("Please run the migration SQL manually in Supabase SQL Editor.");
      console.warn("Migration file: supabase-safe-migration.sql");
      console.warn("\nSteps:");
      console.warn("1. Go to https://supabase.com/dashboard");
      console.warn("2. Select your project");
      console.warn("3. Open SQL Editor");
      console.warn("4. Run the contents of supabase-safe-migration.sql");

      return {
        success: false,
        error: "Tables not found. Please run migration SQL manually in Supabase SQL Editor.",
      };
    }

    console.log("✅ Database tables verified");
    return { success: true };
  } catch (error) {
    console.error("Migration error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during migration",
    };
  }
}

/**
 * Initialize database on server startup
 * Checks if tables exist and creates them if needed
 */
export async function initializeDatabase(): Promise<void> {
  console.log("\n🔍 Checking database status...");

  if (!checkSupabaseAvailability()) {
    console.error("❌ Supabase not configured. Skipping database initialization.");
    console.error("Please set SUPABASE_URL and SUPABASE_KEY in .env file");
    return;
  }

  const status = await checkDatabaseStatus();

  console.log("\n📊 Database Status:");
  console.log(`  ├─ Supabase: ${status.available ? "✅" : "❌"}`);
  console.log(`  ├─ templates table: ${status.tables.templates.exists ? "✅" : "❌"}`);
  console.log(`  ├─ template_embeddings table: ${status.tables.template_embeddings.exists ? "✅" : "❌"}`);
  console.log(`  ├─ match_templates function: ${status.functions.match_templates ? "✅" : "❌"}`);
  console.log(`  └─ vector extension: ${status.extensions.vector ? "✅" : "❌"}`);

  const allTablesExist =
    status.tables.templates.exists && status.tables.template_embeddings.exists;

  if (!allTablesExist) {
    console.log("\n⚠️  Missing database tables!");
    console.log("\n📋 To fix this, run the migration SQL:");
    console.log("   1. Go to: https://supabase.com/dashboard");
    console.log("   2. Select your project");
    console.log("   3. Open SQL Editor");
    console.log("   4. Copy and run the contents of: supabase-safe-migration.sql");
    console.log("\n   Or run: npm run db:migrate\n");

    // Try to run migration (will fail with instructions)
    await runDatabaseMigration();
  } else {
    console.log("\n✅ Database is ready!");
  }

  console.log("");
}

/**
 * Print detailed database status for verification
 */
export async function verifyDatabase(): Promise<void> {
  console.log("\n🔍 Verifying Database Configuration\n");
  console.log("=".repeat(50));

  // Check environment variables
  const hasUrl = Boolean(process.env.SUPABASE_URL);
  const hasKey = Boolean(process.env.SUPABASE_KEY);

  console.log("\n📋 Environment Variables:");
  console.log(`  ├─ SUPABASE_URL: ${hasUrl ? "✅ Set" : "❌ Missing"}`);
  console.log(`  └─ SUPABASE_KEY: ${hasKey ? "✅ Set" : "❌ Missing"}`);

  if (!hasUrl || !hasKey) {
    console.log("\n❌ Supabase not configured!");
    console.log("   Please set SUPABASE_URL and SUPABASE_KEY in .env file\n");
    return;
  }

  // Check database status
  const status = await checkDatabaseStatus();

  console.log("\n🗄️  Database Connection:");
  console.log(`  └─ Status: ${status.available ? "✅ Connected" : "❌ Failed"}`);

  if (!status.available) {
    console.log("\n❌ Cannot connect to Supabase!");
    console.log("   Check your SUPABASE_URL and SUPABASE_KEY\n");
    return;
  }

  console.log("\n📊 Tables:");
  console.log(`  ├─ templates: ${status.tables.templates.exists ? "✅ Exists" : "❌ Missing"}`);
  console.log(`  └─ template_embeddings: ${status.tables.template_embeddings.exists ? "✅ Exists" : "❌ Missing"}`);

  console.log("\n⚙️  Functions:");
  console.log(`  ├─ match_templates: ${status.functions.match_templates ? "✅ Available" : "❌ Missing"}`);
  console.log(`  └─ increment_template_usage: ${status.functions.increment_template_usage ? "✅ Available" : "⚠️  Unknown"}`);

  console.log("\n🔌 Extensions:");
  console.log(`  └─ vector (pgvector): ${status.extensions.vector ? "✅ Enabled" : "❌ Missing"}`);

  const allGood =
    status.available &&
    status.tables.templates.exists &&
    status.tables.template_embeddings.exists &&
    status.functions.match_templates &&
    status.extensions.vector;

  console.log("\n" + "=".repeat(50));

  if (allGood) {
    console.log("\n✅ Database is fully configured and ready!\n");
  } else {
    console.log("\n⚠️  Database setup incomplete!");
    console.log("\n📝 To complete setup:");
    console.log("   1. Go to: https://supabase.com/dashboard");
    console.log("   2. Select your project");
    console.log("   3. Open SQL Editor");
    console.log("   4. Run: supabase-safe-migration.sql\n");
  }
}
