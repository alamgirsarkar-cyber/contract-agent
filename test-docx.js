import mammoth from "mammoth";
import { readFileSync } from "fs";

const filePath = "C:\\Users\\Sanjay_Saha\\Desktop\\Download\\Independent-Contractor-Agreement-Template-Signaturely.docx";

console.log("🔍 Testing DOCX file parsing...");
console.log(`📄 File: ${filePath}`);

try {
  const buffer = readFileSync(filePath);
  console.log(`✅ File read successfully: ${(buffer.length / 1024).toFixed(2)} KB`);

  const result = await mammoth.extractRawText({ buffer });

  console.log(`\n✅ Text extraction successful!`);
  console.log(`📊 Extracted ${result.value.length} characters`);
  console.log(`📊 Word count: ~${result.value.split(/\s+/).length} words`);

  console.log(`\n📝 First 500 characters:`);
  console.log("─".repeat(80));
  console.log(result.value.substring(0, 500));
  console.log("─".repeat(80));

  if (result.messages && result.messages.length > 0) {
    console.log(`\n⚠️ Warnings from mammoth:`);
    result.messages.forEach(msg => console.log(`  - ${msg.message}`));
  }

  if (!result.value || result.value.trim().length === 0) {
    console.error(`\n❌ ERROR: File parsed but content is empty!`);
  } else {
    console.log(`\n✅ SUCCESS: File contains valid text content`);
  }

} catch (error) {
  console.error(`\n❌ ERROR parsing DOCX file:`);
  console.error(error);
}
