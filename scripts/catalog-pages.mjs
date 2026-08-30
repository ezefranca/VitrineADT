import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { slugify } from "./submission.mjs";

const IGNORED_SUBMITTERS = new Set(["", "unknown", "demo", "github-actions[bot]", "catalog-curation"]);

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function githubAuthor(record) {
  const submittedBy = String(record.submission?.submittedBy ?? "").trim();
  if (!IGNORED_SUBMITTERS.has(submittedBy.toLowerCase()) && /^[a-zd](?:[a-zd-]{0,37}[a-zd])?$/i.test(submittedBy)) {
    return {
      username: submittedBy,
      url: `https://github.com/${submittedBy}`,
      source: "submitter"
    };
  }

  try {
    const source = new URL(record.links?.source ?? "");
    const [owner] = source.pathname.split("/").filter(Boolean);
    if (source.hostname === "github.com" && owner && /^[a-z\d-]+$/i.test(owner)) {
      return { username: owner, url: `https://github.com/${owner}`, source: "source-repository" };
    }
  } catch {
    // Aplicativos sem repositório público não recebem autoria inferida.
  }
  return null;
}

export function enrichCatalogApps(records) {
  const usedSlugs = new Set();
  return records.map((record) => {
    const base = record.slug ? slugify(record.slug) : slugify(record.name);
    let slug = base;
    let suffix = 2;
    while (usedSlugs.has(slug)) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    usedSlugs.add(slug);
    const author = githubAuthor(record);
    return {
      ...record,
      slug,
      detailPath: `apps/${slug}/`,
      author: author ? { ...author, path: `author/${author.username.toLowerCase()}/` } : null
    };
  });
}

function platforms(app) {
  const labels = { web: "Web", ios: "iOS", ipados: "iPadOS", macos: "macOS", android: "Android", windows: "Windows", linux: "Linux", watchos: "watchOS", tvos: "tvOS", other: "Outra" };
  return app.platforms.map((platform) => `<span class="badge">${escapeHTML(labels[platform] ?? platform)}</span>`).join("");
}

function iconMarkup(app, prefix = "../../") {
  if (app.icon?.path) {
    const source = `${prefix}icons/${encodeURIComponent(path.basename(app.icon.path))}`;
    return `<img src="${source}" alt="" width="112" height="112">`;
  }
  const initials = app.name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return escapeHTML(initials);
}

function footer(prefix, repositoryURL) {
  return `<footer class="site-footer">
    <div class="footer-intro">
      <a class="wordmark" href="${prefix}" aria-label="VitrineADT, página inicial"><span>Vitrine</span><span class="wordmark-accent">ADT</span></a>
      <p>Uma galeria independente dos aplicativos apresentados em “Amigos do Área de Transferência”.</p>
    </div>
    <nav class="footer-nav" aria-label="Informações sobre a VitrineADT">
      <a href="${prefix}sobre.html">Sobre</a>
      <a href="${prefix}como-funciona.html">Como funciona</a>
      <a href="${prefix}termos.html">Termos de uso</a>
      <a href="${prefix}privacidade.html">Privacidade</a>
      <a href="${prefix}codigo-de-conduta.html">Código de conduta</a>
    </nav>
    <div class="footer-legal">
      ${repositoryURL ? `<a class="github-link" href="${escapeHTML(repositoryURL)}" target="_blank" rel="external noopener noreferrer" aria-label="Ver o projeto VitrineADT no GitHub"><img src="https://github.githubassets.com/favicons/favicon.svg" alt="" width="20" height="20"><span>GitHub</span></a>` : ""}
      <p>© 2026 VitrineADT. Projeto independente.</p>
      <p>Os direitos autorais, marcas, ícones e demais materiais de cada aplicativo pertencem aos respectivos titulares.</p>
      <p>Gigahertz e Área de Transferência pertencem à Rede Gigahertz LTDA. Não há afiliação ou endosso.</p>
    </div>
  </footer>`;
}

function shell({ title, description, body, prefix = "../../", script = "", repositoryURL = null }) {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="theme-color" content="#f5f5f7">
    <meta name="description" content="${escapeHTML(description)}">
    <meta property="og:title" content="${escapeHTML(title)}">
    <meta property="og:description" content="${escapeHTML(description)}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHTML(title)}">
    <meta name="twitter:description" content="${escapeHTML(description)}">
    <title>${escapeHTML(title)}</title>
    <script src="${prefix}theme.js"></script>
    <link rel="stylesheet" href="${prefix}styles.css">
    ${script ? `<script src="${prefix}${script}" type="module"></script>` : ""}
  </head>
  <body>
    <a class="skip-link" href="#main-content">Pular para o conteúdo</a>
    <header class="site-header">
      <a class="wordmark" href="${prefix}" aria-label="VitrineADT, página inicial"><span>Vitrine</span><span class="wordmark-accent">ADT</span></a>
      <nav aria-label="Navegação principal"><a href="${prefix}#recentes">Apps</a><a href="${prefix}sobre.html">Sobre</a><a href="${prefix}como-funciona.html">Como funciona</a></nav>
      <div class="header-actions">
        <button class="theme-toggle" type="button" aria-label="Usar tema escuro" aria-pressed="false"><span class="theme-toggle-icon" aria-hidden="true">☾</span><span class="theme-toggle-label">Escuro</span></button>
      </div>
    </header>
    ${body}
    ${footer(prefix, repositoryURL)}
  </body>
</html>`;
}

function appPage(app, repositoryURL) {
  const mentions = [...(app.mentions ?? [])].sort((a, b) => b.episode - a.episode || b.date.localeCompare(a.date));
  const latestMention = mentions[0] ?? null;
  const mentionsMarkup = mentions.length > 0 ? mentions.map((mention) => `
      <section class="mention-panel">
        <p class="eyebrow">Amigos do ADT</p>
        <h2>Apresentado no episódio ${mention.episode}</h2>
        <p>${escapeHTML(mention.title)} · ${escapeHTML(mention.date)}</p>
        <a class="text-link" href="${escapeHTML(mention.url)}" target="_blank" rel="noopener noreferrer">Ouvir e consultar a transcrição <span aria-hidden="true">↗</span></a>
      </section>`).join("") : "";
  const author = app.author
    ? `<a href="../../${escapeHTML(app.author.path)}" title="Ver aplicativos associados a @${escapeHTML(app.author.username)}">${escapeHTML(app.developer.name)}</a>`
    : escapeHTML(app.developer.name);
  const issueURL = app.submission?.issueURL ?? (repositoryURL && app.submission?.issue ? `${repositoryURL}/issues/${app.submission.issue}` : null);
  const likesCount = app.likes ?? 0;
  const reportURL = repositoryURL ? `${repositoryURL}/issues/new?template=report.yml&title=${encodeURIComponent(`[Denúncia]: ${app.name}`)}` : null;
  const removalURL = repositoryURL && app.submission?.issue
    ? `${repositoryURL}/issues/new?template=removal.yml&title=${encodeURIComponent(`[Remoção]: ${app.name}`)}&body=${encodeURIComponent(`### Issue da entrada\n\n${app.submission.issueURL ?? `${repositoryURL}/issues/${app.submission.issue}`}\n`)}`
    : null;
  const moderation = reportURL ? `<div class="detail-secondary-actions">
    <a href="${escapeHTML(reportURL)}" target="_blank" rel="noopener noreferrer">Reportar informações</a>
    ${removalURL ? `<a href="${escapeHTML(removalURL)}" target="_blank" rel="noopener noreferrer">Solicitar remoção</a>` : ""}
  </div>` : "";
  const body = `<main id="main-content" class="content-page app-detail-page">
    <a class="back-link" href="../../#todos"><span aria-hidden="true">←</span> Todos os aplicativos</a>
    <article class="app-profile">
      <div class="app-profile-icon app-icon" aria-hidden="true">${iconMarkup(app)}</div>
      <div class="platform-badges">${platforms(app)}</div>
      <h1>${escapeHTML(app.name)}</h1>
      <p class="app-profile-developer">por ${author}</p>
      <p class="app-profile-description">${escapeHTML(app.description)}</p>
      <div class="app-profile-actions">
        <a class="button" href="${escapeHTML(app.links.website)}" target="_blank" rel="noopener noreferrer">Abrir o aplicativo <span aria-hidden="true">↗</span></a>
        ${issueURL ? `<a class="button button-secondary app-like-link" href="${escapeHTML(issueURL)}" target="_blank" rel="noopener noreferrer" aria-label="Curtir ${escapeHTML(app.name)} no GitHub. ${likesCount} curtidas">👍 Curtidas: <span class="app-like-count">${likesCount}</span></a>` : ""}
        <button class="share-button button button-secondary" type="button" data-share-title="${escapeHTML(app.name)}" data-share-text="${escapeHTML(`${app.name}, apresentado em Amigos do Área de Transferência.`)}">Compartilhar</button>
      </div>
      <p class="share-status" aria-live="polite"></p>
      <section class="share-studio" aria-labelledby="share-studio-title"
        data-share-name="${escapeHTML(app.name)}"
        data-share-developer="${escapeHTML(app.developer.name)}"
        data-share-episode="${latestMention ? escapeHTML(latestMention.episode) : ""}"
        data-share-episode-title="${latestMention ? escapeHTML(latestMention.title) : ""}"
        data-share-episode-url="${latestMention ? escapeHTML(latestMention.url) : ""}"
        data-share-icon="${app.icon?.path ? escapeHTML(`../../icons/${path.basename(app.icon.path)}`) : ""}">
        <div class="share-studio-heading">
          <p class="eyebrow">Compartilhe a descoberta</p>
          <h2 id="share-studio-title">Leve esta menção para a sua timeline.</h2>
          <p>Escolha um formato, ajuste a aparência e baixe uma arte pronta com o app e o episódio em que ele apareceu.</p>
        </div>
        <div class="share-studio-layout">
          <div class="share-artwork-frame">
            <canvas id="share-artwork" class="share-artwork" width="1200" height="630" aria-label="Prévia da arte de compartilhamento"></canvas>
          </div>
          <div class="share-controls">
            <fieldset>
              <legend>Formato</legend>
              <div class="share-options" role="group" aria-label="Formato da arte">
                <button type="button" class="share-option is-selected" data-format="web" aria-pressed="true">Web <span>1200×630</span></button>
                <button type="button" class="share-option" data-format="instagram" aria-pressed="false">Instagram <span>1080×1350</span></button>
                <button type="button" class="share-option" data-format="tiktok" aria-pressed="false">TikTok <span>1080×1920</span></button>
              </div>
            </fieldset>
            <fieldset>
              <legend>Aparência</legend>
              <div class="share-options share-theme-options" role="group" aria-label="Tema da arte">
                <button type="button" class="share-option is-selected" data-share-theme="dark" aria-pressed="true">Escuro</button>
                <button type="button" class="share-option" data-share-theme="light" aria-pressed="false">Claro</button>
              </div>
            </fieldset>
            <div class="share-studio-actions">
              <button id="download-share-artwork" class="button" type="button">Baixar arte</button>
              <button id="share-share-artwork" class="button button-secondary" type="button">Compartilhar arte</button>
            </div>
            <p class="share-studio-status" aria-live="polite"></p>
          </div>
        </div>
      </section>
      ${mentionsMarkup}
      ${moderation}
    </article>
  </main>`;
  return shell({ title: `${app.name} — VitrineADT`, description: app.description, body, script: "share.js", repositoryURL });
}

function authorPage(author, apps, repositoryURL) {
  const cards = apps.map((app) => `<article class="author-app-card">
    <div class="app-icon" aria-hidden="true">${iconMarkup(app)}</div>
    <div><h2><a href="../../${escapeHTML(app.detailPath)}">${escapeHTML(app.name)}</a></h2><p>${escapeHTML(app.description)}</p></div>
  </article>`).join("");
  const origin = author.source === "submitter"
    ? "Aplicativos associados a esta conta nas submissões públicas da VitrineADT."
    : "Aplicativos associados a esta conta pelo repositório público do projeto.";
  const body = `<main id="main-content" class="content-page author-page">
    <a class="back-link" href="../../#todos"><span aria-hidden="true">←</span> Todos os aplicativos</a>
    <header class="page-hero"><p class="eyebrow">Autor no GitHub</p><h1>@${escapeHTML(author.username)}</h1><p class="page-lede">${origin}</p><a class="text-link" href="${escapeHTML(author.url)}" target="_blank" rel="noopener noreferrer">Ver perfil no GitHub <span aria-hidden="true">↗</span></a></header>
    <section class="author-apps" aria-labelledby="author-apps-title"><h2 id="author-apps-title">${apps.length === 1 ? "1 aplicativo" : `${apps.length} aplicativos`}</h2>${cards}</section>
  </main>`;
  return shell({ title: `@${author.username} — VitrineADT`, description: origin, body, repositoryURL });
}

export async function generateCatalogPages({ outputDirectory, apps, repositoryURL }) {
  for (const app of apps) {
    const directory = path.join(outputDirectory, "apps", app.slug);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "index.html"), appPage(app, repositoryURL));
  }

  const byAuthor = new Map();
  for (const app of apps.filter((item) => item.author)) {
    const key = app.author.username.toLowerCase();
    const group = byAuthor.get(key) ?? { author: app.author, apps: [] };
    group.apps.push(app);
    byAuthor.set(key, group);
  }
  for (const [key, group] of byAuthor) {
    const directory = path.join(outputDirectory, "author", key);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "index.html"), authorPage(group.author, group.apps, repositoryURL));
  }
}
