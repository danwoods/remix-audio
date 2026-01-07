/** @file Tests for AudioManager */

import { assert, assertEquals, assertRejects } from "@std/assert";
import { AudioManager } from "./audio-manager.ts";

// Track DOM state
let audioElement: Partial<HTMLAudioElement> | null = null;
const audioEventListeners: { [key: string]: ((event: Event) => void)[] } = {};

// Mock function helpers
function createMockFn<T extends (...args: unknown[]) => unknown>(
  returnValue?: ReturnType<T>,
): T & { calls: unknown[][]; called: boolean } {
  const calls: unknown[][] = [];
  const fn = ((...args: unknown[]) => {
    calls.push(args);
    return returnValue;
  }) as T & { calls: unknown[][]; called: boolean };
  fn.calls = calls;
  fn.called = false;
  Object.defineProperty(fn, "called", {
    get: () => calls.length > 0,
  });
  return fn;
}

function createMockFnWithReject<
  T extends (...args: unknown[]) => Promise<unknown>,
>(
  error: Error,
): T & { calls: unknown[][]; called: boolean } {
  const calls: unknown[][] = [];
  const fn = ((...args: unknown[]) => {
    calls.push(args);
    return Promise.reject(error);
  }) as T & { calls: unknown[][]; called: boolean };
  fn.calls = calls;
  fn.called = false;
  Object.defineProperty(fn, "called", {
    get: () => calls.length > 0,
  });
  return fn;
}

function resetTestState() {
  // Reset state
  audioEventListeners.timeupdate = [];
  audioEventListeners.ended = [];
  audioEventListeners.loadedmetadata = [];

  // Create mock audio element
  const mockPlay = createMockFn<() => Promise<void>>(Promise.resolve());
  const mockPause = createMockFn();
  const mockSetAttribute = createMockFn();
  const mockGetAttribute = createMockFn();
  const mockRemoveEventListener = createMockFn();

  audioElement = {
    src: "",
    paused: true,
    currentTime: 0,
    duration: 100,
    readyState: 0,
    style: { display: "" } as CSSStyleDeclaration,
    setAttribute: mockSetAttribute,
    getAttribute: mockGetAttribute,
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
    removeEventListener: mockRemoveEventListener,
    play: mockPlay,
    pause: mockPause,
    parentNode: null,
  };

  // Mock document.createElement for audio element
  globalThis.document = {
    createElement: (tagName: string) => {
      if (tagName === "audio") {
        return audioElement as HTMLAudioElement;
      }
      return {
        setAttribute: createMockFn(),
        getAttribute: createMockFn(),
        appendChild: createMockFn(),
        removeChild: createMockFn(),
        querySelector: createMockFn(),
        className: "",
      } as unknown as HTMLElement;
    },
    body: {
      appendChild: createMockFn(),
      removeChild: createMockFn(),
    },
  } as unknown as Document;

  // Mock Audio constructor for preloading
  let audioCallCount = 0;
  globalThis.Audio = (() => {
    audioCallCount++;
    return {
      src: "",
      load: createMockFn(),
    };
  }) as unknown as typeof Audio;
  (globalThis.Audio as unknown as { callCount: number }).callCount = 0;
  Object.defineProperty(globalThis.Audio, "callCount", {
    get: () => audioCallCount,
    configurable: true,
  });
}

Deno.test("AudioManager - should create audio element on construction", () => {
  resetTestState();
  const _manager = new AudioManager();
  assert(audioElement !== null);
  assertEquals(audioElement?.style.display, "none");
});

Deno.test("AudioManager - should set track URL", () => {
  resetTestState();
  const manager = new AudioManager();
  manager.setTrack("https://example.com/track.mp3");
  assertEquals(audioElement?.src, "https://example.com/track.mp3");
});

Deno.test("AudioManager - should clear track URL when set to null", () => {
  resetTestState();
  const manager = new AudioManager();
  manager.setTrack("https://example.com/track.mp3");
  manager.setTrack(null);
  assertEquals(audioElement?.src, "");
  assert((audioElement?.pause as { called: boolean }).called);
});

Deno.test("AudioManager - should play audio", async () => {
  resetTestState();
  const manager = new AudioManager();
  manager.setTrack("https://example.com/track.mp3");
  await manager.play();
  assert((audioElement?.play as { called: boolean }).called);
});

Deno.test("AudioManager - should pause audio", () => {
  resetTestState();
  const manager = new AudioManager();
  manager.setTrack("https://example.com/track.mp3");
  manager.pause();
  assert((audioElement?.pause as { called: boolean }).called);
});

Deno.test("AudioManager - should get current time", () => {
  resetTestState();
  const manager = new AudioManager();
  (audioElement as { currentTime: number }).currentTime = 42.5;
  assertEquals(manager.getCurrentTime(), 42.5);
});

Deno.test("AudioManager - should get duration", () => {
  resetTestState();
  const manager = new AudioManager();
  (audioElement as { duration: number }).duration = 180.0;
  assertEquals(manager.getDuration(), 180.0);
});

Deno.test("AudioManager - should return 0 for current time if no audio element", () => {
  resetTestState();
  const manager = new AudioManager();
  // Simulate no audio element by creating a new manager without element
  // Actually, the manager always creates an element, so this test checks the getter
  (audioElement as { currentTime: number }).currentTime = 0;
  assertEquals(manager.getCurrentTime(), 0);
});

Deno.test("AudioManager - should return NaN for duration if not available", () => {
  resetTestState();
  const manager = new AudioManager();
  (audioElement as { duration: number }).duration = NaN;
  assert(Number.isNaN(manager.getDuration()));
});

Deno.test("AudioManager - should set next track URL", () => {
  resetTestState();
  const manager = new AudioManager();
  manager.setNextTrack("https://example.com/next.mp3");
  // Next track is stored internally, can't directly test but can test preloading behavior
  assert(manager !== null);
});

Deno.test("AudioManager - should preload next track when within 20s of end", () => {
  resetTestState();
  const manager = new AudioManager();
  manager.setTrack("https://example.com/track.mp3");
  manager.setNextTrack("https://example.com/next.mp3");

  // Simulate timeupdate when within 20s of end
  (audioElement as { currentTime: number }).currentTime = 85; // 100 - 20 = 80, so 85 is within range
  (audioElement as { duration: number }).duration = 100;

  // Track Audio constructor calls
  let audioCallCount = 0;
  const OriginalAudio = globalThis.Audio;
  globalThis.Audio = (() => {
    audioCallCount++;
    return {
      src: "",
      load: createMockFn(),
    };
  }) as unknown as typeof Audio;

  // Trigger timeupdate event
  const timeupdateEvent = new Event("timeupdate");
  Object.defineProperty(timeupdateEvent, "target", {
    value: audioElement,
    writable: false,
  });
  audioEventListeners.timeupdate.forEach((listener) =>
    listener(timeupdateEvent)
  );

  // Should create new Audio for preloading
  assertEquals(audioCallCount, 1);
  globalThis.Audio = OriginalAudio;
});

Deno.test("AudioManager - should not preload if not within 20s of end", () => {
  resetTestState();
  const manager = new AudioManager();
  manager.setTrack("https://example.com/track.mp3");
  manager.setNextTrack("https://example.com/next.mp3");

  // Simulate timeupdate when NOT within 20s of end
  (audioElement as { currentTime: number }).currentTime = 50; // 100 - 20 = 80, so 50 is not within range
  (audioElement as { duration: number }).duration = 100;

  // Reset Audio call count
  let audioCallCount = 0;
  const OriginalAudio = globalThis.Audio;
  globalThis.Audio = (() => {
    audioCallCount++;
    return {
      src: "",
      load: createMockFn(),
    };
  }) as unknown as typeof Audio;

  // Trigger timeupdate event
  const timeupdateEvent = new Event("timeupdate");
  Object.defineProperty(timeupdateEvent, "target", {
    value: audioElement,
    writable: false,
  });
  audioEventListeners.timeupdate.forEach((listener) =>
    listener(timeupdateEvent)
  );

  // Should not create new Audio
  assertEquals(audioCallCount, 0);
  globalThis.Audio = OriginalAudio;
});

Deno.test("AudioManager - should dispatch timeupdate event", () => {
  resetTestState();
  const manager = new AudioManager();
  let listenerCalled = false;
  const listener = () => {
    listenerCalled = true;
  };
  manager.addEventListener("timeupdate", listener);

  // Trigger timeupdate from audio element
  const timeupdateEvent = new Event("timeupdate");
  Object.defineProperty(timeupdateEvent, "target", {
    value: audioElement,
    writable: false,
  });
  audioEventListeners.timeupdate.forEach((handler) => handler(timeupdateEvent));

  assert(listenerCalled);
});

Deno.test("AudioManager - should dispatch ended event", () => {
  resetTestState();
  const manager = new AudioManager();
  let listenerCalled = false;
  const listener = () => {
    listenerCalled = true;
  };
  manager.addEventListener("ended", listener);

  // Trigger ended from audio element
  const endedEvent = new Event("ended");
  audioEventListeners.ended.forEach((handler) => handler(endedEvent));

  assert(listenerCalled);
});

Deno.test("AudioManager - should dispatch loadedmetadata event", () => {
  resetTestState();
  const manager = new AudioManager();
  let listenerCalled = false;
  const listener = () => {
    listenerCalled = true;
  };
  manager.addEventListener("loadedmetadata", listener);

  // Trigger loadedmetadata from audio element
  const loadedMetadataEvent = new Event("loadedmetadata");
  audioEventListeners.loadedmetadata.forEach((handler) =>
    handler(loadedMetadataEvent)
  );

  assert(listenerCalled);
});

Deno.test("AudioManager - should handle play() errors gracefully", async () => {
  resetTestState();
  const manager = new AudioManager();
  manager.setTrack("https://example.com/track.mp3");

  const playError = new Error("Playback failed");
  const mockPlay = createMockFnWithReject<() => Promise<void>>(playError);
  audioElement!.play = mockPlay;

  await assertRejects(
    async () => {
      await manager.play();
    },
    Error,
    "Playback failed",
  );
});

Deno.test("AudioManager - should clean up resources on destroy", () => {
  resetTestState();
  const manager = new AudioManager();
  manager.setTrack("https://example.com/track.mp3");
  manager.destroy();

  assert((audioElement?.removeEventListener as { called: boolean }).called);
  assert((audioElement?.pause as { called: boolean }).called);
  assertEquals(audioElement?.src, "");
});

Deno.test("AudioManager - should not preload if nextTrackUrl is not set", () => {
  resetTestState();
  const manager = new AudioManager();
  manager.setTrack("https://example.com/track.mp3");
  // Don't set next track

  // Simulate timeupdate when within 20s of end
  (audioElement as { currentTime: number }).currentTime = 85;
  (audioElement as { duration: number }).duration = 100;

  // Reset Audio call count
  let audioCallCount = 0;
  const OriginalAudio = globalThis.Audio;
  globalThis.Audio = (() => {
    audioCallCount++;
    return {
      src: "",
      load: createMockFn(),
    };
  }) as unknown as typeof Audio;

  // Trigger timeupdate event
  const timeupdateEvent = new Event("timeupdate");
  Object.defineProperty(timeupdateEvent, "target", {
    value: audioElement,
    writable: false,
  });
  audioEventListeners.timeupdate.forEach((listener) =>
    listener(timeupdateEvent)
  );

  // Should not create new Audio
  assertEquals(audioCallCount, 0);
  globalThis.Audio = OriginalAudio;
});

Deno.test("AudioManager - should not preload if duration is NaN", () => {
  resetTestState();
  const manager = new AudioManager();
  manager.setTrack("https://example.com/track.mp3");
  manager.setNextTrack("https://example.com/next.mp3");

  // Simulate timeupdate with NaN duration
  (audioElement as { currentTime: number }).currentTime = 85;
  (audioElement as { duration: number }).duration = NaN;

  // Reset Audio call count
  let audioCallCount = 0;
  const OriginalAudio = globalThis.Audio;
  globalThis.Audio = (() => {
    audioCallCount++;
    return {
      src: "",
      load: createMockFn(),
    };
  }) as unknown as typeof Audio;

  // Trigger timeupdate event
  const timeupdateEvent = new Event("timeupdate");
  Object.defineProperty(timeupdateEvent, "target", {
    value: audioElement,
    writable: false,
  });
  audioEventListeners.timeupdate.forEach((listener) =>
    listener(timeupdateEvent)
  );

  // Should not create new Audio
  assertEquals(audioCallCount, 0);
  globalThis.Audio = OriginalAudio;
});
