const PLATFORM_LABELS = {
  web: "Web",
  ios: "iOS",
  ipados: "iPadOS",
  macos: "macOS",
  android: "Android",
  windows: "Windows",
  linux: "Linux",
  watchos: "watchOS",
  tvos: "tvOS",
  other: "Outra"
};

const state = {
  apps: [],
  search: "",
  platform: "all",
  repositoryURL: null,
  directoryPage: 1,
  directoryPageSize: 12
};
const template = document.querySelector("#app-card-template");
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

function latestMention(app) {
  return [...(app.mentions ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function primaryLink(app) {
  return app.links?.website || app.links?.appStore || app.links?.googlePlay || app.links?.source || "#";
}

function issueURLForApp(app, repositoryURL) {
  return app.submission?.issueURL ?? (repositoryURL && app.submission?.issue ? `${repositoryURL}/issues/${app.submission.issue}` : null);
}

function createCard(app) {
  const card = template.content.firstElementChild.cloneNode(true);
  const icon = card.querySelector(".app-icon");
  icon.style.setProperty("--icon-hue", String(hashSeed(app.id) % 360));
  if (app.icon?.path) {
    const image = document.createElement("img");
    image.src = app.icon.path.startsWith("/") ? `.${app.icon.path}` : app.icon.path;
    image.alt = "";
    image.width = 76;
    image.height = 76;
    image.loading = "lazy";
    image.addEventListener("error", () => { icon.replaceChildren(document.createTextNode(initials(app.name))); });
    icon.append(image);
  } else {
    icon.textContent = initials(app.name);
  }

  const badges = card.querySelector(".platform-badges");
  for (const platform of (app.platforms ?? []).slice(0, 3)) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = PLATFORM_LABELS[platform] ?? platform;
    badges.append(badge);
  }

  const title = card.querySelector("h3");
  if (app.detailPath) {
    const detailLink = document.createElement("a");
    detailLink.href = `./${app.detailPath}`;
    detailLink.textContent = app.name;
    title.append(detailLink);
  } else {
    title.textContent = app.name;
  }

  const developer = card.querySelector(".developer");
  developer.append(document.createTextNode("por "));
  if (app.author?.path) {
    const authorLink = document.createElement("a");
    authorLink.href = `./${app.author.path}`;
    authorLink.textContent = app.developer?.name ?? app.author.username;
    authorLink.title = `Ver aplicativos associados a @${app.author.username}`;
    developer.append(authorLink);
  } else {
    developer.append(document.createTextNode(app.developer?.name ?? "Desenvolvedor independente"));
  }
  card.querySelector(".description").textContent = app.description;

  const mention = latestMention(app);
  const episodeContainer = card.querySelector(".episode-reference");
  if (mention) {
    episodeContainer.append(document.createTextNode("Amigos do ADT · "));
    const episodeLink = document.createElement("a");
    episodeLink.href = mention.url;
    episodeLink.target = "_blank";
    episodeLink.rel = "noopener noreferrer";
    episodeLink.textContent = `episódio ${mention.episode}`;
    episodeContainer.append(episodeLink, document.createTextNode(` · ${dateFormatter.format(new Date(`${mention.date}T00:00:00Z`))}`));
  }

  const appLink = card.querySelector(".app-link");
  if (app.detailPath) {
    appLink.href = `./${app.detailPath}`;
    appLink.textContent = "Ver página do app";
    appLink.removeAttribute("target");
    appLink.removeAttribute("rel");
    appLink.setAttribute("aria-label", `Abrir a página de ${app.name}`);
  } else {
    appLink.href = primaryLink(app);
    appLink.setAttribute("aria-label", `Conhecer ${app.name}`);
  }

  const likeLink = card.querySelector(".like-link");
  const issueURL = issueURLForApp(app, state.repositoryURL);
  likeLink.href = issueURL ?? "#";
  likeLink.setAttribute("target", "_blank");
  likeLink.setAttribute("rel", "noopener noreferrer");
  likeLink.setAttribute("aria-label", `Curtir ${app.name} no GitHub. ${app.likes ?? 0} curtidas.`);
  likeLink.querySelector(".like-count").textContent = String(app.likes ?? 0);
  likeLink.hidden = !issueURL;

  const reportLink = card.querySelector(".report-link");
  if (state.repositoryURL) {
    reportLink.href = `${state.repositoryURL}/issues/new?template=report.yml&title=${encodeURIComponent(`[Denúncia]: ${app.name}`)}`;
    reportLink.setAttribute("aria-label", `Reportar um problema em ${app.name}`);
    reportLink.hidden = false;
  }
  return card;
}

function renderInto(element, apps) {
  element.replaceChildren(...apps.map(createCard));
}

function hashSeed(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomShuffle(apps) {
  const random = Math.random;
  const shuffled = [...apps];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function clampPage(page, totalPages) {
  if (totalPages <= 1) return 1;
  if (page < 1) return 1;
  if (page > totalPages) return totalPages;
  return page;
}

function getFilteredApps() {
  const needle = state.search.trim().toLocaleLowerCase("pt-BR");
  return state.apps.filter((app) => {
    const platformMatches = state.platform === "all" || app.platforms?.includes(state.platform);
    const text = `${app.name} ${app.developer?.name ?? ""} ${app.description}`.toLocaleLowerCase("pt-BR");
    return platformMatches && (!needle || text.includes(needle));
  });
}

function renderDirectory() {
  const filtered = getFilteredApps();
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.directoryPageSize));
  state.directoryPage = clampPage(state.directoryPage, totalPages);
  const start = (state.directoryPage - 1) * state.directoryPageSize;
  const pageApps = filtered.slice(start, start + state.directoryPageSize);
  renderInto(document.querySelector("#all-list"), pageApps);
  const pagination = document.querySelector("#directory-pagination");
  const prevButton = document.querySelector("#prev-page");
  const nextButton = document.querySelector("#next-page");
  const indicator = document.querySelector("#page-indicator");
  pagination.hidden = totalPages <= 1;
  prevButton.disabled = state.directoryPage <= 1 || totalPages <= 1;
  nextButton.disabled = state.directoryPage >= totalPages || totalPages <= 1;
  indicator.textContent = `Página ${state.directoryPage} de ${totalPages}`;
  document.querySelector("#result-count").textContent = `${filtered.length} ${filtered.length === 1 ? "aplicativo" : "aplicativos"}`;
  document.querySelector("#empty-state").hidden = filtered.length !== 0;
}

function renderFilters() {
  const container = document.querySelector("#platform-filters");
  const available = [...new Set(state.apps.flatMap((app) => app.platforms ?? []))];
  const options = [["all", "Todas"], ...available.map((platform) => [platform, PLATFORM_LABELS[platform] ?? platform])];
  container.replaceChildren(...options.map(([value, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-button";
    button.textContent = label;
    button.setAttribute("aria-pressed", String(state.platform === value));
    button.addEventListener("click", () => {
      state.platform = value;
      state.directoryPage = 1;
      renderFilters();
      renderDirectory();
    });
    return button;
  }));
}

function configureSubmissionLinks(repositoryURL) {
  if (repositoryURL) {
    for (const link of document.querySelectorAll(".submit-link")) {
      link.href = `${repositoryURL}/issues/new?template=app.yml`;
      link.hidden = false;
    }
    for (const link of document.querySelectorAll(".github-link")) {
      link.href = repositoryURL;
    }
    for (const link of document.querySelectorAll(".report-link")) {
      link.href = `${repositoryURL}/issues/new?template=report.yml`;
      link.hidden = false;
    }
    for (const link of document.querySelectorAll(".removal-link")) {
      link.href = `${repositoryURL}/issues/new?template=removal.yml`;
      link.hidden = false;
    }
  }
}

async function start() {
  const response = await fetch("./data/apps.json", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Não foi possível carregar o catálogo: HTTP ${response.status}`);
  const catalog = await response.json();
  state.apps = catalog.apps ?? [];
  state.repositoryURL = catalog.repositoryURL;
  configureSubmissionLinks(catalog.repositoryURL);
  document.querySelector("#app-count").textContent = String(state.apps.length);
  document.querySelector("#episode-count").textContent = String(new Set(state.apps.flatMap((app) => app.mentions?.map((mention) => mention.episode) ?? [])).size);
  const previewNotice = document.querySelector("#demo-notice");
  if (catalog.notice) previewNotice.textContent = catalog.notice;
  previewNotice.hidden = !catalog.demo && !catalog.preview;

  const recent = [...state.apps].sort((a, b) => (latestMention(b)?.date ?? "").localeCompare(latestMention(a)?.date ?? ""));
  const popular = [...state.apps].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0) || (latestMention(b)?.date ?? "").localeCompare(latestMention(a)?.date ?? ""));
  const prominent = new Set([...recent.slice(0, 4), ...popular.filter((app) => app.likes > 0).slice(0, 4)].map((app) => app.id));
  const discoveryPool = state.apps.filter((app) => !prominent.has(app.id));
  const discovery = randomShuffle(discoveryPool.length >= 3 ? discoveryPool : state.apps);

  renderInto(document.querySelector("#recent-list"), recent.slice(0, 4));
  renderInto(document.querySelector("#popular-list"), popular.slice(0, 4));
  renderInto(document.querySelector("#discover-list"), discovery.slice(0, 4));
  renderFilters();
  renderDirectory();

  if (catalog.likesAvailable === false) {
    document.querySelector("#likes-freshness").textContent = "As curtidas serão ativadas depois da criação das Issues reais no GitHub.";
  } else if (catalog.generatedAt) {
    document.querySelector("#likes-freshness").textContent = `Curtidas via 👍 no GitHub · atualizadas em ${dateFormatter.format(new Date(catalog.generatedAt))}.`;
  }
  document.querySelector("#search").addEventListener("input", (event) => {
    state.search = event.currentTarget.value;
    state.directoryPage = 1;
    renderDirectory();
  });
  document.querySelector("#prev-page").addEventListener("click", () => {
    state.directoryPage -= 1;
    renderDirectory();
  });
  document.querySelector("#next-page").addEventListener("click", () => {
    state.directoryPage += 1;
    renderDirectory();
  });
}

start().catch((error) => {
  console.error(error);
  document.querySelector("#empty-state").hidden = false;
  document.querySelector("#empty-state strong").textContent = "Não foi possível abrir o catálogo.";
  document.querySelector("#empty-state span").textContent = "Tente novamente em alguns instantes.";
});
