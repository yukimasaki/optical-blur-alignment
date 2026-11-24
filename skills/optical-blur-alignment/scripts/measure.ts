/**
 * Blur the content of an element and measure how far its rounded end is
 * from the concentric center of the container's rounded end.
 * Blurring and centroid measurement happen in the browser with CSS filter and Canvas.
 * See SKILL.md for usage. Requires Node.js 23.6+ (type stripping) or Bun.
 */
import { readFile } from "node:fs/promises";
import { parseArgs as parseCliArgs } from "node:util";
import { chromium } from "playwright";

const DEFAULT_BLUR_RATIO = 0.1;
const DEFAULT_TOLERANCE = 2;
const MIN_INNER_RADIUS = 4;
const EDGE_GUARD = 6;

type Edge = "left" | "right";

type Options = {
  image?: string;
  url?: string;
  selector?: string;
  container?: string;
  hide?: string;
  radius: number;
  paddingX: number;
  paddingY: number;
  edge: Edge;
  tolerance: number;
  blurRatio: number;
  browser?: string;
  output?: string;
  plainOutput?: string;
};

type Blob = { left: number; right: number; top: number; bottom: number };
type RoundEnd = { x: number; y: number };

type Analysis = {
  width: number;
  height: number;
  polarity: "light" | "dark";
  centroidX: number;
  centroidY: number;
  blob: Blob;
};

function blobRoundEnd(blob: Blob, edge: Edge): RoundEnd {
  const radius = Math.min(blob.right - blob.left, blob.bottom - blob.top) / 2;
  return {
    x: edge === "left" ? blob.left + radius : blob.right - radius,
    y: (blob.top + blob.bottom) / 2,
  };
}

type Measurement = {
  input: string;
  edge: Edge;
  size: { width: number; height: number };
  blur: { sigma: number; ratio: number };
  frame: {
    outerRadius: number;
    paddingX: number;
    paddingY: number;
    innerRadius: number;
    usesContainerRoundedEnd: boolean;
  };
  polarity: "light" | "dark";
  blob: { centroidX: number; centroidY: number; left: number; right: number; top: number; bottom: number };
  roundEnd: RoundEnd;
  target: { x: number; y: number };
  offset: { centroidX: number; centroidY: number; edge: number; roundEnd: number };
  aligned: boolean;
  suggestion: {
    translateX: number;
    paddingLeftDelta: number;
    paddingRightDelta: number;
  };
  verificationImage?: string;
  plainImage?: string;
};

type CliValues = Record<string, string | undefined>;

function nonNegative(raw: string | undefined, label: string): number {
  if (raw === undefined) throw new Error(`--${label} is required`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`--${label} must be a non-negative number: ${raw}`);
  return value;
}

function numberValue(values: CliValues, key: string, fallback: number): number {
  const raw = values[key];
  return raw === undefined ? fallback : nonNegative(raw, key);
}

function parseArgs(argv: string[]): Options {
  const { values: parsed } = parseCliArgs({
    args: [...argv],
    options: {
      image: { type: "string" },
      url: { type: "string" },
      selector: { type: "string" },
      container: { type: "string" },
      hide: { type: "string" },
      radius: { type: "string" },
      padding: { type: "string" },
      "padding-x": { type: "string" },
      "padding-y": { type: "string" },
      edge: { type: "string" },
      tolerance: { type: "string" },
      "blur-ratio": { type: "string" },
      browser: { type: "string" },
      output: { type: "string" },
      "plain-output": { type: "string" },
    },
  });
  const values = parsed as CliValues;
  const image = values.image;
  const url = values.url;
  const selector = values.selector;
  if (!image && !url) throw new Error("either --image or --url is required");
  if (image && url) throw new Error("--image and --url cannot be used together");
  if (url && !selector && !values.container) {
    throw new Error("--selector or --container is required with --url");
  }
  const edge = values.edge ?? "left";
  if (edge !== "left" && edge !== "right") throw new Error("--edge must be left or right");
  return {
    image,
    url,
    selector,
    container: values.container,
    hide: values.hide,
    radius: nonNegative(values.radius, "radius"),
    paddingX: nonNegative(values["padding-x"] ?? values.padding, "padding-x"),
    paddingY: nonNegative(values["padding-y"] ?? values.padding, "padding-y"),
    edge,
    tolerance: numberValue(values, "tolerance", DEFAULT_TOLERANCE),
    blurRatio: numberValue(values, "blur-ratio", DEFAULT_BLUR_RATIO),
    browser: values.browser ?? process.env.OPTICAL_BLUR_BROWSER,
    output: values.output,
    plainOutput: values["plain-output"],
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function frameSvg(m: Measurement, color: string): string {
  const { width, height } = m.size;
  const { paddingX, paddingY, innerRadius } = m.frame;
  const { x, y } = m.target;
  const { centroidX, centroidY } = m.blob;
  const { x: roundEndX, y: roundEndY } = m.roundEnd;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="${paddingX}" y="${paddingY}" width="${Math.max(0, width - 2 * paddingX)}" height="${Math.max(0, height - 2 * paddingY)}" rx="${Math.max(0, innerRadius)}" fill="none" stroke="${color}" stroke-width="2" />
  <line x1="${x - 9}" y1="${y}" x2="${x + 9}" y2="${y}" stroke="${color}" stroke-width="2" />
  <line x1="${x}" y1="${y - 9}" x2="${x}" y2="${y + 9}" stroke="${color}" stroke-width="2" />
  <line x1="${x}" y1="${y}" x2="${roundEndX}" y2="${roundEndY}" stroke="${color}" stroke-width="1.5" stroke-dasharray="4 3" />
  <circle cx="${roundEndX}" cy="${roundEndY}" r="4" fill="#fb923c" stroke="#111827" stroke-width="1" />
  <circle cx="${centroidX}" cy="${centroidY}" r="2.5" fill="#facc15" />
</svg>`;
}

type AnalyzeParams = {
  originalUrl: string;
  blurredUrl: string;
  paddingX: number;
  paddingY: number;
  innerRadius: number;
  outerRadius: number;
  useContainerRoundedEnd: boolean;
  edgeGuard: number;
};

async function analyze(page: import("playwright").Page, params: AnalyzeParams): Promise<Analysis> {
  return page.evaluate(async (params) => {
    const { originalUrl, blurredUrl, paddingX, paddingY, innerRadius, outerRadius, useContainerRoundedEnd, edgeGuard } = params;
    const load = async (url: string) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Could not get a 2D canvas context");
      context.drawImage(image, 0, 0);
      return { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
    };
    const luminance = (data: Uint8ClampedArray, index: number) =>
      (data[index]! * 0.299 + data[index + 1]! * 0.587 + data[index + 2]! * 0.114);

    const [original, blurred] = await Promise.all([load(originalUrl), load(blurredUrl)]);
    const { width, height } = original;
    const frameWidth = Math.max(0, width - 2 * paddingX);
    const frameHeight = Math.max(0, height - 2 * paddingY);
    const contains = (x: number, y: number, left: number, top: number, w: number, h: number, radius: number) => {
      const ix = x - left;
      const iy = y - top;
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) return false;
      const nearestX = Math.min(Math.max(ix, radius), Math.max(radius, w - radius));
      const nearestY = Math.min(Math.max(iy, radius), Math.max(radius, h - radius));
      return (ix - nearestX) ** 2 + (iy - nearestY) ** 2 <= radius ** 2;
    };
    const insideFrame = (x: number, y: number) =>
      innerRadius > 0 && contains(x, y, paddingX, paddingY, frameWidth, frameHeight, innerRadius);
    const insideContainer = (x: number, y: number) => contains(x, y, 0, 0, width, height, outerRadius);
    const guard = Math.min(edgeGuard, Math.max(1, Math.floor((Math.min(width, height) - 1) / 2)));
    const insideGuarded = (x: number, y: number) => contains(
      x, y, guard, guard,
      Math.max(0, width - 2 * guard), Math.max(0, height - 2 * guard),
      Math.max(0, outerRadius - guard),
    );
    const insideSearch = useContainerRoundedEnd
      ? insideGuarded
      : (x: number, y: number) => contains(
          x, y, Math.max(0, paddingX - 2), Math.max(0, paddingY - 2),
          Math.min(width, frameWidth + 4), Math.min(height, frameHeight + 4),
          innerRadius + 2,
        );

    const histogram = new Array<number>(256).fill(0);
    let originalMin = 255;
    let originalMax = 0;
    let blurredMin = 255;
    let blurredMax = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const before = luminance(original.data, index);
        const guarded = insideGuarded(x, y);
        if (insideContainer(x, y) && (useContainerRoundedEnd ? !guarded : !insideFrame(x, y))) {
          histogram[Math.round(before)]! += 1;
        }
        if (useContainerRoundedEnd ? guarded : insideSearch(x, y)) {
          const after = luminance(blurred.data, index);
          if (before < originalMin) originalMin = before;
          if (before > originalMax) originalMax = before;
          if (after < blurredMin) blurredMin = after;
          if (after > blurredMax) blurredMax = after;
        }
      }
    }
    let background = 0;
    let backgroundCount = 0;
    for (let level = 0; level < 256; level += 1) {
      let count = 0;
      for (let offset = -2; offset <= 2; offset += 1) {
        const neighbor = level + offset;
        if (neighbor >= 0 && neighbor < 256) count += histogram[neighbor]!;
      }
      if (count > backgroundCount) {
        backgroundCount = count;
        background = level;
      }
    }
    if (backgroundCount === 0) {
      throw new Error("Could not read the container background. Check --radius and padding.");
    }
    const polarity: "light" | "dark" = originalMax - background >= background - originalMin ? "light" : "dark";
    const threshold = polarity === "light"
      ? background + (blurredMax - background) / 2
      : background - (background - blurredMin) / 2;

    let total = 0;
    let sumX = 0;
    let sumY = 0;
    let left = width;
    let right = 0;
    let top = height;
    let bottom = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!insideSearch(x, y)) continue;
        const value = luminance(blurred.data, (y * width + x) * 4);
        const weight = polarity === "light"
          ? Math.max(0, value - threshold)
          : Math.max(0, threshold - value);
        if (weight <= 0) continue;
        total += weight;
        sumX += x * weight;
        sumY += y * weight;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
    if (total === 0) throw new Error("Could not detect the content blob in the blurred image");

    return {
      width,
      height,
      polarity,
      centroidX: sumX / total,
      centroidY: sumY / total,
      blob: { left, right, top, bottom },
    };
  }, params);
}

async function measure(options: Options): Promise<Measurement> {
  const browser = await chromium.launch(options.browser ? { executablePath: options.browser } : {});
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const input = options.image ?? options.url!;

    if (options.image) {
      const bytes = await readFile(options.image);
      const base64 = bytes.toString("base64");
      await page.setContent(`<style>html,body{margin:0;background:#ffffff}</style><img id="target" src="data:image/png;base64,${base64}">`);
      await page.locator("#target").evaluate(async (element) => {
        await (element as HTMLImageElement).decode();
      });
    } else {
      await page.goto(options.url!);
    }

    const container = options.image
      ? page.locator("#target").first()
      : options.container
        ? page.locator(options.container).first()
        : page.locator(options.selector!).first().locator("xpath=..");
    await container.scrollIntoViewIfNeeded();
    const box = await container.boundingBox();
    if (!box) throw new Error("Could not get the container size");
    const clip = {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
    if (clip.width < 2 || clip.height < 2) throw new Error("The container is too small");
    if (options.radius > clip.width / 2 || options.radius > clip.height / 2) {
      throw new Error(`--radius must be at most half the shorter side of the container (container ${clip.width}x${clip.height}, radius ${options.radius})`);
    }
    const rawInnerRadius = options.radius - options.paddingY;
    const useContainerRoundedEnd = rawInnerRadius < MIN_INNER_RADIUS;
    const innerRadius = Math.max(0, rawInnerRadius);
    if (!useContainerRoundedEnd && (
      innerRadius > (clip.width - 2 * options.paddingX) / 2
      || innerRadius > (clip.height - 2 * options.paddingY) / 2
    )) {
      throw new Error("The inner radius exceeds the inner frame size. Check --radius and padding.");
    }

    const sigma = round(clip.height * options.blurRatio);
    const original = options.plainOutput
      ? await page.screenshot({ clip, path: options.plainOutput })
      : await page.screenshot({ clip });
    const originalUrl = `data:image/png;base64,${original.toString("base64")}`;

    let blurredUrl: string;
    if (options.image) {
      blurredUrl = await page.evaluate(async ({ url, sigma }) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not get a 2D canvas context");
        context.filter = `blur(${sigma}px)`;
        context.drawImage(image, 0, 0);
        return canvas.toDataURL("image/png");
      }, { url: originalUrl, sigma });
    } else {
      await container.evaluate((element, { selector, hide }) => {
        const host = element as HTMLElement;
        const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
        const textNodes: Text[] = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
        for (const node of textNodes) {
          if (!node.textContent?.trim()) continue;
          const span = document.createElement("span");
          span.className = "optical-blur-text-node";
          node.replaceWith(span);
          span.appendChild(node);
        }
        const chosen = selector ? host.querySelector(selector) : null;
        const hidden = hide ? host.querySelector(hide) : null;
        const targets: Element[] = [];
        const toHide = new Set<Element>();
        if (chosen) {
          targets.push(chosen);
          let cursor: Element = chosen;
          while (cursor.parentElement && cursor.parentElement !== host) {
            const parent = cursor.parentElement;
            for (const sibling of Array.from(parent.children)) {
              if (sibling !== cursor) toHide.add(sibling);
            }
            cursor = parent;
          }
          for (const child of Array.from(host.children)) {
            if (child !== cursor) toHide.add(child);
          }
        } else {
          for (const child of Array.from(host.children)) {
            if (child !== hidden) targets.push(child);
          }
        }
        if (hidden && hidden !== chosen) toHide.add(hidden);
        for (const target of targets) toHide.delete(target);
        if (targets.length === 0) throw new Error("No content element left to measure");
        for (const element of toHide) (element as HTMLElement).style.visibility = "hidden";
        for (const target of targets) target.setAttribute("data-optical-blur-target", "");
      }, { selector: options.selector ?? null, hide: options.hide ?? null });
      await page.locator("[data-optical-blur-target]").evaluateAll((elements, value) => {
        for (const element of elements) (element as HTMLElement).style.filter = `blur(${value}px)`;
      }, sigma);
      blurredUrl = `data:image/png;base64,${(await page.screenshot({ clip })).toString("base64")}`;
    }

    const analysis = await analyze(page, {
      originalUrl,
      blurredUrl,
      paddingX: options.paddingX,
      paddingY: options.paddingY,
      innerRadius,
      outerRadius: options.radius,
      useContainerRoundedEnd,
      edgeGuard: EDGE_GUARD,
    });

    const target = {
      x: options.edge === "left" ? options.radius : analysis.width - options.radius,
      y: analysis.height / 2,
    };
    const roundEnd = blobRoundEnd(analysis.blob, options.edge);
    const roundEndOffset = roundEnd.x - target.x;
    const translateX = round(-roundEndOffset);
    const aligned = Math.abs(roundEndOffset) <= options.tolerance
      && Math.abs(analysis.centroidY - target.y) <= options.tolerance;

    const result: Measurement = {
      input,
      edge: options.edge,
      size: { width: analysis.width, height: analysis.height },
      blur: { sigma, ratio: options.blurRatio },
      frame: {
        outerRadius: options.radius,
        paddingX: options.paddingX,
        paddingY: options.paddingY,
        innerRadius: round(innerRadius),
        usesContainerRoundedEnd: useContainerRoundedEnd,
      },
      polarity: analysis.polarity,
      blob: {
        centroidX: round(analysis.centroidX),
        centroidY: round(analysis.centroidY),
        ...analysis.blob,
      },
      roundEnd: { x: round(roundEnd.x), y: round(roundEnd.y) },
      target: { x: round(target.x), y: round(target.y) },
      offset: {
        centroidX: round(analysis.centroidX - target.x),
        centroidY: round(analysis.centroidY - target.y),
        edge: round((options.edge === "left" ? analysis.blob.left : analysis.blob.right) - target.x),
        roundEnd: round(roundEndOffset),
      },
      aligned,
      suggestion: {
        translateX,
        paddingLeftDelta: translateX,
        paddingRightDelta: -translateX,
      },
    };

    if (options.output) {
      const color = aligned ? "#22c55e" : "#38bdf8";
      await page.evaluate(({ markup, x, y }) => {
        const holder = document.createElement("div");
        holder.id = "optical-blur-overlay";
        holder.style.cssText = `position:fixed;left:${x}px;top:${y}px;pointer-events:none;z-index:2147483647`;
        holder.innerHTML = markup;
        document.body.appendChild(holder);
      }, { markup: frameSvg(result, color), x: clip.x, y: clip.y });
      await page.screenshot({ clip, path: options.output });
      result.verificationImage = options.output;
    }
    if (options.plainOutput) result.plainImage = options.plainOutput;
    return result;
  } finally {
    await browser.close();
  }
}

try {
  const options = parseArgs(process.argv.slice(2));
  console.log(JSON.stringify(await measure(options), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
