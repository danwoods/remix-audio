/* eslint-disable import/no-unresolved */
import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handleAlbum } from "./album.ts";
import { getUploadedFiles } from "../../app/util/s3.server.ts";
import { loadEnv } from "../utils/loadEnv.ts";

Deno.test("Album page renders correctly", async () => {
  // Load environment variables
  await loadEnv();

  // Create a mock request
  const req = new Request(
    "http://localhost:8000/artists/Childish%20Gambino/albums/Poindexter",
  );
  const params = {
    artistId: "Childish Gambino",
    albumId: "Poindexter",
  };

  // Get actual files from S3
  const files = await getUploadedFiles();

  // Check if the album exists in the files
  const albumLookupId = `${params.artistId}/${params.albumId}`;
  console.log(`Looking up album: "${albumLookupId}"`);

  if (files[params.artistId]) {
    console.log(`Artist "${params.artistId}" exists`);
    console.log(`Available albums:`, Object.keys(files[params.artistId]));

    // Check what album IDs would be created
    const actualAlbumIds = Object.keys(files[params.artistId]).map(
      (albumKey) => `${params.artistId}/${albumKey}`,
    );
    console.log(`Actual album IDs for this artist:`, actualAlbumIds);
    console.log(`Looking for: "${albumLookupId}"`);
    console.log(`Match found:`, actualAlbumIds.includes(albumLookupId));
  } else {
    console.log(`Artist "${params.artistId}" NOT found`);
    console.log(`Available artists:`, Object.keys(files).slice(0, 10));
  }

  // Call the handler
  const response = await handleAlbum(req, params);
  const html = await response.text();

  // Check that the response is HTML
  assertEquals(response.headers.get("Content-Type"), "text/html");

  // Check that it doesn't contain "Album not found"
  if (html.includes("Album not found")) {
    console.error("❌ Album page contains 'Album not found'");
    console.error("HTML snippet:", html.substring(0, 500));
    throw new Error("Album page should not contain 'Album not found'");
  }

  // Check that it contains expected content (album title or tracks)
  assertStringIncludes(html, "<html", "Should contain HTML structure");
  console.log("✅ Album page rendered successfully");
});
