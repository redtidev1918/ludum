// ludum x Phaser 4 —— 模块集成演示场景
// 演示:ECS / Resource / StateSprite / ProcShape / InteractRegion / Dialogue / WeightedEvent
import * as Phaser from 'phaser';
import {
    World, defineComponent, Resource, StateMachine, ProceduralShape, Spring2D, InteractionRegion, InteractionRouter,
    DialogueSession, selectLine, formatDialogueText, createWeightedSession, SystemRandom,
} from '../../src/gamelib';
import type { VisualStateMap, DialogueDefinition, DialogueLine, Shape2D, Vec2 } from '../../src/gamelib';

const Position = defineComponent({ name: 'Position', defaults: { x: 0, y: 0 } });
const Velocity = defineComponent({ name: 'Velocity', defaults: { vx: 0, vy: 0 } });

type GameContext = {
    hp: number;
    money: number;
    mood?: string;
    name?: string;
};

// 调色板
const C = {
    bg: 0x141824, panel: 0x1e2636, panelBorder: 0x38445e,
    text: 0xd7e0f2, dim: 0x7c8db0, accent: 0x58c4ff, warn: 0xffb454,
    gold: 0xffd166, good: 0x6ee7a0, danger: 0xff5f6d,
    idle: 0x3b4a6b, hover: 0x52669a, pressed: 0x2e3a57,
};

interface UiButton {
    region: InteractionRegion;
    shape: Shape2D;
    label: string;
    labelX: number;
    labelY: number;
    labelT?: Phaser.GameObjects.Text;
}

interface ChoiceItem {
    region: InteractionRegion;
    text: Phaser.GameObjects.Text;
    id: string;
}

export class DemoScene extends Phaser.Scene {
    // Resource
    private hp!: Resource;
    private gold!: Resource;
    private hpFill!: Phaser.GameObjects.Rectangle;
    private hpText!: Phaser.GameObjects.Text;
    private resInfo!: Phaser.GameObjects.Text;

    // State
    private character!: StateMachine<GameContext>;
    private visualStates!: VisualStateMap;
    private charImages = new Map<string, Phaser.GameObjects.Image>();
    private charName!: Phaser.GameObjects.Text;

    // Geometry
    private blob!: ProceduralShape;
    private blobSpring = new Spring2D(90, 12);
    private blobG!: Phaser.GameObjects.Graphics;
    private blobInfo!: Phaser.GameObjects.Text;
    private pokeTimer = 0;

    // Interaction
    private regions = new InteractionRouter();
    private regionG!: Phaser.GameObjects.Graphics;
    private buttons: UiButton[] = [];

    // Dialogue
    private log!: Phaser.GameObjects.Text;
    private logLines: string[] = [];
    private chat!: Phaser.GameObjects.Text;
    private treeTitle!: Phaser.GameObjects.Text;
    private tree!: DialogueSession<GameContext>;
    private barkLines!: DialogueLine<GameContext>[];
    private barkRandom = new SystemRandom();
    private choiceG!: Phaser.GameObjects.Graphics;
    private choiceItems: ChoiceItem[] = [];

    // Weighted
    private loot!: ReturnType<typeof createWeightedSession>;
    private lootText!: Phaser.GameObjects.Text;

    // ECS
    private world = new World();
    private ecsImages = new Map<number, Phaser.GameObjects.Image>();
    private ecsInfo!: Phaser.GameObjects.Text;
    private ecsSpawnTimer = 0;
    private ecsBounds = { x: 676, y: 92, w: 256, h: 330 };

    constructor() {
        super('Demo');
    }

    create(): void {
        this.makeTextures();
        this.buildLayout();
        this.buildResourcePanel();
        this.buildCharacterPanel();
        this.buildProcShapePanel();
        this.buildInteractPanel();
        this.buildDialoguePanel();
        this.buildLootPanel();
        this.buildEcsPanel();
        this.buildInput();

        this.logTo('ludum v3.0.0 就绪 —— 7 模块集成演示', C.good);
        this.logTo('悬停 / 点击 / 按住拖拽试试', C.dim);
    }

    // ------------------------------------------------------------------ 纹理
    private makeTextures(): void {
        const mk = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
            if (this.textures.exists(key)) return;
            const g = this.add.graphics();
            draw(g);
            g.generateTexture(key, w, h);
            g.destroy();
        };
        const face = (key: string, color: number): void => {
            mk(key, 72, 72, (g) => {
                g.fillStyle(color, 1).fillCircle(36, 36, 28);
                g.lineStyle(3, 0xffffff, 1).strokeCircle(36, 36, 28);
                g.fillStyle(0x10141f, 1).fillCircle(27, 31, 4).fillCircle(45, 31, 4);
            });
        };
        face('faceNeutral', 0x58a6ff);
        face('faceHappy', 0x6ee7a0);
        face('faceCritical', 0xff5f6d);
        mk('dot', 10, 10, (g) => { g.fillStyle(0x58c4ff, 1).fillRect(0, 0, 10, 10); });
        mk('dotGold', 10, 10, (g) => { g.fillStyle(0xffd166, 1).fillRect(0, 0, 10, 10); });
    }

    // ------------------------------------------------------------------ 布局
    private buildLayout(): void {
        const { width } = this.scale;
        this.add.rectangle(width / 2, 20, width, 40, 0x0d1018).setAlpha(0.9);
        this.add.text(14, 11, 'ludum x Phaser 4 —— 小通用引擎 · 模块集成演示', { fontFamily: 'Arial', fontSize: '16px', color: '#d7e0f2' });
        const v = this.add.text(884, 11, 'v3.0.0', { fontFamily: 'monospace', fontSize: '13px', color: '#7c8db0' });
        v.setOrigin(1, 0);

        this.panel(12, 44, 340, 168, '(1) Resource  数值资源');
        this.panel(12, 218, 340, 150, '(2) StateSprite  状态精灵');
        this.panel(12, 374, 340, 150, '(3) ProcShape  程序化形状');
        this.panel(364, 44, 280, 228, '(4) InteractRegion  交互区域');
        this.panel(364, 278, 280, 246, '(5) Dialogue  对话系统');
        this.panel(656, 44, 292, 132, '(6) WeightedEvent  加权掉落');
        this.panel(656, 182, 292, 352, '(7) ECS  实体组件系统');
        this.panel(12, 530, 936, 98, '事件日志');
        this.log = this.txt(24, 560, '…', C.text, '11px');

        this.regionG = this.add.graphics();
        this.choiceG = this.add.graphics();
        this.blobG = this.add.graphics();
        this.regionG.setDepth(4);
        this.choiceG.setDepth(4);
        this.blobG.setDepth(3);
    }

    private panel(x: number, y: number, w: number, h: number, title: string): void {
        const g = this.add.graphics();
        g.fillStyle(C.panel, 0.98).fillRoundedRect(x, y, w, h, 6);
        g.lineStyle(1, C.panelBorder, 1).strokeRoundedRect(x, y, w, h, 6);
        this.add.text(x + 10, y + 6, title, { fontFamily: 'Arial', fontSize: '13px', color: '#9fb4d8' });
    }

    private txt(x: number, y: number, s: string, color: string | number = '#d7e0f2', size = '12px'): Phaser.GameObjects.Text {
        const css = typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color;
        const t = this.add.text(x, y, s, { fontFamily: 'monospace', fontSize: size, color: css });
        t.setDepth(6);
        return t;
    }

    /** 注册一个矩形 UI 按钮(通用点击控件) */
    private addRectButton(btnId: string, x: number, y: number, w: number, h: number, label: string, onClick: () => void): void {
        const shape: Shape2D = { kind: 'rect', x, y, width: w, height: h };
        const region = new InteractionRegion(shape);
        region.events.subscribe((e) => { if (e.type === 'click') onClick(); });
        this.regions.register(btnId, region);
        this.buttons.push({ region, shape, label, labelX: x + 8, labelY: y + 5 });
    }

    // ------------------------------------------------------------------ (1) Resource
    private buildResourcePanel(): void {
        this.hp = new Resource({ id: 'hp', value: 100, max: 100, regenPerSecond: 2 });
        this.gold = new Resource({ id: 'gold', value: 50, max: 999 });

        const barBg = this.add.rectangle(24, 84, 316, 18, 0x0d1018).setOrigin(0, 0);
        barBg.setStrokeStyle(1, 0x38445e);
        this.hpFill = this.add.rectangle(25, 85, 314, 16, C.danger).setOrigin(0, 0);
        this.hpText = this.txt(28, 78, '', '#ffffff', '11px');
        this.resInfo = this.txt(24, 106, '', C.dim, '11px');
        this.txt(24, 132, '操作(点击按钮=InteractRegion click 事件):', '#7c8db0', '11px');

        this.addRectButton('r_hurt', 24, 150, 92, 26, '受伤 -15', () => {
            this.hp.subtract(15);
            this.logTo('受到 15 点伤害', C.danger);
        });
        this.addRectButton('r_heal', 126, 150, 92, 26, '治疗 +12', () => {
            this.hp.add(12);
            this.logTo('治疗 12 点', C.good);
        });
        this.addRectButton('r_poison', 228, 150, 112, 26, '中毒 8s(-4/s)', () => {
            this.hp.addModifier({ id: 'poison', kind: 'decay', amountPerSecond: 4, durationSeconds: 8 });
            this.logTo('中了剧毒:8 秒内每秒 -4 HP', C.warn);
        });
        this.txt(24, 184, 'onThreshold(20, below) -> 危险提示;modifier 到期自动移除', C.dim, '10px');
        this.txt(24, 198, 'add 伤害时若穿过 20/0 阈值会触发事件(见日志)', C.dim, '10px');
        this.hp.onThreshold(20, 'below', () => this.logTo('[阈值] HP 跌破 20!', C.danger));
        this.hp.onThreshold(50, 'above', () => this.logTo('[阈值] HP 回到 50 以上', C.good));
        this.hp.subscribeChange((oldV, newV) => {
            if (oldV !== newV && newV === this.hp.max) this.logTo('[事件] HP 回满', C.good);
        });
    }

    // ------------------------------------------------------------------ (2) StateMachine
    private buildCharacterPanel(): void {
        this.character = new StateMachine<GameContext>({
            states: ['neutral', 'happy', 'critical'],
            initialState: 'neutral',
            conditions: [
                { state: 'critical', when: (ctx) => ctx.hp < 25, priority: 10 },
                { state: 'happy', when: (ctx) => ctx.money > 120, priority: 5 },
            ],
        });
        this.visualStates = {
            neutral: { textureKey: 'faceNeutral' },
            happy: { textureKey: 'faceHappy' },
            critical: { textureKey: 'faceCritical' },
        };

        for (const name of ['neutral', 'happy', 'critical']) {
            const img = this.add.image(66, 288, this.visualStates[name]!.textureKey);
            img.setOrigin(0.5).setScale(1.7).setAlpha(0);
            this.charImages.set(name, img);
        }
        this.charName = this.txt(128, 240, 'state: neutral', C.text, '13px');
        this.txt(128, 260, '由条件自动切换(带 alpha 交叉淡入淡出)', C.dim, '10px');

        this.addRectButton('c_gold1', 128, 290, 96, 26, '+50 金币', () => {
            this.gold.add(50);
            this.logTo('金币 +50 (money>120 -> happy)', C.gold);
        });
        this.addRectButton('c_gold2', 234, 290, 96, 26, '-100 金币', () => {
            this.gold.subtract(100);
            this.logTo('金币 -100', C.gold);
        });
        this.addRectButton('c_tmp', 128, 324, 202, 26, '临时状态:开心 3 秒', () => {
            this.character.setState('happy', { durationSeconds: 3 });
            this.logTo('临时状态 happy 3 秒(setState durationSeconds)', C.accent);
        });
        this.txt(128, 358, '状态:neutral/happy/critical,条件按 priority 降序判定', C.dim, '10px');
        this.character.onStateChange((oldS, newS) => this.logTo('[状态] ' + oldS + ' -> ' + newS, C.accent));
    }

    // ------------------------------------------------------------------ (3) Geometry
    private buildProcShapePanel(): void {
        this.blob = new ProceduralShape({ kind: 'ellipse', baseWidth: 124, baseHeight: 100, sides: 40 });
        this.blobInfo = this.txt(24, 392, '', C.dim, '11px');
        this.txt(24, 470, '每 2.5s 自动戳 + 点击圆内任意处戳一下', C.dim, '10px');
        this.txt(24, 486, 'scale<-HP、bulge<-金币 (每帧读资源值传入 generate)', C.dim, '10px');
        this.txt(24, 502, '几何=纯计算,generate() 交给 Phaser 画', C.dim, '10px');

        const zoneShape: Shape2D = { kind: 'circle', center: { x: 182, y: 449 }, radius: 70 };
        const zone = new InteractionRegion(zoneShape);
        zone.events.subscribe((e) => {
            if (e.type === 'click') {
                this.blobSpring.applyImpulse(e.position.x - 182, e.position.y - 449);
                this.logTo('戳了一下 blob!', C.warn);
            }
        });
        this.regions.register('blobZone', zone);
        this.buttons.push({ region: zone, shape: zoneShape, label: '', labelX: 0, labelY: 0 });
    }

    // ------------------------------------------------------------------ (4) InteractRegion
    private buildInteractPanel(): void {
        // 可拖拽方块(drag 事件 + offset 移动)
        const dragShape: Shape2D = { kind: 'rect', x: 18, y: 64, width: 74, height: 46 };
        const dragBox = new InteractionRegion(dragShape);
        dragBox.events.subscribe((e) => {
            if (e.type === 'drag' && e.phase === 'move') {
                const o = dragBox.getOffset();
                dragBox.setOffset(o.x + e.delta.x, o.y + e.delta.y);
            }
        });
        this.regions.register('dragBox', dragBox);
        this.buttons.push({ region: dragBox, shape: dragShape, label: '可拖拽', labelX: 28, labelY: 78 });

        // 圆形按钮(回血)
        const healShape: Shape2D = { kind: 'circle', center: { x: 196, y: 120 }, radius: 34 };
        const heal = new InteractionRegion(healShape);
        heal.events.subscribe((e) => {
            if (e.type === 'click') {
                this.hp.add(10);
                this.logTo('圆形区域点击:回血 +10', C.good);
            }
        });
        this.regions.register('healCircle', heal);
        this.buttons.push({ region: heal, shape: healShape, label: '回血', labelX: 183, labelY: 116 });

        // 多边形区域(三角形,射线法命中)
        const tri: Vec2[] = [{ x: -30, y: 26 }, { x: 0, y: -28 }, { x: 30, y: 26 }];
        const triShape: Shape2D = { kind: 'polygon', points: tri };
        const pokeTri = new InteractionRegion(triShape);
        pokeTri.setOffset(268, 156);
        pokeTri.events.subscribe((e) => {
            if (e.type === 'click') {
                this.blobSpring.applyImpulse((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 40);
                this.logTo('多边形(三角形)命中:随机戳 blob', C.warn);
            }
        });
        this.regions.register('pokeTri', pokeTri);
        this.buttons.push({ region: pokeTri, shape: triShape, label: '戳Blob', labelX: 268 - 22, labelY: 156 - 14 });

        this.txt(24, 220, 'hover 进入/离开 -> 颜色变化 (enter/leave)', C.dim, '10px');
        this.txt(24, 238, '按住方块拖动 -> drag 事件,setOffset 移动区域', C.dim, '10px');
        this.txt(24, 256, 'rect / circle / polygon 三种命中检测', C.dim, '10px');
        this.txt(24, 274, '管理器:注册顺序逆序命中,由 Phaser 输入桥接', C.dim, '10px');

    }

    // ------------------------------------------------------------------ (5) Dialogue
    private buildDialoguePanel(): void {
        this.barkLines = [
            { id: 'warn', text: '喂,{name}!血量只剩 {hp},快治疗!', priority: 10, condition: (c) => c.hp < 30 },
            { id: 'greet', text: '你好,{name}!今天有 {money} 枚金币,心情{mood}!', priority: 1, condition: (c) => c.mood === 'happy' },
            { id: 'idle', text: '空气不错。金币 > 120 会让我开心。', priority: 0 },
        ];

        this.txt(378, 60, '[NPC] 每 2 秒根据条件说一句(selectLine)', C.dim, '10px');
        this.chat = this.txt(378, 76, '(等待 NPC 说话…)', C.text, '11px');
        this.treeTitle = this.txt(378, 108, '对话树:点击 [开始对话树]', C.text, '12px');

        const startTree = (): void => {
            const definition: DialogueDefinition<GameContext> = {
                startNodeId: 'start',
                nodes: {
                    start: {
                        text: '你想做什么,冒险者?',
                        choices: [
                            { id: 'fight', text: '战斗!', next: 'fight' },
                            { id: 'rest', text: '休息一下', next: 'rest' },
                            { id: 'leave', text: '离开' },
                        ],
                    },
                    fight: {
                        text: '你选择了战斗:受伤 -20(节点 action)',
                        action: () => this.hp.subtract(20),
                        next: 'start',
                    },
                    rest: {
                        text: '休息片刻:HP +15',
                        action: () => this.hp.add(15),
                        next: 'start',
                    },
                },
            };
            this.tree = new DialogueSession<GameContext>(definition, { hp: Math.round(this.hp.get()), money: Math.round(this.gold.get()) });
            this.logTo('[对话] 开始对话树', C.accent);
            this.refreshTree();
        };

        this.addRectButton('d_start', 378, 466, 110, 26, '开始对话树', startTree);
        this.txt(378, 500, '选择由 getChoices() 动态生成矩形区域', C.dim, '10px');
        this.txt(378, 518, '对话条目带条件/优先级;选择用稳定 id(非 1-based)', C.dim, '10px');

        this.time.addEvent({ delay: 2000, loop: true, callback: () => {
            const ctx: GameContext = {
                hp: Math.round(this.hp.get()),
                money: Math.round(this.gold.get()),
                mood: this.gold.get() > 120 ? 'happy' : 'calm',
                name: '玩家',
            };
            const line = selectLine(this.barkLines, ctx, this.barkRandom);
            if (line) {
                const text = formatDialogueText(line.text, ctx);
                this.chat.setText(text);
                this.logTo('NPC: ' + text, C.text);
            }
        } });
    }

    private refreshTree(): void {
        // 清掉旧的选项
        for (const item of this.choiceItems) {
            this.regions.remove(item.id);
            item.text.destroy();
        }
        this.choiceItems = [];
        this.choiceG.clear();
        if (!this.tree) return;

        const nodeText = this.tree.getText();
        if (this.tree.isEnded()) {
            this.treeTitle.setText('(对话已结束)');
            return;
        }
        this.treeTitle.setText('『 ' + (nodeText ?? '') + ' 』');

        const choices = this.tree.getChoices();
        // 无选项的节点提供 [继续]
        if (choices.length === 0) {
            const region = new InteractionRegion({ kind: 'rect', x: 378, y: 136, width: 250, height: 22 });
            region.events.subscribe((e) => {
                if (e.type === 'click') {
                    this.tree.continue();
                    this.refreshTree();
                }
            });
            const id = 'choice_cont';
            this.regions.register(id, region);
            const t = this.txt(388, 140, '[ 继续 ]', C.text, '12px');
            this.choiceItems.push({ region, text: t, id });
            return;
        }
        choices.forEach((choice, i) => {
            const y = 138 + i * 30;
            const region = new InteractionRegion({ kind: 'rect', x: 378, y, width: 250, height: 26 });
            region.events.subscribe((e) => {
                if (e.type === 'click') {
                    this.tree.choose(choice.id);
                    this.refreshTree();
                }
            });
            const id = 'choice_' + choice.id;
            this.regions.register(id, region);
            const t = this.txt(388, y + 7, (i + 1) + '. ' + choice.text, C.text, '12px');
            this.choiceItems.push({ region, text: t, id });
        });
    }

    // ------------------------------------------------------------------ (6) WeightedEvent
    private buildLootPanel(): void {
        this.loot = createWeightedSession({
            entries: [
                { id: 'common', weight: 75, type: 'item' },
                { id: 'rare', weight: 20, type: 'item' },
                { id: 'legendary', weight: 5, type: 'item' },
                { id: 'curse', weight: 10, type: 'curse' },
            ],
        }, new SystemRandom(), { pity: { threshold: 8, guarantee: (e) => e.id === 'legendary' } });
        this.txt(670, 60, '保底:连续 8 次未中传说 -> 必出', C.dim, '10px');
        this.lootText = this.txt(670, 86, '', C.text, '11px');

        const btnShape: Shape2D = { kind: 'rect', x: 670, y: 138, width: 128, height: 28 };
        const btn = new InteractionRegion(btnShape);
        btn.events.subscribe((e) => {
            if (e.type !== 'click') return;
            const ev = this.loot.roll();
            if (ev) {
                const colors: Record<string, string> = { common: '#9aa4bd', rare: '#58c4ff', legendary: '#ffd166', curse: '#ff5f6d' };
                this.logTo('开箱 -> ' + ev.id + ' (' + ev.type + ')', colors[ev.id] ?? C.text);
            }
        });
        this.regions.register('lootBtn', btn);
        this.buttons.push({ region: btn, shape: btnShape, label: '开 箱', labelX: 706, labelY: 144 });
    }

    // ------------------------------------------------------------------ (7) ECS
    private buildEcsPanel(): void {
        this.world.addSystem({
            name: 'Bounce',
            requires: [Position, Velocity],
            run: (entity, dt) => {
                const p = entity.get(Position)!;
                const v = entity.get(Velocity)!;
                const b = this.ecsBounds;
                p.x += v.vx * dt;
                p.y += v.vy * dt;
                if (p.x < b.x + 5) { p.x = b.x + 5; v.vx = Math.abs(v.vx); }
                if (p.x > b.x + b.w - 5) { p.x = b.x + b.w - 5; v.vx = -Math.abs(v.vx); }
                if (p.y < b.y + 5) { p.y = b.y + 5; v.vy = Math.abs(v.vy); }
                if (p.y > b.y + b.h - 5) { p.y = b.y + b.h - 5; v.vy = -Math.abs(v.vy); }
            },
        });

        this.ecsInfo = this.txt(670, 500, '', C.dim, '11px');
        this.txt(670, 522, '每帧 World.update(dt):实体由 Bounce 系统驱动,', C.dim, '10px');
        this.txt(670, 538, '金色=带 tag(elite);图像位置随组件同步', C.dim, '10px');

        this.addRectButton('e_spawn', 670, 210, 60, 24, '生成', () => {
            this.spawnEntity();
            this.logTo('ECS:手动生成一个实体', C.accent);
        });
        this.addRectButton('e_clear', 738, 210, 60, 24, '清空', () => {
            for (const e of this.world.query()) e.destroy();
            this.logTo('ECS:销毁全部实体(由系统清理)', C.dim);
        });
        this.txt(670, 244, '实体上限 14,每 2~4s 自动生成一个', C.dim, '10px');
    }

    private spawnEntity(): void {
        const b = this.ecsBounds;
        const x = b.x + 20 + Math.random() * (b.w - 40);
        const y = b.y + 20 + Math.random() * (b.h - 40);
        const elite = Math.random() < 0.3;
        const e = this.world.createEntity()
            .add(Position, { x, y })
            .add(Velocity, { vx: (Math.random() - 0.5) * 170, vy: (Math.random() - 0.5) * 170 });
        if (elite) e.tag('elite');
        const img = this.add.image(x, y, elite ? 'dotGold' : 'dot');
        img.setDepth(1);
        this.ecsImages.set(e.id, img);
    }

    // ------------------------------------------------------------------ 输入桥接
    private buildInput(): void {
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.regions.pointerDown({ pointerId: p.id, position: { x: p.x, y: p.y }, button: 0 }));
        this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.regions.pointerUp({ position: { x: p.x, y: p.y }, button: 0 }));
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.regions.pointerMove({ position: { x: p.x, y: p.y } }));
    }

    // ------------------------------------------------------------------ 日志
    private logTo(text: string, _color?: string | number): void {
        this.logLines.push(text);
        if (this.logLines.length > 5) this.logLines.shift();
        if (!this.log) return;
        const lines: string[] = this.logLines.map((l, i) => (i === this.logLines.length - 1 ? '> ' : '  ') + l);
        this.log.setText(lines);
    }

    // ------------------------------------------------------------------ 每帧
    update(_time: number, delta: number): void {
        const dt = Math.min(delta / 1000, 0.05);

        // (1) Resource 自动回复 + 事件驱动 UI
        this.hp.update(dt);
        this.gold.update(dt);
        const pct = this.hp.getPercent();
        this.hpFill.width = Math.max(0, Math.round(314 * pct));
        this.hpText.setText(Math.round(this.hp.get()) + '/' + this.hp.max + ' (regen ' + this.hp.regenPerSecond + '/s)');
        this.resInfo.setText('modifiers: ' + this.hp.modifierCount + ' 个 · gold ' + Math.round(this.gold.get()));

        // (2) 状态渲染
        this.character.updateContext({ hp: this.hp.get(), money: this.gold.get() });
        this.character.update(dt);
        const cur = this.character.getState() ?? 'neutral';
        this.charName.setText('state: ' + cur + (this.character.isTransitioning() ? ' [过渡中]' : ''));
        const eased = this.character.getTransitionEasing()(this.character.getTransitionProgress());
        const prev = this.character.getPreviousState();
        for (const [name, img] of this.charImages) {
            const isCur = name === cur;
            const isPrev = this.character.isTransitioning() && prev != null && name === prev;
            img.setVisible(isCur || isPrev);
            if (isCur) img.setAlpha(0.2 + 0.8 * eased);
            else if (isPrev) img.setAlpha(0.8 * (1 - eased));
        }

        // (3) Geometry
        this.pokeTimer -= dt;
        if (this.pokeTimer <= 0) {
            this.blobSpring.applyImpulse((Math.random() - 0.5) * 70, (Math.random() - 0.5) * 50);
            this.pokeTimer = 2.5;
        }
        this.blobSpring.update(dt);
        this.drawBlob();

        // (4) 交互区域可视化
        this.drawRegions();
        this.drawChoiceBoxes();

        // (6) 加权统计文本
        const st = this.loot.getStats();
        const evs = st.events;
        this.lootText.setText([
            '已开 ' + st.totalRolls + ' 次 / 触发 ' + st.totalTriggers,
            'common ' + (evs.common?.count ?? 0) + '  rare ' + (evs.rare?.count ?? 0),
            'legendary ' + (evs.legendary?.count ?? 0) + '  curse ' + (evs.curse?.count ?? 0),
        ]);

        // (7) ECS
        this.ecsSpawnTimer -= dt;
        if (this.ecsSpawnTimer <= 0 && this.world.count(Position, Velocity) < 14) {
            this.spawnEntity();
            this.ecsSpawnTimer = 2 + Math.random() * 2.5;
        }
        this.world.update(dt);
        const alive = new Set<number>();
        for (const e of this.world.query(Position, Velocity)) {
            const p = e.get(Position)!;
            const img = this.ecsImages.get(e.id);
            if (img) {
                img.setPosition(p.x, p.y);
                alive.add(e.id);
            }
        }
        for (const [id, img] of this.ecsImages) {
            if (!alive.has(id)) {
                img.destroy();
                this.ecsImages.delete(id);
            }
        }
        this.ecsInfo.setText('实体: ' + this.world.query().length + '  精英(tag): ' + this.world.queryByTag('elite').length + '   FPS ' + Math.round(this.game.loop.actualFps));
    }

    private drawBlob(): void {
        const g = this.blobG;
        g.clear();
        const cx = 182, cy = 449;
        const scale = 0.55 + (this.hp.get() / 100) * 0.95;
        const bulge = Math.max(0, (this.gold.get() - 100) / 500);
        const pts = this.blob.generate({ scale, bulge, displacement: this.blobSpring.position });
        if (pts.length < 3) return;
        const v: Phaser.Math.Vector2[] = pts.map((p) => new Phaser.Math.Vector2(cx + p.x, cy + p.y));
        g.fillStyle(0x8fb7ff, 1).fillPoints(v, true);
        g.lineStyle(2, 0xffffff, 1).strokePoints(v, true, true);
        g.fillStyle(0x10141f, 1).fillCircle(cx - 15, cy - 5, 3).fillCircle(cx + 15, cy - 5, 3);

        const [sw] = this.blob.getSize({ scale });
        const disp = this.blobSpring.position;
        this.blobInfo.setText('size ' + Math.round(sw) + '  disp ' + disp.x.toFixed(1) + ',' + disp.y.toFixed(1) + '  点此/自动戳动');
    }

    private drawRegions(): void {
        const g = this.regionG;
        g.clear();
        for (const btn of this.buttons) {
            const r = btn.region;
            let color = C.idle;
            if (r.isDragging) color = C.pressed;
            else if (r.isPressed) color = C.pressed;
            else if (r.isHovered) color = C.hover;
            g.fillStyle(color, 0.95);
            this.drawShape(g, btn.shape, r.getOffset());
        }
        // 标签文本:仅在缺失时创建一次
        for (const btn of this.buttons) {
            if (btn.label && !btn.labelT) {
                const t = this.txt(btn.labelX, btn.labelY, btn.label, '#ffffff', '10px');
                t.setDepth(7);
                btn.labelT = t;
            }
        }
    }

    private drawShape(g: Phaser.GameObjects.Graphics, shape: Shape2D, offset: Vec2): void {
        const ox = offset.x, oy = offset.y;
        if (shape.kind === 'rect') {
            g.fillRoundedRect(ox + shape.x, oy + shape.y, shape.width, shape.height, 4);
        } else if (shape.kind === 'circle') {
            g.fillCircle(ox + shape.center.x, oy + shape.center.y, shape.radius);
        } else if (shape.kind === 'ellipse') {
            g.fillEllipse(ox + shape.center.x, oy + shape.center.y, shape.radiusX * 2, shape.radiusY * 2);
        } else {
            const v = shape.points.map((p) => new Phaser.Math.Vector2(ox + p.x, oy + p.y));
            g.fillPoints(v, true);
        }
    }

    private drawChoiceBoxes(): void {
        const g = this.choiceG;
        g.clear();
        for (const item of this.choiceItems) {
            const r = item.region;
            let color = C.idle;
            if (r.isPressed) color = C.pressed;
            else if (r.isHovered) color = C.hover;
            const shape = r.getShape();
            g.fillStyle(color, 0.95);
            if (shape.kind === 'rect') {
                g.fillRoundedRect(shape.x, shape.y, shape.width, shape.height, 4);
                g.lineStyle(1, C.panelBorder, 1).strokeRoundedRect(shape.x, shape.y, shape.width, shape.height, 4);
            }
        }
    }

}
