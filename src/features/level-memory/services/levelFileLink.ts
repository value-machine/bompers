import type { LinkedRead, PickedFile } from "@/features/level-memory/types/levelMemory.types";

/**
 * The parts of the File System Access API this file uses that TypeScript's DOM lib lacks
 * (Chromium only; Firefox and Safari have none of them). Declared here rather than via
 * `@types/wicg-file-system-access`, a dependency the project does not have.
 */
interface PermissionHandle {
  queryPermission?: (descriptor: { mode: "read" }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: "read" }) => Promise<PermissionState>;
}
interface PickerWindow {
  showOpenFilePicker?: (options: {
    multiple?: boolean;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle[]>;
}

const pickerWindow = (): PickerWindow => window as unknown as PickerWindow;

/** True where a level can stay linked to its file (Chrome, Edge desktop). */
export const canLinkFiles = (): boolean =>
  typeof window !== "undefined" && typeof pickerWindow().showOpenFilePicker === "function";

const LEVEL_FILE_TYPES = [
  {
    description: "Level file",
    accept: { "text/html": [".html", ".htm"], "image/svg+xml": [".svg"] },
  },
];

/** Opens the native picker. Null when the user cancels. */
export async function pickLinkedFile(): Promise<PickedFile | null> {
  const show = pickerWindow().showOpenFilePicker;
  if (!show) return null;
  try {
    const [handle] = await show({ multiple: false, types: LEVEL_FILE_TYPES });
    if (!handle) return null;
    return { file: await handle.getFile(), handle };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  }
}

const permissionOf = (handle: FileSystemFileHandle): PermissionHandle =>
  handle as unknown as PermissionHandle;

/** "granted" without asking; "prompt" after a reload until a click relinks it. */
async function readPermission(handle: FileSystemFileHandle): Promise<PermissionState> {
  const query = permissionOf(handle).queryPermission;
  return query ? query.call(handle, { mode: "read" }) : "granted";
}

/**
 * Reads a linked file if it is newer than `lastModified`. Never asks for permission (that needs
 * a click: `relinkFile`) and never throws.
 */
export async function readIfChanged(
  handle: FileSystemFileHandle,
  lastModified: number
): Promise<LinkedRead> {
  try {
    if ((await readPermission(handle)) !== "granted") return { kind: "needsPermission" };
    const file = await handle.getFile();
    if (file.lastModified <= lastModified) return { kind: "unchanged" };
    return {
      kind: "changed",
      text: await file.text(),
      lastModified: file.lastModified,
      fileName: file.name,
    };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      return { kind: "needsPermission" };
    }
    return { kind: "missing" };
  }
}

/** Asks for read access again (call from a click). True when granted. */
export async function relinkFile(handle: FileSystemFileHandle): Promise<boolean> {
  const request = permissionOf(handle).requestPermission;
  if (!request) return true;
  try {
    return (await request.call(handle, { mode: "read" })) === "granted";
  } catch {
    return false;
  }
}

interface HandleItem {
  getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
}

/**
 * Starts reading the handle of a dropped file. Must be called inside the `drop` handler (the
 * data transfer empties afterwards); resolves to null where the browser gives no handle.
 */
export function droppedFileHandle(
  item: DataTransferItem | undefined
): Promise<FileSystemFileHandle | null> {
  const get = (item as HandleItem | undefined)?.getAsFileSystemHandle;
  if (!item || !get) return Promise.resolve(null);
  return get
    .call(item)
    .then((handle) => (handle?.kind === "file" ? (handle as FileSystemFileHandle) : null))
    .catch(() => null);
}
