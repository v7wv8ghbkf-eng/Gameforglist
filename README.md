# 广义表探险 · 两种存储结构

一个纯 HTML / CSS / JavaScript 实现的广义表教学工具。页面提供两种可切换的存储结构：

- **扩展线性链表**：`element / sublist` + `data / sub_list` + `next`；
- **头尾链表**：`ATOM / LIST` 结点 + `hp / tp` 指针。

用户可以：

- 在顶部“存储结构”切换两种表示，两种模式都支持创建、取头尾、长度、深度和判等；
- 顶部“深色 / 浅色”切换主题，偏好保存在当前浏览器；
- 为广义表案例命名，例如 `A = (a,(b,c),d)`、`B = (())`；
- 用 `BuildList` 的 `k` 编码逐步播放创建过程；
- 对当前表连续、嵌套地调用 `GetHead`、`GetTail`、求长度、求深度；
- 比较任意两个已命名案例，逐步检查 tag、data 与 sub_list 的相等性；
- 查看每一层调用的返回值、完整函数链和创建/判等步骤；
- 逐步播放每次调用的可视化过程，并同步高亮对应的 C 核心代码；
- 查看与题目代码一致的类型定义，以及不依赖辅助函数的创建、操作、判等函数。

页面无外部依赖，直接打开即可运行。

## 运行方式

直接双击 `index.html`；或在当前目录运行：

```bash
python -m http.server 8080
```

然后访问 `http://localhost:8080/`。

推荐使用最新的 Edge、Chrome 或 Firefox。主要针对 1366×768 及以上屏幕；窄屏允许页面滚动。

## 文件结构

```text
Gameforglist/
├── index.html  页面结构、命名案例、函数链、节点图、核心代码、题库
├── style.css   布局、节点、箭头、徽标、层号标尺、题库和代码样式
├── app.js      数据结构、输入解析、函数求值、步骤快照、渲染、播放器、题库
├── README.md   使用说明、语义约定、验收用例
└── presentation/  代码讲解演示文稿（PPTX / HTML / PDF / JSON）
```

## 深色模式

顶部工具栏提供“深色 / 浅色”切换：

- 默认浅色；点击后切换为深色，按钮变为“浅色”；
- 代码区、节点图、头尾链表 `hp / tp` 箭头、比较视图、题库和弹窗都会同步换色；
- 选择保存在 `localStorage` 的 `glist-theme` 键中，刷新或重新打开页面后保持；
- 如果浏览器禁用本地存储，主题只在当前页面会话中生效。

## 代码讲解演示文稿

`presentation/` 内提供一份 11 页的极简风格演示文稿，用于上台讲解这份 C 代码：

- [GList-Code-Walkthrough-final.pptx](presentation/GList-Code-Walkthrough-final.pptx)
- [GList-Code-Walkthrough-final.html](presentation/GList-Code-Walkthrough-final.html)
- [GList-Code-Walkthrough-final.pdf](presentation/GList-Code-Walkthrough-final.pdf)

结构、构造、输入协议、主程序、`IsEqual` 缺口、补全实现与边界风险各成逻辑块；代码页使用编号知识点标注，PPTX 内含演讲者备注。

## 两种存储结构

顶部“存储结构”开关可以随时切换；切换会回到当前案例的初始状态，两种模式都支持同一套操作。

### 扩展线性链表

```c
#include <stdio.h>
#include <stdlib.h>

typedef enum { false, true } bool;
typedef int ElemSet;
typedef enum { element, sublist } ElemTag; /* 结点标记类型 */
typedef struct GListNode *Position;        /* 指针即结点位置 */
typedef Position GList;
struct GListNode {
    ElemTag tag;        /* 结点标记 */
    union {
        ElemSet data;   /* 存储数据 */
        GList sub_list; /* 子表 */
    } u;
    Position next;      /* 线性表中下一个元素的位置 */
};
```

- `element` 结点保存 `data`；
- `sublist` 结点通过 `u.sub_list` 指向子表首结点；
- `next` 指向同级下一个元素；
- `GList L` 是一个指向首结点的指针。

### 头尾链表

```c
#include <stdio.h>
#include <stdlib.h>

typedef enum { false, true } bool;
typedef int ElemSet;
typedef enum { ATOM, LIST } NodeTag; /* 结点类型 */
typedef struct HTNode *GList;
struct HTNode {
    NodeTag tag;
    union {
        ElemSet data;
        struct {
            GList hp; /* 表头 */
            GList tp; /* 表尾 */
        } ptr;
    } u;
};
```

- 每个 `LIST` 结点对应原表中的一个“元素位置”：
  - `hp` 指向该位置的头部值，可能是 `ATOM` 结点，也可能是子表的第一个 `LIST` 结点；
  - `tp` 指向同级剩余表；
- `hp = NULL` 表示该位置是一个空子表；
- `GList L = NULL` 表示空表；
- 原子值保存在 `ATOM` 结点的 `u.data` 中。

头尾链表的可视化中，灰色 `L` 是 `GList` 指针，蓝框是 `LIST` 结点，绿色圆是 `ATOM` 结点；`hp` 为蓝色实线，`tp` 为琥珀色虚线。

可视化中的 `L / A` 灰色锚点是 `GList` 指针的图形表示，不是额外的数据结点，也不参与长度、深度和返回值计算。

### 输入框与 C 数据类型的对应关系

输入框用于快速构造案例，采用便于阅读的单字符原子：

```text
(a,(b,c),d)
((a,b),c,d)
(())
()
```

浏览器端会把输入解析为上述 `GList` 结构；C 操作代码本身不包含字符解析器，也不使用辅助函数。为了对应 `typedef int ElemSet`：

- 数字单字符 `0`–`9` 映射为对应整数；
- 字母/下划线映射为字符编码；
- 页面上仍显示原始单字符标记，鼠标悬停结点可查看其 `data` 数值。

取头尾、长度和深度只依赖结构与 `tag`；判等会比较 `data`，创建过程只负责按树结构生成结点。

## 命名案例

页面顶部提供：

- 默认案例：`A = (a,(b,c),d)`、`B = (())`；
- 案例标签按钮；
- “案例名”输入框；
- 广义表表达式输入框；
- “保存 / 更新案例”按钮。

操作方式：

1. 输入名称（最多 12 个字符，以字母、下划线或中文开头）；
2. 输入表达式；
3. 点击“保存 / 更新案例”；
4. 同名案例会更新表达式，新名称会新增案例；
5. 点击案例标签可切换，函数链会回到该案例的初始状态。

案例保存在当前页面内存中，刷新页面后恢复默认 A、B。

如果修改了输入但尚未保存，顶部会提示“草稿未保存；函数链仍作用于案例 X”。

## 嵌套函数链

顶部函数链栏提供四个操作：

```text
GetHead    取当前 GList 的首结点
GetTail    取首结点之后的剩余链
求长度      GListLength
求深度      GListDepth
```

每点击一个操作：

1. 立即计算该层调用的返回对象；
2. 把“操作名 + 返回值”追加到横向函数链；
3. 生成该操作的步骤快照并自动播放；
4. 右侧显示该操作的核心 C 代码并逐行高亮；
5. 返回值既显示在函数链中，也显示在左侧结果面板；
6. 函数链下方持续显示“当前对象”的完整嵌套表达式。

示例：

```text
A = (a,(b,c),d)
  → GetTail  ⇒ ((b,c),d)
  → GetHead  ⇒ (b,c)
  → 求长度   ⇒ 2
```

### 反复取表头、表尾

`GetHead` 和 `GetTail` 可以连续点击。只要返回值仍然是广义表，四个函数按钮就保持可用；每次点击都会把新的返回值追加到函数链，右侧重新演示该层操作。

例如从 `D = (a,(b,c,(d)),e)` 中取出 `d`：

```text
GetTail(D)                              ⇒ ((b,c,(d)),e)
GetHead(GetTail(D))                     ⇒ (b,c,(d))
GetTail(GetHead(GetTail(D)))            ⇒ (c,(d))
GetTail(GetTail(GetHead(GetTail(D))))   ⇒ ((d))
GetHead(GetTail(GetTail(
  GetHead(GetTail(D)))))                ⇒ (d)
GetHead(GetHead(GetTail(GetTail(
  GetHead(GetTail(D))))))               ⇒ d
```

返回 `d` 后，当前对象变成原子，函数按钮自动禁用；点击“撤销”可以回到上一步，继续观察。

函数链下方的“当前对象”行会保留完整表达式，并用“可继续 GetHead / GetTail”提示下一步是否还能取。

### 返回类型与按钮状态

- `GetHead` / `GetTail` 可能返回：
  - 一个元素原子，例如 `a`；
  - 一个子表，例如 `(b,c)`；
  - 空表 `()`；
  - 空表没有表头时显示“空表没有表头”。
- 扩展线性链表：`GetHead` 返回的首结点如果是 `sublist`，后续作用于它的表值 `u.sub_list`；
- 头尾链表：`GetHead` 直接返回 `L->u.ptr.hp`，它可能是 `ATOM` 结点，也可能是子表的第一个 `LIST` 结点；`GetTail` 返回 `L->u.ptr.tp`。
- 求长度、求深度返回整数。
- 当前对象不再是 `GList`（例如得到原子或整数）时，四个操作按钮会自动禁用。
- “撤销”回到函数链上一层；“重置链”回到当前命名案例。
- 函数链中的每个返回节点都可以点击，恢复到该层状态。
- 所有层级的返回值都保留在函数链中，便于观察嵌套调用的结果。

## 创建过程：BuildList

点击案例名输入框旁的“创建”，会从空图开始逐步播放当前存储结构的 `BuildList`。

两种结构都使用同一套 `k` 输入约定：

- `k = 0`：原子结点，随后读 `data`；
- `k > 0`：子表结点，递归 `BuildList(k)`；
- `k = -1`：空子表（本页为支持 `(())` 增加的演示扩展）。

扩展线性链表的创建过程：

- 先分配临时头结点 `dummy`，`tail` 指向它；
- 新结点用 `tail->next` 尾插；
- 最后释放 `dummy` 并返回首结点。

头尾链表的创建过程：

- 每个元素对应一个 `LIST` 结点；
- `hp` 指向 `ATOM` 或子表第一个 `LIST` 结点；
- `tp` 递归构建同级剩余表；
- `hp` 为空表示空子表。

步骤会同步高亮当前 `BuildList` 代码行，变量面板显示 `n`、`k`、`p`、递归栈与已建结点数。A 的扩展线性创建动画约 52 步，可用快进或速度控制缩短观看时间。

创建演示从案例的初始状态开始，不会沿用之前的函数链结果。如果输入框里有尚未保存的草稿，会提示先保存，避免演示的是旧案例。

## 判等过程：IsEqual

点击案例名输入框旁的“判等”，选择左右两个已命名案例，开始判等：

- 左侧图与右侧图并排显示；
- 当前比较的一对结点会同时高亮；发现差异时标记为红色；
- 扩展线性链表比较 `tag / data / u.sub_list / next`；
- 头尾链表比较每一对 `LIST` 结点的 `hp` 与 `tp`：

```text
hp 都为 NULL → 当前元素都为空子表
hp 一空一非空 → 不相等
hp 都是 ATOM → data 必须相等
hp 都是 LIST → 递归比较 hp
tp 同步前进；最后必须同时为 NULL
```

- 右侧显示 `IsEqual` 核心代码并逐行高亮；
- 最终结果在比较横幅与结果面板中显示 `true` 或 `false`；
- 点击比较横幅中的“退出”回到当前案例。

`IsEqual` 的代码与动画采用递归写法：

```c
bool IsEqual( GList glist1, GList glist2 )
{
    // Lists are all empty.
    if (glist1 == NULL && glist2 == NULL)
        return true;

    // There's one who arrives at the end first.
    if (glist1 == NULL || glist2 == NULL)
        return false;

    // Present tag if different.
    if (glist1 -> tag != glist2 -> tag)
        return false;

    if (glist1 -> tag == element)
    {
        if (glist1 -> u.data != glist2 -> u.data)
            return false;
    }
    else
    {
        if (!IsEqual(glist1 -> u.sub_list, glist2 -> u.sub_list))
            return false;
    }

    return IsEqual(glist1 -> next, glist2 -> next);
}
```

头尾链表模式使用同一套递归结构，只把 `u.data / u.sub_list / next` 换成 `hp / tp` 对应字段。

判等选择框中可以把同一个案例比较两次，用来观察“完全相等”的完整递归过程。

## 深度口径

为保持与最初验收要求一致，页面采用“层数口径”：

- 空链深度为 1；
- 扩展线性的 `element`、头尾链表的 `ATOM` 都计 1 层；
- 当前 GList 链的深度 = `1 + max(元素深度 / 子表 GList 深度)`；
- 头尾链表中 `hp = NULL` 的空子表元素按深度 1 计。

因此：

```text
A = (a,(b,c),d)   求深度 = 3
B = (())          求深度 = 2
()                求深度 = 1
```

教材常用的“括号重数口径”通常把原子深度记为 0，同一表达式会少一层。经典题库中会注明两种口径。

## 可视化

### 箭头

| 指针 | 图形 | 含义 |
|---|---|---|
| `GList` | 灰色实线 + `GList` | 命名变量指向首结点（绘图锚点） |
| `sub_list` | 蓝色实线 + `sub_list` | sublist 结点指向子表首结点 |
| `next` | 琥珀色虚线 + `next` | 指向同级下一结点 |
| 当前指针 | 红色加粗、流动虚线 | 当前步骤正在使用的指针 |

所有箭头都显示文字标签，不只靠颜色区分。

### 结点

- `element`：绿色圆形，显示原子标记、`element` 和结点 ID；
- `sublist`：蓝色矩形，显示“子表”、`sublist` 和结点 ID；
- `GList`：灰色锚点，显示案例名；
- 当前结点：橙色描边、缩放和阴影；
- 返回结点：额外虚线轮廓与结果标签。

### 长度和深度

- 求长度：被统计的结点显示 `#1`、`#2`……，画布右上角显示 `len = n`。
- 求深度：
  - 结点显示 `d1`、`d2`…… 深度徽标；
  - 画布左侧显示“第 1 层 / 第 2 层 / 第 3 层”标尺；
  - 当前递归层会高亮；
  - 画布右上角显示 `d`、`max`、`depth` 等中间量。

## C 代码区

- 类型定义默认展开，与题目代码一致；可随时折叠。
- 每次执行函数后，显示该函数的核心代码块；定义自动折叠。
- 只展示当前创建 / 操作 / 判等函数，不使用 `NewNode`、`AppendChild`、字符解析等辅助函数。
- 每个函数块单独从 1 行编号，左侧步骤的 `codeLine` 与当前代码块严格对应。
- 代码高亮只在 5–15 行的短函数块内移动，便于跟读。
- 输入解析器完全在前端 JavaScript 中，不会出现在 C 代码展示中。

## 播放控制

- 重置：回到该次函数演示的第一步并暂停；
- 快退：后退 5 步；
- 上一步 / 下一步：单步；
- 播放 / 暂停：自动播放；
- 快进：前进 5 步；
- 进度条：跳转；
- 速度：0.5× / 1× / 1.5× / 2×。

代码区独立滚动，高亮跟随只发生在代码容器内，不会带动整页。

## 经典题库

右上角“经典题库”仍作为独立学习版块：

- 9 道考研、考试、面试常见题；
- 可分类筛选、展开答案和解析；
- 带演示的题目会载入临时案例，并直接执行对应操作；
- 打开题库时暂停当前播放，支持 Esc、关闭按钮或遮罩退出；
- 题库不计分。

## 验收用例

### 案例 A

输入或选择 `A = (a,(b,c),d)`：

1. 图中应出现：GList 锚点 A、`element` 结点 a、`sublist` 结点、element 结点 b/c/d；
2. `GetHead(A)` 返回 `a`；
3. `GetTail(A)` 返回 `((b,c),d)`；
4. `求长度(A)` 返回 `3`，节点出现 `#1`、`#2`、`#3`；
5. `求深度(A)` 返回 `3`，结点出现 `d1`/`d2`/`d3`，左侧显示三层标尺。

### 嵌套调用

在 A 上依次执行：

```text
GetTail(A) = ((b,c),d)
GetHead(GetTail(A)) = (b,c)
求长度 = 2
```

每一步的返回值都应出现在函数链中，按钮状态和右侧代码随操作变化。

### 反复取表头表尾：取出 d

自定义 `D = (a,(b,c,(d)),e)`，依次点击：

```text
GetTail
GetHead
GetTail
GetTail
GetHead
GetHead
```

返回值序列应为：

```text
((b,c,(d)),e)
(b,c,(d))
(c,(d))
((d))
(d)
d
```

最后一步后按钮禁用，“当前对象”行显示完整嵌套表达式，并提示“已取得原子 d”。点击“撤销”应回到 `(d)`，按钮重新可用。

### 创建过程

选择 A 后点击案例名旁的“创建”：

1. 第 1 步只显示 GList 锚点 A；
2. 代码区切换为 `BuildList`，行号随步骤高亮；
3. 结点按 `dummy → tail → element/sublist → free(dummy)` 的顺序逐层出现；
4. 最终回到完整图 `(a,(b,c),d)`，结果面板显示创建结果。

选择 `B = (())` 创建时，应看到 `k = -1` 的空子表分支，最终图只有锚点 B 和一个空 sublist 结点。

### 判等过程

点击案例名旁的“判等”，选择 A 与 A：

1. 左右两张图并排出现；
2. 当前比较的一对结点同时橙色高亮；
3. 最终显示 `true`，比较横幅与结果面板一致；
4. 右侧代码为 `IsEqual`，逐步高亮 tag、data、递归和收尾判断。

再选择 A 与 B：应在 tag 比较处发现 element 与 sublist 不同，最终显示 `false`，并保留最后一个差异结点对的高亮。点击“退出”返回普通节点图。

### 头尾链表模式

点击顶部“头尾链表”后：

1. 代码区显示 `ATOM / LIST / hp / tp` 类型定义；
2. A 的图应显示 1 个 GList 锚点、5 个 `LIST` 结点和 4 个 `ATOM` 结点，`hp` 为下行蓝边，`tp` 为右行琥珀虚线；
3. `求长度(A)` 返回 `3`，`求深度(A)` 返回 `3`；
4. `GetHead(A)` 返回 `a`，`GetTail(A)` 返回 `((b,c),d)`；
5. 创建 A 从头尾链表根指针开始逐步生成 `LIST/ATOM` 结点；
6. B 的图显示根 B 和一个 `hp=NULL` 的 `LIST` 结点；
7. A/B 判等显示 `false`，并把 A 的 E2/ATOM 与 B 的 S2 标红；
8. 切回“扩展线性”后恢复 `element / sublist / next` 图和代码，且当前案例仍是同一张广义表。

### 案例 B

选择 `B = (())`：

1. 图中显示一个 GList 锚点和一个空的 `sublist` 结点；
2. `GetHead(B)` 返回空表 `()`；
3. 对返回的空表求长度为 0，深度为 1；
4. `GetTail(B)` 也返回空表 `()`。

### 命名案例

输入名称 `C` 和表达式 `((a,b),c)`，保存后：

- 案例标签中新增 C；
- 当前案例切换为 C；
- 函数链重置为 `C = ((a,b),c)`；
- 可继续对 C 进行嵌套操作。

### 错误处理

非法表达式或非法案例名会显示具体错误位置或原因，不破坏当前已保存案例。

## 开发自测

语法检查：

```bash
node --check app.js
```

Node 纯逻辑示例：

```js
const g = require('./app.js');

const graph = g.parseExpression('(a,(b,c),d)', { name: 'A' }).graph;
let subject = g.createBaseSubject(graph, 'A');

console.log(g.serializeGraph(graph)); // (a,(b,c),d)

const tail = g.evaluateOperation(graph, subject, 'tail');
console.log(tail.resultText); // ((b,c),d)

const head = g.evaluateOperation(graph, tail.subject, 'head');
console.log(head.resultText); // (b,c)

const len = g.evaluateOperation(graph, head.subject, 'length');
console.log(len.resultText); // 2

const run = g.createOperationRun(graph, 'depth', subject).run;
console.log(run.steps.at(-1).result); // 深度 = 3

// 头尾链表表示
const ht = g.buildHTGraph(graph);
console.log(g.serializeHTGraph(ht)); // (a,(b,c),d)
const htHead = g.createHTOperationRun(graph, ht, subject, 'head');
console.log(htHead.outcome.resultText); // a
const htBase = g.createHTBaseView(graph, ht, subject);
console.log(htBase.layout.width, htBase.layout.height);
```

浏览器端也会在 `window.GLGame` 上暴露同一组纯逻辑。

## 已知限制

- 输入原子为单个字符；
- 切换“扩展线性 / 头尾链表”会重置当前函数链到案例初始状态；
- 深色模式偏好写入浏览器 `localStorage`，不会同步到其他浏览器；
- 案例和函数链只在当前页面会话中保存，不写入磁盘；
- 头尾链表的 `hp = NULL` 表示空子表元素，`GList = NULL` 表示空表；
- C 代码区展示当前存储结构的类型定义与创建 / 操作 / 判等函数，不包含前端输入解析器；
- C 代码片段省略 `main` 等运行入口；
- 创建过程用 `k = -1` 表示空子表，这是为了支持 `(())` 而增加的演示扩展；题目原始 `scanf` 协议只区分 `k=0` 原子与 `k>0` 子表；
- 判等选择只列出已保存案例；如果修改了输入草稿，需先保存再比较；
- 经典题库中的遍历类概念题为理论练习；创建、GetHead、GetTail、长度、深度和判等都有可视化；
- `presentation/` 的讲解 PPT 以扩展线性链表版本为主，没有重复制作头尾链表的整套幻灯片；
- 不支持在画布上直接编辑结点。
