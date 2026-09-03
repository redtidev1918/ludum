# 架构图 (Architecture Map)

模块 → 允许的依赖。下层绝不 import 上层。

| 模块 | 允许的依赖 |
|---|---|
| runtime（内核） | 仅标准库 |
| predicate · condition-expression · definition · validation · signal（内核） | 仅标准库 |
| ecs | 内核 |
| resource | 内核 |
| state | 内核、predicate |
| weighted | 内核、predicate |
| shuffle-bag | 内核（runtime） |
| geometry | 内核 |
| interaction | 内核（signal）、geometry |
| dialogue | 内核、predicate |
| examples | 所有公共模块 |
