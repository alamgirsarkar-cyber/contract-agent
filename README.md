# Contract Agent

AI-powered contract management system with RAG (Retrieval-Augmented Generation) capabilities using LangGraph.js and Supabase vector database.

## Features

### Core Functionality
- **Centralized Contract Hub**: Manage all contracts in one place with search and filtering
- **RAG-Based Contract Generation**: Automatically find the most relevant legal templates using semantic search and generate customized contracts
- **AI-Powered Validation**: Validate contracts against business proposals with detailed issue reporting
- **Template Library**: Upload and store pre-approved legal templates with automatic vectorization

### Technology Stack
- **Frontend**: React + TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, LangGraph.js for AI workflows
- **AI/ML**: OpenAI GPT-4 for generation, OpenAI Embeddings for semantic search
- **Vector Database**: Supabase (PostgreSQL with pgvector extension)
- **Alternative LLM**: Google Gemini support

## Prerequisites

Before running the application, ensure you have the following API keys:

1. **SUPABASE_URL**: Your Supabase project URL
2. **SUPABASE_KEY**: Supabase API key (anon public key)
3. **OPENAI_API_KEY**: OpenAI API key for GPT-4 and embeddings
4. **GEMINI_API_KEY**: Google Gemini API key (optional, for alternative LLM)

## Setup

1. All environment variables are already configured in Replit Secrets
2. The application will start automatically

## Supabase Vector Database Setup

For full RAG functionality, you need to set up the vector database in Supabase:

1. Go to your Supabase project SQL Editor
2. Run the following SQL to create the embeddings table and match function:

```sql
-- Enable the pgvector extension
create extension if not exists vector;

-- Create the template_embeddings table
create table if not exists template_embeddings (
  id uuid primary key default gen_random_uuid(),
  template_id text not null,
  content text not null,
  embedding vector(1536),
  metadata jsonb,
  created_at timestamp with time zone default now()
);

-- Create an index for faster similarity search
create index if not exists template_embeddings_embedding_idx 
on template_embeddings 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Create the match_templates function for semantic search
create or replace function match_templates (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  template_id text,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    template_embeddings.template_id,
    template_embeddings.content,
    1 - (template_embeddings.embedding <=> query_embedding) as similarity
  from template_embeddings
  where 1 - (template_embeddings.embedding <=> query_embedding) > match_threshold
  order by template_embeddings.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

## Usage

### 1. Upload Templates
- Navigate to **Templates** page
- Click "Upload Template"
- Fill in the template details (title, category, content)
- The system will automatically:
  - Generate embeddings using OpenAI
  - Store the template in Supabase vector database

### 2. Generate Contracts
- Navigate to **Generate** page
- Enter contract details and business proposal
- The RAG system will:
  - Embed your proposal
  - Search for the most relevant templates in the vector database
  - Generate a customized contract using LangGraph.js workflow
  - Automatically save the contract to your library

### 3. Validate Contracts
- Navigate to **Validate** page
- Select a contract to validate
- Paste the original business proposal
- The AI will:
  - Retrieve relevant context from the vector database
  - Compare contract against the proposal
  - Identify missing clauses, contradictions, or compliance issues
  - Update contract status based on validation results

## How RAG Works

The system uses Retrieval-Augmented Generation to improve contract quality:

1. **Template Upload**: Legal templates are converted to embeddings (vector representations) using OpenAI's embedding model
2. **Semantic Search**: When generating a contract, the business proposal is embedded and compared against all stored templates using cosine similarity
3. **Context Retrieval**: The most relevant templates are retrieved from the vector database
4. **Generation**: LangGraph.js orchestrates the workflow, combining retrieved templates with the proposal to generate customized contracts
5. **Validation**: During validation, relevant templates are again retrieved to provide context for compliance checking

## Architecture

```
Client (React) 
    ↓ API Requests
Express Server
    ↓ Workflow Orchestration
LangGraph.js Agents
    ↓ Embeddings & Chat
OpenAI API
    ↓ Vector Storage & Search
Supabase (pgvector)
```

## Development

The application uses:
- **In-memory storage** for contracts and templates (data resets on server restart)
- **Supabase vector database** for embeddings and semantic search
- **LangGraph.js** for multi-step AI workflows with state management
- **OpenAI GPT-4** for contract generation and validation
- **OpenAI text-embedding-3-small** for vector embeddings

## Notes

- Template embeddings are stored in Supabase for persistent RAG capability
- If Supabase is not configured, the system falls back to using the first available template
- All generated contracts are automatically saved with draft status
- Validation updates contract status (draft → pending → validated)
