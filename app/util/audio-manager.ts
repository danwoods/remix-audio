/** @file Audio playback manager for managing HTMLAudioElement and playback state */

/**
 * Audio manager that handles audio element lifecycle, playback, and events.
 * Implements EventTarget pattern to emit events for timeupdate, ended, and loadedmetadata.
 */
export class AudioManager extends EventTarget {
  private audioElement: HTMLAudioElement | null = null;
  private nextTrackUrl: string | null = null;
  private nextTrackLoaded: boolean = false;
  private boundHandleTimeUpdate: (event: Event) => void;
  private boundHandleEnded: (event: Event) => void;
  private boundHandleLoadedMetadata: (event: Event) => void;

  /**
   * Initialize the audio manager by creating an audio element
   */
  constructor() {
    super();
    // Bind event handlers once in constructor
    this.boundHandleTimeUpdate = this.handleTimeUpdate.bind(this);
    this.boundHandleEnded = this.handleEnded.bind(this);
    this.boundHandleLoadedMetadata = this.handleLoadedMetadata.bind(this);
    this.createAudioElement();
  }

  /**
   * Create and configure the audio element
   */
  private createAudioElement() {
    if (!this.audioElement) {
      this.audioElement = document.createElement("audio");
      this.audioElement.style.display = "none";
      this.audioElement.addEventListener(
        "timeupdate",
        this.boundHandleTimeUpdate,
      );
      this.audioElement.addEventListener("ended", this.boundHandleEnded);
      this.audioElement.addEventListener(
        "loadedmetadata",
        this.boundHandleLoadedMetadata,
      );
      document.body.appendChild(this.audioElement);
    }
  }

  /**
   * Set the current track URL
   *
   * @param url - The URL of the track to play, or null to stop playback
   */
  setTrack(url: string | null) {
    if (!this.audioElement) {
      this.createAudioElement();
    }

    if (url) {
      this.audioElement!.src = url;
      this.nextTrackLoaded = false;
    } else {
      this.audioElement!.src = "";
      this.audioElement!.pause();
    }
  }

  /**
   * Start or resume playback
   *
   * @throws Error if playback fails
   */
  async play() {
    if (!this.audioElement || !this.audioElement.src) {
      return;
    }

    try {
      await this.audioElement.play();
    } catch (error) {
      console.error("Failed to play audio:", error);
      throw error;
    }
  }

  /**
   * Pause playback
   */
  pause() {
    if (this.audioElement) {
      this.audioElement.pause();
    }
  }

  /**
   * Get the current playback time in seconds
   *
   * @returns Current time, or 0 if not available
   */
  getCurrentTime(): number {
    if (!this.audioElement) {
      return 0;
    }
    return this.audioElement.currentTime || 0;
  }

  /**
   * Get the total duration of the track in seconds
   *
   * @returns Duration, or NaN if not available
   */
  getDuration(): number {
    if (!this.audioElement) {
      return NaN;
    }
    return this.audioElement.duration || NaN;
  }

  /**
   * Set the URL of the next track to preload
   *
   * @param url - The URL of the next track, or null to clear
   */
  setNextTrack(url: string | null) {
    this.nextTrackUrl = url;
    this.nextTrackLoaded = false;
  }

  /**
   * Handle timeupdate event from audio element
   */
  private handleTimeUpdate(event: Event) {
    const audio = event.target as HTMLAudioElement;
    if (
      !this.nextTrackLoaded &&
      !Number.isNaN(audio.duration) &&
      audio.duration - 20 < audio.currentTime &&
      this.nextTrackUrl
    ) {
      // Preload the next track when within 20s of the end
      this.nextTrackLoaded = true;
      new Audio(this.nextTrackUrl);
    }

    // Dispatch timeupdate event
    this.dispatchEvent(new Event("timeupdate"));
  }

  /**
   * Handle ended event from audio element
   */
  private handleEnded() {
    this.dispatchEvent(new Event("ended"));
  }

  /**
   * Handle loadedmetadata event from audio element
   */
  private handleLoadedMetadata() {
    this.dispatchEvent(new Event("loadedmetadata"));
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.audioElement) {
      this.audioElement.removeEventListener(
        "timeupdate",
        this.boundHandleTimeUpdate,
      );
      this.audioElement.removeEventListener("ended", this.boundHandleEnded);
      this.audioElement.removeEventListener(
        "loadedmetadata",
        this.boundHandleLoadedMetadata,
      );
      this.audioElement.pause();
      this.audioElement.src = "";
      if (this.audioElement.parentNode) {
        this.audioElement.parentNode.removeChild(this.audioElement);
      }
      this.audioElement = null;
    }
  }
}
