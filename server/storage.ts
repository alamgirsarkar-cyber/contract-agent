import { randomUUID } from "crypto";
import type {
  Contract,
  InsertContract,
  Template,
  InsertTemplate,
  Validation,
  InsertValidation
} from "@shared/schema";
import { supabase } from "./supabase";

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
}

export class MemStorage implements IStorage {
  private contracts: Map<string, Contract>;
  private templates: Map<string, Template>;
  private validations: Map<string, Validation>;

  constructor() {
    this.contracts = new Map();
    this.templates = new Map();
    this.validations = new Map();
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
    return updated;
  }

  async deleteContract(id: string): Promise<void> {
    this.contracts.delete(id);
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
}

// Supabase Storage - stores templates in Supabase vector database
export class SupabaseStorage implements IStorage {
  private memContracts: Map<string, Contract>;
  private memValidations: Map<string, Validation>;

  constructor() {
    this.memContracts = new Map();
    this.memValidations = new Map();
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
    return updated;
  }

  async deleteContract(id: string): Promise<void> {
    this.memContracts.delete(id);
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
}

// Use Supabase storage for templates
export const storage = new SupabaseStorage();
