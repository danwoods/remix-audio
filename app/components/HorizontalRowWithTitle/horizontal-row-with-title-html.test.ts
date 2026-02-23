/** @file Tests for horizontal row with title HTML function.
 *
 * Verifies the section structure, title rendering, XSS escaping for the title,
 * and children HTML injection into the grid.
 *
 * Uses linkedom to parse the returned HTML and assert on DOM structure.
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { parseHtmlFragment } from "../test.utils.ts";
import horizontalRowWithTitleHtml from "./horizontal-row-with-title-html.ts";

// ============================================================================
// TESTS
// ============================================================================

Deno.test(
  "horizontalRowWithTitleHtml returns section with title and grid structure",
  () => {
    const html = horizontalRowWithTitleHtml({
      title: "Recently Played",
      children: [],
    });

    const document = parseHtmlFragment(html);
    const section = document.querySelector("section");
    const titleP = document.querySelector("section > p");
    const gridDiv = document.querySelector("section > div");

    assertExists(section, "Output should have a section element");
    assertEquals(
      section.getAttribute("class"),
      "py-4 pl-4",
      "Section should have expected classes",
    );

    assertExists(titleP, "Output should have a title paragraph");
    assertEquals(
      titleP.getAttribute("class"),
      "text-lg font-bold mb-2",
      "Title paragraph should have expected classes",
    );
    assertEquals(
      titleP.textContent,
      "Recently Played",
      "Title text should be rendered",
    );

    assertExists(gridDiv, "Output should have a grid div");
  },
);

Deno.test(
  "horizontalRowWithTitleHtml renders children in grid",
  () => {
    const html = horizontalRowWithTitleHtml({
      title: "Albums",
      children: [
        '<img src="/a1.jpg" alt="Album 1" />',
        '<img src="/a2.jpg" alt="Album 2" />',
      ],
    });

    const document = parseHtmlFragment(html);
    const gridDiv = document.querySelector("section > div");
    const imgs = document.querySelectorAll("section img");

    assertExists(gridDiv);
    assertEquals(imgs.length, 2, "Grid should contain both images");
    assertEquals(imgs[0].getAttribute("alt"), "Album 1");
    assertEquals(imgs[1].getAttribute("alt"), "Album 2");
  },
);

Deno.test(
  "horizontalRowWithTitleHtml escapes title to prevent XSS",
  () => {
    const html = horizontalRowWithTitleHtml({
      title: '<script>alert("xss")</script>',
      children: [],
    });

    const document = parseHtmlFragment(html);
    const titleP = document.querySelector("section > p");
    const scripts = document.querySelectorAll("script");

    assertExists(titleP);
    assertEquals(
      titleP.textContent,
      '<script>alert("xss")</script>',
      "Title text content should show literal string, not execute",
    );
    assertEquals(
      scripts.length,
      0,
      "Script in title should be escaped, not create script elements",
    );
    assert(
      !html.includes("<script>"),
      "Raw output should not contain unescaped script tags",
    );
  },
);

Deno.test(
  "horizontalRowWithTitleHtml grid has expected overflow and layout classes",
  () => {
    const html = horizontalRowWithTitleHtml({
      title: "Row",
      children: [],
    });

    const document = parseHtmlFragment(html);
    const gridDiv = document.querySelector("section > div");

    assertExists(gridDiv);
    assert(
      gridDiv.getAttribute("class")?.includes("grid"),
      "Grid should have grid class",
    );
    assert(
      gridDiv.getAttribute("class")?.includes("overflow-x-auto"),
      "Grid should have horizontal overflow",
    );
  },
);
