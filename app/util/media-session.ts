/** @file Media Session API controller for system media controls.
 *
 * Integrates with the browser's Media Session API to display track metadata
 * in lock screen / notification controls and respond to play, pause, next,
 * previous, and seek actions from hardware or system UI.
 */

/** Metadata for the current track, used by Media Session. */
export interface MediaSessionMetadata {
  title: string;
  artist: string;
  album: string;
  /** URL or data URL for artwork (e.g. cover.jpeg or ID3 embedded image). */
  artworkUrl?: string;
}

/**
 * Callbacks invoked when the user triggers media actions from system controls
 * (lock screen, notification, hardware buttons).
 */
export interface MediaSessionCallbacks {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onNextTrack: () => void;
  onPreviousTrack: () => void;
  /** Optional. seekOffset is always supplied (default 10s from controller). */
  onSeekBackward?: (details: { seekOffset: number }) => void;
  /** Optional. seekOffset is always supplied (default 10s from controller). */
  onSeekForward?: (details: { seekOffset: number }) => void;
  /** Optional. Called when user seeks to a specific position (e.g. scrub bar). */
  onSeekTo?: (details: { seekTime: number }) => void;
}

const DEFAULT_SEEK_OFFSET = 10;

/**
 * Controller for the Media Session API. Registers action handlers and
 * updates metadata/playback state for system media controls (lock screen,
 * notification, hardware buttons).
 *
 * No-ops when the Media Session API is not available (e.g. unsupported browser).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
 */
export class MediaSessionController {
  private callbacks: MediaSessionCallbacks;
  private isSupported: boolean;

  constructor(callbacks: MediaSessionCallbacks) {
    this.callbacks = callbacks;
    this.isSupported = "mediaSession" in navigator;
    if (this.isSupported) {
      this.registerActionHandlers();
    }
  }

  private registerActionHandlers(): void {
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => this.callbacks.onPlay());
    ms.setActionHandler("pause", () => this.callbacks.onPause());
    ms.setActionHandler("stop", () => this.callbacks.onStop());
    ms.setActionHandler(
      "previoustrack",
      () => this.callbacks.onPreviousTrack(),
    );
    ms.setActionHandler("nexttrack", () => this.callbacks.onNextTrack());
    ms.setActionHandler("seekbackward", (details) => {
      this.callbacks.onSeekBackward?.({
        seekOffset: details.seekOffset ?? DEFAULT_SEEK_OFFSET,
      });
    });
    ms.setActionHandler("seekforward", (details) => {
      this.callbacks.onSeekForward?.({
        seekOffset: details.seekOffset ?? DEFAULT_SEEK_OFFSET,
      });
    });
    ms.setActionHandler("seekto", (details) => {
      if (typeof details.seekTime === "number") {
        this.callbacks.onSeekTo?.({ seekTime: details.seekTime });
      }
    });
  }

  /**
   * Update the displayed metadata (title, artist, album, artwork).
   * Pass null to clear.
   */
  updateMetadata(metadata: MediaSessionMetadata | null): void {
    if (!this.isSupported) return;
    const ms = navigator.mediaSession;
    if (!metadata) {
      ms.metadata = null;
      return;
    }
    const artwork: MediaImage[] = metadata.artworkUrl
      ? [{ src: metadata.artworkUrl, sizes: "96x96", type: "image/jpeg" }]
      : [];
    ms.metadata = new MediaMetadata({
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      artwork,
    });
  }

  /**
   * Update the playback state for system media controls.
   *
   * @param state - `"playing"` | `"paused"` | `"none"`
   */
  updatePlaybackState(state: "playing" | "paused" | "none"): void {
    if (!this.isSupported) return;
    navigator.mediaSession.playbackState = state;
  }

  /**
   * Update the position state for seek bar in lock screen / notification controls.
   * Enables scrubbing from system UI. Silently no-ops if duration/position are invalid.
   *
   * @param position - Current playback position in seconds
   * @param duration - Total duration in seconds
   * @param playbackRate - Playback rate (default 1)
   */
  updatePositionState(
    position: number,
    duration: number,
    playbackRate = 1,
  ): void {
    if (!this.isSupported) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate,
        position,
      });
    } catch {
      // setPositionState can throw if duration/position are invalid
    }
  }

  /**
   * Clear metadata, set playback state to "none", and remove action handlers.
   * Call when the player is disconnected or stopped.
   */
  destroy(): void {
    if (!this.isSupported) return;
    const ms = navigator.mediaSession;
    ms.metadata = null;
    ms.playbackState = "none";
    ms.setActionHandler("play", null);
    ms.setActionHandler("pause", null);
    ms.setActionHandler("stop", null);
    ms.setActionHandler("previoustrack", null);
    ms.setActionHandler("nexttrack", null);
    ms.setActionHandler("seekbackward", null);
    ms.setActionHandler("seekforward", null);
    ms.setActionHandler("seekto", null);
  }
}
