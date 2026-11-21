import { Batcher } from "pixi.js";

/**
 * `?debugBatch=1` (ink-spike diagnosis, temporary): checks Pixi's shared batcher for the two ways
 * an element can draw with another element's vertices (the parked "once-per-game multi-colour ink
 * spike", the stretched ball of the ball-playground lap) and logs the first few of each as
 * `[debugBatch] …`:
 * - **overflow:** a vertex index above 65535 written into a 16-bit index buffer (it wraps);
 * - **stale update:** `updateElement` on an element that is not the one this batcher placed at
 *   that attribute slot in its current build (a pooled batch piece reused with its old slot), or
 *   whose vertex count changed since it was placed (it writes past its own slot).
 * Off by default: no patch, no cost.
 */

interface BatchElement {
  _attributeStart: number;
  _indexStart: number;
  attributeSize: number;
  indexSize: number;
  renderable?: { label?: string; uid?: number } | null;
}

interface PatchedBatcher {
  vertexSize: number;
  attributeBuffer: { float32View: Float32Array };
  indexBuffer: Uint16Array | Uint32Array;
  add(element: BatchElement): void;
  updateElement(element: BatchElement): void;
  packIndex(
    element: BatchElement,
    buffer: Uint16Array | Uint32Array,
    index: number,
    offset: number
  ): void;
  begin(): void;
  __placed?: Map<number, { element: BatchElement; attributeSize: number }>;
}

const MAX_LOGS = 20;
/** Calls seen per patched method (read from the console: `window.__debugBatch`). */
const counts = { add: 0, update: 0, pack: 0, maxVertex: 0, maxIndexCount: 0, u16AtMax: true };
let logged = 0;

function report(kind: string, detail: Record<string, unknown>): void {
  if (logged >= MAX_LOGS) return;
  logged += 1;

  console.warn(`[debugBatch] ${kind}`, JSON.stringify(detail));
}

const label = (element: BatchElement): string =>
  `${element.renderable?.label ?? "?"}#${element.renderable?.uid ?? "?"}`;

/** Positions farther than this from the origin (world units) are garbage, not geometry. */
const FAR = 100_000;

interface PackedElement {
  element: BatchElement;
  buffer: Uint16Array | Uint32Array;
  index: number;
  offset: number;
}

/** The first index the element wrote outside its own vertices, or null. */
function indexOutside(at: PackedElement): number | null {
  const top = at.offset + at.element.attributeSize;
  for (let i = at.index; i < at.index + at.element.indexSize; i += 1) {
    const v = at.buffer[i] ?? -1;
    if (v < at.offset || v >= top) return v;
  }
  return null;
}

const sane = (x: number, y: number): boolean =>
  Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= FAR && Math.abs(y) <= FAR;

/** The first of the element's vertices at a NaN or absurd position, or null. */
function farVertex(batcher: PatchedBatcher, at: PackedElement): number | null {
  const f32 = batcher.attributeBuffer.float32View;
  const top = at.offset + at.element.attributeSize;
  for (let v = at.offset; v < top; v += 1) {
    const x = f32[v * batcher.vertexSize] ?? Number.NaN;
    const y = f32[v * batcher.vertexSize + 1] ?? Number.NaN;
    if (!sane(x, y)) return v - at.offset;
  }
  return null;
}

/**
 * What the GPU will draw for one element: every index it wrote stays inside its own vertices,
 * and every one of its vertex positions is a finite, sane number.
 */
function checkElement(batcher: PatchedBatcher, at: PackedElement): void {
  const outside = indexOutside(at);
  if (outside !== null) {
    const own = [at.offset, at.offset + at.element.attributeSize];
    report("index outside element", { element: label(at.element), index: outside, own });
    return;
  }
  const far = farVertex(batcher, at);
  if (far !== null) report("far vertex", { element: label(at.element), vertex: far });
}

function patch(): void {
  const proto = Batcher.prototype as unknown as PatchedBatcher;
  const { begin, add, updateElement, packIndex } = proto;
  proto.begin = function patchedBegin(this: PatchedBatcher) {
    this.__placed = new Map();
    begin.call(this);
  };
  proto.add = function patchedAdd(this: PatchedBatcher, element: BatchElement) {
    counts.add += 1;
    add.call(this, element);
    this.__placed?.set(element._attributeStart, { element, attributeSize: element.attributeSize });
  };
  proto.updateElement = function patchedUpdate(this: PatchedBatcher, element: BatchElement) {
    counts.update += 1;
    const placed = this.__placed?.get(element._attributeStart);
    if (!placed || placed.element !== element) {
      report("stale update", {
        element: label(element),
        slot: element._attributeStart,
        owner: placed ? label(placed.element) : "none",
      });
    } else if (placed.attributeSize !== element.attributeSize) {
      report("resized update", {
        element: label(element),
        placedVertices: placed.attributeSize,
        nowVertices: element.attributeSize,
      });
    }
    updateElement.call(this, element);
  };
  proto.packIndex = function patchedPackIndex(
    this: PatchedBatcher,
    ...args: Parameters<PatchedBatcher["packIndex"]>
  ) {
    counts.pack += 1;
    packIndex.apply(this, args);
    const [element, buffer, index, offset] = args;
    checkElement(this, { element, buffer, index, offset });
    const top = offset + element.attributeSize;
    if (top > counts.maxVertex) {
      counts.maxVertex = top;
      counts.u16AtMax = buffer instanceof Uint16Array;
      counts.maxIndexCount = Math.max(counts.maxIndexCount, index + element.indexSize);
    }
    if (buffer instanceof Uint16Array && top > 65535) {
      report("overflow", { element: label(element), topVertex: top });
    }
  };
}

/** Installs the checks when the page was opened with `?debugBatch=1`. */
export function installDebugBatch(): void {
  if (typeof window === "undefined") return;
  if (new URLSearchParams(window.location.search).get("debugBatch") !== "1") return;
  patch();
  (window as unknown as { __debugBatch: typeof counts }).__debugBatch = counts;

  console.warn("[debugBatch] on");
}
