import { describe, expect, it } from "vitest";
import { NetlifyBlobsStorage, type BlobStoreLike } from "@/lib/storage";

/** In-memory stand-in with the same semantics as a Netlify Blobs store (onlyIfNew = refuse to overwrite). */
function fakeStore(): BlobStoreLike & { objects: Map<string, ArrayBuffer> } {
  const objects = new Map<string, ArrayBuffer>();
  return {
    objects,
    async set(key, data, options) {
      if (options?.onlyIfNew && objects.has(key)) return { modified: false };
      objects.set(key, data);
      return { modified: true };
    },
    async get(key) {
      return objects.get(key) ?? null;
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}

describe("Netlify Blobs storage driver (same contract as local disk)", () => {
  const key = "b".repeat(32);

  it("stores, streams whole and ranged reads, and deletes", async () => {
    const store = fakeStore();
    const storage = new NetlifyBlobsStorage(store);
    await storage.put(key, Buffer.from("hello world"));

    const whole = await storage.get(key);
    expect(whole?.size).toBe(11);
    expect(await new Response(whole!.stream).text()).toBe("hello world");

    const part = await storage.get(key, { start: 6, end: 10 });
    expect(part?.size).toBe(11); // size is always the whole object's size (used for Content-Range)
    expect(await new Response(part!.stream).text()).toBe("world");

    await storage.delete(key);
    expect(await storage.get(key)).toBeNull();
  });

  it("copies exactly the buffer's bytes even when it is a view into a larger pool", async () => {
    const store = fakeStore();
    const pool = Buffer.from("xxxxPAYLOADyyyy");
    const view = pool.subarray(4, 11); // "PAYLOAD"
    await new NetlifyBlobsStorage(store).put(key, view);
    expect(Buffer.from(store.objects.get(key)!).toString()).toBe("PAYLOAD");
  });

  it("never overwrites an existing object", async () => {
    const storage = new NetlifyBlobsStorage(fakeStore());
    await storage.put(key, Buffer.from("first"));
    await expect(storage.put(key, Buffer.from("second"))).rejects.toThrow(/already exists/);
    expect(await new Response((await storage.get(key))!.stream).text()).toBe("first");
  });

  it("rejects anything that is not a server-generated key (no traversal into other objects)", async () => {
    const storage = new NetlifyBlobsStorage(fakeStore());
    for (const bad of ["../x", "A".repeat(32), "abc", "", "a/b", "a".repeat(33)]) {
      await expect(storage.put(bad, Buffer.from("x")), bad).rejects.toThrow("Invalid storage key");
      await expect(storage.get(bad), bad).rejects.toThrow("Invalid storage key");
      await expect(storage.delete(bad), bad).rejects.toThrow("Invalid storage key");
    }
  });
});
