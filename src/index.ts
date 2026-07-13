import "dotenv/config";
import { runAlerts } from "./alertService.js";
import { logger } from "./logger.js";

async function main() {
  logger.info("Iniciando monitoramento OLX.");
  const stats = await runAlerts();
  logger.info("Execucao finalizada.", stats);
}

main().catch((error) => {
  logger.error("Erro fatal na execucao.", error);
  process.exitCode = 1;
});
