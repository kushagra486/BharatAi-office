import { env } from './env';
import './hive/db'; // initializes + migrates the Hive on import

async function main() {
  console.log(`[daemon] Hive ready at ${env.HIVE_DB_PATH}`);
  console.log(`[daemon] Project workdir: ${env.PROJECT_WORKDIR}`);
}

main().catch((err) => {
  console.error('[daemon] fatal error during startup', err);
  process.exit(1);
});
