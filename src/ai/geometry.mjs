export function transform(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
export function boxRect(x0, y0, x1, y1, width, height, padding = 2) {
  const left = Math.max(0, Math.min(x0, x1) - padding),
    top = Math.max(0, Math.min(y0, y1) - padding);
  const right = Math.min(width, Math.max(x0, x1) + padding),
    bottom = Math.min(height, Math.max(y0, y1) + padding);
  if (right <= left || bottom <= top) return null;
  return {
    x: left / width,
    y: top / height,
    width: (right - left) / width,
    height: (bottom - top) / height,
  };
}
export function textIndex(content, viewport) {
  let text = "";
  const items = [];
  let unsupported = false;
  for (const item of content.items) {
    if (!item.str) continue;
    const style = content.styles[item.fontName] || {};
    if (style.vertical) {
      unsupported = true;
      continue;
    }
    const t = transform(viewport.transform, item.transform),
      font = Math.hypot(t[2], t[3]),
      base = Math.hypot(t[0], t[1]);
    if (!font || !base) {
      unsupported = true;
      continue;
    }
    const advance =
      item.width * Math.hypot(viewport.transform[0], viewport.transform[1]);
    const ux = t[0] / base,
      uy = t[1] / base,
      vx = t[2] / font,
      vy = t[3] / font;
    const ascent = font * Math.max(1, style.ascent || 0.9),
      descent = font * Math.min(-0.25, style.descent || -0.2);
    const points = [0, advance].flatMap((d) =>
      [ascent, descent].map((h) => [
        t[4] + ux * d + vx * h,
        t[5] + uy * d + vy * h,
      ]),
    );
    const rect = boxRect(
      Math.min(...points.map((p) => p[0])),
      Math.min(...points.map((p) => p[1])),
      Math.max(...points.map((p) => p[0])),
      Math.max(...points.map((p) => p[1])),
      viewport.width,
      viewport.height,
    );
    const start = text.length;
    text += item.str;
    items.push({ start, end: text.length, rect, text: item.str });
    text += item.hasEOL ? "\n" : " ";
  }
  return { text, items, unsupported };
}
export function ocrIndex(data, width, height) {
  let text = "";
  const items = [];
  for (const block of data.blocks || [])
    for (const paragraph of block.paragraphs || [])
      for (const line of paragraph.lines || []) {
        for (const word of line.words || []) {
          if (!word.text?.trim()) continue;
          const start = text.length;
          text += word.text;
          const b = word.bbox;
          items.push({
            start,
            end: text.length,
            text: word.text,
            confidence: word.confidence,
            rect: boxRect(b.x0, b.y0, b.x1, b.y1, width, height, 3),
          });
          text += " ";
        }
        text += "\n";
      }
  return { text, items, unsupported: false, ocr: true };
}

// OCR reads an unrotated render. Map its word rectangles back to the displayed
// PDF rotation, avoiding sideways OCR when the PDF has a /Rotate entry.
export function rotateRect(rect, rotation) {
  const { x, y, width: w, height: h } = rect;
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      return { x: 1 - y - h, y: x, width: h, height: w };
    case 180:
      return { x: 1 - x - w, y: 1 - y - h, width: w, height: h };
    case 270:
      return { x: y, y: 1 - x - w, width: h, height: w };
    default:
      return rect;
  }
}
