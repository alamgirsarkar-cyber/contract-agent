-- Run this to verify your templates table schema
-- This should show all columns including 'category' and 'usage_count'

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'templates'
ORDER BY ordinal_position;

-- Expected output should show these columns:
-- id, title, category, description, content, usage_count, embedding, created_at
