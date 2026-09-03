# Architecture Map

> 中文：[ARCHITECTURE_MAP.md](./ARCHITECTURE_MAP.md)

Module → allowed dependencies. Lower layers never import upper layers.

| Module | Allowed dependencies |
|---|---|
| runtime (kernel) | stdlib only |
| predicate · condition-expression · definition · validation · signal (kernel) | stdlib only |
| ecs | kernel |
| resource | kernel |
| state | kernel, predicate |
| weighted | kernel, predicate |
| shuffle-bag | kernel (runtime) |
| geometry | kernel |
| interaction | kernel (signal), geometry |
| dialogue | kernel, predicate |
| examples | all public modules |
