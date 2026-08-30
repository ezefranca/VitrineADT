const panel = document.querySelector(".share-panel");

if (panel) {
  const message = panel.querySelector("#share-message");
  const shareButton = panel.querySelector(".share-button");
  const copyButton = panel.querySelector(".copy-share-button");
  const status = panel.querySelector(".share-status");
  const pageURL = panel.dataset.sharePageUrl || window.location.href;
  const appName = document.title.replace(/\s+—\s+VitrineADT$/, "");

  function currentMessage() {
    return message.value.trim();
  }

  function setStatus(text) {
    status.textContent = text;
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(currentMessage());
      setStatus("Mensagem copiada. Já pode colar onde quiser.");
    } catch {
      message.focus();
      message.select();
      setStatus("Selecione e copie a mensagem acima.");
    }
  }

  shareButton?.addEventListener("click", async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: appName, text: currentMessage(), url: pageURL });
        setStatus("Compartilhado.");
      } else {
        await copyMessage();
      }
    } catch (error) {
      if (error.name !== "AbortError") setStatus("Não foi possível compartilhar agora. Tente copiar a mensagem.");
    }
  });

  copyButton?.addEventListener("click", copyMessage);

  panel.querySelectorAll("[data-network]").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    const text = encodeURIComponent(currentMessage());
    const network = link.dataset.network;
    const urls = {
      whatsapp: `https://wa.me/?text=${text}`,
      bluesky: `https://bsky.app/intent/compose?text=${text}`,
      x: `https://twitter.com/intent/tweet?text=${text}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageURL)}`
    };
    if (!urls[network]) return;
    window.open(urls[network], "_blank", "noopener,noreferrer");
  }));

  const pageLink = panel.querySelector("[data-share-page-link]");
  if (pageLink) pageLink.href = pageURL;
}
