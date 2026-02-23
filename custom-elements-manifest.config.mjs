/** @file Custom Elements Manifest analyzer configuration. */

export default {
  globs: [
    "app/components/**/*-custom-element.ts",
    "app/icons/**/index.ts",
  ],
  exclude: [
    "**/*.test.ts",
  ],
  packagejson: false,
};
