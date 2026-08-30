function episodeNumber(mention) {
  const episode = Number(mention?.episode);
  return Number.isFinite(episode) ? episode : -1;
}

export function compareMentions(a, b) {
  const episodeDifference = episodeNumber(b) - episodeNumber(a);
  if (episodeDifference !== 0) return episodeDifference;
  return String(b?.date ?? "").localeCompare(String(a?.date ?? ""));
}

export function latestMention(app) {
  return [...(app?.mentions ?? [])].sort(compareMentions)[0] ?? null;
}

export function compareAppsByLatestMention(a, b) {
  const aMention = latestMention(a);
  const bMention = latestMention(b);
  if (!aMention && !bMention) return 0;
  if (!aMention) return 1;
  if (!bMention) return -1;
  return compareMentions(aMention, bMention);
}
