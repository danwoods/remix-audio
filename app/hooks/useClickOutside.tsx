import type { RefObject } from "react";

import { useEffect } from "react";

/** Detect clicks outside element */
const useClickOutside = <T extends HTMLElement = HTMLElement>(
  ref: RefObject<T>,
  callback: (event: MouseEvent | TouchEvent | FocusEvent) => void,
) => {
  const handleClick = (e: MouseEvent | TouchEvent | FocusEvent) => {
    const target = e.target as HTMLElement;
    if (ref.current && !ref.current.contains(target)) {
      callback(e);
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  });
};

export default useClickOutside;
