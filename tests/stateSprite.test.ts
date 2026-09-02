import { describe, expect, it } from "vitest";
import { Easing, LayeredStateSprite, StateSprite } from "../src/gamelib/stateSprite";

// 近似断言:Lua 的 assertApprox(expected, actual, tolerance)
function assertApprox(expected: number, actual: number, tolerance = 0.001): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe("StateSprite", () => {
  it("StateSprite.new creates sprite with states", () => {
    const sprite = new StateSprite({
      states: {
        neutral: { sprite: "neutral.png", priority: 0 },
        happy: { sprite: "happy.png", priority: 1 },
      },
      defaultState: "neutral",
    });

    expect(sprite.getState()).toBe("neutral");
  });

  it("StateSprite.new picks first state if no default", () => {
    const sprite = new StateSprite({
      states: {
        idle: { sprite: "idle.png" },
      },
    });

    expect(sprite.getState()).toBe("idle");
  });

  it("StateSprite:setState changes state", () => {
    const sprite = new StateSprite({
      states: {
        neutral: { sprite: "neutral.png" },
        happy: { sprite: "happy.png" },
      },
      defaultState: "neutral",
    });

    sprite.setState("happy");
    expect(sprite.getState()).toBe("happy");
  });

  it("StateSprite:setState ignores invalid state", () => {
    const sprite = new StateSprite({
      states: {
        neutral: { sprite: "neutral.png" },
      },
      defaultState: "neutral",
    });

    sprite.setState("nonexistent");
    expect(sprite.getState()).toBe("neutral");
  });

  it("StateSprite:setState with duration creates temporary state", () => {
    const sprite = new StateSprite({
      states: {
        neutral: { sprite: "neutral.png" },
        surprised: { sprite: "surprised.png" },
      },
      defaultState: "neutral",
    });

    sprite.setState("surprised", { duration: 2 });
    expect(sprite.getState()).toBe("surprised");

    sprite.update(1.0);
    expect(sprite.getState()).toBe("surprised");

    sprite.update(1.5);
    expect(sprite.getState()).toBe("neutral");
  });

  it("StateSprite:getStateData returns state config", () => {
    const sprite = new StateSprite({
      states: {
        neutral: { sprite: "neutral.png", priority: 5 },
      },
      defaultState: "neutral",
    });

    const data = sprite.getStateData()!;
    expect(data.sprite).toBe("neutral.png");
    expect(data.priority).toBe(5);
  });

  it("StateSprite conditions auto-switch state", () => {
    const sprite = new StateSprite({
      states: {
        neutral: { sprite: "neutral.png" },
        happy: { sprite: "happy.png" },
        sad: { sprite: "sad.png" },
      },
      conditions: [
        { state: "happy", when: (ctx) => ctx.money > 100 },
        { state: "sad", when: (ctx) => ctx.money < 10 },
      ],
      defaultState: "neutral",
    });

    sprite.updateContext({ money: 50 });
    expect(sprite.getState()).toBe("neutral");

    sprite.updateContext({ money: 150 });
    expect(sprite.getState()).toBe("happy");

    sprite.updateContext({ money: 5 });
    expect(sprite.getState()).toBe("sad");
  });

  it("StateSprite conditions respect priority", () => {
    const sprite = new StateSprite({
      states: {
        neutral: { sprite: "neutral.png" },
        critical: { sprite: "critical.png" },
        happy: { sprite: "happy.png" },
      },
      conditions: [
        { state: "happy", when: (ctx) => ctx.money > 100, priority: 1 },
        { state: "critical", when: (ctx) => ctx.hp < 20, priority: 10 },
      ],
      defaultState: "neutral",
    });

    // 两个条件都成立,critical 优先级更高
    sprite.updateContext({ money: 150, hp: 10 });
    expect(sprite.getState()).toBe("critical");
  });

  it("StateSprite:isTransitioning returns correct value", () => {
    const sprite = new StateSprite({
      states: {
        a: { sprite: "a.png" },
        b: { sprite: "b.png" },
      },
      transitions: {
        default: { duration: 0.5, easing: "linear" },
      },
      defaultState: "a",
    });

    expect(sprite.isTransitioning()).toBe(false);

    sprite.setState("b");
    expect(sprite.isTransitioning()).toBe(true);

    sprite.update(0.6);
    expect(sprite.isTransitioning()).toBe(false);
  });

  it("StateSprite transition progress updates correctly", () => {
    const sprite = new StateSprite({
      states: {
        a: { sprite: "a.png" },
        b: { sprite: "b.png" },
      },
      transitions: {
        default: { duration: 1.0, easing: "linear" },
      },
      defaultState: "a",
    });

    sprite.setState("b");
    expect(sprite.transitionProgress).toBe(0);

    sprite.update(0.5);
    assertApprox(0.5, sprite.transitionProgress, 0.01);

    sprite.update(0.5);
    assertApprox(1.0, sprite.transitionProgress, 0.01);
  });

  it("StateSprite uses specific transition when defined", () => {
    const sprite = new StateSprite({
      states: {
        neutral: { sprite: "neutral.png" },
        critical: { sprite: "critical.png" },
      },
      transitions: {
        default: { duration: 0.5, easing: "outQuad" },
        "neutral->critical": { duration: 0.1, easing: "linear" },
      },
      defaultState: "neutral",
    });

    sprite.setState("critical");
    expect(sprite.transitionDuration).toBe(0.1);
  });

  it("StateSprite:onStateChange fires on state change", () => {
    const sprite = new StateSprite({
      states: {
        a: { sprite: "a.png" },
        b: { sprite: "b.png" },
      },
      defaultState: "a",
    });

    const changes: Array<{ old: string; new: string }> = [];
    sprite.onStateChange((oldState, newState) => {
      changes.push({ old: oldState, new: newState });
    });

    sprite.setState("b");

    expect(changes.length).toBe(1);
    expect(changes[0].old).toBe("a");
    expect(changes[0].new).toBe("b");
  });

  it("StateSprite:addState adds new state", () => {
    const sprite = new StateSprite({
      states: {
        a: { sprite: "a.png" },
      },
      defaultState: "a",
    });

    sprite.addState("b", { sprite: "b.png" });
    sprite.setState("b");
    expect(sprite.getState()).toBe("b");
  });

  it("StateSprite:addCondition adds new condition", () => {
    const sprite = new StateSprite({
      states: {
        neutral: { sprite: "neutral.png" },
        angry: { sprite: "angry.png" },
      },
      defaultState: "neutral",
    });

    sprite.addCondition({
      state: "angry",
      when: (ctx) => ctx.damage > 50,
    });

    sprite.updateContext({ damage: 60 });
    expect(sprite.getState()).toBe("angry");
  });

  it("StateSprite:setTransition updates transition config", () => {
    const sprite = new StateSprite({
      states: {
        a: { sprite: "a.png" },
        b: { sprite: "b.png" },
      },
      defaultState: "a",
    });

    sprite.setTransition("a->b", { duration: 2.0, easing: "inQuad" });
    sprite.setState("b");

    expect(sprite.transitionDuration).toBe(2.0);
  });
});

describe("Easing", () => {
  it("Easing.linear returns t", () => {
    expect(Easing.linear(0)).toBe(0);
    expect(Easing.linear(0.5)).toBe(0.5);
    expect(Easing.linear(1)).toBe(1);
  });

  it("Easing.outQuad eases correctly", () => {
    expect(Easing.outQuad(0)).toBe(0);
    assertApprox(0.75, Easing.outQuad(0.5), 0.01);
    expect(Easing.outQuad(1)).toBe(1);
  });

  it("Easing.outBounce eases correctly", () => {
    expect(Easing.outBounce(0)).toBe(0);
    expect(Easing.outBounce(1)).toBe(1);
    // 应有回弹效果
    expect(Easing.outBounce(0.5) > 0).toBe(true);
  });
});

describe("LayeredStateSprite", () => {
  it("LayeredStateSprite.new creates layered sprite", () => {
    const sprite = new LayeredStateSprite({
      layers: [
        { name: "body", z: 0 },
        { name: "face", z: 1 },
        { name: "clothes", z: 2 },
      ],
      layerStates: {
        face: {
          neutral: "face_neutral.png",
          happy: "face_happy.png",
        },
        clothes: {
          normal: "clothes_normal.png",
          torn: "clothes_torn.png",
        },
      },
    });

    expect(sprite.layersByName.body).toBeDefined();
    expect(sprite.layersByName.face).toBeDefined();
    expect(sprite.layersByName.clothes).toBeDefined();
  });

  it("LayeredStateSprite:setLayerState changes layer state", () => {
    const sprite = new LayeredStateSprite({
      layers: [{ name: "face", z: 0 }],
      layerStates: {
        face: {
          neutral: "face_neutral.png",
          happy: "face_happy.png",
        },
      },
    });

    sprite.setLayerState("face", "happy");
    expect(sprite.getLayerState("face")).toBe("happy");
  });

  it("LayeredStateSprite:setLayerVisible toggles visibility", () => {
    const sprite = new LayeredStateSprite({
      layers: [{ name: "clothes", z: 0 }],
      layerStates: {
        clothes: { normal: "clothes.png" },
      },
    });

    expect(sprite.layersByName.clothes.visible).toBe(true);

    sprite.setLayerVisible("clothes", false);
    expect(sprite.layersByName.clothes.visible).toBe(false);
  });

  it("LayeredStateSprite layers are sorted by z", () => {
    const sprite = new LayeredStateSprite({
      layers: [
        { name: "top", z: 10 },
        { name: "bottom", z: 0 },
        { name: "middle", z: 5 },
      ],
    });

    expect(sprite.layers[0].name).toBe("bottom");
    expect(sprite.layers[1].name).toBe("middle");
    expect(sprite.layers[2].name).toBe("top");
  });

  it("LayeredStateSprite:updateContext evaluates conditions", () => {
    const sprite = new LayeredStateSprite({
      layers: [{ name: "face", z: 0 }],
      layerStates: {
        face: {
          neutral: "neutral.png",
          blush: "blush.png",
        },
      },
    });

    sprite.addCondition("face", {
      state: "blush",
      when: (ctx) => ctx.embarrassed,
    });

    sprite.updateContext({ embarrassed: true });
    expect(sprite.getLayerState("face")).toBe("blush");
  });
});
