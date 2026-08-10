"use strict";

(function installWorldLeaderChatSocialCardExport() {
  const PRESETS = Object.freeze({
    feed: {
      label: "Instagram / Facebook Feed (4:5)",
      width: 1080,
      height: 1350,
      headlineSize: 64,
      bodySize: 27,
      chatSize: 25,
      maxHeadlineLines: 5,
      maxMessageLines: 3,
      maxMessages: 6
    },
    story: {
      label: "Story / TikTok (9:16)",
      width: 1080,
      height: 1920,
      headlineSize: 72,
      bodySize: 30,
      chatSize: 27,
      maxHeadlineLines: 6,
      maxMessageLines: 4,
      maxMessages: 9
    },
    landscape: {
      label: "X / Facebook Landscape (16:9)",
      width: 1600,
      height: 900,
      headlineSize: 66,
      bodySize: 27,
      chatSize: 24,
      maxHeadlineLines: 5,
      maxMessageLines: 3,
      maxMessages: 5
    }
  });

  const COLORS = Object.freeze({
    paper: "#f7f2e8",
    paperLight: "#fffdf7",
    ink: "#101214",
    red: "#c40000",
    redDark: "#8f0000",
    line: "#232323",
    muted: "#666159",
    chat: "#eef3ed",
    chatAlt: "#fff8df",
    system: "#e4e1da",
    white: "#ffffff"
  });

  const LOGO_URL = new URL("./assets/world-leaders-chat-logo.webp", location.href).href;
  const MARK_URL = new URL("./assets/world-leaders-chat-favicon.webp", location.href).href;

  function currentEvent() {
    try {
      const match = location.hash.match(/event=([^&]+)/);
      const id = (typeof state !== "undefined" && state.currentId) || (match ? decodeURIComponent(match[1]) : null);
      return id && typeof allEvents === "function" ? allEvents().find((event) => event.id === id) : null;
    } catch {
      return null;
    }
  }

  function eventUrl(event) {
    return `${location.origin}${location.pathname}#event=${encodeURIComponent(event.id)}`;
  }

  function sourcePublishers(event) {
    return [...new Set((event.sources || []).map((source) => source.publisher).filter(Boolean))];
  }

  function fileSlug(event) {
    return String(event.id || event.title || "world-leaders-chat")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "world-leaders-chat";
  }

  function roundedRectPath(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function fillRoundedRect(ctx, x, y, width, height, radius, fill, stroke = null, lineWidth = 1) {
    roundedRectPath(ctx, x, y, width, height, radius);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  function wrapLines(ctx, value, maxWidth) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return [];
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function ellipsize(ctx, line, maxWidth) {
    let output = String(line || "").trim();
    while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) {
      output = output.replace(/\s*\S+$/, "").trim() || output.slice(0, -1);
    }
    return `${output}…`;
  }

  function drawWrappedText(ctx, value, options) {
    const {
      x,
      y,
      maxWidth,
      lineHeight,
      maxLines = Infinity,
      fill = COLORS.ink,
      align = "left"
    } = options;
    const lines = wrapLines(ctx, value, maxWidth);
    const output = lines.slice(0, maxLines);
    if (lines.length > maxLines && output.length) output[output.length - 1] = ellipsize(ctx, output[output.length - 1], maxWidth);
    ctx.fillStyle = fill;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    output.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
    return { lines: output, height: output.length * lineHeight, nextY: y + output.length * lineHeight };
  }

  function fitFont(ctx, text, options) {
    const {
      maxWidth,
      maxLines,
      start,
      minimum,
      family = 'Georgia, "Times New Roman", serif',
      weight = 900
    } = options;
    let size = start;
    while (size > minimum) {
      ctx.font = `${weight} ${size}px ${family}`;
      if (wrapLines(ctx, text, maxWidth).length <= maxLines) return size;
      size -= 2;
    }
    return minimum;
  }

  function drawRule(ctx, x, y, width, color = COLORS.ink, thickness = 4) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, thickness);
  }

  function drawBackground(ctx, width, height, mark) {
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, width, height);

    const stepX = Math.max(260, Math.round(width / 4));
    const stepY = Math.max(230, Math.round(height / 6));
    ctx.save();
    ctx.globalAlpha = 0.035;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 4;
    for (let row = 0; row < Math.ceil(height / stepY) + 1; row += 1) {
      for (let col = 0; col < Math.ceil(width / stepX) + 1; col += 1) {
        const x = col * stepX - (row % 2 ? stepX / 2 : 0) + 35;
        const y = row * stepY + 35;
        roundedRectPath(ctx, x, y, 190, 105, 28);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 38, y + 105);
        ctx.lineTo(x + 25, y + 137);
        ctx.lineTo(x + 74, y + 105);
        ctx.stroke();
      }
    }
    ctx.restore();

    if (mark) {
      const size = Math.min(width, height) * 0.42;
      ctx.save();
      ctx.globalAlpha = 0.045;
      ctx.drawImage(mark, width - size * 0.88, height - size * 0.9, size, size);
      ctx.restore();
    }

    ctx.fillStyle = COLORS.red;
    ctx.fillRect(0, 0, width, 18);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, 18, width, 7);
  }

  function loadImage(url) {
    return new Promise((resolve) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
  }

  let assetPromise;
  function loadAssets() {
    if (!assetPromise) {
      assetPromise = Promise.all([loadImage(LOGO_URL), loadImage(MARK_URL)]).then(([logo, mark]) => ({ logo, mark }));
    }
    return assetPromise;
  }

  function drawBrand(ctx, logo, x, y, width, maxHeight) {
    if (logo && logo.naturalWidth && logo.naturalHeight) {
      const scale = Math.min(width / logo.naturalWidth, maxHeight / logo.naturalHeight);
      const drawWidth = logo.naturalWidth * scale;
      const drawHeight = logo.naturalHeight * scale;
      ctx.drawImage(logo, x + (width - drawWidth) / 2, y, drawWidth, drawHeight);
      return drawHeight;
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = COLORS.ink;
    ctx.font = '900 54px Georgia, "Times New Roman", serif';
    ctx.fillText("WORLD LEADERS", x + width / 2, y + 4);
    ctx.fillStyle = COLORS.red;
    ctx.font = '900 58px Georgia, "Times New Roman", serif';
    ctx.fillText("CHAT", x + width / 2, y + 62);
    return 130;
  }

  function directMessages(event) {
    return (event.messages || []).filter((message) => message && message.kind !== "system" && message.speaker && message.text);
  }

  function drawHeaderMeta(ctx, event, x, y, width, fontSize = 22) {
    const category = String(event.category || "WORLD NEWS").toUpperCase();
    const date = String(event.date || "").toUpperCase();
    ctx.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = COLORS.red;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(category, x, y);
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = "right";
    ctx.fillText(date, x + width, y);
    ctx.textAlign = "left";
  }

  function messageHeight(ctx, message, width, size, maxLines) {
    ctx.font = `900 ${Math.round(size * 0.72)}px Arial, Helvetica, sans-serif`;
    const speakerHeight = Math.round(size * 0.94);
    ctx.font = `500 ${size}px Arial, Helvetica, sans-serif`;
    const lines = wrapLines(ctx, message.text, width - 54).slice(0, maxLines);
    return 22 + speakerHeight + Math.max(1, lines.length) * Math.round(size * 1.25) + 18;
  }

  function drawMessage(ctx, message, options) {
    const { x, y, width, size, maxLines, alternate = false } = options;
    const height = messageHeight(ctx, message, width, size, maxLines);
    fillRoundedRect(
      ctx,
      x,
      y,
      width,
      height,
      22,
      alternate ? COLORS.chatAlt : COLORS.chat,
      alternate ? "#dcc98f" : "#aebcab",
      2
    );
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(x, y + 16, 8, height - 32);
    ctx.font = `900 ${Math.round(size * 0.72)}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(String(message.speaker).toUpperCase(), x + 28, y + 18);
    ctx.font = `500 ${size}px Arial, Helvetica, sans-serif`;
    drawWrappedText(ctx, message.text, {
      x: x + 28,
      y: y + 18 + Math.round(size * 0.92),
      maxWidth: width - 54,
      lineHeight: Math.round(size * 1.25),
      maxLines,
      fill: COLORS.ink
    });
    return height;
  }

  function drawFooter(ctx, event, x, y, width, height, fontSize = 18) {
    const publishers = sourcePublishers(event);
    const publisherText = publishers.length > 3
      ? `${publishers.slice(0, 3).join(" • ")} +${publishers.length - 3}`
      : publishers.join(" • ");
    drawRule(ctx, x, y, width, COLORS.ink, 4);
    ctx.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = COLORS.red;
    ctx.fillText("REAL EVENT • ORIGINAL SOURCES • IMAGINED REACTIONS", x, y + 18);
    ctx.font = `700 ${Math.max(15, fontSize - 2)}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = COLORS.ink;
    if (publisherText) ctx.fillText(`SOURCE CREDIT: ${publisherText}`, x, y + 50);
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = "right";
    const host = `${location.host}${location.pathname}`.replace(/\/$/, "");
    ctx.fillText(host, x + width, y + 50);
    ctx.textAlign = "left";
    return Math.max(height, 82);
  }

  function renderPortrait(ctx, event, preset, assets) {
    const { width, height } = preset;
    const margin = 62;
    const contentWidth = width - margin * 2;
    drawBackground(ctx, width, height, assets.mark);

    let y = 54;
    const brandHeight = drawBrand(ctx, assets.logo, margin, y, contentWidth, preset === PRESETS.story ? 225 : 180);
    y += brandHeight + 16;
    drawRule(ctx, margin, y, contentWidth, COLORS.ink, 4);
    y += 18;
    drawHeaderMeta(ctx, event, margin, y, contentWidth, preset === PRESETS.story ? 23 : 21);
    y += 42;

    const headline = event.title || event.article?.headline || "WORLD LEADERS CHAT";
    const headlineSize = fitFont(ctx, headline, {
      maxWidth: contentWidth,
      maxLines: preset.maxHeadlineLines,
      start: preset.headlineSize,
      minimum: preset === PRESETS.story ? 46 : 42
    });
    ctx.font = `900 ${headlineSize}px Georgia, "Times New Roman", serif`;
    const headlineBlock = drawWrappedText(ctx, headline, {
      x: margin,
      y,
      maxWidth: contentWidth,
      lineHeight: Math.round(headlineSize * 0.95),
      maxLines: preset.maxHeadlineLines,
      fill: COLORS.ink
    });
    y = headlineBlock.nextY + 20;

    const dek = event.article?.dek || event.kicker || event.summary || "";
    ctx.font = `700 ${preset.bodySize}px Georgia, "Times New Roman", serif`;
    const dekBlock = drawWrappedText(ctx, dek, {
      x: margin,
      y,
      maxWidth: contentWidth,
      lineHeight: Math.round(preset.bodySize * 1.25),
      maxLines: preset === PRESETS.story ? 4 : 3,
      fill: COLORS.muted
    });
    y = dekBlock.nextY + 22;

    ctx.font = `900 ${Math.round(preset.chatSize * 0.76)}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = COLORS.red;
    ctx.fillText("FROM THE CHAT", margin, y);
    y += 34;

    const footerY = height - 132;
    const messages = directMessages(event).slice(0, preset.maxMessages);
    let shown = 0;
    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      const nextHeight = messageHeight(ctx, message, contentWidth, preset.chatSize, preset.maxMessageLines);
      if (y + nextHeight > footerY - 48) break;
      y += drawMessage(ctx, message, {
        x: margin,
        y,
        width: contentWidth,
        size: preset.chatSize,
        maxLines: preset.maxMessageLines,
        alternate: index % 2 === 1
      }) + 14;
      shown += 1;
    }

    const total = directMessages(event).length;
    if (total > shown) {
      ctx.font = `900 ${Math.round(preset.chatSize * 0.68)}px Arial, Helvetica, sans-serif`;
      ctx.fillStyle = COLORS.redDark;
      ctx.fillText(`+ ${total - shown} MORE MESSAGES IN THE FULL FILE`, margin, Math.min(y + 4, footerY - 26));
    }

    if (event.meme && y < footerY - 82) {
      ctx.font = `900 ${Math.round(preset.chatSize * 0.84)}px Georgia, "Times New Roman", serif`;
      drawWrappedText(ctx, `LAST WORD: ${event.meme}`, {
        x: margin,
        y: Math.min(y + 20, footerY - 92),
        maxWidth: contentWidth,
        lineHeight: Math.round(preset.chatSize * 1.12),
        maxLines: 2,
        fill: COLORS.redDark
      });
    }

    drawFooter(ctx, event, margin, footerY, contentWidth, 92, 18);
  }

  function renderLandscape(ctx, event, preset, assets) {
    const { width, height } = preset;
    const margin = 58;
    drawBackground(ctx, width, height, assets.mark);

    const gap = 58;
    const leftWidth = Math.round((width - margin * 2 - gap) * 0.48);
    const rightWidth = width - margin * 2 - gap - leftWidth;
    const rightX = margin + leftWidth + gap;
    let leftY = 46;
    const brandHeight = drawBrand(ctx, assets.logo, margin, leftY, leftWidth, 150);
    leftY += brandHeight + 12;
    drawRule(ctx, margin, leftY, leftWidth, COLORS.ink, 4);
    leftY += 18;
    drawHeaderMeta(ctx, event, margin, leftY, leftWidth, 20);
    leftY += 40;

    const headline = event.title || event.article?.headline || "WORLD LEADERS CHAT";
    const headlineSize = fitFont(ctx, headline, {
      maxWidth: leftWidth,
      maxLines: preset.maxHeadlineLines,
      start: preset.headlineSize,
      minimum: 40
    });
    ctx.font = `900 ${headlineSize}px Georgia, "Times New Roman", serif`;
    const headlineBlock = drawWrappedText(ctx, headline, {
      x: margin,
      y: leftY,
      maxWidth: leftWidth,
      lineHeight: Math.round(headlineSize * 0.94),
      maxLines: preset.maxHeadlineLines,
      fill: COLORS.ink
    });
    leftY = headlineBlock.nextY + 18;

    ctx.font = `700 ${preset.bodySize}px Georgia, "Times New Roman", serif`;
    drawWrappedText(ctx, event.article?.dek || event.kicker || event.summary || "", {
      x: margin,
      y: leftY,
      maxWidth: leftWidth,
      lineHeight: Math.round(preset.bodySize * 1.25),
      maxLines: 4,
      fill: COLORS.muted
    });

    drawRule(ctx, rightX, 54, rightWidth, COLORS.red, 9);
    ctx.font = "900 22px Arial, Helvetica, sans-serif";
    ctx.fillStyle = COLORS.red;
    ctx.textBaseline = "top";
    ctx.fillText("FROM THE CHAT", rightX, 78);
    let y = 118;
    const footerY = height - 112;
    const messages = directMessages(event).slice(0, preset.maxMessages);
    let shown = 0;
    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      const nextHeight = messageHeight(ctx, message, rightWidth, preset.chatSize, preset.maxMessageLines);
      if (y + nextHeight > footerY - 20) break;
      y += drawMessage(ctx, message, {
        x: rightX,
        y,
        width: rightWidth,
        size: preset.chatSize,
        maxLines: preset.maxMessageLines,
        alternate: index % 2 === 1
      }) + 12;
      shown += 1;
    }
    const total = directMessages(event).length;
    if (total > shown) {
      ctx.font = "900 17px Arial, Helvetica, sans-serif";
      ctx.fillStyle = COLORS.redDark;
      ctx.fillText(`+ ${total - shown} MORE MESSAGES IN THE FULL FILE`, rightX, Math.min(y + 2, footerY - 22));
    }

    drawFooter(ctx, event, margin, footerY, width - margin * 2, 78, 17);
  }

  async function renderSocialCanvas(event, format = "feed") {
    const preset = PRESETS[format] || PRESETS.feed;
    const canvas = document.createElement("canvas");
    canvas.width = preset.width;
    canvas.height = preset.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("This browser could not create the social image canvas.");
    if (document.fonts?.ready) await document.fonts.ready;
    const assets = await loadAssets();
    if (format === "landscape") renderLandscape(ctx, event, preset, assets);
    else renderPortrait(ctx, event, preset, assets);
    return canvas;
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The PNG could not be created."));
      }, "image/png", 1);
    });
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function saveSocialPng(event, format) {
    const canvas = await renderSocialCanvas(event, format);
    const blob = await canvasBlob(canvas);
    const fileName = `world-leaders-chat-${fileSlug(event)}-${format}.png`;
    downloadBlob(blob, fileName);
    return { blob, fileName };
  }

  async function shareSocialPng(event, format) {
    const canvas = await renderSocialCanvas(event, format);
    const blob = await canvasBlob(canvas);
    const fileName = `world-leaders-chat-${fileSlug(event)}-${format}.png`;
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        title: event.title,
        text: "World Leaders Chat — real event, original sources, imagined reactions.",
        files: [file],
        url: eventUrl(event)
      });
      return { blob, fileName, shared: true };
    }
    downloadBlob(blob, fileName);
    return { blob, fileName, shared: false };
  }

  function setButtonState(button, label, duration = 1400) {
    const previous = button.textContent;
    button.textContent = label;
    button.disabled = true;
    setTimeout(() => {
      button.textContent = previous;
      button.disabled = false;
    }, duration);
  }

  function injectStyles() {
    if (document.getElementById("social-png-export-style")) return;
    const style = document.createElement("style");
    style.id = "social-png-export-style";
    style.textContent = `
      .social-export-controls{display:flex;flex-wrap:wrap;gap:6px;align-items:center;width:100%;padding-top:2px}
      .social-export-controls select{border:2px solid #111;background:#fff;color:#111;padding:9px 30px 9px 10px;font:900 11px Arial,Helvetica,sans-serif;letter-spacing:.035em;text-transform:uppercase;max-width:100%}
      .social-export-controls .btn{white-space:nowrap}
      .social-export-note{display:block;width:100%;font:700 10px/1.35 Arial,Helvetica,sans-serif;color:#666;margin-top:1px}
      @media(max-width:800px){.social-export-controls select,.social-export-controls .btn{flex:1 1 100%;width:100%}}
    `;
    document.head.appendChild(style);
  }

  function addControls() {
    const actions = document.querySelector(".detail-actions");
    if (!actions || document.getElementById("saveSocialPngBtn")) return;
    injectStyles();

    const wrapper = document.createElement("div");
    wrapper.className = "social-export-controls";

    const format = document.createElement("select");
    format.id = "socialPngFormat";
    format.setAttribute("aria-label", "Social image size");
    Object.entries(PRESETS).forEach(([value, preset]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = preset.label;
      format.appendChild(option);
    });

    const save = document.createElement("button");
    save.className = "btn red";
    save.id = "saveSocialPngBtn";
    save.type = "button";
    save.textContent = "Save Social PNG";
    save.addEventListener("click", async () => {
      const event = currentEvent();
      if (!event) return;
      const previous = save.textContent;
      save.textContent = "Rendering PNG…";
      save.disabled = true;
      try {
        await saveSocialPng(event, format.value);
        save.textContent = "PNG Saved ✓";
      } catch (error) {
        console.error(error);
        save.textContent = "Save Failed";
      }
      setTimeout(() => {
        save.textContent = previous;
        save.disabled = false;
      }, 1700);
    });

    const share = document.createElement("button");
    share.className = "btn";
    share.id = "shareSocialPngBtn";
    share.type = "button";
    share.textContent = "Share Social PNG";
    if (!navigator.share) share.hidden = true;
    share.addEventListener("click", async () => {
      const event = currentEvent();
      if (!event) return;
      const previous = share.textContent;
      share.textContent = "Preparing…";
      share.disabled = true;
      try {
        const result = await shareSocialPng(event, format.value);
        share.textContent = result.shared ? "Share Ready ✓" : "PNG Saved ✓";
      } catch (error) {
        if (error?.name !== "AbortError") console.error(error);
        share.textContent = error?.name === "AbortError" ? "Share Cancelled" : "Share Failed";
      }
      setTimeout(() => {
        share.textContent = previous;
        share.disabled = false;
      }, 1700);
    });

    const note = document.createElement("span");
    note.className = "social-export-note";
    note.textContent = "Branded background, headline, chat excerpt, source credit and full-file link are built into every image.";

    wrapper.append(format, save, share, note);
    actions.appendChild(wrapper);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addControls, { once: true });
  else addControls();

  window.WLC_SOCIAL_EXPORT = Object.freeze({
    presets: PRESETS,
    renderSocialCanvas,
    saveSocialPng,
    shareSocialPng
  });
})();
