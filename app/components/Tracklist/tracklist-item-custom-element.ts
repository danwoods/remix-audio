/** @file Custom element for a tracklist item. */

/**
 * Custom element for a track list item. Handles loading the track duration.
 */
export class TracklistItemCustomElement extends HTMLElement {
  static observedAttributes = [
    "data-track-name",
    "data-track-artist",
    "data-track-number",
    "data-track-url",
  ];

  private trackName: string | null = null;
  private trackArtist: string | null = null;
  private trackDuration: string | null = null;
  private trackNumber: string | null = null;

  setTrackDuration(_evt: Event, audio: HTMLAudioElement) {
    // Validate duration
    if (!audio.duration || !isFinite(audio.duration) || isNaN(audio.duration)) {
      console.warn("Invalid duration for track", {
        trackName: this.trackName,
        duration: audio.duration,
      });
      return;
    }

    const minutes = Math.floor(audio.duration / 60);
    const seconds = Math.floor(audio.duration % 60);
    this.trackDuration = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    const durElement = this.querySelector(".track-duration") as HTMLElement;
    if (durElement) {
      durElement.textContent = this.trackDuration;
    }
  }

  private loadTrackDuration(trackUrl: string) {
    if (!trackUrl) {
      console.warn("No track URL provided for track", this.trackName);
      return;
    }

    const audio = new Audio(trackUrl);

    // Set preload to metadata to ensure metadata is loaded
    audio.preload = "metadata";

    // Handle errors (including 416 Range Not Satisfiable)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleError = (_evt: Event) => {
      const error = audio.error;
      console.error("Failed to load audio metadata", {
        trackName: this.trackName,
        trackUrl,
        errorCode: error?.code,
        errorMessage: error?.message,
        networkState: audio.networkState,
        readyState: audio.readyState,
      });

      // Clean up listeners
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("error", handleError);

      // Optionally show a fallback or retry
      const durElement = this.querySelector(".track-duration") as HTMLElement;
      if (durElement && !this.trackDuration) {
        durElement.textContent = "--:--";
      }
    };

    // Handle successful metadata load
    const handleLoadedMetadata = (evt: Event) => {
      this.setTrackDuration(evt, audio);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("error", handleError);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("error", handleError);

    // Try to load metadata
    audio.load();
  }

  constructor() {
    super();

    this.trackName = this.getAttribute("data-track-name") || "";
    this.trackArtist = this.getAttribute("data-track-artist") || "";
    this.trackNumber = this.getAttribute("data-track-number") || "";

    // Handle loading the track duration
    const trackUrl = this.getAttribute("data-track-url") || "";
    this.loadTrackDuration(trackUrl);

    this.innerHTML = `
      <div class="track">
        <span class="track-number">${this.trackNumber}</span>
        <div class="track-info">
          <div class="track-name">${this.trackName}</div>
          <div class="track-artist">${this.trackArtist}</div>
        </div>
        <span class="track-duration">${this.trackDuration}</span>
      </div>
    `;
  }

  connectedCallback() {
  }

  disconnectedCallback() {
    console.log("Custom element removed from page.");
  }

  connectedMoveCallback() {
    console.log("Custom element moved with moveBefore()");
  }

  adoptedCallback() {
    console.log("Custom element moved to new page.");
  }

  attributeChangedCallback(
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _oldValue: string | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _newValue: string | null,
  ) {
    console.log(`Attribute ${name} has changed.`);
  }
}

customElements.define(
  "tracklist-item-custom-element",
  TracklistItemCustomElement,
);
