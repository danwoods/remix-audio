/** @file Custom element for player controls seen at the bottom of the screen */

import {
  escapeHtml,
  getAllAlbumTracks,
  getParentDataFromTrackUrl,
  getRemainingAlbumTracks,
} from "../../../util/track.ts";
import "../../../icons/play/index.ts";
import "../../../icons/pause/index.ts";
import "../../../icons/prev/index.ts";
import "../../../icons/next/index.ts";
import "../../../icons/playlist/index.ts";
import "./player-controls-custom-element.ts";

/**
 * Custom element for player controls displayed at the bottom of the screen.
 * This element is self-contained and manages all player logic internally.
 *
 * The element is controlled entirely through HTML attributes. User interactions
 * (play/pause/next buttons, playlist selection) are handled internally. External
 * code can control playback by setting attributes and react to state changes via
 * the `change` event or `onchange` attribute.
 *
 * @customElement playbar-custom-element
 *
 * @example
 * ```html
 * <playbar-custom-element
 *   data-album-url="https://bucket.s3.amazonaws.com"
 *   data-current-track-url="https://bucket.s3.amazonaws.com/artist/album/01__Track Name.mp3"
 *   data-is-playing="true"
 *   onchange="handlePlayerChange">
 * </playbar-custom-element>
 * ```
 *
 * @example
 * ```javascript
 * const playbar = document.querySelector('playbar-custom-element');
 *
 * // Listen for state change events
 * playbar.addEventListener('change', (event) => {
 *   console.log('Player state changed:', {
 *     currentTrack: event.detail.currentTrack,
 *     isPlaying: event.detail.isPlaying
 *   });
 * });
 *
 * // Control playback by setting attributes
 * playbar.setAttribute('data-current-track-url', 'https://.../track.mp3');
 * playbar.setAttribute('data-is-playing', 'true');
 *
 * // To pause, set is-playing to false
 * playbar.setAttribute('data-is-playing', 'false');
 *
 * // To stop, remove the current track URL
 * playbar.removeAttribute('data-current-track-url');
 * ```
 *
 * @attributes
 * - `data-current-track-url` (string | null): Current track URL.
 *   Expected format: `{baseUrl}/{artistName}/{albumName}/{trackNumber}__{trackName}.{ext}`
 *   Setting this attribute will load and optionally play the track (if `data-is-playing` is "true").
 *   Removing this attribute will stop playback.
 *
 * - `data-is-playing` (string): Playing state. Must be the string "true" or "false".
 *   Controls whether the current track is playing or paused.
 *
 * - `data-album-url` (string | null): The base URL for the album (S3 bucket URL).
 *   Used to fetch remaining tracks in the album for the playlist dropdown.
 *   Required for the playlist feature to work.
 *
 * - `onchange` (string): Optional function name to call when player state changes.
 *   The function will be called with a CustomEvent as the argument.
 *   Alternatively, listen to the 'change' event using addEventListener.
 *
 * @events
 * - `change` (CustomEvent): Dispatched when player state changes (track or playing state).
 *   This event is fired whenever the current track or playing state changes, whether
 *   due to user interaction or attribute changes.
 *   - `detail.currentTrack` (string | null): Current track URL
 *   - `detail.isPlaying` (boolean): Whether currently playing
 *   - `bubbles`: true
 *   - `cancelable`: false
 *
 * @remarks
 * The element automatically:
 * - Manages its own audio element and playback state internally
 * - Handles all user interactions (play/pause/next buttons, playlist clicks)
 * - Loads remaining tracks in the album when both `data-album-url` and `data-current-track-url` are set
 * - Preloads the next track when within 20 seconds of the end
 * - Auto-plays the next track when the current track ends
 * - Parses track information from the URL format: `{number}__{name}.{ext}`
 * - Updates the UI when attributes change
 * - Hides itself when no track is set (using `translate-y-full` class)
 *
 * All player logic is self-contained within this element. External code should
 * control playback by setting attributes, not by calling methods.
 */
export class PlaybarCustomElement extends HTMLElement {
  static observedAttributes = [
    "data-current-track-url",
    "data-is-playing",
    "data-album-url",
    "onchange",
  ];

  private currentTrackUrl: string | null = null;
  private isPlaying: boolean = false;
  private albumUrl: string | null = null;
  private nextTrackLoaded: boolean = false;
  private remainingTracks: Array<{
    url: string;
    title: string;
    trackNum: number;
  }> = [];
  private allAlbumTracks: Array<{
    url: string;
    title: string;
    trackNum: number;
  }> = [];
  private loadTracksPromise: Promise<void> | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private boundTimeUpdate: (event: Event) => void;
  private boundEnded: (event: Event) => void;
  private boundHandlePlayToggle: (event: Event) => void;
  private boundHandlePlayNext: (event: Event) => void;
  private boundHandlePlayPrev: (event: Event) => void;

  constructor() {
    super();
    // Use event delegation to avoid memory leaks
    // Store bound function so we can remove it later
    this.boundTimeUpdate = this.handleTimeUpdate.bind(this);
    this.boundEnded = this.handleEnded.bind(this);
    this.boundHandlePlayToggle = this.handlePlayToggle.bind(this);
    this.boundHandlePlayNext = this.handlePlayNext.bind(this);
    this.boundHandlePlayPrev = this.handlePlayPrev.bind(this);
  }

  connectedCallback() {
    // Ensure the custom element displays as a block element with full width
    this.style.display = "block";
    this.style.width = "100%";

    this.createAudioElement();
    this.updateAttributes();
    this.render();
    // Listen for play-toggle event from player-controls-custom-element
    this.addEventListener("play-toggle", this.boundHandlePlayToggle);
    // Listen for play-next event from player-controls-custom-element
    this.addEventListener("play-next", this.boundHandlePlayNext);
    // Listen for play-prev event from player-controls-custom-element
    this.addEventListener("play-prev", this.boundHandlePlayPrev);
  }

  disconnectedCallback() {
    // Remove event listeners on disconnect
    this.removeEventListener("play-toggle", this.boundHandlePlayToggle);
    this.removeEventListener("play-next", this.boundHandlePlayNext);
    this.removeEventListener("play-prev", this.boundHandlePlayPrev);
    if (this.audioElement) {
      this.audioElement.removeEventListener("timeupdate", this.boundTimeUpdate);
      this.audioElement.removeEventListener("ended", this.boundEnded);
      this.audioElement.pause();
      this.audioElement.src = "";
      // Remove audio element from DOM if we added it
      if (this.audioElement.parentNode) {
        this.audioElement.parentNode.removeChild(this.audioElement);
      }
      this.audioElement = null;
    }
  }

  async attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    _newValue: string | null,
  ) {
    console.log("attributeChangedCallback", name, _oldValue, _newValue);
    if (name === "data-current-track-url") {
      // Only update if different to avoid unnecessary re-renders
      if (this.currentTrackUrl !== _newValue) {
        // Cancel any existing load promise since we're changing tracks
        if (this.loadTracksPromise) {
          this.loadTracksPromise = null;
        }
        this.currentTrackUrl = _newValue;
        this.updateAudioSource();
        // Render immediately with current state, then update when tracks load
        this.render();
        await this.loadRemainingTracks();
        // loadRemainingTracks will call render() after tracks are loaded
        this.dispatchChangeEvent();
      }
    } else if (name === "data-is-playing") {
      const newIsPlaying = _newValue === "true";
      if (this.isPlaying !== newIsPlaying) {
        this.isPlaying = newIsPlaying;
        this.updateAudioPlayback();
        this.dispatchChangeEvent();
        this.render();
      }
    } else if (name === "data-album-url") {
      if (this.albumUrl !== _newValue) {
        // Cancel any existing load promise since we're changing albums
        if (this.loadTracksPromise) {
          this.loadTracksPromise = null;
        }
        this.albumUrl = _newValue;
        // Render immediately, then update when tracks load
        this.render();
        await this.loadRemainingTracks();
        // loadRemainingTracks will call render() after tracks are loaded
      }
    } else {
      // For other attributes, just render
      this.render();
    }
  }

  private async updateAttributes() {
    console.log("updateAttributes");
    this.currentTrackUrl = this.getAttribute("data-current-track-url");
    this.isPlaying = this.getAttribute("data-is-playing") === "true";
    this.albumUrl = this.getAttribute("data-album-url");
    await this.loadRemainingTracks();
  }

  private createAudioElement() {
    console.log("createAudioElement");
    // Create audio element if it doesn't exist
    if (!this.audioElement) {
      this.audioElement = document.createElement("audio");
      this.audioElement.addEventListener("timeupdate", this.boundTimeUpdate);
      this.audioElement.addEventListener("ended", this.boundEnded);
      // Hide the audio element (it's just for playback, not display)
      this.audioElement.style.display = "none";
      document.body.appendChild(this.audioElement);
      this.updateAudioSource();
      this.updateAudioPlayback();
    }
  }

  private updateAudioSource() {
    console.log("updateAudioSource");
    if (!this.audioElement) return;

    if (this.currentTrackUrl) {
      this.audioElement.src = this.currentTrackUrl;
      this.nextTrackLoaded = false;
      // After setting source, update playback state when metadata is loaded
      const handleLoadedMetadata = () => {
        // Check current playing state, not the captured one
        if (this.isPlaying) {
          this.updateAudioPlayback();
        }
      };
      this.audioElement.addEventListener(
        "loadedmetadata",
        handleLoadedMetadata,
        { once: true },
      );
      // If metadata is already loaded, update playback immediately
      if (this.audioElement.readyState >= HTMLMediaElement.HAVE_METADATA) {
        handleLoadedMetadata();
      }
    } else {
      this.audioElement.src = "";
      this.audioElement.pause();
    }
  }

  private updateAudioPlayback() {
    console.log("updateAudioPlayback");
    if (!this.audioElement || !this.audioElement.src) return;

    if (this.isPlaying && this.currentTrackUrl) {
      this.audioElement.play().catch((error) => {
        console.error("Failed to play audio:", error);
        this.isPlaying = false;
        this.setAttribute("data-is-playing", "false");
        this.dispatchChangeEvent();
      });
      this.nextTrackLoaded = false;
    } else {
      this.audioElement.pause();
    }
  }

  private handleTimeUpdate(event: Event) {
    const audio = event.target as HTMLAudioElement;
    if (
      !this.nextTrackLoaded &&
      !Number.isNaN(audio.duration) &&
      // If we're within 20s of the end of the track
      audio.duration - 20 < audio.currentTime &&
      this.currentTrackUrl
    ) {
      this.nextTrackLoaded = true;
      const [nextTrack] = this.remainingTracks;
      if (nextTrack) {
        // Preload the next track
        new Audio(nextTrack.url);
      }
    }
  }

  private handleEnded() {
    this.playNext();
  }

  /**
   * Handles the play-toggle event from player-controls-custom-element.
   * Toggles play/pause for the current track, or stops playback if no track is set.
   *
   * @private
   * @param event - The play-toggle custom event
   */
  private async handlePlayToggle(event: Event) {
    console.log("qwdcade", this.getAttribute("data-current-track-url"));
    event.stopPropagation();
    // Toggle play/pause for the current track
    await this.playToggle(
      this.getAttribute("data-current-track-url") || undefined,
    );

    this.render();
  }

  /**
   * Handles the play-next event from player-controls-custom-element.
   * Plays the next track in the album if available.
   *
   * @private
   * @param event - The play-next custom event
   */
  private handlePlayNext(event: Event) {
    event.stopPropagation();
    this.playNext();
    this.render();
  }

  /**
   * Handles the play-prev event from player-controls-custom-element.
   * Plays the previous track in the album if available.
   *
   * @private
   * @param event - The play-prev custom event
   */
  private handlePlayPrev(event: Event) {
    event.stopPropagation();
    this.playPrev();
    this.render();
  }

  private async loadRemainingTracks() {
    console.log("loadRemainingTracks");
    // If already loading, wait for it with a timeout
    if (this.loadTracksPromise) {
      try {
        // Wait with timeout to prevent infinite waiting
        await Promise.race([
          this.loadTracksPromise,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Load timeout after 10 seconds")),
              10000,
            )
          ),
        ]);
      } catch (error) {
        console.error(
          "loadRemainingTracks: Previous load failed or timed out:",
          error,
        );
        // Reset the promise so we can try again
        this.loadTracksPromise = null;
      }
      return;
    }

    this.loadTracksPromise = (async () => {
      try {
        if (this.albumUrl && this.currentTrackUrl) {
          this.remainingTracks = await getRemainingAlbumTracks(
            this.albumUrl,
            this.currentTrackUrl,
          );
          // Also load all tracks for prev button functionality
          await this.loadAllAlbumTracks();
          // Re-render after tracks are loaded to update playlist UI
          this.render();
        } else {
          this.remainingTracks = [];
          this.allAlbumTracks = [];
        }
      } catch (error) {
        console.error("Failed to load remaining tracks:", error);
        this.remainingTracks = [];
        this.allAlbumTracks = [];
      } finally {
        this.loadTracksPromise = null;
      }
    })();

    return this.loadTracksPromise;
  }

  /**
   * Load all tracks in the album for prev button functionality.
   * Filters out cover.jpeg files from the track list.
   */
  private async loadAllAlbumTracks() {
    if (!this.albumUrl || !this.currentTrackUrl) {
      this.allAlbumTracks = [];
      return;
    }
    this.allAlbumTracks =
      (await getAllAlbumTracks(this.albumUrl, this.currentTrackUrl)).filter((
        track,
      ) => track.title !== "cover.jpeg");
  }

  /**
   * Play/Pause/Resume/Stop
   * There are 4 different scenarios this supports:
   * 1. If a track is passed in that is not currently being played, it will start playing that track
   * 2. If a track is passed in that is currently being played, it will pause
   * 3. If a track is passed in that is the current track, but it's not currently playing, it will resume
   * 4. If no track is passed in, it will stop playback
   */
  private async playToggle(trackUrl?: string) {
    console.log("playToggle", trackUrl, this.currentTrackUrl, this.isPlaying);
    if (trackUrl) {
      if (trackUrl !== this.currentTrackUrl) {
        this.currentTrackUrl = trackUrl;
        this.setAttribute("data-current-track-url", trackUrl);
        this.isPlaying = true;
        this.setAttribute("data-is-playing", "true");
        this.updateAudioSource();
        this.updateAudioPlayback();
        await this.loadRemainingTracks();
        this.dispatchChangeEvent();
      } else if (this.isPlaying) {
        this.pause();
      } else {
        // Same track, not playing - resume it
        this.isPlaying = true;
        this.setAttribute("data-is-playing", "true");
        this.updateAudioPlayback();
        this.dispatchChangeEvent();
      }
    } else {
      // No track URL - stop playback
      this.currentTrackUrl = null;
      this.removeAttribute("data-current-track-url");
      this.pause();
    }
  }

  /** Pause track */
  private pause() {
    this.isPlaying = false;
    this.setAttribute("data-is-playing", "false");
    this.updateAudioPlayback();
    this.dispatchChangeEvent();
  }

  /** Play next track */
  private playNext() {
    if (this.currentTrackUrl && this.remainingTracks.length > 0) {
      const [nextTrack] = this.remainingTracks;
      if (nextTrack) {
        this.playToggle(nextTrack.url);
      }
    }
  }

  /** Play previous track */
  private playPrev() {
    if (!this.currentTrackUrl || this.allAlbumTracks.length === 0) {
      return;
    }

    const currentTrackPieces = this.currentTrackUrl.split("/");
    const currentTrackKey = currentTrackPieces[currentTrackPieces.length - 1];
    const currentTrackIndex = this.allAlbumTracks.findIndex((track) => {
      const trackPieces = track.url.split("/");
      const trackKey = trackPieces[trackPieces.length - 1];
      return trackKey === currentTrackKey;
    });

    if (currentTrackIndex > 0) {
      const prevTrack = this.allAlbumTracks[currentTrackIndex - 1];
      if (prevTrack) {
        this.playToggle(prevTrack.url);
      }
    }
  }

  /**
   * Dispatches a `change` event when player state changes.
   * Also calls the onchange attribute handler if set.
   * @fires change
   */
  private dispatchChangeEvent() {
    const event = new CustomEvent("change", {
      detail: {
        currentTrack: this.currentTrackUrl,
        isPlaying: this.isPlaying,
      },
      bubbles: true,
      cancelable: false,
    });
    this.dispatchEvent(event);

    // Call onchange attribute handler if set
    const onchangeHandler = this.getAttribute("onchange");
    if (onchangeHandler) {
      try {
        // Try to call as a function name on window
        const handler =
          (window as unknown as Record<string, unknown>)[onchangeHandler];
        if (typeof handler === "function") {
          handler(event);
        }
      } catch (error) {
        console.warn("Failed to call onchange handler:", error);
      }
    }
  }

  private render() {
    const { artistName, albumName } = getParentDataFromTrackUrl(
      this.currentTrackUrl,
    );
    const scrollingText = artistName && albumName
      ? `${albumName}, ${artistName}`
      : null;

    // Determine visibility class
    const visibilityClass = !this.currentTrackUrl ? "translate-y-full" : "";

    // Scrolling text
    const _scrollingTextHtml = scrollingText
      ? `
        <p class="marquee pr-6 md:animate-none">
          <span class="text-sm text-nowrap">${escapeHtml(scrollingText)}</span>
        </p>
        <p class="md:hidden marquee2 pr-6">
          <span class="text-sm text-nowrap">${escapeHtml(scrollingText)}</span>
        </p>
      `
      : "";

    // Determine if there's a previous track (matching playPrev() logic)
    let hasPreviousTrack = false;
    if (this.currentTrackUrl && this.allAlbumTracks.length > 0) {
      const currentTrackPieces = this.currentTrackUrl.split("/");
      const currentTrackKey = currentTrackPieces[currentTrackPieces.length - 1];
      const currentTrackIndex = this.allAlbumTracks.findIndex((track) => {
        const trackPieces = track.url.split("/");
        const trackKey = trackPieces[trackPieces.length - 1];
        return trackKey === currentTrackKey;
      });

      hasPreviousTrack = currentTrackIndex > 0;
    }

    this.innerHTML = `
      <div class="fixed bottom-0 left-0 right-0 w-full p-4 bg-black z-10 h-24 flex justify-between transition-transform ${visibilityClass}">
        <div class="max-sm:basis-3/5 lg:basis-1/5 overflow-x-clip items-center">
          <track-info-custom-element data-track-url="${escapeHtml(this.currentTrackUrl)}"></track-info-custom-element>
        </div>
        <div class="lg:absolute right-0 left-0 h-full pr-6">
          <player-controls-custom-element data-play-state="${this.isPlaying ? "playing" : "paused"}" data-has-previous-track="${hasPreviousTrack ? "true" : "false"}" data-has-next-track="${this.remainingTracks.length > 0 ? "true" : "false"}"></player-controls-custom-element>
        </div>
      </div>
    `;
  }
}

customElements.define(
  "playbar-custom-element",
  PlaybarCustomElement,
);
