import { AbstractGlGraphicsAdaptor, Batcher, GlBatchAdaptor, GlGeometrySystem } from "pixi.js";

/**
 * `?debugBatch=1` (ink-spike diagnosis, temporary): finds the frame where Pixi draws one shape with
 * another shape's (or a stale) vertices, the parked "once-per-game multi-colour ink spike" and
 * the stretched ball of the ball-playground lap. Two layers of checks:
 * - **CPU (the batcher):** a vertex index above 65535 in a 16-bit index buffer; an update into a
 *   slot another element owns or past its own; indices leaving the element's own vertices; NaN or
 *   absurd vertex positions. Covers batched shapes and the unbatched path (Graphics with 400+
 *   vertices draw through their own pooled batcher, the same class).
 * - **GPU (every indexed draw):** reads the drawn index range and the positions it uses back from
 *   the GPU buffers and compares them with the CPU arrays Pixi built (WebGL2). A mismatch means
 *   the GPU drew data that is not what Pixi built this frame.
 * Everything found in one frame is printed as one compact `[debugBatch]` line (at most
 * `MAX_FRAMES`), naming the layer that drew it, so the owner can paste it. Off without the flag:
 * no patch, no cost. With it the game runs slower (GPU read-back each draw).
 */

interface BatchElement {
  _attributeStart: number;
  _indexStart: number;
  attributeSize: number;
  indexSize: number;
  renderable?: LabelledNode | null;
}

interface LabelledNode {
  label?: string;
  parent?: LabelledNode | null;
}

interface PatchedBatcher {
  vertexSize: number;
  attributeBuffer: { float32View: Float32Array };
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

interface PackedElement {
  element: BatchElement;
  buffer: Uint16Array | Uint32Array;
  index: number;
  offset: number;
}

/** Suspect frames printed at most (each one line). */
const MAX_FRAMES = 10;
/** Positions farther than this from the origin (world units) are garbage, not geometry. */
const FAR = 100_000;

/** Calls and sizes seen (read in the console: `window.__debugBatch`). */
const counts = {
  frames: 0,
  draws: 0,
  gpuChecked: 0,
  suspectFrames: 0,
  maxVertex: 0,
  u16AtMax: true,
};

/** What this frame found: one short phrase per finding, and the layers drawing it. */
const frame = { findings: new Map<string, number>(), layers: new Set<string>() };
/** The layer of the draw being executed (set by the adaptors, read by the draw hook). */
let drawing = "?";
/** The batch elements of the draw being executed (to name the shape a bad vertex belongs to). */
let drawElements: readonly BatchElement[] = [];
/** Floats per vertex in the batch layout (DefaultBatcher). */
const BATCH_VERTEX_FLOATS = 6;

/** The layer of the element owning vertex `v` in the current batch draw, else the draw's. */
function ownerOf(v: number): string {
  const owner = drawElements.find((element) => {
    const start = element._attributeStart / BATCH_VERTEX_FLOATS;
    return v >= start && v < start + element.attributeSize;
  });
  return owner ? layerOf(owner.renderable) : drawing;
}

/** "world>physics objects layer>…", the labelled ancestors of a node, nearest last. */
function layerOf(node: LabelledNode | null | undefined): string {
  const names: string[] = [];
  for (let n = node; n && names.length < 3; n = n.parent ?? null) {
    if (n.label) names.unshift(n.label);
  }
  return names.join(">") || "?";
}

function note(finding: string, layer: string): void {
  frame.findings.set(finding, (frame.findings.get(finding) ?? 0) + 1);
  frame.layers.add(layer);
}

/** Prints the last frame's findings as one line, if any, and starts the next frame. */
function flushFrame(): void {
  counts.frames += 1;
  if (frame.findings.size > 0 && counts.suspectFrames < MAX_FRAMES) {
    counts.suspectFrames += 1;
    const found = [...frame.findings].map(([what, n]) => `${what}×${n}`).join(", ");
    console.warn(
      `[debugBatch] frame ${counts.frames}: ${found} | in: ${[...frame.layers].slice(0, 4).join(" ; ")}`
    );
  }
  frame.findings.clear();
  frame.layers.clear();
  requestAnimationFrame(flushFrame);
}

// ── CPU: the batcher ──────────────────────────────────────────────────────────

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

/** Whether any of the element's vertices sits at a NaN or absurd position. */
function hasFarVertex(batcher: PatchedBatcher, at: PackedElement): boolean {
  const f32 = batcher.attributeBuffer.float32View;
  const top = at.offset + at.element.attributeSize;
  for (let v = at.offset; v < top; v += 1) {
    const x = f32[v * batcher.vertexSize] ?? Number.NaN;
    const y = f32[v * batcher.vertexSize + 1] ?? Number.NaN;
    if (!sane(x, y)) return true;
  }
  return false;
}

function checkPacked(batcher: PatchedBatcher, at: PackedElement): void {
  const layer = layerOf(at.element.renderable);
  const top = at.offset + at.element.attributeSize;
  if (top > counts.maxVertex) {
    counts.maxVertex = top;
    counts.u16AtMax = at.buffer instanceof Uint16Array;
  }
  if (at.buffer instanceof Uint16Array && top > 65535) note("cpu index overflow", layer);
  if (indexOutside(at) !== null) note("cpu index outside its shape", layer);
  if (hasFarVertex(batcher, at)) note("cpu far vertex", layer);
}

function patchBatcher(): void {
  const proto = Batcher.prototype as unknown as PatchedBatcher;
  const { begin, add, updateElement, packIndex } = proto;
  proto.begin = function patchedBegin(this: PatchedBatcher) {
    this.__placed = new Map();
    begin.call(this);
  };
  proto.add = function patchedAdd(this: PatchedBatcher, element: BatchElement) {
    add.call(this, element);
    this.__placed?.set(element._attributeStart, { element, attributeSize: element.attributeSize });
  };
  proto.updateElement = function patchedUpdate(this: PatchedBatcher, element: BatchElement) {
    const placed = this.__placed?.get(element._attributeStart);
    const layer = layerOf(element.renderable);
    if (!placed || placed.element !== element) note("cpu stale update", layer);
    else if (placed.attributeSize !== element.attributeSize) note("cpu resized update", layer);
    updateElement.call(this, element);
  };
  proto.packIndex = function patchedPackIndex(
    this: PatchedBatcher,
    ...args: Parameters<PatchedBatcher["packIndex"]>
  ) {
    packIndex.apply(this, args);
    const [element, buffer, index, offset] = args;
    checkPacked(this, { element, buffer, index, offset });
  };
}

// ── GPU: what each indexed draw actually reads ────────────────────────────────

interface PixiBuffer {
  data: Uint16Array | Uint32Array | Float32Array;
}

interface DrawnGeometry {
  indexBuffer?: PixiBuffer;
  attributes: Record<string, { buffer: PixiBuffer; stride?: number; offset?: number }>;
}

interface GeometrySystemLike {
  _activeGeometry: DrawnGeometry | null;
  _renderer: {
    gl: WebGL2RenderingContext;
    buffer: { getGlBuffer(buffer: PixiBuffer): { buffer: WebGLBuffer } };
    context: { webGLVersion: number };
  };
}

/** Reads `count` elements from `offset` (elements) of a GPU buffer into a new array like `like`. */
function readBack<T extends Uint16Array | Uint32Array | Float32Array>(
  sys: GeometrySystemLike,
  from: { buffer: PixiBuffer; like: T; offset: number; count: number }
): T {
  const { gl } = sys._renderer;
  const out = new (from.like.constructor as new (n: number) => T)(from.count);
  gl.bindBuffer(gl.COPY_READ_BUFFER, sys._renderer.buffer.getGlBuffer(from.buffer).buffer);
  gl.getBufferSubData(gl.COPY_READ_BUFFER, from.offset * from.like.BYTES_PER_ELEMENT, out);
  gl.bindBuffer(gl.COPY_READ_BUFFER, null);
  return out;
}

/** Positions (x, y) the GPU holds for vertices `lo…hi` versus the CPU array: mismatches. */
function vertexMismatches(
  sys: GeometrySystemLike,
  position: { buffer: PixiBuffer; stride: number; offset: number },
  range: { lo: number; hi: number }
): { bad: number; first: number } {
  const cpu = position.buffer.data as Float32Array;
  const floats = position.stride / 4;
  const first = range.lo * floats;
  const count = (range.hi - range.lo + 1) * floats;
  if (first + count > cpu.length) return { bad: 1, first: range.lo };
  const gpu = readBack(sys, { buffer: position.buffer, like: cpu, offset: first, count });
  let bad = 0;
  let firstBad = -1;
  const at = position.offset / 4;
  for (let v = 0; v <= range.hi - range.lo; v += 1) {
    const i = v * floats + at;
    if (gpu[i] === cpu[first + i] && gpu[i + 1] === cpu[first + i + 1]) continue;
    bad += 1;
    if (firstBad < 0) firstBad = range.lo + v;
  }
  return { bad, first: firstBad };
}

/** The drawn index range read back from the GPU, and how many differ from the CPU array. */
function indexMismatches(
  sys: GeometrySystemLike,
  drawn: { buffer: PixiBuffer; start: number; size: number }
): { lo: number; hi: number; bad: number } {
  const cpu = drawn.buffer.data as Uint16Array | Uint32Array;
  const gpu = readBack(sys, {
    buffer: drawn.buffer,
    like: cpu,
    offset: drawn.start,
    count: drawn.size,
  });
  let lo = Infinity;
  let hi = -1;
  let bad = 0;
  gpu.forEach((v, i) => {
    if (v !== cpu[drawn.start + i]) bad += 1;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  });
  return { lo, hi, bad };
}

/** Where positions sit in the vertex buffer (the batch layout: 6 floats, x and y first). */
const positionLayout = (position: { buffer: PixiBuffer; stride?: number; offset?: number }) => ({
  buffer: position.buffer,
  stride: position.stride ?? 24,
  offset: position.offset ?? 0,
});

/** Compares the drawn index range and the positions it uses, GPU against CPU. */
function checkDraw(sys: GeometrySystemLike, span: { start: number; size: number }): void {
  const geometry = sys._activeGeometry;
  const position = geometry?.attributes.aPosition;
  const indexBuffer = geometry?.indexBuffer;
  if (!position || !indexBuffer || span.size <= 0) return;
  counts.gpuChecked += 1;
  if (span.start + span.size > indexBuffer.data.length) {
    note("gpu draw past the index array", drawing);
    return;
  }
  const indices = indexMismatches(sys, { buffer: indexBuffer, ...span });
  if (indices.bad > 0) note("gpu stale indices", drawing);
  const where = positionLayout(position);
  const vertices = vertexMismatches(sys, where, indices);
  if (vertices.bad > 0) note("gpu stale vertices", ownerOf(vertices.first));
}

function patchDraws(): void {
  const batchProto = GlBatchAdaptor.prototype as unknown as {
    execute(pipe: unknown, batch: { elements?: BatchElement[] }): void;
  };
  const batchExecute = batchProto.execute;
  batchProto.execute = function patchedBatchExecute(pipe, batch) {
    const layers = new Set((batch.elements ?? []).slice(0, 40).map((e) => layerOf(e.renderable)));
    drawing = `batch[${[...layers].slice(0, 2).join(", ")}${layers.size > 2 ? ", …" : ""}]`;
    drawElements = batch.elements ?? [];
    batchExecute.call(this, pipe, batch);
  };
  const graphicsProto = AbstractGlGraphicsAdaptor.prototype as unknown as {
    execute(pipe: unknown, renderable: LabelledNode): void;
  };
  const graphicsExecute = graphicsProto.execute;
  graphicsProto.execute = function patchedGraphicsExecute(pipe, renderable) {
    drawing = `unbatched[${layerOf(renderable)}]`;
    drawElements = [];
    graphicsExecute.call(this, pipe, renderable);
  };
  const geometryProto = GlGeometrySystem.prototype as unknown as {
    draw(
      this: GeometrySystemLike,
      ...args: [topology: unknown, size?: number, start?: number]
    ): unknown;
  };
  const draw = geometryProto.draw;
  geometryProto.draw = function patchedDraw(
    this: GeometrySystemLike,
    ...args: [topology: unknown, size?: number, start?: number]
  ) {
    const [, size, start] = args;
    counts.draws += 1;
    if (this._renderer.context.webGLVersion === 2 && size) {
      checkDraw(this, { start: start ?? 0, size });
    }
    return draw.apply(this, args);
  };
}

/** Installs the checks when the page was opened with `?debugBatch=1`. */
export function installDebugBatch(): void {
  if (typeof window === "undefined") return;
  if (new URLSearchParams(window.location.search).get("debugBatch") !== "1") return;
  patchBatcher();
  patchDraws();
  (window as unknown as { __debugBatch: typeof counts }).__debugBatch = counts;
  requestAnimationFrame(flushFrame);
  console.warn("[debugBatch] on: a [debugBatch] frame line appears only when a check fails");
}
