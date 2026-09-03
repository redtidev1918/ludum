// examples/cocos/cc.d.ts
// Minimal type shim for the subset of Cocos Creator's `cc` module used by this example.
//
// Purpose: let ReelLogic.ts typecheck WITHOUT the Cocos Creator editor (whose
// `temp/declarations/cc.d.ts` is generated locally and not published to npm).
//
// In a real Cocos Creator 3.x project: DELETE this file. The editor provides the
// full `cc` declarations automatically; this shim exists only for this repo's
// standalone typecheck of the integration reference.
declare module 'cc' {
    export namespace _decorator {
        /** Marks a class as a Cocos component. */
        export function ccclass(name?: string): ClassDecorator;
        /** Exposes a field in the Cocos inspector. */
        export const property: PropertyDecorator;
    }

    /** Base class for all Cocos components (minimal for this example). */
    export class Component {}
}
