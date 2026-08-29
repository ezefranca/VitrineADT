import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_ICON_BYTES = 1_000_000;
const IMAGE_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"]
]);

function isPrivateIPv4(address) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isPrivateIP(address) {
  if (address.startsWith("::ffff:")) return isPrivateIPv4(address.slice(7));
  if (isIP(address) === 4) return isPrivateIPv4(address);
  const normalized = address.toLowerCase();
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}

async function assertPublicHTTPSURL(value) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("O ícone precisa usar HTTPS.");
  if (isIP(url.hostname)) throw new Error("URLs de imagem com IP literal não são aceitas.");
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIP(address))) {
    throw new Error("O host da imagem resolve para uma rede privada ou reservada.");
  }
  return url;
}

async function safeFetch(urlValue, { accept, maxRedirects = 3 } = {}) {
  let current = String(urlValue);
  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    await assertPublicHTTPSURL(current);
    const response = await fetch(current, {
      redirect: "manual",
      headers: { Accept: accept ?? "*/*", "User-Agent": "VitrineADTGallery/0.1" },
      signal: AbortSignal.timeout(15_000)
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirecionamento sem destino.");
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} ao obter ${current}`);
    return { response, finalURL: current };
  }
  throw new Error("A URL excedeu o limite de redirecionamentos.");
}

async function readBoundedBytes(response, maximum) {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maximum) throw new Error(`O arquivo excede ${maximum} bytes.`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("A resposta não possui conteúdo.");
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximum) {
      await reader.cancel();
      throw new Error(`O arquivo excede ${maximum} bytes.`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function readBoundedText(response, maximum) {
  return new TextDecoder().decode(await readBoundedBytes(response, maximum));
}

function appStoreID(value = "") {
  return String(value).match(/\/id(\d+)(?:[/?#]|$)/i)?.[1] ?? null;
}

async function iconFromAppStore(appStoreURL) {
  const id = appStoreID(appStoreURL);
  if (!id) return null;
  const { response } = await safeFetch(`https://itunes.apple.com/lookup?id=${id}&country=br`, { accept: "application/json" });
  const payload = JSON.parse(await readBoundedText(response, 500_000));
  return payload.results?.[0]?.artworkUrl512 ?? payload.results?.[0]?.artworkUrl100 ?? null;
}

function metaContent(html, property) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const propertyMatch = tag.match(/(?:property|name)=["']([^"']+)["']/i);
    const contentMatch = tag.match(/content=["']([^"']+)["']/i);
    if (propertyMatch?.[1].toLowerCase() === property && contentMatch?.[1]) return contentMatch[1].replace(/&amp;/g, "&");
  }
  return null;
}

function attributeValue(tag, name) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"))?.[1]
    ?.replace(/&amp;/gi, "&") ?? null;
}

function linkImage(html) {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attributeValue(tag, "rel")?.toLowerCase() ?? "";
    if (!rel.includes("apple-touch-icon")) continue;
    const href = attributeValue(tag, "href");
    if (href) return href;
  }
  return null;
}

function likelyIconImage(html) {
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const source = attributeValue(tag, "src");
    if (source && /(?:app.?icon|icon|logo)/i.test(source)) return source;
  }
  return null;
}

async function iconFromWebsite(websiteURL) {
  if (!websiteURL) return null;
  const { response, finalURL } = await safeFetch(websiteURL, { accept: "text/html" });
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/html")) return null;
  const html = await readBoundedText(response, 2_000_000);
  const candidate = metaContent(html, "og:image")
    ?? metaContent(html, "twitter:image")
    ?? linkImage(html)
    ?? likelyIconImage(html);
  if (!candidate) return null;
  const resolved = new URL(candidate, finalURL);
  if (resolved.hostname.endsWith("mzstatic.com")) {
    resolved.pathname = resolved.pathname.replace(/\/[^/]+$/, "/512x512bb-80.png");
  }
  return resolved.toString();
}

async function iconFromGooglePlay(googlePlayURL) {
  if (!googlePlayURL) return null;
  const { response } = await safeFetch(googlePlayURL, { accept: "text/html" });
  const html = await readBoundedText(response, 2_000_000);
  return metaContent(html, "og:image");
}

export async function resolveIconURL(submission) {
  if (submission.iconURL) return submission.iconURL;
  if (submission.links.appStore) {
    const appStoreIcon = await iconFromAppStore(submission.links.appStore);
    if (appStoreIcon) return appStoreIcon;
  }
  if (submission.links.googlePlay) {
    const playIcon = await iconFromGooglePlay(submission.links.googlePlay);
    if (playIcon) return playIcon;
  }
  return iconFromWebsite(submission.links.website);
}

export async function downloadIcon(url) {
  const { response, finalURL } = await safeFetch(url, { accept: "image/png,image/jpeg,image/webp" });
  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  const extension = IMAGE_TYPES.get(contentType);
  if (!extension) throw new Error(`Formato de ícone não permitido: ${contentType || "desconhecido"}.`);
  const bytes = await readBoundedBytes(response, MAX_ICON_BYTES);
  return { bytes, extension, contentType, finalURL };
}
