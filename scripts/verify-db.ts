import "dotenv/config";
import { verifyDatabase } from "../server/db-init";

// Run verification
(async () => {
  try {
    await verifyDatabase();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
  }
})();
