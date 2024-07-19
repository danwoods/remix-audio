/** @file Handle all file/directory uploading functionality */
import { Form, useFetcher } from "@remix-run/react";
import { PlusCircleIcon } from "@heroicons/react/24/solid";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

/**
 * UI to process file uploads
 * @returns Button that opens a modal allowing file uploads
 */
const FilePicker = () => {
  const [showUploadUI, setShowUploadUI] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasDroppedFiles, setHasDroppedFiles] = useState(false);
  const inputRef = useRef(null);
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.state === "submitting") {
      setIsSubmitting(true);
    } else if (fetcher.state === "idle" && isSubmitting) {
      // Hide modal and cleanup
      setShowUploadUI(false);
      setHasDroppedFiles(false);
      setIsSubmitting(false);
    }
  }, [fetcher.state, isSubmitting]);

  return (
    <>
      <Form id="add-files">
        <button type="button" onClick={() => setShowUploadUI(true)}>
          <PlusCircleIcon className="size-6" />
        </button>
      </Form>
      {showUploadUI &&
        createPortal(
          <dialog open={showUploadUI} className="modal p8">
            <fetcher.Form method="post" encType="multipart/form-data">
              <div className="modal-box bg-base-300 flex flex-col justify-center rounded">
                <div>
                  <input
                    id="files"
                    type="file"
                    name="files"
                    multiple
                    disabled={isSubmitting}
                    ref={inputRef}
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
            </fetcher.Form>
          </dialog>,
          document.body,
        )}
    </>
  );
};

export default FilePicker;
