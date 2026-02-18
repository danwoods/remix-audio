/** @file Tests for MediaSessionController (Media Session API integration) */

import { assertEquals, assertStrictEquals } from "@std/assert";

// Polyfill MediaMetadata for Deno (not in DOM lib)
if (typeof globalThis.MediaMetadata === "undefined") {
  (globalThis as unknown as { MediaMetadata: typeof MediaMetadata })
    .MediaMetadata = class MediaMetadata {
      title: string;
      artist: string;
      album: string;
      artwork: MediaImage[];
      constructor(
        init?: {
          title?: string;
          artist?: string;
          album?: string;
          artwork?: MediaImage[];
        },
      ) {
        this.title = init?.title ?? "";
        this.artist = init?.artist ?? "";
        this.album = init?.album ?? "";
        this.artwork = init?.artwork ?? [];
      }
    };
}
import {
  MediaSessionController,
  type MediaSessionMetadata,
} from "./media-session.ts";

function createMockMediaSession(options?: {
  setPositionStateThrows?: boolean;
  setPositionStateThrowsWhenInvalid?: boolean;
}) {
  const actionHandlers: Record<string, ((details?: unknown) => void) | null> =
    {};
  let metadata: MediaMetadata | null = null;
  let playbackState: MediaSessionPlaybackState = "none";
  const setPositionStateCalls: Array<{
    position: number;
    duration: number;
    playbackRate: number;
  }> = [];

  return {
    get metadata() {
      return metadata;
    },
    set metadata(value: MediaMetadata | null) {
      metadata = value;
    },
    get playbackState() {
      return playbackState;
    },
    set playbackState(value: MediaSessionPlaybackState) {
      playbackState = value;
    },
    setActionHandler(
      action: string,
      handler: ((details?: unknown) => void) | null,
    ) {
      actionHandlers[action] = handler;
    },
    setPositionState(state: {
      position: number;
      duration: number;
      playbackRate?: number;
    }) {
      if (options?.setPositionStateThrows) {
        throw new Error("Invalid state");
      }
      if (
        options?.setPositionStateThrowsWhenInvalid &&
        (state.position < 0 || state.position > state.duration)
      ) {
        throw new Error("Position out of range");
      }
      setPositionStateCalls.push({
        position: state.position,
        duration: state.duration,
        playbackRate: state.playbackRate ?? 1,
      });
    },
    actionHandlers,
    setPositionStateCalls,
    triggerAction(action: string, details?: unknown) {
      const handler = actionHandlers[action];
      if (typeof handler === "function") {
        handler(details);
      }
    },
  };
}

Deno.test("MediaSessionController - no-ops when mediaSession not in navigator", () => {
  const orig = globalThis.navigator;
  const navNoMedia = Object.fromEntries(
    Object.entries(orig).filter(([k]) => k !== "mediaSession"),
  );
  Object.defineProperty(globalThis, "navigator", {
    value: navNoMedia,
    configurable: true,
    writable: true,
  });

  const calls: string[] = [];
  try {
    const controller = new MediaSessionController({
      onPlay: () => calls.push("play"),
      onPause: () => calls.push("pause"),
      onStop: () => calls.push("stop"),
      onNextTrack: () => calls.push("next"),
      onPreviousTrack: () => calls.push("prev"),
    });

    controller.updateMetadata({
      title: "Track",
      artist: "Artist",
      album: "Album",
    });
    controller.updatePlaybackState("playing");
    controller.updatePositionState(30, 180);
    controller.destroy();

    assertEquals(calls, []);
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: orig,
      configurable: true,
      writable: true,
    });
  }
});

Deno.test("MediaSessionController - updateMetadata sets metadata without artwork", () => {
  const mock = createMockMediaSession();
  const orig = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { ...orig, mediaSession: mock },
    configurable: true,
    writable: true,
  });

  try {
    const controller = new MediaSessionController({
      onPlay: () => {},
      onPause: () => {},
      onStop: () => {},
      onNextTrack: () => {},
      onPreviousTrack: () => {},
    });

    const metadata: MediaSessionMetadata = {
      title: "No Artwork Track",
      artist: "No Artwork Artist",
      album: "No Artwork Album",
    };

    controller.updateMetadata(metadata);

    assertStrictEquals(mock.metadata !== null, true);
    assertEquals(mock.metadata!.title, "No Artwork Track");
    assertEquals(mock.metadata!.artist, "No Artwork Artist");
    assertEquals(mock.metadata!.album, "No Artwork Album");
    assertEquals(mock.metadata!.artwork.length, 0);

    controller.destroy();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: orig,
      configurable: true,
      writable: true,
    });
  }
});

Deno.test("MediaSessionController - updateMetadata sets metadata with artwork", () => {
  const mock = createMockMediaSession();
  const orig = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { ...orig, mediaSession: mock },
    configurable: true,
    writable: true,
  });

  try {
    const controller = new MediaSessionController({
      onPlay: () => {},
      onPause: () => {},
      onStop: () => {},
      onNextTrack: () => {},
      onPreviousTrack: () => {},
    });

    const metadata: MediaSessionMetadata = {
      title: "Test Track",
      artist: "Test Artist",
      album: "Test Album",
      artworkUrl: "https://example.com/cover.jpeg",
    };

    controller.updateMetadata(metadata);

    assertStrictEquals(mock.metadata !== null, true);
    assertEquals(mock.metadata!.title, "Test Track");
    assertEquals(mock.metadata!.artist, "Test Artist");
    assertEquals(mock.metadata!.album, "Test Album");
    assertEquals(mock.metadata!.artwork.length, 1);
    assertEquals(
      mock.metadata!.artwork[0].src,
      "https://example.com/cover.jpeg",
    );
    assertEquals(mock.metadata!.artwork[0].sizes, "96x96");
    assertEquals(mock.metadata!.artwork[0].type, "image/jpeg");

    controller.destroy();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: orig,
      configurable: true,
      writable: true,
    });
  }
});

Deno.test("MediaSessionController - updateMetadata null clears metadata", () => {
  const mock = createMockMediaSession();
  const orig = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { ...orig, mediaSession: mock },
    configurable: true,
    writable: true,
  });

  try {
    const controller = new MediaSessionController({
      onPlay: () => {},
      onPause: () => {},
      onStop: () => {},
      onNextTrack: () => {},
      onPreviousTrack: () => {},
    });

    controller.updateMetadata({
      title: "Track",
      artist: "Artist",
      album: "Album",
    });
    assertStrictEquals(mock.metadata !== null, true);

    controller.updateMetadata(null);
    assertStrictEquals(mock.metadata, null);

    controller.destroy();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: orig,
      configurable: true,
      writable: true,
    });
  }
});

Deno.test("MediaSessionController - updatePlaybackState sets state", () => {
  const mock = createMockMediaSession();
  const orig = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { ...orig, mediaSession: mock },
    configurable: true,
    writable: true,
  });

  try {
    const controller = new MediaSessionController({
      onPlay: () => {},
      onPause: () => {},
      onStop: () => {},
      onNextTrack: () => {},
      onPreviousTrack: () => {},
    });

    controller.updatePlaybackState("playing");
    assertEquals(mock.playbackState, "playing");

    controller.updatePlaybackState("paused");
    assertEquals(mock.playbackState, "paused");

    controller.updatePlaybackState("none");
    assertEquals(mock.playbackState, "none");

    controller.destroy();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: orig,
      configurable: true,
      writable: true,
    });
  }
});

Deno.test("MediaSessionController - updatePositionState calls setPositionState", () => {
  const mock = createMockMediaSession();
  const orig = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { ...orig, mediaSession: mock },
    configurable: true,
    writable: true,
  });

  try {
    const controller = new MediaSessionController({
      onPlay: () => {},
      onPause: () => {},
      onStop: () => {},
      onNextTrack: () => {},
      onPreviousTrack: () => {},
    });

    controller.updatePositionState(45, 180, 1);
    assertEquals(mock.setPositionStateCalls.length, 1);
    assertEquals(mock.setPositionStateCalls[0].position, 45);
    assertEquals(mock.setPositionStateCalls[0].duration, 180);
    assertEquals(mock.setPositionStateCalls[0].playbackRate, 1);

    controller.updatePositionState(90, 180, 1.5);
    assertEquals(mock.setPositionStateCalls.length, 2);
    assertEquals(mock.setPositionStateCalls[1].playbackRate, 1.5);

    controller.destroy();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: orig,
      configurable: true,
      writable: true,
    });
  }
});

Deno.test("MediaSessionController - action handlers invoke callbacks", () => {
  const mock = createMockMediaSession();
  const orig = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { ...orig, mediaSession: mock },
    configurable: true,
    writable: true,
  });

  const calls: string[] = [];
  try {
    const controller = new MediaSessionController({
      onPlay: () => calls.push("play"),
      onPause: () => calls.push("pause"),
      onStop: () => calls.push("stop"),
      onNextTrack: () => calls.push("next"),
      onPreviousTrack: () => calls.push("prev"),
    });

    mock.triggerAction("play");
    mock.triggerAction("pause");
    mock.triggerAction("stop");
    mock.triggerAction("nexttrack");
    mock.triggerAction("previoustrack");

    assertEquals(calls, ["play", "pause", "stop", "next", "prev"]);

    controller.destroy();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: orig,
      configurable: true,
      writable: true,
    });
  }
});

Deno.test("MediaSessionController - continues registering actions when one action is unsupported", () => {
  const actionHandlers: Record<string, ((details?: unknown) => void) | null> =
    {};
  const mock = {
    metadata: null as MediaMetadata | null,
    playbackState: "none" as MediaSessionPlaybackState,
    setActionHandler(
      action: string,
      handler: ((details?: unknown) => void) | null,
    ) {
      if (action === "stop") {
        throw new Error("Unsupported action");
      }
      actionHandlers[action] = handler;
    },
    setPositionState: (_state: {
      position: number;
      duration: number;
      playbackRate?: number;
    }) => {},
  };
  const orig = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { ...orig, mediaSession: mock },
    configurable: true,
    writable: true,
  });

  try {
    const seekToCalls: Array<{ seekTime: number }> = [];
    const controller = new MediaSessionController({
      onPlay: () => {},
      onPause: () => {},
      onStop: () => {},
      onNextTrack: () => {},
      onPreviousTrack: () => {},
      onSeekTo: (details) => seekToCalls.push(details),
    });

    const seekToHandler = actionHandlers["seekto"];
    assertStrictEquals(typeof seekToHandler, "function");
    seekToHandler?.({ seekTime: 12 });
    assertEquals(seekToCalls.length, 1);

    controller.destroy();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: orig,
      configurable: true,
      writable: true,
    });
  }
});

Deno.test("MediaSessionController - seek handlers invoke callbacks with offset", () => {
  const mock = createMockMediaSession();
  const orig = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { ...orig, mediaSession: mock },
    configurable: true,
    writable: true,
  });

  const seekBackwardCalls: Array<{ seekOffset: number }> = [];
  const seekForwardCalls: Array<{ seekOffset: number }> = [];
  const seekToCalls: Array<{ seekTime: number }> = [];
  try {
    const controller = new MediaSessionController({
      onPlay: () => {},
      onPause: () => {},
      onStop: () => {},
      onNextTrack: () => {},
      onPreviousTrack: () => {},
      onSeekBackward: (d) => seekBackwardCalls.push(d),
      onSeekForward: (d) => seekForwardCalls.push(d),
      onSeekTo: (d) => seekToCalls.push(d),
    });

    mock.triggerAction("seekbackward", { seekOffset: 5 });
    mock.triggerAction("seekforward", { seekOffset: 15 });
    mock.triggerAction("seekto", { seekTime: 60 });

    assertEquals(seekBackwardCalls.length, 1);
    assertEquals(seekBackwardCalls[0].seekOffset, 5);

    assertEquals(seekForwardCalls.length, 1);
    assertEquals(seekForwardCalls[0].seekOffset, 15);

    assertEquals(seekToCalls.length, 1);
    assertEquals(seekToCalls[0].seekTime, 60);

    controller.destroy();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: orig,
      configurable: true,
      writable: true,
    });
  }
});

Deno.test("MediaSessionController - seek handlers use default offset when omitted", () => {
  const mock = createMockMediaSession();
  const orig = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { ...orig, mediaSession: mock },
    configurable: true,
    writable: true,
  });

  const seekBackwardCalls: Array<{ seekOffset: number }> = [];
  const seekForwardCalls: Array<{ seekOffset: number }> = [];
  try {
    const controller = new MediaSessionController({
      onPlay: () => {},
      onPause: () => {},
      onStop: () => {},
      onNextTrack: () => {},
      onPreviousTrack: () => {},
      onSeekBackward: (d) => seekBackwardCalls.push(d),
      onSeekForward: (d) => seekForwardCalls.push(d),
    });

    mock.triggerAction("seekbackward", {});
    mock.triggerAction("seekforward", {});

    assertEquals(seekBackwardCalls.length, 1);
    assertEquals(seekBackwardCalls[0].seekOffset, 10);

    assertEquals(seekForwardCalls.length, 1);
    assertEquals(seekForwardCalls[0].seekOffset, 10);

    controller.destroy();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: orig,
      configurable: true,
      writable: true,
    });
  }
});

Deno.test("MediaSessionController - onSeekTo not called when seekTime is invalid", () => {
  const mock = createMockMediaSession();
  const orig = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { ...orig, mediaSession: mock },
    configurable: true,
    writable: true,
  });

  const seekToCalls: Array<{ seekTime: number }> = [];
  try {
    const controller = new MediaSessionController({
      onPlay: () => {},
      onPause: () => {},
      onStop: () => {},
      onNextTrack: () => {},
      onPreviousTrack: () => {},
      onSeekTo: (d) => seekToCalls.push(d),
    });

    mock.triggerAction("seekto", { seekTime: undefined });
    mock.triggerAction("seekto", {});
    mock.triggerAction("seekto", { seekTime: "60" });

    assertEquals(seekToCalls.length, 0);

    controller.destroy();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: orig,
      configurable: true,
      writable: true,
    });
  }
});

Deno.test("MediaSessionController - updatePositionState uses default playbackRate when omitted", () => {
  const mock = createMockMediaSession();
  const orig = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { ...orig, mediaSession: mock },
    configurable: true,
    writable: true,
  });

  try {
    const controller = new MediaSessionController({
      onPlay: () => {},
      onPause: () => {},
      onStop: () => {},
      onNextTrack: () => {},
      onPreviousTrack: () => {},
    });

    controller.updatePositionState(30, 180);
    assertEquals(mock.setPositionStateCalls.length, 1);
    assertEquals(mock.setPositionStateCalls[0].playbackRate, 1);

    controller.destroy();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: orig,
      configurable: true,
      writable: true,
    });
  }
});

Deno.test("MediaSessionController - updatePositionState does not throw when setPositionState throws", () => {
  const mock = createMockMediaSession({ setPositionStateThrows: true });
  const orig = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { ...orig, mediaSession: mock },
    configurable: true,
    writable: true,
  });

  try {
    const controller = new MediaSessionController({
      onPlay: () => {},
      onPause: () => {},
      onStop: () => {},
      onNextTrack: () => {},
      onPreviousTrack: () => {},
    });

    controller.updatePositionState(30, 180);
    controller.updatePositionState(NaN, 180);

    controller.destroy();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: orig,
      configurable: true,
      writable: true,
    });
  }
});

Deno.test("MediaSessionController - updatePositionState clamps out-of-range position values", () => {
  const mock = createMockMediaSession({
    setPositionStateThrowsWhenInvalid: true,
  });
  const orig = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { ...orig, mediaSession: mock },
    configurable: true,
    writable: true,
  });

  try {
    const controller = new MediaSessionController({
      onPlay: () => {},
      onPause: () => {},
      onStop: () => {},
      onNextTrack: () => {},
      onPreviousTrack: () => {},
    });

    controller.updatePositionState(250, 180);
    assertEquals(mock.setPositionStateCalls.length, 1);
    assertEquals(mock.setPositionStateCalls[0].position, 180);
    assertEquals(mock.setPositionStateCalls[0].duration, 180);
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: orig,
      configurable: true,
      writable: true,
    });
  }
});

Deno.test("MediaSessionController - optional seek handlers do not crash when omitted", () => {
  const mock = createMockMediaSession();
  const orig = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { ...orig, mediaSession: mock },
    configurable: true,
    writable: true,
  });

  try {
    const controller = new MediaSessionController({
      onPlay: () => {},
      onPause: () => {},
      onStop: () => {},
      onNextTrack: () => {},
      onPreviousTrack: () => {},
    });

    mock.triggerAction("seekbackward", { seekOffset: 5 });
    mock.triggerAction("seekforward", { seekOffset: 5 });
    mock.triggerAction("seekto", { seekTime: 60 });

    controller.destroy();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: orig,
      configurable: true,
      writable: true,
    });
  }
});

Deno.test("MediaSessionController - destroy clears state and handlers", () => {
  const mock = createMockMediaSession();
  const orig = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { ...orig, mediaSession: mock },
    configurable: true,
    writable: true,
  });

  try {
    const controller = new MediaSessionController({
      onPlay: () => {},
      onPause: () => {},
      onStop: () => {},
      onNextTrack: () => {},
      onPreviousTrack: () => {},
    });

    controller.updateMetadata({
      title: "Track",
      artist: "Artist",
      album: "Album",
    });
    controller.updatePlaybackState("playing");

    controller.destroy();

    assertStrictEquals(mock.metadata, null);
    assertEquals(mock.playbackState, "none");
    assertEquals(mock.actionHandlers["play"] ?? null, null);
    assertEquals(mock.actionHandlers["pause"] ?? null, null);
    assertEquals(mock.actionHandlers["stop"] ?? null, null);
    assertEquals(mock.actionHandlers["previoustrack"] ?? null, null);
    assertEquals(mock.actionHandlers["nexttrack"] ?? null, null);
    assertEquals(mock.actionHandlers["seekbackward"] ?? null, null);
    assertEquals(mock.actionHandlers["seekforward"] ?? null, null);
    assertEquals(mock.actionHandlers["seekto"] ?? null, null);
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: orig,
      configurable: true,
      writable: true,
    });
  }
});
