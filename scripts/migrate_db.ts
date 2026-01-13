
import { pool } from "../server/lib/db";

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Checking school_settings table...");
    
    // Add signature_enabled column
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='school_settings' AND column_name='signature_enabled') THEN
          ALTER TABLE school_settings ADD COLUMN signature_enabled BOOLEAN DEFAULT TRUE;
          RAISE NOTICE 'Added signature_enabled column';
        END IF;
      END $$;
    `);

    // Add head_signature_url column
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='school_settings' AND column_name='head_signature_url') THEN
          ALTER TABLE school_settings ADD COLUMN head_signature_url TEXT;
          RAISE NOTICE 'Added head_signature_url column';
        END IF;
      END $$;
    `);

    console.log("Migration completed successfully.");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
