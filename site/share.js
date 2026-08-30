const button = document.querySelector(".share-button");
const status = document.querySelector(".share-status");

function publicShareURL() {
  const url = new URL(window.location.href);
  if (url.hostname === "vitrineadt.ezequiel.app") url.protocol = "https:";
  return url.href;
}

button?.addEventListener("click", async () => {
  const payload = {
    title: button.dataset.shareTitle,
    text: button.dataset.shareText,
    url: publicShareURL()
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

const studio = document.querySelector(".share-studio");
const canvas = document.querySelector("#share-artwork");

if (studio && canvas) {
  const context = canvas.getContext("2d");
  const artworkState = { format: "web", theme: "dark" };
  const formats = {
    web: { width: 1200, height: 630 },
    instagram: { width: 1080, height: 1350 },
    tiktok: { width: 1080, height: 1920 }
  };
  const app = {
    name: studio.dataset.shareName ?? "",
    developer: studio.dataset.shareDeveloper ?? "",
    episode: studio.dataset.shareEpisode ?? "",
    episodeTitle: studio.dataset.shareEpisodeTitle ?? "",
    iconURL: studio.dataset.shareIcon ?? ""
  };
  let iconImage = null;

  function roundedRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function setFont(weight, size) {
    context.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  }

  function fitFont(text, maxWidth, startingSize, minimumSize = 20) {
    let size = startingSize;
    while (size > minimumSize) {
      setFont(700, size);
      if (context.measureText(text).width <= maxWidth) return size;
      size -= 2;
    }
    return size;
  }

  function drawWrappedText(text, x, y, maxWidth, lineHeight, maxLines = 3) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines && visible.length > 0) visible[visible.length - 1] = `${visible[visible.length - 1]}…`;
    visible.forEach((lineText, index) => context.fillText(lineText, x, y + index * lineHeight));
    return y + visible.length * lineHeight;
  }

  function drawIcon(x, y, size) {
    context.save();
    roundedRect(x, y, size, size, size * 0.22);
    context.clip();
    if (iconImage) {
      context.drawImage(iconImage, x, y, size, size);
    } else {
      const gradient = context.createLinearGradient(x, y, x + size, y + size);
      gradient.addColorStop(0, "#d77b95");
      gradient.addColorStop(1, "#743149");
      context.fillStyle = gradient;
      context.fillRect(x, y, size, size);
      context.fillStyle = "#fff";
      context.textAlign = "center";
      context.textBaseline = "middle";
      setFont(800, size * 0.3);
      context.fillText(app.name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase(), x + size / 2, y + size / 2);
    }
    context.restore();
  }

  function drawArtwork() {
    const dimensions = formats[artworkState.format];
    const isVertical = dimensions.height > dimensions.width;
    const isDark = artworkState.theme === "dark";
    const colors = isDark
      ? { background: "#171317", ink: "#fff7fa", muted: "#d8bfc7", accent: "#ed8eaa", glow: "rgba(237, 142, 170, 0.18)" }
      : { background: "#fbf8f7", ink: "#211e20", muted: "#686268", accent: "#943c55", glow: "rgba(148, 60, 85, 0.12)" };
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    canvas.style.aspectRatio = `${dimensions.width} / ${dimensions.height}`;
    context.fillStyle = colors.background;
    context.fillRect(0, 0, dimensions.width, dimensions.height);

    const glow = context.createRadialGradient(dimensions.width * 0.84, dimensions.height * 0.12, 0, dimensions.width * 0.84, dimensions.height * 0.12, dimensions.width * 0.72);
    glow.addColorStop(0, colors.glow);
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, dimensions.width, dimensions.height);

    const padding = isVertical ? 76 : 72;
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = colors.accent;
    setFont(800, 22);
    context.fillText("VITRINEADT", padding, padding);
    context.fillStyle = colors.muted;
    setFont(600, 18);
    context.fillText("AMIGOS DO ÁREA DE TRANSFERÊNCIA", padding, padding + 34);

    if (isVertical) {
      const iconSize = Math.min(360, dimensions.width - padding * 2);
      const iconX = (dimensions.width - iconSize) / 2;
      const iconY = Math.round(dimensions.height * 0.22);
      drawIcon(iconX, iconY, iconSize);
      context.fillStyle = colors.ink;
      context.textAlign = "center";
      const nameSize = fitFont(app.name, dimensions.width - padding * 2, 76, 36);
      setFont(700, nameSize);
      const nameBottom = drawWrappedText(app.name, dimensions.width / 2, iconY + iconSize + 98, dimensions.width - padding * 2, nameSize * 1.05, 2);
      context.fillStyle = colors.accent;
      context.fillStyle = colors.muted;
      setFont(500, 25);
      context.fillText(`por ${app.developer}`, dimensions.width / 2, nameBottom + 40);
      context.fillStyle = colors.accent;
      setFont(800, 28);
      context.fillText(`EPISÓDIO ${app.episode}`, dimensions.width / 2, nameBottom + 88);
      context.fillStyle = colors.muted;
      setFont(500, 25);
      drawWrappedText(app.episodeTitle, dimensions.width / 2, nameBottom + 134, dimensions.width - padding * 2, 35, 2);
      context.textAlign = "left";
      setFont(600, 18);
      context.fillText("OUÇA A MENÇÃO NO PODCAST", padding, dimensions.height - padding);
    } else {
      const iconSize = 230;
      const iconY = Math.round((dimensions.height - iconSize) / 2) + 24;
      drawIcon(padding, iconY, iconSize);
      const copyX = padding + iconSize + 52;
      const copyWidth = dimensions.width - copyX - padding;
      context.fillStyle = colors.accent;
      setFont(800, 24);
      context.fillText(`EPISÓDIO ${app.episode}`, copyX, iconY + 14);
      context.fillStyle = colors.ink;
      const nameSize = fitFont(app.name, copyWidth, 68, 34);
      setFont(700, nameSize);
      const nameBottom = drawWrappedText(app.name, copyX, iconY + 92, copyWidth, nameSize * 1.06, 2);
      context.fillStyle = colors.muted;
      setFont(500, 20);
      context.fillText(`por ${app.developer}`, copyX, nameBottom + 34);
      context.fillStyle = colors.muted;
      setFont(500, 22);
      drawWrappedText(app.episodeTitle, copyX, nameBottom + 76, copyWidth, 30, 2);
      context.fillStyle = colors.muted;
      setFont(600, 18);
      context.fillText("OUÇA A MENÇÃO NO PODCAST", padding, dimensions.height - padding);
    }
  }

  function updateOptionState(selector, dataKey, value) {
    document.querySelectorAll(selector).forEach((option) => {
      const selected = option.dataset[dataKey] === value;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
  }

  document.querySelectorAll("[data-format]").forEach((option) => option.addEventListener("click", () => {
    artworkState.format = option.dataset.format;
    updateOptionState("[data-format]", "format", artworkState.format);
    drawArtwork();
  }));
  document.querySelectorAll("[data-share-theme]").forEach((option) => option.addEventListener("click", () => {
    artworkState.theme = option.dataset.shareTheme;
    updateOptionState("[data-share-theme]", "shareTheme", artworkState.theme);
    drawArtwork();
  }));

  document.querySelector("#download-share-artwork")?.addEventListener("click", () => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const slug = app.name.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
      link.href = url;
      link.download = `${slug}-adt-${app.episode || "mencao"}-${artworkState.format}.png`;
      link.click();
      URL.revokeObjectURL(url);
      studio.querySelector(".share-studio-status").textContent = "Arte pronta para publicar.";
    }, "image/png");
  });

  document.querySelector("#share-share-artwork")?.addEventListener("click", () => {
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `${app.name}-adt.png`, { type: "image/png" });
      const payload = { title: app.name, text: `Confira ${app.name}, apresentado no episódio ${app.episode} do Área de Transferência.`, url: publicShareURL() };
      try {
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ ...payload, files: [file] });
          studio.querySelector(".share-studio-status").textContent = "Arte compartilhada.";
        } else {
          document.querySelector("#download-share-artwork")?.click();
          studio.querySelector(".share-studio-status").textContent = "A arte foi baixada porque este dispositivo não aceita compartilhamento direto de imagens.";
        }
      } catch (error) {
        if (error.name !== "AbortError") studio.querySelector(".share-studio-status").textContent = "Não foi possível compartilhar a arte. Tente baixá-la.";
      }
    }, "image/png");
  });

  if (app.iconURL) {
    iconImage = new Image();
    iconImage.addEventListener("load", drawArtwork, { once: true });
    iconImage.addEventListener("error", drawArtwork, { once: true });
    iconImage.src = app.iconURL;
  }
  drawArtwork();
}
