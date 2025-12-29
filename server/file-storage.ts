import { promises as fs } from "fs";
import path from "path";
import type { Contract } from "@shared/schema";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "contracts");

/**
 * Ensure the uploads directory exists
 */
export async function ensureUploadDirectory(): Promise<void> {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    console.log(`✅ Uploads directory ready: ${UPLOADS_DIR}`);
  } catch (error) {
    console.error("Failed to create uploads directory:", error);
    throw error;
  }
}

/**
 * Sanitize filename to remove special characters
 */
export function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100); // Limit length
}

/**
 * Generate filename for contract
 */
export function generateContractFilename(contract: Contract): string {
  const timestamp = new Date(contract.createdAt)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "");
  const sanitized = sanitizeFilename(contract.title);
  return `contract_${timestamp}_${sanitized}`;
}

/**
 * Save contract to disk as .txt (content) and .json (metadata)
 */
export async function saveContractToFile(contract: Contract): Promise<void> {
  try {
    await ensureUploadDirectory();

    const baseFilename = generateContractFilename(contract);
    const txtPath = path.join(UPLOADS_DIR, `${baseFilename}.txt`);
    const jsonPath = path.join(UPLOADS_DIR, `${baseFilename}.json`);

    // Save contract content as .txt
    await fs.writeFile(txtPath, contract.content, "utf-8");

    // Save metadata as .json (excluding content to avoid duplication)
    const metadata = {
      id: contract.id,
      title: contract.title,
      contractType: contract.contractType,
      status: contract.status,
      parties: contract.parties,
      metadata: contract.metadata,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
      filePath: `uploads/contracts/${baseFilename}.txt`,
    };
    await fs.writeFile(jsonPath, JSON.stringify(metadata, null, 2), "utf-8");

    console.log(`✅ Contract saved to disk: ${baseFilename}`);
  } catch (error) {
    console.error("Failed to save contract to file:", error);
    throw error;
  }
}

/**
 * Load all contracts from disk
 */
export async function loadContractsFromDisk(): Promise<Contract[]> {
  try {
    await ensureUploadDirectory();

    const files = await fs.readdir(UPLOADS_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    const contracts: Contract[] = [];

    for (const jsonFile of jsonFiles) {
      try {
        const jsonPath = path.join(UPLOADS_DIR, jsonFile);
        const txtFile = jsonFile.replace(".json", ".txt");
        const txtPath = path.join(UPLOADS_DIR, txtFile);

        // Read metadata
        const metadataStr = await fs.readFile(jsonPath, "utf-8");
        const metadata = JSON.parse(metadataStr);

        // Read content
        const content = await fs.readFile(txtPath, "utf-8");

        // Reconstruct contract object
        const contract: Contract = {
          id: metadata.id,
          title: metadata.title,
          content: content,
          contractType: metadata.contractType,
          status: metadata.status,
          parties: metadata.parties || [],
          metadata: metadata.metadata || {},
          createdAt: new Date(metadata.createdAt),
          updatedAt: new Date(metadata.updatedAt),
        };

        contracts.push(contract);
      } catch (error) {
        console.error(`Failed to load contract from ${jsonFile}:`, error);
        // Continue loading other contracts
      }
    }

    console.log(`✅ Loaded ${contracts.length} contracts from disk`);
    return contracts;
  } catch (error) {
    console.error("Failed to load contracts from disk:", error);
    return [];
  }
}

/**
 * Delete contract files from disk
 */
export async function deleteContractFromDisk(contract: Contract): Promise<void> {
  try {
    const baseFilename = generateContractFilename(contract);
    const txtPath = path.join(UPLOADS_DIR, `${baseFilename}.txt`);
    const jsonPath = path.join(UPLOADS_DIR, `${baseFilename}.json`);

    await fs.unlink(txtPath);
    await fs.unlink(jsonPath);

    console.log(`✅ Contract deleted from disk: ${baseFilename}`);
  } catch (error) {
    console.error("Failed to delete contract from disk:", error);
    throw error;
  }
}
