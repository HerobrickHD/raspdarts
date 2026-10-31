import { describe, expect, test } from "vitest";
import { CENTERED_BLOCKS, applyLayout } from "../public/js/layout-view.js";
import { DEFAULT_LAYOUT } from "../src/viewer/layout.ts";

/* Ein #viewer mit den Bloecken, nur so viel DOM wie applyLayout braucht. */
function viewerWith(ids) {
  const blocks = ids.map((id) => ({ dataset: { block: id }, style: {} }));
  return { blocks, querySelectorAll: () => blocks };
}

describe("applyLayout", () => {
  test("der Warte-Text sitzt mit seiner Mitte auf x/y und waechst um die Mitte", () => {
    expect(CENTERED_BLOCKS).toEqual(["warten"]);
    const viewer = viewerWith(["warten"]);
    applyLayout(viewer, { ...DEFAULT_LAYOUT, blocks: { ...DEFAULT_LAYOUT.blocks, warten: { x: 30, y: 70, scale: 1.5 } } });
    expect(viewer.blocks[0].style).toMatchObject({ left: "30%", top: "70%", transform: "translate(-50%, -50%) scale(1.5)" });
  });

  test("andere Bloecke bleiben an der linken oberen Ecke", () => {
    const viewer = viewerWith(["spielinfo"]);
    applyLayout(viewer, DEFAULT_LAYOUT);
    expect(viewer.blocks[0].style.transform).toBe("scale(1)");
  });
});
