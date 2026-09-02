// procShape.ts — 程序化形状系统(ProcShape / BezierShape)
// 移植自 Lua proc_shape.lua。零运行时依赖,纯 TypeScript。

/** 二维点 {x, y} */
export interface Point {
    x: number;
    y: number;
}

/** 二维向量 {x, y} */
export interface Vec2 {
    x: number;
    y: number;
}

/** 可绑定资源:需提供 get() 方法(鸭子类型) */
export interface ResourceLike {
    get(): number;
}

/** 参数绑定条目 */
export interface Binding {
    resource: ResourceLike;
    transform: (value: number) => number;
}

/** ProcShape 构造配置 */
export interface ProcShapeConfig {
    type?: string;
    baseWidth?: number;
    baseHeight?: number;
    params?: Record<string, number>;
    physics?: Record<string, unknown>;
    color?: number[];
    fillColor?: number[];
    lineWidth?: number;
}

/** ProcShape 物理状态 */
export interface ProcShapePhysics {
    jiggle: boolean;
    stiffness: number;
    damping: number;
    velocity: Vec2;
    displacement: Vec2;
}

/** 创建程序化形状 */
export class ProcShape {
    type: string;
    baseWidth: number;
    baseHeight: number;
    params: Record<string, number>;
    physics: ProcShapePhysics;
    bindings: Record<string, Binding>;
    color: number[];
    fillColor: number[];
    lineWidth: number;

    constructor(config: ProcShapeConfig) {
        this.type = config.type ?? "ellipse";
        this.baseWidth = config.baseWidth ?? 50;
        this.baseHeight = config.baseHeight ?? 40;

        this.params = {
            scale: 1.0,
            stretchX: 1.0,
            stretchY: 1.0,
            sag: 0,
            bulge: 0,
            rotation: 0,
        };

        // 合并配置参数
        if (config.params) {
            for (const [k, v] of Object.entries(config.params)) {
                this.params[k] = v;
            }
        }

        // 物理属性
        this.physics = {
            jiggle: false,
            stiffness: 100,
            damping: 10,
            velocity: { x: 0, y: 0 },
            displacement: { x: 0, y: 0 },
        };

        if (config.physics) {
            for (const [k, v] of Object.entries(config.physics)) {
                if (typeof v === "object" && v !== null) {
                    // 嵌套表复制为 {x=.., y=..} 形状(照搬 Lua)
                    const vec = v as Partial<Vec2>;
                    (this.physics as unknown as Record<string, unknown>)[k] = {
                        x: vec.x ?? 0,
                        y: vec.y ?? 0,
                    };
                } else {
                    (this.physics as unknown as Record<string, unknown>)[k] = v;
                }
            }
        }

        this.bindings = {};
        this.color = config.color ?? [1, 1, 1, 1];
        this.fillColor = config.fillColor ?? [0.8, 0.8, 0.8, 1];
        this.lineWidth = config.lineWidth ?? 2;
    }

    /** 绑定参数到资源 */
    bindParam(paramName: string, resource: ResourceLike, transform?: (v: number) => number): this {
        this.bindings[paramName] = {
            resource,
            transform: transform ?? ((v: number) => v),
        };
        return this;
    }

    /** 解绑参数 */
    unbindParam(paramName: string): this {
        delete this.bindings[paramName];
        return this;
    }

    /** 设置参数 */
    setParam(paramName: string, value: number): this {
        this.params[paramName] = value;
        return this;
    }

    /** 获取参数(考虑绑定) */
    getParam(paramName: string): number {
        const binding = this.bindings[paramName];
        if (binding) {
            const value = binding.resource.get();
            return binding.transform(value);
        }
        return this.params[paramName] ?? 0;
    }

    /** 戳一下(触发晃动) */
    poke(x: number, y: number, force?: number): this {
        if (!this.physics.jiggle) {
            return this;
        }

        force = force ?? 1;

        // 根据戳的位置计算速度方向
        const dist = Math.sqrt(x * x + y * y);
        if (dist > 0) {
            const nx = x / dist;
            const ny = y / dist;
            this.physics.velocity.x = this.physics.velocity.x - nx * force * 50;
            this.physics.velocity.y = this.physics.velocity.y - ny * force * 50;
        } else {
            this.physics.velocity.y = this.physics.velocity.y + force * 50;
        }

        return this;
    }

    /** 更新(每帧调用) */
    update(dt: number): this {
        // 更新绑定参数
        for (const paramName of Object.keys(this.bindings)) {
            const binding = this.bindings[paramName];
            const value = binding.resource.get();
            this.params[paramName] = binding.transform(value);
        }

        // 更新物理(弹簧阻尼系统)
        if (this.physics.jiggle) {
            const stiffness = this.physics.stiffness;
            const damping = this.physics.damping;
            const disp = this.physics.displacement;
            const vel = this.physics.velocity;

            // 先更新位移(使用当前速度)
            disp.x = disp.x + vel.x * dt;
            disp.y = disp.y + vel.y * dt;

            // 弹簧力: F = -kx - cv
            const ax = -stiffness * disp.x - damping * vel.x;
            const ay = -stiffness * disp.y - damping * vel.y;

            // 更新速度
            vel.x = vel.x + ax * dt;
            vel.y = vel.y + ay * dt;

            // 衰减小振动
            if (Math.abs(disp.x) < 0.1 && Math.abs(vel.x) < 1) {
                disp.x = 0;
                vel.x = 0;
            }
            if (Math.abs(disp.y) < 0.1 && Math.abs(vel.y) < 1) {
                disp.y = 0;
                vel.y = 0;
            }
        }

        return this;
    }

    /** 获取当前尺寸 */
    getSize(): [number, number] {
        const scale = this.getParam("scale");
        const stretchX = this.getParam("stretchX");
        const stretchY = this.getParam("stretchY");

        const width = this.baseWidth * scale * stretchX;
        const height = this.baseHeight * scale * stretchY;

        return [width, height];
    }

    /** 获取轮廓点 */
    getOutlinePoints(segments?: number): Point[] {
        segments = segments ?? 32;
        const points: Point[] = [];

        const scale = this.getParam("scale");
        const stretchX = this.getParam("stretchX");
        const stretchY = this.getParam("stretchY");
        const sag = this.getParam("sag");
        const bulge = this.getParam("bulge");
        const rotation = this.getParam("rotation");

        const w = (this.baseWidth * scale * stretchX) / 2;
        const h = (this.baseHeight * scale * stretchY) / 2;

        // 物理位移
        const dispX = this.physics.displacement.x;
        const dispY = this.physics.displacement.y;

        if (this.type === "ellipse") {
            for (let i = 0; i < segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                let x = Math.cos(angle) * w;
                let y = Math.sin(angle) * h;

                // 应用下垂(底部更多)
                if (y > 0) {
                    y = y + sag * (y / h);
                }

                // 应用凸起(中间更多)
                const bulgeFactor = 1 - Math.abs(y / h);
                x = x * (1 + bulge * bulgeFactor * 0.5);

                // 应用物理位移
                x = x + dispX * (1 - Math.abs(y / h) * 0.5);
                y = y + dispY * (1 - Math.abs(x / w) * 0.5);

                // 应用旋转
                if (rotation !== 0) {
                    const cosR = Math.cos(rotation);
                    const sinR = Math.sin(rotation);
                    const rx = x * cosR - y * sinR;
                    const ry = x * sinR + y * cosR;
                    x = rx;
                    y = ry;
                }

                points.push({ x, y });
            }
        } else if (this.type === "polygon") {
            // 简单多边形
            const sides = segments;
            for (let i = 0; i < sides; i++) {
                const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
                let x = Math.cos(angle) * w;
                let y = Math.sin(angle) * h;

                if (rotation !== 0) {
                    const cosR = Math.cos(rotation);
                    const sinR = Math.sin(rotation);
                    const rx = x * cosR - y * sinR;
                    const ry = x * sinR + y * cosR;
                    x = rx;
                    y = ry;
                }

                points.push({ x, y });
            }
        }

        return points;
    }

    /** 检测点是否在形状内 */
    contains(px: number, py: number, cx: number, cy: number): boolean {
        const localX = px - cx;
        const localY = py - cy;

        const scale = this.getParam("scale");
        const stretchX = this.getParam("stretchX");
        const stretchY = this.getParam("stretchY");

        const w = (this.baseWidth * scale * stretchX) / 2;
        const h = (this.baseHeight * scale * stretchY) / 2;

        if (this.type === "ellipse") {
            // 椭圆方程: (x/a)^2 + (y/b)^2 <= 1
            const nx = localX / w;
            const ny = localY / h;
            return nx * nx + ny * ny <= 1;
        } else if (this.type === "polygon") {
            // 使用射线法
            const points = this.getOutlinePoints();
            return this._pointInPolygon(localX, localY, points);
        }

        return false;
    }

    /** @private 射线法判断点是否在多边形内 */
    _pointInPolygon(x: number, y: number, points: Point[]): boolean {
        let inside = false;
        let j = points.length - 1;

        for (let i = 0; i < points.length; i++) {
            const xi = points[i].x;
            const yi = points[i].y;
            const xj = points[j].x;
            const yj = points[j].y;

            if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
                inside = !inside;
            }

            j = i;
        }

        return inside;
    }

    /** 绘制(LÖVE 环境);TS 无渲染环境,保留空操作 */
    draw(_cx: number, _cy: number, _options?: Record<string, unknown>): void {
        // LÖVE 渲染已剔除:无渲染环境,此方法为空操作。
    }

    /** 设置颜色 */
    setColor(r: number, g: number, b: number, a?: number): this {
        this.color = [r, g, b, a ?? 1];
        return this;
    }

    /** 设置填充颜色 */
    setFillColor(r: number, g: number, b: number, a?: number): this {
        this.fillColor = [r, g, b, a ?? 1];
        return this;
    }
}

// ---------------------------------------------------------------------------
// BezierShape: 贝塞尔曲线形状
// ---------------------------------------------------------------------------

/** 贝塞尔控制点(配置输入) */
export interface BezierControlPointConfig {
    x?: number;
    y?: number;
    fixed?: boolean;
}

/** 贝塞尔控制点(内部存储) */
export interface BezierControlPoint {
    x: number;
    y: number;
    fixed: boolean;
    baseX: number;
    baseY: number;
}

/** 贝塞尔变形规则 */
export interface BezierDeformRule {
    /** 控制点索引(1-based,与 Lua 一致) */
    point: number;
    axis: "x" | "y";
    param: string;
    formula: (value: number) => number;
}

/** BezierShape 物理状态 */
export interface BezierPhysics {
    jiggle: boolean;
    stiffness: number;
    damping: number;
    velocities: Vec2[];
    displacements: Vec2[];
}

/** BezierShape 构造配置 */
export interface BezierShapeConfig {
    controlPoints?: BezierControlPointConfig[];
    deformRules?: BezierDeformRule[];
    params?: Record<string, number>;
    physics?: Record<string, unknown>;
    color?: number[];
    fillColor?: number[];
    lineWidth?: number;
    segments?: number;
}

/** 创建贝塞尔形状 */
export class BezierShape {
    controlPoints: BezierControlPoint[];
    deformRules: BezierDeformRule[];
    params: Record<string, number>;
    bindings: Record<string, Binding>;
    physics: BezierPhysics;
    color: number[];
    fillColor: number[];
    lineWidth: number;
    segments: number;

    constructor(config: BezierShapeConfig) {
        this.controlPoints = (config.controlPoints ?? []).map((cp) => ({
            x: cp.x ?? 0,
            y: cp.y ?? 0,
            fixed: cp.fixed ?? false,
            baseX: cp.x ?? 0,
            baseY: cp.y ?? 0,
        }));

        this.deformRules = config.deformRules ?? [];
        this.params = config.params ?? {};
        this.bindings = {};

        this.physics = {
            jiggle: false,
            stiffness: 100,
            damping: 10,
            velocities: [],
            displacements: [],
        };

        if (config.physics) {
            for (const [k, v] of Object.entries(config.physics)) {
                (this.physics as unknown as Record<string, unknown>)[k] = v;
            }
        }

        // 初始化每个控制点的物理状态
        for (let i = 0; i < this.controlPoints.length; i++) {
            this.physics.velocities[i] = { x: 0, y: 0 };
            this.physics.displacements[i] = { x: 0, y: 0 };
        }

        this.color = config.color ?? [1, 1, 1, 1];
        this.fillColor = config.fillColor ?? [0.8, 0.8, 0.8, 1];
        this.lineWidth = config.lineWidth ?? 2;
        this.segments = config.segments ?? 32;
    }

    /** 绑定参数 */
    bindParam(paramName: string, resource: ResourceLike, transform?: (v: number) => number): this {
        this.bindings[paramName] = {
            resource,
            transform: transform ?? ((v: number) => v),
        };
        return this;
    }

    /** 设置参数 */
    setParam(paramName: string, value: number): this {
        this.params[paramName] = value;
        return this;
    }

    /** 获取参数 */
    getParam(paramName: string): number {
        const binding = this.bindings[paramName];
        if (binding) {
            const value = binding.resource.get();
            return binding.transform(value);
        }
        return this.params[paramName] ?? 0;
    }

    /** 戳一下 */
    poke(x: number, y: number, force?: number): this {
        if (!this.physics.jiggle) {
            return this;
        }

        force = force ?? 1;

        // 影响最近的非固定控制点
        for (let i = 0; i < this.controlPoints.length; i++) {
            const cp = this.controlPoints[i];
            if (!cp.fixed) {
                const dx = cp.x - x;
                const dy = cp.y - y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 100) {
                    const influence = 1 - dist / 100;
                    const vel = this.physics.velocities[i];
                    if (dist > 0.01) {
                        vel.x = vel.x + (dx / dist) * force * 30 * influence;
                        vel.y = vel.y + (dy / dist) * force * 30 * influence;
                    } else {
                        // 直接在控制点上戳,给一个随机方向
                        vel.x = vel.x + force * 30;
                        vel.y = vel.y + force * 30;
                    }
                }
            }
        }

        return this;
    }

    /** 更新 */
    update(dt: number): this {
        // 更新绑定参数
        for (const paramName of Object.keys(this.bindings)) {
            const binding = this.bindings[paramName];
            const value = binding.resource.get();
            this.params[paramName] = binding.transform(value);
        }

        // 应用变形规则
        for (const rule of this.deformRules) {
            const cp = this.controlPoints[rule.point - 1];
            if (cp && !cp.fixed) {
                const paramValue = this.getParam(rule.param);
                const newValue = rule.formula(paramValue);

                if (rule.axis === "x") {
                    cp.x = newValue;
                } else if (rule.axis === "y") {
                    cp.y = newValue;
                }
            }
        }

        // 更新物理
        if (this.physics.jiggle) {
            const stiffness = this.physics.stiffness;
            const damping = this.physics.damping;

            for (let i = 0; i < this.controlPoints.length; i++) {
                const cp = this.controlPoints[i];
                if (!cp.fixed) {
                    const vel = this.physics.velocities[i];
                    const disp = this.physics.displacements[i];

                    // 先更新位移
                    disp.x = disp.x + vel.x * dt;
                    disp.y = disp.y + vel.y * dt;

                    // 弹簧力
                    const ax = -stiffness * disp.x - damping * vel.x;
                    const ay = -stiffness * disp.y - damping * vel.y;

                    // 更新速度
                    vel.x = vel.x + ax * dt;
                    vel.y = vel.y + ay * dt;

                    // 衰减
                    if (Math.abs(disp.x) < 0.1 && Math.abs(vel.x) < 1) {
                        disp.x = 0;
                        vel.x = 0;
                    }
                    if (Math.abs(disp.y) < 0.1 && Math.abs(vel.y) < 1) {
                        disp.y = 0;
                        vel.y = 0;
                    }
                }
            }
        }

        return this;
    }

    /** 获取当前控制点(含物理位移) */
    getControlPoints(): Point[] {
        const result: (Point & { fixed: boolean })[] = [];
        for (let i = 0; i < this.controlPoints.length; i++) {
            const cp = this.controlPoints[i];
            const disp = this.physics.displacements[i] ?? { x: 0, y: 0 };
            result.push({
                x: cp.x + disp.x,
                y: cp.y + disp.y,
                fixed: cp.fixed,
            });
        }
        return result;
    }

    /** 获取轮廓点 */
    getOutlinePoints(segments?: number): Point[] {
        segments = segments ?? this.segments;
        const points: Point[] = [];
        const cps = this.getControlPoints();

        if (cps.length < 4) {
            return points;
        }

        // 假设控制点形成闭合曲线
        // 每 4 个点定义一段贝塞尔曲线
        let numCurves = Math.floor(cps.length / 3);
        if (numCurves < 1) {
            numCurves = 1;
        }

        const segmentsPerCurve = Math.ceil(segments / numCurves);

        for (let curve = 0; curve < numCurves; curve++) {
            const i0 = (curve * 3) % cps.length;
            const i1 = (curve * 3 + 1) % cps.length;
            const i2 = (curve * 3 + 2) % cps.length;
            const i3 = (curve * 3 + 3) % cps.length;

            const p0 = cps[i0] ?? cps[0];
            const p1 = cps[i1] ?? cps[0];
            const p2 = cps[i2] ?? cps[0];
            const p3 = cps[i3] ?? cps[0];

            for (let j = 0; j < segmentsPerCurve; j++) {
                const t = j / segmentsPerCurve;
                const [x, y] = cubicBezier(t, p0, p1, p2, p3);
                points.push({ x, y });
            }
        }

        return points;
    }

    /** 绘制(LÖVE 环境);TS 无渲染环境,保留空操作 */
    draw(_cx: number, _cy: number, _options?: Record<string, unknown>): void {
        // LÖVE 渲染已剔除:无渲染环境,此方法为空操作。
    }

    /** 设置颜色 */
    setColor(r: number, g: number, b: number, a?: number): this {
        this.color = [r, g, b, a ?? 1];
        return this;
    }

    /** 设置填充颜色 */
    setFillColor(r: number, g: number, b: number, a?: number): this {
        this.fillColor = [r, g, b, a ?? 1];
        return this;
    }
}

/** 计算三次贝塞尔曲线点 */
function cubicBezier(t: number, p0: Point, p1: Point, p2: Point, p3: Point): [number, number] {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
    const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;

    return [x, y];
}
