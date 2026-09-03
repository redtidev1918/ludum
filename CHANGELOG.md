# Changelog

## 3.0.0-alpha.1

- Complete v3 rewrite: engine-independent core (ES2022-only), **zero runtime dependencies**.
- Kernel primitives: `Clock` / `RandomSource` / `IdGenerator` / `ValueSource<T>` /
  `Predicate<T>` / `Signal<T>` / `Countdown` / `ConditionExpression` /
  `Definition` + `DefinitionRegistry` / validation types.
- ECS v3: instance-based `World` + typed `ComponentType<T>` + deferred structural mutation.
- `Resource` / `DerivedResource` / `ResourceRegistry`.
- `StateMachine` + `VisualStateMap` (removed legacy `StateSprite` and fake draw APIs).
- `WeightedTable` / `selectWeighted` / `WeightedSession` / `ShuffleBag`.
- `DialogueDefinition` / `DialogueSession` / `selectLine` (choice ids, typed context).
- `Shape2D` / `containsPoint` / `Spring2D` / `ProceduralShape`; `InteractionRegion` /
  `InteractionRouter`.
- `npm run check` gate, subpath exports, lightweight benchmark.
