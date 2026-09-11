# ludum Documentation

**Language / 语言:** [中文](/docs/) · English

> ludum is a small, engine-agnostic, strongly-typed TypeScript toolkit for reusable gameplay
> systems — ECS, resources and attributes, modifiers, state machines, dialogue, weighted random
> selection, pity systems, gameplay conditions, geometry and interaction hit testing.

The English documentation is **complete and page-for-page mirrored** with the Chinese section
under `/docs/`.

## Entry points

| Document | Content |
| :-- | :-- |
| [📥 Download](download.md) | npm install and release metadata, auto-updated on every release |
| [README (English)](/README.en.md) | Overview, install, module map and examples |

## Core modules

| Document | Content |
| :-- | :-- |
| [ECS](ECS.md) | Instance-based, type-safe entity component system |
| [Resource](RESOURCE.md) | Numeric resources with range and modifier semantics |
| [State](STATE.md) | `StateMachine<TContext>` plus `VisualStateMap` |
| [Dialogue](DIALOGUE.md) | Data-driven branching dialogue |
| [Weighted](WEIGHTED_EVENT.md) | Weighted random selection with pity |
| [Geometry](GEOMETRY.md) | Typed `Shape2D`, pure hit testing, springs, procedural shapes |
| [Interaction](INTERACTION.md) | Regions and pointer routing with typed events |
| [EventBus (removed)](EVENT_BUS.md) | Why the stringly-typed bus was replaced by `Signal<T>` |

## Architecture

| Document | Content |
| :-- | :-- |
| [Architecture](ARCHITECTURE.md) | Layer model and core principles |
| [Architecture map](ARCHITECTURE_MAP.md) | How the modules fit together |
| [Portability](PORTABILITY.md) | Language-agnostic portability strategy |
| [Migration to v3](migration-v3.md) | Every breaking change from v1 |

> Note on the ADRs (`/docs/adr/`): the index is Chinese while the records themselves are English.
> ADRs are immutable decision records and are conventionally written in English, so they are kept
> as-is rather than mirrored.

## Links

- npm: <https://www.npmjs.com/package/ludum>
- Repository: <https://github.com/redtidev1918/ludum>
- Releases: <https://github.com/redtidev1918/ludum/releases>
- Changelog: <https://github.com/redtidev1918/ludum/blob/master/CHANGELOG.md>
