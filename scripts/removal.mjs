export function parseRemovalTarget(body = "") {
  const text = String(body);
  const heading = /^###\s+Issue da entrada\s*$/gmi;
  const match = heading.exec(text);
  if (!match) return null;
  const rest = text.slice(match.index + match[0].length);
  const value = rest.split(/^###\s+/m)[0].trim();
  const urlNumber = value.match(/\/issues\/(\d+)(?:[/?#]|$)/i)?.[1];
  const plainNumber = value.match(/^#?(\d+)$/)?.[1];
  const number = Number.parseInt(urlNumber ?? plainNumber ?? "", 10);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function isOriginalSubmitter(record, requester) {
  const original = String(record?.submission?.submittedBy ?? "").trim().toLowerCase();
  const candidate = String(requester ?? "").trim().toLowerCase();
  if (!original || !candidate) return false;
  if (["unknown", "demo", "github-actions[bot]", "bootstrap-curation"].includes(original)) return false;
  return original === candidate;
}
