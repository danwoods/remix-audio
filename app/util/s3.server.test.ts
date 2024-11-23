import { describe, it, beforeEach, expect, vi } from "vitest";
import AWS from "aws-sdk";

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

// Create mock S3 instances
const mockS3Instance = {
  headObject: vi.fn(),
  putObject: vi.fn(),
  upload: vi.fn(),
};

// Setup initial mocks
vi.spyOn(AWS, "S3").mockImplementation(
  () => mockS3Instance as unknown as AWS.S3,
);

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

    // Setup S3 mocks
    mockS3Instance.headObject.mockImplementation(() => ({
      promise: () => Promise.reject({ code: "NotFound" }),
    }));

    mockS3Instance.putObject.mockImplementation(() => ({
      promise: () => Promise.resolve({}),
    }));

    mockS3Instance.upload.mockImplementation(() => ({
      promise: () => Promise.resolve({ Location: "https://test-url.com/file" }),
    }));
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

    // Verify cover image check was performed
    expect(mockS3Instance.headObject).toHaveBeenCalledTimes(1);
    expect(mockS3Instance.headObject).toHaveBeenCalledWith({
      Bucket: "test-bucket",
      Key: "Test Artist/Test Album/cover.jpeg",
    });

    // Verify cover image was uploaded (since headObject returned NotFound)
    expect(mockS3Instance.putObject).toHaveBeenCalledTimes(1);
    expect(mockS3Instance.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: "Test Artist/Test Album/cover.jpeg",
        Body: expect.any(Buffer),
        ContentType: "image/jpeg",
      }),
    );

    // Verify audio file was uploaded
    expect(mockS3Instance.upload).toHaveBeenCalledTimes(1);
    expect(mockS3Instance.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: "Test Artist/Test Album/1__Test Song",
      }),
    );

    // Verify return value
    expect(result).toBe("https://test-url.com/file");
  });

  it("should skip cover image upload if it already exists", async () => {
    // Override headObject implementation for this test
    mockS3Instance.headObject.mockImplementation(() => ({
      promise: () => Promise.resolve({}),
    }));

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

    expect(mockS3Instance.headObject).toHaveBeenCalledTimes(1);
    expect(mockS3Instance.putObject).not.toHaveBeenCalled();
    expect(mockS3Instance.upload).toHaveBeenCalledTimes(1);
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

    expect(mockS3Instance.headObject).not.toHaveBeenCalled();
    expect(mockS3Instance.putObject).not.toHaveBeenCalled();
    expect(mockS3Instance.upload).toHaveBeenCalledTimes(1);
    expect(mockS3Instance.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: "Test Artist/Test Album/1__Test Song",
      }),
    );
  });
});
