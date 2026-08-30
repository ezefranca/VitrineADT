import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { compareMentions, latestMention } from "./mention-order.mjs";
import { slugify } from "./submission.mjs";

const SITE_ORIGIN = "https://vitrineadt.ezequiel.app";

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
      <a class="wordmark" href="${prefix}" aria-label="VitrineADT, página inicial"><img class="brand-icon" src="${prefix}icon.svg" alt="" width="24" height="24"><span>Vitrine</span><span class="wordmark-accent">ADT</span></a>
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
    <link rel="icon" href="${prefix}icon.svg" type="image/svg+xml">
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
      <a class="wordmark" href="${prefix}" aria-label="VitrineADT, página inicial"><img class="brand-icon" src="${prefix}icon.svg" alt="" width="24" height="24"><span>Vitrine</span><span class="wordmark-accent">ADT</span></a>
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
  const mentions = [...(app.mentions ?? [])].sort(compareMentions);
  const mostRecentMention = latestMention(app);
  const pageURL = `${SITE_ORIGIN}/${app.detailPath}`;
  const shareText = mostRecentMention
    ? `Meu aplicativo ${app.name} foi mencionado no ADT ${mostRecentMention.episode}. Confira: ${pageURL}\nOuça o episódio: ${mostRecentMention.url}`
    : `Meu aplicativo ${app.name} foi mencionado no Área de Transferência. Confira: ${pageURL}`;
  const mentionsMarkup = mentions.length > 0 ? mentions.map((mention) => `
      <section class="mention-panel">
        <p class="eyebrow">Amigos do ADT</p>
        <h2>Apresentado no episódio ${mention.episode}</h2>
        <p>${escapeHTML(mention.title)} · ${escapeHTML(mention.date)}</p>
        <a class="text-link" href="${escapeHTML(mention.url)}" target="_blank" rel="noopener noreferrer">Ouvir episódio ${escapeHTML(mention.episode)} <span aria-hidden="true">↗</span></a>
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
      </div>
      <section class="share-panel" aria-labelledby="share-panel-title"
        data-share-page-url="${escapeHTML(pageURL)}"
        data-share-text="${escapeHTML(shareText)}">
        <div class="share-panel-heading">
          <div class="share-app-icon app-icon" aria-hidden="true">${iconMarkup(app)}</div>
          <div>
            <p class="eyebrow">Compartilhe a menção</p>
            <h2 id="share-panel-title">Conte que seu projeto apareceu no ADT.</h2>
            <p>Escolha uma rede para publicar a mensagem pronta com o link da página e do episódio.</p>
          </div>
        </div>
        <nav class="social-links" aria-label="Compartilhar nas redes sociais">
          <button class="share-button button" type="button"><span class="social-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0-7.7 13.65L3 21l4.58-1.2A9 9 0 1 0 12 3Zm0 1.8a7.2 7.2 0 0 1 0 14.4c-1.17 0-2.27-.28-3.24-.77l-.27-.14-2.72.71.72-2.65-.16-.27A7.2 7.2 0 0 1 12 4.8Zm-2.1 3.4c-.18 0-.47.07-.72.34-.25.27-.95.93-.95 2.27s.97 2.63 1.1 2.81c.13.18 1.88 3.01 4.66 4.1 2.3.9 2.78.72 3.28.67.5-.04 1.6-.65 1.83-1.27.23-.62.23-1.15.16-1.26-.07-.11-.25-.18-.52-.31-.27-.13-1.6-.79-1.85-.88-.25-.09-.43-.13-.61.13-.18.27-.7.88-.86 1.06-.16.18-.31.2-.58.07-.27-.13-1.13-.42-2.15-1.33-.79-.7-1.33-1.57-1.49-1.84-.16-.27-.02-.41.12-.54.12-.12.27-.31.4-.47.13-.16.18-.27.27-.45.09-.18.04-.34-.02-.47-.07-.13-.59-1.47-.83-2.01-.22-.53-.44-.46-.61-.46Z"/></svg></span><span>Compartilhar</span></button>
          <a class="social-link" data-network="whatsapp" href="#"><span class="social-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0-7.7 13.65L3 21l4.58-1.2A9 9 0 1 0 12 3Zm0 1.8a7.2 7.2 0 0 1 0 14.4c-1.17 0-2.27-.28-3.24-.77l-.27-.14-2.72.71.72-2.65-.16-.27A7.2 7.2 0 0 1 12 4.8Z"/><path d="M9.9 8.2c-.18 0-.47.07-.72.34-.25.27-.95.93-.95 2.27s.97 2.63 1.1 2.81c.13.18 1.88 3.01 4.66 4.1 2.3.9 2.78.72 3.28.67.5-.04 1.6-.65 1.83-1.27.23-.62.23-1.15.16-1.26-.07-.11-.25-.18-.52-.31-.27-.13-1.6-.79-1.85-.88-.25-.09-.43-.13-.61.13-.18.27-.7.88-.86 1.06-.16.18-.31.2-.58.07-.27-.13-1.13-.42-2.15-1.33-.79-.7-1.33-1.57-1.49-1.84-.16-.27-.02-.41.12-.54.12-.12.27-.31.4-.47.13-.16.18-.27.27-.45.09-.18.04-.34-.02-.47-.07-.13-.59-1.47-.83-2.01-.22-.53-.44-.46-.61-.46Z"/></svg></span><span>WhatsApp</span></a>
          <a class="social-link" data-network="bluesky" href="#"><span class="social-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 11.2C11.1 9.4 8.62 5.88 6.3 4.2 4.08 2.6 3.28 2.88 2.72 3.13 2.07 3.42 2 4.4 2 4.98c0 .58.32 4.72.52 5.4.67 2.27 3.05 3.03 5.55 2.77-4.35.66-8.2 2.28-3.13 8.03 5.62 5.02 6.14-1.08 7.06-4.15.92 3.07 1.44 9.17 7.06 4.15 5.07-5.75 1.22-7.37-3.13-8.03 2.5.26 4.88-.5 5.55-2.77.2-.68.52-4.82.52-5.4 0-.58-.07-1.56-.72-1.85-.56-.25-1.36-.53-3.58 1.07C15.38 5.88 12.9 9.4 12 11.2Z"/></svg></span><span>Bluesky</span></a>
          <a class="social-link" data-network="x" href="#"><span class="social-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h4.1l3.38 4.8L16.45 4H19l-5.35 6.1L19.5 20h-4.1l-3.86-5.48L6.93 20H4.38l5.55-6.78L5 4Zm3.08 1.8h-1l7.46 12.4h1L8.08 5.8Z"/></svg></span><span>X</span></a>
          <a class="social-link" data-network="linkedin" href="#"><span class="social-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5.2 7.1A1.9 1.9 0 1 0 5.2 3.3a1.9 1.9 0 0 0 0 3.8ZM3.55 20.7h3.3V9.1h-3.3v11.6ZM9 9.1h3.16v1.58h.05c.44-.83 1.52-1.98 3.14-1.98 3.36 0 3.98 2.21 3.98 5.09v6.91h-3.3v-6.12c0-1.46-.03-3.34-2.04-3.34-2.04 0-2.35 1.6-2.35 3.24v6.22H9V9.1Z"/></svg></span><span>LinkedIn</span></a>
          <a class="social-link" data-network="facebook" href="#"><span class="social-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M13.5 21v-8h2.7l.4-3h-3.1V8.08c0-.87.24-1.46 1.5-1.46h1.7V3.94c-.3-.04-1.3-.12-2.47-.12-2.45 0-4.13 1.5-4.13 4.25V10H7.33v3h2.77v8h3.4Z"/></svg></span><span>Facebook</span></a>
          <a class="social-link" data-network="threads" href="#"><span class="social-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12.2 3.2c4.5 0 7.7 2.7 8.15 6.82l-2.13.27c-.36-2.82-2.42-4.54-5.82-4.54-3.48 0-5.82 1.68-5.82 4.18 0 2.23 1.65 3.35 5.05 3.35 1.42 0 2.67-.2 3.72-.6-.42-1.6-1.5-2.37-3.18-2.37-1.2 0-2 .42-2.46 1.25l-1.9-1.02c.83-1.55 2.3-2.35 4.36-2.35 2.8 0 4.68 1.43 5.36 4.03 1.2-.73 1.85-1.62 1.85-2.66 0-2.18-2.2-4.25-5.28-4.25-4.26 0-6.92 2.36-6.92 6.1 0 3.72 2.57 6.06 6.56 6.06 2.4 0 4.07-.75 5.01-2.22l1.8 1.17c-1.34 2.1-3.62 3.18-6.81 3.18-5.25 0-8.78-3.18-8.78-8.19 0-5.03 3.65-8.21 9.24-8.21Z"/></svg></span><span>Threads</span></a>
          <a class="social-link" data-network="telegram" href="#"><span class="social-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m21.2 4.1-3.17 15.03c-.24 1.06-.87 1.32-1.77.82l-4.87-3.59-2.35 2.26c-.26.26-.48.48-.98.48l.35-4.97 9.05-8.18c.4-.35-.09-.55-.62-.2L5.65 12.8.87 11.3c-1.04-.33-1.06-1.04.22-1.54L19.8 2.55c.87-.32 1.63.2 1.4 1.55Z"/></svg></span><span>Telegram</span></a>
          <a class="social-link" data-network="reddit" href="#"><span class="social-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20.2 12.1c0-.97-.78-1.75-1.75-1.75-.47 0-.9.19-1.21.5-1.18-.82-2.76-1.35-4.51-1.42l.77-3.6 2.5.53a1.57 1.57 0 1 0 .18-1.1l-2.94-.63a.56.56 0 0 0-.66.43l-.86 4.34c-1.73.09-3.29.62-4.45 1.45a1.75 1.75 0 1 0-1.47 3.13c-.03.2-.05.4-.05.61 0 2.83 3.7 5.13 8.26 5.13s8.26-2.3 8.26-5.13c0-.22-.02-.43-.05-.64.59-.27.98-.87.98-1.55ZM9.15 14.4c.56 0 1.01.45 1.01 1.01s-.45 1.01-1.01 1.01-1.01-.45-1.01-1.01.45-1.01 1.01-1.01Zm5.9 3.07c-.9.85-2.8.91-3.05.91s-2.15-.06-3.05-.91a.48.48 0 0 1 .66-.7c.54.5 1.86.65 2.39.65s1.84-.14 2.39-.65a.48.48 0 0 1 .66.7Zm-.2-1.05c-.56 0-1.01-.45-1.01-1.01s.45-1.01 1.01-1.01 1.01.45 1.01 1.01-.45 1.01-1.01 1.01Z"/></svg></span><span>Reddit</span></a>
          <a class="social-link" data-network="instagram" href="#"><span class="social-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7.2 3h9.6A4.2 4.2 0 0 1 21 7.2v9.6a4.2 4.2 0 0 1-4.2 4.2H7.2A4.2 4.2 0 0 1 3 16.8V7.2A4.2 4.2 0 0 1 7.2 3Zm0 2A2.2 2.2 0 0 0 5 7.2v9.6A2.2 2.2 0 0 0 7.2 19h9.6a2.2 2.2 0 0 0 2.2-2.2V7.2A2.2 2.2 0 0 0 16.8 5H7.2Zm9.95 1.35a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7.4A4.6 4.6 0 1 1 12 16.6 4.6 4.6 0 0 1 12 7.4Zm0 2A2.6 2.6 0 1 0 12 14.6 2.6 2.6 0 0 0 12 9.4Z"/></svg></span><span>Instagram</span></a>
          <a class="social-link" data-network="tiktok" href="#"><span class="social-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14.2 3h2.55c.2 1.53 1.07 2.84 2.5 3.54.56.28 1.14.43 1.75.46v2.58a8.04 8.04 0 0 1-4.23-1.24v6.23a5.43 5.43 0 1 1-4.69-5.38v2.68a2.83 2.83 0 1 0 2.12 2.7V3Z"/></svg></span><span>TikTok</span></a>
        </nav>
        <div class="share-context-links">
          <a href="./" data-share-page-link>Página do app <span aria-hidden="true">↗</span></a>
          ${mostRecentMention ? `<a href="${escapeHTML(mostRecentMention.url)}" target="_blank" rel="noopener noreferrer">Episódio ${escapeHTML(mostRecentMention.episode)} <span aria-hidden="true">↗</span></a>` : ""}
        </div>
        <p class="share-status" aria-live="polite"></p>
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
