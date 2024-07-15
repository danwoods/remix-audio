/** @file Handle all file/directory picker functionality */
import { Form, useFetcher } from "@remix-run/react";
import { createPortal } from "react-dom";
import { useState } from "react";

const files = new Map();

type ActionData = {
  errorMsg?: string;
  imgSrc?: string;
  imgDesc?: string;
};

/**
 * UI to process file uploads
 * @returns Button that opens a modal allowing file uploads
 */
const FilePicker = () => {
  const [showUploadUI, setShowUploadUI] = useState(false);
  const fetcher = useFetcher<ActionData>();

  return (
    <>
      <Form id="add-files">
        <button type="button" onClick={() => setShowUploadUI(true)}>
          Add Files
        </button>
      </Form>
      {showUploadUI &&
        createPortal(
          <dialog open style={{ padding: 0, top: 24 }}>
            <fetcher.Form method="post" encType="multipart/form-data">
              <div>
                {Array.from(files.values()).map((e) => {
                  console.log({ e });
                  return (
                    <div key={e.id3 && e.id3.title}>{e.id3 && e.id3.title}</div>
                  );
                })}
                <button type="submit">Upload</button>
              </div>
              <div>
                <input id="files" type="file" name="files" multiple />
              </div>
            </fetcher.Form>
          </dialog>,
          document.body,
        )}
    </>
  );
};

export default FilePicker;
