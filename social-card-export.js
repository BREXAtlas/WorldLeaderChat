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
    public: "#fff0b8",
    system: "#e4e1da",
    white: "#ffffff"
  });

  const LOGO_URL = new URL("./assets/world-leaders-chat-logo.webp", location.href).href;
  const MARK_URL = new URL("./assets/world-leaders-chat-favicon.webp", location.href).href;
  const DISCLOSURE = "REAL EVENT • ORIGINAL SOURCES • IMAGINED REACTIONS";

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
    return `https://worldleaders.chat/#event=${encodeURIComponent(event.id)}`;
  }

  function articleHeadline(event) {
    return event.article?.headline || event.title || "WORLD LEADERS CHAT";
  }

  function articleDek(event) {
    return event.article?.dek || event.kicker || event.summary || "";
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

  function wrapParagraphs(ctx, values, maxWidth) {
    const lines = [];
    for (const value of values) {
      const wrapped = wrapLines(ctx, value, maxWidth);
      if (wrapped.length) lines.push(...wrapped);
    }
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

  function drawTextLines(ctx, lines, options) {
    const { x, y, lineHeight, fill = COLORS.ink } = options;
    ctx.fillStyle = fill;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
    return y + lines.length * lineHeight;
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
    ctx.font = '900 44px Georgia, "Times New Roman", serif';
    ctx.fillText("WORLD LEADERS", x + width / 2, y + 4);
    ctx.fillStyle = COLORS.red;
    ctx.font = '900 48px Georgia, "Times New Roman", serif';
    ctx.fillText("CHAT", x + width / 2, y + 52);
    return Math.min(maxHeight, 108);
  }

  function directMessages(event) {
    return (event.messages || []).filter((message) => message && message.kind !== "system" && message.speaker && message.text);
  }

  function carouselMessages(event) {
    return (event.messages || []).filter((message) => message && message.text);
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

  function messageColors(message, alternate) {
    if (message.kind === "public") return { fill: COLORS.public, stroke: "#d2a400" };
    if (message.kind === "system") return { fill: COLORS.system, stroke: "#b7b2a9" };
    return alternate
      ? { fill: COLORS.chatAlt, stroke: "#dcc98f" }
      : { fill: COLORS.chat, stroke: "#aebcab" };
  }

  function drawMessage(ctx, message, options) {
    const { x, y, width, size, maxLines, alternate = false } = options;
    const height = messageHeight(ctx, message, width, size, maxLines);
    const colors = messageColors(message, alternate);
    fillRoundedRect(ctx, x, y, width, height, 22, colors.fill, colors.stroke, 2);
    ctx.fillStyle = message.kind === "system" ? COLORS.muted : COLORS.red;
    ctx.fillRect(x, y + 16, 8, height - 32);
    ctx.font = `900 ${Math.round(size * 0.72)}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(String(message.kind === "system" ? "CHAT NOTE" : message.speaker).toUpperCase(), x + 28, y + 18);
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

  function drawFooter(ctx, event, x, y, width, fontSize = 18) {
    const publishers = sourcePublishers(event);
    const publisherText = publishers.length > 3
      ? `${publishers.slice(0, 3).join(" • ")} +${publishers.length - 3}`
      : publishers.join(" • ");
    drawRule(ctx, x, y, width, COLORS.ink, 4);
    ctx.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = COLORS.red;
    ctx.fillText(DISCLOSURE, x, y + 16);
    ctx.font = `700 ${Math.max(15, fontSize - 2)}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = COLORS.ink;
    if (publisherText) ctx.fillText(`SOURCE CREDIT: ${publisherText}`, x, y + 46);
    ctx.font = `600 ${Math.max(14, fontSize - 3)}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = COLORS.muted;
    drawWrappedText(ctx, eventUrl(event), {
      x,
      y: y + 72,
      maxWidth: width,
      lineHeight: Math.max(18, fontSize),
      maxLines: 2,
      fill: COLORS.muted
    });
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

    const headline = articleHeadline(event);
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

    ctx.font = `700 ${preset.bodySize}px Georgia, "Times New Roman", serif`;
    const dekBlock = drawWrappedText(ctx, articleDek(event), {
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

    // Single-image exports are teasers. These explicit zones guarantee that the
    // overflow notice, Last Word and footer can never occupy the same space.
    const footerY = height - 142;
    const lastWordHeight = preset === PRESETS.story ? 108 : 88;
    const lastWordY = footerY - lastWordHeight - 12;
    const overflowY = lastWordY - 34;
    const chatBottom = overflowY - 12;
    const messages = directMessages(event).slice(0, preset.maxMessages);
    let shown = 0;
    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      const nextHeight = messageHeight(ctx, message, contentWidth, preset.chatSize, preset.maxMessageLines);
      if (y + nextHeight > chatBottom) break;
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
      ctx.fillText(`+ ${total - shown} MORE MESSAGES IN THE FULL FILE`, margin, overflowY);
    }

    if (event.meme) {
      ctx.font = `900 ${Math.round(preset.chatSize * 0.84)}px Georgia, "Times New Roman", serif`;
      drawWrappedText(ctx, `LAST WORD: ${event.meme}`, {
        x: margin,
        y: lastWordY,
        maxWidth: contentWidth,
        lineHeight: Math.round(preset.chatSize * 1.12),
        maxLines: 3,
        fill: COLORS.redDark
      });
    }

    drawFooter(ctx, event, margin, footerY, contentWidth, 18);
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
    const brandHeight = drawBrand(ctx, assets.logo, margin, leftY, leftWidth, 135);
    leftY += brandHeight + 12;
    drawRule(ctx, margin, leftY, leftWidth, COLORS.ink, 4);
    leftY += 18;
    drawHeaderMeta(ctx, event, margin, leftY, leftWidth, 20);
    leftY += 40;

    const headline = articleHeadline(event);
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
    drawWrappedText(ctx, articleDek(event), {
      x: margin,
      y: leftY,
      maxWidth: leftWidth,
      lineHeight: Math.round(preset.bodySize * 1.25),
      maxLines: 3,
      fill: COLORS.muted
    });

    const footerY = height - 120;
    const lastWordY = footerY - 98;
    if (event.meme) {
      ctx.font = "900 21px Georgia, \"Times New Roman\", serif";
      drawWrappedText(ctx, `LAST WORD: ${event.meme}`, {
        x: margin,
        y: lastWordY,
        maxWidth: leftWidth,
        lineHeight: 27,
        maxLines: 3,
        fill: COLORS.redDark
      });
    }

    drawRule(ctx, rightX, 54, rightWidth, COLORS.red, 9);
    ctx.font = "900 22px Arial, Helvetica, sans-serif";
    ctx.fillStyle = COLORS.red;
    ctx.textBaseline = "top";
    ctx.fillText("FROM THE CHAT", rightX, 78);
    let y = 118;
    const overflowY = footerY - 31;
    const chatBottom = overflowY - 12;
    const messages = directMessages(event).slice(0, preset.maxMessages);
    let shown = 0;
    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      const nextHeight = messageHeight(ctx, message, rightWidth, preset.chatSize, preset.maxMessageLines);
      if (y + nextHeight > chatBottom) break;
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
      ctx.fillText(`+ ${total - shown} MORE MESSAGES IN THE FULL FILE`, rightX, overflowY);
    }

    drawFooter(ctx, event, margin, footerY, width - margin * 2, 17);
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

  function carouselSettings(preset) {
    const landscape = preset.width > preset.height;
    const story = preset === PRESETS.story;
    return {
      margin: landscape ? 62 : 58,
      logoHeight: landscape ? 90 : story ? 132 : 112,
      logoWidthRatio: landscape ? 0.42 : 0.62,
      pageBadgeWidth: landscape ? 210 : 205,
      messageSize: landscape ? 25 : story ? 29 : 27,
      messageGap: landscape ? 11 : 14,
      bottomMargin: landscape ? 42 : 52,
      firstHeadlineSize: landscape ? 50 : story ? 60 : 52,
      firstHeadlineMinimum: landscape ? 35 : 38,
      firstDekSize: landscape ? 23 : story ? 29 : 25,
      compactHeadlineSize: landscape ? 24 : story ? 28 : 25
    };
  }

  function drawPageNumber(ctx, pageNumber, pageCount, x, y, width) {
    fillRoundedRect(ctx, x, y, width, 48, 24, COLORS.red, COLORS.redDark, 2);
    ctx.font = "900 20px Arial, Helvetica, sans-serif";
    ctx.fillStyle = COLORS.white;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`PAGE ${pageNumber} / ${pageCount}`, x + width / 2, y + 24);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  function carouselHeader(ctx, event, preset, assets, options = {}) {
    const { draw = false, first = false, pageNumber = 1, pageCount = 2 } = options;
    const settings = carouselSettings(preset);
    const { margin, logoHeight, pageBadgeWidth } = settings;
    const contentWidth = preset.width - margin * 2;
    const brandWidth = Math.round(contentWidth * settings.logoWidthRatio);
    const top = 46;
    if (draw) {
      drawBrand(ctx, assets?.logo, margin, top, brandWidth, logoHeight);
      drawPageNumber(ctx, pageNumber, pageCount, margin + contentWidth - pageBadgeWidth, top + 8, pageBadgeWidth);
    }
    let y = top + logoHeight + 12;
    if (draw) drawRule(ctx, margin, y, contentWidth, COLORS.ink, 4);
    y += 18;

    if (first) {
      if (draw) drawHeaderMeta(ctx, event, margin, y, contentWidth, preset.width > preset.height ? 19 : 21);
      y += 38;
      const headline = articleHeadline(event);
      const headlineSize = fitFont(ctx, headline, {
        maxWidth: contentWidth,
        maxLines: preset.width > preset.height ? 3 : 5,
        start: settings.firstHeadlineSize,
        minimum: settings.firstHeadlineMinimum
      });
      const headlineLineHeight = Math.round(headlineSize * 0.96);
      ctx.font = `900 ${headlineSize}px Georgia, "Times New Roman", serif`;
      const headlineLines = wrapLines(ctx, headline, contentWidth);
      if (draw) drawTextLines(ctx, headlineLines, { x: margin, y, lineHeight: headlineLineHeight });
      y += headlineLines.length * headlineLineHeight + 17;

      const dekSize = settings.firstDekSize;
      const dekLineHeight = Math.round(dekSize * 1.24);
      ctx.font = `700 ${dekSize}px Georgia, "Times New Roman", serif`;
      const dekLines = wrapLines(ctx, articleDek(event), contentWidth);
      if (draw) drawTextLines(ctx, dekLines, { x: margin, y, lineHeight: dekLineHeight, fill: COLORS.muted });
      y += dekLines.length * dekLineHeight + 19;
    } else {
      ctx.font = `900 ${settings.compactHeadlineSize}px Georgia, "Times New Roman", serif`;
      const identifier = `${String(event.category || "WORLD NEWS").toUpperCase()} // ${articleHeadline(event)}`;
      if (draw) {
        drawWrappedText(ctx, identifier, {
          x: margin,
          y,
          maxWidth: contentWidth,
          lineHeight: Math.round(settings.compactHeadlineSize * 1.08),
          maxLines: 2,
          fill: COLORS.ink
        });
      }
      y += Math.min(2, Math.max(1, wrapLines(ctx, identifier, contentWidth).length)) * Math.round(settings.compactHeadlineSize * 1.08) + 16;
    }

    if (draw) {
      ctx.font = "900 18px Arial, Helvetica, sans-serif";
      ctx.fillStyle = COLORS.red;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("FROM THE CHAT", margin, y);
    }
    return y + 31;
  }

  function prepareCarouselMessages(ctx, event, width, size) {
    const bodyWidth = width - 56;
    return carouselMessages(event).map((message, messageIndex) => {
      ctx.font = `500 ${size}px Arial, Helvetica, sans-serif`;
      const paragraphs = [message.text];
      if (message.reaction) paragraphs.push(`↳ ${message.reaction}`);
      return {
        messageIndex,
        speaker: message.kind === "system" ? "CHAT NOTE" : String(message.speaker || "WORLD LEADER CHAT"),
        kind: message.kind || "satire",
        lines: wrapParagraphs(ctx, paragraphs, bodyWidth)
      };
    });
  }

  function carouselFragmentHeight(size, lineCount) {
    const speakerLineHeight = Math.round(size * 0.82);
    const bodyLineHeight = Math.round(size * 1.28);
    return 18 + speakerLineHeight + 7 + Math.max(1, lineCount) * bodyLineHeight + 18;
  }

  function cloneMessageState(state) {
    return { messageIndex: state.messageIndex, lineIndex: state.lineIndex };
  }

  function messageStateDone(state, messages) {
    return state.messageIndex >= messages.length;
  }

  function takeCarouselFragments(messages, initialState, capacity, settings, reserveFinalLine) {
    const state = cloneMessageState(initialState);
    const fragments = [];
    let usedHeight = 0;
    const lineHeight = Math.round(settings.messageSize * 1.28);
    const lastMessageIndex = messages.length - 1;

    while (!messageStateDone(state, messages)) {
      const message = messages[state.messageIndex];
      const remainingLines = message.lines.length - state.lineIndex;
      const reservedLines = reserveFinalLine && state.messageIndex === lastMessageIndex ? 1 : 0;
      const availableMessageLines = remainingLines - reservedLines;
      if (availableMessageLines <= 0) break;

      const gap = fragments.length ? settings.messageGap : 0;
      const fixedHeight = carouselFragmentHeight(settings.messageSize, 0);
      const roomForLines = Math.floor((capacity - usedHeight - gap - fixedHeight) / lineHeight) + 1;
      if (roomForLines < 1) break;

      const take = Math.min(availableMessageLines, roomForLines);
      const startLine = state.lineIndex;
      const endLine = startLine + take;
      const height = carouselFragmentHeight(settings.messageSize, take);
      fragments.push({
        messageIndex: message.messageIndex,
        speaker: message.speaker,
        kind: message.kind,
        lines: message.lines.slice(startLine, endLine),
        continued: startLine > 0,
        continues: endLine < message.lines.length,
        height
      });
      usedHeight += gap + height;
      state.lineIndex = endLine;
      if (state.lineIndex >= message.lines.length) {
        state.messageIndex += 1;
        state.lineIndex = 0;
      } else {
        break;
      }
    }

    return { fragments, state, usedHeight };
  }

  function finalClosingMetrics(ctx, event, preset) {
    const settings = carouselSettings(preset);
    const width = preset.width - settings.margin * 2;
    const landscape = preset.width > preset.height;
    const lastWordSize = landscape ? 23 : 27;
    const lastWordLineHeight = Math.round(lastWordSize * 1.18);
    ctx.font = `900 ${lastWordSize}px Georgia, "Times New Roman", serif`;
    const lastWordLines = wrapLines(ctx, event.meme || "", width);
    const detailSize = landscape ? 16 : 18;
    const detailLineHeight = Math.round(detailSize * 1.28);
    ctx.font = `700 ${detailSize}px Arial, Helvetica, sans-serif`;
    const publisherLines = wrapLines(ctx, sourcePublishers(event).join(" • ") || "Original sources linked in the article", width);
    const urlLines = wrapLines(ctx, eventUrl(event), width);
    const height = 4 + 15 + 21 + lastWordLines.length * lastWordLineHeight + 14 + 20
      + publisherLines.length * detailLineHeight + 10 + urlLines.length * detailLineHeight + 13 + 22;
    return { width, lastWordSize, lastWordLineHeight, lastWordLines, detailSize, detailLineHeight, publisherLines, urlLines, height };
  }

  function drawFinalClosing(ctx, event, preset, top, metrics) {
    const settings = carouselSettings(preset);
    const x = settings.margin;
    let y = top;
    drawRule(ctx, x, y, metrics.width, COLORS.ink, 4);
    y += 15;
    ctx.font = "900 17px Arial, Helvetica, sans-serif";
    ctx.fillStyle = COLORS.red;
    ctx.fillText("LAST WORD", x, y);
    y += 21;
    ctx.font = `900 ${metrics.lastWordSize}px Georgia, "Times New Roman", serif`;
    y = drawTextLines(ctx, metrics.lastWordLines, { x, y, lineHeight: metrics.lastWordLineHeight, fill: COLORS.redDark });
    y += 14;
    ctx.font = `900 ${metrics.detailSize}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("SOURCE PUBLISHERS", x, y);
    y += 20;
    ctx.font = `700 ${metrics.detailSize}px Arial, Helvetica, sans-serif`;
    y = drawTextLines(ctx, metrics.publisherLines, { x, y, lineHeight: metrics.detailLineHeight, fill: COLORS.ink });
    y += 10;
    y = drawTextLines(ctx, metrics.urlLines, { x, y, lineHeight: metrics.detailLineHeight, fill: COLORS.muted });
    y += 13;
    ctx.font = "900 17px Arial, Helvetica, sans-serif";
    ctx.fillStyle = COLORS.red;
    ctx.fillText(DISCLOSURE, x, y);
  }

  function createCarouselPlan(event, format = "feed", suppliedContext = null) {
    const preset = PRESETS[format] || PRESETS.feed;
    const measurementCanvas = suppliedContext ? null : document.createElement("canvas");
    const ctx = suppliedContext || measurementCanvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("This browser could not measure the social carousel.");
    const settings = carouselSettings(preset);
    const contentWidth = preset.width - settings.margin * 2;
    const firstTop = carouselHeader(ctx, event, preset, null, { first: true });
    const middleTop = carouselHeader(ctx, event, preset, null, { first: false });
    const closing = finalClosingMetrics(ctx, event, preset);
    const finalTop = preset.height - settings.bottomMargin - closing.height;
    const messages = prepareCarouselMessages(ctx, event, contentWidth, settings.messageSize);
    if (!messages.length) {
      messages.push({ messageIndex: 0, speaker: "CHAT NOTE", kind: "system", lines: ["No chat messages were supplied for this file."] });
    }

    for (let pageCount = 2; pageCount <= 200; pageCount += 1) {
      let state = { messageIndex: 0, lineIndex: 0 };
      const pages = [];
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const final = pageIndex === pageCount - 1;
        const top = pageIndex === 0 ? firstTop : middleTop;
        const bottom = final ? finalTop : preset.height - settings.bottomMargin;
        const result = takeCarouselFragments(messages, state, Math.max(0, bottom - top), settings, !final);
        pages.push({ top, bottom, fragments: result.fragments, final });
        state = result.state;
      }
      if (messageStateDone(state, messages)) {
        return {
          format,
          preset,
          settings,
          pages,
          closing,
          finalTop,
          messageCount: messages.length,
          renderedLineCount: pages.flatMap((page) => page.fragments).reduce((sum, fragment) => sum + fragment.lines.length, 0),
          sourceLineCount: messages.reduce((sum, message) => sum + message.lines.length, 0)
        };
      }
    }

    throw new Error("The complete chat could not be paginated into the social carousel.");
  }

  function drawCarouselFragment(ctx, fragment, options) {
    const { x, y, width, settings } = options;
    const colors = messageColors(fragment, fragment.messageIndex % 2 === 1);
    fillRoundedRect(ctx, x, y, width, fragment.height, 22, colors.fill, colors.stroke, 2);
    ctx.fillStyle = fragment.kind === "system" ? COLORS.muted : COLORS.red;
    ctx.fillRect(x, y + 15, 8, fragment.height - 30);
    const speakerSize = Math.round(settings.messageSize * 0.72);
    const speakerLineHeight = Math.round(settings.messageSize * 0.82);
    ctx.font = `900 ${speakerSize}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const continuation = fragment.continued ? " (CONTINUED)" : "";
    ctx.fillText(`${fragment.speaker.toUpperCase()}${continuation}`, x + 28, y + 18);
    ctx.font = `500 ${settings.messageSize}px Arial, Helvetica, sans-serif`;
    drawTextLines(ctx, fragment.lines, {
      x: x + 28,
      y: y + 18 + speakerLineHeight + 7,
      lineHeight: Math.round(settings.messageSize * 1.28),
      fill: COLORS.ink
    });
  }

  async function renderSocialCarousel(event, format = "feed") {
    const preset = PRESETS[format] || PRESETS.feed;
    if (document.fonts?.ready) await document.fonts.ready;
    const assets = await loadAssets();
    const plan = createCarouselPlan(event, format);
    const canvases = [];

    for (let pageIndex = 0; pageIndex < plan.pages.length; pageIndex += 1) {
      const page = plan.pages[pageIndex];
      const canvas = document.createElement("canvas");
      canvas.width = preset.width;
      canvas.height = preset.height;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("This browser could not create a social carousel canvas.");
      drawBackground(ctx, preset.width, preset.height, assets.mark);
      carouselHeader(ctx, event, preset, assets, {
        draw: true,
        first: pageIndex === 0,
        pageNumber: pageIndex + 1,
        pageCount: plan.pages.length
      });
      let y = page.top;
      for (const fragment of page.fragments) {
        drawCarouselFragment(ctx, fragment, {
          x: plan.settings.margin,
          y,
          width: preset.width - plan.settings.margin * 2,
          settings: plan.settings
        });
        y += fragment.height + plan.settings.messageGap;
      }
      if (page.final) drawFinalClosing(ctx, event, preset, plan.finalTop, plan.closing);
      canvases.push(canvas);
    }

    return canvases;
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
    const file = typeof File === "function" ? new File([blob], fileName, { type: "image/png" }) : null;
    let canShareFile = false;
    if (file && navigator.share) {
      try {
        canShareFile = !navigator.canShare || navigator.canShare({ files: [file] });
      } catch {
        canShareFile = false;
      }
    }
    if (canShareFile) {
      try {
        await navigator.share({
          title: articleHeadline(event),
          text: "World Leaders Chat — real event, original sources, imagined reactions.",
          files: [file]
        });
        return { blob, fileName, shared: true };
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        console.warn("Native file sharing was unavailable; downloading the PNG instead.", error);
      }
    }
    downloadBlob(blob, fileName);
    return { blob, fileName, shared: false };
  }

  function carouselFileName(event, pageNumber, pageCount) {
    const digits = Math.max(2, String(pageCount).length);
    return `world-leaders-chat-${fileSlug(event)}-${String(pageNumber).padStart(digits, "0")}-of-${String(pageCount).padStart(digits, "0")}.png`;
  }

  async function createCarouselFiles(event, format) {
    const canvases = await renderSocialCarousel(event, format);
    const blobs = await Promise.all(canvases.map((canvas) => canvasBlob(canvas)));
    return blobs.map((blob, index) => {
      const name = carouselFileName(event, index + 1, blobs.length);
      return typeof File === "function" ? new File([blob], name, { type: "image/png" }) : Object.assign(blob, { name });
    });
  }

  let crcTable;
  function getCrcTable() {
    if (crcTable) return crcTable;
    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      crcTable[index] = value >>> 0;
    }
    return crcTable;
  }

  function crc32(bytes) {
    const table = getCrcTable();
    let crc = 0xffffffff;
    for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zipHeader(length) {
    return new Uint8Array(length);
  }

  function setUint16(header, offset, value) {
    new DataView(header.buffer).setUint16(offset, value, true);
  }

  function setUint32(header, offset, value) {
    new DataView(header.buffer).setUint32(offset, value >>> 0, true);
  }

  async function createZip(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;

    for (const file of files) {
      const name = encoder.encode(file.name);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const crc = crc32(bytes);
      const local = zipHeader(30);
      setUint32(local, 0, 0x04034b50);
      setUint16(local, 4, 20);
      setUint16(local, 6, 0x0800);
      setUint16(local, 8, 0);
      setUint32(local, 14, crc);
      setUint32(local, 18, bytes.length);
      setUint32(local, 22, bytes.length);
      setUint16(local, 26, name.length);
      localParts.push(local, name, bytes);

      const central = zipHeader(46);
      setUint32(central, 0, 0x02014b50);
      setUint16(central, 4, 20);
      setUint16(central, 6, 20);
      setUint16(central, 8, 0x0800);
      setUint16(central, 10, 0);
      setUint32(central, 16, crc);
      setUint32(central, 20, bytes.length);
      setUint32(central, 24, bytes.length);
      setUint16(central, 28, name.length);
      setUint32(central, 42, localOffset);
      centralParts.push(central, name);
      localOffset += local.length + name.length + bytes.length;
    }

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = zipHeader(22);
    setUint32(end, 0, 0x06054b50);
    setUint16(end, 8, files.length);
    setUint16(end, 10, files.length);
    setUint32(end, 12, centralSize);
    setUint32(end, 16, localOffset);
    return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
  }

  async function downloadCarouselZip(event, format, files) {
    const zip = await createZip(files);
    const fileName = `world-leaders-chat-${fileSlug(event)}-${format}-carousel.zip`;
    downloadBlob(zip, fileName);
    return { zip, fileName };
  }

  async function saveSocialCarousel(event, format) {
    const files = await createCarouselFiles(event, format);
    const download = await downloadCarouselZip(event, format, files);
    return { files, ...download };
  }

  async function shareSocialCarousel(event, format) {
    const files = await createCarouselFiles(event, format);
    let canShareFiles = false;
    if (navigator.share) {
      try {
        canShareFiles = !navigator.canShare || navigator.canShare({ files });
      } catch {
        canShareFiles = false;
      }
    }
    if (canShareFiles) {
      try {
        await navigator.share({
          title: articleHeadline(event),
          text: "World Leaders Chat carousel — real event, original sources, imagined reactions.",
          files
        });
        return { files, shared: true };
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        console.warn("Multi-file sharing was unavailable; downloading the carousel ZIP instead.", error);
      }
    }
    const download = await downloadCarouselZip(event, format, files);
    return { files, shared: false, ...download };
  }

  function injectStyles() {
    if (document.getElementById("social-png-export-style")) return;
    const style = document.createElement("style");
    style.id = "social-png-export-style";
    style.textContent = `
      .social-export-controls{display:flex;flex-wrap:wrap;gap:7px;align-items:center;width:100%;padding-top:4px}
      .social-export-label{font:900 11px Arial,Helvetica,sans-serif;letter-spacing:.06em;text-transform:uppercase}
      .social-export-controls select{border:2px solid #111;background:#fff;color:#111;min-height:44px;padding:9px 30px 9px 10px;font:900 11px Arial,Helvetica,sans-serif;letter-spacing:.035em;text-transform:uppercase;max-width:100%}
      .social-export-controls .btn{white-space:nowrap;min-height:44px}
      .social-export-note{display:block;width:100%;font:700 10px/1.35 Arial,Helvetica,sans-serif;color:#666;margin-top:1px}
      @media(max-width:800px){.social-export-label{width:100%}.social-export-controls select,.social-export-controls .btn{flex:1 1 100%;width:100%}}
    `;
    document.head.appendChild(style);
  }

  function actionButton(id, label, className, ariaLabel, handler) {
    const button = document.createElement("button");
    button.className = className;
    button.id = id;
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-label", ariaLabel);
    button.addEventListener("click", handler);
    return button;
  }

  async function runExportAction(button, pendingLabel, successLabel, action) {
    const previous = button.textContent;
    button.textContent = pendingLabel;
    button.disabled = true;
    try {
      const result = await action();
      button.textContent = typeof successLabel === "function" ? successLabel(result) : successLabel;
    } catch (error) {
      if (error?.name !== "AbortError") console.error(error);
      button.textContent = error?.name === "AbortError" ? "Share Cancelled" : "Export Failed";
    }
    setTimeout(() => {
      button.textContent = previous;
      button.disabled = false;
    }, 1800);
  }

  function addControls() {
    const actions = document.querySelector(".detail-actions");
    if (!actions || document.getElementById("saveSocialPngBtn")) return;
    injectStyles();

    const wrapper = document.createElement("div");
    wrapper.className = "social-export-controls";
    wrapper.setAttribute("aria-label", "Social image export actions");

    const formatLabel = document.createElement("label");
    formatLabel.className = "social-export-label";
    formatLabel.htmlFor = "socialPngFormat";
    formatLabel.textContent = "Social format";

    const format = document.createElement("select");
    format.id = "socialPngFormat";
    format.setAttribute("aria-label", "Social image format");
    Object.entries(PRESETS).forEach(([value, preset]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = preset.label;
      format.appendChild(option);
    });

    const save = actionButton(
      "saveSocialPngBtn",
      "Save Social PNG",
      "btn red",
      "Save single social PNG",
      () => {
        const event = currentEvent();
        if (event) runExportAction(save, "Rendering PNG…", "PNG Saved ✓", () => saveSocialPng(event, format.value));
      }
    );

    const share = actionButton(
      "shareSocialPngBtn",
      "Share Social PNG",
      "btn",
      "Share single social PNG",
      () => {
        const event = currentEvent();
        if (event) runExportAction(share, "Preparing…", (result) => result.shared ? "Share Ready ✓" : "PNG Saved ✓", () => shareSocialPng(event, format.value));
      }
    );

    const saveCarousel = actionButton(
      "saveSocialCarouselBtn",
      "Save Social Carousel",
      "btn red",
      "Save complete social carousel as a ZIP of PNG slides",
      () => {
        const event = currentEvent();
        if (event) runExportAction(saveCarousel, "Rendering Slides…", "Carousel Saved ✓", () => saveSocialCarousel(event, format.value));
      }
    );

    const shareCarousel = actionButton(
      "shareSocialCarouselBtn",
      "Share Social Carousel",
      "btn",
      "Share all social carousel PNG slides",
      () => {
        const event = currentEvent();
        if (event) runExportAction(
          shareCarousel,
          "Preparing Slides…",
          (result) => result.shared ? "Share Ready ✓" : "Carousel Saved ✓",
          () => shareSocialCarousel(event, format.value)
        );
      }
    );

    wrapper.append(formatLabel, format, save, share, saveCarousel, shareCarousel);
    actions.appendChild(wrapper);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addControls, { once: true });
  else addControls();

  window.WLC_SOCIAL_EXPORT = Object.freeze({
    presets: PRESETS,
    renderSocialCanvas,
    renderSocialCarousel,
    createCarouselPlan,
    createCarouselFiles,
    saveSocialPng,
    shareSocialPng,
    saveSocialCarousel,
    shareSocialCarousel
  });
})();
