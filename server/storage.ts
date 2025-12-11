import { randomUUID } from "crypto";
import type {
  Contract,
  InsertContract,
  Template,
  InsertTemplate,
  Validation,
  InsertValidation,
  ValidationFeedback,
  InsertValidationFeedback
} from "@shared/schema";
import { supabase } from "./supabase";
import { saveContractToFile, loadContractsFromDisk, deleteContractFromDisk } from "./file-storage";

export interface IStorage {
  getContracts(): Promise<Contract[]>;
  getContract(id: string): Promise<Contract | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: string, contract: Partial<InsertContract>): Promise<Contract>;
  deleteContract(id: string): Promise<void>;

  getTemplates(): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  incrementTemplateUsage(id: string): Promise<void>;

  getValidations(): Promise<Validation[]>;
  getValidation(id: string): Promise<Validation | undefined>;
  createValidation(validation: InsertValidation): Promise<Validation>;

  getValidationFeedbacks(): Promise<ValidationFeedback[]>;
  getValidationFeedback(id: string): Promise<ValidationFeedback | undefined>;
  createValidationFeedback(feedback: InsertValidationFeedback): Promise<ValidationFeedback>;
}

export class MemStorage implements IStorage {
  private contracts: Map<string, Contract>;
  private templates: Map<string, Template>;
  private validations: Map<string, Validation>;
  private validationFeedbacks: Map<string, ValidationFeedback>;
  private contractsLoaded: boolean = false;

  constructor() {
    this.contracts = new Map();
    this.templates = new Map();
    this.validations = new Map();
    this.validationFeedbacks = new Map();
    // Load contracts from disk asynchronously
    this.loadContractsFromDiskAsync();
  }

  private async loadContractsFromDiskAsync(): Promise<void> {
    try {
      const contracts = await loadContractsFromDisk();
      for (const contract of contracts) {
        this.contracts.set(contract.id, contract);
      }
      this.contractsLoaded = true;
      console.log(`✅ Loaded ${contracts.length} contracts from disk into memory`);
    } catch (error) {
      console.error("Failed to load contracts from disk:", error);
      this.contractsLoaded = true; // Mark as loaded even on error
    }
  }

  async getContracts(): Promise<Contract[]> {
    return Array.from(this.contracts.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getContract(id: string): Promise<Contract | undefined> {
    return this.contracts.get(id);
  }

  async createContract(insertContract: InsertContract): Promise<Contract> {
    const id = randomUUID();
    const now = new Date();
    const contract: Contract = { 
      ...insertContract, 
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.contracts.set(id, contract);
    
    // Save to disk
    try {
      await saveContractToFile(contract);
    } catch (error) {
      console.error("Failed to save contract to disk:", error);
      // Continue even if file save fails
    }
    
    return contract;
  }

  async updateContract(id: string, updates: Partial<InsertContract>): Promise<Contract> {
    const existing = this.contracts.get(id);
    if (!existing) {
      throw new Error("Contract not found");
    }
    const updated: Contract = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.contracts.set(id, updated);
    
    // Update file on disk
    try {
      await saveContractToFile(updated);
    } catch (error) {
      console.error("Failed to update contract on disk:", error);
      // Continue even if file save fails
    }
    
    return updated;
  }

  async deleteContract(id: string): Promise<void> {
    const contract = this.contracts.get(id);
    this.contracts.delete(id);
    
    // Delete from disk
    if (contract) {
      try {
        await deleteContractFromDisk(contract);
      } catch (error) {
        console.error("Failed to delete contract from disk:", error);
        // Continue even if file delete fails
      }
    }
  }

  async getTemplates(): Promise<Template[]> {
    return Array.from(this.templates.values()).sort(
      (a, b) => parseInt(b.usageCount) - parseInt(a.usageCount)
    );
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    return this.templates.get(id);
  }

  async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    const id = randomUUID();
    const template: Template = {
      ...insertTemplate,
      id,
      usageCount: "0",
      embedding: null,
      createdAt: new Date(),
    };
    this.templates.set(id, template);
    return template;
  }

  async incrementTemplateUsage(id: string): Promise<void> {
    const template = this.templates.get(id);
    if (template) {
      const currentCount = parseInt(template.usageCount) || 0;
      template.usageCount = (currentCount + 1).toString();
      this.templates.set(id, template);
    }
  }

  async getValidations(): Promise<Validation[]> {
    return Array.from(this.validations.values());
  }

  async getValidation(id: string): Promise<Validation | undefined> {
    return this.validations.get(id);
  }

  async createValidation(insertValidation: InsertValidation): Promise<Validation> {
    const id = randomUUID();
    const validation: Validation = {
      ...insertValidation,
      id,
      createdAt: new Date(),
    };
    this.validations.set(id, validation);
    return validation;
  }

  async getValidationFeedbacks(): Promise<ValidationFeedback[]> {
    return Array.from(this.validationFeedbacks.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getValidationFeedback(id: string): Promise<ValidationFeedback | undefined> {
    return this.validationFeedbacks.get(id);
  }

  async createValidationFeedback(insertFeedback: InsertValidationFeedback): Promise<ValidationFeedback> {
    const id = randomUUID();
    const feedback: ValidationFeedback = {
      ...insertFeedback,
      id,
      createdAt: new Date(),
    };
    this.validationFeedbacks.set(id, feedback);
    return feedback;
  }
}

// Supabase Storage - stores templates in Supabase vector database
export class SupabaseStorage implements IStorage {
  private memContracts: Map<string, Contract>;
  private memValidations: Map<string, Validation>;
  private memValidationFeedbacks: Map<string, ValidationFeedback>;
  private contractsLoaded: boolean = false;

  constructor() {
    this.memContracts = new Map();
    this.memValidations = new Map();
    this.memValidationFeedbacks = new Map();
    // Load contracts from disk asynchronously
    this.loadContractsFromDiskAsync();
  }

  private async loadContractsFromDiskAsync(): Promise<void> {
    try {
      const contracts = await loadContractsFromDisk();
      for (const contract of contracts) {
        this.memContracts.set(contract.id, contract);
      }
      this.contractsLoaded = true;
      console.log(`✅ Loaded ${contracts.length} contracts from disk into memory`);
    } catch (error) {
      console.error("Failed to load contracts from disk:", error);
      this.contractsLoaded = true; // Mark as loaded even on error
    }
  }

  // Contracts still use in-memory storage (can be migrated later if needed)
  async getContracts(): Promise<Contract[]> {
    return Array.from(this.memContracts.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getContract(id: string): Promise<Contract | undefined> {
    return this.memContracts.get(id);
  }

  async createContract(insertContract: InsertContract): Promise<Contract> {
    const id = randomUUID();
    const now = new Date();
    const contract: Contract = {
      ...insertContract,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.memContracts.set(id, contract);
    
    // Save to disk
    try {
      await saveContractToFile(contract);
    } catch (error) {
      console.error("Failed to save contract to disk:", error);
      // Continue even if file save fails
    }
    
    return contract;
  }

  async updateContract(id: string, updates: Partial<InsertContract>): Promise<Contract> {
    const existing = this.memContracts.get(id);
    if (!existing) {
      throw new Error("Contract not found");
    }
    const updated: Contract = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.memContracts.set(id, updated);
    
    // Update file on disk
    try {
      await saveContractToFile(updated);
    } catch (error) {
      console.error("Failed to update contract on disk:", error);
      // Continue even if file save fails
    }
    
    return updated;
  }

  async deleteContract(id: string): Promise<void> {
    const contract = this.memContracts.get(id);
    this.memContracts.delete(id);
    
    // Delete from disk
    if (contract) {
      try {
        await deleteContractFromDisk(contract);
      } catch (error) {
        console.error("Failed to delete contract from disk:", error);
        // Continue even if file delete fails
      }
    }
  }

  // Templates stored in Supabase
  async getTemplates(): Promise<Template[]> {
    const client = supabase();
    if (!client) {
      console.warn("Supabase not available, returning empty templates");
      return [];
    }

    try {
      const { data, error } = await client
        .from("templates")
        .select("*")
        .order("usage_count", { ascending: false });

      if (error) {
        console.error("Error fetching templates from Supabase:", error);
        return [];
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        category: item.category,
        description: item.description || "",
        usageCount: String(item.usage_count || 0),
        embedding: item.embedding || null,
        createdAt: new Date(item.created_at),
      }));
    } catch (error) {
      console.error("Exception fetching templates:", error);
      return [];
    }
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const client = supabase();
    if (!client) {
      console.warn("Supabase not available");
      return undefined;
    }

    try {
      const { data, error } = await client
        .from("templates")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        console.error("Error fetching template from Supabase:", error);
        return undefined;
      }

      return {
        id: data.id,
        title: data.title,
        content: data.content,
        category: data.category,
        description: data.description || "",
        usageCount: String(data.usage_count || 0),
        embedding: data.embedding || null,
        createdAt: new Date(data.created_at),
      };
    } catch (error) {
      console.error("Exception fetching template:", error);
      return undefined;
    }
  }

  async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    const client = supabase();
    if (!client) {
      throw new Error("Supabase not available - cannot create template");
    }

    try {
      const { data, error } = await client
        .from("templates")
        .insert({
          title: insertTemplate.title,
          content: insertTemplate.content,
          category: insertTemplate.category,
          description: insertTemplate.description || "",
          usage_count: 0,
        })
        .select()
        .single();

      if (error || !data) {
        console.error("Error creating template in Supabase:", error);
        throw new Error(`Failed to create template: ${error?.message}`);
      }

      return {
        id: data.id,
        title: data.title,
        content: data.content,
        category: data.category,
        description: data.description || "",
        usageCount: String(data.usage_count || 0),
        embedding: data.embedding || null,
        createdAt: new Date(data.created_at),
      };
    } catch (error) {
      console.error("Exception creating template:", error);
      throw error;
    }
  }

  async incrementTemplateUsage(id: string): Promise<void> {
    const client = supabase();
    if (!client) {
      console.warn("Supabase not available - cannot increment usage");
      return;
    }

    try {
      const { error } = await client.rpc("increment_template_usage", {
        template_id: id,
      });

      if (error) {
        console.error("Error incrementing template usage:", error);
      }
    } catch (error) {
      console.error("Exception incrementing template usage:", error);
    }
  }

  // Validations still use in-memory storage (can be migrated later if needed)
  async getValidations(): Promise<Validation[]> {
    return Array.from(this.memValidations.values());
  }

  async getValidation(id: string): Promise<Validation | undefined> {
    return this.memValidations.get(id);
  }

  async createValidation(insertValidation: InsertValidation): Promise<Validation> {
    const id = randomUUID();
    const validation: Validation = {
      ...insertValidation,
      id,
      createdAt: new Date(),
    };
    this.memValidations.set(id, validation);
    return validation;
  }

  async getValidationFeedbacks(): Promise<ValidationFeedback[]> {
    return Array.from(this.memValidationFeedbacks.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getValidationFeedback(id: string): Promise<ValidationFeedback | undefined> {
    return this.memValidationFeedbacks.get(id);
  }

  async createValidationFeedback(insertFeedback: InsertValidationFeedback): Promise<ValidationFeedback> {
    const id = randomUUID();
    const feedback: ValidationFeedback = {
      ...insertFeedback,
      id,
      createdAt: new Date(),
    };
    this.memValidationFeedbacks.set(id, feedback);
    return feedback;
  }
}

// Use SupabaseStorage to store templates in Supabase (fixes foreign key constraint)
// Contracts and validations still use in-memory storage within SupabaseStorage
export const storage = new SupabaseStorage();
