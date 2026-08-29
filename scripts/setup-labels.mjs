import { githubRequest, repositoryFromEnvironment } from "./github.mjs";

const labels = [
  ["submission/new", "5319e7", "Nova submissão de aplicativo"],
  ["submission/seed", "8250df", "Entrada criada pela importação inicial"],
  ["validation/passed", "2da44e", "Evidência automática encontrada"],
  ["validation/needs-review", "bf8700", "A evidência precisa de revisão humana"],
  ["validation/failed", "d1242f", "Submissão inválida"],
  ["validation/source-unavailable", "fbca04", "Fonte externa temporariamente indisponível"],
  ["validation/recheck", "0969da", "Solicita uma nova validação"],
  ["status/awaiting-moderation", "d4c5f9", "Aguardando decisão editorial"],
  ["moderation/approved", "0e8a16", "Aprovado por um moderador"],
  ["moderation/rejected", "b60205", "Rejeitado por um moderador"],
  ["publication/queued", "1d76db", "Aguardando a próxima release"],
  ["publication/published", "0052cc", "Publicado na galeria"],
  ["report/new", "d93f0b", "Nova denúncia sobre um aplicativo"],
  ["removal/new", "c62828", "Pedido de remoção pelo titular"],
  ["removal/awaiting-moderation", "fbca04", "Pedido de remoção aguardando revisão humana"],
  ["removal/approved", "0e8a16", "Remoção aprovada por um moderador"],
  ["removal/completed", "0052cc", "Aplicativo retirado do catálogo"],
  ["removal/failed", "d1242f", "Pedido de remoção inválido"]
];

const repository = repositoryFromEnvironment();
for (const [name, color, description] of labels) {
  try {
    await githubRequest(`/repos/${repository}/labels`, { method: "POST", body: { name, color, description } });
    console.log(`Criada: ${name}`);
  } catch (error) {
    if (!error.message.includes("422")) throw error;
    await githubRequest(`/repos/${repository}/labels/${encodeURIComponent(name)}`, { method: "PATCH", body: { new_name: name, color, description } });
    console.log(`Atualizada: ${name}`);
  }
}
