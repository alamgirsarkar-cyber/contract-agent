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
    model: "gemini-pro",
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

    const proposalEmbedding = await embeddings.embedQuery(state.proposal);
    console.log(`🔍 RAG: Generated proposal embedding (${proposalEmbedding.length} dimensions)`);

    const searchResult = await searchTemplatesByEmbedding(
      proposalEmbedding,
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

INSTRUCTIONS - Follow these carefully:

1. **Extract Key Points from Proposal**: Carefully analyze the business proposal and identify all key requirements, terms, obligations, and specifications mentioned.

2. **Use Template Structure**: Follow the structure, clause organization, and legal language style from the reference template above.

3. **Comprehensive Coverage**: Include ALL standard clauses for a ${state.contractType}, such as:
   - Purpose/Scope of Agreement
   - Definitions (if applicable)
   - Roles & Responsibilities
   - Payment Terms (if applicable)
   - Deliverables & Timelines
   - Confidentiality & Non-Disclosure
   - Intellectual Property Rights
   - Warranties & Representations
   - Limitation of Liability
   - Indemnification
   - Term & Termination
   - Dispute Resolution
   - Governing Law
   - Amendment & Modification
   - Entire Agreement
   - Signatures

4. **Professional Formatting**:
   - Use clear numbered sections (1., 2., 3., etc.)
   - Use subsections where needed (1.1, 1.2, etc.)
   - Include proper headings for each clause
   - Use bullet points or numbered lists for multiple items
   - Maintain consistent legal language throughout

5. **Customization**:
   - Replace ALL placeholders like [Party A], [Company Name], [Date] with actual party names or clear placeholders
   - Incorporate specific terms, conditions, and requirements from the business proposal
   - Add domain-specific clauses based on the contract type
   - Ensure party names are used consistently

6. **Legal Completeness**:
   - Each clause should be legally sound and enforceable
   - Include standard legal protections for both parties
   - Add signature blocks at the end with proper formatting
   - Use formal legal terminology appropriately

7. **Length & Detail**: Generate a complete, detailed contract (not just an outline). Include full clause text, not summaries.

OUTPUT FORMAT:
Generate the contract in a clean, professional format with clear section headings, proper numbering, and complete clause text.

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
  contractId: Annotation<string>(),
  contractContent: Annotation<string>(),
  proposalText: Annotation<string>(),
  relevantContext: Annotation<any[]>(),
  useRag: Annotation<boolean>(),
  validationResult: Annotation<any>(),
  step: Annotation<string>(),
  error: Annotation<string | null>(),
});

async function retrieveContractAndContext(
  state: typeof ValidationState.State
): Promise<Partial<typeof ValidationState.State>> {
  try {
    const contract = await storage.getContract(state.contractId);
    if (!contract) {
      return { error: "Contract not found", step: "error" };
    }

    if (!checkSupabaseAvailability()) {
      console.warn("Supabase not available, validating without RAG context");
      return {
        contractContent: contract.content,
        relevantContext: [],
        useRag: false,
        step: "validate",
        error: null,
      };
    }

    try {
      const proposalEmbedding = await embeddings.embedQuery(state.proposalText);
      const searchResult = await searchTemplatesByEmbedding(
        proposalEmbedding,
        0.3,  // Lowered to 30% for better matching
        3
      );

      if (!searchResult.success) {
        console.warn(`RAG context retrieval failed: ${searchResult.error}. Validating without context.`);
        return {
          contractContent: contract.content,
          relevantContext: [],
          useRag: false,
          step: "validate",
          error: null,
        };
      }

      return {
        contractContent: contract.content,
        relevantContext: searchResult.data,
        useRag: searchResult.data.length > 0,
        step: "validate",
        error: null,
      };
    } catch (embeddingError) {
      console.warn("Failed to retrieve RAG context, validating without it:", embeddingError);
      return {
        contractContent: contract.content,
        relevantContext: [],
        useRag: false,
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
      ? `\n\nRELEVANT TEMPLATE CONTEXT (Retrieved via RAG):
${state.relevantContext.length} similar legal template(s) were analyzed for validation context.`
      : "\n\n(Validation performed without RAG context)";

    const prompt = `You are a legal contract validation assistant. Validate the following contract against the business proposal.

BUSINESS PROPOSAL:
${state.proposalText}

CONTRACT TO VALIDATE:
${state.contractContent}
${ragInfo}

Instructions:
1. Check if all requirements from the proposal are addressed in the contract
2. Identify any missing clauses or terms
3. Flag any contradictions or compliance issues
4. Compare against standard legal practices for completeness
5. Suggest improvements where applicable
6. Categorize issues as: error (critical), warning (important), or info (suggestion)

Respond with a JSON object in this format:
{
  "status": "compliant" | "issues_found" | "failed",
  "summary": "Brief summary of validation results",
  "issues": [
    {
      "type": "error" | "warning" | "info",
      "section": "Section name if applicable",
      "message": "Detailed description of the issue or suggestion"
    }
  ]
}`;

    const response = await llm.invoke(prompt + "\n\nProvide your response as valid JSON only, with no additional text.");

    const responseText = response.content.toString();
    // Extract JSON from response (Gemini sometimes wraps it in markdown)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const validationResult = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);

    const newStatus = validationResult.status === "compliant" ? "validated" :
                      validationResult.status === "issues_found" ? "pending" : "draft";
    
    await storage.updateContract(state.contractId, { status: newStatus });
    
    console.log(`Contract ${state.contractId} validated: ${validationResult.status} (RAG: ${state.useRag})`);

    return {
      validationResult,
      step: "complete",
      error: null,
    };
  } catch (error) {
    console.error("Error in validateContract:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to validate contract",
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

export async function generateEmbedding(text: string): Promise<number[]> {
  const embedding = await embeddings.embedQuery(text);
  return embedding;
}

export async function searchSimilarTemplates(
  query: string,
  limit: number = 3
): Promise<any[]> {
  const queryEmbedding = await generateEmbedding(query);
  const result = await searchTemplatesByEmbedding(queryEmbedding, 0.3, limit);  // Lowered to 30% for better matching
  return result.success ? result.data : [];
}
