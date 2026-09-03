/** Typed 2D shapes and pure hit-testing. No renderer, no Phaser. */
export interface Vec2 {
    x: number;
    y: number;
}

export type Shape2D =
    | { kind: 'rect'; x: number; y: number; width: number; height: number }
    | { kind: 'circle'; center: Vec2; radius: number }
    | { kind: 'ellipse'; center: Vec2; radiusX: number; radiusY: number }
    | { kind: 'polygon'; points: readonly Vec2[] };

/** Pure hit-test. Returns true when `point` is inside (or on the edge of) `shape`. */
export function containsPoint(shape: Shape2D, point: Vec2): boolean {
    switch (shape.kind) {
        case 'rect':
            return point.x >= shape.x && point.x <= shape.x + shape.width &&
                point.y >= shape.y && point.y <= shape.y + shape.height;
        case 'circle': {
            const dx = point.x - shape.center.x;
            const dy = point.y - shape.center.y;
            return dx * dx + dy * dy <= shape.radius * shape.radius;
        }
        case 'ellipse': {
            const nx = (point.x - shape.center.x) / shape.radiusX;
            const ny = (point.y - shape.center.y) / shape.radiusY;
            return nx * nx + ny * ny <= 1;
        }
        case 'polygon':
            return pointInPolygon(point, shape.points);
    }
}

function pointInPolygon(point: Vec2, polygon: readonly Vec2[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}
