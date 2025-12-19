/**
 * Merges default classes with custom classes, intelligently handling conflicts.
 *
 * If custom classes include a class that conflicts with a default class (e.g.,
 * both have "size-*"), the custom class takes precedence.
 *
 * @param defaultClasses - Space-separated default classes (e.g., "size-6")
 * @param customClasses - Space-separated custom classes (e.g., "text-blue-500 size-8")
 * @returns Merged class string with conflicts resolved
 *
 * @example
 * ```ts
 * mergeClasses("size-6", "text-blue-500") // "size-6 text-blue-500"
 * mergeClasses("size-6", "size-8") // "size-8"
 * mergeClasses("size-6", "size-8 text-blue-500") // "size-8 text-blue-500"
 * ```
 */
export function mergeClasses(
  defaultClasses: string,
  customClasses: string,
): string {
  if (!customClasses.trim()) {
    return defaultClasses.trim();
  }

  const defaultList = defaultClasses.trim().split(/\s+/).filter(Boolean);
  const customList = customClasses.trim().split(/\s+/).filter(Boolean);

  // Filter out default classes that conflict with custom classes
  const filteredDefaults = defaultList.filter((defaultClass) => {
    const prefix = defaultClass.match(/^([a-z]+(-[a-z]+)*)-/)?.[1];
    if (!prefix) return true; // Keep classes without prefixes
    return !customList.some((customClass) =>
      customClass.startsWith(`${prefix}-`)
    );
  });

  // Combine filtered defaults with custom classes
  return [...filteredDefaults, ...customList].join(" ").trim();
}

/**
 * Applies merged classes to an element using setAttribute (works for both HTML and SVG).
 *
 * @param element - The element to apply classes to
 * @param defaultClasses - Space-separated default classes
 * @param customClasses - Space-separated custom classes from the custom element
 */
export function applyMergedClasses(
  element: Element,
  defaultClasses: string,
  customClasses: string,
): void {
  const merged = mergeClasses(defaultClasses, customClasses);
  console.log("applyMergedClasses", defaultClasses, customClasses, merged);
  element.setAttribute("class", merged);
}
