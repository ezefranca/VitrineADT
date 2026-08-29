const button = document.querySelector(".share-button");
const status = document.querySelector(".share-status");

button?.addEventListener("click", async () => {
  const payload = {
    title: button.dataset.shareTitle,
    text: button.dataset.shareText,
    url: window.location.href
  };

  try {
    if (navigator.share) {
      await navigator.share(payload);
      status.textContent = "Compartilhado.";
      return;
    }
    await navigator.clipboard.writeText(payload.url);
    button.textContent = "Link copiado";
    status.textContent = "O link foi copiado para a área de transferência.";
  } catch (error) {
    if (error.name === "AbortError") return;
    status.textContent = "Não foi possível compartilhar. Copie o endereço desta página.";
  }
});
