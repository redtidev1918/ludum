// examples/headless/main.ts — deterministic gameplay vertical slice (no engine, no DOM).
// Run: npm run example:headless
import {
    Resource,
    StateMachine,
    createWeightedSession,
    ShuffleBag,
    SeededRandom,
    Countdown,
} from '../../src/gamelib/index.js';

interface RunResult {
    log: string[];
    finalHp: number;
    state: string;
    restoredHp: number;
}

function run(seed: number): RunResult {
    const random = new SeededRandom(seed);

    // --- state ---
    const hp = new Resource({ id: 'hp', value: 100, max: 100 });
    const state = new StateMachine<{ hp: number }>({
        states: ['alive', 'critical', 'dead'],
        conditions: [
            { state: 'dead', when: (c) => c.hp <= 0, priority: 20 },
            { state: 'critical', when: (c) => c.hp < 30, priority: 10 },
        ],
    });

    // --- random systems ---
    const loot = createWeightedSession(
        { entries: [{ id: 'common', weight: 80 }, { id: 'rare', weight: 20 }] },
        new SeededRandom(seed + 1),
    );
    const encounters = new ShuffleBag(['goblin', 'chest', 'trap'], random);

    // --- timed effect ---
    const poison = new Countdown(2);

    const log: string[] = [];
    for (let tick = 1; tick <= 6; tick++) {
        const encounter = encounters.draw()!;
        if (encounter === 'trap') hp.subtract(15);
        if (encounter === 'chest') hp.add(10);
        if (poison.advance(1)) hp.subtract(5);
        const item = loot.roll()!.id;
        state.updateContext({ hp: hp.get() });
        log.push(`t${tick} ${encounter}/${item} hp=${hp.get()} state=${state.getState()}`);
    }

    // --- snapshot → restore → continue ---
    const snapshot = hp.serialize();
    const restored = Resource.deserialize(snapshot);
    restored.add(5);

    return { log, finalHp: hp.get(), state: state.getState()!, restoredHp: restored.get() };
}

const a = run(12345);
const b = run(12345);
console.log('deterministic:', JSON.stringify(a) === JSON.stringify(b));
console.log(a.log.join('\n'));
console.log('final hp =', a.finalHp, '| state =', a.state, '| restored+5 hp =', a.restoredHp);
