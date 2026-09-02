// tests/interactRegion.test.ts
// Interactive Region System 单元测试
import { describe, it, expect } from "vitest";
import { InteractRegion, InteractRegionManager } from "../src/gamelib/interactRegion";

describe("InteractRegion", () => {
  it("InteractRegion.new creates rect region", () => {
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
    });
    expect(region.shape).toBe("rect");
  });

  it("InteractRegion.new creates circle region", () => {
    const region = new InteractRegion({
      shape: "circle",
      bounds: [50, 50, 30], // cx, cy, radius
    });
    expect(region.shape).toBe("circle");
  });

  it("InteractRegion.new creates ellipse region", () => {
    const region = new InteractRegion({
      shape: "ellipse",
      bounds: [50, 50, 40, 30], // cx, cy, rx, ry
    });
    expect(region.shape).toBe("ellipse");
  });

  it("InteractRegion.new creates polygon region", () => {
    const region = new InteractRegion({
      shape: "polygon",
      points: [[0, 0], [100, 0], [100, 100], [0, 100]],
    });
    expect(region.shape).toBe("polygon");
  });

  it("Rect region contains point inside", () => {
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
    });
    expect(region.contains(50, 50)).toBe(true);
    expect(region.contains(0, 0)).toBe(true);
    expect(region.contains(100, 100)).toBe(true);
  });

  it("Rect region does not contain point outside", () => {
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
    });
    expect(region.contains(-1, 50)).toBe(false);
    expect(region.contains(101, 50)).toBe(false);
    expect(region.contains(50, -1)).toBe(false);
    expect(region.contains(50, 101)).toBe(false);
  });

  it("Circle region contains point inside", () => {
    const region = new InteractRegion({
      shape: "circle",
      bounds: [50, 50, 30],
    });
    expect(region.contains(50, 50)).toBe(true); // center
    expect(region.contains(50, 25)).toBe(true); // edge
    expect(region.contains(70, 50)).toBe(true); // near edge
  });

  it("Circle region does not contain point outside", () => {
    const region = new InteractRegion({
      shape: "circle",
      bounds: [50, 50, 30],
    });
    expect(region.contains(0, 0)).toBe(false);
    expect(region.contains(100, 100)).toBe(false);
  });

  it("Ellipse region contains point inside", () => {
    const region = new InteractRegion({
      shape: "ellipse",
      bounds: [50, 50, 40, 20], // wider than tall
    });
    expect(region.contains(50, 50)).toBe(true); // center
    expect(region.contains(80, 50)).toBe(true); // right edge
  });

  it("Polygon region contains point inside", () => {
    const region = new InteractRegion({
      shape: "polygon",
      points: [[0, 0], [100, 0], [100, 100], [0, 100]],
    });
    expect(region.contains(50, 50)).toBe(true);
  });

  it("Polygon region does not contain point outside", () => {
    const region = new InteractRegion({
      shape: "polygon",
      points: [[0, 0], [100, 0], [100, 100], [0, 100]],
    });
    expect(region.contains(150, 50)).toBe(false);
  });

  it("setOffset moves region", () => {
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
    });

    expect(region.contains(50, 50)).toBe(true);
    expect(region.contains(150, 150)).toBe(false);

    region.setOffset(100, 100);

    expect(region.contains(50, 50)).toBe(false);
    expect(region.contains(150, 150)).toBe(true);
  });

  it("getSubRegion returns correct sub region", () => {
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
      subRegions: [
        { id: "top", shape: "rect", bounds: [0, 0, 100, 33] },
        { id: "middle", shape: "rect", bounds: [0, 33, 100, 34] },
        { id: "bottom", shape: "rect", bounds: [0, 67, 100, 33] },
      ],
    });

    expect(region.getSubRegion(50, 10)).toBe("top");
    expect(region.getSubRegion(50, 50)).toBe("middle");
    expect(region.getSubRegion(50, 80)).toBe("bottom");
  });

  it("getSubRegion returns nil for point outside", () => {
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
      subRegions: [
        { id: "inner", shape: "rect", bounds: [25, 25, 50, 50] },
      ],
    });

    expect(region.getSubRegion(50, 50)).toBe("inner");
    expect(region.getSubRegion(10, 10)).toBe(null); // in main but not in sub
  });

  it("on registers listener", () => {
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
      interactions: ["click"],
    });

    region.on("click", () => {});

    expect(region.listeners.click.length).toBe(1);
  });

  it("off removes listener", () => {
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
    });

    const callback = () => {};
    region.on("click", callback);
    expect(region.listeners.click.length).toBe(1);

    region.off("click", callback);
    expect(region.listeners.click.length).toBe(0);
  });

  it("off without callback removes all listeners", () => {
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
    });

    region.on("click", () => {});
    region.on("click", () => {});
    expect(region.listeners.click.length).toBe(2);

    region.off("click");
    expect(region.listeners.click.length).toBe(0);
  });

  it("mousepressed returns true when inside", () => {
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
    });

    expect(region.mousepressed(50, 50, 1)).toBe(true);
    expect(region.state.isPressed).toBe(true);
  });

  it("mousepressed returns false when outside", () => {
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
    });

    expect(region.mousepressed(150, 150, 1)).toBe(false);
    expect(region.state.isPressed).toBe(false);
  });

  it("mousereleased triggers click event", () => {
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
      interactions: ["click"],
    });

    let clickX: number | undefined;
    let clickY: number | undefined;
    region.on("click", (x, y) => {
      clickX = x;
      clickY = y;
    });

    region.mousepressed(50, 50, 1);
    region.mousereleased(50, 50, 1);

    expect(clickX).toBe(50);
    expect(clickY).toBe(50);
  });

  it("mousemoved triggers hover events", () => {
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
      interactions: ["hover"],
    });

    let hoverState: boolean | undefined;
    region.on("hover", (_x, _y, entering) => {
      hoverState = entering;
    });

    region.mousemoved(50, 50);
    expect(hoverState).toBe(true);

    region.mousemoved(150, 150);
    expect(hoverState).toBe(false);
  });

  it("mousemoved triggers enter/leave events", () => {
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
    });

    let entered = false;
    let left = false;

    region.on("enter", () => {
      entered = true;
    });
    region.on("leave", () => {
      left = true;
    });

    region.mousemoved(50, 50);
    expect(entered).toBe(true);
    expect(left).toBe(false);

    region.mousemoved(150, 150);
    expect(left).toBe(true);
  });

  it("update tracks hold time", () => {
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
      interactions: ["hold"],
    });

    let holdDuration = 0;
    region.on("hold", (_x, _y, duration) => {
      holdDuration = duration;
    });

    region.mousepressed(50, 50, 1);
    region.state.lastPosition = { x: 50, y: 50 };

    region.update(0.5);
    expect(holdDuration).toBeGreaterThan(0);

    region.update(0.5);
    expect(holdDuration).toBeGreaterThanOrEqual(1.0);
  });

  it("setEnabled disables region", () => {
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
    });

    expect(region.contains(50, 50)).toBe(true);

    region.setEnabled(false);
    expect(region.contains(50, 50)).toBe(false);
    expect(region.mousepressed(50, 50, 1)).toBe(false);
  });

  it("InteractRegionManager registers and gets regions", () => {
    const manager = new InteractRegionManager();
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
    });

    manager.register("test", region);
    expect(manager.get("test")).toBe(region);
  });

  it("InteractRegionManager removes regions", () => {
    const manager = new InteractRegionManager();
    const region = new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 100, 100],
    });

    manager.register("test", region);
    manager.remove("test");
    expect(manager.get("test")).toBe(null);
  });

  it("InteractRegionManager mousepressed returns region id", () => {
    const manager = new InteractRegionManager();

    manager.register("region1", new InteractRegion({
      shape: "rect",
      bounds: [0, 0, 50, 50],
    }));

    manager.register("region2", new InteractRegion({
      shape: "rect",
      bounds: [50, 50, 50, 50],
    }));

    expect(manager.mousepressed(25, 25, 1)).toBe("region1");
    expect(manager.mousepressed(75, 75, 1)).toBe("region2");
    expect(manager.mousepressed(200, 200, 1)).toBe(null);
  });
});
