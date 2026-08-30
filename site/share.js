const panel = document.querySelector(".share-panel");

if (panel) {
  const shareButton = panel.querySelector(".share-button");
  const status = panel.querySelector(".share-status");
  const pageURL = panel.dataset.sharePageUrl || window.location.href;
  const shareText = panel.dataset.shareText || `Confira ${document.title.replace(/\s+—\s+VitrineADT$/, "")} no Área de Transferência: ${pageURL}`;
  const appName = document.title.replace(/\s+—\s+VitrineADT$/, "");

  function setStatus(text) {
    status.textContent = text;
  }

  shareButton?.addEventListener("click", async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: appName, text: shareText, url: pageURL });
        setStatus("Compartilhado.");
      } else {
        setStatus("Escolha uma rede abaixo para compartilhar.");
      }
    } catch (error) {
      if (error.name !== "AbortError") setStatus("Não foi possível compartilhar agora. Tente copiar a mensagem.");
    }
  });

  panel.querySelectorAll("[data-network]").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    const text = encodeURIComponent(shareText);
    const network = link.dataset.network;
    const urls = {
      whatsapp: `https://wa.me/?text=${text}`,
      bluesky: `https://bsky.app/intent/compose?text=${text}`,
      x: `https://twitter.com/intent/tweet?text=${text}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageURL)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageURL)}`,
      threads: `https://www.threads.net/intent/post?text=${text}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(pageURL)}&text=${text}`,
      reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(pageURL)}&title=${encodeURIComponent(appName)}`,
      instagram: "https://www.instagram.com/",
      tiktok: "https://www.tiktok.com/"
    };
    if (!urls[network]) return;
    window.open(urls[network], "_blank", "noopener,noreferrer");
    if (network === "instagram" || network === "tiktok") {
      setStatus("Essa rede não permite preencher a legenda pela web. Use Compartilhar para enviar a mensagem pronta.");
    }
  }));

  const pageLink = panel.querySelector("[data-share-page-link]");
  if (pageLink) pageLink.href = pageURL;
}
