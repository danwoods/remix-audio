/** @file Handle all file/directory picker functionality */
import id3 from "mp3tag.js";
import { Form, useFetcher } from "@remix-run/react";
import { createPortal } from "react-dom";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone-esm";

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
  const [hasFiles, setHasFiles] = useState<false | "LOADING" | "COMPLETE">(
    false,
  );
  const fetcher = useFetcher<ActionData>();
  const onDrop = useCallback((acceptedFiles: File[]) => {
    let numOfFilesToProcess = acceptedFiles.length;
    acceptedFiles.forEach((file, idx) => {
      console.log({ file });
      files.set(file.name, file);
      const reader = new FileReader();

      reader.onabort = () => console.log("file reading was aborted");
      reader.onerror = () => console.log("file reading has failed");
      reader.onload = () => {
        // Do whatever you want with the file contents
        const binaryStr = reader.result as Buffer | ArrayBuffer;
        const mp3tag = new id3(binaryStr);
        mp3tag.read();
        if (mp3tag.error !== "") throw new Error(mp3tag.error);
        else console.log(mp3tag.tags);
        const storedFile = files.get(file.name);
        storedFile.binaryStr = binaryStr;
        storedFile.id3 = mp3tag.tags.v1;
        console.log(binaryStr, idx);
        numOfFilesToProcess -= 1;
        if (numOfFilesToProcess === 0) {
          setHasFiles("COMPLETE");
        } else {
          setHasFiles("LOADING");
        }
      };
      reader.readAsArrayBuffer(file);
    });
    console.log({ files });
  }, []);

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  console.log({ fetcher });

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
              {/* {hasFiles === "COMPLETE" ? ( */}
              <div>
                {Array.from(files.values()).map((e) => {
                  console.log({ e });
                  return (
                    <div key={e.id3 && e.id3.title}>{e.id3 && e.id3.title}</div>
                  );
                })}

                <button type="submit">Upload</button>
              </div>
              {/* ) : ( */}
              <div /*{...getRootProps()}*/>
                {/* <input {...getInputProps()} /> */}
                <input
                  id="img-field"
                  type="file"
                  name="img" /*accept="image/*"*/
                  multiple
                />
                <p>Drag and drop some files here, or click to select files</p>
              </div>
              {/* )} */}
            </fetcher.Form>
          </dialog>,
          document.body,
        )}
    </>
  );
};

export default FilePicker;
