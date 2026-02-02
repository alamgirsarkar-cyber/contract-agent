import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { storage } from "./storage";
import { searchTemplatesByEmbedding, checkSupabaseAvailability } from "./supabase";

// Configuration: Switch between "ollama" and "gemini"
const LLM_PROVIDER = process.env.LLM_PROVIDER || "ollama";

// Initialize models based on provider
let llm: ChatGoogleGenerativeAI | ChatOllama;
let embeddings: GoogleGenerativeAIEmbeddings | OllamaEmbeddings;

if (LLM_PROVIDER === "ollama") {
  console.log("🦙 Using Ollama (Local LLM) - Completely Free!");
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const ollamaModel = process.env.OLLAMA_MODEL || "llama3.1:8b";
  const ollamaEmbeddingModel = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";

  llm = new ChatOllama({
    baseUrl: ollamaBaseUrl,
    model: ollamaModel,
    temperature: 0.7,
  });

  embeddings = new OllamaEmbeddings({
    baseUrl: ollamaBaseUrl,
    model: ollamaEmbeddingModel,
  });
} else if (LLM_PROVIDER === "gemini") {
  console.log("🌟 Using Google Gemini");
  const geminiApiKey = process.env.GEMINI_API_KEY || "";

  llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0.7,
    apiKey: geminiApiKey,
  });

  embeddings = new GoogleGenerativeAIEmbeddings({
    model: "embedding-001",
    apiKey: geminiApiKey,
  });
} else {
  throw new Error(`Unknown LLM_PROVIDER: ${LLM_PROVIDER}. Use "ollama" or "gemini"`);
}

// Embedding cache to avoid regenerating embeddings for same proposal
const embeddingCache = new Map<string, number[]>();
const CACHE_MAX_SIZE = 500; // Increased cache size to reduce API calls

// Track embedding call timestamps for rate limiting
const embeddingCallTimestamps: number[] = [];
const EMBEDDING_RATE_LIMIT = 10; // Max 10 calls per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds

// Simple hash function for better cache keys
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

function getCachedEmbedding(text: string): number[] | null {
  const cacheKey = hashString(text); // Use hash for better cache hit rate
  return embeddingCache.get(cacheKey) || null;
}

function setCachedEmbedding(text: string, embedding: number[]): void {
  const cacheKey = hashString(text);
  if (embeddingCache.size >= CACHE_MAX_SIZE) {
    // Remove oldest entries (LRU-style)
    const keysToDelete = Array.from(embeddingCache.keys()).slice(0, 50);
    keysToDelete.forEach(key => embeddingCache.delete(key));
  }
  embeddingCache.set(cacheKey, embedding);
}

// Check if we're within rate limits
function canMakeEmbeddingCall(): boolean {
  const now = Date.now();
  // Remove timestamps older than the rate limit window
  while (embeddingCallTimestamps.length > 0 && embeddingCallTimestamps[0] < now - RATE_LIMIT_WINDOW) {
    embeddingCallTimestamps.shift();
  }
  return embeddingCallTimestamps.length < EMBEDDING_RATE_LIMIT;
}

function recordEmbeddingCall(): void {
  embeddingCallTimestamps.push(Date.now());
}

// Wrapper for embeddings with quota error handling
async function safeEmbedQuery(text: string): Promise<{ success: boolean; embedding?: number[]; error?: string }> {
  try {
    // Check cache first
    const cached = getCachedEmbedding(text);
    if (cached) {
      console.log('✅ Using cached embedding');
      return { success: true, embedding: cached };
    }

    // Check rate limit
    if (!canMakeEmbeddingCall()) {
      console.warn('⚠️ Rate limit reached, skipping embedding generation');
      return { success: false, error: 'Rate limit reached' };
    }

    // Make API call
    recordEmbeddingCall();
    const embedding = await embeddings.embedQuery(text);
    setCachedEmbedding(text, embedding);
    console.log(`🔍 Generated new embedding (${embedding.length} dimensions)`);
    return { success: true, embedding };
  } catch (error: any) {
    // Check if it's a quota error
    if (error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('Too Many Requests')) {
      console.warn('⚠️ Quota exceeded, falling back to non-RAG mode');
      return { success: false, error: 'Quota exceeded' };
    }
    console.error('Embedding generation error:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

const ContractGenerationState = Annotation.Root({
  proposal: Annotation<string>(),
  contractTitle: Annotation<string>(),
  contractType: Annotation<string>(),
  parties: Annotation<string[]>(),
  templateContent: Annotation<string>(),
  templateId: Annotation<string | null>(),
  relevantTemplates: Annotation<any[]>(),
  generatedContent: Annotation<string>(),
  contractId: Annotation<string | null>(),
  useRag: Annotation<boolean>(),
  step: Annotation<string>(),
  error: Annotation<string | null>(),
});

async function retrieveTemplates(
  state: typeof ContractGenerationState.State
): Promise<Partial<typeof ContractGenerationState.State>> {
  try {
    const allTemplates = await storage.getTemplates();
    if (allTemplates.length === 0) {
      return {
        error: "No templates available. Please upload templates first.",
        step: "error",
      };
    }

    if (!checkSupabaseAvailability()) {
      console.warn("Supabase not available, using first template without RAG");
      return {
        templateContent: allTemplates[0].content,
        templateId: allTemplates[0].id,
        relevantTemplates: [],
        useRag: false,
        step: "generate",
        error: null,
      };
    }

    // Use safe embedding query with quota error handling
    const embeddingResult = await safeEmbedQuery(state.proposal);

    if (!embeddingResult.success || !embeddingResult.embedding) {
      console.warn(`⚠️ RAG embedding failed: ${embeddingResult.error}. Falling back to first template.`);
      await storage.incrementTemplateUsage(allTemplates[0].id);

      return {
        templateContent: allTemplates[0].content,
        templateId: allTemplates[0].id,
        relevantTemplates: [],
        useRag: false,
        step: "generate",
        error: null,
      };
    }

    const searchResult = await searchTemplatesByEmbedding(
      embeddingResult.embedding,
      0.3,  // Lowered to 30% for better matching
      5
    );

    if (!searchResult.success || searchResult.data.length === 0) {
      console.warn(`⚠️ RAG search failed or no matches: ${searchResult.error || 'No similar templates'}. Falling back to first template.`);
      console.log(`Available templates: ${allTemplates.length}, Supabase available: ${checkSupabaseAvailability()}`);

      await storage.incrementTemplateUsage(allTemplates[0].id);

      return {
        templateContent: allTemplates[0].content,
        templateId: allTemplates[0].id,
        relevantTemplates: [],
        useRag: false,
        step: "generate",
        error: null,
      };
    }

    console.log(`✅ RAG: Found ${searchResult.data.length} matching templates`);
    searchResult.data.forEach((match, idx) => {
      console.log(`  ${idx + 1}. Template ID: ${match.template_id.substring(0, 8)}... | Similarity: ${(match.similarity * 100).toFixed(1)}%`);
    });

    const bestMatch = searchResult.data[0];
    const template = await storage.getTemplate(bestMatch.template_id);

    if (!template) {
      console.warn("⚠️ RAG-selected template not found in storage, using first available");
      await storage.incrementTemplateUsage(allTemplates[0].id);

      return {
        templateContent: allTemplates[0].content,
        templateId: allTemplates[0].id,
        relevantTemplates: searchResult.data,
        useRag: false,
        step: "generate",
        error: null,
      };
    }

    await storage.incrementTemplateUsage(template.id);
    console.log(`🎯 RAG: Using template "${template.title}" (similarity: ${(bestMatch.similarity * 100).toFixed(1)}%)`);

    return {
      templateContent: template.content,
      templateId: template.id,
      relevantTemplates: searchResult.data,
      useRag: true,
      step: "generate",
      error: null,
    };
  } catch (error) {
    console.error("Error in retrieveTemplates:", error);
    
    const allTemplates = await storage.getTemplates();
    if (allTemplates.length > 0) {
      await storage.incrementTemplateUsage(allTemplates[0].id);
      return {
        templateContent: allTemplates[0].content,
        templateId: allTemplates[0].id,
        relevantTemplates: [],
        useRag: false,
        step: "generate",
        error: null,
      };
    }
    
    return {
      error: error instanceof Error ? error.message : "Failed to retrieve templates",
      step: "error",
    };
  }
}

async function generateContract(
  state: typeof ContractGenerationState.State
): Promise<Partial<typeof ContractGenerationState.State>> {
  try {
    const ragInfo = state.useRag 
      ? `Retrieved via RAG (semantic search) - ${state.relevantTemplates.length} similar templates analyzed`
      : "Using available template (RAG unavailable or no matches)";

    const prompt = `You are an expert legal contract generation assistant. Generate a comprehensive, professionally structured legal contract.

REFERENCE TEMPLATE (${ragInfo}):
${state.templateContent}

BUSINESS PROPOSAL/DESCRIPTION:
${state.proposal}

CONTRACT DETAILS:
- Title: ${state.contractTitle}
- Type: ${state.contractType}
- Parties: ${state.parties.join(", ")}

INSTRUCTIONS:
1. Extract ALL requirements from proposal and address comprehensively
2. Follow template structure with proper legal formatting (numbered sections)
3. Include standard clauses: Purpose, Definitions, Responsibilities, Payment, Deliverables, Confidentiality, IP Rights, Warranties, Liability, Indemnification, Term/Termination, Dispute Resolution, Governing Law, Amendments, Entire Agreement, Signatures
4. Replace placeholders with actual party names
5. Use formal legal terminology; ensure legal soundness
6. Generate complete detailed contract (not outline)

OUTPUT: Professional ${state.contractType} contract with clear sections and complete clauses.

Generate the complete ${state.contractType} contract now:`;

    const response = await llm.invoke(prompt);
    const generatedContent = response.content.toString();

    const contract = await storage.createContract({
      title: state.contractTitle,
      content: generatedContent,
      contractType: state.contractType,
      status: "draft",
      parties: state.parties,
      metadata: {
        generatedFrom: state.templateId,
        ragEnabled: state.useRag,
        ragTemplatesUsed: state.relevantTemplates.length,
        generatedAt: new Date().toISOString(),
      },
    });

    console.log(`Contract ${contract.id} generated successfully (RAG: ${state.useRag})`);

    return {
      generatedContent,
      contractId: contract.id,
      step: "complete",
      error: null,
    };
  } catch (error) {
    console.error("Error in generateContract:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to generate contract",
      step: "error",
    };
  }
}

const contractGenerationGraph = new StateGraph(ContractGenerationState)
  .addNode("retrieve", retrieveTemplates)
  .addNode("generate", generateContract)
  .addEdge(START, "retrieve")
  .addConditionalEdges("retrieve", (state) => {
    return state.step === "generate" ? "generate" : END;
  })
  .addEdge("generate", END);

export const contractGenerationWorkflow = contractGenerationGraph.compile();

const ValidationState = Annotation.Root({
  contractId: Annotation<string | null>(),
  contractContent: Annotation<string>(),
  proposalText: Annotation<string>(),
  relevantContext: Annotation<any[]>(),
  useRag: Annotation<boolean>(),
  useGlobalClauses: Annotation<boolean>(),
  globalClausesContent: Annotation<string>(),
  validationResult: Annotation<any>(),
  step: Annotation<string>(),
  error: Annotation<string | null>(),
});

// Helper function to extract key clause sections from template content
function extractKeyClauses(content: string): string {
  // Common clause section headers to look for
  const clausePatterns = [
    /(?:^|\n)((?:\d+\.?\s*)?(?:DEFINITIONS?|TERM|TERMINATION|PAYMENT|COMPENSATION|CONFIDENTIAL|NON-DISCLOSURE|INTELLECTUAL PROPERTY|IP RIGHTS|WARRANTY|WARRANTIES|LIABILITY|INDEMNIF|DISPUTE|GOVERNING LAW|AMENDMENT|SIGNATURE)[^\n]*)\n([\s\S]*?)(?=\n(?:\d+\.?\s*)?[A-Z]{3,}|\n*$)/gi
  ];

  const extractedClauses: string[] = [];

  for (const pattern of clausePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const clauseTitle = match[1].trim();
      const clauseContent = match[2].trim().substring(0, 500); // Limit each clause to 500 chars
      if (clauseContent) {
        extractedClauses.push(`${clauseTitle}\n${clauseContent}...`);
      }
    }
  }

  // If no specific clauses found, return a truncated version of the content
  if (extractedClauses.length === 0) {
    return content.substring(0, 2000);
  }

  return extractedClauses.join("\n\n");
}

// Helper function to fetch global clauses from templates
async function fetchGlobalClauses(): Promise<string> {
  const templates = await storage.getTemplates();
  if (templates.length === 0) {
    return "";
  }

  // Limit to top 3 most used templates to avoid token overflow
  const topTemplates = templates.slice(0, 3);

  // Extract key clauses from templates (limited content)
  const globalClauses = topTemplates.map((t, idx) => {
    const keyClauses = extractKeyClauses(t.content);
    return `--- Template ${idx + 1}: ${t.title} (${t.category}) ---\n${keyClauses}`;
  }).join("\n\n");

  // Further limit total content to ~8000 chars to stay within LLM context limits
  const limitedClauses = globalClauses.substring(0, 8000);

  console.log(`Fetched global clauses from ${topTemplates.length} templates (${limitedClauses.length} chars)`);
  return limitedClauses;
}

async function retrieveContractAndContext(
  state: typeof ValidationState.State
): Promise<Partial<typeof ValidationState.State>> {
  try {

    // IMPORTANT: Check if contractContent is already provided (from file upload)
    // If so, skip database retrieval and just handle RAG context
    if (state.contractContent) {
      console.log("Contract content already provided (uploaded file), skipping database retrieval");

      // If using global clauses (no proposal provided), fetch templates
      let globalClausesContent = "";
      if (state.useGlobalClauses) {
        console.log("No proposal provided - fetching global clauses from templates");
        globalClausesContent = await fetchGlobalClauses();
        if (!globalClausesContent) {
          return {
            error: "No templates available to use as global clauses. Please upload templates first.",
            step: "error",
          };
        }
      }

      // Try to get RAG context for better validation
      if (!checkSupabaseAvailability()) {
        console.warn("Supabase not available, validating without RAG context");
        return {
          contractContent: state.contractContent,
          relevantContext: [],
          useRag: false,
          globalClausesContent,
          step: "validate",
          error: null,
        };
      }

      try {
        // Use safe embedding query with quota error handling
        // For global clauses mode, use contract content for embedding search
        const textForEmbedding = state.useGlobalClauses ? state.contractContent.substring(0, 2000) : state.proposalText;
        const embeddingResult = await safeEmbedQuery(textForEmbedding);

        if (!embeddingResult.success || !embeddingResult.embedding) {
          console.warn(`RAG embedding failed: ${embeddingResult.error}. Validating without context.`);
          return {
            contractContent: state.contractContent,
            relevantContext: [],
            useRag: false,
            globalClausesContent,
            step: "validate",
            error: null,
          };
        }

        const searchResult = await searchTemplatesByEmbedding(
          embeddingResult.embedding,
          0.3,
          3
        );

        if (!searchResult.success) {
          console.warn(`RAG context retrieval failed: ${searchResult.error}. Validating without context.`);
          return {
            contractContent: state.contractContent,
            relevantContext: [],
            useRag: false,
            globalClausesContent,
            step: "validate",
            error: null,
          };
        }

        return {
          contractContent: state.contractContent,
          relevantContext: searchResult.data,
          useRag: searchResult.data.length > 0,
          globalClausesContent,
          step: "validate",
          error: null,
        };
      } catch (embeddingError) {
        console.warn("Failed to retrieve RAG context, validating without it:", embeddingError);
        return {
          contractContent: state.contractContent,
          relevantContext: [],
          useRag: false,
          globalClausesContent,
          step: "validate",
          error: null,
        };
      }
    }

    // Otherwise, retrieve contract from database by ID
    if (!state.contractId) {
      return { error: "Contract ID or content must be provided", step: "error" };
    }

    const contract = await storage.getContract(state.contractId);
    if (!contract) {
      return { error: "Contract not found", step: "error" };
    }

    // If using global clauses (no proposal provided), fetch templates
    let globalClausesContent = "";
    if (state.useGlobalClauses) {
      console.log("No proposal provided - fetching global clauses from templates");
      globalClausesContent = await fetchGlobalClauses();
      if (!globalClausesContent) {
        return {
          error: "No templates available to use as global clauses. Please upload templates first.",
          step: "error",
        };
      }
    }

    if (!checkSupabaseAvailability()) {
      console.warn("Supabase not available, validating without RAG context");
      return {
        contractContent: contract.content,
        relevantContext: [],
        useRag: false,
        globalClausesContent,
        step: "validate",
        error: null,
      };
    }

    try {
      // Use safe embedding query with quota error handling
      // For global clauses mode, use contract content for embedding search
      const textForEmbedding = state.useGlobalClauses ? contract.content.substring(0, 2000) : state.proposalText;
      const embeddingResult = await safeEmbedQuery(textForEmbedding);

      if (!embeddingResult.success || !embeddingResult.embedding) {
        console.warn(`RAG embedding failed: ${embeddingResult.error}. Validating without context.`);
        return {
          contractContent: contract.content,
          relevantContext: [],
          useRag: false,
          globalClausesContent,
          step: "validate",
          error: null,
        };
      }

      const searchResult = await searchTemplatesByEmbedding(
        embeddingResult.embedding,
        0.3,  // Lowered to 30% for better matching
        3
      );

      if (!searchResult.success) {
        console.warn(`RAG context retrieval failed: ${searchResult.error}. Validating without context.`);
        return {
          contractContent: contract.content,
          relevantContext: [],
          useRag: false,
          globalClausesContent,
          step: "validate",
          error: null,
        };
      }

      return {
        contractContent: contract.content,
        relevantContext: searchResult.data,
        useRag: searchResult.data.length > 0,
        globalClausesContent,
        step: "validate",
        error: null,
      };
    } catch (embeddingError) {
      console.warn("Failed to retrieve RAG context, validating without it:", embeddingError);
      return {
        contractContent: contract.content,
        relevantContext: [],
        useRag: false,
        globalClausesContent,
        step: "validate",
        error: null,
      };
    }
  } catch (error) {
    console.error("Error in retrieveContractAndContext:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to retrieve contract",
      step: "error",
    };
  }
}

async function validateContract(
  state: typeof ValidationState.State
): Promise<Partial<typeof ValidationState.State>> {
  try {
    const ragInfo = state.useRag && state.relevantContext.length > 0
      ? `\n(${state.relevantContext.length} similar templates analyzed via RAG)`
      : "";

    // Limit contract content to avoid token overflow (keep ~15000 chars max)
    const contractContent = state.contractContent.length > 15000
      ? state.contractContent.substring(0, 15000) + "\n...[content truncated]..."
      : state.contractContent;

    // Build different prompts based on whether we're using global clauses or proposal
    let prompt: string;

    if (state.useGlobalClauses && state.globalClausesContent) {
      // Global clauses validation mode - validate against stored template standards
      console.log("Using global clauses validation mode");
      prompt = `You are a legal contract validator. Validate the contract against standard legal requirements.

CONTRACT:
${contractContent}

REFERENCE CLAUSES:
${state.globalClausesContent}
${ragInfo}

VALIDATE FOR:
1. Essential clauses present (definitions, term, termination, confidentiality, IP, liability, dispute resolution, governing law)
2. Clause quality (clear language, no conflicts, proper terminology)
3. Structure (logical organization, complete sections)
4. Risk (unusual clauses, missing protections)

OUTPUT JSON only:
{"status": "compliant|issues_found|failed", "summary": "2-3 sentences", "issues": [{"type": "error|warning|info", "section": "...", "message": "..."}]}

STATUS: compliant=all essential clauses present, issues_found=some missing/weak clauses, failed=critical deficiencies`;
    } else {
      // Standard validation mode - validate against business proposal
      prompt = `You are a legal contract validator. Validate the contract against business proposal requirements.

PROPOSAL:
${state.proposalText}

CONTRACT:
${contractContent}
${ragInfo}

VALIDATION:
1. TYPE CHECK: Contract type must match proposal type (Employment vs Service Agreement = FAILED)
2. REQUIREMENTS: Check each requirement is addressed. Flag contradictions (monthly vs quarterly = ERROR)
3. COMPLETENESS: Verify expected structure exists

OUTPUT JSON only:
{"status": "compliant|issues_found|failed", "summary": "2-3 sentences", "issues": [{"type": "error|warning|info", "section": "...", "message": "..."}]}

STATUS: compliant=requirements met, issues_found=some issues, failed=type mismatch or critical issues`;
    }

    const response = await llm.invoke(prompt + "\n\nProvide your response as valid JSON only, with no additional text.");

    const responseText = response.content.toString();
    console.log('Validation LLM response length:', responseText.length);
    
    // Extract JSON from response (Gemini sometimes wraps it in markdown)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to extract JSON from response:', responseText.substring(0, 200));
      throw new Error('Invalid validation response format');
    }
    
    const validationResult = JSON.parse(jsonMatch[0]);
    console.log('Validation result status:', validationResult.status);
    console.log('Issues count:', validationResult.issues?.length || 0);

    // Only update contract status if we have a contract ID (not for uploaded files)
    const validationMode = state.useGlobalClauses ? "global clauses" : "proposal";
    if (state.contractId) {
      const newStatus = validationResult.status === "compliant" ? "validated" :
                        validationResult.status === "issues_found" ? "pending" : "draft";

      await storage.updateContract(state.contractId, { status: newStatus });
      console.log(`Contract ${state.contractId} validated: ${validationResult.status} (mode: ${validationMode}, RAG: ${state.useRag})`);
    } else {
      console.log(`Uploaded file validated: ${validationResult.status} (mode: ${validationMode}, RAG: ${state.useRag})`);
    }

    return {
      validationResult,
      step: "complete",
      error: null,
    };
  } catch (error: any) {
    console.error("Error in validateContract:", error);

    // Provide clearer error messages for common issues
    let errorMessage = "Failed to validate contract";

    if (error?.message?.includes("fetch failed") || error?.cause?.code === "ECONNREFUSED") {
      errorMessage = `LLM service unavailable. Please ensure ${LLM_PROVIDER === "ollama" ? "Ollama is running (ollama serve)" : "Gemini API is configured correctly"}.`;
    } else if (error?.message?.includes("context length") || error?.message?.includes("too long")) {
      errorMessage = "Contract is too large for validation. Please try a smaller document.";
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      error: errorMessage,
      step: "error",
    };
  }
}

const validationGraph = new StateGraph(ValidationState)
  .addNode("retrieve", retrieveContractAndContext)
  .addNode("validate", validateContract)
  .addEdge(START, "retrieve")
  .addConditionalEdges("retrieve", (state) => {
    return state.step === "validate" ? "validate" : END;
  })
  .addEdge("validate", END);

export const validationWorkflow = validationGraph.compile();

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const result = await safeEmbedQuery(text);
  return result.embedding || null;
}

export async function searchSimilarTemplates(
  query: string,
  limit: number = 3
): Promise<any[]> {
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) {
    console.warn('Failed to generate embedding for search, returning empty results');
    return [];
  }
  const result = await searchTemplatesByEmbedding(queryEmbedding, 0.3, limit);  // Lowered to 30% for better matching
  return result.success ? result.data : [];
}
