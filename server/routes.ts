import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { insertContractSchema, insertTemplateSchema } from "@shared/schema";
import { contractGenerationWorkflow, validationWorkflow, generateEmbedding } from "./langgraph-agent";
import { storeTemplateEmbedding } from "./supabase";
import { parseFile } from "./file-parser";

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    const allowedExtensions = [".pdf", ".docx", ".txt"];
    const hasValidMimeType = allowedMimeTypes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some((ext) =>
      file.originalname.toLowerCase().endsWith(ext)
    );

    if (hasValidMimeType || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, and TXT files are allowed"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/contracts", async (_req, res) => {
    try {
      const contracts = await storage.getContracts();
      res.json(contracts);
    } catch (error) {
      console.error("GET /api/contracts error:", error);
      res.status(500).json({ error: "Failed to fetch contracts" });
    }
  });

  app.get("/api/contracts/:id", async (req, res) => {
    try {
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      console.error("GET /api/contracts/:id error:", error);
      res.status(500).json({ error: "Failed to fetch contract" });
    }
  });

  app.post("/api/contracts", async (req, res) => {
    try {
      const validatedData = insertContractSchema.parse(req.body);
      const contract = await storage.createContract(validatedData);
      res.status(201).json(contract);
    } catch (error) {
      console.error("POST /api/contracts error:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid data" });
    }
  });

  app.post("/api/contracts/generate", async (req, res) => {
    try {
      const { proposal, contractTitle, contractType, parties } = req.body;

      if (!proposal || !contractTitle || !contractType) {
        return res.status(400).json({ error: "Missing required fields: proposal, contractTitle, contractType" });
      }

      console.log(`Generating contract: ${contractTitle}`);

      const result = await contractGenerationWorkflow.invoke({
        proposal,
        contractTitle,
        contractType,
        parties: parties || [],
        templateContent: "",
        templateId: null,
        relevantTemplates: [],
        generatedContent: "",
        contractId: null,
        useRag: false,
        step: "retrieve",
        error: null,
      });

      if (result.error) {
        console.error("Contract generation workflow error:", result.error);
        return res.status(500).json({ error: result.error });
      }

      if (!result.contractId) {
        console.error("Contract generation completed but no contractId returned");
        return res.status(500).json({ error: "Contract generation failed - no contract created" });
      }

      res.json({
        content: result.generatedContent,
        contractId: result.contractId,
        templateId: result.templateId,
        ragEnabled: result.useRag,
        ragTemplatesUsed: result.relevantTemplates?.length || 0,
      });
    } catch (error) {
      console.error("Contract generation error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to generate contract" 
      });
    }
  });

  app.post("/api/contracts/validate", async (req, res) => {
    try {
      const { contractId, proposalText } = req.body;

      if (!contractId || !proposalText) {
        return res.status(400).json({ error: "Missing required fields: contractId, proposalText" });
      }

      console.log(`Validating contract: ${contractId}`);

      const result = await validationWorkflow.invoke({
        contractId,
        proposalText,
        contractContent: "",
        relevantContext: [],
        useRag: false,
        validationResult: null,
        step: "retrieve",
        error: null,
      });

      if (result.error) {
        console.error("Validation workflow error:", result.error);
        return res.status(500).json({ error: result.error });
      }

      if (!result.validationResult) {
        console.error("Validation completed but no result returned");
        return res.status(500).json({ error: "Validation failed - no result generated" });
      }

      const validation = await storage.createValidation({
        contractId,
        proposalText,
        validationResult: result.validationResult,
        status: result.validationResult.status,
      });

      console.log(`Validation ${validation.id} created for contract ${contractId}`);

      res.json(result.validationResult);
    } catch (error) {
      console.error("Contract validation error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to validate contract" 
      });
    }
  });

  app.get("/api/templates", async (_req, res) => {
    try {
      const templates = await storage.getTemplates();
      res.json(templates);
    } catch (error) {
      console.error("GET /api/templates error:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/:id", async (req, res) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("GET /api/templates/:id error:", error);
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  // File upload endpoint for templates
  app.post("/api/templates/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { title, category, description } = req.body;

      if (!title || !category) {
        return res.status(400).json({ error: "Missing required fields: title, category" });
      }

      // Parse the uploaded file
      const parseResult = await parseFile(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      );

      if (parseResult.error || !parseResult.content) {
        return res.status(400).json({ error: parseResult.error || "Failed to extract content from file" });
      }

      // Create template with parsed content
      const validatedData = insertTemplateSchema.parse({
        title,
        category,
        description: description || "",
        content: parseResult.content,
      });

      const template = await storage.createTemplate(validatedData);
      console.log(`Template ${template.id} created from file: ${template.title}`);

      // Generate and store embedding
      try {
        const embedding = await generateEmbedding(parseResult.content);
        const storeResult = await storeTemplateEmbedding(template.id, parseResult.content, embedding);

        if (storeResult.success) {
          console.log(`Template ${template.id} embedded and stored in Supabase vector database`);
        } else {
          console.warn(`Template ${template.id} created but embedding storage failed: ${storeResult.error}`);
        }
      } catch (embeddingError) {
        console.error("Failed to generate/store embedding:", embeddingError);
      }

      res.status(201).json(template);
    } catch (error) {
      console.error("POST /api/templates/upload error:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid data" });
    }
  });

  // Manual text input endpoint for templates
  app.post("/api/templates", async (req, res) => {
    try {
      const validatedData = insertTemplateSchema.parse(req.body);
      const template = await storage.createTemplate(validatedData);

      console.log(`Template ${template.id} created: ${template.title}`);

      try {
        const embedding = await generateEmbedding(validatedData.content);
        const storeResult = await storeTemplateEmbedding(template.id, validatedData.content, embedding);

        if (storeResult.success) {
          console.log(`Template ${template.id} embedded and stored in Supabase vector database`);
        } else {
          console.warn(`Template ${template.id} created but embedding storage failed: ${storeResult.error}`);
        }
      } catch (embeddingError) {
        console.error("Failed to generate/store embedding:", embeddingError);
      }

      res.status(201).json(template);
    } catch (error) {
      console.error("POST /api/templates error:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid data" });
    }
  });

  app.get("/api/validations", async (_req, res) => {
    try {
      const validations = await storage.getValidations();
      res.json(validations);
    } catch (error) {
      console.error("GET /api/validations error:", error);
      res.status(500).json({ error: "Failed to fetch validations" });
    }
  });

  // LLM Provider Configuration
  app.get("/api/settings/llm-provider", async (_req, res) => {
    try {
      const currentProvider = process.env.LLM_PROVIDER || "ollama";
      res.json({
        provider: currentProvider,
        availableProviders: ["ollama", "gemini"],
        providerInfo: {
          ollama: {
            name: "Ollama",
            description: "Free, local LLM - No API key required",
            models: {
              llm: process.env.OLLAMA_MODEL || "llama3.1:8b",
              embedding: process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text"
            }
          },
          gemini: {
            name: "Google Gemini",
            description: "Free cloud API with quota limits",
            models: {
              llm: "gemini-pro",
              embedding: "embedding-001"
            }
          }
        }
      });
    } catch (error) {
      console.error("GET /api/settings/llm-provider error:", error);
      res.status(500).json({ error: "Failed to fetch LLM provider settings" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
