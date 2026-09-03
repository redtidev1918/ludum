/** Presentation metadata for a state. Pure data — the renderer interprets it. */
export interface VisualState {
    textureKey: string;
    offset?: { x: number; y: number };
    scale?: number | { x: number; y: number };
    rotation?: number;
    color?: readonly [number, number, number, number];
}

/** state -> presentation metadata. A plain readonly record, not a renderer. */
export type VisualStateMap = Readonly<Record<string, VisualState>>;
