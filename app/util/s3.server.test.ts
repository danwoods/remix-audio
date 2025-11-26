import { describe, it, beforeEach, expect, vi } from "vitest";

// Mock the ID3 module
vi.mock("./id3", () => ({
  getID3Tags: vi.fn().mockResolvedValue({
    artist: "Test Artist",
    album: "Test Album",
    title: "Test Song",
    trackNumber: 1,
    image: "data:image/jpeg;base64,/9j/4AAQSkZJRg==", // mock base64 image data
  }),
}));

// Create mock S3Client send function
const mockSend = vi.fn();

// Setup initial mocks
vi.mock("@aws-sdk/client-s3", async () => {
  const actual = await vi.importActual("@aws-sdk/client-s3");
  return {
    ...actual,
    S3Client: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
  };
});

// Now import the module that depends on the mocked modules
import { s3UploadHandler } from "./s3.server";
import { getID3Tags } from "./id3";

// Mock environment variables
vi.stubEnv("AWS_ACCESS_KEY_ID", "test-key");
vi.stubEnv("AWS_SECRET_ACCESS_KEY", "test-secret");
vi.stubEnv("STORAGE_REGION", "test-region");
vi.stubEnv("STORAGE_BUCKET", "test-bucket");

describe("s3UploadHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup S3 mocks - default: headObject fails with NotFound, putObject succeeds
    mockSend.mockImplementation((command) => {
      const commandName = command.constructor.name;

      if (commandName === "HeadObjectCommand") {
        const error = new Error("NotFound");
        (error as { name: string }).name = "NotFound";
        return Promise.reject(error);
      }

      if (commandName === "PutObjectCommand") {
        return Promise.resolve({});
      }

      // For upload stream (PutObjectCommand for audio file)
      return Promise.resolve({});
    });
  });

  it("should handle file upload with cover image", async () => {
    // Create mock file upload data
    const mockData = [new Uint8Array([1, 2, 3])];
    const mockUploadHandlerParams = {
      name: "files",
      contentType: "audio/mpeg",
      data: (async function* () {
        for (const chunk of mockData) {
          yield chunk;
        }
      })(),
    };

    // Execute handler
    const result = await s3UploadHandler(mockUploadHandlerParams);

    // Verify cover image check was performed (HeadObjectCommand)
    const headObjectCalls = mockSend.mock.calls.filter(
      (call) => call[0].constructor.name === "HeadObjectCommand",
    );
    expect(headObjectCalls).toHaveLength(1);
    expect(headObjectCalls[0][0].input).toMatchObject({
      Bucket: "test-bucket",
      Key: "Test Artist/Test Album/cover.jpeg",
    });

    // Verify cover image was uploaded (since headObject returned NotFound)
    const putObjectCalls = mockSend.mock.calls.filter(
      (call) =>
        call[0].constructor.name === "PutObjectCommand" &&
        call[0].input.Key === "Test Artist/Test Album/cover.jpeg",
    );
    expect(putObjectCalls).toHaveLength(1);
    expect(putObjectCalls[0][0].input).toMatchObject({
      Key: "Test Artist/Test Album/cover.jpeg",
      ContentType: "image/jpeg",
    });
    expect(putObjectCalls[0][0].input.Body).toBeInstanceOf(Buffer);

    // Verify audio file was uploaded (PutObjectCommand for audio)
    const audioUploadCalls = mockSend.mock.calls.filter(
      (call) =>
        call[0].constructor.name === "PutObjectCommand" &&
        call[0].input.Key === "Test Artist/Test Album/1__Test Song",
    );
    expect(audioUploadCalls).toHaveLength(1);
    expect(audioUploadCalls[0][0].input).toMatchObject({
      Key: "Test Artist/Test Album/1__Test Song",
    });

    // Verify return value contains the expected URL pattern
    expect(result).toContain(
      "test-bucket.s3.test-region.amazonaws.com/Test Artist/Test Album/1__Test Song",
    );
  });

  it("should skip cover image upload if it already exists", async () => {
    // Override mockSend to return success for HeadObjectCommand
    mockSend.mockImplementation((command) => {
      const commandName = command.constructor.name;

      if (commandName === "HeadObjectCommand") {
        return Promise.resolve({});
      }

      if (commandName === "PutObjectCommand") {
        return Promise.resolve({});
      }

      return Promise.resolve({});
    });

    const mockData = [new Uint8Array([1, 2, 3])];
    const mockUploadHandlerParams = {
      name: "files",
      contentType: "audio/mpeg",
      data: (async function* () {
        for (const chunk of mockData) {
          yield chunk;
        }
      })(),
    };

    await s3UploadHandler(mockUploadHandlerParams);

    const headObjectCalls = mockSend.mock.calls.filter(
      (call) => call[0].constructor.name === "HeadObjectCommand",
    );
    expect(headObjectCalls).toHaveLength(1);

    const coverPutCalls = mockSend.mock.calls.filter(
      (call) =>
        call[0].constructor.name === "PutObjectCommand" &&
        call[0].input.Key === "Test Artist/Test Album/cover.jpeg",
    );
    expect(coverPutCalls).toHaveLength(0);

    const audioUploadCalls = mockSend.mock.calls.filter(
      (call) =>
        call[0].constructor.name === "PutObjectCommand" &&
        call[0].input.Key === "Test Artist/Test Album/1__Test Song",
    );
    expect(audioUploadCalls).toHaveLength(1);
  });

  it("should handle files without cover images", async () => {
    // Override getID3Tags to return no image
    vi.mocked(getID3Tags).mockResolvedValueOnce({
      artist: "Test Artist",
      album: "Test Album",
      title: "Test Song",
      trackNumber: 1,
    });

    const mockData = [new Uint8Array([1, 2, 3])];
    const mockUploadHandlerParams = {
      name: "files",
      contentType: "audio/mpeg",
      data: (async function* () {
        for (const chunk of mockData) {
          yield chunk;
        }
      })(),
    };

    await s3UploadHandler(mockUploadHandlerParams);

    const headObjectCalls = mockSend.mock.calls.filter(
      (call) => call[0].constructor.name === "HeadObjectCommand",
    );
    expect(headObjectCalls).toHaveLength(0);

    const coverPutCalls = mockSend.mock.calls.filter(
      (call) =>
        call[0].constructor.name === "PutObjectCommand" &&
        call[0].input.Key === "Test Artist/Test Album/cover.jpeg",
    );
    expect(coverPutCalls).toHaveLength(0);

    const audioUploadCalls = mockSend.mock.calls.filter(
      (call) =>
        call[0].constructor.name === "PutObjectCommand" &&
        call[0].input.Key === "Test Artist/Test Album/1__Test Song",
    );
    expect(audioUploadCalls).toHaveLength(1);
    expect(audioUploadCalls[0][0].input).toMatchObject({
      Key: "Test Artist/Test Album/1__Test Song",
    });
  });
});
