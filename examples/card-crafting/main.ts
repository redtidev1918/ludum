// examples/card-crafting/main.ts — deterministic card-crafting vertical slice (no engine, no DOM).
//
// A minimal "everything is a card" crafting loop in the style of Cultist Simulator:
// cards hold numeric aspects, verbs are timed recipes that require cards, consume them,
// produce new ones (or roll a weighted table), and a resource can gate win/lose.
// Built only from ludum primitives — no game logic lives in the library:
//   cards            → ECS World + defineComponent
//   the "heat" meter → Resource
//   verb timers      → Countdown
//   random outcomes  → WeightedTable + selectFromTable + SeededRandom
//   recipe gates     → ConditionExpression + evaluateCondition
//   win/lose         → StateMachine
//   content tables   → DefinitionRegistry
//
// Run: npm run example:craft
import {
    World,
    defineComponent,
    type WorldSnapshot,
    Resource,
    type ResourceSnapshotV1,
    StateMachine,
    Countdown,
    WeightedTable,
    selectFromTable,
    SeededRandom,
    type RandomSource,
    type StatefulRandomSource,
    evaluateCondition,
    type ConditionExpression,
    DefinitionRegistry,
    type Definition,
} from '../../src/gamelib/index.js';

// ---------------------------------------------------------------- 内容定义(纯数据)

interface Aspects { readonly [key: string]: number }

interface CardDef extends Definition {
    readonly label: string;
    readonly aspects: Aspects;
    /** seconds; cards older than this decay off the table. Omit = permanent. */
    readonly lifetimeSeconds?: number;
}

interface Recipe extends Definition {
    readonly label: string;
    readonly require?: ConditionExpression;   // gate over aspect sums + resource
    readonly requireCards?: readonly string[];
    readonly consumeCards?: readonly string[];
    readonly produceCards?: readonly string[];
    readonly random?: WeightedTable;          // entries may carry data.cardId
    readonly resourceDelta?: number;          // applied to the gated resource
    readonly durationSeconds: number;
}

const CARDS: readonly CardDef[] = [
    { id: 'gold',   label: 'Coin',     aspects: { funds: 1 } },
    { id: 'energy', label: 'Vigor',    aspects: { stamina: 1 } },
    { id: 'focus',  label: 'Focus',    aspects: { reason: 1 } },
    { id: 'herb',   label: 'Herb',     aspects: { herb: 1 }, lifetimeSeconds: 6 },
    { id: 'potion', label: 'Brew',     aspects: { brew: 1 } },
    { id: 'relic',  label: 'Relic',    aspects: { relic: 1 } },
    { id: 'goal',   label: 'Masterwork', aspects: { goal: 1 } },
];

const forageTable = new WeightedTable({
    entries: [
        { id: 'herb', weight: 50, data: { cardId: 'herb' } },
        { id: 'gold', weight: 30, data: { cardId: 'gold' } },
        { id: 'none', weight: 20 },
    ],
});

const RECIPES: readonly Recipe[] = [
    { id: 'work',    label: 'Work',    requireCards: ['energy'], consumeCards: ['energy'], produceCards: ['gold', 'gold'], durationSeconds: 2 },
    { id: 'rest',    label: 'Rest',    requireCards: ['gold'],   consumeCards: ['gold'],   produceCards: ['energy'], durationSeconds: 2 },
    { id: 'forage',  label: 'Forage',  requireCards: ['energy'], consumeCards: ['energy'], random: forageTable,      durationSeconds: 2 },
    { id: 'brew',    label: 'Brew',    requireCards: ['herb', 'gold'], consumeCards: ['herb', 'gold'], produceCards: ['potion'], resourceDelta: 2, durationSeconds: 3 },
    { id: 'attune',  label: 'Attune',  require: { kind: 'greaterOrEqual', field: 'heat', value: 1 }, requireCards: ['focus'], resourceDelta: -3, durationSeconds: 2 },
    { id: 'craft',   label: 'Craft Masterwork',
        require: { kind: 'lessOrEqual', field: 'heat', value: 2 },
        requireCards: ['potion', 'relic', 'focus', 'energy'],
        consumeCards: ['potion', 'relic', 'focus'],
        produceCards: ['goal'],
        durationSeconds: 4 },
    // relic is granted directly in the slice setup to keep the win path short
];

const INITIAL_CARDS = ['gold', 'energy', 'energy', 'energy', 'focus', 'relic', 'herb'] as const;

// ---------------------------------------------------------------- session shell (stateful)

interface Snapshot {
    world: WorldSnapshot;
    resource: ResourceSnapshotV1;
    pending: ReadonlyArray<{ recipeId: string; remainingSeconds: number }>;
    elapsedSeconds: number;
    randomState: unknown;
}

const Card = defineComponent({ name: 'Card', defaults: { defId: '', bornAt: 0 } });

class CraftingGame {
    readonly world = new World();
    readonly cardDefs = new DefinitionRegistry<CardDef>(CARDS);
    readonly recipes = new DefinitionRegistry<Recipe>(RECIPES);
    readonly random: RandomSource;
    readonly phase: StateMachine<{ heat: number; heatMax: number; hasGoal: boolean }>;
    private resource = new Resource({ id: 'heat', value: 0, min: 0, max: 10 });
    private pending: Array<{ recipeId: string; countdown: Countdown }> = [];
    private elapsedSeconds = 0;

    constructor(seed: number) {
        this.random = new SeededRandom(seed);
        this.phase = new StateMachine({
            states: ['playing', 'won', 'lost'],
            conditions: [
                { state: 'lost', when: (c) => c.heat >= c.heatMax, priority: 30 },
                { state: 'won',  when: (c) => c.hasGoal,          priority: 20 },
            ],
        });
        for (const id of INITIAL_CARDS) this.addCard(id);
        this.refreshPhase();
    }

    get heat(): Resource { return this.resource; }
    get phaseName(): string { return this.phase.getState() ?? 'playing'; }
    get timeSeconds(): number { return this.elapsedSeconds; }

    countCards(cardId: string): number {
        let n = 0;
        for (const e of this.world.query(Card)) if (e.get(Card)!.defId === cardId) n++;
        return n;
    }

    aspectSums(): Aspects {
        const sums: Record<string, number> = {};
        for (const e of this.world.query(Card)) {
            const def = this.cardDefs.require(e.get(Card)!.defId);
            for (const [k, v] of Object.entries(def.aspects)) sums[k] = (sums[k] ?? 0) + v;
        }
        return sums;
    }

    private context(): Record<string, unknown> {
        // Aspect sums omit zero-count keys; numeric comparisons treat missing as false,
        // so callers relying on "stamina < 1" style gates must default missing fields to 0.
        return { ...this.aspectSums(), heat: this.resource.get(), hasGoal: this.countCards('goal') > 0 };
    }

    /** Human-readable reason a verb cannot start, or null when it can. */
    blockReason(recipe: Recipe): string | null {
        if (this.phaseName !== 'playing') return 'game over';
        for (const id of recipe.requireCards ?? []) {
            if (this.countCards(id) === 0) return `missing ${this.cardDefs.require(id).label}`;
        }
        if (recipe.require && !evaluateCondition(recipe.require, this.context())) {
            if (recipe.require.kind === 'lessOrEqual' && recipe.require.field === 'heat') {
                return `heat too high (need ≤ ${recipe.require.value}, have ${this.resource.get()}); Attune first`;
            }
            if (recipe.require.kind === 'greaterOrEqual' && recipe.require.field === 'heat') {
                return `heat too low (need ≥ ${recipe.require.value}, have ${this.resource.get()})`;
            }
            return 'condition not met';
        }
        return null;
    }

    startVerb(recipeId: string): boolean {
        const recipe = this.recipes.require(recipeId);
        if (this.pending.length > 0 || this.blockReason(recipe) !== null) return false;
        this.pending.push({ recipeId, countdown: new Countdown(recipe.durationSeconds) });
        return true;
    }

    pendingVerbs(): Array<{ recipeId: string; remainingSeconds: number }> {
        return this.pending.map((p) => ({ recipeId: p.recipeId, remainingSeconds: p.countdown.remainingSeconds }));
    }

    tick(dtSeconds: number): this {
        this.elapsedSeconds += dtSeconds;
        const done: typeof this.pending = [];
        const rest: typeof this.pending = [];
        for (const p of this.pending) (p.countdown.advance(dtSeconds) ? done : rest).push(p);
        this.pending = rest;
        for (const p of done) this.resolve(this.recipes.require(p.recipeId));
        // decay: timed cards expire by age
        for (const e of this.world.query(Card)) {
            const c = e.get(Card)!;
            const def = this.cardDefs.require(c.defId);
            if (def.lifetimeSeconds != null && this.elapsedSeconds - c.bornAt >= def.lifetimeSeconds) e.destroy();
        }
        this.refreshPhase();
        return this;
    }

    serialize(): Snapshot {
        return {
            world: this.world.serialize(),
            resource: this.resource.serialize(),
            pending: this.pending.map((p) => ({ recipeId: p.recipeId, remainingSeconds: p.countdown.remainingSeconds })),
            elapsedSeconds: this.elapsedSeconds,
            randomState: (this.random as StatefulRandomSource).snapshot(),
        };
    }

    restore(s: Snapshot): this {
        this.world.deserialize(s.world, [Card]);
        this.resource = Resource.deserialize(s.resource);
        this.pending = s.pending.map((p) => ({ recipeId: p.recipeId, countdown: new Countdown(p.remainingSeconds) }));
        this.elapsedSeconds = s.elapsedSeconds;
        (this.random as StatefulRandomSource).restore(s.randomState);
        this.refreshPhase();
        return this;
    }

    private addCard(cardId: string): void {
        this.cardDefs.require(cardId);
        this.world.createEntity().add(Card, { defId: cardId, bornAt: this.elapsedSeconds });
    }

    private consumeCard(cardId: string): void {
        for (const e of this.world.query(Card)) {
            if (e.get(Card)!.defId === cardId) { e.destroy(); return; }
        }
    }

    private resolve(recipe: Recipe): void {
        for (const id of recipe.consumeCards ?? []) this.consumeCard(id);
        for (const id of recipe.produceCards ?? []) this.addCard(id);
        if (recipe.random) {
            const entry = selectFromTable(recipe.random, {}, this.random);
            const cardId = (entry?.data as { cardId?: string } | undefined)?.cardId;
            if (cardId) this.addCard(cardId);
        }
        if (recipe.resourceDelta) this.resource.add(recipe.resourceDelta);
        this.refreshPhase();
    }

    private refreshPhase(): void {
        this.phase.updateContext({
            heat: this.resource.get(),
            heatMax: this.resource.max,
            hasGoal: this.countCards('goal') > 0,
        });
    }
}

// ---------------------------------------------------------------- 垂直切片

interface RunResult {
    log: string[];
    phase: string;
    heat: number;
}

function run(seed: number): RunResult {
    const game = new CraftingGame(seed);
    const log: string[] = [];
    const table = () => game.world.query(Card)
        .map((e) => game.cardDefs.require(e.get(Card)!.defId).label)
        .sort().join(', ');

    const doVerb = (id: string): void => {
        const recipe = game.recipes.require(id);
        const started = game.startVerb(id);
        log.push(`▶ ${recipe.label} — ${started ? `running (${recipe.durationSeconds}s)` : `blocked: ${game.blockReason(recipe)}`}`);
        if (started) game.tick(recipe.durationSeconds);
    };

    log.push(`== card-crafting slice (seed=${seed}) ==`);
    log.push(`   table: ${table()}`);

    doVerb('brew');      // herb + gold → brew, heat +2 (shows timed resolution)
    doVerb('brew');      // blocked: no herb left — shows the human-readable gate reason
    doVerb('attune');    // focus, heat −3
    doVerb('forage');    // energy → herb/gold/nothing (seeded weighted roll)
    doVerb('craft');     // brew + relic + focus + energy, heat ≤ 2 → Masterwork

    log.push(`   table: ${table()}`);
    return { log, phase: game.phaseName, heat: game.heat.get() };
}

const a = run(20260907);
const b = run(20260907);
console.log(a.log.join('\n'));
console.log(`\nresult: phase=${a.phase} heat=${a.heat}`);

console.log('\n== checks ==');
console.log('deterministic (same seed, same result):', JSON.stringify(a) === JSON.stringify(b) ? '✓' : '✗');

// snapshot/restore: a run interrupted mid-verb resumes byte-identically
const s = new CraftingGame(42);
s.startVerb('work');
s.tick(1); // half-way through the 2s verb
const snap = s.serialize();
const r = new CraftingGame(42).restore(snap);
s.tick(20);
r.tick(20);
console.log('snapshot/restore (resumed run identical):',
    JSON.stringify(s.serialize()) === JSON.stringify(r.serialize()) ? '✓' : '✗');
console.log('win reachable:', a.phase === 'won' ? '✓' : `✗ (${a.phase})`);
