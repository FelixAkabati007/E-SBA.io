
import { pool } from "../server/lib/db";

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Checking for head_signature_url column...");
    const checkRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='school_settings' AND column_name='head_signature_url';
    `);

    if (checkRes.rows.length === 0) {
      console.log("Column not found. Adding head_signature_url...");
      await client.query(`
        ALTER TABLE school_settings 
        ADD COLUMN head_signature_url TEXT;
      `);
      console.log("Column added successfully.");
    } else {
      console.log("Column already exists.");
    }

    console.log("Checking for signature_enabled column...");
    const checkRes2 = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='school_settings' AND column_name='signature_enabled';
    `);

    if (checkRes2.rows.length === 0) {
      console.log("Column not found. Adding signature_enabled...");
      await client.query(`
        ALTER TABLE school_settings 
        ADD COLUMN signature_enabled BOOLEAN DEFAULT TRUE;
      `);
      console.log("Column added successfully.");
    } else {
      console.log("Column already exists.");
    }

  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
