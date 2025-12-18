/** @file Custom element for player controls seen at the bottom of the screen */

import { getBucketContents } from "../../../../lib/s3.ts";

/**
 * Parses track metadata from a track URL.
 *
 * @param trackUrl - The full track URL in format: `{baseUrl}/{artistName}/{albumName}/{trackNumber}__{trackName}.{ext}`
 * @returns An object containing parsed track information
 * @returns `artistName` - The artist name extracted from the URL path
 * @returns `albumName` - The album name extracted from the URL path
 * @returns `trackName` - The track name extracted from the filename (after `__` separator)
 * @returns `trackNumber` - The track number extracted from the filename (before `__` separator)
 *
 * @example
 * ```typescript
 * const url = "https://bucket.s3.amazonaws.com/Artist/Album/01__Track Name.mp3";
 * const data = getParentDataFromTrackUrl(url);
 * // Returns: { artistName: "Artist", albumName: "Album", trackName: "Track Name", trackNumber: "01" }
 * ```
 *
 * @remarks
 * The URL format is expected to be:
 * - Path segments: `.../{artist}/{album}/{filename}`
 * - Filename format: `{number}__{name}.{ext}` (double underscore separator)
 * - Returns `null` values if the URL is null or doesn't match the expected format
 */
const getParentDataFromTrackUrl = (trackUrl: string | null) => {
  if (!trackUrl) {
    return {
      artistName: null,
      albumName: null,
      trackName: null,
      trackNumber: null,
    };
  }

  const currentTrackPieces = trackUrl.split("/");
  const artistName = currentTrackPieces[currentTrackPieces.length - 3];
  const albumName = currentTrackPieces[currentTrackPieces.length - 2];
  const trackPieces = currentTrackPieces[currentTrackPieces.length - 1].split(
    "__",
  );
  const trackName = trackPieces && trackPieces[1];
  const trackNumber = trackPieces && trackPieces[0];

  return {
    artistName,
    albumName,
    trackName,
    trackNumber,
  };
};

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Get remaining tracks in album after current track
 */
const getRemainingAlbumTracks = async (
  albumUrl: string,
  currentTrackUrl: string,
): Promise<Array<{ url: string; title: string; trackNum: number }>> => {
  const { artistName, albumName } = getParentDataFromTrackUrl(currentTrackUrl);
  if (!artistName || !albumName) {
    return [];
  }

  const albumUrlParts = albumUrl.split("/");
  const bucketUrl = albumUrlParts.join("/");
  const prefix = `${artistName}/${albumName}/`;
  const contents = (await getBucketContents(bucketUrl, prefix)).filter(
    (key): key is string => key !== null && key !== undefined,
  );

  const currentTrackPieces = currentTrackUrl.split("/");
  const currentTrackKey = currentTrackPieces[currentTrackPieces.length - 1];
  const currentTrackIndex = contents.findIndex((key) => {
    // Extract filename from full key path for comparison
    const keyFilename = key.split("/").pop();
    return keyFilename === currentTrackKey;
  });

  if (currentTrackIndex === -1) {
    return [];
  }

  const remainingKeys = contents.slice(currentTrackIndex + 1);
  const tracks = remainingKeys.map((key) => {
    // Extract filename from full key path
    const filename = key.split("/").pop() || key;
    const trackPieces = filename.split("__");
    const trackNum = parseInt(trackPieces[0], 10) || 0;
    const title = trackPieces[1] || filename;
    const fullUrl = `${bucketUrl}/${key}`;

    return {
      url: fullUrl,
      title,
      trackNum,
    };
  });

  return tracks.sort((a, b) => a.trackNum - b.trackNum);
};

/**
 * Custom element for player controls displayed at the bottom of the screen.
 * This element is self-contained and manages all player logic internally.
 *
 * The element is controlled entirely through HTML attributes. User interactions
 * (play/pause/next buttons, playlist selection) are handled internally. External
 * code can control playback by setting attributes and react to state changes via
 * the `change` event or `onchange` attribute.
 *
 * @customElement player-controls-custom-element
 *
 * @example
 * ```html
 * <player-controls-custom-element
 *   data-album-url="https://bucket.s3.amazonaws.com"
 *   data-current-track-url="https://bucket.s3.amazonaws.com/artist/album/01__Track Name.mp3"
 *   data-is-playing="true"
 *   onchange="handlePlayerChange">
 * </player-controls-custom-element>
 * ```
 *
 * @example
 * ```javascript
 * const playerControls = document.querySelector('player-controls-custom-element');
 *
 * // Listen for state change events
 * playerControls.addEventListener('change', (event) => {
 *   console.log('Player state changed:', {
 *     currentTrack: event.detail.currentTrack,
 *     isPlaying: event.detail.isPlaying
 *   });
 * });
 *
 * // Control playback by setting attributes
 * playerControls.setAttribute('data-current-track-url', 'https://.../track.mp3');
 * playerControls.setAttribute('data-is-playing', 'true');
 *
 * // To pause, set is-playing to false
 * playerControls.setAttribute('data-is-playing', 'false');
 *
 * // To stop, remove the current track URL
 * playerControls.removeAttribute('data-current-track-url');
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
export class PlayerControlsCustomElement extends HTMLElement {
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
  private loadTracksPromise: Promise<void> | null = null;
  private boundHandleClick: (event: Event) => void;
  private audioElement: HTMLAudioElement | null = null;
  private boundTimeUpdate: (event: Event) => void;
  private boundEnded: (event: Event) => void;

  constructor() {
    super();
    // Use event delegation to avoid memory leaks
    // Store bound function so we can remove it later
    this.boundHandleClick = this.handleClick.bind(this);
    this.boundTimeUpdate = this.handleTimeUpdate.bind(this);
    this.boundEnded = this.handleEnded.bind(this);
  }

  connectedCallback() {
    // Ensure the custom element displays as a block element with full width
    this.style.display = "block";
    this.style.width = "100%";

    this.addEventListener("click", this.boundHandleClick);
    this.createAudioElement();
    this.updateAttributes();
    this.render();
  }

  disconnectedCallback() {
    // Remove event listeners on disconnect
    this.removeEventListener("click", this.boundHandleClick);
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

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    _newValue: string | null,
  ) {
    if (name === "data-current-track-url") {
      // Only update if different to avoid unnecessary re-renders
      if (this.currentTrackUrl !== _newValue) {
        this.currentTrackUrl = _newValue;
        this.updateAudioSource();
        this.loadRemainingTracks();
        this.dispatchChangeEvent();
      }
    } else if (name === "data-is-playing") {
      const newIsPlaying = _newValue === "true";
      if (this.isPlaying !== newIsPlaying) {
        this.isPlaying = newIsPlaying;
        this.updateAudioPlayback();
        this.dispatchChangeEvent();
      }
    } else if (name === "data-album-url") {
      if (this.albumUrl !== _newValue) {
        this.albumUrl = _newValue;
        this.loadRemainingTracks();
      }
    }

    this.render();
  }

  private async updateAttributes() {
    this.currentTrackUrl = this.getAttribute("data-current-track-url");
    this.isPlaying = this.getAttribute("data-is-playing") === "true";
    this.albumUrl = this.getAttribute("data-album-url");
    await this.loadRemainingTracks();
  }

  private createAudioElement() {
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

  private async loadRemainingTracks() {
    // Prevent multiple concurrent loads
    if (this.loadTracksPromise) {
      return this.loadTracksPromise;
    }

    this.loadTracksPromise = (async () => {
      try {
        if (this.albumUrl && this.currentTrackUrl) {
          this.remainingTracks = await getRemainingAlbumTracks(
            this.albumUrl,
            this.currentTrackUrl,
          );
          this.render();
        } else {
          this.remainingTracks = [];
        }
      } catch (error) {
        console.error("Failed to load remaining tracks:", error);
        this.remainingTracks = [];
      } finally {
        this.loadTracksPromise = null;
      }
    })();

    return this.loadTracksPromise;
  }

  /**
   * Play/Pause/Resume/Stop
   * There are 4 different scenarios this supports:
   * 1. If a track is passed in that is not currently being played, it will start playing that track
   * 2. If a track is passed in that is currently being played, it will pause
   * 3. If a track is passed in that is the current track, but it's not currently playing, it will resume
   * 4. If no track is passed in, it will stop playback
   */
  private playToggle(trackUrl?: string) {
    if (trackUrl) {
      if (trackUrl !== this.currentTrackUrl) {
        this.currentTrackUrl = trackUrl;
        this.setAttribute("data-current-track-url", trackUrl);
        this.isPlaying = true;
        this.setAttribute("data-is-playing", "true");
        this.updateAudioSource();
        this.updateAudioPlayback();
        this.loadRemainingTracks();
        this.dispatchChangeEvent();
      } else if (this.isPlaying) {
        this.pause();
      } else {
        this.isPlaying = true;
        this.setAttribute("data-is-playing", "true");
        this.updateAudioPlayback();
        this.dispatchChangeEvent();
      }
    } else {
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
    const { artistName, albumName, trackName } = getParentDataFromTrackUrl(
      this.currentTrackUrl,
    );
    const scrollingText = artistName && albumName
      ? `${albumName}, ${artistName}`
      : null;

    // Determine visibility class
    const visibilityClass = !this.currentTrackUrl ? "translate-y-full" : "";

    // Play/Pause icon SVG
    let playPauseIcon = "";
    if (!this.currentTrackUrl) {
      playPauseIcon =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
        <path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.285L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" />
      </svg>`;
    } else if (!this.isPlaying) {
      playPauseIcon =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6 animate-pulse">
        <path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.285L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" />
      </svg>`;
    } else {
      playPauseIcon =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-8">
        <path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clip-rule="evenodd" />
      </svg>`;
    }

    // Album art element
    const albumArtElement = this.albumUrl
      ? `<album-image-custom-element data-album-url="${
        escapeHtml(this.albumUrl)
      }" class="rounded z-10 size-20"></album-image-custom-element>`
      : `<img alt="album art" src="https://placehold.co/100x100?text=." class="rounded z-10 size-20" />`;

    // Track name
    const trackNameHtml = trackName
      ? `<p class="text-base font-bold">${escapeHtml(trackName)}</p>`
      : "";

    // Scrolling text
    const scrollingTextHtml = scrollingText
      ? `
        <p class="marquee pr-6 md:animate-none">
          <span class="text-sm text-nowrap">${escapeHtml(scrollingText)}</span>
        </p>
        <p class="md:hidden marquee2 pr-6">
          <span class="text-sm text-nowrap">${escapeHtml(scrollingText)}</span>
        </p>
      `
      : "";

    // Playlist dropdown
    const playlistItems = this.remainingTracks
      .map(
        (track) => `
      <li>
        <button class="py-1 w-full flex justify-between px-0" data-track-url="${
          escapeHtml(track.url)
        }">
          ${escapeHtml(track.title)}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
            <path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.285L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" />
          </svg>
        </button>
      </li>
    `,
      )
      .join("");

    const playlistHtml = `
      <div class="relative cursor-default">
        <button class="p-2 rounded mr-6 ${
      !this.remainingTracks.length ? "opacity-50 cursor-not-allowed" : ""
    }">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
            <path d="M5.507 4.048A3 3 0 0 1 7.785 3h8.43a3 3 0 0 1 2.278 1.048l1.722 2.008A4.533 4.533 0 0 1 19.5 6.166v11.668a4.533 4.533 0 0 1-1.285 3.11l-1.722 2.008A3 3 0 0 1 16.215 21H7.785a3 3 0 0 1-2.278-1.048l-1.722-2.008A4.533 4.533 0 0 1 2.5 17.834V6.166a4.533 4.533 0 0 1 1.285-3.11l1.722-2.008Z" />
            <path fill-rule="evenodd" d="M6.75 8.25a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd" />
          </svg>
        </button>
        <ol class="absolute bottom-full right-0 mb-2 bg-black rounded z-[1] w-52 p-2 shadow divide-y divide-solid">
          ${playlistItems}
        </ol>
      </div>
    `;

    this.innerHTML = `
      <div class="fixed bottom-0 left-0 right-0 w-full p-4 bg-base-100 z-10 h-fit flex justify-between transition-transform ${visibilityClass}">
        <div class="max-sm:basis-3/5 lg:basis-5/12 overflow-x-clip items-start">
          <div class="flex cursor-default">
            ${albumArtElement}
            <div class="ml-3 pt-2">
              ${trackNameHtml}
              <div class="flex items-center">
                ${scrollingTextHtml}
              </div>
            </div>
          </div>
        </div>
        <div class="basis-2/5">
          <div class="flex justify-evenly w-full cursor-default">
            <button class="max-sm:hidden">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
                <path d="M9.195 18.44c1.25.714 2.805-.189 2.805-1.628v-4.084l5.391 3.584c1.25.714 2.805-.188 2.805-1.628V7.284c0-1.44-1.555-2.342-2.805-1.628L12 9.23V5.153c0-1.44-1.555-2.343-2.805-1.629l-7.5 4.27a1.875 1.875 0 0 0 0 3.212l7.5 4.27Z" />
              </svg>
            </button>
            <button class="md:px-6" data-play-toggle>
              ${playPauseIcon}
            </button>
            <button data-play-next>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
                <path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.285L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        <div class="max-sm:basis-1/5 max-sm:hidden lg:basis-5/12 items-end">
          ${playlistHtml}
        </div>
      </div>
    `;
  }

  private handleClick(event: Event) {
    const target = event.target as HTMLElement;
    const button = target.closest("button");

    if (!button) return;

    // Play/Pause button
    if (button.hasAttribute("data-play-toggle")) {
      if (this.currentTrackUrl) {
        this.playToggle(this.currentTrackUrl);
      }
      return;
    }

    // Play Next button
    if (button.hasAttribute("data-play-next")) {
      this.playNext();
      return;
    }

    // Playlist items
    const trackUrl = button.getAttribute("data-track-url");
    if (trackUrl) {
      this.playToggle(trackUrl);
    }
  }
}

customElements.define(
  "player-controls-custom-element",
  PlayerControlsCustomElement,
);
