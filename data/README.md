# Catálogo

Cada aplicativo aprovado é armazenado como um arquivo JSON em `data/apps`.

Os arquivos dessa pasta são a fonte de verdade da galeria. Não edite os totais de curtidas aqui: eles são obtidos das reações 👍 da Issue original durante cada release.

Todo registro precisa apontar para uma Issue real e preservada. Os arquivos desta pasta são a fonte canônica do catálogo publicado e mantêm as evidências verificadas de cada menção.

O campo `mentions[]` registra o episódio, a data, a URL e as evidências obtidas da API pública do Gigahertz e das notas/transcrição do episódio.

## Leitura como API

Os JSONs individuais são a fonte canônica e podem ser consumidos diretamente pelo GitHub:

```text
https://raw.githubusercontent.com/ezefranca/VitrineADT/main/data/apps/{arquivo}.json
```

Para descobrir os nomes dos arquivos, use a [Contents API do GitHub](https://api.github.com/repos/ezefranca/VitrineADT/contents/data/apps?ref=main). O build também publica um snapshot agregado em `https://vitrineadt.ezequiel.app/data/apps.json`, destinado principalmente à interface da galeria.
