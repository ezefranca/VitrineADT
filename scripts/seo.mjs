export const SITE_ORIGIN = "https://vitrineadt.ezequiel.app";

const STATIC_PAGES = [
  ["/", "index.html"],
  ["/sobre.html", "sobre.html"],
  ["/como-funciona.html", "como-funciona.html"],
  ["/termos.html", "termos.html"],
  ["/privacidade.html", "privacidade.html"],
  ["/codigo-de-conduta.html", "codigo-de-conduta.html"]
];

export function absoluteURL(pathname = "/") {
  const path = String(pathname).startsWith("/") ? String(pathname) : `/${pathname}`;
  return `${SITE_ORIGIN}${path}`;
}

export function jsonLdScript(data) {
  const json = JSON.stringify(data).replaceAll("<", "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

export function homeStructuredData(apps) {
  const url = absoluteURL("/");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_ORIGIN}/#website`,
        name: "VitrineADT",
        url,
        description: "Uma galeria independente dos aplicativos apresentados no segmento Amigos do Área de Transferência.",
        inLanguage: "pt-BR",
        about: {
          "@type": "PodcastSeries",
          name: "Área de Transferência",
          url: "https://gigahertz.fm/podcasts/adt/"
        }
      },
      {
        "@type": "CollectionPage",
        "@id": `${url}#webpage`,
        name: "Apps do Área de Transferência",
        url,
        isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
        mainEntity: {
          "@type": "ItemList",
          name: "Aplicativos apresentados no Área de Transferência",
          numberOfItems: apps.length,
          itemListElement: apps.map((app, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: {
              "@type": "SoftwareApplication",
              name: app.name,
              url: absoluteURL(`/${app.detailPath}`),
              description: app.description
            }
          }))
        }
      }
    ]
  };
}

function escapeAttribute(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function metadataValue(html, pattern) {
  return html.match(pattern)?.[1] ?? "";
}

function staticWebPage({ pathname, title, description, structuredData }) {
  const url = absoluteURL(pathname);
  const pageData = structuredData ?? {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: title,
    description,
    inLanguage: "pt-BR",
    isPartOf: { "@id": `${SITE_ORIGIN}/#website` }
  };
  return { url, title, description, pageData };
}

export function enhanceStaticPage(html, { pathname, structuredData } = {}) {
  const title = metadataValue(html, /<title>([^<]*)<\/title>/i);
  const description = metadataValue(html, /<meta name="description" content="([^"]*)"/i);
  const page = staticWebPage({ pathname, title, description, structuredData });
  const additions = [
    html.includes('rel="canonical"') ? "" : `<link rel="canonical" href="${escapeAttribute(page.url)}">`,
    html.includes('property="og:url"') ? "" : `<meta property="og:url" content="${escapeAttribute(page.url)}">`,
    html.includes('property="og:site_name"') ? "" : `<meta property="og:site_name" content="VitrineADT">`,
    html.includes('property="og:locale"') ? "" : `<meta property="og:locale" content="pt_BR">`,
    html.includes('property="og:type"') ? "" : `<meta property="og:type" content="website">`,
    html.includes('property="og:title"') ? "" : `<meta property="og:title" content="${escapeAttribute(page.title)}">`,
    html.includes('property="og:description"') ? "" : `<meta property="og:description" content="${escapeAttribute(page.description)}">`,
    html.includes('name="twitter:card"') ? "" : `<meta name="twitter:card" content="summary">`,
    html.includes('name="twitter:title"') ? "" : `<meta name="twitter:title" content="${escapeAttribute(page.title)}">`,
    html.includes('name="twitter:description"') ? "" : `<meta name="twitter:description" content="${escapeAttribute(page.description)}">`,
    html.includes('application/ld+json') ? "" : jsonLdScript(page.pageData)
  ].filter(Boolean).join("\n    ");
  return html.replace("</head>", `    ${additions}\n  </head>`);
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizedLastModified(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function buildSitemap({ apps, episodes, authors }) {
  const entries = new Map(STATIC_PAGES.map(([pathname]) => [pathname, ""]));
  for (const app of apps) entries.set(`/${app.detailPath}`, normalizedLastModified(app.updatedAt));
  for (const episode of episodes) entries.set(`/episodes/${episode.episode}/`, normalizedLastModified(episode.date));
  for (const author of authors) entries.set(`/${author.path}`, "");

  const urls = [...entries].map(([pathname, lastmod]) => `  <url>\n    <loc>${xmlEscape(absoluteURL(pathname))}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}\n  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function robotsFile() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${absoluteURL("/sitemap.xml")}\n`;
}

export function staticPages() {
  return STATIC_PAGES;
}
