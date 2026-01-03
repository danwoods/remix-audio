/** @file Tests for track utility functions */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { getBucketContents } from "../../lib/s3.ts";
import {
  escapeHtml,
  getAllAlbumTracks,
  getParentDataFromTrackUrl,
  getRemainingAlbumTracks,
} from "./track.ts";

// Mock dependencies
vi.mock("../../lib/s3.ts");

// Mock fetch for S3 API calls
const mockFetch = vi.fn();

beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();
  mockFetch.mockClear();

  globalThis.fetch = mockFetch;

  // Mock DOMParser for S3 XML parsing
  globalThis.DOMParser = class DOMParser {
    parseFromString(_xml: string, _type: string) {
      return {
        getElementsByTagName: (tagName: string) => {
          if (tagName === "Contents") {
            return [
              {
                getElementsByTagName: (keyTag: string) => {
                  if (keyTag === "Key") {
                    return [{ textContent: "Artist/Album/1__Track One.mp3" }];
                  }
                  return [];
                },
              },
              {
                getElementsByTagName: (keyTag: string) => {
                  if (keyTag === "Key") {
                    return [{ textContent: "Artist/Album/2__Track Two.mp3" }];
                  }
                  return [];
                },
              },
              {
                getElementsByTagName: (keyTag: string) => {
                  if (keyTag === "Key") {
                    return [{ textContent: "Artist/Album/3__Track Three.mp3" }];
                  }
                  return [];
                },
              },
            ];
          }
          return [];
        },
      } as unknown as Document;
    }
  } as unknown as typeof DOMParser;
});

describe("getParentDataFromTrackUrl", () => {
  test("should parse valid track URL correctly", () => {
    const url =
      "https://bucket.s3.amazonaws.com/Artist/Album/01__Track Name.mp3";
    const result = getParentDataFromTrackUrl(url);

    expect(result.artistName).toBe("Artist");
    expect(result.albumName).toBe("Album");
    expect(result.trackName).toBe("Track Name.mp3");
    expect(result.trackNumber).toBe("01");
  });

  test("should return null values for null input", () => {
    const result = getParentDataFromTrackUrl(null);

    expect(result.artistName).toBeNull();
    expect(result.albumName).toBeNull();
    expect(result.trackName).toBeNull();
    expect(result.trackNumber).toBeNull();
  });

  test("should handle URLs with different formats", () => {
    const url =
      "https://bucket.s3.us-east-1.amazonaws.com/Artist Name/Album Name/05__Song Title.flac";
    const result = getParentDataFromTrackUrl(url);

    expect(result.artistName).toBe("Artist Name");
    expect(result.albumName).toBe("Album Name");
    expect(result.trackName).toBe("Song Title.flac");
    expect(result.trackNumber).toBe("05");
  });

  test("should handle URLs without proper structure", () => {
    const url = "https://example.com/track.mp3";
    expect(() => getParentDataFromTrackUrl(url)).toThrow("Invalid track URL");
  });
});

describe("escapeHtml", () => {
  test("should escape HTML special characters", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;",
    );
  });

  test("should escape ampersand", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  test("should escape quotes", () => {
    expect(escapeHtml('He said "hello"')).toBe("He said &quot;hello&quot;");
  });

  test("should escape single quotes", () => {
    expect(escapeHtml("It's working")).toBe("It&#039;s working");
  });

  test("should escape angle brackets", () => {
    expect(escapeHtml("<div>content</div>")).toBe(
      "&lt;div&gt;content&lt;/div&gt;",
    );
  });

  test("should handle empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  test("should handle string with no special characters", () => {
    expect(escapeHtml("plain text")).toBe("plain text");
  });
});

describe("getRemainingAlbumTracks", () => {
  test("should return remaining tracks after current track", async () => {
    vi.mocked(getBucketContents).mockResolvedValue([
      "Artist/Album/1__Track One.mp3",
      "Artist/Album/2__Track Two.mp3",
      "Artist/Album/3__Track Three.mp3",
    ]);

    const tracks = await getRemainingAlbumTracks(
      "https://bucket.s3.amazonaws.com/Artist/Album",
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
    );

    expect(tracks).toHaveLength(2);
    expect(tracks[0].title).toBe("Track Two.mp3");
    expect(tracks[0].trackNum).toBe(2);
    expect(tracks[1].title).toBe("Track Three.mp3");
    expect(tracks[1].trackNum).toBe(3);
  });

  test("should return empty array if no remaining tracks", async () => {
    vi.mocked(getBucketContents).mockResolvedValue([
      "Artist/Album/1__Track One.mp3",
    ]);

    const tracks = await getRemainingAlbumTracks(
      "https://bucket.s3.amazonaws.com/Artist/Album",
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
    );

    expect(tracks).toHaveLength(0);
  });

  test("should return empty array if artist/album cannot be parsed", async () => {
    const tracks = await getRemainingAlbumTracks(
      "https://bucket.s3.amazonaws.com/Artist/Album",
      "https://bucket.s3.amazonaws.com/invalid",
    );

    expect(tracks).toHaveLength(0);
    expect(getBucketContents).not.toHaveBeenCalled();
  });

  test("should handle S3 API errors", async () => {
    vi.mocked(getBucketContents).mockRejectedValue(
      new Error("S3 API Error"),
    );

    await expect(
      getRemainingAlbumTracks(
        "https://bucket.s3.amazonaws.com/Artist/Album",
        "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
      ),
    ).rejects.toThrow("S3 API Error");
  });

  test("should match tracks with single underscore", async () => {
    vi.mocked(getBucketContents).mockResolvedValue([
      "Artist/Album/1__Track One.mp3",
      "Artist/Album/2__Track Two.mp3",
    ]);

    // Current track uses single underscore (should match double underscore in bucket)
    const tracks = await getRemainingAlbumTracks(
      "https://bucket.s3.amazonaws.com/Artist/Album",
      "https://bucket.s3.amazonaws.com/Artist/Album/1_Track One.mp3",
    );

    expect(tracks).toHaveLength(1);
  });

  test("should match tracks without file extension", async () => {
    vi.mocked(getBucketContents).mockResolvedValue([
      "Artist/Album/1__Track One.mp3",
      "Artist/Album/2__Track Two.mp3",
    ]);

    // Current track without extension
    const tracks = await getRemainingAlbumTracks(
      "https://bucket.s3.amazonaws.com/Artist/Album",
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One",
    );

    expect(tracks).toHaveLength(1);
  });

  test("should handle URL-encoded track names", async () => {
    vi.mocked(getBucketContents).mockResolvedValue([
      "Artist/Album/1__Track%20One.mp3",
      "Artist/Album/2__Track Two.mp3",
    ]);

    const tracks = await getRemainingAlbumTracks(
      "https://bucket.s3.amazonaws.com/Artist/Album",
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
    );

    expect(tracks.length).toBeGreaterThan(0);
  });

  test("should sort tracks by track number", async () => {
    vi.mocked(getBucketContents).mockResolvedValue([
      "Artist/Album/1__Track One.mp3",
      "Artist/Album/2__Track Two.mp3",
      "Artist/Album/3__Track Three.mp3",
    ]);

    const tracks = await getRemainingAlbumTracks(
      "https://bucket.s3.amazonaws.com/Artist/Album",
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
    );

    expect(tracks).toHaveLength(2);
    expect(tracks[0].trackNum).toBeLessThan(tracks[1].trackNum);
  });
});

describe("getAllAlbumTracks", () => {
  test("should return all tracks in album", async () => {
    vi.mocked(getBucketContents).mockResolvedValue([
      "Artist/Album/1__Track One.mp3",
      "Artist/Album/2__Track Two.mp3",
      "Artist/Album/3__Track Three.mp3",
    ]);

    const tracks = await getAllAlbumTracks(
      "https://bucket.s3.amazonaws.com/Artist/Album",
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
    );

    expect(tracks).toHaveLength(3);
    expect(tracks[0].trackNum).toBe(1);
    expect(tracks[1].trackNum).toBe(2);
    expect(tracks[2].trackNum).toBe(3);
  });

  test("should return empty array if artist/album cannot be parsed", async () => {
    const tracks = await getAllAlbumTracks(
      "https://bucket.s3.amazonaws.com/Artist/Album",
      "https://bucket.s3.amazonaws.com/invalid",
    );

    expect(tracks).toHaveLength(0);
    expect(getBucketContents).not.toHaveBeenCalled();
  });

  test("should handle S3 API errors gracefully", async () => {
    vi.mocked(getBucketContents).mockRejectedValue(
      new Error("S3 API Error"),
    );

    const tracks = await getAllAlbumTracks(
      "https://bucket.s3.amazonaws.com/Artist/Album",
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
    );

    expect(tracks).toHaveLength(0);
  });

  test("should sort tracks by track number", async () => {
    vi.mocked(getBucketContents).mockResolvedValue([
      "Artist/Album/3__Track Three.mp3",
      "Artist/Album/1__Track One.mp3",
      "Artist/Album/2__Track Two.mp3",
    ]);

    const tracks = await getAllAlbumTracks(
      "https://bucket.s3.amazonaws.com/Artist/Album",
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
    );

    expect(tracks[0].trackNum).toBe(1);
    expect(tracks[1].trackNum).toBe(2);
    expect(tracks[2].trackNum).toBe(3);
  });

  test("should handle tracks without track numbers", async () => {
    vi.mocked(getBucketContents).mockResolvedValue([
      "Artist/Album/invalid__Track.mp3",
      "Artist/Album/1__Track One.mp3",
    ]);

    const tracks = await getAllAlbumTracks(
      "https://bucket.s3.amazonaws.com/Artist/Album",
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
    );

    // Should still return tracks, with 0 for invalid track numbers
    expect(tracks.length).toBeGreaterThan(0);
  });
});
