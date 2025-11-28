/** @file Handle all file/directory uploading functionality */
import { PlusCircleIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { createPortal } from "react-dom";
import { useState } from "react";

/**
 * UI to process file uploads
 * @returns Button that opens a modal allowing file uploads
 */
const FilePicker = ({ btnClassName }: { btnClassName?: string }) => {
  const [showUploadUI, setShowUploadUI] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasDroppedFiles, setHasDroppedFiles] = useState(false);

  /** Hide modal and cleanup */
  const close = () => {
    setShowUploadUI(false);
    setHasDroppedFiles(false);
    setIsSubmitting(false);
  };

  /** Handle form submission */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const response = await fetch("/", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        // Redirect to home page after successful upload
        window.location.href = "/";
      } else {
        console.error("Upload failed:", response.statusText);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Upload error:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        aria-label="add files"
        className={`btn btn-ghost btn-circle ${btnClassName ? btnClassName : ""}`}
        onClick={() => setShowUploadUI(true)}
      >
        <PlusCircleIcon className="size-6" />
      </button>
      {showUploadUI &&
        createPortal(
          <dialog open={showUploadUI} className="modal">
            <form
              method="post"
              encType="multipart/form-data"
              onSubmit={handleSubmit}
            >
              <div className="modal-box bg-base-300 flex flex-col justify-center rounded">
                <div className="flex justify-end">
                  <button className="btn" type="button" onClick={close}>
                    <XMarkIcon className="size-4" />
                  </button>
                </div>
                <div className="p-4">
                  <input
                    id="files"
                    type="file"
                    name="files"
                    multiple
                    className="file-input w-full"
                    disabled={isSubmitting}
                    onChange={(evt) => {
                      const target = evt.target as HTMLInputElement;
                      if (target?.files && target.files.length > 0) {
                        setHasDroppedFiles(true);
                      }
                    }}
                  />
                </div>
                <button
                  type="submit"
                  className={`btn mt-6 ${isSubmitting || !hasDroppedFiles ? "disabled" : ""}`}
                  disabled={isSubmitting || !hasDroppedFiles}
                >
                  {isSubmitting ? (
                    <span className="loading loading-spinner"></span>
                  ) : (
                    "Upload"
                  )}
                </button>
              </div>
            </form>
          </dialog>,
          document.body,
        )}
    </>
  );
};

export default FilePicker;
