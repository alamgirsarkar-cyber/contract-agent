import { storage } from "./server/storage.js";
import { generateEmbedding } from "./server/langgraph-agent.js";
import { storeTemplateEmbedding } from "./server/supabase.js";

console.log("🔄 Backfilling embeddings for existing templates...\n");

async function backfillEmbeddings() {
  try {
    const templates = await storage.getTemplates();
    console.log(`📊 Found ${templates.length} templates\n`);

    if (templates.length === 0) {
      console.log("❌ No templates found. Please upload templates first.");
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const template of templates) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📄 Processing: ${template.title}`);
      console.log(`   ID: ${template.id}`);
      console.log(`   Category: ${template.category}`);
      console.log(`   Content length: ${template.content.length} characters`);

      try {
        // Generate embedding
        console.log(`   🧠 Generating embedding...`);
        const embedding = await generateEmbedding(template.content);
        console.log(`   ✅ Embedding generated: ${embedding.length} dimensions`);

        // Store in Supabase
        console.log(`   💾 Storing in Supabase...`);
        const result = await storeTemplateEmbedding(
          template.id,
          template.content,
          embedding
        );

        if (result.success) {
          console.log(`   ✅ SUCCESS: Embedding stored in vector database`);
          successCount++;
        } else {
          console.error(`   ❌ FAILED: ${result.error}`);
          failCount++;
        }
      } catch (error) {
        console.error(`   ❌ ERROR: ${error.message}`);
        failCount++;
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n📊 SUMMARY:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📝 Total: ${templates.length}`);

    if (successCount === templates.length) {
      console.log(`\n✅ All embeddings backfilled successfully!`);
      console.log(`\n🎯 Next steps:`);
      console.log(`   1. Run the SQL queries above to verify`);
      console.log(`   2. Try generating a contract again`);
      console.log(`   3. You should now see RAG working with similarity scores!`);
    } else {
      console.log(`\n⚠️ Some embeddings failed. Check errors above.`);
    }

  } catch (error) {
    console.error(`\n❌ Backfill process failed:`, error);
  }
}

backfillEmbeddings();
