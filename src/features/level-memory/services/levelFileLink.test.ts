import { describe, expect, it } from "vitest";
import { readIfChanged, relinkFile } from "@/features/level-memory/services/levelFileLink";

interface FakeHandleOptions {
  permission?: PermissionState;
  lastModified?: number;
  text?: string;
  getFileError?: DOMException;
  grantOnRequest?: boolean;
}

const fakeHandle = (options: FakeHandleOptions = {}): FileSystemFileHandle =>
  ({
    kind: "file",
    name: "level.html",
    queryPermission: () => Promise.resolve(options.permission ?? "granted"),
    requestPermission: () => Promise.resolve(options.grantOnRequest ? "granted" : "denied"),
    getFile: () =>
      options.getFileError
        ? Promise.reject(options.getFileError)
        : Promise.resolve(
            new File([options.text ?? "<svg/>"], "level.html", {
              lastModified: options.lastModified ?? 10,
            })
          ),
  }) as unknown as FileSystemFileHandle;

describe("readIfChanged", () => {
  it("should return the new text when the file is newer than the saved copy", async () => {
    const read = await readIfChanged(fakeHandle({ lastModified: 20, text: "<svg id='new'/>" }), 10);
    expect(read).toEqual({
      kind: "changed",
      text: "<svg id='new'/>",
      lastModified: 20,
      fileName: "level.html",
    });
  });

  it("should report unchanged when the file is not newer", async () => {
    expect(await readIfChanged(fakeHandle({ lastModified: 10 }), 10)).toEqual({
      kind: "unchanged",
    });
  });

  it("should ask for a relink when the page has no read permission yet", async () => {
    expect(await readIfChanged(fakeHandle({ permission: "prompt" }), 0)).toEqual({
      kind: "needsPermission",
    });
  });

  it("should report missing when the file was moved or deleted", async () => {
    const gone = new DOMException("gone", "NotFoundError");
    expect(await readIfChanged(fakeHandle({ getFileError: gone }), 0)).toEqual({
      kind: "missing",
    });
  });
});

describe("relinkFile", () => {
  it("should be true only when the user grants read access", async () => {
    expect(await relinkFile(fakeHandle({ grantOnRequest: true }))).toBe(true);
    expect(await relinkFile(fakeHandle({ grantOnRequest: false }))).toBe(false);
  });
});
