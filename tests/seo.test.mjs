import test from "node:test";
import assert from "node:assert/strict";
import { buildSitemap, enhanceStaticPage, homeStructuredData, robotsFile } from "../scripts/seo.mjs";

test("adiciona canonical, metadata social e dados estruturados às páginas estáticas", () => {
  const html = enhanceStaticPage(`<!doctype html><html><head><meta name="description" content="Descrição"><title>Sobre — VitrineADT</title></head></html>`, {
    pathname: "/sobre.html"
  });

  assert.match(html, /<link rel="canonical" href="https:\/\/vitrineadt\.ezequiel\.app\/sobre\.html">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/vitrineadt\.ezequiel\.app\/sobre\.html">/);
  assert.match(html, /<meta name="twitter:title" content="Sobre — VitrineADT">/);
  assert.match(html, /<script type="application\/ld\+json">/);
  assert.doesNotMatch(html, /canonical.*canonical/);
});

test("gera sitemap com apps, episódios e autores", () => {
  const sitemap = buildSitemap({
    apps: [{ detailPath: "app/exemplo/", updatedAt: "2026-08-29T12:00:00Z" }],
    episodes: [{ episode: 493, date: "2026-08-28" }],
    authors: [{ path: "author/exemplo/" }]
  });

  assert.match(sitemap, /https:\/\/vitrineadt\.ezequiel\.app\/app\/exemplo\//);
  assert.match(sitemap, /https:\/\/vitrineadt\.ezequiel\.app\/episodes\/493\//);
  assert.match(sitemap, /https:\/\/vitrineadt\.ezequiel\.app\/author\/exemplo\//);
  assert.match(sitemap, /<lastmod>2026-08-29<\/lastmod>/);
});

test("descreve a home e o sitemap para os rastreadores", () => {
  const structuredData = homeStructuredData([{ name: "Exemplo", detailPath: "app/exemplo/", description: "Um app" }]);
  assert.equal(structuredData["@graph"][0]["@type"], "WebSite");
  assert.equal(structuredData["@graph"][1].mainEntity.numberOfItems, 1);
  assert.match(robotsFile(), /Sitemap: https:\/\/vitrineadt\.ezequiel\.app\/sitemap\.xml/);
});
