import { createClient } from "@supabase/supabase-js";
import https from "https";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";

let supabase: ReturnType<typeof createClient> | null = null;

// Custom HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Allow self-signed certificates
});

function getSupabaseClient() {
  if (!supabase && supabaseUrl && supabaseKey) {
    try {
      supabase = createClient(supabaseUrl, supabaseKey, {
        global: {
          headers: {
            'User-Agent': 'ContractHub/1.0.0',
          },
        },
      });
      console.log("Supabase client initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Supabase client:", error);
    }
  }
  return supabase;
}

export { getSupabaseClient as supabase };

export function checkSupabaseAvailability(): boolean {
  return Boolean(getSupabaseClient());
}

export async function searchTemplatesByEmbedding(
  queryEmbedding: number[],
  matchThreshold: number = 0.7,
  matchCount: number = 3
): Promise<{ success: boolean; data: any[]; error?: string }> {
  const client = getSupabaseClient();
  
  if (!client) {
    return {
      success: false,
      data: [],
      error: "Supabase client not initialized. Check SUPABASE_URL and SUPABASE_KEY.",
    };
  }

  try {
    console.log(`🔎 Supabase: Calling match_templates (threshold: ${matchThreshold}, limit: ${matchCount})`);

    const { data, error } = await client.rpc("match_templates", {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
    });

    if (error) {
      console.error("❌ Supabase RPC error in searchTemplatesByEmbedding:", error);
      return {
        success: false,
        data: [],
        error: `Vector search failed: ${error.message}. Ensure match_templates function exists in Supabase.`,
      };
    }

    console.log(`✅ Supabase: match_templates returned ${data?.length || 0} results`);

    return {
      success: true,
      data: data || [],
    };
  } catch (error) {
    console.error("Exception in searchTemplatesByEmbedding:", error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : "Unknown error in vector search",
    };
  }
}

export async function storeTemplateEmbedding(
  templateId: string,
  content: string,
  embedding: number[]
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  
  if (!client) {
    return {
      success: false,
      error: "Supabase client not initialized. Embedding storage skipped.",
    };
  }

  try {
    const { error } = await client.from("template_embeddings").upsert({
      template_id: templateId,
      content,
      embedding,
      metadata: { updated_at: new Date().toISOString() },
    });

    if (error) {
      console.error("Supabase error storing template embedding:", error);
      return {
        success: false,
        error: `Failed to store embedding: ${error.message}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Exception in storeTemplateEmbedding:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error storing embedding",
    };
  }
}
