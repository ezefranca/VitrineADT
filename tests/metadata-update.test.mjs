import test from "node:test";
import assert from "node:assert/strict";
import { parseMetadataUpdate, validateMetadataUpdate } from "../scripts/metadata-update.mjs";

const updateBody = ({ developer = "Augusto Simionato", icon = "https://example.com/loop.png" } = {}) => `### Issue da entrada

https://github.com/ezefranca/VitrineADT/issues/19

### Nome do aplicativo

Loop atualizado

### Desenvolvedor ou equipe

${developer}

### Site do desenvolvedor

https://augusto.example.com

### Descrição curta

Um player de podcasts independente.

### Plataformas

- [x] iOS
- [x] iPadOS
- [ ] macOS

### Link principal do aplicativo

https://example.com/loop

### Link da App Store

https://apps.apple.com/br/app/loop-player-de-podcasts/id6736364779

### Link do Google Play

_No response_

### Código-fonte

https://github.com/example/loop

### Link direto para o ícone

${icon}

### Declaração

- [x] As informações atualizadas são públicas, verdadeiras e autorizadas para exibição na galeria.
`;

test("interpreta uma atualização de metadados e sua Issue de entrada", () => {
  const request = parseMetadataUpdate(updateBody());
  assert.equal(request.entryIssue, 19);
  assert.equal(request.updates.name, "Loop atualizado");
  assert.equal(request.updates.developerName, "Augusto Simionato");
  assert.deepEqual(request.updates.platforms, ["ios", "ipados"]);
  assert.equal(request.hasUpdates, true);
  assert.equal(validateMetadataUpdate(request).length, 0);
});

test("não aceita uma atualização sem campos ou com URL insegura", () => {
  const request = parseMetadataUpdate("### Issue da entrada\n\n#19\n\n### Declaração\n\n- [x] Ok\n");
  assert.match(validateMetadataUpdate(request).join(" "), /pelo menos um metadado/);

  const unsafe = parseMetadataUpdate(updateBody({ icon: "http://example.com/icon.png" }));
  assert.match(validateMetadataUpdate(unsafe).join(" "), /URL HTTPS/);
});
