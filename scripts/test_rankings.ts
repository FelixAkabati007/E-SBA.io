
import { getRankings } from "../server/services/reporting";
import { pool } from "../server/lib/db";

async function testRankings() {
  try {
    console.log("Testing getRankings...");
    const result = await getRankings("JHS 1", "2025/2026", "Term 1");
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("Error:", e);
  } finally {
    pool.end();
  }
}

testRankings();
