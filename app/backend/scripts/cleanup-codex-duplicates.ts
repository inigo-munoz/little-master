import { prisma } from "../src/db/prisma.js";

async function main() {
  const codexConfigs = await prisma.llmConfig.findMany({
    where: { provider: "openai-codex" },
    orderBy: [
      { oauthAccessToken: "desc" },
      { updatedAt: "desc" },
    ],
  });

  console.log(`Encontrados ${codexConfigs.length} registros para openai-codex`);

  if (codexConfigs.length <= 1) {
    console.log("Sin duplicados. Nada que limpiar.");
    await prisma.$disconnect();
    return;
  }

  const [keep, ...duplicates] = codexConfigs;
  console.log(`Conservando: ${keep.id} (model: ${keep.model}, hasToken: ${!!keep.oauthAccessToken})`);

  for (const dup of duplicates) {
    console.log(`Eliminando: ${dup.id} (model: ${dup.model}, hasToken: ${!!dup.oauthAccessToken})`);
    await prisma.llmConfig.delete({ where: { id: dup.id } });
  }

  await prisma.llmConfig.update({
    where: { id: keep.id },
    data: { authMethod: "oauth" },
  });

  if (keep.model === "gpt-5.3-codex" || keep.model === "o4-mini" || keep.model === "o3") {
    await prisma.llmConfig.update({
      where: { id: keep.id },
      data: { model: "gpt-5.4" },
    });
    console.log(`Modelo corregido: ${keep.model} → gpt-5.4`);
  }

  console.log("✓ Limpieza completada");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
