async function configureRepositoryLinks() {
  try {
    const response = await fetch("./data/apps.json", { headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const catalog = await response.json();
    if (!catalog.repositoryURL) return;

    for (const link of document.querySelectorAll(".github-link")) {
      link.href = catalog.repositoryURL;
    }
    for (const link of document.querySelectorAll(".submit-link")) {
      link.href = `${catalog.repositoryURL}/issues/new?template=app.yml`;
      link.hidden = false;
    }
    for (const link of document.querySelectorAll(".report-link")) {
      link.href = `${catalog.repositoryURL}/issues/new?template=report.yml`;
      link.hidden = false;
    }
    for (const link of document.querySelectorAll(".removal-link")) {
      link.href = `${catalog.repositoryURL}/issues/new?template=removal.yml`;
      link.hidden = false;
    }
  } catch {
    // Os links informativos continuam disponíveis mesmo sem os dados do catálogo.
  }
}

configureRepositoryLinks();
