// XXX: ALWAYS ALLOW MULTIPLE
/**
 * Open file picker dialog
 * @param multiple {Boolean} Whether or not to allow multiple file uploads
 * @returns Promise
 */
export const openFileOrFiles = async (multiple = false): Promise<FileSystemFileHandle | FileSystemFileHandle[] | FileList | File | undefined> => {
  // Feature detection. The API needs to be supported
  // and the app not run in an iframe.
  const supportsFileSystemAccess =
    "showOpenFilePicker" in window &&
    (() => {
      try {
        return window.self === window.top;
      } catch {
        return false;
      }
    })();

  // If the File System Access API is supported…
  if (supportsFileSystemAccess) {
    let fileOrFiles = undefined;
    try {
      // Show the file picker, optionally allowing multiple files.
      fileOrFiles = await showOpenFilePicker({ multiple });
      if (!multiple) {
        // Only one file is requested.
        fileOrFiles = fileOrFiles[0];
      }
    } catch (e) {
      const err = e as Error;
      // Fail silently if the user has simply canceled the dialog.
      if (err.name !== "AbortError") {
        console.error(err.name, err.message);
      }
    }
    return fileOrFiles;
  }
  // Fallback if the File System Access API is not supported.
  return new Promise((resolve) => {
    // Append a new `` and hide it.
    const input = document.createElement("input");
    input.style.display = "none";
    input.type = "file";
    document.body.append(input);
    if (multiple) {
      input.multiple = true;
    }
    // The `change` event fires when the user interacts with the dialog.
    input.addEventListener("change", () => {
      // Remove the `` again from the DOM.
      input.remove();
      // If no files were selected, return.
      if (!input.files) {
        return;
      }
      // Return all files or just one file.
      resolve(multiple ? input.files : input.files[0]);
    });
    // Show the picker.
    if ("showPicker" in HTMLInputElement.prototype) {
      input.showPicker();
    } else {
      input.click();
    }
  });
};
