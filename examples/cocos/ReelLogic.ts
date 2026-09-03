// examples/cocos/ReelLogic.ts
// ludum x Cocos Creator 3.x — type-level integration reference.
//
// ludum owns ALL gameplay logic (state, weighting, shuffle, balance); Cocos owns
// rendering, input, and lifecycle. This file compiles standalone (see cc.d.ts) and
// is ready to drop into a real Cocos Creator project (delete cc.d.ts there and
// switch the import to the 'ludum' package).
import { _decorator, Component } from 'cc';
import {
    Resource,
    StateMachine,
    WeightedTable,
    selectFromTable,
    ShuffleBag,
    SystemRandom,
} from '../../src/gamelib';

const { ccclass, property } = _decorator;

type SymbolId = '7' | 'BAR' | 'cherry' | 'lemon' | 'bell';

// Static definition (Definition) — immutable, shareable, serializable.
const SYMBOL_TABLE = new WeightedTable({
    entries: [
        { id: '7', weight: 5 },
        { id: 'BAR', weight: 15 },
        { id: 'cherry', weight: 30 },
        { id: 'lemon', weight: 25 },
        { id: 'bell', weight: 25 },
    ],
});

@ccclass('ReelLogic')
export class ReelLogic extends Component {
    @property
    spinCost = 10;

    // Runtime state (per-session) — instance-local, never global.
    private balance = new Resource({ id: 'balance', value: 100, max: 1000 });
    private random = new SystemRandom();
    private bonusPool = new ShuffleBag<SymbolId>(['7', 'BAR', 'cherry'], this.random);
    private lastSymbol: SymbolId | null = null;

    private state = new StateMachine<{ spinning: boolean }>({
        states: ['idle', 'spinning', 'win'],
        initialState: 'idle',
        conditions: [
            {
                state: 'win',
                when: (c) =>
                    !c.spinning &&
                    this.lastSymbol != null &&
                    (this.lastSymbol === '7' || this.lastSymbol === 'BAR'),
                priority: 10,
            },
            { state: 'spinning', when: (c) => c.spinning, priority: 5 },
        ],
    });

    /** Cocos lifecycle: called once when the component activates. */
    start(): void {
        this.state.updateContext({ spinning: false });
        console.log('[ReelLogic] ready — balance', this.balance.get());
    }

    /** Called by a Cocos UI button (e.g. "Spin"). */
    spin(): void {
        if (this.balance.get() < this.spinCost) {
            console.log('[ReelLogic] not enough balance');
            return;
        }
        this.balance.subtract(this.spinCost);
        this.state.updateContext({ spinning: true });

        // Weighted symbol selection (Definition + pure algorithm).
        const entry = selectFromTable(SYMBOL_TABLE, {}, this.random);
        this.lastSymbol = (entry?.id ?? 'lemon') as SymbolId;

        const won = this.lastSymbol === '7' || this.lastSymbol === 'BAR';
        if (won) this.balance.add(this.spinCost * 3);

        this.state.updateContext({ spinning: false });
        console.log(
            `[ReelLogic] spin -> ${this.lastSymbol}${won ? ' (win!)' : ''} · balance ${this.balance.get()}`,
        );
    }

    /** Bonus draw without replacement (e.g. a free-spin streak pool). */
    drawBonus(): SymbolId | undefined {
        return this.bonusPool.draw();
    }

    /** Current reel state, for the Cocos renderer/animator to read. */
    getState(): string | null {
        return this.state.getState();
    }
}
