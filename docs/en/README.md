# ludum Documentation

**Language / 语言:** [中文](/docs/) · English

> ludum is a small, engine-agnostic, strongly-typed TypeScript toolkit for reusable gameplay
> systems — ECS, resources and attributes, modifiers, state machines, dialogue, weighted random
> selection, pity systems, gameplay conditions, geometry and interaction hit testing.

## Entry points

| Document | Content |
| :-- | :-- |
| [📥 Download](download.md) | npm install and release metadata, auto-updated on every release |
| [README (English)](/README.en.md) | Overview, install, module map and examples |
| [Architecture map](ARCHITECTURE_MAP.md) | How the modules fit together |
| [Portability](PORTABILITY.md) | Language-agnostic portability strategy |

## Chinese documentation (default)

The module-level guides, the ADR set and the migration guide are written in Chinese and live
under `/docs/`. Start from the [Chinese overview](/README.md), or use the sidebar.

| Document | Content |
| :-- | :-- |
| [ECS](/docs/ECS.md) · [资源系统](/docs/RESOURCE.md) · [状态机](/docs/STATE.md) | Core modules |
| [对话系统](/docs/DIALOGUE.md) · [加权事件](/docs/WEIGHTED_EVENT.md) | Dialogue and weighted events |
| [几何](/docs/GEOMETRY.md) · [交互](/docs/INTERACTION.md) · [事件总线](/docs/EVENT_BUS.md) | Geometry, interaction, signals |
| [架构说明](/docs/ARCHITECTURE.md) · [架构地图](/docs/ARCHITECTURE_MAP.md) · [移植性](/docs/PORTABILITY.md) | Architecture and portability |
| [ADR 索引](/docs/adr/README.md) | Architecture decision records (Chinese index, English records) |
| [从 v2 迁移到 v3](/docs/migration-v3.md) | Migration guide |

> Note on the ADRs: the index is Chinese while the records themselves are English. ADRs are
> immutable decision records and are conventionally written in English, so they are kept as-is
> rather than mirrored.

## Links

- npm: <https://www.npmjs.com/package/ludum>
- Repository: <https://github.com/redtidev1918/ludum>
- Releases: <https://github.com/redtidev1918/ludum/releases>
- Changelog: <https://github.com/redtidev1918/ludum/blob/master/CHANGELOG.md>
