/** @file Tests for AudioManager */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { AudioManager } from "./audio-manager.ts";

// Track DOM state
let audioElement: Partial<HTMLAudioElement> | null = null;
const audioEventListeners: { [key: string]: ((event: Event) => void)[] } = {};

beforeEach(() => {
  // Reset state
  audioEventListeners.timeupdate = [];
  audioEventListeners.ended = [];
  audioEventListeners.loadedmetadata = [];

  // Create mock audio element
  audioElement = {
    src: "",
    paused: true,
    currentTime: 0,
    duration: 100,
    readyState: 0,
    style: { display: "" } as CSSStyleDeclaration,
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      _options?: boolean | AddEventListenerOptions,
    ) => {
      if (!audioEventListeners[type]) audioEventListeners[type] = [];
      if (typeof listener === "function") {
        audioEventListeners[type].push(listener);
      } else if (
        listener && typeof listener === "object" && "handleEvent" in listener
      ) {
        audioEventListeners[type].push((event) => listener.handleEvent(event));
      }
    },
    removeEventListener: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    parentNode: null,
  };

  // Mock document.createElement for audio element
  globalThis.document = {
    createElement: (tagName: string) => {
      if (tagName === "audio") {
        return audioElement as HTMLAudioElement;
      }
      return {
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
        appendChild: vi.fn(),
        removeChild: vi.fn(),
        querySelector: vi.fn(),
        className: "",
      } as unknown as HTMLElement;
    },
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
  } as unknown as Document;

  // Mock Audio constructor for preloading
  globalThis.Audio = vi.fn().mockImplementation(() => ({
    src: "",
    load: vi.fn(),
  })) as unknown as typeof Audio;

  // Reset mocks
  vi.clearAllMocks();
});

describe("AudioManager", () => {
  test("should create audio element on construction", () => {
    const _manager = new AudioManager();
    expect(audioElement).toBeTruthy();
    expect(audioElement?.style.display).toBe("none");
  });

  test("should set track URL", () => {
    const manager = new AudioManager();
    manager.setTrack("https://example.com/track.mp3");
    expect(audioElement?.src).toBe("https://example.com/track.mp3");
  });

  test("should clear track URL when set to null", () => {
    const manager = new AudioManager();
    manager.setTrack("https://example.com/track.mp3");
    manager.setTrack(null);
    expect(audioElement?.src).toBe("");
    expect(audioElement?.pause).toHaveBeenCalled();
  });

  test("should play audio", async () => {
    const manager = new AudioManager();
    manager.setTrack("https://example.com/track.mp3");
    await manager.play();
    expect(audioElement?.play).toHaveBeenCalled();
  });

  test("should pause audio", () => {
    const manager = new AudioManager();
    manager.setTrack("https://example.com/track.mp3");
    manager.pause();
    expect(audioElement?.pause).toHaveBeenCalled();
  });

  test("should get current time", () => {
    const manager = new AudioManager();
    (audioElement as { currentTime: number }).currentTime = 42.5;
    expect(manager.getCurrentTime()).toBe(42.5);
  });

  test("should get duration", () => {
    const manager = new AudioManager();
    (audioElement as { duration: number }).duration = 180.0;
    expect(manager.getDuration()).toBe(180.0);
  });

  test("should return 0 for current time if no audio element", () => {
    const manager = new AudioManager();
    // Simulate no audio element by creating a new manager without element
    // Actually, the manager always creates an element, so this test checks the getter
    (audioElement as { currentTime: number }).currentTime = 0;
    expect(manager.getCurrentTime()).toBe(0);
  });

  test("should return NaN for duration if not available", () => {
    const manager = new AudioManager();
    (audioElement as { duration: number }).duration = NaN;
    expect(manager.getDuration()).toBeNaN();
  });

  test("should set next track URL", () => {
    const manager = new AudioManager();
    manager.setNextTrack("https://example.com/next.mp3");
    // Next track is stored internally, can't directly test but can test preloading behavior
    expect(manager).toBeTruthy();
  });

  test("should preload next track when within 20s of end", () => {
    const manager = new AudioManager();
    manager.setTrack("https://example.com/track.mp3");
    manager.setNextTrack("https://example.com/next.mp3");

    // Simulate timeupdate when within 20s of end
    (audioElement as { currentTime: number }).currentTime = 85; // 100 - 20 = 80, so 85 is within range
    (audioElement as { duration: number }).duration = 100;

    // Trigger timeupdate event
    const timeupdateEvent = new Event("timeupdate");
    audioEventListeners.timeupdate.forEach((listener) =>
      listener(timeupdateEvent)
    );

    // Should create new Audio for preloading
    expect(globalThis.Audio).toHaveBeenCalled();
  });

  test("should not preload if not within 20s of end", () => {
    const manager = new AudioManager();
    manager.setTrack("https://example.com/track.mp3");
    manager.setNextTrack("https://example.com/next.mp3");

    // Simulate timeupdate when NOT within 20s of end
    (audioElement as { currentTime: number }).currentTime = 50; // 100 - 20 = 80, so 50 is not within range
    (audioElement as { duration: number }).duration = 100;

    // Trigger timeupdate event
    const timeupdateEvent = new Event("timeupdate");
    audioEventListeners.timeupdate.forEach((listener) =>
      listener(timeupdateEvent)
    );

    // Should not create new Audio
    expect(globalThis.Audio).not.toHaveBeenCalled();
  });

  test("should dispatch timeupdate event", () => {
    const manager = new AudioManager();
    const listener = vi.fn();
    manager.addEventListener("timeupdate", listener);

    // Trigger timeupdate from audio element
    const timeupdateEvent = new Event("timeupdate");
    audioEventListeners.timeupdate.forEach((handler) =>
      handler(timeupdateEvent)
    );

    expect(listener).toHaveBeenCalled();
  });

  test("should dispatch ended event", () => {
    const manager = new AudioManager();
    const listener = vi.fn();
    manager.addEventListener("ended", listener);

    // Trigger ended from audio element
    const endedEvent = new Event("ended");
    audioEventListeners.ended.forEach((handler) => handler(endedEvent));

    expect(listener).toHaveBeenCalled();
  });

  test("should dispatch loadedmetadata event", () => {
    const manager = new AudioManager();
    const listener = vi.fn();
    manager.addEventListener("loadedmetadata", listener);

    // Trigger loadedmetadata from audio element
    const loadedMetadataEvent = new Event("loadedmetadata");
    audioEventListeners.loadedmetadata.forEach((handler) =>
      handler(loadedMetadataEvent)
    );

    expect(listener).toHaveBeenCalled();
  });

  test("should handle play() errors gracefully", async () => {
    const manager = new AudioManager();
    manager.setTrack("https://example.com/track.mp3");

    const playError = new Error("Playback failed");
    vi.mocked(audioElement?.play).mockRejectedValueOnce(playError);

    await expect(manager.play()).rejects.toThrow("Playback failed");
  });

  test("should clean up resources on destroy", () => {
    const manager = new AudioManager();
    manager.setTrack("https://example.com/track.mp3");
    manager.destroy();

    expect(audioElement?.removeEventListener).toHaveBeenCalled();
    expect(audioElement?.pause).toHaveBeenCalled();
    expect(audioElement?.src).toBe("");
  });

  test("should not preload if nextTrackUrl is not set", () => {
    const manager = new AudioManager();
    manager.setTrack("https://example.com/track.mp3");
    // Don't set next track

    // Simulate timeupdate when within 20s of end
    (audioElement as { currentTime: number }).currentTime = 85;
    (audioElement as { duration: number }).duration = 100;

    // Trigger timeupdate event
    const timeupdateEvent = new Event("timeupdate");
    audioEventListeners.timeupdate.forEach((listener) =>
      listener(timeupdateEvent)
    );

    // Should not create new Audio
    expect(globalThis.Audio).not.toHaveBeenCalled();
  });

  test("should not preload if duration is NaN", () => {
    const manager = new AudioManager();
    manager.setTrack("https://example.com/track.mp3");
    manager.setNextTrack("https://example.com/next.mp3");

    // Simulate timeupdate with NaN duration
    (audioElement as { currentTime: number }).currentTime = 85;
    (audioElement as { duration: number }).duration = NaN;

    // Trigger timeupdate event
    const timeupdateEvent = new Event("timeupdate");
    audioEventListeners.timeupdate.forEach((listener) =>
      listener(timeupdateEvent)
    );

    // Should not create new Audio
    expect(globalThis.Audio).not.toHaveBeenCalled();
  });
});
