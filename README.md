# Contract Agent

AI-powered contract management system with RAG (Retrieval-Augmented Generation) capabilities using LangGraph.js and Supabase vector database.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [API Documentation](#api-documentation)
- [How It Works](#how-it-works)
- [Data Models](#data-models)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## Overview

Contract Agent is a full-stack application that helps you:
- **Generate contracts** from business proposals using AI and semantic template matching
- **Validate contracts** against original requirements with detailed issue reporting
- **Manage templates** with automatic vectorization for RAG-powered semantic search
- **Track contracts** with centralized library, search, and filtering

The system uses **LangGraph.js** to orchestrate complex AI workflows and **Supabase pgvector** for semantic similarity search, ensuring generated contracts are based on the most relevant legal templates.

## Features

### Core Functionality
- ✅ **RAG-Based Contract Generation**: Semantic search finds the most relevant templates, then generates customized contracts
- ✅ **AI-Powered Validation**: Compare contracts against proposals and identify compliance issues
- ✅ **Template Library**: Upload PDF, DOCX, or TXT templates with automatic text extraction and vectorization
- ✅ **Contract Management**: Centralized dashboard with search, filter, and status tracking
- ✅ **Dual LLM Support**: Choose between Ollama (local, free) or Google Gemini (cloud API)
- ✅ **Vector Search**: Supabase pgvector for fast semantic similarity search

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18.3 + TypeScript | UI & state management |
| **Routing** | Wouter | Client-side routing |
| **State** | TanStack Query | Server state & caching |
| **Styling** | Tailwind CSS + Shadcn UI | Component library & theming |
| **Backend** | Express.js + Node.js | REST API server |
| **AI Orchestration** | LangGraph.js + LangChain | Multi-step AI workflows |
| **LLM Providers** | Ollama (local) or Google Gemini (cloud) | Text generation |
| **Embeddings** | Ollama `nomic-embed-text` or Gemini `embedding-001` | Vector embeddings (768 dimensions) |
| **Vector Database** | Supabase (PostgreSQL + pgvector) | Semantic search & storage |
| **File Parsing** | pdfjs-dist, mammoth | PDF/DOCX text extraction |
| **Build Tools** | Vite + esbuild | Frontend & backend bundling |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│  ├─ Dashboard (analytics overview)                          │
│  ├─ Contracts (list, search, filter)                        │
│  ├─ Generate (RAG-powered generation workflow)              │
│  ├─ Validate (AI-powered contract validation)               │
│  └─ Templates (upload & manage templates)                   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST API
┌────────────────────────┴────────────────────────────────────┐
│              Express.js Backend Server                      │
│  ├─ Routes (API endpoints)                                  │
│  ├─ Storage (in-memory & Supabase)                          │
│  ├─ File Parser (PDF, DOCX, TXT extraction)                 │
│  └─ LangGraph Agent (AI workflow orchestration)             │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
    ┌───┴────────┐              ┌────────┴──────┐
    │ LLM API    │              │  Supabase     │
    │ (Ollama or │              │  PostgreSQL   │
    │  Gemini)   │              │  + pgvector   │
    │            │              │  (embeddings) │
    └────────────┘              └───────────────┘
```

### Data Flow: Contract Generation

```
User enters proposal
    ↓
POST /api/contracts/generate
    ↓
LangGraph workflow:
  1. Retrieve Templates (RAG)
     ├─ Generate proposal embedding
     ├─ Search Supabase with match_templates()
     └─ Get top 5 similar templates
  2. Generate Contract
     ├─ Inject template + proposal into prompt
     ├─ LLM generates customized contract
     └─ Save to storage
    ↓
Return contract with metadata
    ↓
Frontend displays generated contract
```

### Data Flow: Contract Validation

```
User selects contract + enters proposal
    ↓
POST /api/contracts/validate
    ↓
LangGraph workflow:
  1. Retrieve Contract & Context
     ├─ Fetch contract from storage
     ├─ Generate proposal embedding
     └─ Search templates for context
  2. Validate Contract
     ├─ Compare contract vs. proposal
     ├─ LLM returns structured issues
     ├─ Update contract status
     └─ Save validation record
    ↓
Return validation result with issues
    ↓
Frontend displays issues by severity
```

## Prerequisites

### Required
- **Node.js** 18+ (for running the application)
- **Supabase Account** (for vector database)
  - Create account at: https://supabase.com
  - Create a new project
  - Get your `SUPABASE_URL` and `SUPABASE_KEY` (anon public key)

### Choose ONE LLM Provider:

**Option 1: Ollama (Local, Free)** - Recommended for development
- Install Ollama: https://ollama.com
- Pull models:
  ```bash
  ollama pull llama3.1:8b
  ollama pull nomic-embed-text
  ```
- Ollama runs at `http://localhost:11434`

**Option 2: Google Gemini (Cloud, Free tier available)**
- Get API key: https://makersuite.google.com/app/apikey
- Free quota: 60 requests/minute

### Optional
- **OpenAI API Key** (legacy fallback, not actively used)

## Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd contract-agent
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Server Configuration
PORT=4000
NODE_ENV=development

# LLM Provider (choose "ollama" or "gemini")
LLM_PROVIDER=ollama

# Ollama Configuration (if using Ollama)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Google Gemini Configuration (if using Gemini)
GEMINI_API_KEY=your-gemini-api-key-here

# Supabase Configuration (REQUIRED for RAG)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-public-key-here

# OpenAI (optional, legacy)
OPENAI_API_KEY=your-openai-key-here
```

### 3. Set Up Supabase Vector Database

**⚠️ CRITICAL STEP** - Without this, you'll get the `match_templates not found` error.

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor** → **New Query**
4. Copy and paste the contents of `supabase-migration.sql` (or `supabase-add-function.sql` for minimal setup)
5. Click **Run**

This creates:
- `template_embeddings` table with pgvector support
- `match_templates()` function for semantic search
- Indexes for fast vector similarity search
- Row-level security policies

**Verify Setup:**
- Go to **Database** → **Functions**
- You should see `match_templates` listed

### 4. Start the Application

**Development Mode:**
```bash
npm run dev
```
- Frontend: http://localhost:5000 (Vite dev server with HMR)
- Backend: http://localhost:4000 (Express API)

**Production Mode:**
```bash
npm run build
npm start
```
- Serves optimized build on http://localhost:4000

## API Documentation

### Base URL
```
http://localhost:4000/api
```

---

### Contracts API

#### 1. Get All Contracts
```http
GET /api/contracts
```

**Response:**
```json
[
  {
    "id": "uuid",
    "title": "Employment Agreement - John Doe",
    "content": "Full contract text...",
    "contractType": "employment",
    "status": "validated",
    "parties": ["Company Inc.", "John Doe"],
    "metadata": {
      "generatedFrom": "template-uuid",
      "ragEnabled": true,
      "ragTemplatesUsed": 3,
      "generatedAt": "2025-01-15T10:30:00Z"
    },
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T11:45:00Z"
  }
]
```

**Status Codes:**
- `200 OK` - Returns array of contracts

---

#### 2. Get Contract by ID
```http
GET /api/contracts/:id
```

**Parameters:**
- `id` (path) - Contract UUID

**Response:**
```json
{
  "id": "uuid",
  "title": "Service Agreement",
  "content": "...",
  ...
}
```

**Status Codes:**
- `200 OK` - Contract found
- `404 Not Found` - Contract doesn't exist

---

#### 3. Create Contract (Manual)
```http
POST /api/contracts
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Custom Contract",
  "content": "Full contract text...",
  "contractType": "nda",
  "status": "draft",
  "parties": ["Party A", "Party B"]
}
```

**Response:**
```json
{
  "id": "uuid",
  "title": "Custom Contract",
  "status": "draft",
  ...
}
```

**Status Codes:**
- `201 Created` - Contract created successfully
- `400 Bad Request` - Invalid data

---

#### 4. Generate Contract (AI-Powered)
```http
POST /api/contracts/generate
Content-Type: application/json
```

**Request Body:**
```json
{
  "proposal": "We need an NDA for our software development partnership with Acme Corp. The agreement should cover confidential information sharing, 2-year term, and mutual obligations.",
  "contractTitle": "NDA - Acme Corp Partnership",
  "contractType": "nda",
  "parties": ["Your Company", "Acme Corp"]
}
```

**Response:**
```json
{
  "content": "NON-DISCLOSURE AGREEMENT\n\nThis Non-Disclosure Agreement...",
  "contractId": "uuid",
  "templateId": "template-uuid",
  "ragEnabled": true,
  "ragTemplatesUsed": 3
}
```

**How it works:**
1. Embeds the proposal using LLM
2. Searches Supabase for top 5 similar templates via `match_templates()`
3. Uses most relevant template as foundation
4. LLM generates customized contract based on proposal
5. Saves contract with metadata (template used, RAG info)

**Status Codes:**
- `200 OK` - Contract generated successfully
- `500 Internal Server Error` - Generation failed (check LLM availability)

---

#### 5. Validate Contract
```http
POST /api/contracts/validate
Content-Type: application/json
```

**Request Body:**
```json
{
  "contractId": "uuid",
  "proposalText": "Original business proposal that the contract should comply with..."
}
```

**Response:**
```json
{
  "status": "issues_found",
  "summary": "The contract is mostly compliant but has 2 issues that should be addressed.",
  "issues": [
    {
      "type": "error",
      "section": "Term and Termination",
      "message": "Missing termination notice period specified in proposal (30 days)"
    },
    {
      "type": "warning",
      "section": "Payment Terms",
      "message": "Payment schedule differs from proposal - contract states quarterly, proposal requests monthly"
    }
  ]
}
```

**Issue Types:**
- `error` - Critical missing or contradictory clause
- `warning` - Deviation from proposal that may need review
- `info` - Informational note or suggestion

**Status Codes:**
- `200 OK` - Validation completed (check `status` field for result)
- `404 Not Found` - Contract doesn't exist
- `500 Internal Server Error` - Validation failed

---

### Templates API

#### 1. Get All Templates
```http
GET /api/templates
```

**Response:**
```json
[
  {
    "id": "uuid",
    "title": "Standard NDA Template",
    "content": "Template text...",
    "category": "nda",
    "description": "Standard mutual NDA for partnerships",
    "usageCount": "15",
    "createdAt": "2025-01-10T08:00:00Z"
  }
]
```

**Categories:**
- `nda` - Non-Disclosure Agreement
- `employment` - Employment contracts
- `service_agreement` - Service agreements
- `partnership` - Partnership agreements
- `lease` - Lease agreements
- `other` - Other types

**Status Codes:**
- `200 OK` - Returns array of templates

---

#### 2. Get Template by ID
```http
GET /api/templates/:id
```

**Status Codes:**
- `200 OK` - Template found
- `404 Not Found` - Template doesn't exist

---

#### 3. Create Template (Text)
```http
POST /api/templates
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Custom NDA",
  "content": "Full template text...",
  "category": "nda",
  "description": "Short description"
}
```

**Response:**
```json
{
  "id": "uuid",
  "title": "Custom NDA",
  "category": "nda",
  ...
}
```

**What happens:**
1. Template saved to storage
2. Embedding generated via LLM (768 dimensions)
3. Embedding stored in Supabase `template_embeddings` table

**Status Codes:**
- `201 Created` - Template created successfully
- `400 Bad Request` - Invalid data

---

#### 4. Upload Template (File)
```http
POST /api/templates/upload
Content-Type: multipart/form-data
```

**Request (FormData):**
```
file: <PDF/DOCX/TXT file>
title: "NDA Template"
category: "nda"
description: "Standard NDA template"
```

**Supported File Types:**
- `.pdf` - Extracted using pdfjs-dist
- `.docx` - Extracted using mammoth
- `.txt` - Read directly

**Max File Size:** 10 MB

**Response:**
```json
{
  "id": "uuid",
  "title": "NDA Template",
  "content": "Extracted text from file...",
  "category": "nda",
  ...
}
```

**Status Codes:**
- `201 Created` - File uploaded and processed successfully
- `400 Bad Request` - Missing file or invalid format
- `500 Internal Server Error` - File parsing failed

---

### Validations API

#### Get All Validations
```http
GET /api/validations
```

**Response:**
```json
[
  {
    "id": "uuid",
    "contractId": "contract-uuid",
    "proposalText": "Original proposal...",
    "validationResult": {
      "status": "compliant",
      "summary": "...",
      "issues": []
    },
    "status": "compliant",
    "createdAt": "2025-01-15T12:00:00Z"
  }
]
```

**Status Codes:**
- `200 OK` - Returns array of validations

---

### Settings API

#### Get LLM Provider Info
```http
GET /api/settings/llm-provider
```

**Response:**
```json
{
  "provider": "ollama",
  "availableProviders": ["ollama", "gemini"],
  "providerInfo": {
    "name": "Ollama (Local)",
    "model": "llama3.1:8b",
    "embeddingModel": "nomic-embed-text",
    "baseUrl": "http://localhost:11434"
  }
}
```

**Status Codes:**
- `200 OK` - Provider info returned

---

## How It Works

### RAG (Retrieval-Augmented Generation) System

The system uses RAG to improve contract generation quality:

#### 1. Template Vectorization
```
User uploads template (PDF/DOCX/TXT)
    ↓
Text extracted from file
    ↓
LLM generates embedding (768-dim vector)
    ↓
Stored in Supabase template_embeddings table
```

#### 2. Semantic Search
```
User enters proposal for contract generation
    ↓
Proposal embedded using same LLM
    ↓
Supabase RPC: match_templates(query_embedding, threshold=0.7, limit=5)
    ↓
Cosine similarity: 1 - (template_embedding <=> query_embedding)
    ↓
Returns top 5 templates with similarity > 0.7
```

**Benefits:**
- Finds templates based on *meaning*, not just keywords
- Works across different wording (e.g., "confidentiality agreement" matches "NDA")
- Ensures generated contracts follow approved legal patterns

#### 3. Contract Generation Workflow (LangGraph)

```javascript
contractGenerationWorkflow = StateGraph({
  nodes: {
    retrieveTemplates: async (state) => {
      // 1. Generate embedding for proposal
      const embedding = await embeddings.embedQuery(state.proposal);

      // 2. Search Supabase
      const { data } = await supabase.rpc('match_templates', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 5
      });

      // 3. Use best match
      return { templateContent: data[0].content };
    },

    generateContract: async (state) => {
      // 4. Build prompt with template + proposal
      const prompt = `Based on this template:\n${state.templateContent}\n\n
        Generate a contract for: ${state.proposal}`;

      // 5. LLM generates customized contract
      const result = await llm.invoke(prompt);

      // 6. Save to storage
      const contract = await storage.createContract({...});

      return { contractId: contract.id };
    }
  }
});
```

#### 4. Validation Workflow

```javascript
validationWorkflow = StateGraph({
  nodes: {
    retrieveContractAndContext: async (state) => {
      // 1. Get contract
      const contract = await storage.getContract(state.contractId);

      // 2. Get relevant templates for context (optional)
      const embedding = await embeddings.embedQuery(state.proposalText);
      const templates = await searchTemplatesByEmbedding(embedding);

      return { contractContent: contract.content, context: templates };
    },

    validateContract: async (state) => {
      // 3. Compare contract vs proposal
      const prompt = `Validate this contract against the proposal.
        Contract: ${state.contractContent}
        Proposal: ${state.proposalText}
        Return JSON with issues.`;

      // 4. LLM returns structured validation
      const result = await llm.invoke(prompt);

      // 5. Update contract status
      await storage.updateContract(state.contractId, {
        status: result.status === 'compliant' ? 'validated' : 'pending'
      });

      return { validationResult: result };
    }
  }
});
```

### LLM Provider System

The application supports two LLM providers:

**Ollama (Default):**
- Runs locally (no API costs)
- Model: `llama3.1:8b` (8 billion parameters)
- Embeddings: `nomic-embed-text` (768 dimensions)
- Base URL: `http://localhost:11434`

**Google Gemini (Alternative):**
- Cloud API (free tier: 60 req/min)
- Model: `gemini-1.5-flash`
- Embeddings: `embedding-001` (768 dimensions)
- Requires `GEMINI_API_KEY`

**Provider Selection:**
Set `LLM_PROVIDER=ollama` or `LLM_PROVIDER=gemini` in `.env`

The system automatically initializes the correct LLM and embeddings model based on this setting.

---

## Data Models

### Contract
```typescript
interface Contract {
  id: string;               // UUID
  title: string;
  content: string;          // Full contract text
  contractType: string;     // e.g., "nda", "employment"
  status: "draft" | "active" | "pending" | "validated" | "archived";
  parties: string[];        // Array of party names
  metadata: {
    generatedFrom?: string;    // Template ID
    ragEnabled?: boolean;      // Was RAG used?
    ragTemplatesUsed?: number; // How many templates matched?
    generatedAt?: string;      // ISO timestamp
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Template
```typescript
interface Template {
  id: string;               // UUID
  title: string;
  content: string;          // Full template text
  category: "nda" | "employment" | "service_agreement" |
            "partnership" | "lease" | "other";
  description: string;
  usageCount: string;       // Number of times used
  embedding?: string;       // JSON stringified vector
  createdAt: Date;
}
```

### Validation
```typescript
interface Validation {
  id: string;
  contractId: string;       // Foreign key
  proposalText: string;     // Original proposal
  validationResult: {
    status: "compliant" | "issues_found" | "failed";
    summary: string;
    issues: Array<{
      type: "error" | "warning" | "info";
      section?: string;
      message: string;
    }>;
  };
  status: "pending" | "compliant" | "issues_found" | "failed";
  createdAt: Date;
}
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `4000` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `LLM_PROVIDER` | No | `ollama` | LLM provider (`ollama` or `gemini`) |
| `OLLAMA_BASE_URL` | If using Ollama | `http://localhost:11434` | Ollama API URL |
| `OLLAMA_MODEL` | If using Ollama | `llama3.1:8b` | Ollama chat model |
| `OLLAMA_EMBEDDING_MODEL` | If using Ollama | `nomic-embed-text` | Ollama embedding model |
| `GEMINI_API_KEY` | If using Gemini | - | Google Gemini API key |
| `SUPABASE_URL` | **Yes** | - | Supabase project URL |
| `SUPABASE_KEY` | **Yes** | - | Supabase anon public key |
| `OPENAI_API_KEY` | No | - | OpenAI key (legacy, not used) |

---

## Development

### Project Structure
```
contract-agent/
├── client/               # React frontend
│   ├── src/
│   │   ├── pages/       # Route pages
│   │   ├── components/  # UI components
│   │   ├── hooks/       # Custom hooks
│   │   └── lib/         # Utilities
│   └── index.html
├── server/              # Express backend
│   ├── routes.ts        # API endpoints
│   ├── langgraph-agent.ts  # AI workflows
│   ├── storage.ts       # Data persistence
│   ├── supabase.ts      # Vector search
│   ├── file-parser.ts   # Document parsing
│   └── index-dev.ts     # Dev server
├── shared/
│   └── schema.ts        # Shared types & schemas
├── supabase-migration.sql   # Database setup
└── .env                 # Environment config
```

### Available Scripts

```bash
# Development (with hot reload)
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Database operations
npm run db:push      # Push schema changes
npm run db:studio    # Open Drizzle Studio
```

### Testing the API

**Using curl:**
```bash
# Get all contracts
curl http://localhost:4000/api/contracts

# Generate contract
curl -X POST http://localhost:4000/api/contracts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "proposal": "Need an NDA for tech partnership",
    "contractTitle": "Tech NDA",
    "contractType": "nda",
    "parties": ["Company A", "Company B"]
  }'

# Upload template
curl -X POST http://localhost:4000/api/templates/upload \
  -F "file=@template.pdf" \
  -F "title=Standard NDA" \
  -F "category=nda" \
  -F "description=Standard template"
```

---

## Troubleshooting

### ⚠️ Error: `match_templates function not found`

**Cause:** Supabase migration not run

**Solution:**
1. Go to Supabase Dashboard → SQL Editor
2. Run the SQL from `supabase-migration.sql`
3. Verify function exists in Database → Functions
4. Restart your server

### LLM Not Responding

**Ollama:**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not running, start it
ollama serve

# Verify models are installed
ollama list
ollama pull llama3.1:8b
ollama pull nomic-embed-text
```

**Gemini:**
- Check `GEMINI_API_KEY` is set correctly
- Verify API key at: https://makersuite.google.com/app/apikey
- Check rate limits (60 req/min on free tier)

### File Upload Fails

**Issue:** File type not supported

**Supported formats:**
- `.pdf` - Parsed with pdfjs-dist
- `.docx` - Parsed with mammoth
- `.txt` - Plain text

**Check file size:** Max 10 MB

### RAG Returns No Results

**Check:**
1. Templates exist in database
2. Templates have embeddings (check `template_embeddings` table)
3. Embedding dimensions match (768 for Ollama/Gemini)
4. Similarity threshold not too high (default: 0.7)

**Debug:**
```sql
-- Check embeddings exist
SELECT COUNT(*) FROM template_embeddings;

-- Test match_templates directly
SELECT * FROM match_templates(
  (SELECT embedding FROM template_embeddings LIMIT 1),
  0.5,
  5
);
```

### Contracts Not Persisting

**Current behavior:** Contracts stored in-memory (reset on server restart)

**Why:** Code has commented-out Supabase storage for contracts

**To fix:** Uncomment SupabaseStorage in `server/storage.ts` after creating `contracts` table in Supabase

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## License

MIT License - see LICENSE file for details

---

## Support

For issues and questions:
- Check the [Troubleshooting](#troubleshooting) section
- Review server logs for specific errors
- Verify Supabase setup in dashboard
- Ensure LLM provider is running and accessible

**Common Issues:**
- `match_templates not found` → Run Supabase migration
- `LLM timeout` → Check Ollama/Gemini connectivity
- `File parsing failed` → Verify file format and size
- `No templates found` → Upload at least one template first
