/** @file Tests for custom router */
import { assertEquals } from "@std/assert";
import { Router } from "../../server/router.ts";

Deno.test("Router matches static routes", async () => {
  const router = new Router();
  let called = false;

  router.add({
    pattern: "/",
    handler: () => {
      called = true;
      return new Response("OK");
    },
  });

  const req = new Request("http://localhost:8000/");
  const response = await router.handle(req);

  assertEquals(called, true);
  assertEquals(response.status, 200);
});

Deno.test("Router matches dynamic routes", async () => {
  const router = new Router();
  let capturedParams: Record<string, string> = {};

  router.add({
    pattern: "/artists/:artistId/albums/:albumId",
    handler: (_req, params) => {
      capturedParams = params;
      return new Response("OK");
    },
  });

  const req = new Request(
    "http://localhost:8000/artists/TestArtist/albums/TestAlbum",
  );
  await router.handle(req);

  assertEquals(capturedParams.artistId, "TestArtist");
  assertEquals(capturedParams.albumId, "TestAlbum");
});

Deno.test("Router returns 404 for unmatched routes", async () => {
  const router = new Router();

  router.add({
    pattern: "/",
    handler: () => new Response("OK"),
  });

  const req = new Request("http://localhost:8000/unknown");
  const response = await router.handle(req);

  assertEquals(response.status, 404);
});

Deno.test("Router matches cover route before album route", async () => {
  const router = new Router();
  let coverCalled = false;
  let albumCalled = false;

  router.add({
    pattern: "/artists/:artistId/albums/:albumId/cover",
    handler: (_req, _params) => {
      coverCalled = true;
      return new Response("cover", {
        headers: { "Content-Type": "image/jpeg" },
      });
    },
  });
  router.add({
    pattern: "/artists/:artistId/albums/:albumId",
    handler: () => {
      albumCalled = true;
      return new Response("album");
    },
  });

  const coverReq = new Request(
    "http://localhost:8000/artists/A/albums/B/cover",
  );
  const coverRes = await router.handle(coverReq);
  assertEquals(coverRes.status, 200);
  assertEquals(await coverRes.text(), "cover");
  assertEquals(coverCalled, true);
  assertEquals(albumCalled, false);

  const albumReq = new Request("http://localhost:8000/artists/A/albums/B");
  const albumRes = await router.handle(albumReq);
  assertEquals(albumRes.status, 200);
  assertEquals(await albumRes.text(), "album");
  assertEquals(albumCalled, true);
});

Deno.test("Router respects HTTP methods", async () => {
  const router = new Router();
  let getCalled = false;
  let postCalled = false;

  router.add({
    pattern: "/",
    method: "GET",
    handler: () => {
      getCalled = true;
      return new Response("GET");
    },
  });

  router.add({
    pattern: "/",
    method: "POST",
    handler: () => {
      postCalled = true;
      return new Response("POST");
    },
  });

  const getReq = new Request("http://localhost:8000/", { method: "GET" });
  await router.handle(getReq);
  assertEquals(getCalled, true);
  assertEquals(postCalled, false);

  getCalled = false;
  postCalled = false;

  const postReq = new Request("http://localhost:8000/", { method: "POST" });
  await router.handle(postReq);
  assertEquals(getCalled, false);
  assertEquals(postCalled, true);
});

Deno.test("Router matches album JSON route before album HTML route", async () => {
  const router = new Router();
  let jsonCalled = false;
  let albumCalled = false;

  router.add({
    pattern: "/artists/:artistId/albums/:albumId/_json",
    handler: () => {
      jsonCalled = true;
      return new Response("json");
    },
  });
  router.add({
    pattern: "/artists/:artistId/albums/:albumId",
    handler: () => {
      albumCalled = true;
      return new Response("album");
    },
  });

  const req = new Request("http://localhost:8000/artists/A/albums/B/_json");
  const response = await router.handle(req);
  assertEquals(response.status, 200);
  assertEquals(await response.text(), "json");
  assertEquals(jsonCalled, true);
  assertEquals(albumCalled, false);
});
