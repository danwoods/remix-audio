/** @file Custom element for player controls seen at the bottom of the screen */

import { getBucketContents } from "../../../../lib/s3.ts";
import "../../../icons/play/index.ts";
import "../../../icons/pause/index.ts";
import "../../../icons/prev/index.ts";
import "../../../icons/next/index.ts";
import "../../../icons/playlist/index.ts";

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

  // Extract base bucket URL from albumUrl
  // albumUrl format: https://bucket.s3.region.amazonaws.com/artist/album
  // We need: https://bucket.s3.region.amazonaws.com
  const urlObj = new URL(albumUrl);
  const bucketUrl = `${urlObj.protocol}//${urlObj.host}`;
  const prefix = `${artistName}/${albumName}/`;

  let contents: string[] = [];
  try {
    const rawContents = await getBucketContents(bucketUrl, prefix);
    contents = rawContents.filter(
      (key): key is string => key !== null && key !== undefined,
    );
  } catch (error) {
    console.error(
      "getRemainingAlbumTracks: Error fetching bucket contents:",
      error,
    );
    throw error;
  }

  const currentTrackPieces = currentTrackUrl.split("/");
  let currentTrackKey = currentTrackPieces[currentTrackPieces.length - 1];
  // Decode URL encoding in case the track URL is encoded
  try {
    currentTrackKey = decodeURIComponent(currentTrackKey);
  } catch {
    // If decoding fails, use as-is
  }
  // Remove file extension if present for matching
  const currentTrackKeyNoExt = currentTrackKey.replace(/\.[^.]+$/, "");
  const currentTrackIndex = contents.findIndex((key) => {
    // Extract filename from full key path for comparison
    const keyFilename = key.split("/").pop() || "";
    const keyFilenameNoExt = keyFilename.replace(/\.[^.]+$/, "");

    // Try multiple matching strategies:
    // 1. Exact match
    // 2. Match without extension
    // 3. Match with URL decoding
    // 4. Match single underscore with double underscore (2_Plateau matches 2__Plateau)
    const normalizedCurrent = currentTrackKeyNoExt.replace(/_/g, "__");
    const normalizedKey = keyFilenameNoExt.replace(/_/g, "__");

    return keyFilename === currentTrackKey ||
      keyFilenameNoExt === currentTrackKeyNoExt ||
      normalizedKey === normalizedCurrent ||
      decodeURIComponent(keyFilename) === currentTrackKey ||
      keyFilename === encodeURIComponent(currentTrackKey);
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
  private allAlbumTracks: Array<{
    url: string;
    title: string;
    trackNum: number;
  }> = [];
  private loadTracksPromise: Promise<void> | null = null;
  private playlistOpen: boolean = false;
  private boundHandleClick: (event: Event) => void;
  private audioElement: HTMLAudioElement | null = null;
  private boundTimeUpdate: (event: Event) => void;
  private boundEnded: (event: Event) => void;
  private boundHandleDocumentClick: (event: Event) => void;

  constructor() {
    super();
    // Use event delegation to avoid memory leaks
    // Store bound function so we can remove it later
    this.boundHandleClick = this.handleClick.bind(this);
    this.boundTimeUpdate = this.handleTimeUpdate.bind(this);
    this.boundEnded = this.handleEnded.bind(this);
    this.boundHandleDocumentClick = this.handleDocumentClick.bind(this);
  }

  connectedCallback() {
    // Ensure the custom element displays as a block element with full width
    this.style.display = "block";
    this.style.width = "100%";

    this.addEventListener("click", this.boundHandleClick);
    // Close playlist dropdown when clicking outside
    document.addEventListener("click", this.handleDocumentClick);
    this.createAudioElement();
    this.updateAttributes();
    this.render();
  }

  disconnectedCallback() {
    // Remove event listeners on disconnect
    this.removeEventListener("click", this.boundHandleClick);
    document.removeEventListener("click", this.boundHandleDocumentClick);
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
   * Load all tracks in the album for prev button functionality
   */
  private async loadAllAlbumTracks() {
    if (!this.albumUrl || !this.currentTrackUrl) {
      this.allAlbumTracks = [];
      return;
    }

    try {
      const { artistName, albumName } = getParentDataFromTrackUrl(
        this.currentTrackUrl,
      );
      if (!artistName || !albumName) {
        this.allAlbumTracks = [];
        return;
      }

      // Extract base bucket URL from albumUrl
      const urlObj = new URL(this.albumUrl);
      const bucketUrl = `${urlObj.protocol}//${urlObj.host}`;
      const prefix = `${artistName}/${albumName}/`;

      const contents = (await getBucketContents(bucketUrl, prefix)).filter(
        (key): key is string => key !== null && key !== undefined,
      );

      this.allAlbumTracks = contents
        .map((key) => {
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
        })
        .sort((a, b) => a.trackNum - b.trackNum);
    } catch (error) {
      console.error("Failed to load all album tracks:", error);
      this.allAlbumTracks = [];
    }
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
      playPauseIcon = "<play-icon></play-icon>";
    } else if (!this.isPlaying) {
      playPauseIcon = "<play-icon class='animate-pulse'></play-icon>";
    } else {
      playPauseIcon = "<pause-icon></pause-icon>";
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
          <play-icon></play-icon>
        </button>
      </li>
    `,
      )
      .join("");

    const playlistHtml = `
      <div class="relative">
        <button class="p-2 rounded mr-6 cursor-pointer ${
      !this.remainingTracks.length ? "opacity-50 cursor-not-allowed" : ""
    }" data-playlist-toggle>
          <playlist-icon></playlist-icon>
        </button>
        <ol class="absolute bottom-full right-0 mb-2 bg-black rounded z-[1] w-52 p-2 shadow divide-y divide-solid ${
      this.playlistOpen && this.remainingTracks.length > 0 ? "" : "hidden"
    }">
          ${playlistItems}
        </ol>
      </div>
    `;

    this.innerHTML = `
      <div class="fixed bottom-0 left-0 right-0 w-full p-4 bg-black z-10 h-fit flex justify-between items-center transition-transform ${visibilityClass}">
        <div class="max-sm:basis-3/5 lg:basis-5/12 overflow-x-clip items-center">
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
        <div class="basis-2/5 h-full">
          <div class="flex justify-evenly w-full cursor-pointer">
            <button class="max-sm:hidden" data-play-prev>
              <prev-icon></prev-icon>
            </button>
            <button class="md:px-6 cursor-pointer" data-play-toggle>
              ${playPauseIcon}
            </button>
            <button class="cursor-pointer" data-play-next>
              <next-icon></next-icon>
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

    // Stop event propagation for playlist button to prevent document click handler from closing it immediately
    if (button.hasAttribute("data-playlist-toggle")) {
      event.stopPropagation();
      // Allow toggling even if tracks haven't loaded yet (will show empty or loading state)
      this.playlistOpen = !this.playlistOpen;
      this.render();
      // If tracks haven't loaded yet, try loading them
      if (
        this.remainingTracks.length === 0 && this.albumUrl &&
        this.currentTrackUrl
      ) {
        this.loadRemainingTracks();
      }
      return;
    }

    // Play/Pause button
    if (button.hasAttribute("data-play-toggle")) {
      if (this.currentTrackUrl) {
        this.playToggle(this.currentTrackUrl);
      }
      return;
    }

    // Play Previous button
    if (button.hasAttribute("data-play-prev")) {
      this.playPrev();
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
      this.playlistOpen = false; // Close dropdown when selecting a track
      this.playToggle(trackUrl);
    }
  }

  private handleDocumentClick(event: Event) {
    // Close playlist dropdown if clicking outside
    const target = event.target as HTMLElement;
    const playlistContainer = this.querySelector("[data-playlist-toggle]")
      ?.closest(".relative");
    if (playlistContainer && !playlistContainer.contains(target)) {
      if (this.playlistOpen) {
        this.playlistOpen = false;
        this.render();
      }
    }
  }
}

customElements.define(
  "player-controls-custom-element",
  PlayerControlsCustomElement,
);
