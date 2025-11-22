import mammoth from "mammoth";
import { createRequire } from "module";

// Create require function for CommonJS modules
const require = createRequire(import.meta.url);

/**
 * Parse different file types and extract text content
 */
export async function parseFile(
  buffer: Buffer,
  mimetype: string,
  filename: string
): Promise<{ content: string; error?: string }> {
  try {
    // Handle PDF files
    if (mimetype === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
      try {
        // Use require for pdfjs-dist (CommonJS module)
        const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

        // Convert buffer to Uint8Array for pdfjs
        const data = new Uint8Array(buffer);

        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument({
          data,
          useSystemFonts: true,
          standardFontDataUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/",
        });
        const pdf = await loadingTask.promise;

        let fullText = "";

        // Extract text from each page
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(" ");
          fullText += pageText + "\n\n";
        }

        if (!fullText.trim()) {
          return {
            content: "",
            error: "PDF appears to be empty or image-based. Please upload a text-based PDF.",
          };
        }

        return { content: fullText.trim() };
      } catch (pdfError) {
        console.error("PDF parsing error:", pdfError);
        throw new Error(
          `Unable to parse PDF: ${pdfError instanceof Error ? pdfError.message : "Unknown error"}`
        );
      }
    }

    // Handle DOCX files
    if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      filename.toLowerCase().endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return { content: result.value };
    }

    // Handle plain text files
    if (mimetype === "text/plain" || filename.toLowerCase().endsWith(".txt")) {
      return { content: buffer.toString("utf-8") };
    }

    // Unsupported file type
    return {
      content: "",
      error: `Unsupported file type: ${mimetype}. Please upload PDF, DOCX, or TXT files.`,
    };
  } catch (error) {
    console.error("File parsing error:", error);
    console.error("File details:", { mimetype, filename });
    return {
      content: "",
      error: `Failed to parse file: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
