const FIELD_LABELS = {
  name: "Nome do aplicativo",
  developerName: "Desenvolvedor ou equipe",
  developerURL: "Site do desenvolvedor",
  description: "Descrição curta",
  platforms: "Plataformas",
  websiteURL: "Link principal do aplicativo",
  appStoreURL: "Link da App Store",
  googlePlayURL: "Link do Google Play",
  sourceURL: "Código-fonte",
  episode: "Número do episódio do Área de Transferência",
  mentionHint: "Ajuda para encontrar a menção",
  iconURL: "Link direto para o ícone",
  declarations: "Declarações"
};

const PLATFORM_MAP = new Map([
  ["web", "web"],
  ["ios", "ios"],
  ["ipados", "ipados"],
  ["macos", "macos"],
  ["android", "android"],
  ["windows", "windows"],
  ["linux", "linux"],
  ["watchos", "watchos"],
  ["tvos", "tvos"],
  ["outra", "other"]
]);

export function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&amp;/g, " e ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function compactText(value = "") {
  return normalizeText(value).replace(/\s+/g, "");
}

function cleanField(value = "") {
  const trimmed = String(value).trim();
  return trimmed === "_No response_" ? "" : trimmed;
}

export function parseIssueForm(body) {
  if (typeof body !== "string" || body.length > 50_000) {
    throw new Error("O corpo da Issue é inválido ou excede 50 KB.");
  }

  const sections = new Map();
  const headingPattern = /^###\s+(.+)$/gm;
  const matches = [...body.matchAll(headingPattern)];

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const valueStart = current.index + current[0].length;
    const valueEnd = next ? next.index : body.length;
    sections.set(current[1].trim(), cleanField(body.slice(valueStart, valueEnd)));
  }

  const value = (key) => sections.get(FIELD_LABELS[key]) ?? "";
  const platformLines = value("platforms").split("\n");
  const platforms = platformLines
    .filter((line) => /^- \[[xX]\]\s+/.test(line.trim()))
    .map((line) => line.replace(/^- \[[xX]\]\s+/, "").trim())
    .map((label) => PLATFORM_MAP.get(normalizeText(label)))
    .filter(Boolean);

  const declarationCount = value("declarations")
    .split("\n")
    .filter((line) => /^- \[[xX]\]\s+/.test(line.trim())).length;

  return {
    name: value("name"),
    developer: {
      name: value("developerName"),
      url: value("developerURL")
    },
    description: value("description"),
    platforms: [...new Set(platforms)],
    links: {
      website: value("websiteURL"),
      appStore: value("appStoreURL"),
      googlePlay: value("googlePlayURL"),
      source: value("sourceURL")
    },
    episode: Number.parseInt(value("episode"), 10),
    episodeRaw: value("episode"),
    mentionHint: value("mentionHint"),
    iconURL: value("iconURL"),
    declarationCount
  };
}

export function parseAppStoreID(value = "") {
  return String(value).match(/\/id(\d+)(?:[/?#]|$)/i)?.[1] ?? null;
}

export function parseGooglePlayID(value = "") {
  try {
    const url = new URL(value);
    return url.hostname.endsWith("play.google.com") ? url.searchParams.get("id") : null;
  } catch {
    return null;
  }
}

export function canonicalURL(value = "") {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.hostname}${url.pathname}`;
  } catch {
    return null;
  }
}

export function isLikelySameApp(left = {}, right = {}) {
  const leftLinks = normalizeLinks(left);
  const rightLinks = normalizeLinks(right);
  const leftAppStore = parseAppStoreID(left.links?.appStore);
  const rightAppStore = parseAppStoreID(right.links?.appStore);
  if (leftAppStore && rightAppStore && leftAppStore === rightAppStore) return true;

  const leftGooglePlay = parseGooglePlayID(left.links?.googlePlay);
  const rightGooglePlay = parseGooglePlayID(right.links?.googlePlay);
  if (leftGooglePlay && rightGooglePlay && leftGooglePlay === rightGooglePlay) return true;

  if (leftLinks.website && rightLinks.website && leftLinks.website === rightLinks.website) return true;
  if (leftLinks.source && rightLinks.source && leftLinks.source === rightLinks.source) return true;
  if (leftLinks.appStore && rightLinks.appStore && leftLinks.appStore === rightLinks.appStore) return true;
  if (leftLinks.googlePlay && rightLinks.googlePlay && leftLinks.googlePlay === rightLinks.googlePlay) return true;

  const leftName = compactText(left.name);
  const rightName = compactText(right.name);
  if (!leftName || leftName !== rightName) return false;
  const leftDeveloper = compactText(left.developer?.name);
  const rightDeveloper = compactText(right.developer?.name);
  return Boolean(leftDeveloper && rightDeveloper && leftDeveloper === rightDeveloper);
}

export function normalizeLinks(record = {}) {
  return {
    website: canonicalURL(record.links?.website),
    source: canonicalURL(record.links?.source),
    appStore: canonicalURL(record.links?.appStore),
    googlePlay: canonicalURL(record.links?.googlePlay)
  };
}

export function slugify(value) {
  return normalizeText(value).replace(/\s+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "app";
}

function decodeHTMLEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function htmlToText(html = "") {
  return decodeHTMLEntities(String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
}

export function extractLinks(html = "") {
  const links = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of String(html).matchAll(pattern)) {
    links.push({ url: decodeHTMLEntities(match[1]), title: htmlToText(match[2]) });
  }
  return links;
}

export function extractFriendsSegment(transcript = "") {
  const text = String(transcript);
  const startPatterns = [
    /\bamigos?\s+d[oa]\s+(?:a\s+)?(?:adt|odt|dt|att)\b/i,
    /\bamigos?\s+d[oa]\s+[ao]?[dt]{2,}\b/i
  ];
  const starts = startPatterns.map((pattern) => text.search(pattern)).filter((index) => index >= 0);
  if (starts.length === 0) return "";

  const start = Math.min(...starts);
  const remainder = text.slice(start);
  const endPatterns = [
    /\b(?:entrando|indo|vamos|partindo|chegando)\s+(?:agora\s+)?(?:n[oa]s?\s+)?follow[\s-]?ups?\b/i,
    /\b(?:agora|a seguir),?\s+(?:vamos\s+)?(?:aos?|para\s+os?)\s+follow[\s-]?ups?\b/i,
    /\b(?:bloco|hora)\s+d[eo]s?\s+follow[\s-]?ups?\b/i,
    /\be\s+agora\s+(?:o|os)\s+follow[\s-]?ups?\b/i,
    /\be\s+(?:começando|seguindo)\s+(?:aqui\s+)?com\s+os\s+follow[\s-]?ups?\b/i,
    /\bmas\s+falando\s+de\s+follow[\s-]?up\s+agora\b/i
  ];
  const minimumSegmentLength = Math.min(1_000, Math.floor(remainder.length / 4));
  const ends = endPatterns.map((pattern) => remainder.search(pattern)).filter((index) => index > minimumSegmentLength);
  const end = ends.length > 0 ? Math.min(...ends) : Math.min(remainder.length, 20_000);
  return remainder.slice(0, end);
}

function isHTTPSURL(value, expectedHostSuffix) {
  if (!value) return true;
  if (value.length > 2_048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return !expectedHostSuffix || url.hostname === expectedHostSuffix || url.hostname.endsWith(`.${expectedHostSuffix}`);
  } catch {
    return false;
  }
}

async function fetchBounded(url, { fetchImpl, maxBytes, accept }) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: accept,
      "User-Agent": "VitrineADTGallery/0.1 (+https://github.com/)"
    },
    signal: AbortSignal.timeout(12_000)
  });

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} ao consultar ${url}`);
    error.status = response.status;
    throw error;
  }

  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) throw new Error(`Resposta maior que ${maxBytes} bytes.`);
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new Error(`Resposta maior que ${maxBytes} bytes.`);
  return text;
}

function validateFields(submission) {
  const errors = [];
  const warnings = [];

  if (!submission.name || submission.name.length > 100) errors.push("Informe um nome de aplicativo com até 100 caracteres.");
  if (!submission.developer.name || submission.developer.name.length > 120) errors.push("Informe o desenvolvedor ou equipe com até 120 caracteres.");
  if (!submission.description || submission.description.length > 400) errors.push("Informe uma descrição com até 400 caracteres.");
  if (submission.platforms.length === 0) errors.push("Selecione pelo menos uma plataforma.");
  if (!Number.isInteger(submission.episode) || submission.episode < 1 || submission.episode > 10_000) errors.push("Informe um número de episódio válido.");
  if (!submission.links.website) errors.push("Informe o link principal do aplicativo.");

  const urlChecks = [
    [submission.links.website, "link principal"],
    [submission.developer.url, "site do desenvolvedor"],
    [submission.links.source, "código-fonte"],
    [submission.iconURL, "ícone"]
  ];
  for (const [url, label] of urlChecks) {
    if (url && !isHTTPSURL(url)) errors.push(`O ${label} precisa ser uma URL HTTPS válida.`);
  }
  if (submission.links.appStore && !isHTTPSURL(submission.links.appStore, "apps.apple.com")) {
    errors.push("O link da App Store precisa apontar para apps.apple.com.");
  }
  if (submission.links.googlePlay && !isHTTPSURL(submission.links.googlePlay, "play.google.com")) {
    errors.push("O link do Google Play precisa apontar para play.google.com.");
  }
  if (!submission.iconURL && !submission.links.appStore && !submission.links.googlePlay) {
    errors.push("Informe um ícone quando não houver link da App Store ou do Google Play.");
  }
  if (submission.declarationCount < 4) errors.push("Todas as declarações obrigatórias precisam estar marcadas.");
  if (submission.description.length > 200) warnings.push("A descrição tem mais de 200 caracteres e poderá ser reduzida na moderação.");

  return { errors, warnings };
}

function findSnippet(text, needles, radius = 150) {
  const lower = text.toLowerCase();
  const needle = needles.find((candidate) => candidate && lower.includes(candidate.toLowerCase()));
  if (!needle) return null;
  const index = lower.indexOf(needle.toLowerCase());
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + needle.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
}

function linkEvidence(submission, noteLinks) {
  const candidates = [submission.links.website, submission.links.appStore, submission.links.googlePlay].filter(Boolean);
  const candidateCanonicals = candidates.map(canonicalURL).filter(Boolean);
  const appStoreID = parseAppStoreID(submission.links.appStore);
  const googlePlayID = parseGooglePlayID(submission.links.googlePlay);

  return noteLinks.find((link) => {
    const canonical = canonicalURL(link.url);
    if (canonical && candidateCanonicals.includes(canonical)) return true;
    if (appStoreID && parseAppStoreID(link.url) === appStoreID) return true;
    if (googlePlayID && parseGooglePlayID(link.url) === googlePlayID) return true;
    return false;
  }) ?? null;
}

export async function validateSubmission({ body, fetchImpl = fetch }) {
  let submission;
  try {
    submission = parseIssueForm(body);
  } catch (error) {
    return { status: "failed", submission: null, errors: [error.message], warnings: [], evidence: [] };
  }

  const { errors, warnings } = validateFields(submission);
  if (errors.length > 0) return { status: "failed", submission, errors, warnings, evidence: [] };

  const apiURL = `https://gigahertz.fm/api/podcasts/adt/${submission.episode}.json`;
  let episode;
  try {
    const rawEpisode = await fetchBounded(apiURL, {
      fetchImpl,
      maxBytes: 1_000_000,
      accept: "application/json"
    });
    episode = JSON.parse(rawEpisode);
  } catch (error) {
    return {
      status: error.status === 404 ? "failed" : "source-unavailable",
      submission,
      errors: [error.status === 404 ? "O episódio informado não foi encontrado." : "A fonte do episódio está temporariamente indisponível."],
      warnings,
      evidence: []
    };
  }

  if (Number(episode.episodeNumber) !== submission.episode || !String(episode.permalink ?? "").startsWith("https://gigahertz.fm/podcasts/adt/")) {
    return { status: "failed", submission, episode, errors: ["A resposta da API não corresponde ao episódio informado."], warnings, evidence: [] };
  }

  const notesHTML = String(episode.body ?? "");
  const notesText = htmlToText(notesHTML);
  const noteLinks = extractLinks(notesHTML);
  const matchingLink = linkEvidence(submission, noteLinks);
  let transcript = "";
  let transcriptUnavailable = false;

  try {
    transcript = await fetchBounded(`${episode.permalink}.txt`, {
      fetchImpl,
      maxBytes: 2_000_000,
      accept: "text/plain"
    });
  } catch {
    transcriptUnavailable = true;
    warnings.push("A transcrição não pôde ser consultada; a moderação deve verificar a menção manualmente.");
  }

  const compactName = compactText(submission.name);
  const compactDeveloper = compactText(submission.developer.name);
  const compactNotes = compactText(notesText);
  const friendsSegment = extractFriendsSegment(transcript);
  const compactSegment = compactText(friendsSegment);
  const nameInNotes = compactName.length >= 3 && compactNotes.includes(compactName);
  const nameInSegment = compactName.length >= 3 && compactSegment.includes(compactName);
  const developerInSegment = compactDeveloper.length >= 4 && compactSegment.includes(compactDeveloper);
  const evidence = [];

  if (matchingLink) evidence.push({ type: "notes-link", message: `Link encontrado nas notas como “${matchingLink.title || matchingLink.url}”.` });
  if (nameInNotes) evidence.push({ type: "notes-name", message: "Nome do aplicativo encontrado nas notas do episódio." });
  if (nameInSegment) {
    evidence.push({
      type: "friends-segment-name",
      message: "Nome do aplicativo encontrado no segmento Amigos do Área de Transferência.",
      snippet: findSnippet(friendsSegment, [submission.name, submission.developer.name])
    });
  }
  if (developerInSegment) evidence.push({ type: "friends-segment-developer", message: "Nome do desenvolvedor encontrado no segmento Amigos do Área de Transferência." });
  if (transcript && !friendsSegment) warnings.push("O segmento Amigos do Área de Transferência não foi identificado automaticamente na transcrição.");

  const strongMatch = Boolean(friendsSegment) && (
    Boolean(matchingLink && (nameInSegment || developerInSegment)) ||
    Boolean(nameInSegment && developerInSegment)
  );
  return {
    status: strongMatch ? "passed" : "needs-review",
    submission,
    episode: {
      episodeNumber: Number(episode.episodeNumber),
      title: String(episode.title),
      date: String(episode.date),
      permalink: String(episode.permalink),
      updatedAt: String(episode.updatedAt ?? "")
    },
    errors: [],
    warnings: transcriptUnavailable || evidence.length === 0
      ? [...warnings, "A evidência automática não é conclusiva; isso não significa que a submissão seja inválida."]
      : warnings,
    evidence
  };
}

export function formatValidationReport(result) {
  const labels = {
    passed: "Evidência encontrada — pronto para moderação humana",
    "needs-review": "Revisão humana necessária",
    failed: "Submissão inválida",
    "source-unavailable": "Fonte temporariamente indisponível"
  };
  const lines = ["<!-- vitrineadt-validation-report -->", "## Validação automática", ""];

  if (result.episode) {
    lines.push(`✓ Episódio [${result.episode.title}](${result.episode.permalink}) encontrado.`);
  }
  for (const item of result.evidence ?? []) {
    lines.push(`✓ ${item.message}`);
    if (item.snippet) lines.push(`> ${item.snippet.replace(/\n/g, " ")}`);
  }
  for (const warning of result.warnings ?? []) lines.push(`⚠ ${warning}`);
  for (const error of result.errors ?? []) lines.push(`✗ ${error}`);

  lines.push("", `**Resultado: ${labels[result.status]}.**`, "", "Uma correspondência automática nunca substitui a decisão editorial de um moderador.");
  return lines.join("\n");
}

export const validationLabelFor = (status) => `validation/${status}`;
