/* =============================================================
   广义表探险 · 拓展链表型广义表分步可视化
   -------------------------------------------------------------
   文件职责：
   1. 维护各操作的核心 C 代码块；
   2. 解析广义表并生成节点图；
   3. 为每个操作预先生成“步骤快照数组”；
   4. 绘制节点图、播放步骤、同步高亮核心代码；
   5. 经典题库与自主演示。

   浏览器直接打开即可运行；纯逻辑部分也会在 Node 环境下导出，
   便于对解析、步骤生成和验收用例做自动化检查。
   ============================================================= */
(function () {
  'use strict';

  const ATOM = 'ATOM';
  const LIST = 'LIST';
  const ROOT = 'ROOT';

  const MAX_INPUT_CHARS = 200;
  const MAX_NODES = 120;
  const MAX_NESTING = 30;

  const NODE_HEIGHT = 60;
  const ATOM_WIDTH = 76;
  const LIST_WIDTH = 88;
  const H_GAP = 44;
  const V_GAP = 88;
  const STAGE_PAD = 28;

  const BASE_STEP_DELAY = 720;

  /* ===========================================================
     当前操作的核心代码块
     每块独立编号；高亮只在短块内移动，避免在完整源码中大幅跳跃。
     =========================================================== */

  const CODE_BLOCKS = Object.create(null);

  function defineCodeBlock(key, title, rows, aliases) {
    const lines = [];
    const marks = Object.create(null);

    rows.forEach((row) => {
      const text = Array.isArray(row) ? row[0] : row;
      const names = Array.isArray(row) ? row.slice(1) : [];
      lines.push(text);
      const lineNumber = lines.length;
      names.forEach((name) => {
        if (!name) return;
        marks[name] = lineNumber;
      });
    });

    if (aliases) {
      Object.keys(aliases).forEach((alias) => {
        const target = aliases[alias];
        if (!marks[target]) {
          throw new Error(`内部错误：代码块 ${key} 缺少标记 ${target}`);
        }
        marks[alias] = marks[target];
      });
    }

    CODE_BLOCKS[key] = { key, title, lines, marks };
  }

  const TYPE_DEFINITION_SOURCE = [
    '#include <stdio.h>',
    '#include <stdlib.h>',
    '',
    'typedef enum { false, true } bool;',
    'typedef int ElemSet;',
    'typedef enum { element, sublist } ElemTag; /* 结点标记类型 */',
    'typedef struct GListNode *Position;        /* 指针即结点位置 */',
    'typedef Position GList;',
    'struct GListNode {',
    '    ElemTag tag;        /* 结点标记 */',
    '    union {',
    '        ElemSet data;   /* 存储数据 */',
    '        GList sub_list; /* 子表 */',
    '    } u;',
    '    Position next;      /* 线性表中下一个元素的位置 */',
    '};'
  ].join('\n');

  defineCodeBlock('head', 'GetHead', [
    ['/* 核心：GetHead 返回当前 GList 的第一个结点；空表返回 NULL */'],
    ['GList GetHead(GList L) {', 'func'],
    ['    if (L == NULL) return NULL;', 'empty'],
    ['    return L;', 'ret'],
    ['}'],
    ['/* 返回首结点；若首结点是 sublist，其表值为 L->u.sub_list。 */']
  ]);

  defineCodeBlock('tail', 'GetTail', [
    ['/* 核心：GetTail 返回首元素之后的剩余链；空表返回 NULL */'],
    ['GList GetTail(GList L) {', 'func'],
    ['    if (L == NULL) return NULL;', 'empty'],
    ['    return L->next;', 'ret'],
    ['}']
  ]);

  defineCodeBlock('length', '求长度', [
    ['/* 核心：长度只统计当前 GList 的同级链 */'],
    ['int GListLength(GList L) {', 'func'],
    ['    int len = 0;', 'init'],
    ['    Position p = L;', 'pinit'],
    ['    while (p != NULL) {', 'loop'],
    ['        len++;', 'count'],
    ['        p = p->next;', 'next'],
    ['    }'],
    ['    return len;', 'ret'],
    ['}']
  ]);

  defineCodeBlock('depth', '求深度', [
    ['/* 核心：本页层数口径；空链 1 层，元素 1 层，子表递归 */'],
    ['int GListDepth(GList L) {', 'func'],
    ['    if (L == NULL) return 1;', 'null'],
    ['    int max = 0;', 'init'],
    ['    for (Position p = L; p != NULL; p = p->next) {', 'loop'],
    ['        int d;'],
    ['        if (p->tag == element)', 'atom'],
    ['            d = 1;', 'setAtom'],
    ['        else', 'else'],
    ['            d = GListDepth(p->u.sub_list);', 'recurse'],
    ['        if (d > max)', 'compare'],
    ['            max = d;', 'update'],
    ['    }'],
    ['    return max + 1;', 'ret'],
    ['}']
  ]);

  const HT_TYPE_DEFINITION_SOURCE = [
    '#include <stdio.h>',
    '#include <stdlib.h>',
    '',
    'typedef enum { false, true } bool;',
    'typedef int ElemSet;',
    'typedef enum { ATOM, LIST } NodeTag; /* 结点类型 */',
    'typedef struct HTNode *GList;',
    'struct HTNode {',
    '    NodeTag tag;',
    '    union {',
    '        ElemSet data;',
    '        struct {',
    '            GList hp; /* 表头 */',
    '            GList tp; /* 表尾 */',
    '        } ptr;',
    '    } u;',
    '};'
  ].join('\n');

  defineCodeBlock('htHead', 'GetHead', [
    ['/* 头尾链表：表头就是首结点 hp 指向的结点 */'],
    ['GList GetHead(GList L) {', 'func'],
    ['    if (L == NULL) return NULL;', 'empty'],
    ['    return L->u.ptr.hp;', 'ret'],
    ['}']
  ]);

  defineCodeBlock('htTail', 'GetTail', [
    ['/* 头尾链表：表尾就是首结点 tp 指向的剩余链 */'],
    ['GList GetTail(GList L) {', 'func'],
    ['    if (L == NULL) return NULL;', 'empty'],
    ['    return L->u.ptr.tp;', 'ret'],
    ['}']
  ]);

  defineCodeBlock('htLength', '求长度', [
    ['/* 沿表尾 tp 走完整条同级链 */'],
    ['int GListLength(GList L) {', 'func'],
    ['    int len = 0;', 'init'],
    ['    while (L != NULL) {', 'loop'],
    ['        len++;', 'count'],
    ['        L = L->u.ptr.tp;', 'next'],
    ['    }'],
    ['    return len;', 'ret'],
    ['}']
  ]);

  defineCodeBlock('htDepth', '求深度', [
    ['/* 头尾链表：hp 可能指向 ATOM，也可能指向子表 LIST */'],
    ['int GListDepth(GList L) {', 'func'],
    ['    if (L == NULL) return 1;', 'null'],
    ['    int max = 0;', 'init'],
    ['    while (L != NULL) {', 'loop'],
    ['        GList h = L->u.ptr.hp;', 'hp'],
    ['        int d;'],
    ['        if (h == NULL || h->tag == ATOM)', 'atom'],
    ['            d = 1;', 'setAtom'],
    ['        else', 'else'],
    ['            d = GListDepth(h);', 'recurse'],
    ['        if (d > max) max = d;', 'compare'],
    ['        L = L->u.ptr.tp;', 'next'],
    ['    }'],
    ['    return max + 1;', 'ret'],
    ['}']
  ]);

  defineCodeBlock('htBuild', 'BuildList', [
    ['/* 头尾链表：先建当前结点，再递归 hp 与 tp */'],
    ['GList BuildList(int n) {', 'func'],
    ['    if (n == 0) return NULL;', 'empty'],
    ['    GList p = malloc(sizeof(struct HTNode));', 'alloc'],
    ['    int k; scanf("%d", &k);', 'read'],
    ['    p->tag = LIST;', 'tagList'],
    ['    if (k == 0) {', 'atom'],
    ['        GList a = malloc(sizeof(struct HTNode));', 'allocAtom'],
    ['        a->tag = ATOM;', 'tagAtom'],
    ['        scanf("%d", &a->u.data);', 'data'],
    ['        p->u.ptr.hp = a;', 'linkHp'],
    ['    } else {', 'else'],
    ['        p->u.ptr.hp = BuildList(k > 0 ? k : 0);', 'recurseHp'],
    ['    }'],
    ['    p->u.ptr.tp = BuildList(n - 1);', 'recurseTp'],
    ['    return p;', 'ret'],
    ['}']
  ]);

  (function () {
    defineCodeBlock('htEqual', 'IsEqual', [
        ['    bool IsEqual(GList a, GList b) {', 'funcStart'],
        ['        // 都为空表', 'comment'],
        ['        if (a == NULL && b == NULL)', 'empty'],
        ['            return true;', 'retTrue'],
        [''],
        ['        // 一空一非空', 'comment'],
        ['        if (a == NULL || b == NULL)', 'oneEmpty'],
        ['            return false;', 'retFalse'],
        [''],
        ['        // 类型不同', 'comment'],
        ['        if (a->tag != b->tag)', 'tag'],
        ['            return false;', 'failTag'],
        [''],
        ['        // 都是原子，比较值', 'comment'],
        ['        if (a->tag == element)', 'atom'],
        ['            return a->u.data == b->u.data;', 'data'],
        [''],
        ['        // 都是表，递归比较表头(hp)与表尾(tp)', 'comment'],
        ['        return IsEqual(a->u.ptr.hp, b->u.ptr.hp)', 'recurseHp'],
        ['            && IsEqual(a->u.ptr.tp, b->u.ptr.tp);', 'recurseTp'],
        ['    }', 'funcEnd']
    ]);
})();

  defineCodeBlock('build', 'BuildList', [
    ['/* k=0 原子；k>0 子表；k=-1 空子表（演示扩展） */'],
    ['GList BuildList(int n) {', 'func'],
    ['    GList dummy = malloc(sizeof(struct GListNode)), tail = dummy;', 'init'],
    ['    dummy->next = NULL;', 'dummy'],
    ['    while (n-- > 0) {', 'loop'],
    ['        GList p = malloc(sizeof(struct GListNode));', 'alloc'],
    ['        int k;'],
    ['        scanf("%d", &k);', 'read'],
    ['        p->tag = (k == 0) ? element : sublist;', 'tag'],
    ['        if (p->tag == element) {', 'atom'],
    ['            scanf("%d", &p->u.data);', 'data'],
    ['        } else {', 'else'],
    ['            p->u.sub_list = BuildList(k > 0 ? k : 0);', 'recurse'],
    ['        }', 'afterSub'],
    ['        tail->next = p;', 'link'],
    ['        p->next = NULL;', 'next'],
    ['        tail = p;', 'tail'],
    ['    }'],
    ['    GList head = dummy->next; free(dummy);', 'free', 'head'],
    ['    return head;', 'ret'],
    ['}']
  ]);

  defineCodeBlock('equal', 'IsEqual', [
    ['bool IsEqual( GList glist1, GList glist2 )', 'func'],
    ['{'],
    ['    // Lists are all empty.'],
    ['    if (glist1 == NULL && glist2 == NULL)', 'empty'],
    ['        return true;', 'retTrue'],
    [''],
    ['    // There\'s one who arrives at the end first.'],
    ['    if (glist1 == NULL || glist2 == NULL)', 'oneEmpty'],
    ['        return false;', 'retFalse'],
    [''],
    ['    // Present tag is different.'],
    ['    if (glist1 -> tag != glist2 -> tag)', 'tag'],
    ['        return false;', 'failTag'],
    [''],
    [''],
    ['    if (glist1 -> tag == element)', 'atom'],
    ['    {'],
    ['        if (glist1 -> u.data != glist2 -> u.data)', 'data'],
    ['            return false;', 'failData'],
    ['    }'],
    ['    else'],
    ['    {'],
    ['        if (!IsEqual(glist1 -> u.sub_list, glist2 -> u.sub_list))', 'recurse'],
    ['            return false;', 'failSub'],
    ['    }'],
    [''],
    ['    return IsEqual(glist1 -> next, glist2 -> next);', 'next', 'ret'],
    ['}']
  ]);

  const OPERATIONS = [
    { key: 'head', label: 'GetHead', short: '表头' },
    { key: 'tail', label: 'GetTail', short: '表尾' },
    { key: 'length', label: '求长度', short: '长度' },
    { key: 'depth', label: '求深度', short: '深度' }
  ];

  const OPERATION_BY_KEY = Object.fromEntries(OPERATIONS.map((op) => [op.key, op]));

  const QUIZ_CATEGORIES = ['全部', '考研', '考试', '面试'];

  const STUDY_QUESTIONS = [
    {
      id: 'ky-1',
      category: '考研',
      topic: '基本运算',
      title: '长度、表头、表尾与遍历',
      question: '设广义表 L = (a,(b,c),d)，求 L 的长度、表头、表尾，并写出原子遍历序列。',
      answer: '长度 = 3\n表头 = a\n表尾 = ((b,c),d)\n原子遍历 = a → b → c → d',
      note: '表头是第一个元素；表尾不是“最后一个元素”，而是首元素之后所有元素重新组成的一张表。',
      demos: [
        { label: '演示表头', expression: '(a,(b,c),d)', operation: 'head' },
        { label: '演示表尾', expression: '(a,(b,c),d)', operation: 'tail' }
      ]
    },
    {
      id: 'ky-2',
      category: '考研',
      topic: '深度口径',
      title: '同一道题，两种深度口径',
      question: '设 E = ((a,(b,c)),d)。按教材“括号重数口径”求深度；本页的层数口径又会显示多少？',
      answer: '教材括号重数口径：深度 = 3\n本页层数口径：深度 = 4',
      note: '教材常用：原子深度 0、空表深度 1、表深度 = 1 + max(子项深度)。本页动画为了与示例验收一致，把原子也计为 1 层，所以递归结构相同但结果多 1。',
      demos: [
        { label: '看本页深度动画', expression: '((a,(b,c)),d)', operation: 'depth' }
      ]
    },
    {
      id: 'ky-3',
      category: '考研',
      topic: '空表',
      title: '空表的基本量与运算',
      question: '空表 E = () 的长度是多少？深度是多少？表头和表尾分别是什么？',
      answer: '长度 = 0\n深度 = 1（教材口径与本页层数口径都为 1）\n表头、表尾：未定义（空表没有首元素）',
      note: '空表是一个合法的括号表，但不能再取表头；取表尾也没有剩余元素。实现时应显式返回 NULL 或错误状态。',
      demos: [
        { label: '演示空表求长度', expression: '()', operation: 'length' },
        { label: '演示空表取表头', expression: '()', operation: 'head' }
      ]
    },
    {
      id: 'ks-1',
      category: '考试',
      topic: '表头与表尾',
      title: '首元素本身是子表',
      question: '设 L = ((a,b),c,d)，求 GetHead(L) 与 GetTail(L)。',
      answer: 'GetHead(L) = (a,b)\nGetTail(L) = (c,d)',
      note: '表头可以是原子，也可以是子表。取到子表时，返回的是该子表节点；表尾仍然只包含首元素之后的剩余元素。',
      demos: [
        { label: '演示取表头', expression: '((a,b),c,d)', operation: 'head' },
        { label: '演示取表尾', expression: '((a,b),c,d)', operation: 'tail' }
      ]
    },
    {
      id: 'ks-2',
      category: '考试',
      topic: '长度与原子数',
      title: '顶层长度不等于原子个数',
      question: '对 E = (x,(y,z),(p,(q)),r)，求顶层长度、原子总数和原子遍历序列。',
      answer: '顶层长度 = 4（x、(y,z)、(p,(q))、r）\n原子总数 = 6（x、y、z、p、q、r）\n遍历序列 = x, y, z, p, q, r',
      note: '长度只统计根表 first-level 的元素个数，不会递归进入子表；原子总数需要完整遍历。',
      demos: [
        { label: '演示求长度', expression: '(x,(y,z),(p,(q)),r)', operation: 'length' }
      ]
    },
    {
      id: 'ks-3',
      category: '考试',
      topic: '存储表示',
      title: '扩展线性链表表示法',
      question: '用扩展线性链表表示广义表时，一个节点通常需要哪些字段？如何区分原子和子表？',
      answer: '核心字段：tag、联合体（data 或 sub_list）、next。',
      code: 'typedef int ElemSet;\ntypedef enum { element, sublist } ElemTag;\ntypedef struct GListNode *Position;\ntypedef Position GList;\nstruct GListNode {\n    ElemTag tag;\n    union {\n        ElemSet data;\n        GList sub_list;\n    } u;\n    Position next;\n};',
      note: 'tag = element 时读取 data；tag = sublist 时 u.sub_list 指向子表首结点。next 统一连接同级下一元素。',
      demos: [
        { label: '观察 first-level 链', expression: '(a,(b,c),d)', operation: 'length' }
      ]
    },
    {
      id: 'ms-1',
      category: '面试',
      topic: '递归设计',
      title: '手写广义表求深度',
      question: '写出广义表求深度的递归实现，并分析时间与空间复杂度。',
      answer: '每个节点访问一次，时间复杂度 O(n)；递归栈深度不超过最大层数 d，空间复杂度 O(d)。',
      code: 'int GListDepth(GList L) {\n    if (L == NULL) return 1;\n    int max = 0;\n    for (Position p = L; p != NULL; p = p->next) {\n        int d;\n        if (p->tag == element) d = 1;\n        else d = GListDepth(p->u.sub_list);\n        if (d > max) max = d;\n    }\n    return max + 1;\n}',
      note: '上面是本页层数口径的实现；若改用教材口径，可以把深度基例改为 0。',
      demos: [
        { label: '观察递归过程', expression: '(a,(b,c),d)', operation: 'depth' }
      ]
    },
    {
      id: 'ms-2',
      category: '面试',
      topic: '遍历设计',
      title: '展平广义表',
      question: '如何按先序输出广义表中的所有原子？为什么表节点不需要被输出？',
      answer: '对 element 结点输出 data；对 sublist 结点递归遍历它的 u.sub_list 链。sublist 结点只描述结构，不承载数据。',
      code: 'void Traverse(GList L) {\n    for (Position p = L; p != NULL; p = p->next) {\n        if (p->tag == element)\n            printf("%d ", p->u.data);\n        else\n            Traverse(p->u.sub_list);\n    }\n}',
      note: '遍历访问每个结点一次，时间复杂度 O(n)。本题是概念练习；本页顶部还支持 BuildList 创建过程、GetHead/GetTail 嵌套和两表判等演示。',
      demos: []
    },
    {
      id: 'ms-3',
      category: '面试',
      topic: '共享与递归',
      title: '递归表与死循环风险',
      question: '广义表可能出现 A = (a,A) 这样的递归表。遍历或求深度时要注意什么？',
      answer: '必须防止重复进入同一个子表或无限递归。常见做法是：限制不允许自引用；或者使用 visited 集合记录已进入的节点，遇到环时停止并报告。',
      note: '本教学页的输入只支持从字符串构造的有限树，不会生成环；但真实项目中若允许共享子表或手工构造节点，就必须考虑环检测与内存所有权。',
      demos: [
        { label: '观察 next 指针', expression: '(a,(b,c),d)', operation: 'tail' }
      ]
    }
  ];

  /* ===========================================================
     基础工具
     =========================================================== */

  class ParseError extends Error {
    constructor(message, position) {
      super(message);
      this.name = 'ParseError';
      this.position = Number.isInteger(position) ? position : null;
    }
  }

  function isAtomChar(ch) {
    return typeof ch === 'string' && /^[A-Za-z0-9_]$/.test(ch);
  }

  function skipWhitespace(ctx) {
    while (ctx.pos < ctx.chars.length && /\s/.test(ctx.chars[ctx.pos])) {
      ctx.pos += 1;
    }
  }

  function describeError(err) {
    if (!err) return '发生未知错误。';
    const base = err.message || String(err);
    if (err instanceof ParseError && err.position !== null) {
      return `${base}（位置：第 ${err.position + 1} 个字符）`;
    }
    return base;
  }

  function createGraphNode(graph, kind, options) {
    const opts = options || {};
    if (Object.keys(graph.nodes).length >= MAX_NODES) {
      throw new ParseError(`节点数量超过 ${MAX_NODES} 个，请简化表达式。`, opts.position);
    }
    const prefix = kind === ATOM ? 'E' : (opts.prefix || 'S');
    const id = prefix + (graph.seq += 1);
    const node = {
      id,
      tag: null,
      root: !!opts.root,
      name: '',
      value: null,
      data: null,
      child: null,
      next: null,
      synthetic: !!opts.synthetic,
      _kind: kind
    };
    graph.nodes[id] = node;
    return node;
  }

  function getChainTailId(graph, startId) {
    let id = startId;
    if (!id) return null;
    while (graph.nodes[id] && graph.nodes[id].next) {
      id = graph.nodes[id].next;
    }
    return id;
  }

  /**
   * 将 node 接到 list 的 child 链尾。
   * 返回被修改的指针，用于动画高亮。
   */
  function connectChild(graph, listNode, node) {
    const tailId = getChainTailId(graph, listNode.child);
    if (!tailId) {
      listNode.child = node.id;
      return { from: listNode.id, field: 'child', to: node.id, key: `${listNode.id}.child` };
    }
    graph.nodes[tailId].next = node.id;
    return { from: tailId, field: 'next', to: node.id, key: `${tailId}.next` };
  }

  function serializeListContents(graph, listId) {
    const list = graph.nodes[listId];
    if (!list) return '()';
    const parts = [];
    let childId = list.child;
    while (childId) {
      parts.push(serializeNodeValue(graph, childId));
      const child = graph.nodes[childId];
      childId = child ? child.next : null;
    }
    return `(${parts.join(',')})`;
  }

  /**
   * 将单个节点当作“一个值”序列化。
   * 关键点：忽略该节点自身的 next，避免取表头时错误带上原表兄弟。
   */
  function serializeNodeValue(graph, nodeId) {
    const node = graph.nodes[nodeId];
    if (!node) return '';
    if (node.tag === ATOM) return node.value == null ? '' : node.value;
    return serializeListContents(graph, nodeId);
  }

  function serializeGraph(graph) {
    return graph.rootId ? serializeNodeValue(graph, graph.rootId) : '';
  }

  function snapshotNodes(graph) {
    return Object.keys(graph.nodes).map((id) => {
      const node = graph.nodes[id];
      return {
        id: node.id,
        tag: node.tag,
        root: !!node.root,
        name: node.name || '',
        value: node.value,
        data: node.data,
        child: node.child,
        next: node.next,
        synthetic: !!node.synthetic
      };
    });
  }

  function cloneVariables(variables) {
    if (!variables) return {};
    return JSON.parse(JSON.stringify(variables));
  }

  function makeStep(graph, spec, marks) {
    if (!marks) {
      throw new Error('内部错误：步骤缺少所属代码块。');
    }
    const lineMarks = marks;
    const codeLine = lineMarks[spec.line];
    if (!codeLine) {
      throw new Error(`内部错误：未知代码行标记 ${spec.line}`);
    }
    const allNodes = snapshotNodes(graph);
    const nodes = spec.visibleIds
      ? allNodes.filter((node) => spec.visibleIds.has(node.id))
      : allNodes;
    const step = {
      desc: spec.desc,
      codeLine,
      nodes,
      highlightNodeIds: Array.from(new Set(spec.highlightNodeIds || [])),
      highlightPointers: Array.from(new Set(spec.highlightPointers || [])),
      variables: cloneVariables(spec.variables),
      result: spec.result == null ? '—' : String(spec.result)
    };
    if (spec.visitedIds) {
      step.visitedIds = Array.from(new Set(spec.visitedIds));
    }
    if (spec.returnedNodeId) {
      step.returnedNodeId = spec.returnedNodeId;
    }
    if (spec.nodeBadges) {
      step.nodeBadges = cloneVariables(spec.nodeBadges);
    }
    return step;
  }

  /* ===========================================================
     解析器（可选同时生成创建/解析步骤）
     =========================================================== */

  function parseExpression(source, options) {
    const opts = options || {};
    const text = source == null ? '' : String(source);
    const chars = Array.from(text);

    if (text.trim() === '') {
      throw new ParseError('请输入一个广义表表达式。', 0);
    }
    if (chars.length > MAX_INPUT_CHARS) {
      throw new ParseError(`表达式过长，请控制在 ${MAX_INPUT_CHARS} 个字符以内。`, MAX_INPUT_CHARS);
    }

    const graph = {
      nodes: Object.create(null),
      rootId: null,
      seq: 0
    };
    const ctx = {
      chars,
      pos: 0,
      graph
    };

    // 前端解析只负责构造 GList；解析过程不作为 C 操作函数展示。
    const record = () => {};
    const fail = (message, position) => {
      throw new ParseError(message, position == null ? ctx.pos : position);
    };

    skipWhitespace(ctx);
    if (ctx.pos >= chars.length) {
      throw new ParseError('请输入一个广义表表达式。', 0);
    }
    if (chars[ctx.pos] !== '(') {
      throw new ParseError('顶层广义表必须以左括号 "(" 开头。', ctx.pos);
    }

    const root = createGraphNode(graph, LIST, {
      position: ctx.pos,
      prefix: 'R',
      root: true
    });
    graph.rootId = root.id;
    root.tag = ROOT;
    root.root = true;
    root.name = opts.name || '表';

    parseListContents(ctx, root, 1, record, fail);

    skipWhitespace(ctx);
    if (ctx.pos < chars.length) {
      fail('顶层表的右括号之后还有多余字符。', ctx.pos);
    }

    record({
      desc: '解析完成，整棵广义表已经构建。',
      line: 'create.done',
      highlightNodeIds: [graph.rootId],
      variables: {
        root: graph.rootId,
        nodeCount: Object.keys(graph.nodes).length
      },
      result: serializeGraph(graph)
    });

    return { graph };
  }

  function parseListContents(ctx, listNode, level, record, fail) {
    if (level > MAX_NESTING) {
      fail(`嵌套层数超过 ${MAX_NESTING} 层，请简化表达式。`, ctx.pos);
    }

    let ch = ctx.chars[ctx.pos];
    record({
      desc: `读取字符 "${ch || ''}"，准备进入 ${listNode.id} 的子表。`,
      line: 'parse.readOpen',
      highlightNodeIds: [listNode.id],
      variables: { pos: ctx.pos + 1, char: ch || '', parent: listNode.id },
      result: `开始解析 ${listNode.id}`
    });

    if (ch !== '(') {
      fail('这里需要一个左括号。', ctx.pos);
    }

    ctx.pos += 1;
    record({
      desc: '跳过左括号，开始扫描该表的元素。',
      line: 'parse.consumeOpen',
      highlightNodeIds: [listNode.id],
      variables: { pos: ctx.pos + 1, parent: listNode.id },
      result: '等待读取第一个元素'
    });

    skipWhitespace(ctx);
    if (ctx.pos >= ctx.chars.length) {
      fail('缺少右括号 ")"。', ctx.pos);
    }

    if (ctx.chars[ctx.pos] === ')') {
      record({
        desc: '读取到 ")"，这是一个空表。',
        line: 'parse.empty',
        highlightNodeIds: [listNode.id],
        variables: { pos: ctx.pos + 1, char: ')', parent: listNode.id },
        result: `${listNode.id} 是空表`
      });
      ctx.pos += 1;
      record({
        desc: '空表结束，返回上层。',
        line: 'parse.emptyClose',
        highlightNodeIds: [listNode.id],
        variables: { pos: ctx.pos, parent: listNode.id },
        result: `返回 ${listNode.id} 的上一层`
      });
      return;
    }

    while (ctx.pos < ctx.chars.length) {
      skipWhitespace(ctx);
      if (ctx.pos >= ctx.chars.length) {
        fail('缺少右括号 ")"。', ctx.pos);
      }

      ch = ctx.chars[ctx.pos];

      if (ch === '(') {
        record({
          desc: `读取字符 "("，放进子表分支判断。`,
          line: 'parse.loop',
          highlightNodeIds: [listNode.id],
          variables: { pos: ctx.pos + 1, char: ch, parent: listNode.id },
          result: '准备创建子表节点'
        });
        record({
          desc: '判断为子表起始。',
          line: 'parse.classifyList',
          highlightNodeIds: [listNode.id],
          variables: { pos: ctx.pos + 1, char: ch, branch: 'LIST' },
          result: '类型 = 子表'
        });

        const sub = createGraphNode(ctx.graph, LIST, { position: ctx.pos });
        record({
          desc: `创建子表节点 ${sub.id}（tag 尚未设置）。`,
          line: 'parse.createList',
          highlightNodeIds: [sub.id],
          variables: { node: sub.id, tag: '未设置', parent: listNode.id },
          result: `已分配 ${sub.id}`
        });

        sub.tag = LIST;
        record({
          desc: `设置 ${sub.id} 的 tag = LIST。`,
          line: 'tagList',
          highlightNodeIds: [sub.id],
          variables: { node: sub.id, tag: 'LIST', parent: listNode.id },
          result: `${sub.id} 是表节点`
        });

        const link = connectChild(ctx.graph, listNode, sub);
        record({
          desc: `把子表挂到 ${listNode.id} 的 ${link.field} 指针上。`,
          line: 'linkList',
          highlightNodeIds: [sub.id],
          highlightPointers: [link.key],
          variables: {
            parent: listNode.id,
            node: sub.id,
            pointer: link.field
          },
          result: `${listNode.id}.${link.field} → ${sub.id}`
        });

        record({
          desc: `递归进入子表 ${sub.id}。`,
          line: 'parse.enter',
          highlightNodeIds: [sub.id],
          variables: { parent: listNode.id, node: sub.id },
          result: `正在递归解析 ${sub.id}`
        });

        parseListContents(ctx, sub, level + 1, record, fail);
      } else if (ch === ',') {
        fail('这里不应该出现逗号，逗号前缺少元素。', ctx.pos);
      } else if (ch === ')') {
        fail('这里不应该出现右括号，缺少元素或逗号后没有元素。', ctx.pos);
      } else if (!isAtomChar(ch)) {
        fail(`不支持的原子字符 "${ch}"。原子请使用单个字母、数字或下划线。`, ctx.pos);
      } else {
        record({
          desc: `读取原子字符 "${ch}"。`,
          line: 'parse.loop',
          highlightNodeIds: [listNode.id],
          variables: { pos: ctx.pos + 1, char: ch, parent: listNode.id },
          result: '准备创建原子节点'
        });
        record({
          desc: '判断为原子元素。',
          line: 'parse.classifyAtom',
          highlightNodeIds: [listNode.id],
          variables: { pos: ctx.pos + 1, char: ch, branch: 'ATOM' },
          result: '类型 = 原子'
        });

        const atom = createGraphNode(ctx.graph, ATOM, { position: ctx.pos });
        record({
          desc: `创建原子节点 ${atom.id}。`,
          line: 'parse.createAtom',
          highlightNodeIds: [atom.id],
          variables: { node: atom.id, tag: '未设置', parent: listNode.id },
          result: `已分配 ${atom.id}`
        });

        atom.tag = ATOM;
        record({
          desc: `设置 ${atom.id} 的 tag = ATOM。`,
          line: 'tagAtom',
          highlightNodeIds: [atom.id],
          variables: { node: atom.id, tag: 'ATOM', parent: listNode.id },
          result: `${atom.id} 是原子节点`
        });

        atom.value = ch;
        atom.data = /^\d$/.test(ch) ? Number(ch) : ch.charCodeAt(0);
        record({
          desc: `保存原子值 "${ch}"。`,
          line: 'parse.setAtom',
          highlightNodeIds: [atom.id],
          variables: { node: atom.id, value: ch, parent: listNode.id },
          result: `${atom.id}.value = ${ch}`
        });

        const link = connectChild(ctx.graph, listNode, atom);
        record({
          desc: `把原子挂到 ${listNode.id} 的 ${link.field} 指针上。`,
          line: 'linkAtom',
          highlightNodeIds: [atom.id],
          highlightPointers: [link.key],
          variables: {
            parent: listNode.id,
            node: atom.id,
            pointer: link.field
          },
          result: `${listNode.id}.${link.field} → ${atom.id}`
        });

        ctx.pos += 1;
        record({
          desc: '原子读取完成，扫描位置后移。',
          line: 'parse.advanceAtom',
          highlightNodeIds: [atom.id],
          variables: { pos: ctx.pos + 1, char: ch, parent: listNode.id },
          result: `已读取原子 ${ch}`
        });
      }

      skipWhitespace(ctx);
      if (ctx.pos >= ctx.chars.length) {
        fail('缺少右括号 ")"。', ctx.pos);
      }

      const separator = ctx.chars[ctx.pos];

      if (separator === ',') {
        ctx.pos += 1;
        record({
          desc: '读取逗号，准备读取下一个元素。',
          line: 'parse.comma',
          highlightNodeIds: [listNode.id],
          variables: { pos: ctx.pos + 1, char: ',', parent: listNode.id },
          result: '等待下一元素'
        });
        skipWhitespace(ctx);
        if (ctx.pos >= ctx.chars.length) {
          fail('逗号后缺少元素，并且缺少右括号 ")"。', ctx.pos);
        }
        if (ctx.chars[ctx.pos] === ')') {
          fail('逗号后缺少元素。', ctx.pos);
        }
        continue;
      }

      if (separator === ')') {
        record({
          desc: '读取右括号，当前子表结束。',
          line: 'parse.close',
          highlightNodeIds: [listNode.id],
          variables: { pos: ctx.pos + 1, char: ')', parent: listNode.id },
          result: `准备返回 ${listNode.id} 的上层`
        });
        ctx.pos += 1;
        record({
          desc: '当前子表解析完毕，返回上层。',
          line: 'parse.closeReturn',
          highlightNodeIds: [listNode.id],
          variables: { pos: ctx.pos + 1, parent: listNode.id },
          result: `返回 ${listNode.id} 的上层`
        });
        return;
      }

      fail('元素之间缺少逗号或右括号。', ctx.pos);
    }

    fail('缺少右括号 ")"。', ctx.pos);
  }

  /* ===========================================================
     函数结果与步骤生成
     =========================================================== */

  function serializeChain(graph, headId) {
    const parts = [];
    let id = headId;
    while (id) {
      const node = graph.nodes[id];
      if (!node) break;
      if (node.tag === ATOM) {
        parts.push(node.value == null ? '' : node.value);
      } else {
        parts.push(serializeListContents(graph, node.id));
      }
      id = node.next || null;
    }
    return '(' + parts.join(',') + ')';
  }

  function chainIds(graph, headId) {
    const ids = [];
    let id = headId;
    while (id && graph.nodes[id]) {
      ids.push(id);
      id = graph.nodes[id].next || null;
    }
    return ids;
  }

  function chainLength(graph, headId) {
    return chainIds(graph, headId).length;
  }

  function chainDepth(graph, headId) {
    if (!headId) return 1;
    let max = 0;
    let id = headId;
    while (id && graph.nodes[id]) {
      const node = graph.nodes[id];
      const d = node.tag === ATOM ? 1 : chainDepth(graph, node.child);
      if (d > max) max = d;
      id = node.next || null;
    }
    return max + 1;
  }

  function operationName(operation) {
    if (operation === 'head') return 'GetHead';
    if (operation === 'tail') return 'GetTail';
    if (operation === 'length') return 'GListLength';
    if (operation === 'depth') return 'GListDepth';
    return operation;
  }

  function makeListSubject(graph, headId, exprLabel, sourcePointer) {
    return {
      kind: 'list',
      headId: headId || null,
      valueText: serializeChain(graph, headId || null),
      exprLabel,
      sourcePointer: sourcePointer || null
    };
  }

  /**
   * 计算一次函数调用后的当前对象和显示值。
   * 内部使用 GList 链语义：GetHead 返回首结点，GetTail 返回 L->next。
   */
  function evaluateOperation(graph, subject, operation) {
    if (!subject || subject.kind !== 'list') {
      throw new Error('当前对象不是广义表，不能继续应用该函数。');
    }

    const label = operationName(operation) + '(' + subject.exprLabel + ')';
    const headId = subject.headId || null;

    if (operation === 'head') {
      if (!headId) {
        return {
          label,
          resultText: '空表没有表头',
          subject: {
            kind: 'undefined',
            valueText: '空表没有表头',
            exprLabel: label
          }
        };
      }
      const node = graph.nodes[headId];
      if (node.tag === ATOM) {
        return {
          label,
          resultText: node.value == null ? '' : node.value,
          subject: {
            kind: 'atom',
            atomId: headId,
            valueText: node.value == null ? '' : node.value,
            exprLabel: label
          }
        };
      }
      return {
        label,
        resultText: serializeChain(graph, node.child),
        subject: makeListSubject(
          graph,
          node.child,
          label,
          node.child ? node.id + '.child' : null
        )
      };
    }

    if (operation === 'tail') {
      if (!headId) {
        return {
          label,
          resultText: '()',
          subject: makeListSubject(graph, null, label, null)
        };
      }
      const node = graph.nodes[headId];
      const nextId = node.next || null;
      return {
        label,
        resultText: serializeChain(graph, nextId),
        subject: makeListSubject(
          graph,
          nextId,
          label,
          nextId ? headId + '.next' : null
        )
      };
    }

    if (operation === 'length') {
      const len = chainLength(graph, headId);
      return {
        label,
        resultText: String(len),
        subject: {
          kind: 'number',
          valueText: String(len),
          exprLabel: label
        }
      };
    }

    if (operation === 'depth') {
      const depth = chainDepth(graph, headId);
      return {
        label,
        resultText: String(depth),
        subject: {
          kind: 'number',
          valueText: String(depth),
          exprLabel: label
        }
      };
    }

    throw new Error('不支持的操作：' + operation);
  }

  function generateOperationSteps(operation, graph, subject) {
    const codeBlock = CODE_BLOCKS[operation];
    if (!codeBlock) throw new Error('未知操作：' + operation);
    if (!subject || subject.kind !== 'list') {
      throw new Error('当前对象不是广义表。');
    }

    if (operation === 'head') return generateHeadSteps(graph, subject, codeBlock);
    if (operation === 'tail') return generateTailSteps(graph, subject, codeBlock);
    if (operation === 'length') return generateLengthSteps(graph, subject, codeBlock);
    if (operation === 'depth') return generateDepthSteps(graph, subject, codeBlock);
    throw new Error('不支持的操作：' + operation);
  }

  function generateHeadSteps(graph, subject, codeBlock) {
    const steps = [];
    const push = (spec) => steps.push(makeStep(graph, spec, codeBlock.marks));
    const headId = subject.headId || null;

    push({
      desc: '准备执行 GetHead：当前对象是 ' + subject.exprLabel + '。',
      line: 'func',
      highlightNodeIds: headId ? [headId] : [],
      highlightPointers: subject.sourcePointer ? [subject.sourcePointer] : [],
      variables: { L: headId || 'NULL', 当前值: subject.valueText },
      result: '当前值 ' + subject.valueText
    });

    push({
      desc: headId ? 'L 非空，第一个结点就是表头。' : 'L 为 NULL，空表没有表头。',
      line: 'empty',
      highlightNodeIds: headId ? [headId] : [],
      highlightPointers: subject.sourcePointer ? [subject.sourcePointer] : [],
      variables: { L: headId || 'NULL' },
      result: headId ? '继续返回第一个结点' : '返回 NULL / 无表头'
    });

    if (!headId) {
      push({
        desc: 'GetHead 返回 NULL：空表没有表头。',
        line: 'empty',
        highlightNodeIds: [],
        highlightPointers: [],
        variables: { L: 'NULL' },
        result: '空表没有表头'
      });
      return steps;
    }

    const node = graph.nodes[headId];
    const pointers = subject.sourcePointer ? [subject.sourcePointer] : [];
    if (node.tag !== ATOM && node.child) {
      pointers.push(node.id + '.child');
    }

    push({
      desc: '返回第一个结点 ' + headId + '，它表示的值是 ' + (node.tag === ATOM ? node.value : serializeChain(graph, node.child)) + '。',
      line: 'ret',
      highlightNodeIds: [headId],
      highlightPointers: pointers,
      variables: { L: headId, tag: node.tag === ATOM ? 'element' : 'sublist' },
      result: node.tag === ATOM ? node.value : serializeChain(graph, node.child),
      returnedNodeId: headId
    });

    return steps;
  }

  function generateTailSteps(graph, subject, codeBlock) {
    const steps = [];
    const push = (spec) => steps.push(makeStep(graph, spec, codeBlock.marks));
    const headId = subject.headId || null;

    push({
      desc: '准备执行 GetTail：当前对象是 ' + subject.exprLabel + '。',
      line: 'func',
      highlightNodeIds: headId ? [headId] : [],
      highlightPointers: subject.sourcePointer ? [subject.sourcePointer] : [],
      variables: { L: headId || 'NULL', 当前值: subject.valueText },
      result: '当前值 ' + subject.valueText
    });

    push({
      desc: headId ? 'L 非空，沿 next 取剩余链。' : 'L 为 NULL，返回空表。',
      line: 'empty',
      highlightNodeIds: headId ? [headId] : [],
      highlightPointers: subject.sourcePointer ? [subject.sourcePointer] : [],
      variables: { L: headId || 'NULL' },
      result: headId ? '继续返回 L->next' : '返回 NULL'
    });

    if (!headId) {
      push({
        desc: 'GetTail 返回 NULL，表示空表。',
        line: 'empty',
        variables: { L: 'NULL' },
        result: '()'
      });
      return steps;
    }

    const first = graph.nodes[headId];
    const nextId = first.next || null;
    const pointer = nextId ? headId + '.next' : null;
    const remaining = chainIds(graph, nextId);

    push({
      desc: nextId
        ? '返回 L->next：从 ' + nextId + ' 开始的那条链。'
        : 'L->next 为 NULL，表尾是空表。',
      line: 'ret',
      highlightNodeIds: remaining,
      highlightPointers: pointer ? [pointer] : [],
      variables: { L: headId, next: nextId || 'NULL' },
      result: serializeChain(graph, nextId),
      returnedNodeId: nextId || undefined
    });

    return steps;
  }

  function generateLengthSteps(graph, subject, codeBlock) {
    const steps = [];
    const counted = Object.create(null);
    const push = (spec) => steps.push(makeStep(graph, {
      ...spec,
      nodeBadges: { ...counted, ...(spec.nodeBadges || {}) }
    }, codeBlock.marks));

    let id = subject.headId || null;
    let len = 0;
    const pointed = subject.sourcePointer || null;

    push({
      desc: '准备求长度：只统计当前 GList 的同级链。',
      line: 'func',
      highlightNodeIds: id ? [id] : [],
      highlightPointers: pointed ? [pointed] : [],
      variables: { L: id || 'NULL', len: 0 },
      result: 'len = 0'
    });

    push({
      desc: '初始化计数器 len = 0。',
      line: 'init',
      variables: { len: 0 },
      result: 'len = 0'
    });

    push({
      desc: id ? 'p 指向当前 GList 的第一个结点 ' + id + '。' : '当前是空表，p = NULL，长度为 0。',
      line: 'pinit',
      highlightNodeIds: id ? [id] : [],
      highlightPointers: pointed ? [pointed] : [],
      variables: { p: id || 'NULL', len: 0 },
      result: 'p = ' + (id || 'NULL')
    });

    while (id) {
      const node = graph.nodes[id];
      push({
        desc: 'p 指向 ' + id + '，p != NULL，进入循环。',
        line: 'loop',
        highlightNodeIds: [id],
        variables: { p: id, len },
        result: 'len = ' + len
      });

      len += 1;
      counted[id] = '#' + len;
      push({
        desc: '当前结点计入长度，len 加 1。',
        line: 'count',
        highlightNodeIds: [id],
        variables: { p: id, len },
        result: 'len = ' + len
      });

      const nextId = node.next || null;
      push({
        desc: nextId ? 'p = p->next，移动到 ' + nextId + '。' : 'p->next 为 NULL，循环结束。',
        line: nextId ? 'next' : 'loop',
        highlightNodeIds: nextId ? [nextId] : [id],
        highlightPointers: nextId ? [id + '.next'] : [],
        variables: { p: nextId || 'NULL', len },
        result: nextId ? 'p = ' + nextId : 'p = NULL'
      });

      id = nextId;
    }

    push({
      desc: '返回累计长度 ' + len + '。',
      line: 'ret',
      highlightNodeIds: [],
      variables: { len },
      result: '长度 = ' + len
    });

    return steps;
  }

  function generateDepthSteps(graph, subject, codeBlock) {
    const steps = [];
    const depths = Object.create(null);
    const rootNode = graph.nodes[graph.rootId];
    const subjectIsRootChain = !!(rootNode && subject.headId === rootNode.child);
    const push = (spec) => steps.push(makeStep(graph, {
      ...spec,
      nodeBadges: { ...depths, ...(spec.nodeBadges || {}) }
    }, codeBlock.marks));

    push({
      desc: '准备求深度。层数口径：空链 1 层，element 计 1 层，sublist 递归。',
      line: 'func',
      highlightNodeIds: subject.headId ? [subject.headId] : [],
      highlightPointers: subject.sourcePointer ? [subject.sourcePointer] : [],
      variables: { L: subject.headId || 'NULL' },
      result: '当前对象 ' + subject.exprLabel
    });

    function depthChain(headId, stack) {
      const stackText = stack.join(' > ');

      if (!headId) {
        push({
          desc: '空链按 1 层计。',
          line: 'null',
          variables: { L: 'NULL', stack: stackText },
          result: '返回 1'
        });
        return 1;
      }

      push({
        desc: '进入 GList 链，初始化 max = 0。',
        line: 'init',
        highlightNodeIds: [headId],
        variables: { L: headId, stack: stackText },
        result: 'max = 0'
      });

      let max = 0;
      let id = headId;
      let previousId = null;

      while (id) {
        const node = graph.nodes[id];
        const pointer = previousId ? previousId + '.next' : (stack.length === 0 ? subject.sourcePointer : null);

        push({
          desc: '检查结点 ' + id + '（' + (node.tag === ATOM ? 'element' : 'sublist') + '）。',
          line: 'loop',
          highlightNodeIds: [id],
          highlightPointers: pointer ? [pointer] : [],
          variables: { p: id, tag: node.tag === ATOM ? 'element' : 'sublist', max, stack: stackText },
          result: '当前 max = ' + max
        });

        let d;
        if (node.tag === ATOM) {
          d = 1;
          depths[id] = 'd1';
          push({
            desc: '当前结点是 element，深度计 1。',
            line: 'setAtom',
            highlightNodeIds: [id],
            variables: { p: id, d: 1, max, stack: stackText },
            result: 'd = 1'
          });
        } else {
          push({
            desc: '当前结点是 sublist，递归求 u.sub_list 的深度。',
            line: 'recurse',
            highlightNodeIds: [id],
            highlightPointers: node.child ? [id + '.child'] : [],
            variables: { p: id, max, stack: stackText },
            result: '进入子表'
          });
          d = depthChain(node.child, stack.concat(id));
          depths[id] = 'd' + d;
          push({
            desc: '子表 ' + id + ' 返回深度 ' + d + '。',
            line: 'recurse',
            highlightNodeIds: [id],
            variables: { p: id, d, max, stack: stackText },
            result: 'd = ' + d
          });
        }

        push({
          desc: '比较 d = ' + d + ' 与 max = ' + max + '。',
          line: 'compare',
          highlightNodeIds: [id],
          variables: { p: id, d, max, stack: stackText },
          result: d > max ? d + ' > ' + max : d + ' ≤ ' + max
        });

        if (d > max) {
          max = d;
          push({
            desc: '更新 max = ' + max + '。',
            line: 'update',
            highlightNodeIds: [id],
            variables: { p: id, d, max, stack: stackText },
            result: 'max = ' + max
          });
        }

        previousId = id;
        id = node.next || null;
      }

      const result = max + 1;
      depths[headId] = depths[headId] || 'd' + result;
      if (stack.length === 0 && subjectIsRootChain) {
        depths[graph.rootId] = 'd' + result;
      }
      push({
        desc: '当前链处理完毕，返回 max + 1 = ' + result + '。',
        line: 'ret',
        highlightNodeIds: [headId].concat(subjectIsRootChain && stack.length === 0 ? [graph.rootId] : []),
        variables: { max, depth: result, stack: stackText },
        result: '返回 ' + result
      });
      return result;
    }

    const depth = depthChain(subject.headId || null, []);
    push({
      desc: '函数调用结束，' + subject.exprLabel + ' 的深度为 ' + depth + '。',
      line: 'ret',
      highlightNodeIds: subjectIsRootChain ? [graph.rootId] : [],
      variables: {
        current: subjectIsRootChain ? graph.rootId : (subject.headId || null),
        depth,
        当前对象: subject.exprLabel
      },
      result: '深度 = ' + depth
    });

    return steps;
  }

  /* ===========================================================
     布局
     =========================================================== */

  function buildLayout(graph, options) {
    const opts = options || {};
    const nodes = graph.nodes;
    const root = graph.nodes[graph.rootId];
    const positions = Object.create(null);

    if (!root) {
      return { positions, width: 320, height: 220 };
    }

    // 深度演示需要左侧一层“层号标尺”，为图形留出额外的左边距。
    const leftGutter = opts.operation === 'depth' ? 76 : 0;

    const measureCache = Object.create(null);

    function kindOf(node) {
      if (node.tag) return node.tag;
      return node.id.charAt(0) === 'E' ? ATOM : LIST;
    }

    function ownWidth(node) {
      return kindOf(node) === ATOM ? ATOM_WIDTH : LIST_WIDTH;
    }

    function chainWidth(startId) {
      let total = 0;
      let count = 0;
      let id = startId;
      while (id) {
        total += measure(id) + (count === 0 ? 0 : H_GAP);
        count += 1;
        const node = nodes[id];
        id = node ? node.next : null;
      }
      return total;
    }

    function measure(id) {
      if (measureCache[id] != null) return measureCache[id];
      const node = nodes[id];
      if (!node) {
        measureCache[id] = 0;
        return 0;
      }
      let width = ownWidth(node);
      if ((node.tag === LIST || node.tag === ROOT) && node.child) {
        width = Math.max(width, chainWidth(node.child));
      }
      measureCache[id] = width;
      return width;
    }

    function place(id, left, y) {
      const node = nodes[id];
      if (!node) return;
      const width = measure(id);
      const centerX = left + width / 2;
      positions[id] = {
        x: centerX,
        y,
        w: ownWidth(node),
        h: NODE_HEIGHT
      };

      if ((node.tag === LIST || node.tag === ROOT) && node.child) {
        const childrenWidth = chainWidth(node.child);
        let childLeft = centerX - childrenWidth / 2;
        let childId = node.child;
        while (childId) {
          const childWidth = measure(childId);
          place(childId, childLeft, y + V_GAP);
          childLeft += childWidth + H_GAP;
          const child = nodes[childId];
          childId = child ? child.next : null;
        }
      }
    }

    place(root.id, 0, 0);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    Object.keys(positions).forEach((id) => {
      const pos = positions[id];
      minX = Math.min(minX, pos.x - pos.w / 2);
      maxX = Math.max(maxX, pos.x + pos.w / 2);
      minY = Math.min(minY, pos.y - pos.h / 2);
      maxY = Math.max(maxY, pos.y + pos.h / 2);
    });

    const shiftX = STAGE_PAD - minX;
    const shiftY = STAGE_PAD - minY;

    Object.keys(positions).forEach((id) => {
      positions[id].x += shiftX + leftGutter;
      positions[id].y += shiftY;
    });

    let stageWidth = Math.max(320, maxX - minX + STAGE_PAD * 2 + leftGutter);
    let stageHeight = Math.max(220, maxY - minY + STAGE_PAD * 2);

    const syntheticIds = Object.keys(nodes).filter((id) => {
      return nodes[id].synthetic && !positions[id];
    });

    if (syntheticIds.length) {
      const mainBottom = maxY + shiftY;
      const laneY = mainBottom + 58;
      const spacing = 120;
      syntheticIds.forEach((id, index) => {
        const node = nodes[id];
        positions[id] = {
          x: stageWidth / 2 + (index - (syntheticIds.length - 1) / 2) * spacing,
          y: laneY,
          w: ownWidth(node),
          h: NODE_HEIGHT
        };
        stageWidth = Math.max(stageWidth, positions[id].x + positions[id].w / 2 + STAGE_PAD);
        stageHeight = Math.max(stageHeight, laneY + NODE_HEIGHT / 2 + STAGE_PAD);
      });
    }

    return {
      positions,
      width: stageWidth,
      height: stageHeight
    };
  }

  /* ===========================================================
     运行对象
     =========================================================== */

  function validateSteps(steps, codeBlock) {
    steps.forEach((step, index) => {
      const required = ['desc', 'codeLine', 'nodes', 'highlightNodeIds', 'highlightPointers', 'variables', 'result'];
      required.forEach((key) => {
        if (!(key in step)) {
          throw new Error('内部错误：第 ' + (index + 1) + ' 步缺少字段 ' + key);
        }
      });
      if (!Number.isInteger(step.codeLine) || step.codeLine < 1 || step.codeLine > codeBlock.lines.length) {
        throw new Error('内部错误：第 ' + (index + 1) + ' 步的 codeLine 越界。');
      }
      if (!Array.isArray(step.nodes) || !Array.isArray(step.highlightNodeIds) ||
          !Array.isArray(step.highlightPointers)) {
        throw new Error('内部错误：第 ' + (index + 1) + ' 步的数组字段格式不正确。');
      }
    });
  }

  function createBaseSubject(graph, name) {
    const root = graph.nodes[graph.rootId];
    const headId = root.child || null;
    return makeListSubject(
      graph,
      headId,
      name,
      headId ? root.id + '.child' : null
    );
  }

  function createBaseStep(graph, subject, name) {
    return {
      base: true,
      desc: '当前对象 ' + subject.exprLabel + ' = ' + subject.valueText + '。从上方函数链选择操作开始演示。',
      codeLine: null,
      nodes: snapshotNodes(graph),
      highlightNodeIds: [],
      highlightPointers: [],
      variables: { case: subject.exprLabel, head: subject.headId || 'NULL', length: chainLength(graph, subject.headId) },
      result: subject.valueText
    };
  }

  function createBaseView(graph, subject, name) {
    return {
      base: true,
      graph,
      layout: buildLayout(graph),
      steps: [createBaseStep(graph, subject, name)],
      codeBlock: null,
      operation: null,
      total: 1,
      subject
    };
  }

  function createOperationRun(graph, operation, subject) {
    const meta = OPERATION_BY_KEY[operation];
    if (!meta) throw new Error('未知操作：' + operation);
    if (!subject || subject.kind !== 'list') {
      throw new Error('当前对象不是广义表。');
    }

    const outcome = evaluateOperation(graph, subject, operation);
    const steps = generateOperationSteps(operation, graph, subject);
    const codeBlock = CODE_BLOCKS[operation];
    validateSteps(steps, codeBlock);
    const layout = buildLayout(graph, { operation });

    return {
      run: {
        base: false,
        graph,
        operation,
        codeBlock,
        layout,
        steps,
        total: steps.length,
        subject
      },
      outcome
    };
  }

  /* ===========================================================
     头尾链表：图模型、布局与序列化
     =========================================================== */

  function buildHTGraph(linearGraph) {
    const linearRoot = linearGraph.nodes[linearGraph.rootId];
    const ht = {
      nodes: Object.create(null),
      rootId: 'R1',
      seq: 0,
      atomByLinearId: Object.create(null),
      name: linearRoot ? linearRoot.name : '表'
    };

    const root = {
      id: 'R1',
      tag: ROOT,
      root: true,
      name: ht.name,
      hp: null,
      tp: null
    };
    ht.nodes[root.id] = root;

    function createAtom(linearNode) {
      const id = 'a' + (++ht.seq);
      const atom = {
        id,
        tag: ATOM,
        root: false,
        value: linearNode.value,
        data: linearNode.data,
        hp: null,
        tp: null,
        sourceLinearId: linearNode.id
      };
      ht.nodes[id] = atom;
      ht.atomByLinearId[linearNode.id] = id;
      return atom;
    }

    function buildChain(linearHeadId) {
      let firstId = null;
      let previousId = null;
      let linearId = linearHeadId;

      while (linearId && linearGraph.nodes[linearId]) {
        const linearNode = linearGraph.nodes[linearId];
        let hp = null;
        if (linearNode.tag === ATOM) {
          hp = createAtom(linearNode).id;
        } else {
          hp = buildChain(linearNode.child || null);
        }

        const listNode = {
          id: linearNode.id,
          tag: LIST,
          root: false,
          hp,
          tp: null,
          sourceLinearId: linearNode.id
        };
        ht.nodes[listNode.id] = listNode;

        if (previousId) {
          ht.nodes[previousId].tp = listNode.id;
        } else {
          firstId = listNode.id;
        }
        previousId = listNode.id;
        linearId = linearNode.next || null;
      }

      return firstId;
    }

    root.hp = buildChain(linearRoot ? linearRoot.child : null);
    return ht;
  }

  function serializeHTList(ht, startId) {
    if (!startId) return '()';
    const parts = [];
    let listId = startId;
    while (listId && ht.nodes[listId]) {
      const listNode = ht.nodes[listId];
      if (!listNode.hp) {
        parts.push('()');
      } else {
        const headNode = ht.nodes[listNode.hp];
        if (!headNode) {
          parts.push('');
        } else if (headNode.tag === ATOM) {
          parts.push(headNode.value == null ? '' : headNode.value);
        } else {
          parts.push(serializeHTList(ht, listNode.hp));
        }
      }
      listId = listNode.tp || null;
    }
    return `(${parts.join(',')})`;
  }

  function serializeHTGraph(ht) {
    return serializeHTList(ht, ht.nodes[ht.rootId] ? ht.nodes[ht.rootId].hp : null);
  }

  const HT_LIST_W = 96;
  const HT_LIST_H = 52;
  const HT_ATOM_SIZE = 48;
  const HT_ROOT_W = 68;
  const HT_ROOT_H = 42;
  const HT_H_GAP = 18;
  const HT_V_GAP = 28;
  const HT_STAGE_PAD = 40;

  function buildHTLayout(ht) {
    const nodes = ht.nodes;
    const root = nodes[ht.rootId];
    const positions = Object.create(null);

    const measureCache = Object.create(null);

    function measurePtr(ptr) {
      if (!ptr || !nodes[ptr]) return { w: 0, h: 0 };
      const node = nodes[ptr];
      if (node.tag === ATOM) return { w: HT_ATOM_SIZE, h: HT_ATOM_SIZE };
      return measureList(ptr);
    }

    function measureList(startId) {
      if (!startId) return { w: 0, h: 0 };
      if (measureCache[startId]) return measureCache[startId];
      let width = 0;
      let height = 0;
      let count = 0;
      let listId = startId;
      while (listId && nodes[listId]) {
        const node = nodes[listId];
        const hp = measurePtr(node.hp);
        const cellW = Math.max(HT_LIST_W, hp.w + 20);
        const cellH = HT_LIST_H + (hp.h ? HT_V_GAP + hp.h : 0);
        width += cellW + (count ? HT_H_GAP : 0);
        height = Math.max(height, cellH);
        count += 1;
        listId = node.tp || null;
      }
      const result = { w: width, h: height };
      measureCache[startId] = result;
      return result;
    }

    function placeList(startId, left, y) {
      let listId = startId;
      while (listId && nodes[listId]) {
        const node = nodes[listId];
        const hp = measurePtr(node.hp);
        const cellW = Math.max(HT_LIST_W, hp.w + 20);
        const centerX = left + cellW / 2;
        positions[listId] = {
          x: centerX,
          y,
          w: HT_LIST_W,
          h: HT_LIST_H
        };

        if (node.hp && nodes[node.hp]) {
          const headNode = nodes[node.hp];
          if (headNode.tag === ATOM) {
            positions[node.hp] = {
              x: centerX,
              y: y + HT_LIST_H / 2 + HT_V_GAP + HT_ATOM_SIZE / 2,
              w: HT_ATOM_SIZE,
              h: HT_ATOM_SIZE
            };
          } else {
            placeList(
              node.hp,
              centerX - hp.w / 2,
              y + HT_LIST_H / 2 + HT_V_GAP + HT_LIST_H / 2
            );
          }
        }

        left += cellW + HT_H_GAP;
        listId = node.tp || null;
      }
    }

    if (root && root.hp && nodes[root.hp]) {
      placeList(root.hp, 0, 0);
      const first = nodes[root.hp];
      const firstPos = positions[first.id];
      positions[root.id] = {
        x: firstPos ? firstPos.x : 0,
        y: firstPos ? firstPos.y - (HT_LIST_H / 2 + HT_V_GAP + HT_ROOT_H / 2) : 0,
        w: HT_ROOT_W,
        h: HT_ROOT_H
      };
    } else {
      positions[root.id] = { x: 0, y: 0, w: HT_ROOT_W, h: HT_ROOT_H };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    Object.keys(positions).forEach((id) => {
      const pos = positions[id];
      minX = Math.min(minX, pos.x - pos.w / 2);
      maxX = Math.max(maxX, pos.x + pos.w / 2);
      minY = Math.min(minY, pos.y - pos.h / 2);
      maxY = Math.max(maxY, pos.y + pos.h / 2);
    });

    const shiftX = HT_STAGE_PAD - minX;
    const shiftY = HT_STAGE_PAD - minY;
    Object.keys(positions).forEach((id) => {
      positions[id].x += shiftX;
      positions[id].y += shiftY;
    });

    return {
      positions,
      width: Math.max(320, maxX - minX + HT_STAGE_PAD * 2),
      height: Math.max(220, maxY - minY + HT_STAGE_PAD * 2)
    };
  }

  function snapshotHTNodes(ht, visibleIds) {
    return Object.keys(ht.nodes)
      .filter((id) => !visibleIds || visibleIds.has(id))
      .map((id) => {
        const node = ht.nodes[id];
        return {
          id: node.id,
          tag: node.tag,
          root: !!node.root,
          name: node.name || '',
          value: node.value,
          data: node.data,
          hp: node.hp,
          tp: node.tp
        };
      });
  }

  /* ===========================================================
     创建与判等：纯逻辑与步骤快照
     =========================================================== */

  function generateBuildSteps(graph) {
    const block = CODE_BLOCKS.build;
    const root = graph.nodes[graph.rootId];
    const steps = [];
    const visible = new Set([graph.rootId]);
    const total = Object.keys(graph.nodes).length - 1;

    const push = (spec) => {
      steps.push(makeStep(graph, { ...spec, visibleIds: visible }, block.marks));
    };

    function buildChain(headId, ownerId, stack, level) {
      const ids = chainIds(graph, headId);
      const n = ids.length;
      const label = level === 0 ? (root.name || '表') : ownerId;

      push({
        desc: `调用 BuildList(${n})，开始构建 ${label} 这一层。`,
        line: 'func',
        highlightNodeIds: ownerId ? [ownerId] : [],
        variables: { n, 层: level + 1, 栈: stack, 已建: visible.size - 1 },
        result: `BuildList(${n})`
      });
      push({
        desc: '分配临时头结点 dummy，tail 指向它。',
        line: 'init',
        variables: { tail: 'dummy', n, 栈: stack },
        result: 'dummy 就绪'
      });
      push({
        desc: 'dummy->next = NULL，准备从空链开始尾插。',
        line: 'dummy',
        variables: { tail: 'dummy', n },
        result: '空链'
      });

      let previousId = null;

      ids.forEach((id, index) => {
        const node = graph.nodes[id];
        const childCount = node.tag === ATOM ? 0 : chainLength(graph, node.child);
        const k = node.tag === ATOM ? 0 : (childCount > 0 ? childCount : -1);

        push({
          desc: `循环第 ${index + 1} 个结点：读入 k = ${k}。`,
          line: 'loop',
          variables: { n, i: index + 1, k, 栈: stack },
          result: `k = ${k}`
        });

        visible.add(id);
        push({
          desc: `分配新结点 p = ${id}，准备写入 tag。`,
          line: 'alloc',
          highlightNodeIds: [id],
          variables: { p: id, k, 已建: visible.size - 1 },
          result: `p = ${id}`
        });
        push({
          desc: `读入 k = ${k}：${k === 0 ? '这是原子结点' : (k > 0 ? '这是含 ' + k + ' 个结点的子表' : '这是空子表')}。`,
          line: 'read',
          highlightNodeIds: [id],
          variables: { p: id, k, tag: node.tag },
          result: `k = ${k}`
        });
        push({
          desc: k === 0 ? 'k = 0，设置 p->tag = element。' : 'k ≠ 0，设置 p->tag = sublist。',
          line: 'tag',
          highlightNodeIds: [id],
          variables: { p: id, tag: node.tag },
          result: node.tag === ATOM ? 'element' : 'sublist'
        });

        if (node.tag === ATOM) {
          push({
            desc: `读入 p->u.data = ${node.value}。`,
            line: 'data',
            highlightNodeIds: [id],
            variables: { p: id, data: node.value },
            result: `data = ${node.value}`
          });
        } else {
          push({
            desc: k > 0
              ? `p 是子表，递归 BuildList(${k}) 构建 u.sub_list。`
              : 'k = -1：空子表，递归 BuildList(0) 返回 NULL。',
            line: 'recurse',
            highlightNodeIds: [id],
            variables: { p: id, k, 栈: stack },
            result: '进入子表'
          });
          if (k > 0) {
            buildChain(node.child, id, stack.concat(id), level + 1);
          } else {
            push({
              desc: 'BuildList(0) 直接返回 NULL，p->u.sub_list 为空。',
              line: 'recurse',
              highlightNodeIds: [id],
              variables: { p: id, k },
              result: 'u.sub_list = NULL'
            });
          }
          push({
            desc: '子表返回，继续当前层。',
            line: 'afterSub',
            highlightNodeIds: [id],
            variables: { p: id, 已建: visible.size - 1 },
            result: '子表完成'
          });
        }

        const pointerKey = previousId ? `${previousId}.next` : `${ownerId}.child`;
        const tailValue = previousId || 'dummy';
        push({
          desc: `tail->next = p：把 ${id} 接到 ${tailValue} 的后面。`,
          line: 'link',
          highlightNodeIds: [id],
          highlightPointers: [pointerKey],
          variables: { p: id, tail: tailValue },
          result: `${pointerKey} → ${id}`
        });
        push({
          desc: 'p->next = NULL，tail 后移到新结点。',
          line: 'next',
          highlightNodeIds: [id],
          variables: { p: id, tail: id },
          result: `tail = ${id}`
        });
        push({
          desc: '当前结点完成尾插，进入下一轮循环。',
          line: 'tail',
          highlightNodeIds: [id],
          variables: { tail: id, 已建: visible.size - 1 },
          result: `tail = ${id}`
        });

        previousId = id;
      });

      const firstId = ids[0] || 'NULL';
      push({
        desc: '循环结束：head = dummy->next，释放临时头结点。',
        line: 'free',
        variables: { head: firstId, n, 已建: visible.size - 1 },
        result: `head = ${firstId}`
      });
      push({
        desc: `BuildList(${n}) 返回 ${firstId}。`,
        line: 'ret',
        highlightNodeIds: firstId !== 'NULL' ? [firstId] : [],
        variables: { return: firstId, n },
        result: firstId
      });
    }

    buildChain(root.child || null, root.id, [root.name || '表'], 0);

    push({
      desc: `创建完成：${serializeGraph(graph)}。`,
      line: 'ret',
      variables: { 结点: total, 已建: total, 结果: serializeGraph(graph) },
      result: serializeGraph(graph)
    });

    return steps;
  }

  function createBuildRun(graph) {
    const codeBlock = CODE_BLOCKS.build;
    const steps = generateBuildSteps(graph);
    validateSteps(steps, codeBlock);
    return {
      run: {
        base: false,
        graph,
        operation: 'build',
        build: true,
        codeBlock,
        layout: buildLayout(graph),
        steps,
        total: steps.length,
        subject: null
      }
    };
  }

  function compareDescription(graph, id) {
    if (!id) return 'NULL';
    const node = graph.nodes[id];
    if (!node) return id;
    if (node.tag === ATOM) return `${id} · element ${node.value}`;
    return `${id} · sublist`;
  }

  function generateCompareSteps(graphA, graphB, nameA, nameB) {
    const block = CODE_BLOCKS.equal;
    const steps = [];
    const rootA = graphA.nodes[graphA.rootId];
    const rootB = graphB.nodes[graphB.rootId];
    let lastPair = { a: rootA.child, b: rootB.child };
    let decisivePair = null;
    let resultMark = 'retTrue';

    const push = (line, desc, variables, result, pair, mismatch) => {
      const codeLine = block.marks[line];
      if (!codeLine) throw new Error('内部错误：未知判等代码行 ' + line);
      steps.push({
        desc,
        codeLine,
        mark: line,
        nodes: [],
        highlightNodeIds: [],
        highlightPointers: [],
        variables: cloneVariables(variables),
        result: String(result),
        compare: {
          a: pair && pair.a ? pair.a : null,
          b: pair && pair.b ? pair.b : null,
          mismatch: !!mismatch
        }
      });
    };

    push('func',
      `调用 IsEqual(${nameA}, ${nameB})。`,
      { A: rootA.child || 'NULL', B: rootB.child || 'NULL' },
      '继续',
      { a: rootA.child, b: rootB.child });

    function compareAt(aId, bId, level) {
      const a = aId || null;
      const b = bId || null;

      push('empty',
        a || b ? '检查两个指针是否同时为空。' : '两个指针同时为空。',
        { A: a || 'NULL', B: b || 'NULL', 层: level },
        (!a && !b) ? 'true' : '继续',
        { a, b });

      if (!a && !b) {
        resultMark = 'retTrue';
        push('retTrue',
          '两边都为空，返回 true。',
          { A: 'NULL', B: 'NULL', 层: level },
          'true',
          { a: null, b: null });
        return true;
      }

      push('oneEmpty',
        (!a || !b) ? '只有一侧为空。' : '两边都不为空，继续比较。',
        { A: a || 'NULL', B: b || 'NULL', 层: level },
        (!a || !b) ? 'false' : '继续',
        { a, b },
        !a || !b);

      if (!a || !b) {
        decisivePair = { a, b };
        resultMark = 'retFalse';
        push('retFalse',
          '一侧先结束，返回 false。',
          { A: a || 'NULL', B: b || 'NULL', 层: level },
          'false',
          { a, b },
          true);
        return false;
      }

      lastPair = { a, b };
      const nodeA = graphA.nodes[a];
      const nodeB = graphB.nodes[b];

      push('tag',
        `比较 tag：A = ${nodeA.tag}，B = ${nodeB.tag}。`,
        { tagA: nodeA.tag, tagB: nodeB.tag, 层: level },
        '继续',
        { a, b });

      if (nodeA.tag !== nodeB.tag) {
        decisivePair = { a, b };
        resultMark = 'failTag';
        push('failTag',
          'tag 不同，返回 false。',
          { tagA: nodeA.tag, tagB: nodeB.tag, 层: level },
          'false',
          { a, b },
          true);
        return false;
      }

      if (nodeA.tag === ATOM) {
        push('atom',
          '两边都是 element，比较 data。',
          { tag: 'element', 层: level },
          '继续',
          { a, b });
        const dataA = nodeA.data == null ? nodeA.value : nodeA.data;
        const dataB = nodeB.data == null ? nodeB.value : nodeB.data;
        const sameData = dataA === dataB;
        push('data',
          `比较 data：A = ${nodeA.value}，B = ${nodeB.value}。`,
          { dataA: nodeA.value, dataB: nodeB.value, 层: level },
          sameData ? '继续' : 'false',
          { a, b },
          !sameData);
        if (!sameData) {
          decisivePair = { a, b };
          resultMark = 'failData';
          push('failData',
            'data 不同，返回 false。',
            { dataA: nodeA.value, dataB: nodeB.value, 层: level },
            'false',
            { a, b },
            true);
          return false;
        }
      } else {
        push('recurse',
          '两边都是 sublist，递归比较 u.sub_list。',
          { A: a, B: b, 层: level + 1 },
          '进入子表',
          { a, b });
        if (!compareAt(nodeA.child, nodeB.child, level + 1)) {
          decisivePair = decisivePair || { a, b };
          resultMark = 'failSub';
          push('failSub',
            '子表递归返回 false，当前这一对也不相等。',
            { A: a, B: b, 层: level },
            'false',
            { a, b },
            true);
          return false;
        }
      }

      const nextA = nodeA.next || null;
      const nextB = nodeB.next || null;
      push('next',
        '沿 next 递归比较剩余链。',
        { A: nextA || 'NULL', B: nextB || 'NULL', 层: level },
        '继续',
        { a: nextA, b: nextB });
      return compareAt(nextA, nextB, level);
    }

    const result = compareAt(rootA.child, rootB.child, 0);
    const finalPair = result ? lastPair : (decisivePair || lastPair);
    push(resultMark,
      result ? '判等结果：两个广义表相等。' : '判等结果：两个广义表不相等。',
      { 结论: result ? 'true' : 'false' },
      result ? 'true' : 'false',
      finalPair,
      !result);

    return { equal: result, steps };
  }

  function createCompareRun(graphA, graphB, nameA, nameB) {
    const block = CODE_BLOCKS.equal;
    const generated = generateCompareSteps(graphA, graphB, nameA, nameB);
    generated.steps.forEach((step) => {
      if (!Number.isInteger(step.codeLine) || step.codeLine < 1 || step.codeLine > block.lines.length) {
        throw new Error('内部错误：判等步骤的代码行越界。');
      }
    });
    return {
      run: {
        base: false,
        compare: true,
        operation: 'equal',
        codeBlock: block,
        graphA,
        graphB,
        nameA,
        nameB,
        layoutA: buildLayout(graphA),
        layoutB: buildLayout(graphB),
        steps: generated.steps,
        total: generated.steps.length,
        equal: generated.equal,
        subject: null
      },
      equal: generated.equal
    };
  }

  /* ===========================================================
     头尾链表：步骤快照、创建、操作与判等
     =========================================================== */

  const HT_OPERATION_BLOCKS = {
    head: 'htHead',
    tail: 'htTail',
    length: 'htLength',
    depth: 'htDepth'
  };

  function makeHTStep(ht, spec, marks, visibleIds) {
    const codeLine = marks[spec.line];
    if (!codeLine) throw new Error('内部错误：未知头尾链表代码行 ' + spec.line);
    const step = {
      desc: spec.desc,
      codeLine,
      storage: 'headtail',
      nodes: [],
      htNodes: snapshotHTNodes(ht, visibleIds),
      htHighlightNodeIds: Array.from(new Set(spec.htHighlightNodeIds || [])),
      htHighlightPointers: Array.from(new Set(spec.htHighlightPointers || [])),
      variables: cloneVariables(spec.variables),
      result: spec.result == null ? '—' : String(spec.result)
    };
    if (spec.htReturnedNodeId) step.htReturnedNodeId = spec.htReturnedNodeId;
    if (spec.htBadges) step.htBadges = cloneVariables(spec.htBadges);
    return step;
  }

  function createHTBaseStep(ht, subject) {
    return {
      base: true,
      storage: 'headtail',
      desc: '当前对象 ' + subject.exprLabel + ' = ' + subject.valueText + '。这是头尾链表表示。',
      codeLine: null,
      nodes: [],
      htNodes: snapshotHTNodes(ht),
      htHighlightNodeIds: [],
      htHighlightPointers: [],
      variables: {
        案例: subject.exprLabel,
        L: subject.headId || 'NULL',
        长度: chainLengthByTP(ht, subject.headId)
      },
      result: subject.valueText
    };
  }

  function createHTBaseView(linearGraph, ht, subject) {
    return {
      base: true,
      storage: 'headtail',
      graph: linearGraph,
      htGraph: ht,
      layout: buildHTLayout(ht),
      steps: [createHTBaseStep(ht, subject)],
      codeBlock: null,
      operation: null,
      total: 1,
      subject
    };
  }

  function chainLengthByTP(ht, startId) {
    let count = 0;
    let id = startId;
    while (id && ht.nodes[id]) {
      count += 1;
      id = ht.nodes[id].tp || null;
    }
    return count;
  }

  function htNodeValue(ht, id) {
    if (!id || !ht.nodes[id]) return '';
    const node = ht.nodes[id];
    if (node.tag === ATOM) return node.value == null ? '' : node.value;
    return serializeHTList(ht, id);
  }

  function makeHTBaseVisible(ht) {
    const set = new Set([ht.rootId]);
    return set;
  }

  function generateHTHeadSteps(ht, subject, block) {
    const steps = [];
    const push = (spec) => steps.push(makeHTStep(ht, spec, block.marks));
    const listId = subject.headId || null;
    const listNode = listId ? ht.nodes[listId] : null;

    push({
      desc: '准备取头：当前表指针 L = ' + (listId || 'NULL') + '。',
      line: 'func',
      htHighlightNodeIds: listId ? [listId] : [],
      variables: { L: listId || 'NULL' },
      result: subject.valueText
    });

    if (!listNode) {
      push({
        desc: 'L 为 NULL，空表没有表头。',
        line: 'empty',
        variables: { L: 'NULL' },
        result: '空表没有表头'
      });
      return steps;
    }

    if (!listNode.hp) {
      push({
        desc: 'L->u.ptr.hp 为 NULL，表头是一个空子表。',
        line: 'ret',
        htHighlightNodeIds: [listId],
        htHighlightPointers: [listId + '.hp'],
        variables: { L: listId, hp: 'NULL' },
        result: '()'
      });
      return steps;
    }

    const headNode = ht.nodes[listNode.hp];
    push({
      desc: '返回 L->u.ptr.hp：' + (headNode.tag === ATOM ? '原子 ' + headNode.value : '子表 ' + serializeHTList(ht, listNode.hp)) + '。',
      line: 'ret',
      htHighlightNodeIds: [listId, listNode.hp],
      htHighlightPointers: [listId + '.hp'],
      variables: { L: listId, hp: listNode.hp, tag: headNode.tag },
      result: htNodeValue(ht, listNode.hp)
    });
    return steps;
  }

  function generateHTTailSteps(ht, subject, block) {
    const steps = [];
    const push = (spec) => steps.push(makeHTStep(ht, spec, block.marks));
    const listId = subject.headId || null;
    const listNode = listId ? ht.nodes[listId] : null;

    push({
      desc: '准备取表尾：当前表指针 L = ' + (listId || 'NULL') + '。',
      line: 'func',
      htHighlightNodeIds: listId ? [listId] : [],
      variables: { L: listId || 'NULL' },
      result: subject.valueText
    });

    if (!listNode) {
      push({
        desc: 'L 为 NULL，表尾仍为空表。',
        line: 'empty',
        variables: { L: 'NULL' },
        result: '()'
      });
      return steps;
    }

    const tailId = listNode.tp || null;
    push({
      desc: '返回 L->u.ptr.tp：表尾是 ' + serializeHTList(ht, tailId) + '。',
      line: 'ret',
      htHighlightNodeIds: tailId ? [listId, tailId] : [listId],
      htHighlightPointers: [listId + '.tp'],
      variables: { L: listId, tp: tailId || 'NULL' },
      result: serializeHTList(ht, tailId)
    });
    return steps;
  }

  function generateHTLengthSteps(ht, subject, block) {
    const steps = [];
    const push = (spec) => steps.push(makeHTStep(ht, spec, block.marks));
    let listId = subject.headId || null;
    let len = 0;
    const badges = Object.create(null);

    push({
      desc: '从 L 沿表尾指针 tp 统计同级表结点。',
      line: 'func',
      htHighlightNodeIds: listId ? [listId] : [],
      variables: { L: listId || 'NULL', len: 0 },
      result: '开始求长度'
    });
    push({
      desc: '初始化 len = 0。',
      line: 'init',
      variables: { len: 0 },
      result: 'len = 0'
    });

    while (listId && ht.nodes[listId]) {
      const node = ht.nodes[listId];
      push({
        desc: '当前表结点 ' + listId + ' 非空，长度加一。',
        line: 'loop',
        htHighlightNodeIds: [listId],
        variables: { L: listId, len },
        result: '继续'
      });
      len += 1;
      badges[listId] = '#' + len;
      push({
        desc: 'len = ' + len + '。',
        line: 'count',
        htHighlightNodeIds: [listId],
        htBadges: { ...badges },
        variables: { len },
        result: 'len = ' + len
      });
      const nextId = node.tp || null;
      push({
        desc: nextId ? '沿 tp 前进到 ' + nextId + '。' : 'tp 为 NULL，长度统计结束。',
        line: 'next',
        htHighlightNodeIds: nextId ? [listId, nextId] : [listId],
        htHighlightPointers: [listId + '.tp'],
        htBadges: { ...badges },
        variables: { L: nextId || 'NULL', len },
        result: nextId || 'NULL'
      });
      listId = nextId;
    }

    push({
      desc: '返回 len = ' + len + '。',
      line: 'ret',
      htBadges: { ...badges },
      variables: { len },
      result: String(len)
    });
    return steps;
  }

  function generateHTDepthSteps(ht, subject, block) {
    const steps = [];
    const push = (spec) => steps.push(makeHTStep(ht, spec, block.marks));

    function depthOf(startId, level) {
      if (!startId || !ht.nodes[startId]) {
        push({
          desc: '空表：深度基例返回 1。',
          line: 'null',
          variables: { L: 'NULL', d: 1, 层: level },
          result: '1'
        });
        return 1;
      }

      let max = 0;
      let listId = startId;
      push({
        desc: '进入一层表链，初始化 max = 0。',
        line: 'init',
        htHighlightNodeIds: [listId],
        variables: { L: listId, max: 0, 层: level },
        result: 'max = 0'
      });

      while (listId && ht.nodes[listId]) {
        const node = ht.nodes[listId];
        push({
          desc: '检查表结点 ' + listId + ' 的 hp 指针。',
          line: 'hp',
          htHighlightNodeIds: [listId],
          htHighlightPointers: [listId + '.hp'],
          variables: { L: listId, hp: node.hp || 'NULL', max, 层: level },
          result: 'hp = ' + (node.hp || 'NULL')
        });

        let d;
        if (!node.hp) {
          d = 1;
          push({
            desc: 'hp 为 NULL（空子表），深度记为 1。',
            line: 'atom',
            htHighlightNodeIds: [listId],
            variables: { d: 1, max, 层: level },
            result: 'd = 1'
          });
        } else {
          const headNode = ht.nodes[node.hp];
          if (headNode.tag === ATOM) {
            d = 1;
            push({
              desc: 'hp 指向原子结点，深度记为 1。',
              line: 'setAtom',
              htHighlightNodeIds: [listId, node.hp],
              htHighlightPointers: [listId + '.hp'],
              variables: { d: 1, max, 层: level },
              result: 'd = 1'
            });
          } else {
            push({
              desc: 'hp 指向子表，递归计算它的深度。',
              line: 'recurse',
              htHighlightNodeIds: [listId, node.hp],
              htHighlightPointers: [listId + '.hp'],
              variables: { L: node.hp, 层: level + 1 },
              result: '递归'
            });
            d = depthOf(node.hp, level + 1);
          }
        }

        if (d > max) {
          max = d;
          push({
            desc: 'd = ' + d + ' 大于 max，更新 max。',
            line: 'compare',
            htHighlightNodeIds: [listId],
            variables: { d, max, 层: level },
            result: 'max = ' + max
          });
        }

        const nextId = node.tp || null;
        push({
          desc: nextId ? '沿 tp 检查下一个表结点。' : 'tp 为 NULL，本层遍历结束。',
          line: 'next',
          htHighlightNodeIds: nextId ? [listId, nextId] : [listId],
          htHighlightPointers: [listId + '.tp'],
          variables: { L: nextId || 'NULL', max, 层: level },
          result: nextId || 'NULL'
        });
        listId = nextId;
      }

      push({
        desc: '本层返回 max + 1 = ' + (max + 1) + '。',
        line: 'ret',
        variables: { max, d: max + 1, 层: level },
        result: String(max + 1)
      });
      return max + 1;
    }

    const result = depthOf(subject.headId || null, 0);
    return { steps, result };
  }

  function createHTOperationRun(linearGraph, ht, subject, operation) {
    const outcome = evaluateOperation(linearGraph, subject, operation);
    const blockKey = HT_OPERATION_BLOCKS[operation];
    const block = CODE_BLOCKS[blockKey];
    if (!block) throw new Error('未知头尾链表操作：' + operation);
    let steps;
    if (operation === 'head') steps = generateHTHeadSteps(ht, subject, block);
    else if (operation === 'tail') steps = generateHTTailSteps(ht, subject, block);
    else if (operation === 'length') steps = generateHTLengthSteps(ht, subject, block);
    else {
      const generated = generateHTDepthSteps(ht, subject, block);
      steps = generated.steps;
    }
    steps.forEach((step) => {
      if (!Number.isInteger(step.codeLine) || step.codeLine < 1 || step.codeLine > block.lines.length) {
        throw new Error('内部错误：头尾链表步骤代码行越界。');
      }
    });
    return {
      run: {
        base: false,
        storage: 'headtail',
        graph: linearGraph,
        htGraph: ht,
        operation,
        codeBlock: block,
        layout: buildHTLayout(ht),
        steps,
        total: steps.length,
        subject
      },
      outcome
    };
  }

  function generateHTBuildSteps(ht) {
    const block = CODE_BLOCKS.htBuild;
    const steps = [];
    const visible = new Set([ht.rootId]);
    const total = Object.keys(ht.nodes).length - 1;
    const push = (spec) => steps.push(makeHTStep(ht, spec, block.marks, visible));

    function buildChain(startId, n, stack, level) {
      if (!startId || n <= 0) {
        push({
          desc: 'BuildList(0) 返回 NULL。',
          line: 'empty',
          variables: { n: 0, 栈: stack, 已建: visible.size - 1 },
          result: 'NULL'
        });
        return;
      }

      const listId = startId;
      const node = ht.nodes[listId];
      visible.add(listId);
      const hp = node.hp || null;
      const hpNode = hp ? ht.nodes[hp] : null;
      let childCount = 0;
      if (hpNode && hpNode.tag === LIST) childCount = chainLengthByTP(ht, hp);
      const k = !hp ? -1 : (hpNode.tag === ATOM ? 0 : childCount);

      push({
        desc: `BuildList(${n})：创建当前表结点 ${listId}。`,
        line: 'alloc',
        htHighlightNodeIds: [listId],
        variables: { n, p: listId, 栈: stack, 已建: visible.size - 1 },
        result: `p = ${listId}`
      });
      push({
        desc: `读入 k = ${k}。`,
        line: 'read',
        htHighlightNodeIds: [listId],
        variables: { n, k, p: listId, 栈: stack },
        result: `k = ${k}`
      });
      push({
        desc: '当前表结点 tag = LIST。',
        line: 'tagList',
        htHighlightNodeIds: [listId],
        variables: { p: listId, tag: 'LIST' },
        result: 'tag = LIST'
      });

      if (!hp) {
        push({
          desc: 'hp 为空：这是一个空子表元素。',
          line: 'else',
          htHighlightNodeIds: [listId],
          variables: { p: listId, hp: 'NULL', k: -1 },
          result: 'hp = NULL'
        });
      } else if (hpNode.tag === ATOM) {
        visible.add(hp);
        push({
          desc: 'hp 指向原子：分配 ATOM 结点 ' + hp + '。',
          line: 'allocAtom',
          htHighlightNodeIds: [listId, hp],
          htHighlightPointers: [listId + '.hp'],
          variables: { a: hp, value: hpNode.value, 已建: visible.size - 1 },
          result: `ATOM ${hp}`
        });
        push({
          desc: 'ATOM 结点读入 data = ' + hpNode.value + '。',
          line: 'tagAtom',
          htHighlightNodeIds: [hp],
          variables: { a: hp, tag: 'ATOM' },
          result: 'tag = ATOM'
        });
        push({
          desc: '读入原子值并挂到 p->u.ptr.hp。',
          line: 'linkHp',
          htHighlightNodeIds: [listId, hp],
          htHighlightPointers: [listId + '.hp'],
          variables: { p: listId, hp, data: hpNode.value },
          result: `hp = ${hp}`
        });
      } else {
        push({
          desc: 'hp 指向子表，递归 BuildList(' + childCount + ')。',
          line: 'recurseHp',
          htHighlightNodeIds: [listId, hp],
          htHighlightPointers: [listId + '.hp'],
          variables: { p: listId, hp, n: childCount, 栈: stack },
          result: '递归 hp'
        });
        buildChain(hp, childCount, stack.concat(listId), level + 1);
      }

      const tailId = node.tp || null;
      if (tailId) {
        push({
          desc: '继续构建表尾：BuildList(' + (n - 1) + ')。',
          line: 'recurseTp',
          htHighlightNodeIds: [listId],
          htHighlightPointers: [listId + '.tp'],
          variables: { p: listId, tp: tailId, n: n - 1, 栈: stack },
          result: '递归 tp'
        });
        buildChain(tailId, n - 1, stack, level);
      } else {
        push({
          desc: '表尾 BuildList(0) 返回 NULL。',
          line: 'recurseTp',
          htHighlightNodeIds: [listId],
          variables: { p: listId, tp: 'NULL', n: 0 },
          result: 'tp = NULL'
        });
      }

      push({
        desc: '当前表结点 ' + listId + ' 返回。',
        line: 'ret',
        htHighlightNodeIds: [listId],
        variables: { p: listId, n, 已建: visible.size - 1 },
        result: listId
      });
    }

    push({
      desc: '从根指针开始构建头尾链表。',
      line: 'func',
      variables: { n: chainLengthByTP(ht, ht.nodes[ht.rootId].hp), 栈: [ht.name || 'L'], 已建: 0 },
      result: 'BuildList'
    });

    buildChain(ht.nodes[ht.rootId].hp || null, chainLengthByTP(ht, ht.nodes[ht.rootId].hp), [ht.name || 'L'], 0);

    push({
      desc: '创建完成：' + serializeHTGraph(ht) + '。',
      line: 'ret',
      variables: { 结点: total, 已建: total, 结果: serializeHTGraph(ht) },
      result: serializeHTGraph(ht)
    });

    return steps;
  }

  function createHTBuildRun(ht) {
    const block = CODE_BLOCKS.htBuild;
    const steps = generateHTBuildSteps(ht);
    steps.forEach((step) => {
      if (!Number.isInteger(step.codeLine) || step.codeLine < 1 || step.codeLine > block.lines.length) {
        throw new Error('内部错误：头尾链表创建步骤代码行越界。');
      }
    });
    return {
      run: {
        base: false,
        storage: 'headtail',
        build: true,
        htGraph: ht,
        operation: 'ht-build',
        codeBlock: block,
        layout: buildHTLayout(ht),
        steps,
        total: steps.length,
        subject: null
      }
    };
  }

  function createHTCompareRun(linearA, linearB, htA, htB, nameA, nameB) {
    const canonical = generateCompareSteps(linearA, linearB, nameA, nameB);
    const block = CODE_BLOCKS.htEqual;
    const steps = canonical.steps.map((step) => {
      const listA = step.compare ? step.compare.a : null;
      const listB = step.compare ? step.compare.b : null;
      const hpA = listA && htA.nodes[listA] ? htA.nodes[listA].hp : null;
      const hpB = listB && htB.nodes[listB] ? htB.nodes[listB].hp : null;
      const hpNullDiff = (hpA == null) !== (hpB == null);
      const markMap = {
        func: 'func',
        empty: 'empty',
        retTrue: 'retTrue',
        oneEmpty: 'oneEmpty',
        retFalse: 'retFalse',
        tag: hpNullDiff ? 'hpNull' : 'tag',
        failTag: hpNullDiff ? 'failHp' : 'failTag',
        atom: 'atom',
        data: 'data',
        failData: 'failData',
        recurse: 'recurse',
        failSub: 'failSub',
        next: 'next',
        ret: 'ret'
      };
      const line = block.marks[markMap[step.mark] || 'ret'];
      return {
        desc: step.desc,
        codeLine: line,
        storage: 'headtail',
        nodes: [],
        htCompare: {
          aList: listA,
          bList: listB,
          aHp: hpA,
          bHp: hpB,
          mismatch: !!(step.compare && step.compare.mismatch)
        },
        highlightNodeIds: [],
        highlightPointers: [],
        variables: step.variables,
        result: step.result
      };
    });
    const final = steps[steps.length - 1];
    return {
      run: {
        base: false,
        storage: 'headtail',
        compare: true,
        operation: 'ht-equal',
        codeBlock: block,
        graphA: linearA,
        graphB: linearB,
        htGraphA: htA,
        htGraphB: htB,
        nameA,
        nameB,
        layoutA: buildHTLayout(htA),
        layoutB: buildHTLayout(htB),
        steps,
        total: steps.length,
        equal: canonical.equal,
        subject: null
      },
      equal: canonical.equal
    };
  }

  /* ===========================================================
     浏览器 UI
     =========================================================== */

  function boot() {
    const $ = (id) => document.getElementById(id);

    const dom = {
      exprInput: $('exprInput'),
      caseForm: $('caseForm'),
      caseChips: $('caseChips'),
      caseNameInput: $('caseNameInput'),
      saveCaseBtn: $('saveCaseBtn'),
      caseFeedback: $('caseFeedback'),
      buildCaseBtn: $('buildCaseBtn'),
      compareCasesBtn: $('compareCasesBtn'),
      errorBanner: $('errorBanner'),
      functionButtons: $('functionButtons'),
      undoChainBtn: $('undoChainBtn'),
      resetChainBtn: $('resetChainBtn'),
      chainTrail: $('chainTrail'),
      chainExpression: $('chainExpression'),
      quizOpenBtn: $('quizOpenBtn'),
      quizModal: $('quizModal'),
      quizCloseBtn: $('quizCloseBtn'),
      quizBackdrop: document.querySelector('.quiz-backdrop'),
      quizCategories: $('quizCategories'),
      quizList: $('quizList'),
      stepDesc: $('stepDesc'),
      stepCounter: $('stepCounter'),
      codeHint: $('codeHint'),
      diagramViewport: $('diagramViewport'),
      diagramStage: $('diagramStage'),
      diagramSummary: $('diagramSummary'),
      compareCanvas: $('compareCanvas'),
      compareTitle: $('compareTitle'),
      compareCurrent: $('compareCurrent'),
      compareExitBtn: $('compareExitBtn'),
      compareNameA: $('compareNameA'),
      compareNameB: $('compareNameB'),
      compareValueA: $('compareValueA'),
      compareValueB: $('compareValueB'),
      compareViewportA: $('compareViewportA'),
      compareViewportB: $('compareViewportB'),
      compareStageA: $('compareStageA'),
      compareStageB: $('compareStageB'),
      compareEdgeLayerA: $('compareEdgeLayerA'),
      compareEdgeLayerB: $('compareEdgeLayerB'),
      compareNodeLayerA: $('compareNodeLayerA'),
      compareNodeLayerB: $('compareNodeLayerB'),
      compareModal: $('compareModal'),
      compareSelectA: $('compareSelectA'),
      compareSelectB: $('compareSelectB'),
      compareHint: $('compareHint'),
      compareStartBtn: $('compareStartBtn'),
      compareCloseBtn: $('compareCloseBtn'),
      compareCancelBtn: $('compareCancelBtn'),
      compareCloseBackdrop: document.querySelector('[data-compare-close]'),
      storageBtns: Array.from(document.querySelectorAll('[data-storage]')),
      themeToggle: $('themeToggle'),
      linearLegend: $('linearLegend'),
      htLegend: $('htLegend'),
      htCanvas: $('htCanvas'),
      htStage: $('htStage'),
      htEdgeLayer: $('htEdgeLayer'),
      htNodeLayer: $('htNodeLayer'),
      typeDefSummary: $('typeDefSummary'),
      layerLayer: $('layerLayer'),
      edgeLayer: $('edgeLayer'),
      nodeLayer: $('nodeLayer'),
      laneLabel: $('laneLabel'),
      canvasMetric: $('canvasMetric'),
      canvasEmpty: $('canvasEmpty'),
      variablesList: $('variablesList'),
      resultValue: $('resultValue'),
      returnNodeChip: $('returnNodeChip'),
      resetBtn: $('resetBtn'),
      rewindBtn: $('rewindBtn'),
      prevBtn: $('prevBtn'),
      playPauseBtn: $('playPauseBtn'),
      nextBtn: $('nextBtn'),
      forwardBtn: $('forwardBtn'),
      progressSlider: $('progressSlider'),
      speedSelect: $('speedSelect'),
      stepProgressText: $('stepProgressText'),
      codeTitle: $('codeTitle'),
      codeTotal: $('codeTotal'),
      codeScroll: $('codeScroll'),
      codeLines: $('codeLines'),
      codeEmpty: $('codeEmpty'),
      typeDefDetails: $('typeDefDetails'),
      typeDefCode: $('typeDefCode')
    };

    // 避免 DOM 缺失导致难以定位的静默失败
    const missing = Object.keys(dom).filter((key) => !dom[key]);
    if (missing.length) {
      console.error('页面初始化失败，缺少 DOM 节点：', missing);
      return;
    }

    const state = {
      operation: null,
      cases: [],
      activeCaseIndex: -1,
      graph: null,
      subject: null,
      chain: [],
      run: null,
      stepIndex: 0,
      playing: false,
      timerId: null,
      speed: 1,
      quizCategory: '全部',
      quizReturnFocus: null,
      compareReturnFocus: null,
      storage: 'linear',
      linearGraph: null,
      htGraph: null
    };

    const DEFAULT_CASES = [
      { name: 'A', expression: '(a,(b,c),d)' },
      { name: 'B', expression: '(())' }
    ];

    const nodeEls = new Map();
    const edgeEls = new Map();
    const compareNodeEls = { a: new Map(), b: new Map() };
    const compareEdgeEls = { a: new Map(), b: new Map() };
    const htNodeEls = new Map();
    const htEdgeEls = new Map();
    const htCompareNodeEls = { a: new Map(), b: new Map() };
    const htCompareEdgeEls = { a: new Map(), b: new Map() };
    let compareRunRef = null;
    let htCompareRunRef = null;
    let codeLineEls = [];
    let activeCodeLineEl = null;
    let resizeFrame = 0;

    const VARIABLE_LABELS = {
      case: '案例',
      head: 'head',
      length: '顶层长度',
      L: 'L',
      p: 'p',
      tag: 'tag',
      current: '当前值',
      stack: '递归栈',
      d: 'd',
      max: 'max',
      depth: 'depth',
      next: 'next',
      value: '值',
      len: 'len',
      '当前值': '当前值',
      '当前对象': '当前对象',
      n: 'n',
      i: 'i',
      k: 'k',
      p: 'p',
      head: 'head',
      return: 'return',
      '栈': '递归栈',
      '已建': '已建结点',
      '层': '层级',
      A: 'A',
      B: 'B',
      tagA: 'tag A',
      tagB: 'tag B',
      dataA: 'data A',
      dataB: 'data B',
      '结论': '结论',
      '结点': '结点',
      '结果': '结果'
    };

    /* -------- C 代码渲染与行高亮 -------- */

    function renderCodeBlock(operation) {
      const block = CODE_BLOCKS[operation];
      if (!block) return;
      const fragment = document.createDocumentFragment();
      codeLineEls = [];
      activeCodeLineEl = null;

      block.lines.forEach((text, index) => {
        const lineEl = document.createElement('div');
        lineEl.className = 'code-line';
        lineEl.dataset.line = String(index + 1);

        const trimmed = text.trim();
        if (/^\/\*\s*=+/.test(trimmed)) {
          lineEl.classList.add('is-section');
        } else if (trimmed.startsWith('#include') || trimmed.startsWith('#define')) {
          lineEl.classList.add('is-preprocessor');
        } else if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.endsWith('*/')) {
          lineEl.classList.add('is-comment');
        }

        const numberEl = document.createElement('span');
        numberEl.className = 'line-number';
        numberEl.textContent = String(index + 1);

        const codeEl = document.createElement('span');
        codeEl.className = 'line-code';
        codeEl.textContent = text;

        lineEl.appendChild(numberEl);
        lineEl.appendChild(codeEl);
        fragment.appendChild(lineEl);
        codeLineEls.push(lineEl);
      });

      dom.codeLines.replaceChildren(fragment);
      dom.codeTitle.textContent = `${state.storage === 'headtail' ? '头尾链表 · ' : ''}${block.title} 核心代码`;
      dom.codeTotal.textContent = `${block.lines.length} 行`;
      dom.codeEmpty.hidden = true;
      dom.codeScroll.scrollTop = 0;
      dom.typeDefDetails.open = false;
    }

    function renderBaseCodeState() {
      clearActiveCodeLine();
      codeLineEls = [];
      dom.codeLines.replaceChildren();
      const isHT = state.storage === 'headtail';
      const source = isHT ? HT_TYPE_DEFINITION_SOURCE : TYPE_DEFINITION_SOURCE;
      dom.typeDefCode.textContent = source;
      dom.typeDefSummary.textContent = isHT
        ? '头尾链表类型定义（ATOM / LIST / hp / tp）'
        : '广义表类型定义（element / sublist / next）';
      dom.codeTitle.textContent = isHT ? '头尾链表类型定义' : '广义表类型定义';
      dom.codeTotal.textContent = source.split('\n').length + ' 行';
      dom.codeEmpty.hidden = false;
      dom.codeScroll.scrollTop = 0;
      dom.typeDefDetails.open = true;
    }

    function scrollCodeToLine(lineNumber, alignTop) {
      const lineEl = codeLineEls[lineNumber - 1];
      if (!lineEl) return;
      const containerRect = dom.codeScroll.getBoundingClientRect();
      const lineRect = lineEl.getBoundingClientRect();
      const delta = lineRect.top - containerRect.top;
      const topPadding = 10;
      let target;

      if (alignTop === false) {
        // 若当前行在可视区中部附近，则不强行滚动，减少代码区跳动
        if (delta >= topPadding && delta + lineRect.height <= dom.codeScroll.clientHeight - topPadding) {
          return;
        }
        target = dom.codeScroll.scrollTop + delta - dom.codeScroll.clientHeight / 2 + lineRect.height / 2;
      } else {
        target = dom.codeScroll.scrollTop + delta - topPadding;
      }

      dom.codeScroll.scrollTop = Math.max(0, target);
    }

    function setActiveCodeLine(lineNumber, shouldScroll) {
      if (activeCodeLineEl) {
        activeCodeLineEl.classList.remove('is-active');
        activeCodeLineEl = null;
      }
      const lineEl = codeLineEls[lineNumber - 1];
      if (!lineEl) return;
      lineEl.classList.add('is-active');
      activeCodeLineEl = lineEl;
      if (shouldScroll !== false) {
        scrollCodeToLine(lineNumber, false);
      }
    }

    function clearActiveCodeLine() {
      if (activeCodeLineEl) {
        activeCodeLineEl.classList.remove('is-active');
        activeCodeLineEl = null;
      }
    }

    /* -------- 命名案例与嵌套函数链 -------- */

    function setCaseFeedback(text, tone) {
      let suffix = '';
      if (tone === true || tone === 'error') suffix = ' is-error';
      else if (tone === 'warning') suffix = ' is-warning';
      dom.caseFeedback.textContent = text || '';
      dom.caseFeedback.title = text || '';
      dom.caseFeedback.className = 'case-feedback' + suffix;
    }

    function currentCaseName() {
      if (state.activeCaseIndex >= 0 && state.cases[state.activeCaseIndex]) {
        return state.cases[state.activeCaseIndex].name;
      }
      return state.chain.length ? state.chain[0].name : '表';
    }

    function renderCaseChips() {
      const fragment = document.createDocumentFragment();
      state.cases.forEach((item, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'case-chip';
        button.classList.toggle('is-active', index === state.activeCaseIndex);
        button.setAttribute('aria-pressed', index === state.activeCaseIndex ? 'true' : 'false');
        button.textContent = item.name;
        button.title = item.name + ' = ' + item.expression;
        button.addEventListener('click', () => loadCase(index));
        fragment.appendChild(button);
      });
      dom.caseChips.replaceChildren(fragment);
      updateCaseTools();
    }

    function updateCaseTools() {
      dom.buildCaseBtn.disabled = !state.graph;
      dom.compareCasesBtn.disabled = state.cases.length < 2;
    }

    function startBuild() {
      if (!state.graph) return;
      stopPlayback();
      clearError();

      const active = state.activeCaseIndex >= 0 ? state.cases[state.activeCaseIndex] : null;
      if (active) {
        const draftName = dom.caseNameInput.value.trim();
        const draftExpr = dom.exprInput.value.trim();
        if (draftName !== active.name || draftExpr !== active.expression) {
          showError('请先保存当前案例，再播放创建过程。');
          return;
        }
      }

      // 创建演示从当前案例的初始状态开始，不沿用之前的函数链。
      if (state.chain.length > 1) {
        state.chain = state.chain.slice(0, 1);
        state.subject = state.chain[0].subject;
      }

      hideCompareView();
      const created = state.storage === 'headtail'
        ? createHTBuildRun(state.htGraph)
        : createBuildRun(state.graph);
      state.operation = state.storage === 'headtail' ? 'ht-build' : 'build';
      state.run = created.run;
      state.stepIndex = 0;

      renderCodeBlock(state.storage === 'headtail' ? 'htBuild' : 'build');
      renderChainTrail();
      updateFunctionButtons();
      updateCaseTools();
      showStep(0);
      updatePlaybackUI();

      state.playing = true;
      updatePlaybackUI();
      scheduleNextStep();
    }

    function renderChainTrail() {
      const fragment = document.createDocumentFragment();

      state.chain.forEach((entry, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chain-node';
        button.classList.toggle('is-current', index === state.chain.length - 1);
        button.title = entry.label + ' = ' + entry.valueText;

        const opEl = document.createElement('span');
        opEl.className = 'chain-node__op';
        opEl.textContent = entry.kind === 'base'
          ? entry.name
          : (OPERATION_BY_KEY[entry.op] ? OPERATION_BY_KEY[entry.op].label : entry.op);

        const equalEl = document.createElement('span');
        equalEl.className = 'chain-node__eq';
        equalEl.textContent = '=';

        const valueEl = document.createElement('span');
        valueEl.className = 'chain-node__value';
        valueEl.textContent = entry.valueText;

        button.appendChild(opEl);
        button.appendChild(equalEl);
        button.appendChild(valueEl);
        button.setAttribute('aria-label', entry.label + ' 的返回值：' + entry.valueText);
        button.addEventListener('click', () => restoreChain(index));
        fragment.appendChild(button);

        if (index < state.chain.length - 1) {
          const arrow = document.createElement('span');
          arrow.className = 'chain-arrow';
          arrow.textContent = '→';
          fragment.appendChild(arrow);
        }
      });

      if (!state.chain.length) {
        const empty = document.createElement('span');
        empty.className = 'chain-empty';
        empty.textContent = '保存或选择一个案例后开始。';
        fragment.appendChild(empty);
      }

      dom.chainTrail.replaceChildren(fragment);
      dom.chainTrail.scrollLeft = dom.chainTrail.scrollWidth;
      renderChainExpression();
    }

    function renderChainExpression() {
      const fragment = document.createDocumentFragment();
      const subject = state.subject;

      const label = document.createElement('span');
      label.className = 'chain-expression__label';
      label.textContent = '当前对象';

      const value = document.createElement('code');
      value.className = 'chain-expression__value';
      value.textContent = subject ? subject.exprLabel : '—';

      fragment.appendChild(label);
      fragment.appendChild(value);

      if (subject) {
        let hintText = '';
        if (subject.kind === 'list') {
          hintText = '· 可继续 GetHead / GetTail';
        } else if (subject.kind === 'atom') {
          hintText = '· 已取得原子 ' + subject.valueText;
        } else if (subject.kind === 'undefined') {
          hintText = '· 空表没有表头';
        } else if (subject.kind === 'number') {
          hintText = '· 数值结果 ' + subject.valueText;
        }
        if (hintText) {
          const hint = document.createElement('span');
          hint.className = 'chain-expression__hint';
          hint.textContent = hintText;
          fragment.appendChild(hint);
        }
      }

      dom.chainExpression.replaceChildren(fragment);
      dom.chainExpression.title = subject ? subject.exprLabel + ' = ' + subject.valueText : '';
    }

    function updateFunctionButtons() {
      const canUseList = !!state.subject && state.subject.kind === 'list' && !!state.graph;
      dom.functionButtons.querySelectorAll('.fn-btn').forEach((button) => {
        button.disabled = !canUseList;
      });
      dom.undoChainBtn.disabled = state.chain.length <= 1;
      dom.resetChainBtn.disabled = state.chain.length <= 1;
    }

    const THEME_STORAGE_KEY = 'glist-theme';

    function currentTheme() {
      return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    }

    function applyTheme(theme, persist) {
      const dark = theme === 'dark';
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      if (dom.themeToggle) {
        dom.themeToggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
        dom.themeToggle.title = dark ? '切换到浅色模式' : '切换到深色模式';
        const label = dom.themeToggle.querySelector('.theme-toggle__label');
        if (label) label.textContent = dark ? '浅色' : '深色';
      }
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#0a1120' : '#eef3f8');
      if (persist) {
        try {
          localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light');
        } catch (_) {
          /* localStorage may be unavailable for local files */
        }
      }
    }

    function updateStorageUI() {
      const isHT = state.storage === 'headtail';
      dom.storageBtns.forEach((button) => {
        const active = button.dataset.storage === state.storage;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      dom.linearLegend.hidden = isHT;
      dom.htLegend.hidden = !isHT;
    }

    function setStorage(nextStorage) {
      if (nextStorage !== 'linear' && nextStorage !== 'headtail') return;
      if (state.storage === nextStorage) return;
      stopPlayback();
      closeCompareModal();
      clearError();
      state.storage = nextStorage;
      updateStorageUI();

      if (!state.graph || !state.htGraph) return;
      if (state.chain.length > 1) state.chain = state.chain.slice(0, 1);
      state.subject = state.chain.length ? state.chain[0].subject : createBaseSubject(state.graph, currentCaseName());
      showBaseView();
      setCaseFeedback(nextStorage === 'headtail' ? '已切换为头尾链表存储' : '已切换为扩展线性链表存储', false);
    }

    function codeKeyFor(operation) {
      if (state.storage === 'headtail') return HT_OPERATION_BLOCKS[operation] || operation;
      return operation;
    }

    function showBaseView() {
      if (!state.graph || !state.subject) return;
      stopPlayback();
      state.operation = null;
      state.run = state.storage === 'headtail' && state.htGraph
        ? createHTBaseView(state.graph, state.htGraph, state.subject)
        : createBaseView(state.graph, state.subject, currentCaseName());
      state.stepIndex = 0;
      renderBaseCodeState();
      showStep(0);
      renderChainTrail();
      updateFunctionButtons();
    }

    function loadCase(index) {
      const item = state.cases[index];
      if (!item) return;
      clearError();
      stopPlayback();

      let graph;
      try {
        graph = parseExpression(item.expression, { name: item.name }).graph;
      } catch (err) {
        showError('案例载入失败：' + describeError(err));
        return;
      }

      state.activeCaseIndex = index;
      state.linearGraph = graph;
      state.graph = graph;
      state.htGraph = buildHTGraph(graph);
      state.subject = createBaseSubject(graph, item.name);
      state.chain = [{
        kind: 'base',
        name: item.name,
        label: item.name,
        valueText: state.subject.valueText,
        subject: state.subject
      }];

      dom.caseNameInput.value = item.name;
      dom.exprInput.value = serializeGraph(graph);
      setCaseFeedback('');
      renderCaseChips();
      showBaseView();
    }

    function saveCase(event) {
      if (event) event.preventDefault();
      clearError();
      setCaseFeedback('');

      const name = dom.caseNameInput.value.trim();
      const expression = dom.exprInput.value.trim();

      if (!name) {
        showError('案例名不能为空。', dom.caseNameInput);
        return;
      }
      if (name.length > 12 || !/^[A-Za-z_\u4e00-\u9fa5][A-Za-z0-9_\u4e00-\u9fa5-]{0,11}$/.test(name)) {
        showError('案例名需以字母、下划线或中文开头，最多 12 个字符。', dom.caseNameInput);
        return;
      }

      let graph;
      try {
        graph = parseExpression(expression, { name }).graph;
      } catch (err) {
        showError('案例 ' + name + ' 保存失败：' + describeError(err));
        return;
      }

      const canonical = serializeGraph(graph);
      let index = state.cases.findIndex((item) => item.name === name);
      const updated = index >= 0;
      if (index < 0) {
        state.cases.push({ name, expression: canonical });
        index = state.cases.length - 1;
      } else {
        state.cases[index].expression = canonical;
      }

      loadCase(index);
      setCaseFeedback(updated ? '已更新 ' + name + ' = ' + canonical : '已保存 ' + name + ' = ' + canonical, false);
    }

    function restoreChain(index) {
      if (index < 0 || index >= state.chain.length) return;
      stopPlayback();
      state.chain = state.chain.slice(0, index + 1);
      const entry = state.chain[state.chain.length - 1];
      state.subject = entry.subject;
      showBaseView();
    }

    function applyOperation(operation) {
      if (!state.graph || !state.subject || state.subject.kind !== 'list') return;
      stopPlayback();
      clearError();

      try {
        const created = state.storage === 'headtail'
          ? createHTOperationRun(state.graph, state.htGraph, state.subject, operation)
          : createOperationRun(state.graph, operation, state.subject);
        state.operation = operation;
        state.run = created.run;
        state.stepIndex = 0;

        state.chain.push({
          kind: 'op',
          op: operation,
          label: created.outcome.label,
          valueText: created.outcome.resultText,
          subject: created.outcome.subject
        });
        state.subject = created.outcome.subject;

        renderCodeBlock(codeKeyFor(operation));
        renderChainTrail();
        updateFunctionButtons();
        showStep(0);
        updatePlaybackUI();

        state.playing = true;
        updatePlaybackUI();
        scheduleNextStep();
      } catch (err) {
        showError('操作失败：' + describeError(err));
      }
    }

    function undoChain() {
      if (state.chain.length <= 1) return;
      restoreChain(state.chain.length - 2);
    }

    function resetChain() {
      if (state.chain.length <= 1) return;
      restoreChain(0);
    }

    function loadAdHocCase(expression, label) {
      clearError();
      stopPlayback();
      let graph;
      try {
        graph = parseExpression(expression, { name: label }).graph;
      } catch (err) {
        showError('题库示例载入失败：' + describeError(err));
        return false;
      }

      state.activeCaseIndex = -1;
      state.linearGraph = graph;
      state.graph = graph;
      state.htGraph = buildHTGraph(graph);
      state.subject = createBaseSubject(graph, label);
      state.chain = [{
        kind: 'base',
        name: label,
        label,
        valueText: state.subject.valueText,
        subject: state.subject
      }];
      dom.caseNameInput.value = label;
      dom.exprInput.value = serializeGraph(graph);
      setCaseFeedback('已从经典题库载入示例 ' + label, false);
      renderCaseChips();
      showBaseView();
      return true;
    }

    /* -------- 判等选择与判等播放 -------- */

    function fillCompareSelect(select, selectedIndex) {
      const fragment = document.createDocumentFragment();
      state.cases.forEach((item, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = `${item.name} · ${item.expression}`;
        fragment.appendChild(option);
      });
      select.replaceChildren(fragment);
      select.value = String(selectedIndex);
    }

    function updateCompareHint() {
      const a = state.cases[Number(dom.compareSelectA.value)];
      const b = state.cases[Number(dom.compareSelectB.value)];
      if (!a || !b) {
        dom.compareHint.textContent = '请选择两个案例。';
        dom.compareStartBtn.disabled = true;
        return;
      }
      const storageLabel = state.storage === 'headtail' ? '头尾链表' : '扩展线性';
      dom.compareHint.textContent = `${storageLabel}：${a.name} = ${a.expression}   ↔   ${b.name} = ${b.expression}`;
      dom.compareStartBtn.disabled = false;
    }

    function openCompareModal() {
      if (state.cases.length < 2) {
        showError('至少需要两个已命名案例才能判等。');
        return;
      }
      stopPlayback();
      updatePlaybackUI();
      state.compareReturnFocus = document.activeElement;

      const left = state.activeCaseIndex >= 0 ? state.activeCaseIndex : 0;
      const right = left + 1 < state.cases.length ? left + 1 : (left === 0 ? 0 : 0);
      fillCompareSelect(dom.compareSelectA, left);
      fillCompareSelect(dom.compareSelectB, right);
      updateCompareHint();
      dom.compareModal.hidden = false;
      dom.compareSelectA.focus();
    }

    function closeCompareModal() {
      if (dom.compareModal.hidden) return;
      dom.compareModal.hidden = true;
      const target = state.compareReturnFocus;
      state.compareReturnFocus = null;
      if (target && typeof target.focus === 'function') target.focus();
    }

    function startComparison() {
      const a = state.cases[Number(dom.compareSelectA.value)];
      const b = state.cases[Number(dom.compareSelectB.value)];
      if (!a || !b) return;

      let graphA;
      let graphB;
      let htA;
      let htB;
      try {
        graphA = parseExpression(a.expression, { name: a.name }).graph;
        graphB = parseExpression(b.expression, { name: b.name }).graph;
        htA = buildHTGraph(graphA);
        htB = buildHTGraph(graphB);
      } catch (err) {
        showError('判等案例解析失败：' + describeError(err));
        return;
      }

      const created = state.storage === 'headtail'
        ? createHTCompareRun(graphA, graphB, htA, htB, a.name, b.name)
        : createCompareRun(graphA, graphB, a.name, b.name);
      closeCompareModal();
      stopPlayback();
      clearError();
      state.operation = state.storage === 'headtail' ? 'ht-equal' : 'equal';
      state.run = created.run;
      state.stepIndex = 0;
      clearCompareStage();
      hideCompareView();
      renderCodeBlock(state.storage === 'headtail' ? 'htEqual' : 'equal');
      updateCaseTools();
      showStep(0);
      updatePlaybackUI();

      state.playing = true;
      updatePlaybackUI();
      scheduleNextStep();
    }

    function exitCompareToActive() {
      if (!state.run || !state.run.compare) return;
      if (state.activeCaseIndex >= 0) {
        loadCase(state.activeCaseIndex);
      } else {
        showBaseView();
      }
    }

    /* -------- 经典题库 -------- */

    function quizCount(category) {
      if (category === '全部') return STUDY_QUESTIONS.length;
      return STUDY_QUESTIONS.filter((item) => item.category === category).length;
    }

    function renderQuizTabs() {
      const fragment = document.createDocumentFragment();
      QUIZ_CATEGORIES.forEach((category) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quiz-tab';
        button.classList.toggle('is-active', state.quizCategory === category);
        button.setAttribute('aria-pressed', state.quizCategory === category ? 'true' : 'false');
        button.textContent = `${category} ${quizCount(category)}`;
        button.addEventListener('click', () => {
          state.quizCategory = category;
          renderQuizTabs();
          renderQuizCards();
        });
        fragment.appendChild(button);
      });
      dom.quizCategories.replaceChildren(fragment);
    }

    function renderQuizCards() {
      const questions = state.quizCategory === '全部'
        ? STUDY_QUESTIONS
        : STUDY_QUESTIONS.filter((item) => item.category === state.quizCategory);

      const fragment = document.createDocumentFragment();

      if (!questions.length) {
        const empty = document.createElement('p');
        empty.className = 'quiz-empty';
        empty.textContent = '这个分类暂时没有题目。';
        fragment.appendChild(empty);
      }

      questions.forEach((question, index) => {
        const card = document.createElement('article');
        card.className = 'quiz-card';

        const head = document.createElement('div');
        head.className = 'quiz-card-head';

        const tag = document.createElement('span');
        tag.className = 'quiz-tag';
        tag.textContent = question.category;

        const indexEl = document.createElement('span');
        indexEl.className = 'quiz-index';
        indexEl.textContent = `Q${String(index + 1).padStart(2, '0')} · ${question.topic}`;

        const title = document.createElement('h3');
        title.textContent = question.title;

        head.appendChild(tag);
        head.appendChild(indexEl);
        head.appendChild(title);

        const questionEl = document.createElement('p');
        questionEl.className = 'quiz-question';
        questionEl.textContent = question.question;

        const actions = document.createElement('div');
        actions.className = 'quiz-actions';

        const answerBox = document.createElement('div');
        answerBox.className = 'quiz-answer';
        answerBox.hidden = true;

        const answerBlock = document.createElement('p');
        answerBlock.className = 'quiz-answer__block';
        const answerLabel = document.createElement('span');
        answerLabel.className = 'quiz-answer__label';
        answerLabel.textContent = '答案';
        answerBlock.appendChild(answerLabel);
        answerBlock.appendChild(document.createTextNode(question.answer || ''));
        answerBox.appendChild(answerBlock);

        if (question.code) {
          const code = document.createElement('pre');
          code.className = 'quiz-code';
          code.textContent = question.code;
          answerBox.appendChild(code);
        }

        if (question.note) {
          const note = document.createElement('p');
          note.className = 'quiz-answer__block quiz-answer__note';
          const noteLabel = document.createElement('span');
          noteLabel.className = 'quiz-answer__label';
          noteLabel.textContent = '解析';
          note.appendChild(noteLabel);
          note.appendChild(document.createTextNode(question.note));
          answerBox.appendChild(note);
        }

        const revealBtn = document.createElement('button');
        revealBtn.type = 'button';
        revealBtn.className = 'quiz-action quiz-action--answer';
        revealBtn.textContent = '展开答案';
        revealBtn.setAttribute('aria-expanded', 'false');
        revealBtn.addEventListener('click', () => {
          const opening = answerBox.hidden;
          answerBox.hidden = !opening;
          revealBtn.textContent = opening ? '收起答案' : '展开答案';
          revealBtn.setAttribute('aria-expanded', opening ? 'true' : 'false');
        });
        actions.appendChild(revealBtn);

        (question.demos || []).forEach((demo) => {
          const demoBtn = document.createElement('button');
          demoBtn.type = 'button';
          demoBtn.className = 'quiz-action';
          demoBtn.textContent = `▶ ${demo.label}`;
          demoBtn.addEventListener('click', () => {
            applyQuizDemo(demo);
          });
          actions.appendChild(demoBtn);
        });

        card.appendChild(head);
        card.appendChild(questionEl);
        card.appendChild(actions);
        card.appendChild(answerBox);
        fragment.appendChild(card);
      });

      dom.quizList.replaceChildren(fragment);
    }

    function openQuiz() {
      stopPlayback();
      updatePlaybackUI();
      state.quizReturnFocus = document.activeElement;
      state.quizCategory = '全部';
      renderQuizTabs();
      renderQuizCards();
      dom.quizModal.hidden = false;
      dom.quizCloseBtn.focus();
    }

    function closeQuiz() {
      if (dom.quizModal.hidden) return;
      dom.quizModal.hidden = true;
      const target = state.quizReturnFocus;
      state.quizReturnFocus = null;
      if (target && typeof target.focus === 'function') {
        target.focus();
      }
    }

    function applyQuizDemo(demo) {
      closeQuiz();
      const loaded = loadAdHocCase(demo.expression, '例题');
      if (loaded && OPERATION_BY_KEY[demo.operation]) {
        applyOperation(demo.operation);
      }
    }

    /* -------- 错误提示 -------- */

    function showError(message, field) {
      dom.errorBanner.textContent = message;
      dom.errorBanner.hidden = false;
      const target = field || dom.exprInput;
      target.setAttribute('aria-invalid', 'true');
    }

    function clearError() {
      dom.errorBanner.hidden = true;
      dom.errorBanner.textContent = '';
      dom.exprInput.removeAttribute('aria-invalid');
      dom.caseNameInput.removeAttribute('aria-invalid');
    }

    /* -------- 节点图渲染 -------- */

    function createNodeElement(node) {
      const el = document.createElement('div');
      el.className = 'gl-node';
      el.dataset.nodeId = node.id;

      const idEl = document.createElement('span');
      idEl.className = 'node-id';

      const mainEl = document.createElement('span');
      mainEl.className = 'node-main';

      const tagEl = document.createElement('span');
      tagEl.className = 'node-tag';

      const childRefEl = document.createElement('span');
      childRefEl.className = 'node-child-ref';
      childRefEl.hidden = true;

      const badgeEl = document.createElement('span');
      badgeEl.className = 'node-badge';
      badgeEl.hidden = true;

      el.appendChild(idEl);
      el.appendChild(mainEl);
      el.appendChild(tagEl);
      el.appendChild(childRefEl);
      el.appendChild(badgeEl);

      dom.nodeLayer.appendChild(el);
      nodeEls.set(node.id, el);
      el.classList.add('is-new');
      window.setTimeout(() => {
        el.classList.remove('is-new');
      }, 260);
      return el;
    }

    function clearDiagram() {
      nodeEls.forEach((el) => el.remove());
      nodeEls.clear();
      edgeEls.forEach((group) => group.remove());
      edgeEls.clear();
      dom.layerLayer.replaceChildren();
      dom.canvasEmpty.hidden = false;
      dom.laneLabel.hidden = true;
      dom.canvasMetric.hidden = true;
      dom.canvasMetric.textContent = '';
      dom.diagramSummary.textContent = '尚未生成';
      dom.diagramStage.style.transform = '';
    }

    function createCompareNode(node) {
      const el = document.createElement('div');
      el.className = 'gl-node cmp-node';
      el.dataset.nodeId = node.id;

      const idEl = document.createElement('span');
      idEl.className = 'node-id';
      idEl.textContent = node.root ? 'L' : node.id;

      const mainEl = document.createElement('span');
      mainEl.className = 'node-main';

      const tagEl = document.createElement('span');
      tagEl.className = 'node-tag';

      if (node.root || node.tag === ROOT) {
        el.classList.add('gl-node--root');
        mainEl.textContent = node.name || 'GList';
        tagEl.textContent = 'GList';
      } else if (node.tag === ATOM) {
        el.classList.add('gl-node--atom');
        mainEl.textContent = node.value == null ? '?' : node.value;
        tagEl.textContent = 'element';
      } else {
        el.classList.add('gl-node--list');
        mainEl.textContent = '子表';
        tagEl.textContent = 'sublist';
      }

      el.appendChild(idEl);
      el.appendChild(mainEl);
      el.appendChild(tagEl);
      return el;
    }

    function renderCompareGraph(panelKey, graph, layout) {
      const isA = panelKey === 'a';
      const nodeLayer = isA ? dom.compareNodeLayerA : dom.compareNodeLayerB;
      const edgeLayer = isA ? dom.compareEdgeLayerA : dom.compareEdgeLayerB;
      const stage = isA ? dom.compareStageA : dom.compareStageB;
      const nodeMap = compareNodeEls[panelKey];

      nodeMap.clear();
      compareEdgeEls[panelKey].clear();
      nodeLayer.replaceChildren();
      edgeLayer.replaceChildren();

      stage.style.width = `${layout.width}px`;
      stage.style.height = `${layout.height}px`;
      edgeLayer.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);

      const svgNs = 'http://www.w3.org/2000/svg';
      const defs = document.createElementNS(svgNs, 'defs');
      ['root', 'child', 'next'].forEach((type) => {
        const marker = document.createElementNS(svgNs, 'marker');
        marker.setAttribute('id', `cmp-arrow-${panelKey}-${type}`);
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '8');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('orient', 'auto-start-reverse');
        const path = document.createElementNS(svgNs, 'path');
        path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        path.setAttribute('class', `edge-marker edge-marker--${type}`);
        marker.appendChild(path);
        defs.appendChild(marker);
      });
      edgeLayer.appendChild(defs);

      Object.keys(graph.nodes).forEach((id) => {
        const node = graph.nodes[id];
        const pos = layout.positions[id];
        if (!pos) return;
        const el = createCompareNode(node);
        el.style.left = `${pos.x - pos.w / 2}px`;
        el.style.top = `${pos.y - pos.h / 2}px`;
        el.style.width = `${pos.w}px`;
        el.style.height = `${pos.h}px`;
        el.title = node.root ? node.name : (node.tag === ATOM ? `element ${node.value}` : 'sublist');
        nodeLayer.appendChild(el);
        nodeMap.set(id, el);
      });

      Object.keys(graph.nodes).forEach((id) => {
        const node = graph.nodes[id];
        const fromPos = layout.positions[id];
        if (!fromPos) return;
        if (node.child && graph.nodes[node.child]) {
          const edgeType = (node.root || node.tag === ROOT) ? 'root' : 'child';
          const path = document.createElementNS(svgNs, 'path');
          const geometry = measureEdgePath(fromPos, layout.positions[node.child], 'child');
          path.setAttribute('d', geometry.d);
          path.setAttribute('class', `cmp-edge cmp-edge--${edgeType}`);
          path.setAttribute('marker-end', `url(#cmp-arrow-${panelKey}-${edgeType})`);
          edgeLayer.appendChild(path);
          compareEdgeEls[panelKey].set(`${id}.child`, path);
        }
        if (node.next && graph.nodes[node.next]) {
          const path = document.createElementNS(svgNs, 'path');
          const geometry = measureEdgePath(fromPos, layout.positions[node.next], 'next');
          path.setAttribute('d', geometry.d);
          path.setAttribute('class', 'cmp-edge cmp-edge--next');
          path.setAttribute('marker-end', `url(#cmp-arrow-${panelKey}-next)`);
          edgeLayer.appendChild(path);
          compareEdgeEls[panelKey].set(`${id}.next`, path);
        }
      });
    }

    function buildCompareStage(run) {
      compareNodeEls.a.clear();
      compareNodeEls.b.clear();
      compareEdgeEls.a.clear();
      compareEdgeEls.b.clear();
      dom.compareCanvas.classList.remove('is-equal', 'is-different');
      dom.compareNameA.textContent = run.nameA;
      dom.compareNameB.textContent = run.nameB;
      dom.compareValueA.textContent = serializeGraph(run.graphA);
      dom.compareValueB.textContent = serializeGraph(run.graphB);
      dom.compareValueA.title = serializeGraph(run.graphA);
      dom.compareValueB.title = serializeGraph(run.graphB);
      renderCompareGraph('a', run.graphA, run.layoutA);
      renderCompareGraph('b', run.graphB, run.layoutB);
      compareRunRef = run;
    }

    function compareNodeDescription(graph, id) {
      if (!id) return 'NULL';
      const node = graph.nodes[id];
      if (!node) return id;
      return node.tag === ATOM
        ? `${id} · element ${node.value}`
        : `${id} · sublist`;
    }

    function renderComparison(step) {
      const run = state.run;
      if (!run || !run.compare) return;

      dom.diagramStage.hidden = true;
      dom.htCanvas.hidden = true;
      dom.compareCanvas.hidden = false;
      dom.canvasMetric.hidden = true;
      dom.laneLabel.hidden = true;
      dom.layerLayer.replaceChildren();
      dom.canvasEmpty.hidden = true;

      if (compareRunRef !== run) {
        buildCompareStage(run);
      }

      ['a', 'b'].forEach((key) => {
        compareNodeEls[key].forEach((el) => {
          el.classList.remove('is-active');
          el.classList.remove('is-mismatch');
        });
      });

      const pair = step.compare || { a: null, b: null };
      if (pair.a && compareNodeEls.a.has(pair.a)) {
        const el = compareNodeEls.a.get(pair.a);
        el.classList.add('is-active');
        if (pair.mismatch) el.classList.add('is-mismatch');
      }
      if (pair.b && compareNodeEls.b.has(pair.b)) {
        const el = compareNodeEls.b.get(pair.b);
        el.classList.add('is-active');
        if (pair.mismatch) el.classList.add('is-mismatch');
      }

      dom.compareTitle.textContent = `${run.nameA} ↔ ${run.nameB}`;
      dom.compareCurrent.textContent =
        `${run.nameA}：${compareNodeDescription(run.graphA, pair.a)}   ↔   ${run.nameB}：${compareNodeDescription(run.graphB, pair.b)}` +
        (step.result && step.result !== '继续' ? ` · ${step.result}` : '');
      dom.compareCurrent.title = dom.compareCurrent.textContent;
      dom.diagramSummary.textContent = `判等 · ${run.nameA} ↔ ${run.nameB}`;

      const isFinal = state.stepIndex >= run.total - 1;
      dom.compareCanvas.classList.toggle('is-equal', isFinal && !!run.equal);
      dom.compareCanvas.classList.toggle('is-different', isFinal && !run.equal);

      requestAnimationFrame(fitCompare);
    }

    function fitComparePanel(viewport, stage, layout) {
      if (!viewport || !stage || !layout) return;
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (!width || !height) return;
      const padding = 10;
      const scale = Math.max(0.12, Math.min(
        1.15,
        (width - padding * 2) / layout.width,
        (height - padding * 2) / layout.height
      ));
      const offsetX = Math.max(padding, (width - layout.width * scale) / 2);
      const offsetY = Math.max(padding, (height - layout.height * scale) / 2);
      stage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    }

    function fitCompare() {
      if (!state.run || !state.run.compare) return;
      fitComparePanel(dom.compareViewportA, dom.compareStageA, state.run.layoutA);
      fitComparePanel(dom.compareViewportB, dom.compareStageB, state.run.layoutB);
    }

    function hideCompareView() {
      dom.compareCanvas.hidden = true;
      dom.diagramStage.hidden = false;
      dom.compareCanvas.classList.remove('is-equal', 'is-different');
    }

    function clearCompareStage() {
      ['a', 'b'].forEach((key) => {
        compareNodeEls[key].forEach((el) => el.remove());
        compareNodeEls[key].clear();
        compareEdgeEls[key].forEach((el) => el.remove());
        compareEdgeEls[key].clear();
      });
      dom.compareNodeLayerA.replaceChildren();
      dom.compareNodeLayerB.replaceChildren();
      dom.compareEdgeLayerA.replaceChildren();
      dom.compareEdgeLayerB.replaceChildren();
      ['a', 'b'].forEach((key) => {
        htCompareNodeEls[key].forEach((el) => el.remove());
        htCompareNodeEls[key].clear();
        htCompareEdgeEls[key].forEach((el) => el.remove());
        htCompareEdgeEls[key].clear();
      });
      compareRunRef = null;
      htCompareRunRef = null;
    }

    function createHTNodeElement(node) {
      const el = document.createElement('div');
      el.className = 'ht-node';
      el.dataset.nodeId = node.id;

      const nodeId = document.createElement('span');
      nodeId.className = 'ht-node__id';
      nodeId.textContent = node.root ? 'L' : node.id;

      const main = document.createElement('span');
      main.className = 'ht-node__main';

      const tag = document.createElement('span');
      tag.className = 'ht-node__tag';

      if (node.root || node.tag === ROOT) {
        el.classList.add('ht-node--root');
        main.textContent = node.name || 'GList';
        tag.textContent = 'GList';
      } else if (node.tag === ATOM) {
        el.classList.add('ht-node--atom');
        main.textContent = node.value == null ? '?' : node.value;
        tag.textContent = 'ATOM';
      } else {
        el.classList.add('ht-node--list');
        main.textContent = 'LIST';
        tag.textContent = node.hp ? 'hp · tp' : 'hp=NULL';
      }

      const badge = document.createElement('span');
      badge.className = 'ht-node__badge';
      badge.hidden = true;

      el.appendChild(nodeId);
      el.appendChild(main);
      el.appendChild(tag);
      el.appendChild(badge);
      return el;
    }

    function drawHTGraph(ht, layout, nodeLayer, edgeLayer, nodeMap, edgeMap, options) {
      const opts = options || {};
      const visible = opts.visibleIds || null;
      const highlight = new Set(opts.highlightNodeIds || []);
      const hotPointers = new Set(opts.highlightPointers || []);
      const badges = opts.badges || null;
      const prefix = opts.prefix || 'single';

      nodeLayer.replaceChildren();
      edgeLayer.replaceChildren();
      nodeMap.clear();
      edgeMap.clear();

      const svgNs = 'http://www.w3.org/2000/svg';
      const defs = document.createElementNS(svgNs, 'defs');
      ['root', 'hp', 'tp'].forEach((type) => {
        const marker = document.createElementNS(svgNs, 'marker');
        marker.setAttribute('id', `ht-arrow-${prefix}-${type}`);
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '8');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('orient', 'auto-start-reverse');
        const path = document.createElementNS(svgNs, 'path');
        path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        path.setAttribute('class', `ht-marker ht-marker--${type}`);
        marker.appendChild(path);
        defs.appendChild(marker);
      });
      edgeLayer.appendChild(defs);

      Object.keys(ht.nodes).forEach((id) => {
        if (visible && !visible.has(id)) return;
        const node = ht.nodes[id];
        const pos = layout.positions[id];
        if (!pos) return;
        const el = createHTNodeElement(node);
        el.style.left = `${pos.x - pos.w / 2}px`;
        el.style.top = `${pos.y - pos.h / 2}px`;
        el.style.width = `${pos.w}px`;
        el.style.height = `${pos.h}px`;
        el.classList.toggle('is-active', highlight.has(id));
        if (opts.returnedNodeId === id) el.classList.add('is-returned');
        const badgeText = badges && badges[id];
        if (badgeText) {
          const badge = el.querySelector('.ht-node__badge');
          badge.hidden = false;
          badge.textContent = badgeText;
        }
        nodeLayer.appendChild(el);
        nodeMap.set(id, el);
      });

      function addEdge(fromId, toId, type) {
        if (!nodeMap.has(fromId) || !nodeMap.has(toId)) return;
        const fromPos = layout.positions[fromId];
        const toPos = layout.positions[toId];
        if (!fromPos || !toPos) return;
        const key = `${fromId}.${type === 'tp' ? 'tp' : 'hp'}`;
        const geometry = measureEdgePath(fromPos, toPos, type === 'tp' ? 'next' : 'child');
        const group = document.createElementNS(svgNs, 'g');
        group.setAttribute('class', 'ht-edge-group');
        const path = document.createElementNS(svgNs, 'path');
        path.setAttribute('class', `ht-edge ht-edge--${type}${hotPointers.has(key) ? ' is-hot' : ''}`);
        path.setAttribute('d', geometry.d);
        path.setAttribute('marker-end', `url(#ht-arrow-${prefix}-${type})`);
        group.appendChild(path);

        const labelText = type === 'tp' ? 'tp' : (type === 'hp' ? 'hp' : 'GList');
        const labelWidth = type === 'tp' ? 20 : (type === 'hp' ? 22 : 36);
        const bg = document.createElementNS(svgNs, 'rect');
        bg.setAttribute('class', 'ht-edge-label-bg');
        bg.setAttribute('x', String(geometry.labelX - labelWidth / 2));
        bg.setAttribute('y', String(geometry.labelY - 7));
        bg.setAttribute('width', String(labelWidth));
        bg.setAttribute('height', '11');
        bg.setAttribute('rx', '3');
        const text = document.createElementNS(svgNs, 'text');
        text.setAttribute('class', `ht-edge-label ht-edge-label--${type}`);
        text.setAttribute('x', String(geometry.labelX));
        text.setAttribute('y', String(geometry.labelY + 2));
        text.setAttribute('text-anchor', 'middle');
        text.textContent = labelText;
        group.appendChild(bg);
        group.appendChild(text);
        edgeLayer.appendChild(group);
        edgeMap.set(key, group);
      }

      const root = ht.nodes[ht.rootId];
      if (root && root.hp) addEdge(root.id, root.hp, 'root');
      Object.keys(ht.nodes).forEach((id) => {
        if (visible && !visible.has(id)) return;
        const node = ht.nodes[id];
        if (node.tag !== LIST) return;
        if (node.hp) addEdge(id, node.hp, 'hp');
        if (node.tp) addEdge(id, node.tp, 'tp');
      });
    }

    function fitHTStage() {
      if (!state.run || state.storage !== 'headtail' || !dom.htStage) return;
      const layout = state.run.layout;
      if (!layout) return;
      const viewportWidth = dom.diagramViewport.clientWidth;
      const viewportHeight = dom.diagramViewport.clientHeight;
      if (!viewportWidth || !viewportHeight) return;
      const padding = 18;
      const scale = Math.max(0.12, Math.min(
        1.25,
        (viewportWidth - padding * 2) / layout.width,
        (viewportHeight - padding * 2) / layout.height
      ));
      const offsetX = Math.max(padding, (viewportWidth - layout.width * scale) / 2);
      const offsetY = Math.max(padding, (viewportHeight - layout.height * scale) / 2);
      dom.htStage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    }

    function renderHTDiagram(step) {
      const run = state.run;
      if (!run || !run.htGraph || !run.layout) return;
      const ht = run.htGraph;
      const visible = new Set((step.htNodes || []).map((node) => node.id));

      dom.diagramStage.hidden = true;
      dom.compareCanvas.hidden = true;
      dom.htCanvas.hidden = false;
      dom.layerLayer.replaceChildren();
      dom.laneLabel.hidden = true;
      dom.canvasEmpty.hidden = true;

      drawHTGraph(ht, run.layout, dom.htNodeLayer, dom.htEdgeLayer, htNodeEls, htEdgeEls, {
        visibleIds: visible,
        highlightNodeIds: step.htHighlightNodeIds,
        highlightPointers: step.htHighlightPointers,
        badges: step.htBadges,
        returnedNodeId: step.htReturnedNodeId,
        prefix: 'single'
      });

      dom.htStage.style.width = `${run.layout.width}px`;
      dom.htStage.style.height = `${run.layout.height}px`;

      const nodes = step.htNodes || [];
      const listCount = nodes.filter((node) => node.tag === LIST).length;
      const atomCount = nodes.filter((node) => node.tag === ATOM).length;
      dom.diagramSummary.textContent = `${run.htGraph.name || '表'}（GList） · ${listCount} 个 LIST · ${atomCount} 个 ATOM`;

      const vars = step.variables || {};
      let metric = '';
      if (run.operation === 'ht-build' && vars['已建'] != null) metric = `已建 ${vars['已建']} 个结点`;
      else if (run.operation === 'length' && vars.len != null) metric = `len = ${vars.len}`;
      else if (run.operation === 'depth') {
        const parts = [];
        if (vars.d != null) parts.push(`d = ${vars.d}`);
        if (vars.max != null) parts.push(`max = ${vars.max}`);
        if (parts.length) metric = parts.join(' · ');
      }
      dom.canvasMetric.hidden = !metric;
      dom.canvasMetric.textContent = metric;
      dom.canvasMetric.classList.toggle('is-depth', run.operation === 'depth');

      requestAnimationFrame(fitHTStage);
    }

    function hideHTView() {
      dom.htCanvas.hidden = true;
    }

    function htCompareSummary(ht, listId, hpId) {
      if (!listId) return 'NULL';
      const head = hpId && ht.nodes[hpId] ? (ht.nodes[hpId].tag === ATOM ? `atom ${ht.nodes[hpId].value}` : 'sublist') : 'hp=NULL';
      return `${listId} · ${head}`;
    }

    function renderHTComparison(step) {
      const run = state.run;
      if (!run || !run.compare || !run.htGraphA || !run.htGraphB) return;
      dom.diagramStage.hidden = true;
      dom.htCanvas.hidden = true;
      dom.compareCanvas.hidden = false;
      dom.canvasMetric.hidden = true;
      dom.laneLabel.hidden = true;
      dom.layerLayer.replaceChildren();
      dom.canvasEmpty.hidden = true;

      if (htCompareRunRef !== run) {
        htCompareNodeEls.a.clear();
        htCompareNodeEls.b.clear();
        htCompareEdgeEls.a.clear();
        htCompareEdgeEls.b.clear();
        dom.compareNodeLayerA.replaceChildren();
        dom.compareNodeLayerB.replaceChildren();
        dom.compareEdgeLayerA.replaceChildren();
        dom.compareEdgeLayerB.replaceChildren();
        dom.compareNameA.textContent = run.nameA;
        dom.compareNameB.textContent = run.nameB;
        dom.compareValueA.textContent = serializeHTGraph(run.htGraphA);
        dom.compareValueB.textContent = serializeHTGraph(run.htGraphB);
        dom.compareValueA.title = serializeHTGraph(run.htGraphA);
        dom.compareValueB.title = serializeHTGraph(run.htGraphB);
        dom.compareStageA.style.width = `${run.layoutA.width}px`;
        dom.compareStageA.style.height = `${run.layoutA.height}px`;
        dom.compareStageB.style.width = `${run.layoutB.width}px`;
        dom.compareStageB.style.height = `${run.layoutB.height}px`;
        drawHTGraph(run.htGraphA, run.layoutA, dom.compareNodeLayerA, dom.compareEdgeLayerA, htCompareNodeEls.a, htCompareEdgeEls.a, {
          prefix: 'compare-a'
        });
        drawHTGraph(run.htGraphB, run.layoutB, dom.compareNodeLayerB, dom.compareEdgeLayerB, htCompareNodeEls.b, htCompareEdgeEls.b, {
          prefix: 'compare-b'
        });
        htCompareRunRef = run;
        dom.compareCanvas.classList.remove('is-equal', 'is-different');
      }

      ['a', 'b'].forEach((key) => {
        htCompareNodeEls[key].forEach((el) => {
          el.classList.remove('is-active');
          el.classList.remove('is-mismatch');
        });
      });

      const pair = step.htCompare || {};
      const aIds = [pair.aList, pair.aHp].filter(Boolean);
      const bIds = [pair.bList, pair.bHp].filter(Boolean);
      aIds.forEach((id) => {
        const el = htCompareNodeEls.a.get(id);
        if (el) {
          el.classList.add('is-active');
          if (pair.mismatch) el.classList.add('is-mismatch');
        }
      });
      bIds.forEach((id) => {
        const el = htCompareNodeEls.b.get(id);
        if (el) {
          el.classList.add('is-active');
          if (pair.mismatch) el.classList.add('is-mismatch');
        }
      });

      dom.compareTitle.textContent = `${run.nameA} ↔ ${run.nameB}`;
      dom.compareCurrent.textContent =
        `${run.nameA}：${htCompareSummary(run.htGraphA, pair.aList, pair.aHp)}   ↔   ${run.nameB}：${htCompareSummary(run.htGraphB, pair.bList, pair.bHp)}` +
        (step.result && step.result !== '继续' ? ` · ${step.result}` : '');
      dom.compareCurrent.title = dom.compareCurrent.textContent;
      dom.diagramSummary.textContent = `头尾链表判等 · ${run.nameA} ↔ ${run.nameB}`;
      const isFinal = state.stepIndex >= run.total - 1;
      dom.compareCanvas.classList.toggle('is-equal', isFinal && !!run.equal);
      dom.compareCanvas.classList.toggle('is-different', isFinal && !run.equal);

      requestAnimationFrame(fitCompare);
    }

    function renderNodes(step) {
      const currentIds = new Set(step.nodes.map((node) => node.id));

      nodeEls.forEach((el, id) => {
        if (!currentIds.has(id)) {
          el.remove();
          nodeEls.delete(id);
        }
      });

      const layout = state.run ? state.run.layout : null;
      const activeIds = new Set(step.highlightNodeIds || []);
      const visitedIds = new Set(step.visitedIds || []);

      step.nodes.forEach((node) => {
        let el = nodeEls.get(node.id);
        if (!el) el = createNodeElement(node);

        const effectiveKind = node.tag || (
          node.id.charAt(0) === 'E' ? ATOM : (node.root ? ROOT : LIST)
        );
        el.classList.toggle('gl-node--atom', effectiveKind === ATOM);
        el.classList.toggle('gl-node--list', effectiveKind === LIST);
        el.classList.toggle('gl-node--root', effectiveKind === ROOT || !!node.root);
        el.classList.toggle('gl-node--synthetic', !!node.synthetic);
        el.classList.toggle('is-active', activeIds.has(node.id));
        el.classList.toggle('is-visited', visitedIds.has(node.id));
        el.classList.toggle('is-returned', step.returnedNodeId === node.id);
        el.classList.toggle('is-pending', !node.tag);

        const pos = layout && layout.positions ? layout.positions[node.id] : null;
        if (!pos) {
          el.style.display = 'none';
          return;
        }
        el.style.display = '';
        el.style.left = `${pos.x - pos.w / 2}px`;
        el.style.top = `${pos.y - pos.h / 2}px`;
        el.style.width = `${pos.w}px`;
        el.style.height = `${pos.h}px`;

        const idEl = el.querySelector('.node-id');
        const mainEl = el.querySelector('.node-main');
        const tagEl = el.querySelector('.node-tag');
        const childRefEl = el.querySelector('.node-child-ref');
        const badgeEl = el.querySelector('.node-badge');

        idEl.textContent = node.root ? 'L' : node.id;

        if (node.root || node.tag === ROOT) {
          mainEl.textContent = node.name || 'GList';
          tagEl.textContent = 'GList';
          childRefEl.hidden = true;
        } else if (node.tag === ATOM) {
          mainEl.textContent = node.value == null ? '?' : node.value;
          tagEl.textContent = 'element';
          childRefEl.hidden = true;
        } else if (node.tag === LIST) {
          mainEl.textContent = '子表';
          tagEl.textContent = 'sublist';
          childRefEl.hidden = true;
        } else {
          mainEl.textContent = '…';
          tagEl.textContent = '?';
          childRefEl.hidden = true;
        }

        const badgeText = step.nodeBadges && step.nodeBadges[node.id];
        if (badgeText) {
          badgeEl.hidden = false;
          badgeEl.textContent = String(badgeText);
          badgeEl.classList.toggle('node-badge--depth', !!(state.run && state.run.operation === 'depth'));
        } else {
          badgeEl.hidden = true;
          badgeEl.textContent = '';
        }

        const accessibleKind = node.root ? 'GList 锚点'
          : (effectiveKind === ATOM ? 'element 元素结点' : 'sublist 子表结点');
        const accessibleValue = node.tag === ATOM ? `，值 ${node.value}，data ${node.data}` : '';
        const accessibleBadge = badgeText ? `，标记 ${badgeText}` : '';
        el.setAttribute('aria-label', `${accessibleKind} ${node.id}${accessibleValue}${accessibleBadge}`);
        el.title = node.tag === ATOM
          ? `data = ${node.data}（输入标记 ${node.value}）`
          : (node.root ? `GList ${node.name}` : 'sublist');
      });
    }

    function measureEdgePath(fromPos, toPos, field) {
      if (field === 'next') {
        const startX = fromPos.x + fromPos.w / 2;
        const endX = toPos.x - toPos.w / 2;
        return {
          d: `M ${startX} ${fromPos.y} L ${endX - 3} ${toPos.y}`,
          labelX: (startX + endX) / 2,
          labelY: fromPos.y - 10
        };
      }

      const startX = fromPos.x;
      const startY = fromPos.y + fromPos.h / 2;
      const endX = toPos.x;
      const endY = toPos.y - toPos.h / 2;
      const midY = startY + (endY - startY) * 0.48;
      return {
        d: `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY - 3}`,
        labelX: (startX + endX) / 2,
        labelY: midY - 9
      };
    }

    function renderEdges(step) {
      const nodeMap = new Map(step.nodes.map((node) => [node.id, node]));
      const positions = state.run ? state.run.layout.positions : {};
      const hotPointers = new Set(step.highlightPointers || []);
      const required = new Set();

      step.nodes.forEach((node) => {
        const fromPos = positions[node.id];
        if (!fromPos) return;

        if (!node.synthetic && node.child && nodeMap.has(node.child)) {
          const key = `${node.id}.child`;
          required.add(key);
          updateEdge(key, node, nodeMap.get(node.child), hotPointers.has(key));
        }
        if (node.next && nodeMap.has(node.next)) {
          const key = `${node.id}.next`;
          required.add(key);
          updateEdge(key, node, nodeMap.get(node.next), hotPointers.has(key));
        }
      });

      edgeEls.forEach((group, key) => {
        if (!required.has(key)) {
          group.remove();
          edgeEls.delete(key);
        }
      });
    }

    function updateEdge(key, fromNode, toNode, isHot) {
      const positions = state.run ? state.run.layout.positions : {};
      const fromPos = positions[fromNode.id];
      const toPos = positions[toNode.id];
      if (!fromPos || !toPos) return;

      const field = key.endsWith('.child') ? 'child' : 'next';
      const isRoot = !!fromNode.root || fromNode.tag === ROOT;
      const edgeType = field === 'next' ? 'next' : (isRoot ? 'root' : 'child');
      const labelText = field === 'next' ? 'next' : (isRoot ? 'GList' : 'sub_list');
      const labelWidth = field === 'next' ? 27 : (isRoot ? 32 : 48);
      const labelHeight = 12;
      let group = edgeEls.get(key);

      if (!group) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `edge-group edge-group--${edgeType}`);
        g.dataset.edgeKey = key;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        g.appendChild(path);

        const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        labelBg.setAttribute('class', 'edge-label-bg');
        labelBg.setAttribute('rx', '3');
        labelBg.setAttribute('ry', '3');
        g.appendChild(labelBg);

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('class', 'edge-label');
        g.appendChild(label);

        dom.edgeLayer.appendChild(g);
        group = g;
        edgeEls.set(key, g);
      }

      const geometry = measureEdgePath(fromPos, toPos, field);
      const path = group.querySelector('path');
      const labelBg = group.querySelector('.edge-label-bg');
      const label = group.querySelector('.edge-label');

      path.setAttribute('d', geometry.d);
      path.setAttribute(
        'marker-end',
        isHot ? 'url(#arrow-hot)' : (
          field === 'next' ? 'url(#arrow-next)' :
            (isRoot ? 'url(#arrow-root)' : 'url(#arrow-child)')
        )
      );

      label.textContent = labelText;
      labelBg.setAttribute('x', String(geometry.labelX - labelWidth / 2));
      labelBg.setAttribute('y', String(geometry.labelY - labelHeight / 2));
      labelBg.setAttribute('width', String(labelWidth));
      labelBg.setAttribute('height', String(labelHeight));

      label.setAttribute('x', String(geometry.labelX));
      label.setAttribute('y', String(geometry.labelY + 3));
      group.classList.toggle('is-hot', isHot);
    }

    function renderLaneLabel(step) {
      const synthetic = step.nodes.find((node) => node.synthetic);
      if (!synthetic || !state.run) {
        dom.laneLabel.hidden = true;
        return;
      }
      const pos = state.run.layout.positions[synthetic.id];
      if (!pos) {
        dom.laneLabel.hidden = true;
        return;
      }
      dom.laneLabel.hidden = false;
      dom.laneLabel.style.left = `${pos.x}px`;
      dom.laneLabel.style.top = `${pos.y - pos.h / 2 - 18}px`;
    }

    function updateDiagramSummary(step) {
      const root = step.nodes.find((node) => node.root || node.tag === ROOT);
      const lists = step.nodes.filter((node) => node.tag === LIST).length;
      const atoms = step.nodes.filter((node) => node.tag === ATOM).length;
      const pieces = [
        root ? root.name + '（GList）' : 'GList',
        `${atoms} 个 element`,
        `${lists} 个 sublist`
      ];
      dom.diagramSummary.textContent = pieces.join(' · ');
    }

    function renderLayerGuides(step) {
      dom.layerLayer.replaceChildren();
      if (!state.run || state.run.operation !== 'depth') return;

      const positions = state.run.layout.positions;
      const rowMap = new Map();

      Object.keys(positions).forEach((id) => {
        const node = state.run.graph.nodes[id];
        if (!node || node.synthetic) return;
        const y = positions[id].y;
        const key = Math.round(y * 10) / 10;
        if (!rowMap.has(key)) rowMap.set(key, []);
        rowMap.get(key).push(id);
      });

      const rows = Array.from(rowMap.keys()).sort((a, b) => a - b);
      const currentId = step.variables && (step.variables.current || step.variables.p || step.variables.L);
      const currentPos = currentId && positions[currentId];

      const fragment = document.createDocumentFragment();
      rows.forEach((y, index) => {
        const guide = document.createElement('div');
        guide.className = 'layer-guide';
        if (currentPos && Math.abs(currentPos.y - y) < 0.2) {
          guide.classList.add('is-current');
        }
        guide.style.top = `${y}px`;

        const label = document.createElement('span');
        label.className = 'layer-guide__label';
        label.textContent = `第 ${index + 1} 层`;

        const line = document.createElement('span');
        line.className = 'layer-guide__line';

        guide.appendChild(label);
        guide.appendChild(line);
        fragment.appendChild(guide);
      });

      dom.layerLayer.replaceChildren(fragment);
    }

    function renderCanvasMetric(step) {
      if (!state.run) {
        dom.canvasMetric.hidden = true;
        return;
      }

      const vars = step.variables || {};
      const operation = state.run.operation;
      let text = '';

      if (operation === 'build' && vars['已建'] != null) {
        text = `已建 ${vars['已建']} 个结点`;
      } else if (operation === 'length' && vars.len != null) {
        text = `len = ${vars.len}`;
      } else if (operation === 'depth') {
        const parts = [];
        if (vars.d != null) parts.push(`d = ${vars.d}`);
        if (vars.max != null) parts.push(`max = ${vars.max}`);
        if (vars.depth != null) parts.push(`depth = ${vars.depth}`);
        text = parts.length ? parts.join(' · ') : 'depth 计算中…';
      }

      dom.canvasMetric.hidden = !text;
      dom.canvasMetric.textContent = text;
      dom.canvasMetric.classList.toggle('is-depth', operation === 'depth');
    }

    function renderDiagram(step) {
      if (state.run && state.run.compare) {
        if (state.storage === 'headtail') renderHTComparison(step);
        else renderComparison(step);
        return;
      }

      if (state.storage === 'headtail') {
        renderHTDiagram(step);
        return;
      }

      hideHTView();
      hideCompareView();
      renderLayerGuides(step);
      renderNodes(step);
      renderEdges(step);
      renderLaneLabel(step);
      renderCanvasMetric(step);
      updateDiagramSummary(step);

      dom.canvasEmpty.hidden = step.nodes.length > 0;
      if (!state.run) return;

      const layout = state.run.layout;
      dom.diagramStage.style.width = `${layout.width}px`;
      dom.diagramStage.style.height = `${layout.height}px`;
      fitStage();
    }

    function fitStage() {
      if (!state.run || !dom.diagramStage) return;
      if (state.run.compare) {
        fitCompare();
        return;
      }
      if (state.storage === 'headtail') {
        fitHTStage();
        return;
      }
      const layout = state.run.layout;
      const stageWidth = layout.width;
      const stageHeight = layout.height;
      const viewportWidth = dom.diagramViewport.clientWidth;
      const viewportHeight = dom.diagramViewport.clientHeight;
      if (!viewportWidth || !viewportHeight) return;

      const padding = 18;
      const scale = Math.min(
        1.35,
        (viewportWidth - padding * 2) / stageWidth,
        (viewportHeight - padding * 2) / stageHeight
      );
      const safeScale = Math.max(0.12, scale);
      const offsetX = Math.max(padding, (viewportWidth - stageWidth * safeScale) / 2);
      const offsetY = Math.max(padding, (viewportHeight - stageHeight * safeScale) / 2);

      dom.diagramStage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${safeScale})`;
    }

    function scheduleFit() {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        fitStage();
      });
    }

    /* -------- 变量、结果与步骤说明 -------- */

    function formatVariableValue(value) {
      if (value == null) return 'null';
      if (Array.isArray(value)) return value.join(' → ');
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    }

    function renderVariables(step) {
      const entries = Object.entries(step.variables || {});
      if (!entries.length) {
        const placeholder = document.createElement('span');
        placeholder.className = 'muted';
        placeholder.textContent = '暂无变量';
        dom.variablesList.replaceChildren(placeholder);
        return;
      }

      const fragment = document.createDocumentFragment();
      entries.forEach(([key, value]) => {
        const chip = document.createElement('span');
        chip.className = 'var-chip';

        const keyEl = document.createElement('span');
        keyEl.className = 'var-key';
        keyEl.textContent = VARIABLE_LABELS[key] || key;
        keyEl.title = key;

        const valueEl = document.createElement('span');
        valueEl.className = 'var-value';
        valueEl.textContent = formatVariableValue(value);
        valueEl.title = formatVariableValue(value);

        chip.appendChild(keyEl);
        chip.appendChild(valueEl);
        fragment.appendChild(chip);
      });
      dom.variablesList.replaceChildren(fragment);
    }

    function renderResult(step) {
      const resultText = step.result == null ? '—' : String(step.result);
      dom.resultValue.textContent = resultText;
      dom.resultValue.classList.toggle('is-error', /^(错误|空表没有)/.test(resultText));

      const returned = step.returnedNodeId
        ? step.nodes.find((node) => node.id === step.returnedNodeId)
        : null;

      if (returned) {
        dom.returnNodeChip.hidden = false;
        const kind = returned.tag === ATOM ? 'element' : 'sublist';
        const value = returned.tag === ATOM ? returned.value : '子表';
        dom.returnNodeChip.textContent = `返回结点 ${returned.id} · ${kind} ${value}`;
        dom.returnNodeChip.title = `当前返回结点：${returned.id}`;
      } else {
        dom.returnNodeChip.hidden = true;
        dom.returnNodeChip.textContent = '';
      }
    }

    function renderStepDescription(step) {
      dom.stepDesc.textContent = step.desc;

      if (step.base) {
        dom.stepCounter.textContent = '—';
        dom.codeHint.textContent = '等待选择函数…';
        dom.codeHint.title = '';
        return;
      }

      dom.stepCounter.textContent = `${state.stepIndex + 1} / ${state.run.total}`;
      const source = state.run.codeBlock.lines[step.codeLine - 1] || '';
      const summary = source.trim() || '空行';
      dom.codeHint.textContent = `第 ${step.codeLine} 行 · ${summary}`;
      dom.codeHint.title = `第 ${step.codeLine} 行 · ${summary}`;
    }

    function showStep(index) {
      if (!state.run) return;
      const max = state.run.steps.length - 1;
      const safeIndex = Math.max(0, Math.min(max, index));
      state.stepIndex = safeIndex;

      const step = state.run.steps[safeIndex];
      renderStepDescription(step);
      renderVariables(step);
      renderResult(step);
      if (step.base) {
        clearActiveCodeLine();
      } else {
        setActiveCodeLine(step.codeLine, true);
      }
      renderDiagram(step);
      updatePlaybackUI();
    }

    /* -------- 播放控制 -------- */

    function stopPlayback() {
      if (state.timerId) {
        window.clearTimeout(state.timerId);
        state.timerId = null;
      }
      state.playing = false;
    }

    function scheduleNextStep() {
      if (!state.playing || !state.run) return;
      if (state.timerId) window.clearTimeout(state.timerId);

      const delay = BASE_STEP_DELAY / state.speed;
      state.timerId = window.setTimeout(() => {
        state.timerId = null;
        if (!state.playing || !state.run) return;

        const last = state.run.steps.length - 1;
        if (state.stepIndex >= last) {
          state.playing = false;
          updatePlaybackUI();
          return;
        }

        showStep(state.stepIndex + 1);

        if (state.stepIndex >= last) {
          state.playing = false;
          updatePlaybackUI();
        } else {
          scheduleNextStep();
        }
      }, delay);
    }

    function playFromCurrent() {
      if (!state.run) return;
      const last = state.run.steps.length - 1;

      if (state.playing) {
        stopPlayback();
        updatePlaybackUI();
        return;
      }

      if (state.stepIndex >= last) {
        showStep(0);
      }

      state.playing = true;
      updatePlaybackUI();
      scheduleNextStep();
    }

    function stepBy(delta) {
      if (!state.run) return;
      stopPlayback();
      showStep(state.stepIndex + delta);
    }

    function resetPlayback() {
      if (!state.run) return;
      stopPlayback();
      showStep(0);
    }

    function jumpTo(index) {
      if (!state.run) return;
      stopPlayback();
      showStep(index);
    }

    function updatePlaybackUI() {
      const run = state.run;
      const total = run ? run.steps.length : 0;
      const last = total - 1;
      const isBase = !!(run && run.base);
      const atStart = !run || isBase || state.stepIndex <= 0;
      const atEnd = !run || isBase || total === 0 || state.stepIndex >= last;

      dom.resetBtn.disabled = atStart;
      dom.rewindBtn.disabled = atStart;
      dom.prevBtn.disabled = atStart;
      dom.nextBtn.disabled = atEnd;
      dom.forwardBtn.disabled = atEnd;
      dom.playPauseBtn.disabled = !run || isBase;

      dom.progressSlider.disabled = !run || isBase;
      dom.progressSlider.max = String(Math.max(0, last));
      dom.progressSlider.value = String(run && !isBase ? state.stepIndex : 0);
      dom.progressSlider.setAttribute(
        'aria-valuetext',
        isBase ? '案例已载入，等待选择函数' : (run ? `第 ${state.stepIndex + 1} 步，共 ${total} 步` : '无步骤')
      );

      dom.playPauseBtn.classList.toggle('is-playing', state.playing);
      if (isBase) {
        dom.playPauseBtn.textContent = '▶ 播放';
      } else if (state.playing) {
        dom.playPauseBtn.textContent = '⏸ 暂停';
      } else if (run && atEnd) {
        dom.playPauseBtn.textContent = '↻ 重播';
      } else {
        dom.playPauseBtn.textContent = '▶ 播放';
      }

      dom.stepCounter.textContent = isBase ? '—' : (run ? `${state.stepIndex + 1} / ${total}` : '0 / 0');
      dom.stepProgressText.textContent = isBase
        ? '案例已载入'
        : (run ? `第 ${state.stepIndex + 1} 步 / 共 ${total} 步` : '—');
    }

    /* -------- 事件绑定 -------- */

    dom.caseForm.addEventListener('submit', saveCase);

    dom.functionButtons.addEventListener('click', (event) => {
      const button = event.target.closest('.fn-btn');
      if (!button || button.disabled) return;
      applyOperation(button.dataset.operation);
    });

    dom.undoChainBtn.addEventListener('click', undoChain);
    dom.resetChainBtn.addEventListener('click', resetChain);

    function updateDraftHint() {
      clearError();
      const active = state.activeCaseIndex >= 0 ? state.cases[state.activeCaseIndex] : null;
      if (!active) {
        setCaseFeedback('');
        return;
      }
      const name = dom.caseNameInput.value.trim();
      const expression = dom.exprInput.value.trim();
      if (name !== active.name || expression !== active.expression) {
        setCaseFeedback('草稿未保存；函数链仍作用于案例 ' + active.name, 'warning');
      } else {
        setCaseFeedback('');
      }
    }

    dom.exprInput.addEventListener('input', updateDraftHint);
    dom.caseNameInput.addEventListener('input', updateDraftHint);

    dom.resetBtn.addEventListener('click', resetPlayback);
    dom.rewindBtn.addEventListener('click', () => stepBy(-5));
    dom.prevBtn.addEventListener('click', () => stepBy(-1));
    dom.nextBtn.addEventListener('click', () => stepBy(1));
    dom.forwardBtn.addEventListener('click', () => stepBy(5));
    dom.playPauseBtn.addEventListener('click', playFromCurrent);

    dom.progressSlider.addEventListener('input', () => {
      jumpTo(Number(dom.progressSlider.value));
    });

    dom.speedSelect.addEventListener('change', () => {
      state.speed = Number(dom.speedSelect.value) || 1;
      if (state.playing) {
        if (state.timerId) {
          window.clearTimeout(state.timerId);
          state.timerId = null;
        }
        scheduleNextStep();
      }
    });

    dom.quizOpenBtn.addEventListener('click', openQuiz);
    dom.quizCloseBtn.addEventListener('click', closeQuiz);
    dom.quizBackdrop.addEventListener('click', closeQuiz);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !dom.quizModal.hidden) {
        event.preventDefault();
        closeQuiz();
      }
    });

    dom.storageBtns.forEach((button) => {
      button.addEventListener('click', () => setStorage(button.dataset.storage));
    });
    dom.themeToggle.addEventListener('click', () => {
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
    });
    dom.buildCaseBtn.addEventListener('click', startBuild);
    dom.compareCasesBtn.addEventListener('click', openCompareModal);
    dom.compareStartBtn.addEventListener('click', startComparison);
    dom.compareCloseBtn.addEventListener('click', closeCompareModal);
    dom.compareCancelBtn.addEventListener('click', closeCompareModal);
    dom.compareCloseBackdrop.addEventListener('click', closeCompareModal);
    dom.compareSelectA.addEventListener('change', updateCompareHint);
    dom.compareSelectB.addEventListener('change', updateCompareHint);
    dom.compareExitBtn.addEventListener('click', exitCompareToActive);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !dom.compareModal.hidden) {
        event.preventDefault();
        closeCompareModal();
      }
    });

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => scheduleFit());
      observer.observe(dom.diagramViewport);
    }
    window.addEventListener('resize', scheduleFit);

    /* -------- 初始化 -------- */

    dom.typeDefCode.textContent = TYPE_DEFINITION_SOURCE;
    state.cases = DEFAULT_CASES.map((item) => ({ ...item }));
    applyTheme(currentTheme(), false);
    updateStorageUI();
    renderCaseChips();
    loadCase(0);
  }

  /* ===========================================================
     导出纯逻辑，便于 Node 验收测试
     =========================================================== */

  const GLGameCore = {
    ATOM,
    LIST,
    ROOT,
    TYPE_DEFINITION_SOURCE,
    HT_TYPE_DEFINITION_SOURCE,
    CODE_BLOCKS,
    OPERATIONS,
    STUDY_QUESTIONS,
    QUIZ_CATEGORIES,
    parseExpression,
    serializeChain,
    serializeGraph,
    serializeNodeValue,
    createBaseSubject,
    createBaseView,
    createOperationRun,
    createBuildRun,
    createCompareRun,
    createHTBaseView,
    createHTOperationRun,
    createHTBuildRun,
    createHTCompareRun,
    evaluateOperation,
    generateOperationSteps,
    generateBuildSteps,
    generateCompareSteps,
    buildLayout,
    buildHTGraph,
    buildHTLayout,
    serializeHTGraph,
    serializeHTList,
    makeStep,
    makeHTStep,
    describeError,
    isAtomChar,
    ParseError
  };

  if (typeof window !== 'undefined') {
    window.GLGame = GLGameCore;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GLGameCore;
  }

  if (typeof document !== 'undefined') {
    const bootWhenReady = () => {
      try {
        boot();
      } catch (err) {
        console.error('初始化失败：', err);
        const banner = document.getElementById('errorBanner');
        if (banner) {
          banner.hidden = false;
          banner.textContent = `页面初始化失败：${err.message}`;
        }
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootWhenReady, { once: true });
    } else {
      bootWhenReady();
    }
  }
})();
