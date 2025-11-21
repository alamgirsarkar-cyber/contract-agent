import { randomUUID } from "crypto";
import type { 
  Contract, 
  InsertContract, 
  Template, 
  InsertTemplate, 
  Validation, 
  InsertValidation 
} from "@shared/schema";

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

export const storage = new MemStorage();
