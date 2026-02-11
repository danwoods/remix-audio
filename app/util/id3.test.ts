/** @file Tests for getID3Tags (ID3 metadata extraction) */
import { assert, assertEquals } from "@std/assert";
import { getID3Tags } from "./id3.ts";
import { getID3TagsFromFile } from "./id3.browser.ts";

const testMp3Url = new URL("../../test_data/test.mp3", import.meta.url);

Deno.test("getID3Tags - mp3", async () => {
  const file = await Deno.readFile(testMp3Url);
  const tags = await getID3Tags(file);

  assertEquals(tags.artist, "SoMe Band4");
  assertEquals(tags.album, "Test");
  assertEquals(tags.title, "test");
  assertEquals(tags.trackNumber, 5);
  assert(
    typeof tags.image === "string" &&
      tags.image.startsWith("data:image/jpeg;base64,") &&
      tags.image.length > 100,
    "image should be a data URL with base64 JPEG data",
  );
});

Deno.test("getID3TagsFromFile - returns null in non-browser environment", async () => {
  const file = new File(["not audio"], "fake.mp3", { type: "audio/mpeg" });
  const result = await getID3TagsFromFile(file);
  assertEquals(result, null);
});
