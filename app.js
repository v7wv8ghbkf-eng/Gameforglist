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

  defineCodeBlock('create', '创建 / 解析', [
    ['/* 核心：解析入口 + 递归下降（辅助函数省略） */'],
    ['static int ParseList(const char **s, GList list);'],
    ['GList CreateGList(const char *s) {'],
    ['    GList root = NewNode(LIST);               /* 根 tag = LIST */', 'rootInit', 'rootTag'],
    ['    if (!ParseList(&s, root)) return NULL;', 'callParse'],
    ['    return root;                              /* 解析完成 */', 'done'],
    ['}'],
    [''],
    ['static int ParseList(const char **s, GList list) {', 'func'],
    ['    (*s)++;                                   /* 读取并跳过 ( */', 'readOpen', 'consumeOpen'],
    ['    while (isspace((unsigned char)**s)) (*s)++;'],
    ["    if (**s == ')') { (*s)++; return OK; }    /* 空表返回 */", 'empty', 'emptyClose'],
    [''],
    ["    while (**s && **s != ')') {", 'loop'],
    ["        if (**s == '(') {                      /* 判断：子表 */", 'classifyList'],
    ['            GList sub = NewNode(LIST);        /* 创建 + 设置 tag */', 'createList', 'tagList'],
    ['            AppendChild(list, sub);           /* 连接 child/next */', 'linkList'],
    ['            if (!ParseList(s, sub)) return ERROR; /* 递归子表 */', 'enterList'],
    ['        } else {                              /* 判断：原子 */', 'classifyAtom'],
    ['            GList atom = NewNode(ATOM);       /* 创建 + 设置 tag */', 'createAtom', 'tagAtom'],
    ['            atom->val.atom = **s;             /* 设置原子值 */', 'setAtom'],
    ['            AppendChild(list, atom);          /* 连接 child/next */', 'linkAtom'],
    ['            (*s)++;                           /* 读取下一字符 */', 'advanceAtom'],
    ['        }'],
    ['        while (isspace((unsigned char)**s)) (*s)++;'],
    ["        if (**s == ',') { (*s)++; continue; }  /* 逗号：下一元素 */", 'comma'],
    ["        if (**s == ')') { (*s)++; return OK; } /* )：返回 */", 'close', 'closeReturn'],
    ['        return ERROR;'],
    ['    }'],
    ['    return ERROR;', 'eof'],
    ['}']
  ], {
    'create.root': 'rootInit',
    'create.done': 'done',
    'parse.func': 'func',
    'parse.readOpen': 'readOpen',
    'parse.consumeOpen': 'consumeOpen',
    'parse.empty': 'empty',
    'parse.emptyClose': 'emptyClose',
    'parse.emptyReturn': 'emptyClose',
    'parse.loop': 'loop',
    'parse.classifyList': 'classifyList',
    'parse.createList': 'createList',
    'parse.linkList': 'linkList',
    'parse.enter': 'enterList',
    'parse.classifyAtom': 'classifyAtom',
    'parse.createAtom': 'createAtom',
    'parse.setAtom': 'setAtom',
    'parse.linkAtom': 'linkAtom',
    'parse.advanceAtom': 'advanceAtom',
    'parse.comma': 'comma',
    'parse.close': 'close',
    'parse.closeReturn': 'closeReturn',
    'parse.eof': 'eof'
  });

  defineCodeBlock('length', '求长度', [
    ['/* 核心：顶层长度 = 从 child 开始沿 next 计数 */'],
    ['int GListLength(GList L) {', 'func'],
    ['    if (L == NULL || L->tag != LIST) return 0;', 'guard'],
    ['    int len = 0;', 'init'],
    ['    GList p = L->val.child;', 'pinit'],
    ['    while (p != NULL) {', 'loop'],
    ['        len++;', 'count'],
    ['        p = p->next;', 'next'],
    ['    }'],
    ['    return len;', 'ret'],
    ['}']
  ], {
    'length.func': 'func',
    'length.guard': 'guard',
    'length.init': 'init',
    'length.pinit': 'pinit',
    'length.loop': 'loop',
    'length.count': 'count',
    'length.next': 'next',
    'length.return': 'ret'
  });

  defineCodeBlock('depth', '求深度', [
    ['/* 核心：本页层数口径——空表 1，原子 1，表 = 1 + max(子项) */'],
    ['int GListDepth(GList L) {', 'func'],
    ['    if (L == NULL) return 1;                     /* 空表 */', 'null'],
    ['    if (L->tag == ATOM) return 1;                /* 原子 */', 'atom'],
    ['    if (L->val.child == NULL) return 1;          /* 空表 () */', 'empty'],
    ['    int maxDepth = 0;                            /* 最大子深度 */', 'initMax'],
    ['    for (GList p = L->val.child; p; p = p->next) {', 'loop'],
    ['        int childDepth = GListDepth(p);          /* 递归 child */', 'call'],
    ['        if (childDepth > maxDepth)               /* 比较 */', 'compare'],
    ['            maxDepth = childDepth;               /* 更新 */', 'update'],
    ['    }'],
    ['    return maxDepth + 1;                         /* 本层 + 1 */', 'ret'],
    ['}']
  ], {
    'depth.func': 'func',
    'depth.null': 'null',
    'depth.atom': 'atom',
    'depth.empty': 'empty',
    'depth.initMax': 'initMax',
    'depth.loop': 'loop',
    'depth.call': 'call',
    'depth.compare': 'compare',
    'depth.update': 'update',
    'depth.return': 'ret'
  });

  defineCodeBlock('head', '取表头', [
    ['/* 核心：表头 = 根节点的 child */'],
    ['GList GetHead(GList L) {', 'func'],
    ['    if (L == NULL || L->tag != LIST || L->val.child == NULL)', 'empty'],
    ['        return NULL;                         /* 空表没有表头 */'],
    ['    return L->val.child;                    /* 返回第一个元素 */', 'ret'],
    ['}']
  ], {
    'head.func': 'func',
    'head.empty': 'empty',
    'head.return': 'ret'
  });

  defineCodeBlock('tail', '取表尾', [
    ['/* 核心：表尾 = 首元素之后，需新建一个返回表头 */'],
    ['GList GetTail(GList L) {', 'func'],
    ['    if (L == NULL || L->tag != LIST || L->val.child == NULL)', 'empty'],
    ['        return NULL;                         /* 空表没有表尾 */'],
    ['    GList first = L->val.child;              /* 首元素 */', 'first'],
    ['    GList tail = NewNode(LIST);              /* 新建返回表头 */', 'new'],
    ['    tail->val.child = first->next;           /* 共享剩余链 */', 'link'],
    ['    return tail;                             /* 返回新表头 */', 'ret'],
    ['}']
  ], {
    'tail.func': 'func',
    'tail.empty': 'empty',
    'tail.first': 'first',
    'tail.new': 'new',
    'tail.link': 'link',
    'tail.return': 'ret'
  });

  defineCodeBlock('traverse', '遍历', [
    ['/* 核心：先序访问原子，表节点只作为路径 */'],
    ['void Traverse(GList L) {', 'func'],
    ['    if (L == NULL) return;', 'entry'],
    ['    if (L->tag == ATOM) {                    /* 判断：原子 */', 'atom'],
    ['        printf("%c ", L->val.atom);          /* 访问原子 */', 'print'],
    ['        return;'],
    ['    }'],
    ['    for (GList p = L->val.child; p; p = p->next) {', 'loop'],
    ['        Traverse(p);                         /* 递归 child/next */', 'call'],
    ['    }'],
    ['}']
  ], {
    'traverse.func': 'func',
    'traverse.entry': 'entry',
    'traverse.atom': 'atom',
    'traverse.print': 'print',
    'traverse.loop': 'loop',
    'traverse.call': 'call'
  });

  const OPERATIONS = [
    { key: 'create', label: '创建 / 解析', short: '创建' },
    { key: 'length', label: '求长度', short: '长度' },
    { key: 'depth', label: '求深度', short: '深度' },
    { key: 'head', label: '取表头', short: '表头' },
    { key: 'tail', label: '取表尾', short: '表尾' },
    { key: 'traverse', label: '遍历', short: '遍历' }
  ];

  const OPERATION_BY_KEY = Object.fromEntries(OPERATIONS.map((op) => [op.key, op]));

  const READY_MESSAGES = {
    create: '点击“开始演示”，观察广义表如何从根节点逐步构建。',
    length: '点击“开始演示”，从 child 链头开始统计顶层元素个数。',
    depth: '点击“开始演示”，递归比较 child 子树的深度；图层会标出层数。',
    head: '点击“开始演示”，沿根节点的 child 指针取表头。',
    tail: '点击“开始演示”，取首元素之后的剩余元素组成表尾。',
    traverse: '点击“开始演示”，按先序顺序逐个访问原子节点。'
  };

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
        { label: '解析结构', expression: '(a,(b,c),d)', operation: 'create' },
        { label: '演示表尾', expression: '(a,(b,c),d)', operation: 'tail' },
        { label: '演示遍历', expression: '(a,(b,c),d)', operation: 'traverse' }
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
        { label: '演示空表解析', expression: '()', operation: 'create' },
        { label: '演示取表头', expression: '()', operation: 'head' }
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
        { label: '演示求长度', expression: '(x,(y,z),(p,(q)),r)', operation: 'length' },
        { label: '演示遍历', expression: '(x,(y,z),(p,(q)),r)', operation: 'traverse' }
      ]
    },
    {
      id: 'ks-3',
      category: '考试',
      topic: '存储表示',
      title: '扩展线性链表表示法',
      question: '用扩展线性链表表示广义表时，一个节点通常需要哪些字段？如何区分原子和子表？',
      answer: '核心字段：tag、联合体（atom 或 child）、next。',
      code: 'typedef enum { ATOM, LIST } ElemTag;\ntypedef struct GLNode {\n    ElemTag tag;\n    union {\n        char atom;\n        struct GLNode *child;\n    } val;\n    struct GLNode *next;\n} GLNode, *GList;',
      note: 'tag = ATOM 时读取 atom；tag = LIST 时 child 指向子表首元素。next 统一连接同级下一元素。',
      demos: [
        { label: '看节点结构动画', expression: '(a,(b,c),d)', operation: 'create' }
      ]
    },
    {
      id: 'ms-1',
      category: '面试',
      topic: '递归设计',
      title: '手写广义表求深度',
      question: '写出广义表求深度的递归实现，并分析时间与空间复杂度。',
      answer: '每个节点访问一次，时间复杂度 O(n)；递归栈深度不超过最大层数 d，空间复杂度 O(d)。',
      code: 'int GListDepth(GList L) {\n    if (L == NULL) return 1;\n    if (L->tag == ATOM) return 1;\n    int maxDepth = 0;\n    for (GList p = L->val.child; p; p = p->next) {\n        int d = GListDepth(p);\n        if (d > maxDepth) maxDepth = d;\n    }\n    return maxDepth + 1;\n}',
      note: '上面是本页层数口径的实现；若改用教材口径，把空表和原子的返回值改成 0 即可。',
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
      answer: '对原子节点直接输出；对表节点遍历它的 child 链，对每个子项递归。表节点只描述结构，不承载原子值，因此只作为递归路径。',
      code: 'void Traverse(GList L) {\n    if (L == NULL) return;\n    if (L->tag == ATOM) {\n        printf("%c ", L->val.atom);\n        return;\n    }\n    for (GList p = L->val.child; p; p = p->next)\n        Traverse(p);\n}',
      note: '遍历访问每个节点一次，时间复杂度 O(n)。若需要保存结果，可以把 printf 替换为写入数组或字符串。',
      demos: [
        { label: '观察访问顺序', expression: '(a,(b,c),d)', operation: 'traverse' }
      ]
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
        { label: '复习 child/next 关系', expression: '(a,(b,c),d)', operation: 'create' }
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
    const prefix = kind === ATOM ? 'A' : (opts.prefix || 'L');
    const id = prefix + (graph.seq += 1);
    const node = {
      id,
      tag: null,
      value: null,
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
        value: node.value,
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
    const lineMarks = marks || CODE_BLOCKS.create.marks;
    const codeLine = lineMarks[spec.line];
    if (!codeLine) {
      throw new Error(`内部错误：未知代码行标记 ${spec.line}`);
    }
    const step = {
      desc: spec.desc,
      codeLine,
      nodes: snapshotNodes(graph),
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
    const trace = !!opts.trace;
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
    const steps = [];
    const ctx = {
      chars,
      pos: 0,
      graph
    };

    const record = (spec) => {
      if (trace) steps.push(makeStep(graph, spec, CODE_BLOCKS.create.marks));
    };
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

    const root = createGraphNode(graph, LIST, { position: ctx.pos });
    graph.rootId = root.id;

    record({
      desc: '分配根节点，准备开始解析。',
      line: 'create.root',
      highlightNodeIds: [root.id],
      variables: { root: root.id, tag: '未设置', pos: ctx.pos + 1 },
      result: '已分配根节点'
    });

    root.tag = LIST;
    record({
      desc: '设置根节点 tag = LIST。',
      line: 'rootTag',
      highlightNodeIds: [root.id],
      variables: { root: root.id, tag: 'LIST', pos: ctx.pos + 1 },
      result: '根表已就绪'
    });

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

    return { graph, steps };
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
     操作步骤生成器
     =========================================================== */

  function generateOperationSteps(operation, graph) {
    const codeBlock = CODE_BLOCKS[operation];
    switch (operation) {
      case 'length':
        return generateLengthSteps(graph, codeBlock);
      case 'depth':
        return generateDepthSteps(graph, codeBlock);
      case 'head':
        return generateHeadSteps(graph, codeBlock);
      case 'tail':
        return generateTailSteps(graph, codeBlock);
      case 'traverse':
        return generateTraverseSteps(graph, codeBlock);
      default:
        throw new Error(`不支持的操作：${operation}`);
    }
  }

  function generateLengthSteps(graph, codeBlock) {
    const steps = [];
    const counted = Object.create(null);
    const push = (spec) => {
      steps.push(makeStep(graph, {
        ...spec,
        nodeBadges: { ...counted, ...(spec.nodeBadges || {}) }
      }, codeBlock.marks));
    };
    const rootId = graph.rootId;
    const root = graph.nodes[rootId];

    push({
      desc: '准备求长度：从根节点的 child 指针开始，沿 next 链统计元素。',
      line: 'length.func',
      highlightNodeIds: [rootId],
      variables: { p: root.child || 'NULL', len: 0, rule: '只数顶层元素' },
      result: 'len = 0'
    });

    let len = 0;
    let currentId = root.child;
    const firstPointer = currentId ? `${rootId}.child` : null;

    push({
      desc: currentId
        ? `初始化 p = ${rootId}.child，指向第一个顶层元素 ${currentId}。`
        : `${rootId}.child 为 NULL，这是一个空表。`,
      line: 'length.pinit',
      highlightNodeIds: currentId ? [currentId] : [rootId],
      highlightPointers: firstPointer ? [firstPointer] : [],
      variables: { p: currentId || 'NULL', len: 0 },
      result: currentId ? `p = ${currentId}` : 'p = NULL'
    });

    let previousId = null;
    while (currentId) {
      const current = graph.nodes[currentId];
      len += 1;
      counted[currentId] = `#${len}`;
      push({
        desc: `p 指向 ${currentId}，不为 NULL，len 加 1。`,
        line: 'length.count',
        highlightNodeIds: [currentId],
        highlightPointers: previousId ? [`${previousId}.next`] : [firstPointer].filter(Boolean),
        variables: { p: currentId, len },
        result: `len = ${len}`
      });

      const nextId = current.next;
      push({
        desc: nextId
          ? `沿 ${currentId}.next 移动到下一个元素 ${nextId}。`
          : `${currentId}.next 为 NULL，child 链到达末尾。`,
        line: nextId ? 'length.next' : 'length.loop',
        highlightNodeIds: nextId ? [nextId] : [currentId],
        highlightPointers: nextId ? [`${currentId}.next`] : [],
        variables: { p: nextId || 'NULL', len },
        result: nextId ? `p = ${nextId}` : 'p = NULL，循环结束'
      });

      previousId = currentId;
      currentId = nextId;
    }

    push({
      desc: `循环结束，返回累计的顶层元素个数 ${len}。`,
      line: 'length.return',
      highlightNodeIds: [rootId],
      variables: { len, p: 'NULL' },
      result: `长度 = ${len}`
    });

    return steps;
  }

  function generateDepthSteps(graph, codeBlock) {
    const steps = [];
    const depths = Object.create(null);
    const push = (spec) => {
      steps.push(makeStep(graph, {
        ...spec,
        nodeBadges: { ...depths, ...(spec.nodeBadges || {}) }
      }, codeBlock.marks));
    };
    const rootId = graph.rootId;

    push({
      desc: '准备求深度。本游戏按层数口径：空表 1，原子 1，表 = 1 + 最大子项深度。',
      line: 'depth.func',
      highlightNodeIds: [rootId],
      variables: { current: rootId, rule: '1 + max(子项)' },
      result: '等待递归'
    });

    function visit(nodeId, stack) {
      const node = graph.nodes[nodeId];
      const nextStack = stack.concat(nodeId);
      const stackText = nextStack.join(' > ');

      if (!node) {
        push({
          desc: '遇到空指针，按空表口径返回 1。',
          line: 'depth.null',
          variables: { current: 'NULL', stack: stackText },
          result: '返回 1'
        });
        return 1;
      }

      push({
        desc: `进入节点 ${nodeId}，先检查空指针。`,
        line: 'depth.null',
        highlightNodeIds: [nodeId],
        variables: { current: nodeId, stack: stackText },
        result: '非空，继续判断类型'
      });

      if (node.tag === ATOM) {
        depths[nodeId] = 'd1';
        push({
          desc: `节点 ${nodeId} 是原子，按 1 层计。`,
          line: 'depth.atom',
          highlightNodeIds: [nodeId],
          variables: {
            current: nodeId,
            atom: node.value,
            depth: 1,
            stack: stackText
          },
          result: `${nodeId} 返回 1`
        });
        return 1;
      }

      if (!node.child) {
        depths[nodeId] = 'd1';
        push({
          desc: `节点 ${nodeId} 是空表，深度为 1。`,
          line: 'depth.empty',
          highlightNodeIds: [nodeId],
          variables: { current: nodeId, depth: 1, stack: stackText },
          result: `${nodeId} 返回 1`
        });
        return 1;
      }

      push({
        desc: `节点 ${nodeId} 是表，初始化 maxDepth = 0，准备遍历子项。`,
        line: 'depth.initMax',
        highlightNodeIds: [nodeId],
        variables: {
          current: nodeId,
          maxDepth: 0,
          stack: stackText
        },
        result: 'maxDepth = 0'
      });

      let maxDepth = 0;
      let childId = node.child;
      let previousId = null;
      let index = 0;

      while (childId) {
        const pointerKey = previousId ? `${previousId}.next` : `${nodeId}.child`;

        push({
          desc: `检查第 ${index + 1} 个子项 ${childId}，准备递归求深度。`,
          line: 'depth.loop',
          highlightNodeIds: [childId],
          highlightPointers: [pointerKey],
          variables: {
            current: nodeId,
            child: childId,
            index: index + 1,
            maxDepth,
            stack: stackText
          },
          result: `正在处理子项 ${index + 1}`
        });

        push({
          desc: `递归调用 GListDepth(${childId})。`,
          line: 'depth.call',
          highlightNodeIds: [childId],
          highlightPointers: [pointerKey],
          variables: {
            current: nodeId,
            child: childId,
            index: index + 1,
            stack: stackText
          },
          result: `进入 ${childId}`
        });

        const childDepth = visit(childId, nextStack);

        push({
          desc: `比较子项 ${childId} 的深度 ${childDepth} 与当前 maxDepth ${maxDepth}。`,
          line: 'depth.compare',
          highlightNodeIds: [nodeId, childId],
          highlightPointers: [pointerKey],
          variables: {
            current: nodeId,
            child: childId,
            childDepth,
            maxDepth,
            stack: stackText
          },
          result: childDepth > maxDepth
            ? `${childDepth} > ${maxDepth}，需要更新`
            : `${childDepth} ≤ ${maxDepth}，保持不变`
        });

        if (childDepth > maxDepth) {
          maxDepth = childDepth;
          push({
            desc: `更新 maxDepth 为 ${maxDepth}。`,
            line: 'depth.update',
            highlightNodeIds: [nodeId, childId],
            variables: {
              current: nodeId,
              maxDepth,
              childDepth,
              stack: stackText
            },
            result: `maxDepth = ${maxDepth}`
          });
        }

        previousId = childId;
        childId = graph.nodes[childId].next;
        index += 1;
      }

      const depth = maxDepth + 1;
      depths[nodeId] = `d${depth}`;
      push({
        desc: `节点 ${nodeId} 的子项处理完毕，返回 maxDepth + 1 = ${depth}。`,
        line: 'depth.return',
        highlightNodeIds: [nodeId],
        variables: {
          current: nodeId,
          maxDepth,
          depth,
          stack: stackText
        },
        result: `${nodeId} 返回 ${depth}`
      });
      return depth;
    }

    const depth = visit(rootId, []);

    push({
      desc: '根节点深度计算完成。',
      line: 'depth.return',
      highlightNodeIds: [rootId],
      variables: { root: rootId, current: rootId, depth, rule: '1 + max(子项)' },
      result: `深度 = ${depth}`
    });

    return steps;
  }

  function generateHeadSteps(graph, codeBlock) {
    const steps = [];
    const push = (spec) => steps.push(makeStep(graph, spec, codeBlock.marks));
    const rootId = graph.rootId;
    const root = graph.nodes[rootId];

    push({
      desc: '准备取表头，先检查根表是否为空。',
      line: 'head.func',
      highlightNodeIds: [rootId],
      variables: { root: rootId },
      result: '等待检查'
    });

    push({
      desc: root.child ? '根表非空，可以读取 child 指针。' : '根表没有 child，空表没有表头。',
      line: 'head.empty',
      highlightNodeIds: [rootId],
      variables: { root: rootId, empty: !root.child },
      result: root.child ? '非空' : '空表'
    });

    if (!root.child) {
      push({
        desc: '空表没有表头，操作结束并返回 NULL。',
        line: 'head.empty',
        highlightNodeIds: [rootId],
        variables: { root: rootId, head: 'NULL' },
        result: '空表没有表头'
      });
      return steps;
    }

    const headId = root.child;
    const headText = serializeNodeValue(graph, headId);

    push({
      desc: `沿 ${rootId}.child 指针找到表头节点 ${headId}。`,
      line: 'head.return',
      highlightNodeIds: [headId],
      highlightPointers: [`${rootId}.child`],
      variables: {
        root: rootId,
        head: headId,
        value: headText
      },
      result: headText,
      returnedNodeId: headId
    });

    push({
      desc: `返回表头节点 ${headId}，它表示的值是 ${headText}。`,
      line: 'head.return',
      highlightNodeIds: [headId],
      highlightPointers: [`${rootId}.child`],
      variables: {
        root: rootId,
        head: headId,
        existingNode: true
      },
      result: headText,
      returnedNodeId: headId
    });

    return steps;
  }

  function generateTailSteps(graph, codeBlock) {
    const steps = [];
    const push = (spec) => steps.push(makeStep(graph, spec, codeBlock.marks));
    const rootId = graph.rootId;
    const root = graph.nodes[rootId];

    push({
      desc: '准备取表尾，先检查根表是否为空。',
      line: 'tail.func',
      highlightNodeIds: [rootId],
      variables: { root: rootId },
      result: '等待检查'
    });

    push({
      desc: root.child ? '根表非空，首元素之后的元素组成表尾。' : '根表没有 child，空表没有表尾。',
      line: 'tail.empty',
      highlightNodeIds: [rootId],
      variables: { root: rootId, empty: !root.child },
      result: root.child ? '非空' : '空表'
    });

    if (!root.child) {
      push({
        desc: '空表没有表尾，操作结束并返回 NULL。',
        line: 'tail.empty',
        highlightNodeIds: [rootId],
        variables: { root: rootId, tail: 'NULL' },
        result: '空表没有表尾'
      });
      return steps;
    }

    const firstId = root.child;
    const first = graph.nodes[firstId];

    push({
      desc: `定位首元素 ${firstId}，它的 next 指向表尾剩余元素。`,
      line: 'tail.first',
      highlightNodeIds: [firstId],
      highlightPointers: [`${rootId}.child`],
      variables: { root: rootId, first: firstId },
      result: `first = ${firstId}`
    });

    const tail = createGraphNode(graph, LIST, { prefix: 'T', synthetic: true });
    push({
      desc: `创建新的返回表头节点 ${tail.id}（tag 尚未设置）。`,
      line: 'tail.new',
      highlightNodeIds: [tail.id],
      variables: { root: rootId, first: firstId, tail: tail.id, tag: '未设置' },
      result: `已分配表头 ${tail.id}`
    });

    tail.tag = LIST;
    push({
      desc: `设置返回表头 ${tail.id} 的 tag = LIST。`,
      line: 'new',
      highlightNodeIds: [tail.id],
      variables: { root: rootId, tail: tail.id, tag: 'LIST' },
      result: `${tail.id} 是表节点`
    });

    tail.child = first.next;
    const remaining = first.next;
    const pointerHighlights = [];
    if (remaining) pointerHighlights.push(`${firstId}.next`);
    pointerHighlights.push(`${tail.id}.child`);

    push({
      desc: remaining
        ? `令 ${tail.id}.child = ${firstId}.next，表尾从 ${remaining} 开始。`
        : `${firstId}.next 为 NULL，表尾是空表 ()。`,
      line: 'tail.link',
      highlightNodeIds: [tail.id].concat(remaining ? [remaining] : []),
      highlightPointers: pointerHighlights,
      variables: {
        root: rootId,
        first: firstId,
        tail: tail.id,
        child: remaining || 'NULL'
      },
      result: remaining ? `${tail.id}.child → ${remaining}` : `${tail.id}.child = NULL`
    });

    const tailText = serializeNodeValue(graph, tail.id);
    push({
      desc: `返回新表头 ${tail.id}，表尾值为 ${tailText}。`,
      line: 'tail.return',
      highlightNodeIds: [tail.id],
      highlightPointers: remaining ? [`${firstId}.next`] : [],
      variables: {
        root: rootId,
        tail: tail.id,
        child: remaining || 'NULL',
        value: tailText
      },
      result: tailText,
      returnedNodeId: tail.id
    });

    return steps;
  }

  function generateTraverseSteps(graph, codeBlock) {
    const steps = [];
    const push = (spec) => steps.push(makeStep(graph, spec, codeBlock.marks));
    const visited = [];
    const sequence = [];
    const rootId = graph.rootId;

    push({
      desc: '准备先序遍历：表节点作为路径，原子节点按访问顺序输出。',
      line: 'traverse.func',
      highlightNodeIds: [rootId],
      variables: { current: rootId, sequence: '（空）', count: 0 },
      result: '访问序列尚未开始',
      visitedIds: []
    });

    function walk(nodeId, stack) {
      const node = graph.nodes[nodeId];
      if (!node) return;

      const stackText = stack.concat(nodeId).join(' > ');

      if (node.tag === ATOM) {
        push({
          desc: `到达节点 ${nodeId}，判断为原子。`,
          line: 'traverse.atom',
          highlightNodeIds: [nodeId],
          variables: {
            current: nodeId,
            atom: node.value,
            stack: stackText,
            sequence: sequence.length ? sequence.join(' → ') : '（空）'
          },
          result: sequence.length ? sequence.join(', ') : '尚未访问原子',
          visitedIds: visited
        });

        visited.push(nodeId);
        sequence.push(node.value);
        push({
          desc: `访问原子 ${node.value}，追加到访问序列。`,
          line: 'traverse.print',
          highlightNodeIds: [nodeId],
          variables: {
            current: nodeId,
            atom: node.value,
            count: sequence.length,
            sequence: sequence.join(' → ')
          },
          result: sequence.join(', '),
          visitedIds: visited
        });
        return;
      }

      push({
        desc: `进入表节点 ${nodeId}，沿 child 链继续遍历。`,
        line: 'traverse.loop',
        highlightNodeIds: [nodeId],
        variables: {
          current: nodeId,
          stack: stackText,
          sequence: sequence.length ? sequence.join(' → ') : '（空）'
        },
        result: sequence.length ? sequence.join(', ') : '进入子表',
        visitedIds: visited
      });

      let childId = node.child;
      let previousId = null;
      let index = 0;

      while (childId) {
        const pointerKey = previousId ? `${previousId}.next` : `${nodeId}.child`;
        push({
          desc: `沿 ${pointerKey} 准备访问下一个节点 ${childId}。`,
          line: 'traverse.call',
          highlightNodeIds: [childId],
          highlightPointers: [pointerKey],
          variables: {
            current: nodeId,
            child: childId,
            index: index + 1,
            sequence: sequence.length ? sequence.join(' → ') : '（空）'
          },
          result: sequence.length ? sequence.join(', ') : `准备访问 ${childId}`,
          visitedIds: visited
        });

        walk(childId, stack.concat(nodeId));
        previousId = childId;
        childId = graph.nodes[childId].next;
        index += 1;
      }

      push({
        desc: `表节点 ${nodeId} 的 child 链遍历完毕，返回上层。`,
        line: 'traverse.loop',
        highlightNodeIds: [nodeId],
        variables: {
          current: nodeId,
          count: sequence.length,
          sequence: sequence.length ? sequence.join(' → ') : '（空）'
        },
        result: sequence.length ? sequence.join(', ') : '空序列',
        visitedIds: visited
      });
    }

    walk(rootId, []);

    const finalSequence = sequence.join(', ');
    push({
      desc: '先序遍历完成，输出所有原子。',
      line: 'traverse.func',
      highlightNodeIds: [],
      variables: {
        count: sequence.length,
        sequence: sequence.length ? sequence.join(' → ') : '（空）'
      },
      result: sequence.length ? finalSequence : '（空表，没有原子）',
      visitedIds: visited
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
      return node.id.charAt(0) === 'A' ? ATOM : LIST;
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
      if (node.tag === LIST && node.child) {
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

      if (node.tag === LIST && node.child) {
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
          throw new Error(`内部错误：第 ${index + 1} 步缺少字段 ${key}`);
        }
      });
      if (!Number.isInteger(step.codeLine) || step.codeLine < 1 || step.codeLine > codeBlock.lines.length) {
        throw new Error(`内部错误：第 ${index + 1} 步的 codeLine 越界。`);
      }
      if (!Array.isArray(step.nodes) || !Array.isArray(step.highlightNodeIds) ||
          !Array.isArray(step.highlightPointers)) {
        throw new Error(`内部错误：第 ${index + 1} 步的数组字段格式不正确。`);
      }
    });
  }

  function generateRun(expression, operation) {
    const meta = OPERATION_BY_KEY[operation];
    if (!meta) throw new Error(`未知操作：${operation}`);

    const codeBlock = CODE_BLOCKS[operation];
    const parsed = parseExpression(expression, { trace: operation === 'create' });
    const graph = parsed.graph;
    let steps;

    if (operation === 'create') {
      steps = parsed.steps;
    } else {
      steps = generateOperationSteps(operation, graph);
    }

    if (!steps.length) {
      throw new Error('没有生成任何步骤。');
    }

    validateSteps(steps, codeBlock);

    return {
      expression: String(expression),
      operation,
      codeBlock,
      graph,
      steps,
      layout: buildLayout(graph, { operation }),
      total: steps.length
    };
  }

  /* ===========================================================
     浏览器 UI
     =========================================================== */

  function boot() {
    const $ = (id) => document.getElementById(id);

    const dom = {
      exprInput: $('exprInput'),
      operationSelect: $('operationSelect'),
      startBtn: $('startBtn'),
      runnerForm: $('runnerForm'),
      errorBanner: $('errorBanner'),
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
      codeNav: $('codeNav'),
      codeTotal: $('codeTotal'),
      codeScroll: $('codeScroll'),
      codeLines: $('codeLines')
    };

    // 避免 DOM 缺失导致难以定位的静默失败
    const missing = Object.keys(dom).filter((key) => !dom[key]);
    if (missing.length) {
      console.error('页面初始化失败，缺少 DOM 节点：', missing);
      return;
    }

    const state = {
      operation: 'create',
      run: null,
      stepIndex: 0,
      playing: false,
      timerId: null,
      speed: 1,
      quizCategory: '全部',
      quizReturnFocus: null
    };

    const nodeEls = new Map();
    const edgeEls = new Map();
    let codeLineEls = [];
    let activeCodeLineEl = null;
    let resizeFrame = 0;

    const VARIABLE_LABELS = {
      root: 'root',
      pos: 'pos',
      char: 'char',
      node: 'node',
      tag: 'tag',
      parent: 'parent',
      pointer: 'pointer',
      current: 'current',
      stack: '递归栈',
      child: 'child',
      index: 'i',
      childDepth: 'childDepth',
      maxDepth: 'maxDepth',
      depth: 'depth',
      len: 'len',
      p: 'p',
      head: 'head',
      tail: 'tail',
      next: 'next',
      atom: 'atom',
      count: '已访问',
      sequence: '访问序列',
      value: 'value',
      rule: '口径',
      branch: '分支',
      empty: 'empty',
      nodeCount: '节点数',
      existingNode: '已有节点'
    };

    /* -------- C 代码渲染与行高亮 -------- */

    function renderCodeBlock(operation) {
      const block = CODE_BLOCKS[operation] || CODE_BLOCKS.create;
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
      dom.codeTotal.textContent = `${block.lines.length} 行`;
      dom.codeScroll.scrollTop = 0;
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

    /* -------- 代码函数导航 -------- */

    function buildCodeNav() {
      const fragment = document.createDocumentFragment();
      OPERATIONS.forEach((op) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'code-nav-btn';
        button.dataset.operation = op.key;
        button.textContent = op.label;
        button.title = `查看并选择「${op.label}」`;
        button.addEventListener('click', () => {
          selectOperation(op.key, { scrollToFunction: true });
          clearError();
        });
        fragment.appendChild(button);
      });
      dom.codeNav.replaceChildren(fragment);
      updateCodeNav();
    }

    function updateCodeNav() {
      dom.codeNav.querySelectorAll('.code-nav-btn').forEach((button) => {
        const active = button.dataset.operation === state.operation;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
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
      dom.exprInput.value = demo.expression;
      clearError();
      state.operation = demo.operation;
      dom.operationSelect.value = demo.operation;
      updateCodeNav();
      renderCodeBlock(demo.operation);
      resetToReady(READY_MESSAGES[demo.operation]);
      startPresentation();
    }

    /* -------- 操作切换 -------- */

    function selectOperation(operation, options) {
      const opts = options || {};
      const meta = OPERATION_BY_KEY[operation];
      if (!meta) return;

      const sameOperation = state.operation === operation;
      state.operation = operation;
      dom.operationSelect.value = operation;
      updateCodeNav();

      if (!sameOperation) {
        renderCodeBlock(operation);
      }

      // 点击当前操作对应的代码导航时，不打断正在回看的步骤。
      if (opts.keepRun !== true && !(sameOperation && state.run)) {
        resetToReady(READY_MESSAGES[operation]);
      }
    }

    /* -------- 错误提示 -------- */

    function showError(message) {
      dom.errorBanner.textContent = message;
      dom.errorBanner.hidden = false;
      dom.exprInput.setAttribute('aria-invalid', 'true');
    }

    function clearError() {
      dom.errorBanner.hidden = true;
      dom.errorBanner.textContent = '';
      dom.exprInput.removeAttribute('aria-invalid');
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

        const effectiveKind = node.tag || (node.id.charAt(0) === 'A' ? ATOM : LIST);
        el.classList.toggle('gl-node--atom', effectiveKind === ATOM);
        el.classList.toggle('gl-node--list', effectiveKind === LIST);
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

        idEl.textContent = node.id;

        if (node.tag === ATOM) {
          mainEl.textContent = node.value == null ? '?' : node.value;
          tagEl.textContent = 'ATOM';
          childRefEl.hidden = true;
        } else if (node.tag === LIST) {
          mainEl.textContent = node.synthetic ? '表尾' : '表';
          tagEl.textContent = 'LIST';
          if (node.synthetic) {
            childRefEl.hidden = false;
            childRefEl.textContent = `child→${node.child || 'NULL'}`;
          } else {
            childRefEl.hidden = true;
          }
        } else {
          mainEl.textContent = '…';
          tagEl.textContent = '?';
          childRefEl.hidden = true;
        }

        const badgeText = step.nodeBadges && step.nodeBadges[node.id];
        if (badgeText) {
          badgeEl.hidden = false;
          badgeEl.textContent = String(badgeText);
          badgeEl.classList.toggle('node-badge--depth', state.operation === 'depth');
        } else {
          badgeEl.hidden = true;
          badgeEl.textContent = '';
        }

        const accessibleKind = effectiveKind === ATOM ? '原子' : '表';
        const accessibleValue = node.tag === ATOM ? `，值为 ${node.value}` : '';
        const accessibleBadge = badgeText ? `，标记 ${badgeText}` : '';
        el.setAttribute('aria-label', `${accessibleKind}节点 ${node.id}${accessibleValue}${accessibleBadge}`);
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
      let group = edgeEls.get(key);

      if (!group) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `edge-group edge-group--${field}`);
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
        label.textContent = field;
        g.appendChild(label);

        dom.edgeLayer.appendChild(g);
        group = g;
        edgeEls.set(key, g);
      }

      const geometry = measureEdgePath(fromPos, toPos, field);
      const path = group.querySelector('path');
      const labelBg = group.querySelector('.edge-label-bg');
      const label = group.querySelector('.edge-label');
      const labelWidth = field === 'child' ? 32 : 27;
      const labelHeight = 12;

      path.setAttribute('d', geometry.d);
      path.setAttribute(
        'marker-end',
        isHot ? 'url(#arrow-hot)' : (field === 'child' ? 'url(#arrow-child)' : 'url(#arrow-next)')
      );

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
      const lists = step.nodes.filter((node) => node.tag === LIST).length;
      const atoms = step.nodes.filter((node) => node.tag === ATOM).length;
      const pending = step.nodes.filter((node) => !node.tag).length;
      const pieces = [`${step.nodes.length} 个节点`, `${lists} 个表`, `${atoms} 个原子`];
      if (pending) pieces.push(`${pending} 个待设 tag`);
      dom.diagramSummary.textContent = pieces.join(' · ');
    }

    function renderLayerGuides(step) {
      dom.layerLayer.replaceChildren();
      if (!state.run || state.operation !== 'depth') return;

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
      const currentId = step.variables && step.variables.current;
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
      let text = '';

      if (state.operation === 'length' && vars.len != null) {
        text = `len = ${vars.len}`;
      } else if (state.operation === 'depth') {
        const parts = [];
        if (vars.childDepth != null) parts.push(`child = ${vars.childDepth}`);
        if (vars.maxDepth != null) parts.push(`max = ${vars.maxDepth}`);
        if (vars.depth != null) parts.push(`depth = ${vars.depth}`);
        text = parts.length ? parts.join(' · ') : 'depth 计算中…';
      }

      dom.canvasMetric.hidden = !text;
      dom.canvasMetric.textContent = text;
      dom.canvasMetric.classList.toggle('is-depth', state.operation === 'depth');
    }

    function renderDiagram(step) {
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
        const kind = returned.tag === ATOM ? 'ATOM' : 'LIST';
        const value = returned.tag === ATOM ? returned.value : '表';
        dom.returnNodeChip.textContent = `返回节点 ${returned.id} · ${kind} ${value}`;
        dom.returnNodeChip.title = `当前返回节点：${returned.id}`;
      } else {
        dom.returnNodeChip.hidden = true;
        dom.returnNodeChip.textContent = '';
      }
    }

    function renderStepDescription(step) {
      dom.stepDesc.textContent = step.desc;
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
      setActiveCodeLine(step.codeLine, true);
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
      const atStart = !run || state.stepIndex <= 0;
      const atEnd = !run || total === 0 || state.stepIndex >= last;

      dom.resetBtn.disabled = atStart;
      dom.rewindBtn.disabled = atStart;
      dom.prevBtn.disabled = atStart;
      dom.nextBtn.disabled = atEnd;
      dom.forwardBtn.disabled = atEnd;
      dom.playPauseBtn.disabled = !run;

      dom.progressSlider.disabled = !run;
      dom.progressSlider.max = String(Math.max(0, last));
      dom.progressSlider.value = String(run ? state.stepIndex : 0);
      dom.progressSlider.setAttribute(
        'aria-valuetext',
        run ? `第 ${state.stepIndex + 1} 步，共 ${total} 步` : '无步骤'
      );

      dom.playPauseBtn.classList.toggle('is-playing', state.playing);
      if (state.playing) {
        dom.playPauseBtn.textContent = '⏸ 暂停';
      } else if (run && atEnd) {
        dom.playPauseBtn.textContent = '↻ 重播';
      } else {
        dom.playPauseBtn.textContent = '▶ 播放';
      }

      dom.stepCounter.textContent = run ? `${state.stepIndex + 1} / ${total}` : '0 / 0';
      dom.stepProgressText.textContent = run
        ? `第 ${state.stepIndex + 1} 步 / 共 ${total} 步`
        : '—';
    }

    function resetToReady(message) {
      stopPlayback();
      state.run = null;
      state.stepIndex = 0;

      clearDiagram();
      clearActiveCodeLine();

      dom.stepDesc.textContent = message || READY_MESSAGES[state.operation];
      dom.stepCounter.textContent = '0 / 0';
      dom.codeHint.textContent = '等待开始…';
      dom.codeHint.title = '';
      dom.resultValue.textContent = '—';
      dom.resultValue.classList.remove('is-error');
      dom.returnNodeChip.hidden = true;
      dom.returnNodeChip.textContent = '';

      const placeholder = document.createElement('span');
      placeholder.className = 'muted';
      placeholder.textContent = '暂无变量';
      dom.variablesList.replaceChildren(placeholder);

      updatePlaybackUI();
    }

    function startPresentation(event) {
      if (event) event.preventDefault();
      stopPlayback();

      try {
        const run = generateRun(dom.exprInput.value, state.operation);
        state.run = run;
        state.stepIndex = 0;
        clearError();
        showStep(0);
        state.playing = true;
        updatePlaybackUI();
        scheduleNextStep();
      } catch (err) {
        resetToReady(READY_MESSAGES[state.operation]);
        showError(describeError(err));
      }
    }

    /* -------- 事件绑定 -------- */

    dom.runnerForm.addEventListener('submit', startPresentation);

    dom.operationSelect.addEventListener('change', () => {
      clearError();
      selectOperation(dom.operationSelect.value);
    });

    dom.exprInput.addEventListener('input', () => {
      clearError();
      if (state.run && dom.exprInput.value !== state.run.expression) {
        resetToReady('表达式已修改。点击“开始演示”重新生成步骤。');
      }
    });

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

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => scheduleFit());
      observer.observe(dom.diagramViewport);
    }
    window.addEventListener('resize', scheduleFit);

    /* -------- 初始化 -------- */

    buildCodeNav();
    renderCodeBlock(state.operation);
    dom.exprInput.value = '(a,(b,c),d)';
    resetToReady(READY_MESSAGES[state.operation]);
    updatePlaybackUI();
  }

  /* ===========================================================
     导出纯逻辑，便于 Node 验收测试
     =========================================================== */

  const GLGameCore = {
    ATOM,
    LIST,
    CODE_BLOCKS,
    OPERATIONS,
    STUDY_QUESTIONS,
    QUIZ_CATEGORIES,
    parseExpression,
    generateRun,
    generateOperationSteps,
    buildLayout,
    serializeGraph,
    serializeNodeValue,
    makeStep,
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
