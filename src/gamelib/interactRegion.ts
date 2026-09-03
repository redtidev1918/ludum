/**
 * InteractRegion - 交互区域系统(纯逻辑,引擎无关)。
 */

/** 多边形/区域点:支持 {x,y} 对象或 [x,y] 数组两种形式。 */
export type RegionPoint = { x: number; y: number } | [number, number];

/** 子区域配置。 */
export interface SubRegionConfig {
  id?: string;
  shape?: string;
  bounds?: number[];
  points?: RegionPoint[];
}

/** 交互区域配置。 */
export interface InteractRegionConfig {
  shape?: string;
  bounds?: number[];
  points?: RegionPoint[];
  interactions?: string[];
  subRegions?: SubRegionConfig[];
}

/** 事件回调(参数依事件类型而定)。 */
type Listener = (...args: any[]) => void;

/** 绑定形状的鸭子类型:含 contains(x,y,cx,cy)。 */
interface BoundShape {
  contains(x: number, y: number, cx: number, cy: number): boolean;
}

/** 子区域(内部结构)。 */
interface SubRegion {
  id?: string;
  shape: string;
  bounds?: number[];
  points?: RegionPoint[];
}

export class InteractRegion {
  shape: string;
  bounds: number[];
  points?: RegionPoint[];
  interactions: Record<string, boolean>;
  subRegions: SubRegion[];
  listeners: Record<string, Listener[]>;
  state: {
    isHovered: boolean;
    isPressed: boolean;
    isDragging: boolean;
    holdTime: number;
    dragStart: { x: number; y: number } | null;
    lastPosition: { x: number; y: number } | null;
    currentSubRegion: string | null;
  };
  offset: { x: number; y: number };
  enabled: boolean;
  boundShape?: BoundShape;

  constructor(config: InteractRegionConfig) {
    this.shape = config.shape ?? "rect";
    this.bounds = config.bounds ?? [];
    this.points = config.points;

    // 支持的交互类型
    this.interactions = {};
    for (const interaction of config.interactions ?? ["click"]) {
      this.interactions[interaction] = true;
    }

    // 子区域
    this.subRegions = [];
    for (const sub of config.subRegions ?? []) {
      this.subRegions.push({
        id: sub.id,
        shape: sub.shape ?? "rect",
        bounds: sub.bounds,
        points: sub.points,
      });
    }

    // 事件监听器
    this.listeners = {
      click: [],
      hover: [],
      drag: [],
      hold: [],
      release: [],
      enter: [],
      leave: [],
    };

    // 状态
    this.state = {
      isHovered: false,
      isPressed: false,
      isDragging: false,
      holdTime: 0,
      dragStart: null,
      lastPosition: null,
      currentSubRegion: null,
    };

    // 位置偏移(用于移动区域)
    this.offset = { x: 0, y: 0 };

    // 启用状态
    this.enabled = true;
  }

  /** 设置偏移(移动区域位置)。 */
  setOffset(x: number, y: number): this {
    this.offset.x = x;
    this.offset.y = y;
    return this;
  }

  /** 启用/禁用。禁用时重置内部状态。 */
  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    if (!enabled) {
      this._resetState();
    }
    return this;
  }

  /** 检测点是否在区域内。 */
  contains(x: number, y: number): boolean {
    if (!this.enabled) {
      return false;
    }

    // 转换为本地坐标
    const lx = x - this.offset.x;
    const ly = y - this.offset.y;

    return this._containsLocal(lx, ly, this.shape, this.bounds, this.points);
  }

  /** 获取点所在的子区域 id,无则返回 null。 */
  getSubRegion(x: number, y: number): string | null {
    if (!this.contains(x, y)) {
      return null;
    }

    const lx = x - this.offset.x;
    const ly = y - this.offset.y;

    for (const sub of this.subRegions) {
      if (this._containsLocal(lx, ly, sub.shape, sub.bounds, sub.points)) {
        return sub.id ?? null;
      }
    }

    return null;
  }

  /** @private 本地坐标命中检测。 */
  private _containsLocal(
    x: number,
    y: number,
    shape: string,
    bounds?: number[],
    points?: RegionPoint[],
  ): boolean {
    if (shape === "rect") {
      const b = bounds ?? [];
      return (
        x >= b[0] &&
        x <= b[0] + b[2] &&
        y >= b[1] &&
        y <= b[1] + b[3]
      );
    } else if (shape === "circle") {
      const cx = bounds?.[0] ?? 0;
      const cy = bounds?.[1] ?? 0;
      const r = bounds?.[2] ?? 0;
      const dx = x - cx;
      const dy = y - cy;
      return dx * dx + dy * dy <= r * r;
    } else if (shape === "ellipse") {
      const cx = bounds?.[0] ?? 0;
      const cy = bounds?.[1] ?? 0;
      const rx = bounds?.[2] ?? 0;
      const ry = bounds?.[3] ?? 0;
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      return nx * nx + ny * ny <= 1;
    } else if (shape === "polygon" && points) {
      return this._pointInPolygon(x, y, points);
    }

    return false;
  }

  /** @private 射线法判断点是否在多边形内(支持 {x,y} 与 [x,y] 点格式)。 */
  private _pointInPolygon(x: number, y: number, points: RegionPoint[]): boolean {
    let inside = false;
    let j = points.length - 1;

    for (let i = 0; i < points.length; i++) {
      const pi = points[i];
      const pj = points[j];
      const xi = Array.isArray(pi) ? pi[0] : pi.x;
      const yi = Array.isArray(pi) ? pi[1] : pi.y;
      const xj = Array.isArray(pj) ? pj[0] : pj.x;
      const yj = Array.isArray(pj) ? pj[1] : pj.y;

      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }

      j = i;
    }

    return inside;
  }

  /** 注册事件监听器。 */
  on(event: string, callback: Listener): this {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
    return this;
  }

  /** 移除事件监听器;callback 为空则移除该事件全部监听器。 */
  off(event: string, callback?: Listener): this {
    if (!this.listeners[event]) {
      return this;
    }

    if (callback == null) {
      this.listeners[event] = [];
    } else {
      const list = this.listeners[event];
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i] === callback) {
          list.splice(i, 1);
        }
      }
    }

    return this;
  }

  /** @private 触发事件,依次调用所有回调。 */
  private _emit(event: string, ...args: any[]): void {
    for (const callback of this.listeners[event] ?? []) {
      callback(...args);
    }
  }

  /** 处理鼠标按下。返回是否命中并处理。 */
  mousepressed(x: number, y: number, _button?: number): boolean {
    if (!this.enabled) {
      return false;
    }

    if (!this.contains(x, y)) {
      return false;
    }

    this.state.isPressed = true;
    this.state.holdTime = 0;
    this.state.dragStart = { x, y };
    this.state.lastPosition = { x, y };

    return true;
  }

  /** 处理鼠标释放。返回按下期间是否曾处理。 */
  mousereleased(x: number, y: number, _button?: number): boolean {
    if (!this.enabled) {
      return false;
    }

    const wasPressed = this.state.isPressed;
    const wasDragging = this.state.isDragging;

    if (wasPressed) {
      const subRegion = this.getSubRegion(x, y);

      if (wasDragging && this.interactions.drag) {
        this._emit("drag", x, y, "end", subRegion);
      } else if (this.contains(x, y) && this.interactions.click) {
        this._emit("click", x, y, subRegion);
      }

      if (this.interactions.release) {
        this._emit("release", x, y, subRegion);
      }
    }

    this.state.isPressed = false;
    this.state.isDragging = false;
    this.state.dragStart = null;

    return wasPressed;
  }

  /** 处理鼠标移动。返回当前是否悬停。 */
  mousemoved(x: number, y: number): boolean {
    if (!this.enabled) {
      return false;
    }

    const wasHovered = this.state.isHovered;
    const isHovered = this.contains(x, y);
    const subRegion = this.getSubRegion(x, y);

    // 进入/离开检测
    if (isHovered && !wasHovered) {
      this.state.isHovered = true;
      if (this.interactions.hover) {
        this._emit("hover", x, y, true);
      }
      this._emit("enter", x, y, subRegion);
    } else if (!isHovered && wasHovered) {
      this.state.isHovered = false;
      if (this.interactions.hover) {
        this._emit("hover", x, y, false);
      }
      this._emit("leave", x, y, this.state.currentSubRegion);
    }

    // 子区域变化
    if (isHovered && subRegion !== this.state.currentSubRegion) {
      if (this.state.currentSubRegion) {
        this._emit("leave", x, y, this.state.currentSubRegion);
      }
      this.state.currentSubRegion = subRegion;
      if (subRegion) {
        this._emit("enter", x, y, subRegion);
      }
    }

    // 拖拽检测
    if (this.state.isPressed && this.interactions.drag) {
      const start = this.state.dragStart;
      if (start) {
        const dx = x - start.x;
        const dy = y - start.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (!this.state.isDragging && dist > 5) {
          this.state.isDragging = true;
          this._emit("drag", x, y, "start", subRegion);
        } else if (this.state.isDragging) {
          const last = this.state.lastPosition!;
          this._emit("drag", x, y, "move", subRegion, x - last.x, y - last.y);
        }
      }
    }

    this.state.lastPosition = { x, y };

    return isHovered;
  }

  /** 每帧更新(用于 hold 检测)。 */
  update(dt: number): this {
    if (!this.enabled) {
      return this;
    }

    // Hold 检测
    if (this.state.isPressed && this.interactions.hold) {
      this.state.holdTime = this.state.holdTime + dt;

      const pos = this.state.lastPosition;
      if (pos) {
        const subRegion = this.getSubRegion(pos.x, pos.y);
        this._emit("hold", pos.x, pos.y, this.state.holdTime, subRegion);
      }
    }

    return this;
  }

  /** @private 重置内部状态。 */
  private _resetState(): void {
    this.state.isHovered = false;
    this.state.isPressed = false;
    this.state.isDragging = false;
    this.state.holdTime = 0;
    this.state.dragStart = null;
    this.state.currentSubRegion = null;
  }

  /** 绘制调试信息。纯逻辑模块不渲染,保留空实现。 */
  debugDraw(_options?: unknown): void {
    // 无渲染环境,空操作。
  }

  /** 绑定到 ProcShape(动态区域)。 */
  bindToShape(procShape: BoundShape): this {
    this.boundShape = procShape;
    return this;
  }

  /** 检测点是否在绑定的形状内;未绑定则回退到普通区域检测。 */
  containsWithShape(x: number, y: number, cx: number, cy: number): boolean {
    if (this.boundShape) {
      return this.boundShape.contains(x, y, cx, cy);
    }
    return this.contains(x, y);
  }
}

/** 区域管理器:统一分发鼠标/更新事件到多个区域。 */
export class InteractRegionManager {
  regions: Record<string, InteractRegion> = {};
  order: string[] = [];

  /** 注册区域。 */
  register(id: string, region: InteractRegion): this {
    this.regions[id] = region;
    this.order.push(id);
    return this;
  }

  /** 获取区域,不存在返回 null。 */
  get(id: string): InteractRegion | null {
    return this.regions[id] ?? null;
  }

  /** 移除区域。 */
  remove(id: string): this {
    delete this.regions[id];
    for (let i = this.order.length - 1; i >= 0; i--) {
      if (this.order[i] === id) {
        this.order.splice(i, 1);
      }
    }
    return this;
  }

  /** 处理鼠标按下(逆序检测,返回第一个处理的区域 id)。 */
  mousepressed(x: number, y: number, button?: number): string | null {
    for (let i = this.order.length - 1; i >= 0; i--) {
      const id = this.order[i];
      const region = this.regions[id];
      if (region && region.mousepressed(x, y, button)) {
        return id;
      }
    }
    return null;
  }

  /** 处理鼠标释放(逆序检测,返回最后一个处理的区域 id)。 */
  mousereleased(x: number, y: number, button?: number): string | null {
    let handled: string | null = null;
    for (let i = this.order.length - 1; i >= 0; i--) {
      const id = this.order[i];
      const region = this.regions[id];
      if (region && region.mousereleased(x, y, button)) {
        handled = id;
      }
    }
    return handled;
  }

  /** 处理鼠标移动(顺序分发到所有区域)。 */
  mousemoved(x: number, y: number): void {
    for (const id of this.order) {
      const region = this.regions[id];
      if (region) {
        region.mousemoved(x, y);
      }
    }
  }

  /** 更新所有区域。 */
  update(dt: number): void {
    for (const region of Object.values(this.regions)) {
      region.update(dt);
    }
  }

  /** 绘制所有区域调试信息(空实现,引擎无关)。 */
  debugDraw(options?: unknown): void {
    for (const id of this.order) {
      const region = this.regions[id];
      if (region) {
        region.debugDraw(options);
      }
    }
  }
}
