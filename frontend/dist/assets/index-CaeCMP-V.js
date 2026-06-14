true&&(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
}());

const IS_DEV = false;
const equalFn = (a, b) => a === b;
const $TRACK = Symbol("solid-track");
const signalOptions = {
  equals: equalFn
};
let runEffects = runQueue;
const STALE = 1;
const PENDING = 2;
const UNOWNED = {
  owned: null,
  cleanups: null,
  context: null,
  owner: null
};
var Owner = null;
let Transition = null;
let ExternalSourceConfig = null;
let Listener$1 = null;
let Updates = null;
let Effects = null;
let ExecCount = 0;
function createRoot(fn, detachedOwner) {
  const listener = Listener$1,
    owner = Owner,
    unowned = fn.length === 0,
    current = detachedOwner === undefined ? owner : detachedOwner,
    root = unowned ? UNOWNED : {
      owned: null,
      cleanups: null,
      context: current ? current.context : null,
      owner: current
    },
    updateFn = unowned ? fn : () => fn(() => untrack(() => cleanNode(root)));
  Owner = root;
  Listener$1 = null;
  try {
    return runUpdates(updateFn, true);
  } finally {
    Listener$1 = listener;
    Owner = owner;
  }
}
function createSignal(value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const s = {
    value,
    observers: null,
    observerSlots: null,
    comparator: options.equals || undefined
  };
  const setter = value => {
    if (typeof value === "function") {
      value = value(s.value);
    }
    return writeSignal(s, value);
  };
  return [readSignal.bind(s), setter];
}
function createRenderEffect(fn, value, options) {
  const c = createComputation(fn, value, false, STALE);
  updateComputation(c);
}
function createEffect(fn, value, options) {
  runEffects = runUserEffects;
  const c = createComputation(fn, value, false, STALE);
  c.user = true;
  Effects ? Effects.push(c) : updateComputation(c);
}
function createMemo(fn, value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const c = createComputation(fn, value, true, 0);
  c.observers = null;
  c.observerSlots = null;
  c.comparator = options.equals || undefined;
  updateComputation(c);
  return readSignal.bind(c);
}
function untrack(fn) {
  if (Listener$1 === null) return fn();
  const listener = Listener$1;
  Listener$1 = null;
  try {
    if (ExternalSourceConfig) ;
    return fn();
  } finally {
    Listener$1 = listener;
  }
}
function onMount(fn) {
  createEffect(() => untrack(fn));
}
function onCleanup(fn) {
  if (Owner === null) ;else if (Owner.cleanups === null) Owner.cleanups = [fn];else Owner.cleanups.push(fn);
  return fn;
}
function readSignal() {
  if (this.sources && (this.state)) {
    if ((this.state) === STALE) updateComputation(this);else {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(this), false);
      Updates = updates;
    }
  }
  if (Listener$1) {
    const sSlot = this.observers ? this.observers.length : 0;
    if (!Listener$1.sources) {
      Listener$1.sources = [this];
      Listener$1.sourceSlots = [sSlot];
    } else {
      Listener$1.sources.push(this);
      Listener$1.sourceSlots.push(sSlot);
    }
    if (!this.observers) {
      this.observers = [Listener$1];
      this.observerSlots = [Listener$1.sources.length - 1];
    } else {
      this.observers.push(Listener$1);
      this.observerSlots.push(Listener$1.sources.length - 1);
    }
  }
  return this.value;
}
function writeSignal(node, value, isComp) {
  let current = node.value;
  if (!node.comparator || !node.comparator(current, value)) {
    node.value = value;
    if (node.observers && node.observers.length) {
      runUpdates(() => {
        for (let i = 0; i < node.observers.length; i += 1) {
          const o = node.observers[i];
          const TransitionRunning = Transition && Transition.running;
          if (TransitionRunning && Transition.disposed.has(o)) ;
          if (TransitionRunning ? !o.tState : !o.state) {
            if (o.pure) Updates.push(o);else Effects.push(o);
            if (o.observers) markDownstream(o);
          }
          if (!TransitionRunning) o.state = STALE;
        }
        if (Updates.length > 10e5) {
          Updates = [];
          if (IS_DEV) ;
          throw new Error();
        }
      }, false);
    }
  }
  return value;
}
function updateComputation(node) {
  if (!node.fn) return;
  cleanNode(node);
  const time = ExecCount;
  runComputation(node, node.value, time);
}
function runComputation(node, value, time) {
  let nextValue;
  const owner = Owner,
    listener = Listener$1;
  Listener$1 = Owner = node;
  try {
    nextValue = node.fn(value);
  } catch (err) {
    if (node.pure) {
      {
        node.state = STALE;
        node.owned && node.owned.forEach(cleanNode);
        node.owned = null;
      }
    }
    node.updatedAt = time + 1;
    return handleError(err);
  } finally {
    Listener$1 = listener;
    Owner = owner;
  }
  if (!node.updatedAt || node.updatedAt <= time) {
    if (node.updatedAt != null && "observers" in node) {
      writeSignal(node, nextValue);
    } else node.value = nextValue;
    node.updatedAt = time;
  }
}
function createComputation(fn, init, pure, state = STALE, options) {
  const c = {
    fn,
    state: state,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: init,
    owner: Owner,
    context: Owner ? Owner.context : null,
    pure
  };
  if (Owner === null) ;else if (Owner !== UNOWNED) {
    {
      if (!Owner.owned) Owner.owned = [c];else Owner.owned.push(c);
    }
  }
  return c;
}
function runTop(node) {
  if ((node.state) === 0) return;
  if ((node.state) === PENDING) return lookUpstream(node);
  if (node.suspense && untrack(node.suspense.inFallback)) return node.suspense.effects.push(node);
  const ancestors = [node];
  while ((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)) {
    if (node.state) ancestors.push(node);
  }
  for (let i = ancestors.length - 1; i >= 0; i--) {
    node = ancestors[i];
    if ((node.state) === STALE) {
      updateComputation(node);
    } else if ((node.state) === PENDING) {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(node, ancestors[0]), false);
      Updates = updates;
    }
  }
}
function runUpdates(fn, init) {
  if (Updates) return fn();
  let wait = false;
  if (!init) Updates = [];
  if (Effects) wait = true;else Effects = [];
  ExecCount++;
  try {
    const res = fn();
    completeUpdates(wait);
    return res;
  } catch (err) {
    if (!wait) Effects = null;
    Updates = null;
    handleError(err);
  }
}
function completeUpdates(wait) {
  if (Updates) {
    runQueue(Updates);
    Updates = null;
  }
  if (wait) return;
  const e = Effects;
  Effects = null;
  if (e.length) runUpdates(() => runEffects(e), false);
}
function runQueue(queue) {
  for (let i = 0; i < queue.length; i++) runTop(queue[i]);
}
function runUserEffects(queue) {
  let i,
    userLength = 0;
  for (i = 0; i < queue.length; i++) {
    const e = queue[i];
    if (!e.user) runTop(e);else queue[userLength++] = e;
  }
  for (i = 0; i < userLength; i++) runTop(queue[i]);
}
function lookUpstream(node, ignore) {
  node.state = 0;
  for (let i = 0; i < node.sources.length; i += 1) {
    const source = node.sources[i];
    if (source.sources) {
      const state = source.state;
      if (state === STALE) {
        if (source !== ignore && (!source.updatedAt || source.updatedAt < ExecCount)) runTop(source);
      } else if (state === PENDING) lookUpstream(source, ignore);
    }
  }
}
function markDownstream(node) {
  for (let i = 0; i < node.observers.length; i += 1) {
    const o = node.observers[i];
    if (!o.state) {
      o.state = PENDING;
      if (o.pure) Updates.push(o);else Effects.push(o);
      o.observers && markDownstream(o);
    }
  }
}
function cleanNode(node) {
  let i;
  if (node.sources) {
    while (node.sources.length) {
      const source = node.sources.pop(),
        index = node.sourceSlots.pop(),
        obs = source.observers;
      if (obs && obs.length) {
        const n = obs.pop(),
          s = source.observerSlots.pop();
        if (index < obs.length) {
          n.sourceSlots[s] = index;
          obs[index] = n;
          source.observerSlots[index] = s;
        }
      }
    }
  }
  if (node.tOwned) {
    for (i = node.tOwned.length - 1; i >= 0; i--) cleanNode(node.tOwned[i]);
    delete node.tOwned;
  }
  if (node.owned) {
    for (i = node.owned.length - 1; i >= 0; i--) cleanNode(node.owned[i]);
    node.owned = null;
  }
  if (node.cleanups) {
    for (i = node.cleanups.length - 1; i >= 0; i--) node.cleanups[i]();
    node.cleanups = null;
  }
  node.state = 0;
}
function castError(err) {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : "Unknown error", {
    cause: err
  });
}
function handleError(err, owner = Owner) {
  const error = castError(err);
  throw error;
}

const FALLBACK = Symbol("fallback");
function dispose(d) {
  for (let i = 0; i < d.length; i++) d[i]();
}
function mapArray(list, mapFn, options = {}) {
  let items = [],
    mapped = [],
    disposers = [],
    len = 0,
    indexes = mapFn.length > 1 ? [] : null;
  onCleanup(() => dispose(disposers));
  return () => {
    let newItems = list() || [],
      newLen = newItems.length,
      i,
      j;
    newItems[$TRACK];
    return untrack(() => {
      let newIndices, newIndicesNext, temp, tempdisposers, tempIndexes, start, end, newEnd, item;
      if (newLen === 0) {
        if (len !== 0) {
          dispose(disposers);
          disposers = [];
          items = [];
          mapped = [];
          len = 0;
          indexes && (indexes = []);
        }
        if (options.fallback) {
          items = [FALLBACK];
          mapped[0] = createRoot(disposer => {
            disposers[0] = disposer;
            return options.fallback();
          });
          len = 1;
        }
      }
      else if (len === 0) {
        mapped = new Array(newLen);
        for (j = 0; j < newLen; j++) {
          items[j] = newItems[j];
          mapped[j] = createRoot(mapper);
        }
        len = newLen;
      } else {
        temp = new Array(newLen);
        tempdisposers = new Array(newLen);
        indexes && (tempIndexes = new Array(newLen));
        for (start = 0, end = Math.min(len, newLen); start < end && items[start] === newItems[start]; start++);
        for (end = len - 1, newEnd = newLen - 1; end >= start && newEnd >= start && items[end] === newItems[newEnd]; end--, newEnd--) {
          temp[newEnd] = mapped[end];
          tempdisposers[newEnd] = disposers[end];
          indexes && (tempIndexes[newEnd] = indexes[end]);
        }
        newIndices = new Map();
        newIndicesNext = new Array(newEnd + 1);
        for (j = newEnd; j >= start; j--) {
          item = newItems[j];
          i = newIndices.get(item);
          newIndicesNext[j] = i === undefined ? -1 : i;
          newIndices.set(item, j);
        }
        for (i = start; i <= end; i++) {
          item = items[i];
          j = newIndices.get(item);
          if (j !== undefined && j !== -1) {
            temp[j] = mapped[i];
            tempdisposers[j] = disposers[i];
            indexes && (tempIndexes[j] = indexes[i]);
            j = newIndicesNext[j];
            newIndices.set(item, j);
          } else disposers[i]();
        }
        for (j = start; j < newLen; j++) {
          if (j in temp) {
            mapped[j] = temp[j];
            disposers[j] = tempdisposers[j];
            if (indexes) {
              indexes[j] = tempIndexes[j];
              indexes[j](j);
            }
          } else mapped[j] = createRoot(mapper);
        }
        mapped = mapped.slice(0, len = newLen);
        items = newItems.slice(0);
      }
      return mapped;
    });
    function mapper(disposer) {
      disposers[j] = disposer;
      if (indexes) {
        const [s, set] = createSignal(j);
        indexes[j] = set;
        return mapFn(newItems[j], s);
      }
      return mapFn(newItems[j]);
    }
  };
}
function createComponent(Comp, props) {
  return untrack(() => Comp(props || {}));
}

const narrowedError = name => `Stale read from <${name}>.`;
function For(props) {
  const fallback = "fallback" in props && {
    fallback: () => props.fallback
  };
  return createMemo(mapArray(() => props.each, props.children, fallback || undefined));
}
function Show(props) {
  const keyed = props.keyed;
  const conditionValue = createMemo(() => props.when, undefined, undefined);
  const condition = keyed ? conditionValue : createMemo(conditionValue, undefined, {
    equals: (a, b) => !a === !b
  });
  return createMemo(() => {
    const c = condition();
    if (c) {
      const child = props.children;
      const fn = typeof child === "function" && child.length > 0;
      return fn ? untrack(() => child(keyed ? c : () => {
        if (!untrack(condition)) throw narrowedError("Show");
        return conditionValue();
      })) : child;
    }
    return props.fallback;
  }, undefined, undefined);
}

const memo = fn => createMemo(() => fn());

function reconcileArrays(parentNode, a, b) {
  let bLength = b.length,
    aEnd = a.length,
    bEnd = bLength,
    aStart = 0,
    bStart = 0,
    after = a[aEnd - 1].nextSibling,
    map = null;
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
      continue;
    }
    while (a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      const node = bEnd < bLength ? bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart] : after;
      while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        if (!map || !map.has(a[aStart])) a[aStart].remove();
        aStart++;
      }
    } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
      const node = a[--aEnd].nextSibling;
      parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
      parentNode.insertBefore(b[--bEnd], node);
      a[aEnd] = b[bEnd];
    } else {
      if (!map) {
        map = new Map();
        let i = bStart;
        while (i < bEnd) map.set(b[i], i++);
      }
      const index = map.get(a[aStart]);
      if (index != null) {
        if (bStart < index && index < bEnd) {
          let i = aStart,
            sequence = 1,
            t;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) == null || t !== index + sequence) break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const node = a[aStart];
            while (bStart < index) parentNode.insertBefore(b[bStart++], node);
          } else parentNode.replaceChild(b[bStart++], a[aStart++]);
        } else aStart++;
      } else a[aStart++].remove();
    }
  }
}

const $$EVENTS = "_$DX_DELEGATE";
function render(code, element, init, options = {}) {
  let disposer;
  createRoot(dispose => {
    disposer = dispose;
    element === document ? code() : insert(element, code(), element.firstChild ? null : undefined, init);
  }, options.owner);
  return () => {
    disposer();
    element.textContent = "";
  };
}
function template(html, isImportNode, isSVG, isMathML) {
  let node;
  const create = () => {
    const t = document.createElement("template");
    t.innerHTML = html;
    return t.content.firstChild;
  };
  const fn = () => (node || (node = create())).cloneNode(true);
  fn.cloneNode = fn;
  return fn;
}
function delegateEvents(eventNames, document = window.document) {
  const e = document[$$EVENTS] || (document[$$EVENTS] = new Set());
  for (let i = 0, l = eventNames.length; i < l; i++) {
    const name = eventNames[i];
    if (!e.has(name)) {
      e.add(name);
      document.addEventListener(name, eventHandler);
    }
  }
}
function setAttribute(node, name, value) {
  if (value == null) node.removeAttribute(name);else node.setAttribute(name, value);
}
function className(node, value) {
  if (value == null) node.removeAttribute("class");else node.className = value;
}
function addEventListener(node, name, handler, delegate) {
  {
    if (Array.isArray(handler)) {
      node[`$$${name}`] = handler[0];
      node[`$$${name}Data`] = handler[1];
    } else node[`$$${name}`] = handler;
  }
}
function use(fn, element, arg) {
  return untrack(() => fn(element, arg));
}
function insert(parent, accessor, marker, initial) {
  if (marker !== undefined && !initial) initial = [];
  if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
  createRenderEffect(current => insertExpression(parent, accessor(), current, marker), initial);
}
function eventHandler(e) {
  let node = e.target;
  const key = `$$${e.type}`;
  const oriTarget = e.target;
  const oriCurrentTarget = e.currentTarget;
  const retarget = value => Object.defineProperty(e, "target", {
    configurable: true,
    value
  });
  const handleNode = () => {
    const handler = node[key];
    if (handler && !node.disabled) {
      const data = node[`${key}Data`];
      data !== undefined ? handler.call(node, data, e) : handler.call(node, e);
      if (e.cancelBubble) return;
    }
    node.host && typeof node.host !== "string" && !node.host._$host && node.contains(e.target) && retarget(node.host);
    return true;
  };
  const walkUpTree = () => {
    while (handleNode() && (node = node._$host || node.parentNode || node.host));
  };
  Object.defineProperty(e, "currentTarget", {
    configurable: true,
    get() {
      return node || document;
    }
  });
  if (e.composedPath) {
    const path = e.composedPath();
    retarget(path[0]);
    for (let i = 0; i < path.length - 2; i++) {
      node = path[i];
      if (!handleNode()) break;
      if (node._$host) {
        node = node._$host;
        walkUpTree();
        break;
      }
      if (node.parentNode === oriCurrentTarget) {
        break;
      }
    }
  }
  else walkUpTree();
  retarget(oriTarget);
}
function insertExpression(parent, value, current, marker, unwrapArray) {
  while (typeof current === "function") current = current();
  if (value === current) return current;
  const t = typeof value,
    multi = marker !== undefined;
  parent = multi && current[0] && current[0].parentNode || parent;
  if (t === "string" || t === "number") {
    if (t === "number") {
      value = value.toString();
      if (value === current) return current;
    }
    if (multi) {
      let node = current[0];
      if (node && node.nodeType === 3) {
        node.data !== value && (node.data = value);
      } else node = document.createTextNode(value);
      current = cleanChildren(parent, current, marker, node);
    } else {
      if (current !== "" && typeof current === "string") {
        current = parent.firstChild.data = value;
      } else current = parent.textContent = value;
    }
  } else if (value == null || t === "boolean") {
    current = cleanChildren(parent, current, marker);
  } else if (t === "function") {
    createRenderEffect(() => {
      let v = value();
      while (typeof v === "function") v = v();
      current = insertExpression(parent, v, current, marker);
    });
    return () => current;
  } else if (Array.isArray(value)) {
    const array = [];
    const currentArray = current && Array.isArray(current);
    if (normalizeIncomingArray(array, value, current, unwrapArray)) {
      createRenderEffect(() => current = insertExpression(parent, array, current, marker, true));
      return () => current;
    }
    if (array.length === 0) {
      current = cleanChildren(parent, current, marker);
      if (multi) return current;
    } else if (currentArray) {
      if (current.length === 0) {
        appendNodes(parent, array, marker);
      } else reconcileArrays(parent, current, array);
    } else {
      current && cleanChildren(parent);
      appendNodes(parent, array);
    }
    current = array;
  } else if (value.nodeType) {
    if (Array.isArray(current)) {
      if (multi) return current = cleanChildren(parent, current, marker, value);
      cleanChildren(parent, current, null, value);
    } else if (current == null || current === "" || !parent.firstChild) {
      parent.appendChild(value);
    } else parent.replaceChild(value, parent.firstChild);
    current = value;
  } else ;
  return current;
}
function normalizeIncomingArray(normalized, array, current, unwrap) {
  let dynamic = false;
  for (let i = 0, len = array.length; i < len; i++) {
    let item = array[i],
      prev = current && current[normalized.length],
      t;
    if (item == null || item === true || item === false) ; else if ((t = typeof item) === "object" && item.nodeType) {
      normalized.push(item);
    } else if (Array.isArray(item)) {
      dynamic = normalizeIncomingArray(normalized, item, prev) || dynamic;
    } else if (t === "function") {
      if (unwrap) {
        while (typeof item === "function") item = item();
        dynamic = normalizeIncomingArray(normalized, Array.isArray(item) ? item : [item], Array.isArray(prev) ? prev : [prev]) || dynamic;
      } else {
        normalized.push(item);
        dynamic = true;
      }
    } else {
      const value = String(item);
      if (prev && prev.nodeType === 3 && prev.data === value) normalized.push(prev);else normalized.push(document.createTextNode(value));
    }
  }
  return dynamic;
}
function appendNodes(parent, array, marker = null) {
  for (let i = 0, len = array.length; i < len; i++) parent.insertBefore(array[i], marker);
}
function cleanChildren(parent, current, marker, replacement) {
  if (marker === undefined) return parent.textContent = "";
  const node = replacement || document.createTextNode("");
  if (current.length) {
    let inserted = false;
    for (let i = current.length - 1; i >= 0; i--) {
      const el = current[i];
      if (node !== el) {
        const isParent = el.parentNode === parent;
        if (!inserted && !i) isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker);else isParent && el.remove();
      } else inserted = true;
    }
  } else parent.insertBefore(node, marker);
  return [node];
}

// Source: https://github.com/ai/nanoid
// The MIT License (MIT)
//
// Copyright 2017 Andrey Sitnik <andrey@sitnik.ru>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of
// this software and associated documentation files (the "Software"), to deal in
// the Software without restriction, including without limitation the rights to
// use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
// the Software, and to permit persons to whom the Software is furnished to do so,
//     subject to the following conditions:
//
//     The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
//     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
// FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
// IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
// CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// This alphabet uses `A-Za-z0-9_-` symbols.
// The order of characters is optimized for better gzip and brotli compression.
// References to the same file (works both for gzip and brotli):
// `'use`, `andom`, and `rict'`
// References to the brotli default dictionary:
// `-26T`, `1983`, `40px`, `75px`, `bush`, `jack`, `mind`, `very`, and `wolf`
const urlAlphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
function nanoid(size = 21) {
    let id = '';
    // A compact alternative for `for (var i = 0; i < step; i++)`.
    let i = size | 0;
    while (i--) {
        // `| 0` is more compact and faster than `Math.floor()`.
        id += urlAlphabet[(Math.random() * 64) | 0];
    }
    return id;
}

/*
 _     __     _ __
| |  / /___ _(_) /____
| | /| / / __ `/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/
const runtimeURL = window.location.origin + "/wails/runtime";
// Object Names
const objectNames = Object.freeze({
    Call: 0,
    Clipboard: 1,
    Application: 2,
    Events: 3,
    ContextMenu: 4,
    Dialog: 5,
    Window: 6,
    Screens: 7,
    System: 8,
    Browser: 9,
    CancelCall: 10,
    IOS: 11,
});
let clientId = nanoid();
/**
 * Creates a new runtime caller with specified ID.
 *
 * @param object - The object to invoke the method on.
 * @param windowName - The name of the window.
 * @return The new runtime caller function.
 */
function newRuntimeCaller(object, windowName = '') {
    return function (method, args = null) {
        return runtimeCallWithID(object, method, windowName, args);
    };
}
async function runtimeCallWithID(objectID, method, windowName, args) {
    var _a, _b;
    // Default HTTP fetch transport
    let url = new URL(runtimeURL);
    let body = {
        object: objectID,
        method
    };
    if (args !== null && args !== undefined) {
        body.args = args;
    }
    let headers = {
        ["x-wails-client-id"]: clientId,
        ["Content-Type"]: "application/json"
    };
    if (windowName) {
        headers["x-wails-window-name"] = windowName;
    }
    let response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        throw new Error(await response.text());
    }
    if (((_b = (_a = response.headers.get("Content-Type")) === null || _a === void 0 ? void 0 : _a.indexOf("application/json")) !== null && _b !== void 0 ? _b : -1) !== -1) {
        return response.json();
    }
    else {
        return response.text();
    }
}

/*
 _	   __	  _ __
| |	 / /___ _(_) /____
| | /| / / __ `/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/
newRuntimeCaller(objectNames.System);
const _invoke = (function () {
    var _a, _b, _c, _d, _e, _f;
    try {
        // Windows WebView2
        if ((_b = (_a = window.chrome) === null || _a === void 0 ? void 0 : _a.webview) === null || _b === void 0 ? void 0 : _b.postMessage) {
            return window.chrome.webview.postMessage.bind(window.chrome.webview);
        }
        // macOS/iOS WKWebView
        else if ((_e = (_d = (_c = window.webkit) === null || _c === void 0 ? void 0 : _c.messageHandlers) === null || _d === void 0 ? void 0 : _d['external']) === null || _e === void 0 ? void 0 : _e.postMessage) {
            return window.webkit.messageHandlers['external'].postMessage.bind(window.webkit.messageHandlers['external']);
        }
        // Android WebView - uses addJavascriptInterface which exposes window.wails.invoke
        else if ((_f = window.wails) === null || _f === void 0 ? void 0 : _f.invoke) {
            return (msg) => window.wails.invoke(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }
    }
    catch (e) { }
    console.warn('\n%c⚠️ Browser Environment Detected %c\n\n%cOnly UI previews are available in the browser. For full functionality, please run the application in desktop mode.\nMore information at: https://v3.wails.io/learn/build/#using-a-browser-for-development\n', 'background: #ffffff; color: #000000; font-weight: bold; padding: 4px 8px; border-radius: 4px; border: 2px solid #000000;', 'background: transparent;', 'color: #ffffff; font-style: italic; font-weight: bold;');
    return null;
})();
function invoke(msg) {
    _invoke === null || _invoke === void 0 ? void 0 : _invoke(msg);
}
/**
 * Checks if the current operating system is Windows.
 *
 * @return True if the operating system is Windows, otherwise false.
 */
function IsWindows() {
    var _a, _b;
    return ((_b = (_a = window._wails) === null || _a === void 0 ? void 0 : _a.environment) === null || _b === void 0 ? void 0 : _b.OS) === "windows";
}
/**
 * Reports whether the app is being run in debug mode.
 *
 * @returns True if the app is being run in debug mode.
 */
function IsDebug() {
    var _a, _b;
    return Boolean((_b = (_a = window._wails) === null || _a === void 0 ? void 0 : _a.environment) === null || _b === void 0 ? void 0 : _b.Debug);
}

/*
 _     __     _ __
| |  / /___ _(_) /____
| | /| / / __ `/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/
/**
 * Logs a message to the console with custom formatting.
 *
 * @param message - The message to be logged.
 */
/**
 * Checks whether the webview supports the {@link MouseEvent#buttons} property.
 * Looking at you macOS High Sierra!
 */
function canTrackButtons() {
    return (new MouseEvent('mousedown')).buttons === 0;
}
/**
 * Resolves the closest HTMLElement ancestor of an event's target.
 */
function eventTarget(event) {
    var _a;
    if (event.target instanceof HTMLElement) {
        return event.target;
    }
    else if (!(event.target instanceof HTMLElement) && event.target instanceof Node) {
        return (_a = event.target.parentElement) !== null && _a !== void 0 ? _a : document.body;
    }
    else {
        return document.body;
    }
}
document.addEventListener('DOMContentLoaded', () => { });

/*
 _	   __	  _ __
| |	 / /___ _(_) /____
| | /| / / __ `/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/
// setup
window.addEventListener('contextmenu', contextMenuHandler);
const call$1 = newRuntimeCaller(objectNames.ContextMenu);
const ContextMenuOpen = 0;
function openContextMenu(id, x, y, data) {
    void call$1(ContextMenuOpen, { id, x, y, data });
}
function contextMenuHandler(event) {
    const target = eventTarget(event);
    // Check for custom context menu
    const customContextMenu = window.getComputedStyle(target).getPropertyValue("--custom-contextmenu").trim();
    if (customContextMenu) {
        event.preventDefault();
        const data = window.getComputedStyle(target).getPropertyValue("--custom-contextmenu-data");
        openContextMenu(customContextMenu, event.clientX, event.clientY, data);
    }
    else {
        processDefaultContextMenu(event, target);
    }
}
/*
--default-contextmenu: auto; (default) will show the default context menu if contentEditable is true OR text has been selected OR element is input or textarea
--default-contextmenu: show; will always show the default context menu
--default-contextmenu: hide; will always hide the default context menu

This rule is inherited like normal CSS rules, so nesting works as expected
*/
function processDefaultContextMenu(event, target) {
    // Debug builds always show the menu
    if (IsDebug()) {
        return;
    }
    // Process default context menu
    switch (window.getComputedStyle(target).getPropertyValue("--default-contextmenu").trim()) {
        case 'show':
            return;
        case 'hide':
            event.preventDefault();
            return;
    }
    // Check if contentEditable is true
    if (target.isContentEditable) {
        return;
    }
    // Check if text has been selected
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().length > 0;
    if (hasSelection) {
        for (let i = 0; i < selection.rangeCount; i++) {
            const range = selection.getRangeAt(i);
            const rects = range.getClientRects();
            for (let j = 0; j < rects.length; j++) {
                const rect = rects[j];
                if (document.elementFromPoint(rect.left, rect.top) === target) {
                    return;
                }
            }
        }
    }
    // Check if tag is input or textarea.
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        if (hasSelection || (!target.readOnly && !target.disabled)) {
            return;
        }
    }
    // hide default context menu
    event.preventDefault();
}

/*
 _	   __	  _ __
| |	 / /___ _(_) /____
| | /| / / __ `/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/
/**
 * Retrieves the value associated with the specified key from the flag map.
 *
 * @param key - The key to retrieve the value for.
 * @return The value associated with the specified key.
 */
function GetFlag(key) {
    try {
        return window._wails.flags[key];
    }
    catch (e) {
        throw new Error("Unable to retrieve flag '" + key + "': " + e, { cause: e });
    }
}

/*
 _	   __	  _ __
| |	 / /___ _(_) /____
| | /| / / __ `/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/
// Setup
let canDrag = false;
let dragging = false;
let resizable = false;
let canResize = false;
let resizing = false;
let resizeEdge = "";
let defaultCursor = "auto";
let buttons = 0;
const buttonsTracked = canTrackButtons();
window._wails = window._wails || {};
window._wails.setResizable = (value) => {
    resizable = value;
    if (!resizable) {
        // Stop resizing if in progress.
        canResize = resizing = false;
        setResize();
    }
};
// Defer attaching mouse listeners until we know we're not on mobile.
let dragInitDone = false;
function isMobile() {
    var _a, _b;
    const os = (_b = (_a = window._wails) === null || _a === void 0 ? void 0 : _a.environment) === null || _b === void 0 ? void 0 : _b.OS;
    if (os === "ios" || os === "android")
        return true;
    // Fallback heuristic if environment not yet set
    const ua = navigator.userAgent || navigator.vendor || window.opera || "";
    return /android|iphone|ipad|ipod|iemobile|wpdesktop/i.test(ua);
}
function tryInitDragHandlers() {
    if (dragInitDone)
        return;
    if (isMobile())
        return;
    window.addEventListener('mousedown', update, { capture: true });
    window.addEventListener('mousemove', update, { capture: true });
    window.addEventListener('mouseup', update, { capture: true });
    for (const ev of ['click', 'contextmenu', 'dblclick']) {
        window.addEventListener(ev, suppressEvent, { capture: true });
    }
    dragInitDone = true;
}
// Attempt immediate init (in case environment already present)
tryInitDragHandlers();
// Also attempt on DOM ready
document.addEventListener('DOMContentLoaded', tryInitDragHandlers, { once: true });
// As a last resort, poll for environment for a short period
let dragEnvPolls = 0;
const dragEnvPoll = window.setInterval(() => {
    if (dragInitDone) {
        window.clearInterval(dragEnvPoll);
        return;
    }
    tryInitDragHandlers();
    if (++dragEnvPolls > 100) {
        window.clearInterval(dragEnvPoll);
    }
}, 50);
function suppressEvent(event) {
    // Suppress click events while resizing or dragging.
    if (dragging || resizing) {
        event.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();
    }
}
// Use constants to avoid comparing strings multiple times.
const MouseDown = 0;
const MouseUp = 1;
const MouseMove = 2;
function update(event) {
    // Windows suppresses mouse events at the end of dragging or resizing,
    // so we need to be smart and synthesize button events.
    let eventType, eventButtons = event.buttons;
    switch (event.type) {
        case 'mousedown':
            eventType = MouseDown;
            if (!buttonsTracked) {
                eventButtons = buttons | (1 << event.button);
            }
            break;
        case 'mouseup':
            eventType = MouseUp;
            if (!buttonsTracked) {
                eventButtons = buttons & ~(1 << event.button);
            }
            break;
        default:
            eventType = MouseMove;
            if (!buttonsTracked) {
                eventButtons = buttons;
            }
            break;
    }
    let released = buttons & ~eventButtons;
    let pressed = eventButtons & ~buttons;
    buttons = eventButtons;
    // Synthesize a release-press sequence if we detect a press of an already pressed button.
    if (eventType === MouseDown && !(pressed & event.button)) {
        released |= (1 << event.button);
        pressed |= (1 << event.button);
    }
    // Suppress all button events during dragging and resizing,
    // unless this is a mouseup event that is ending a drag action.
    if (eventType !== MouseMove // Fast path for mousemove
        && resizing
        || (dragging
            && (eventType === MouseDown
                || event.button !== 0))) {
        event.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();
    }
    // Handle releases
    if (released & 1) {
        primaryUp();
    }
    // Handle presses
    if (pressed & 1) {
        primaryDown(event);
    }
    // Handle mousemove
    if (eventType === MouseMove) {
        onMouseMove(event);
    }
}
function primaryDown(event) {
    // Reset readiness state.
    canDrag = false;
    canResize = false;
    // Ignore repeated clicks on macOS and Linux.
    if (!IsWindows()) {
        if (event.type === 'mousedown' && event.button === 0 && event.detail !== 1) {
            return;
        }
    }
    if (resizeEdge) {
        // Ready to resize if the primary button was pressed for the first time.
        canResize = true;
        // Do not start drag operations when on resize edges.
        return;
    }
    // Retrieve target element
    const target = eventTarget(event);
    // Ready to drag if the primary button was pressed for the first time on a draggable element.
    // Ignore clicks on the scrollbar.
    const style = window.getComputedStyle(target);
    canDrag = (style.getPropertyValue("--wails-draggable").trim() === "drag"
        && (event.offsetX - parseFloat(style.paddingLeft) < target.clientWidth
            && event.offsetY - parseFloat(style.paddingTop) < target.clientHeight));
}
function primaryUp(event) {
    // Stop dragging and resizing.
    canDrag = false;
    dragging = false;
    canResize = false;
    resizing = false;
}
const cursorForEdge = Object.freeze({
    "se-resize": "nwse-resize",
    "sw-resize": "nesw-resize",
    "nw-resize": "nwse-resize",
    "ne-resize": "nesw-resize",
    "w-resize": "ew-resize",
    "n-resize": "ns-resize",
    "s-resize": "ns-resize",
    "e-resize": "ew-resize",
});
function setResize(edge) {
    if (edge) {
        if (!resizeEdge) {
            defaultCursor = document.body.style.cursor;
        }
        document.body.style.cursor = cursorForEdge[edge];
    }
    else if (!edge && resizeEdge) {
        document.body.style.cursor = defaultCursor;
    }
    resizeEdge = edge || "";
}
function onMouseMove(event) {
    if (canResize && resizeEdge) {
        // Start resizing.
        resizing = true;
        invoke("wails:resize:" + resizeEdge);
    }
    else if (canDrag) {
        // Start dragging.
        dragging = true;
        invoke("wails:drag");
    }
    if (dragging || resizing) {
        // Either drag or resize is ongoing,
        // reset readiness and stop processing.
        canDrag = canResize = false;
        return;
    }
    if (!resizable || !IsWindows()) {
        if (resizeEdge) {
            setResize();
        }
        return;
    }
    const resizeHandleHeight = GetFlag("system.resizeHandleHeight") || 5;
    const resizeHandleWidth = GetFlag("system.resizeHandleWidth") || 5;
    // Extra pixels for the corner areas.
    const cornerExtra = GetFlag("resizeCornerExtra") || 10;
    const rightBorder = (window.outerWidth - event.clientX) < resizeHandleWidth;
    const leftBorder = event.clientX < resizeHandleWidth;
    const topBorder = event.clientY < resizeHandleHeight;
    const bottomBorder = (window.outerHeight - event.clientY) < resizeHandleHeight;
    // Adjust for corner areas.
    const rightCorner = (window.outerWidth - event.clientX) < (resizeHandleWidth + cornerExtra);
    const leftCorner = event.clientX < (resizeHandleWidth + cornerExtra);
    const topCorner = event.clientY < (resizeHandleHeight + cornerExtra);
    const bottomCorner = (window.outerHeight - event.clientY) < (resizeHandleHeight + cornerExtra);
    if (!leftCorner && !topCorner && !bottomCorner && !rightCorner) {
        // Optimisation: out of all corner areas implies out of borders.
        setResize();
    }
    // Detect corners.
    else if (rightCorner && bottomCorner)
        setResize("se-resize");
    else if (leftCorner && bottomCorner)
        setResize("sw-resize");
    else if (leftCorner && topCorner)
        setResize("nw-resize");
    else if (topCorner && rightCorner)
        setResize("ne-resize");
    // Detect borders.
    else if (leftBorder)
        setResize("w-resize");
    else if (topBorder)
        setResize("n-resize");
    else if (bottomBorder)
        setResize("s-resize");
    else if (rightBorder)
        setResize("e-resize");
    // Out of border area.
    else
        setResize();
}

// Source: https://github.com/inspect-js/is-callable
// The MIT License (MIT)
//
// Copyright (c) 2015 Jordan Harband
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
var fnToStr = Function.prototype.toString;
var reflectApply = typeof Reflect === 'object' && Reflect !== null && Reflect.apply;
var badArrayLike;
var isCallableMarker;
if (typeof reflectApply === 'function' && typeof Object.defineProperty === 'function') {
    try {
        badArrayLike = Object.defineProperty({}, 'length', {
            get: function () {
                throw isCallableMarker;
            }
        });
        isCallableMarker = {};
        // eslint-disable-next-line no-throw-literal
        reflectApply(function () { throw 42; }, null, badArrayLike);
    }
    catch (_) {
        if (_ !== isCallableMarker) {
            reflectApply = null;
        }
    }
}
else {
    reflectApply = null;
}
var constructorRegex = /^\s*class\b/;
var isES6ClassFn = function isES6ClassFunction(value) {
    try {
        var fnStr = fnToStr.call(value);
        return constructorRegex.test(fnStr);
    }
    catch (e) {
        return false; // not a function
    }
};
var tryFunctionObject = function tryFunctionToStr(value) {
    try {
        if (isES6ClassFn(value)) {
            return false;
        }
        fnToStr.call(value);
        return true;
    }
    catch (e) {
        return false;
    }
};
var toStr = Object.prototype.toString;
var objectClass = '[object Object]';
var fnClass = '[object Function]';
var genClass = '[object GeneratorFunction]';
var ddaClass = '[object HTMLAllCollection]'; // IE 11
var ddaClass2 = '[object HTML document.all class]';
var ddaClass3 = '[object HTMLCollection]'; // IE 9-10
var hasToStringTag = typeof Symbol === 'function' && !!Symbol.toStringTag; // better: use `has-tostringtag`
var isIE68 = !(0 in [,]); // eslint-disable-line no-sparse-arrays, comma-spacing
var isDDA = function isDocumentDotAll() { return false; };
if (typeof document === 'object') {
    // Firefox 3 canonicalizes DDA to undefined when it's not accessed directly
    var all = document.all;
    if (toStr.call(all) === toStr.call(document.all)) {
        isDDA = function isDocumentDotAll(value) {
            /* globals document: false */
            // in IE 6-8, typeof document.all is "object" and it's truthy
            if ((isIE68 || !value) && (typeof value === 'undefined' || typeof value === 'object')) {
                try {
                    var str = toStr.call(value);
                    return (str === ddaClass
                        || str === ddaClass2
                        || str === ddaClass3 // opera 12.16
                        || str === objectClass // IE 6-8
                    ) && value('') == null; // eslint-disable-line eqeqeq
                }
                catch (e) { /**/ }
            }
            return false;
        };
    }
}
function isCallableRefApply(value) {
    if (isDDA(value)) {
        return true;
    }
    if (!value) {
        return false;
    }
    if (typeof value !== 'function' && typeof value !== 'object') {
        return false;
    }
    try {
        reflectApply(value, null, badArrayLike);
    }
    catch (e) {
        if (e !== isCallableMarker) {
            return false;
        }
    }
    return !isES6ClassFn(value) && tryFunctionObject(value);
}
function isCallableNoRefApply(value) {
    if (isDDA(value)) {
        return true;
    }
    if (!value) {
        return false;
    }
    if (typeof value !== 'function' && typeof value !== 'object') {
        return false;
    }
    if (hasToStringTag) {
        return tryFunctionObject(value);
    }
    if (isES6ClassFn(value)) {
        return false;
    }
    var strClass = toStr.call(value);
    if (strClass !== fnClass && strClass !== genClass && !(/^\[object HTML/).test(strClass)) {
        return false;
    }
    return tryFunctionObject(value);
}
const isCallable = reflectApply ? isCallableRefApply : isCallableNoRefApply;

/*
 _	   __	  _ __
| |	 / /___ _(_) /____
| | /| / / __ `/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/
var _a;
/**
 * Exception class that will be used as rejection reason
 * in case a {@link CancellablePromise} is cancelled successfully.
 *
 * The value of the {@link name} property is the string `"CancelError"`.
 * The value of the {@link cause} property is the cause passed to the cancel method, if any.
 */
class CancelError extends Error {
    /**
     * Constructs a new `CancelError` instance.
     * @param message - The error message.
     * @param options - Options to be forwarded to the Error constructor.
     */
    constructor(message, options) {
        super(message, options);
        this.name = "CancelError";
    }
}
/**
 * Exception class that will be reported as an unhandled rejection
 * in case a {@link CancellablePromise} rejects after being cancelled,
 * or when the `oncancelled` callback throws or rejects.
 *
 * The value of the {@link name} property is the string `"CancelledRejectionError"`.
 * The value of the {@link cause} property is the reason the promise rejected with.
 *
 * Because the original promise was cancelled,
 * a wrapper promise will be passed to the unhandled rejection listener instead.
 * The {@link promise} property holds a reference to the original promise.
 */
class CancelledRejectionError extends Error {
    /**
     * Constructs a new `CancelledRejectionError` instance.
     * @param promise - The promise that caused the error originally.
     * @param reason - The rejection reason.
     * @param info - An optional informative message specifying the circumstances in which the error was thrown.
     *               Defaults to the string `"Unhandled rejection in cancelled promise."`.
     */
    constructor(promise, reason, info) {
        super((info !== null && info !== void 0 ? info : "Unhandled rejection in cancelled promise.") + " Reason: " + errorMessage(reason), { cause: reason });
        this.promise = promise;
        this.name = "CancelledRejectionError";
    }
}
// Private field names.
const barrierSym = Symbol("barrier");
const cancelImplSym = Symbol("cancelImpl");
const species = (_a = Symbol.species) !== null && _a !== void 0 ? _a : Symbol("speciesPolyfill");
/**
 * A promise with an attached method for cancelling long-running operations (see {@link CancellablePromise#cancel}).
 * Cancellation can optionally be bound to an {@link AbortSignal}
 * for better composability (see {@link CancellablePromise#cancelOn}).
 *
 * Cancelling a pending promise will result in an immediate rejection
 * with an instance of {@link CancelError} as reason,
 * but whoever started the promise will be responsible
 * for actually aborting the underlying operation.
 * To this purpose, the constructor and all chaining methods
 * accept optional cancellation callbacks.
 *
 * If a `CancellablePromise` still resolves after having been cancelled,
 * the result will be discarded. If it rejects, the reason
 * will be reported as an unhandled rejection,
 * wrapped in a {@link CancelledRejectionError} instance.
 * To facilitate the handling of cancellation requests,
 * cancelled `CancellablePromise`s will _not_ report unhandled `CancelError`s
 * whose `cause` field is the same as the one with which the current promise was cancelled.
 *
 * All usual promise methods are defined and return a `CancellablePromise`
 * whose cancel method will cancel the parent operation as well, propagating the cancellation reason
 * upwards through promise chains.
 * Conversely, cancelling a promise will not automatically cancel dependent promises downstream:
 * ```ts
 * let root = new CancellablePromise((resolve, reject) => { ... });
 * let child1 = root.then(() => { ... });
 * let child2 = child1.then(() => { ... });
 * let child3 = root.catch(() => { ... });
 * child1.cancel(); // Cancels child1 and root, but not child2 or child3
 * ```
 * Cancelling a promise that has already settled is safe and has no consequence.
 *
 * The `cancel` method returns a promise that _always fulfills_
 * after the whole chain has processed the cancel request
 * and all attached callbacks up to that moment have run.
 *
 * All ES2024 promise methods (static and instance) are defined on CancellablePromise,
 * but actual availability may vary with OS/webview version.
 *
 * In line with the proposal at https://github.com/tc39/proposal-rm-builtin-subclassing,
 * `CancellablePromise` does not support transparent subclassing.
 * Extenders should take care to provide their own method implementations.
 * This might be reconsidered in case the proposal is retired.
 *
 * CancellablePromise is a wrapper around the DOM Promise object
 * and is compliant with the [Promises/A+ specification](https://promisesaplus.com/)
 * (it passes the [compliance suite](https://github.com/promises-aplus/promises-tests))
 * if so is the underlying implementation.
 */
class CancellablePromise extends Promise {
    /**
     * Creates a new `CancellablePromise`.
     *
     * @param executor - A callback used to initialize the promise. This callback is passed two arguments:
     *                   a `resolve` callback used to resolve the promise with a value
     *                   or the result of another promise (possibly cancellable),
     *                   and a `reject` callback used to reject the promise with a provided reason or error.
     *                   If the value provided to the `resolve` callback is a thenable _and_ cancellable object
     *                   (it has a `then` _and_ a `cancel` method),
     *                   cancellation requests will be forwarded to that object and the oncancelled will not be invoked anymore.
     *                   If any one of the two callbacks is called _after_ the promise has been cancelled,
     *                   the provided values will be cancelled and resolved as usual,
     *                   but their results will be discarded.
     *                   However, if the resolution process ultimately ends up in a rejection
     *                   that is not due to cancellation, the rejection reason
     *                   will be wrapped in a {@link CancelledRejectionError}
     *                   and bubbled up as an unhandled rejection.
     * @param oncancelled - It is the caller's responsibility to ensure that any operation
     *                      started by the executor is properly halted upon cancellation.
     *                      This optional callback can be used to that purpose.
     *                      It will be called _synchronously_ with a cancellation cause
     *                      when cancellation is requested, _after_ the promise has already rejected
     *                      with a {@link CancelError}, but _before_
     *                      any {@link then}/{@link catch}/{@link finally} callback runs.
     *                      If the callback returns a thenable, the promise returned from {@link cancel}
     *                      will only fulfill after the former has settled.
     *                      Unhandled exceptions or rejections from the callback will be wrapped
     *                      in a {@link CancelledRejectionError} and bubbled up as unhandled rejections.
     *                      If the `resolve` callback is called before cancellation with a cancellable promise,
     *                      cancellation requests on this promise will be diverted to that promise,
     *                      and the original `oncancelled` callback will be discarded.
     */
    constructor(executor, oncancelled) {
        let resolve;
        let reject;
        super((res, rej) => { resolve = res; reject = rej; });
        if (this.constructor[species] !== Promise) {
            throw new TypeError("CancellablePromise does not support transparent subclassing. Please refrain from overriding the [Symbol.species] static property.");
        }
        let promise = {
            promise: this,
            resolve,
            reject,
            get oncancelled() { return oncancelled !== null && oncancelled !== void 0 ? oncancelled : null; },
            set oncancelled(cb) { oncancelled = cb !== null && cb !== void 0 ? cb : undefined; }
        };
        const state = {
            get root() { return state; },
            resolving: false,
            settled: false
        };
        // Setup cancellation system.
        void Object.defineProperties(this, {
            [barrierSym]: {
                configurable: false,
                enumerable: false,
                writable: true,
                value: null
            },
            [cancelImplSym]: {
                configurable: false,
                enumerable: false,
                writable: false,
                value: cancellerFor(promise, state)
            }
        });
        // Run the actual executor.
        const rejector = rejectorFor(promise, state);
        try {
            executor(resolverFor(promise, state), rejector);
        }
        catch (err) {
            if (state.resolving) {
                console.log("Unhandled exception in CancellablePromise executor.", err);
            }
            else {
                rejector(err);
            }
        }
    }
    /**
     * Cancels immediately the execution of the operation associated with this promise.
     * The promise rejects with a {@link CancelError} instance as reason,
     * with the {@link CancelError#cause} property set to the given argument, if any.
     *
     * Has no effect if called after the promise has already settled;
     * repeated calls in particular are safe, but only the first one
     * will set the cancellation cause.
     *
     * The `CancelError` exception _need not_ be handled explicitly _on the promises that are being cancelled:_
     * cancelling a promise with no attached rejection handler does not trigger an unhandled rejection event.
     * Therefore, the following idioms are all equally correct:
     * ```ts
     * new CancellablePromise((resolve, reject) => { ... }).cancel();
     * new CancellablePromise((resolve, reject) => { ... }).then(...).cancel();
     * new CancellablePromise((resolve, reject) => { ... }).then(...).catch(...).cancel();
     * ```
     * Whenever some cancelled promise in a chain rejects with a `CancelError`
     * with the same cancellation cause as itself, the error will be discarded silently.
     * However, the `CancelError` _will still be delivered_ to all attached rejection handlers
     * added by {@link then} and related methods:
     * ```ts
     * let cancellable = new CancellablePromise((resolve, reject) => { ... });
     * cancellable.then(() => { ... }).catch(console.log);
     * cancellable.cancel(); // A CancelError is printed to the console.
     * ```
     * If the `CancelError` is not handled downstream by the time it reaches
     * a _non-cancelled_ promise, it _will_ trigger an unhandled rejection event,
     * just like normal rejections would:
     * ```ts
     * let cancellable = new CancellablePromise((resolve, reject) => { ... });
     * let chained = cancellable.then(() => { ... }).then(() => { ... }); // No catch...
     * cancellable.cancel(); // Unhandled rejection event on chained!
     * ```
     * Therefore, it is important to either cancel whole promise chains from their tail,
     * as shown in the correct idioms above, or take care of handling errors everywhere.
     *
     * @returns A cancellable promise that _fulfills_ after the cancel callback (if any)
     * and all handlers attached up to the call to cancel have run.
     * If the cancel callback returns a thenable, the promise returned by `cancel`
     * will also wait for that thenable to settle.
     * This enables callers to wait for the cancelled operation to terminate
     * without being forced to handle potential errors at the call site.
     * ```ts
     * cancellable.cancel().then(() => {
     *     // Cleanup finished, it's safe to do something else.
     * }, (err) => {
     *     // Unreachable: the promise returned from cancel will never reject.
     * });
     * ```
     * Note that the returned promise will _not_ handle implicitly any rejection
     * that might have occurred already in the cancelled chain.
     * It will just track whether registered handlers have been executed or not.
     * Therefore, unhandled rejections will never be silently handled by calling cancel.
     */
    cancel(cause) {
        return new CancellablePromise((resolve) => {
            // INVARIANT: the result of this[cancelImplSym] and the barrier do not ever reject.
            // Unfortunately macOS High Sierra does not support Promise.allSettled.
            Promise.all([
                this[cancelImplSym](new CancelError("Promise cancelled.", { cause })),
                currentBarrier(this)
            ]).then(() => resolve(), () => resolve());
        });
    }
    /**
     * Binds promise cancellation to the abort event of the given {@link AbortSignal}.
     * If the signal has already aborted, the promise will be cancelled immediately.
     * When either condition is verified, the cancellation cause will be set
     * to the signal's abort reason (see {@link AbortSignal#reason}).
     *
     * Has no effect if called (or if the signal aborts) _after_ the promise has already settled.
     * Only the first signal to abort will set the cancellation cause.
     *
     * For more details about the cancellation process,
     * see {@link cancel} and the `CancellablePromise` constructor.
     *
     * This method enables `await`ing cancellable promises without having
     * to store them for future cancellation, e.g.:
     * ```ts
     * await longRunningOperation().cancelOn(signal);
     * ```
     * instead of:
     * ```ts
     * let promiseToBeCancelled = longRunningOperation();
     * await promiseToBeCancelled;
     * ```
     *
     * @returns This promise, for method chaining.
     */
    cancelOn(signal) {
        if (signal.aborted) {
            void this.cancel(signal.reason);
        }
        else {
            signal.addEventListener('abort', () => void this.cancel(signal.reason), { capture: true });
        }
        return this;
    }
    /**
     * Attaches callbacks for the resolution and/or rejection of the `CancellablePromise`.
     *
     * The optional `oncancelled` argument will be invoked when the returned promise is cancelled,
     * with the same semantics as the `oncancelled` argument of the constructor.
     * When the parent promise rejects or is cancelled, the `onrejected` callback will run,
     * _even after the returned promise has been cancelled:_
     * in that case, should it reject or throw, the reason will be wrapped
     * in a {@link CancelledRejectionError} and bubbled up as an unhandled rejection.
     *
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A `CancellablePromise` for the completion of whichever callback is executed.
     * The returned promise is hooked up to propagate cancellation requests up the chain, but not down:
     *
     *   - if the parent promise is cancelled, the `onrejected` handler will be invoked with a `CancelError`
     *     and the returned promise _will resolve regularly_ with its result;
     *   - conversely, if the returned promise is cancelled, _the parent promise is cancelled too;_
     *     the `onrejected` handler will still be invoked with the parent's `CancelError`,
     *     but its result will be discarded
     *     and the returned promise will reject with a `CancelError` as well.
     *
     * The promise returned from {@link cancel} will fulfill only after all attached handlers
     * up the entire promise chain have been run.
     *
     * If either callback returns a cancellable promise,
     * cancellation requests will be diverted to it,
     * and the specified `oncancelled` callback will be discarded.
     */
    then(onfulfilled, onrejected, oncancelled) {
        if (!(this instanceof CancellablePromise)) {
            throw new TypeError("CancellablePromise.prototype.then called on an invalid object.");
        }
        // NOTE: TypeScript's built-in type for then is broken,
        // as it allows specifying an arbitrary TResult1 != T even when onfulfilled is not a function.
        // We cannot fix it if we want to CancellablePromise to implement PromiseLike<T>.
        if (!isCallable(onfulfilled)) {
            onfulfilled = identity;
        }
        if (!isCallable(onrejected)) {
            onrejected = thrower;
        }
        if (onfulfilled === identity && onrejected == thrower) {
            // Shortcut for trivial arguments.
            return new CancellablePromise((resolve) => resolve(this));
        }
        const barrier = {};
        this[barrierSym] = barrier;
        return new CancellablePromise((resolve, reject) => {
            void super.then((value) => {
                var _a;
                if (this[barrierSym] === barrier) {
                    this[barrierSym] = null;
                }
                (_a = barrier.resolve) === null || _a === void 0 ? void 0 : _a.call(barrier);
                try {
                    resolve(onfulfilled(value));
                }
                catch (err) {
                    reject(err);
                }
            }, (reason) => {
                var _a;
                if (this[barrierSym] === barrier) {
                    this[barrierSym] = null;
                }
                (_a = barrier.resolve) === null || _a === void 0 ? void 0 : _a.call(barrier);
                try {
                    resolve(onrejected(reason));
                }
                catch (err) {
                    reject(err);
                }
            });
        }, async (cause) => {
            //cancelled = true;
            try {
                return oncancelled === null || oncancelled === void 0 ? void 0 : oncancelled(cause);
            }
            finally {
                await this.cancel(cause);
            }
        });
    }
    /**
     * Attaches a callback for only the rejection of the Promise.
     *
     * The optional `oncancelled` argument will be invoked when the returned promise is cancelled,
     * with the same semantics as the `oncancelled` argument of the constructor.
     * When the parent promise rejects or is cancelled, the `onrejected` callback will run,
     * _even after the returned promise has been cancelled:_
     * in that case, should it reject or throw, the reason will be wrapped
     * in a {@link CancelledRejectionError} and bubbled up as an unhandled rejection.
     *
     * It is equivalent to
     * ```ts
     * cancellablePromise.then(undefined, onrejected, oncancelled);
     * ```
     * and the same caveats apply.
     *
     * @returns A Promise for the completion of the callback.
     * Cancellation requests on the returned promise
     * will propagate up the chain to the parent promise,
     * but not in the other direction.
     *
     * The promise returned from {@link cancel} will fulfill only after all attached handlers
     * up the entire promise chain have been run.
     *
     * If `onrejected` returns a cancellable promise,
     * cancellation requests will be diverted to it,
     * and the specified `oncancelled` callback will be discarded.
     * See {@link then} for more details.
     */
    catch(onrejected, oncancelled) {
        return this.then(undefined, onrejected, oncancelled);
    }
    /**
     * Attaches a callback that is invoked when the CancellablePromise is settled (fulfilled or rejected). The
     * resolved value cannot be accessed or modified from the callback.
     * The returned promise will settle in the same state as the original one
     * after the provided callback has completed execution,
     * unless the callback throws or returns a rejecting promise,
     * in which case the returned promise will reject as well.
     *
     * The optional `oncancelled` argument will be invoked when the returned promise is cancelled,
     * with the same semantics as the `oncancelled` argument of the constructor.
     * Once the parent promise settles, the `onfinally` callback will run,
     * _even after the returned promise has been cancelled:_
     * in that case, should it reject or throw, the reason will be wrapped
     * in a {@link CancelledRejectionError} and bubbled up as an unhandled rejection.
     *
     * This method is implemented in terms of {@link then} and the same caveats apply.
     * It is polyfilled, hence available in every OS/webview version.
     *
     * @returns A Promise for the completion of the callback.
     * Cancellation requests on the returned promise
     * will propagate up the chain to the parent promise,
     * but not in the other direction.
     *
     * The promise returned from {@link cancel} will fulfill only after all attached handlers
     * up the entire promise chain have been run.
     *
     * If `onfinally` returns a cancellable promise,
     * cancellation requests will be diverted to it,
     * and the specified `oncancelled` callback will be discarded.
     * See {@link then} for more details.
     */
    finally(onfinally, oncancelled) {
        if (!(this instanceof CancellablePromise)) {
            throw new TypeError("CancellablePromise.prototype.finally called on an invalid object.");
        }
        if (!isCallable(onfinally)) {
            return this.then(onfinally, onfinally, oncancelled);
        }
        return this.then((value) => CancellablePromise.resolve(onfinally()).then(() => value), (reason) => CancellablePromise.resolve(onfinally()).then(() => { throw reason; }), oncancelled);
    }
    /**
     * We use the `[Symbol.species]` static property, if available,
     * to disable the built-in automatic subclassing features from {@link Promise}.
     * It is critical for performance reasons that extenders do not override this.
     * Once the proposal at https://github.com/tc39/proposal-rm-builtin-subclassing
     * is either accepted or retired, this implementation will have to be revised accordingly.
     *
     * @ignore
     * @internal
     */
    static get [species]() {
        return Promise;
    }
    static all(values) {
        let collected = Array.from(values);
        const promise = collected.length === 0
            ? CancellablePromise.resolve(collected)
            : new CancellablePromise((resolve, reject) => {
                void Promise.all(collected).then(resolve, reject);
            }, (cause) => cancelAll(promise, collected, cause));
        return promise;
    }
    static allSettled(values) {
        let collected = Array.from(values);
        const promise = collected.length === 0
            ? CancellablePromise.resolve(collected)
            : new CancellablePromise((resolve, reject) => {
                void Promise.allSettled(collected).then(resolve, reject);
            }, (cause) => cancelAll(promise, collected, cause));
        return promise;
    }
    static any(values) {
        let collected = Array.from(values);
        const promise = collected.length === 0
            ? CancellablePromise.resolve(collected)
            : new CancellablePromise((resolve, reject) => {
                void Promise.any(collected).then(resolve, reject);
            }, (cause) => cancelAll(promise, collected, cause));
        return promise;
    }
    static race(values) {
        let collected = Array.from(values);
        const promise = new CancellablePromise((resolve, reject) => {
            void Promise.race(collected).then(resolve, reject);
        }, (cause) => cancelAll(promise, collected, cause));
        return promise;
    }
    /**
     * Creates a new cancelled CancellablePromise for the provided cause.
     *
     * @group Static Methods
     */
    static cancel(cause) {
        const p = new CancellablePromise(() => { });
        p.cancel(cause);
        return p;
    }
    /**
     * Creates a new CancellablePromise that cancels
     * after the specified timeout, with the provided cause.
     *
     * If the {@link AbortSignal.timeout} factory method is available,
     * it is used to base the timeout on _active_ time rather than _elapsed_ time.
     * Otherwise, `timeout` falls back to {@link setTimeout}.
     *
     * @group Static Methods
     */
    static timeout(milliseconds, cause) {
        const promise = new CancellablePromise(() => { });
        if (AbortSignal && typeof AbortSignal === 'function' && AbortSignal.timeout && typeof AbortSignal.timeout === 'function') {
            AbortSignal.timeout(milliseconds).addEventListener('abort', () => void promise.cancel(cause));
        }
        else {
            setTimeout(() => void promise.cancel(cause), milliseconds);
        }
        return promise;
    }
    static sleep(milliseconds, value) {
        return new CancellablePromise((resolve) => {
            setTimeout(() => resolve(value), milliseconds);
        });
    }
    /**
     * Creates a new rejected CancellablePromise for the provided reason.
     *
     * @group Static Methods
     */
    static reject(reason) {
        return new CancellablePromise((_, reject) => reject(reason));
    }
    static resolve(value) {
        if (value instanceof CancellablePromise) {
            // Optimise for cancellable promises.
            return value;
        }
        return new CancellablePromise((resolve) => resolve(value));
    }
    /**
     * Creates a new CancellablePromise and returns it in an object, along with its resolve and reject functions
     * and a getter/setter for the cancellation callback.
     *
     * This method is polyfilled, hence available in every OS/webview version.
     *
     * @group Static Methods
     */
    static withResolvers() {
        let result = { oncancelled: null };
        result.promise = new CancellablePromise((resolve, reject) => {
            result.resolve = resolve;
            result.reject = reject;
        }, (cause) => { var _a; (_a = result.oncancelled) === null || _a === void 0 ? void 0 : _a.call(result, cause); });
        return result;
    }
}
/**
 * Returns a callback that implements the cancellation algorithm for the given cancellable promise.
 * The promise returned from the resulting function does not reject.
 */
function cancellerFor(promise, state) {
    let cancellationPromise = undefined;
    return (reason) => {
        if (!state.settled) {
            state.settled = true;
            state.reason = reason;
            promise.reject(reason);
            // Attach an error handler that ignores this specific rejection reason and nothing else.
            // In theory, a sane underlying implementation at this point
            // should always reject with our cancellation reason,
            // hence the handler will never throw.
            void Promise.prototype.then.call(promise.promise, undefined, (err) => {
                if (err !== reason) {
                    throw err;
                }
            });
        }
        // If reason is not set, the promise resolved regularly, hence we must not call oncancelled.
        // If oncancelled is unset, no need to go any further.
        if (!state.reason || !promise.oncancelled) {
            return;
        }
        cancellationPromise = new Promise((resolve) => {
            try {
                resolve(promise.oncancelled(state.reason.cause));
            }
            catch (err) {
                Promise.reject(new CancelledRejectionError(promise.promise, err, "Unhandled exception in oncancelled callback."));
            }
        }).catch((reason) => {
            Promise.reject(new CancelledRejectionError(promise.promise, reason, "Unhandled rejection in oncancelled callback."));
        });
        // Unset oncancelled to prevent repeated calls.
        promise.oncancelled = null;
        return cancellationPromise;
    };
}
/**
 * Returns a callback that implements the resolution algorithm for the given cancellable promise.
 */
function resolverFor(promise, state) {
    return (value) => {
        if (state.resolving) {
            return;
        }
        state.resolving = true;
        if (value === promise.promise) {
            if (state.settled) {
                return;
            }
            state.settled = true;
            promise.reject(new TypeError("A promise cannot be resolved with itself."));
            return;
        }
        if (value != null && (typeof value === 'object' || typeof value === 'function')) {
            let then;
            try {
                then = value.then;
            }
            catch (err) {
                state.settled = true;
                promise.reject(err);
                return;
            }
            if (isCallable(then)) {
                try {
                    let cancel = value.cancel;
                    if (isCallable(cancel)) {
                        const oncancelled = (cause) => {
                            Reflect.apply(cancel, value, [cause]);
                        };
                        if (state.reason) {
                            // If already cancelled, propagate cancellation.
                            // The promise returned from the canceller algorithm does not reject
                            // so it can be discarded safely.
                            void cancellerFor(Object.assign(Object.assign({}, promise), { oncancelled }), state)(state.reason);
                        }
                        else {
                            promise.oncancelled = oncancelled;
                        }
                    }
                }
                catch (_a) { }
                const newState = {
                    root: state.root,
                    resolving: false,
                    get settled() { return this.root.settled; },
                    set settled(value) { this.root.settled = value; },
                    get reason() { return this.root.reason; }
                };
                const rejector = rejectorFor(promise, newState);
                try {
                    Reflect.apply(then, value, [resolverFor(promise, newState), rejector]);
                }
                catch (err) {
                    rejector(err);
                }
                return; // IMPORTANT!
            }
        }
        if (state.settled) {
            return;
        }
        state.settled = true;
        promise.resolve(value);
    };
}
/**
 * Returns a callback that implements the rejection algorithm for the given cancellable promise.
 */
function rejectorFor(promise, state) {
    return (reason) => {
        if (state.resolving) {
            return;
        }
        state.resolving = true;
        if (state.settled) {
            try {
                if (reason instanceof CancelError && state.reason instanceof CancelError && Object.is(reason.cause, state.reason.cause)) {
                    // Swallow late rejections that are CancelErrors whose cancellation cause is the same as ours.
                    return;
                }
            }
            catch (_a) { }
            void Promise.reject(new CancelledRejectionError(promise.promise, reason));
        }
        else {
            state.settled = true;
            promise.reject(reason);
        }
    };
}
/**
 * Cancels all values in an array that look like cancellable thenables.
 * Returns a promise that fulfills once all cancellation procedures for the given values have settled.
 */
function cancelAll(parent, values, cause) {
    const results = [];
    for (const value of values) {
        let cancel;
        try {
            if (!isCallable(value.then)) {
                continue;
            }
            cancel = value.cancel;
            if (!isCallable(cancel)) {
                continue;
            }
        }
        catch (_a) {
            continue;
        }
        let result;
        try {
            result = Reflect.apply(cancel, value, [cause]);
        }
        catch (err) {
            Promise.reject(new CancelledRejectionError(parent, err, "Unhandled exception in cancel method."));
            continue;
        }
        if (!result) {
            continue;
        }
        results.push((result instanceof Promise ? result : Promise.resolve(result)).catch((reason) => {
            Promise.reject(new CancelledRejectionError(parent, reason, "Unhandled rejection in cancel method."));
        }));
    }
    return Promise.all(results);
}
/**
 * Returns its argument.
 */
function identity(x) {
    return x;
}
/**
 * Throws its argument.
 */
function thrower(reason) {
    throw reason;
}
/**
 * Attempts various strategies to convert an error to a string.
 */
function errorMessage(err) {
    try {
        if (err instanceof Error || typeof err !== 'object' || err.toString !== Object.prototype.toString) {
            return "" + err;
        }
    }
    catch (_a) { }
    try {
        return JSON.stringify(err);
    }
    catch (_b) { }
    try {
        return Object.prototype.toString.call(err);
    }
    catch (_c) { }
    return "<could not convert error to string>";
}
/**
 * Gets the current barrier promise for the given cancellable promise. If necessary, initialises the barrier.
 */
function currentBarrier(promise) {
    var _a;
    let pwr = (_a = promise[barrierSym]) !== null && _a !== void 0 ? _a : {};
    if (!('promise' in pwr)) {
        Object.assign(pwr, promiseWithResolvers());
    }
    if (promise[barrierSym] == null) {
        pwr.resolve();
        promise[barrierSym] = pwr;
    }
    return pwr.promise;
}
// Polyfill Promise.withResolvers.
let promiseWithResolvers = Promise.withResolvers;
if (promiseWithResolvers && typeof promiseWithResolvers === 'function') {
    promiseWithResolvers = promiseWithResolvers.bind(Promise);
}
else {
    promiseWithResolvers = function () {
        let resolve;
        let reject;
        const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
        return { promise, resolve, reject };
    };
}

/*
 _	   __	  _ __
| |	 / /___ _(_) /____
| | /| / / __ `/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/
// Setup
window._wails = window._wails || {};
const call = newRuntimeCaller(objectNames.Call);
const cancelCall = newRuntimeCaller(objectNames.CancelCall);
const callResponses = new Map();
const CallBinding = 0;
const CancelMethod = 0;
/**
 * Generates a unique ID using the nanoid library.
 *
 * @returns A unique ID that does not exist in the callResponses set.
 */
function generateID() {
    let result;
    do {
        result = nanoid();
    } while (callResponses.has(result));
    return result;
}
/**
 * Call a bound method according to the given call options.
 *
 * In case of failure, the returned promise will reject with an exception
 * among ReferenceError (unknown method), TypeError (wrong argument count or type),
 * {@link RuntimeError} (method returned an error), or other (network or internal errors).
 * The exception might have a "cause" field with the value returned
 * by the application- or service-level error marshaling functions.
 *
 * @param options - A method call descriptor.
 * @returns The result of the call.
 */
function Call(options) {
    const id = generateID();
    const result = CancellablePromise.withResolvers();
    callResponses.set(id, { resolve: result.resolve, reject: result.reject });
    const request = call(CallBinding, Object.assign({ "call-id": id }, options));
    let running = true;
    request.then((res) => {
        running = false;
        callResponses.delete(id);
        result.resolve(res);
    }, (err) => {
        running = false;
        callResponses.delete(id);
        result.reject(err);
    });
    const cancel = () => {
        callResponses.delete(id);
        return cancelCall(CancelMethod, { "call-id": id }).catch((err) => {
            console.error("Error while requesting binding call cancellation:", err);
        });
    };
    result.oncancelled = () => {
        if (running) {
            return cancel();
        }
        else {
            return request.then(cancel);
        }
    };
    return result.promise;
}
/**
 * Calls a method by its numeric ID with the specified arguments.
 * See {@link Call} for details.
 *
 * @param methodID - The ID of the method to call.
 * @param args - The arguments to pass to the method.
 * @return The result of the method call.
 */
function ByID(methodID, ...args) {
    return Call({ methodID, args });
}

/*
 _	   __	  _ __
| |	 / /___ _(_) /____
| | /| / / __ `/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/
/**
 * Any is a dummy creation function for simple or unknown types.
 */
/**
 * Maps known event names to creation functions for their data types.
 * Will be monkey-patched by the binding generator.
 */
const Events = {};

/*
 _	   __	  _ __
| |	 / /___ _(_) /____
| | /| / / __ `/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/
// The following utilities have been factored out of ./events.ts
// for testing purposes.
const eventListeners = new Map();
class Listener {
    constructor(eventName, callback, maxCallbacks) {
        this.eventName = eventName;
        this.callback = callback;
        this.maxCallbacks = maxCallbacks || -1;
    }
    dispatch(data) {
        try {
            this.callback(data);
        }
        catch (err) {
            console.error(err);
        }
        if (this.maxCallbacks === -1)
            return false;
        this.maxCallbacks -= 1;
        return this.maxCallbacks === 0;
    }
}
function listenerOff(listener) {
    let listeners = eventListeners.get(listener.eventName);
    if (!listeners) {
        return;
    }
    listeners = listeners.filter(l => l !== listener);
    if (listeners.length === 0) {
        eventListeners.delete(listener.eventName);
    }
    else {
        eventListeners.set(listener.eventName, listeners);
    }
}

/*
 _	   __	  _ __
| |	 / /___ _(_) /____
| | /| / / __ `/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/
// Setup
window._wails = window._wails || {};
window._wails.dispatchWailsEvent = dispatchWailsEvent;
newRuntimeCaller(objectNames.Events);
/**
 * Represents a system event or a custom event emitted through wails-provided facilities.
 */
class WailsEvent {
    constructor(name, data) {
        this.name = name;
        this.data = data !== null && data !== void 0 ? data : null;
    }
}
function dispatchWailsEvent(event) {
    let listeners = eventListeners.get(event.name);
    if (!listeners) {
        return;
    }
    let wailsEvent = new WailsEvent(event.name, (event.name in Events) ? Events[event.name](event.data) : event.data);
    if ('sender' in event) {
        wailsEvent.sender = event.sender;
    }
    listeners = listeners.filter(listener => !listener.dispatch(wailsEvent));
    if (listeners.length === 0) {
        eventListeners.delete(event.name);
    }
    else {
        eventListeners.set(event.name, listeners);
    }
}
/**
 * Register a callback function to be called multiple times for a specific event.
 *
 * @param eventName - The name of the event to register the callback for.
 * @param callback - The callback function to be called when the event is triggered.
 * @param maxCallbacks - The maximum number of times the callback can be called for the event. Once the maximum number is reached, the callback will no longer be called.
 * @returns A function that, when called, will unregister the callback from the event.
 */
function OnMultiple(eventName, callback, maxCallbacks) {
    let listeners = eventListeners.get(eventName) || [];
    const thisListener = new Listener(eventName, callback, maxCallbacks);
    listeners.push(thisListener);
    eventListeners.set(eventName, listeners);
    return () => listenerOff(thisListener);
}
/**
 * Registers a callback function to be executed when the specified event occurs.
 *
 * @param eventName - The name of the event to register the callback for.
 * @param callback - The callback function to be called when the event is triggered.
 * @returns A function that, when called, will unregister the callback from the event.
 */
function On(eventName, callback) {
    return OnMultiple(eventName, callback, -1);
}

/*
 _	   __	  _ __
| |	 / /___ _(_) /____
| | /| / / __ `/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/
// Drop target constants
const DROP_TARGET_ATTRIBUTE = 'data-file-drop-target';
const DROP_TARGET_ACTIVE_CLASS = 'file-drop-target-active';
let currentDropTarget = null;
const PositionMethod = 0;
const CenterMethod = 1;
const CloseMethod = 2;
const DisableSizeConstraintsMethod = 3;
const EnableSizeConstraintsMethod = 4;
const FocusMethod = 5;
const ForceReloadMethod = 6;
const FullscreenMethod = 7;
const GetScreenMethod = 8;
const GetZoomMethod = 9;
const HeightMethod = 10;
const HideMethod = 11;
const IsFocusedMethod = 12;
const IsFullscreenMethod = 13;
const IsMaximisedMethod = 14;
const IsMinimisedMethod = 15;
const MaximiseMethod = 16;
const MinimiseMethod = 17;
const NameMethod = 18;
const OpenDevToolsMethod = 19;
const RelativePositionMethod = 20;
const ReloadMethod = 21;
const ResizableMethod = 22;
const RestoreMethod = 23;
const SetPositionMethod = 24;
const SetAlwaysOnTopMethod = 25;
const SetBackgroundColourMethod = 26;
const SetFramelessMethod = 27;
const SetFullscreenButtonEnabledMethod = 28;
const SetMaxSizeMethod = 29;
const SetMinSizeMethod = 30;
const SetRelativePositionMethod = 31;
const SetResizableMethod = 32;
const SetSizeMethod = 33;
const SetTitleMethod = 34;
const SetZoomMethod = 35;
const ShowMethod = 36;
const SizeMethod = 37;
const ToggleFullscreenMethod = 38;
const ToggleMaximiseMethod = 39;
const ToggleFramelessMethod = 40;
const UnFullscreenMethod = 41;
const UnMaximiseMethod = 42;
const UnMinimiseMethod = 43;
const WidthMethod = 44;
const ZoomMethod = 45;
const ZoomInMethod = 46;
const ZoomOutMethod = 47;
const ZoomResetMethod = 48;
const SnapAssistMethod = 49;
const FilesDropped = 50;
const PrintMethod = 51;
/**
 * Finds the nearest drop target element by walking up the DOM tree.
 */
function getDropTargetElement(element) {
    if (!element) {
        return null;
    }
    return element.closest(`[${DROP_TARGET_ATTRIBUTE}]`);
}
/**
 * Check if we can use WebView2's postMessageWithAdditionalObjects (Windows)
 * Also checks that EnableFileDrop is true for this window.
 */
function canResolveFilePaths() {
    var _a, _b, _c, _d;
    // Must have WebView2's postMessageWithAdditionalObjects API (Windows only)
    if (((_b = (_a = window.chrome) === null || _a === void 0 ? void 0 : _a.webview) === null || _b === void 0 ? void 0 : _b.postMessageWithAdditionalObjects) == null) {
        return false;
    }
    // Must have EnableFileDrop set to true for this window
    // This flag is set by the Go backend during runtime initialization
    return ((_d = (_c = window._wails) === null || _c === void 0 ? void 0 : _c.flags) === null || _d === void 0 ? void 0 : _d.enableFileDrop) === true;
}
/**
 * Send file drop to backend via WebView2 (Windows only)
 */
function resolveFilePaths(x, y, files) {
    var _a, _b;
    if ((_b = (_a = window.chrome) === null || _a === void 0 ? void 0 : _a.webview) === null || _b === void 0 ? void 0 : _b.postMessageWithAdditionalObjects) {
        window.chrome.webview.postMessageWithAdditionalObjects(`file:drop:${x}:${y}`, files);
    }
}
// Native drag state (Linux/macOS intercept DOM drag events)
let nativeDragActive = false;
/**
 * Cleans up native drag state and hover effects.
 * Called on drop or when drag leaves the window.
 */
function cleanupNativeDrag() {
    nativeDragActive = false;
    if (currentDropTarget) {
        currentDropTarget.classList.remove(DROP_TARGET_ACTIVE_CLASS);
        currentDropTarget = null;
    }
}
/**
 * Called from Go when a file drag enters the window on Linux/macOS.
 */
function handleDragEnter() {
    var _a, _b;
    // Check if file drops are enabled for this window
    if (((_b = (_a = window._wails) === null || _a === void 0 ? void 0 : _a.flags) === null || _b === void 0 ? void 0 : _b.enableFileDrop) === false) {
        return; // File drops disabled, don't activate drag state
    }
    nativeDragActive = true;
}
/**
 * Called from Go when a file drag leaves the window on Linux/macOS.
 */
function handleDragLeave() {
    cleanupNativeDrag();
}
/**
 * Called from Go during file drag to update hover state on Linux/macOS.
 * @param x - X coordinate in CSS pixels
 * @param y - Y coordinate in CSS pixels
 */
function handleDragOver(x, y) {
    var _a, _b;
    if (!nativeDragActive)
        return;
    // Check if file drops are enabled for this window
    if (((_b = (_a = window._wails) === null || _a === void 0 ? void 0 : _a.flags) === null || _b === void 0 ? void 0 : _b.enableFileDrop) === false) {
        return; // File drops disabled, don't show hover effects
    }
    const targetElement = document.elementFromPoint(x, y);
    const dropTarget = getDropTargetElement(targetElement);
    if (currentDropTarget && currentDropTarget !== dropTarget) {
        currentDropTarget.classList.remove(DROP_TARGET_ACTIVE_CLASS);
    }
    if (dropTarget) {
        dropTarget.classList.add(DROP_TARGET_ACTIVE_CLASS);
        currentDropTarget = dropTarget;
    }
    else {
        currentDropTarget = null;
    }
}
// Private field names.
const callerSym = Symbol("caller");
class Window {
    /**
     * Initialises a window object with the specified name.
     *
     * @private
     * @param name - The name of the target window.
     */
    constructor(name = '') {
        this[callerSym] = newRuntimeCaller(objectNames.Window, name);
        // bind instance method to make them easily usable in event handlers
        for (const method of Object.getOwnPropertyNames(Window.prototype)) {
            if (method !== "constructor"
                && typeof this[method] === "function") {
                this[method] = this[method].bind(this);
            }
        }
    }
    /**
     * Gets the specified window.
     *
     * @param name - The name of the window to get.
     * @returns The corresponding window object.
     */
    Get(name) {
        return new Window(name);
    }
    /**
     * Returns the absolute position of the window.
     *
     * @returns The current absolute position of the window.
     */
    Position() {
        return this[callerSym](PositionMethod);
    }
    /**
     * Centers the window on the screen.
     */
    Center() {
        return this[callerSym](CenterMethod);
    }
    /**
     * Closes the window.
     */
    Close() {
        return this[callerSym](CloseMethod);
    }
    /**
     * Disables min/max size constraints.
     */
    DisableSizeConstraints() {
        return this[callerSym](DisableSizeConstraintsMethod);
    }
    /**
     * Enables min/max size constraints.
     */
    EnableSizeConstraints() {
        return this[callerSym](EnableSizeConstraintsMethod);
    }
    /**
     * Focuses the window.
     */
    Focus() {
        return this[callerSym](FocusMethod);
    }
    /**
     * Forces the window to reload the page assets.
     */
    ForceReload() {
        return this[callerSym](ForceReloadMethod);
    }
    /**
     * Switches the window to fullscreen mode.
     */
    Fullscreen() {
        return this[callerSym](FullscreenMethod);
    }
    /**
     * Returns the screen that the window is on.
     *
     * @returns The screen the window is currently on.
     */
    GetScreen() {
        return this[callerSym](GetScreenMethod);
    }
    /**
     * Returns the current zoom level of the window.
     *
     * @returns The current zoom level.
     */
    GetZoom() {
        return this[callerSym](GetZoomMethod);
    }
    /**
     * Returns the height of the window.
     *
     * @returns The current height of the window.
     */
    Height() {
        return this[callerSym](HeightMethod);
    }
    /**
     * Hides the window.
     */
    Hide() {
        return this[callerSym](HideMethod);
    }
    /**
     * Returns true if the window is focused.
     *
     * @returns Whether the window is currently focused.
     */
    IsFocused() {
        return this[callerSym](IsFocusedMethod);
    }
    /**
     * Returns true if the window is fullscreen.
     *
     * @returns Whether the window is currently fullscreen.
     */
    IsFullscreen() {
        return this[callerSym](IsFullscreenMethod);
    }
    /**
     * Returns true if the window is maximised.
     *
     * @returns Whether the window is currently maximised.
     */
    IsMaximised() {
        return this[callerSym](IsMaximisedMethod);
    }
    /**
     * Returns true if the window is minimised.
     *
     * @returns Whether the window is currently minimised.
     */
    IsMinimised() {
        return this[callerSym](IsMinimisedMethod);
    }
    /**
     * Maximises the window.
     */
    Maximise() {
        return this[callerSym](MaximiseMethod);
    }
    /**
     * Minimises the window.
     */
    Minimise() {
        return this[callerSym](MinimiseMethod);
    }
    /**
     * Returns the name of the window.
     *
     * @returns The name of the window.
     */
    Name() {
        return this[callerSym](NameMethod);
    }
    /**
     * Opens the development tools pane.
     */
    OpenDevTools() {
        return this[callerSym](OpenDevToolsMethod);
    }
    /**
     * Returns the relative position of the window to the screen.
     *
     * @returns The current relative position of the window.
     */
    RelativePosition() {
        return this[callerSym](RelativePositionMethod);
    }
    /**
     * Reloads the page assets.
     */
    Reload() {
        return this[callerSym](ReloadMethod);
    }
    /**
     * Returns true if the window is resizable.
     *
     * @returns Whether the window is currently resizable.
     */
    Resizable() {
        return this[callerSym](ResizableMethod);
    }
    /**
     * Restores the window to its previous state if it was previously minimised, maximised or fullscreen.
     */
    Restore() {
        return this[callerSym](RestoreMethod);
    }
    /**
     * Sets the absolute position of the window.
     *
     * @param x - The desired horizontal absolute position of the window.
     * @param y - The desired vertical absolute position of the window.
     */
    SetPosition(x, y) {
        return this[callerSym](SetPositionMethod, { x, y });
    }
    /**
     * Sets the window to be always on top.
     *
     * @param alwaysOnTop - Whether the window should stay on top.
     */
    SetAlwaysOnTop(alwaysOnTop) {
        return this[callerSym](SetAlwaysOnTopMethod, { alwaysOnTop });
    }
    /**
     * Sets the background colour of the window.
     *
     * @param r - The desired red component of the window background.
     * @param g - The desired green component of the window background.
     * @param b - The desired blue component of the window background.
     * @param a - The desired alpha component of the window background.
     */
    SetBackgroundColour(r, g, b, a) {
        return this[callerSym](SetBackgroundColourMethod, { r, g, b, a });
    }
    /**
     * Removes the window frame and title bar.
     *
     * @param frameless - Whether the window should be frameless.
     */
    SetFrameless(frameless) {
        return this[callerSym](SetFramelessMethod, { frameless });
    }
    /**
     * Disables the system fullscreen button.
     *
     * @param enabled - Whether the fullscreen button should be enabled.
     */
    SetFullscreenButtonEnabled(enabled) {
        return this[callerSym](SetFullscreenButtonEnabledMethod, { enabled });
    }
    /**
     * Sets the maximum size of the window.
     *
     * @param width - The desired maximum width of the window.
     * @param height - The desired maximum height of the window.
     */
    SetMaxSize(width, height) {
        return this[callerSym](SetMaxSizeMethod, { width, height });
    }
    /**
     * Sets the minimum size of the window.
     *
     * @param width - The desired minimum width of the window.
     * @param height - The desired minimum height of the window.
     */
    SetMinSize(width, height) {
        return this[callerSym](SetMinSizeMethod, { width, height });
    }
    /**
     * Sets the relative position of the window to the screen.
     *
     * @param x - The desired horizontal relative position of the window.
     * @param y - The desired vertical relative position of the window.
     */
    SetRelativePosition(x, y) {
        return this[callerSym](SetRelativePositionMethod, { x, y });
    }
    /**
     * Sets whether the window is resizable.
     *
     * @param resizable - Whether the window should be resizable.
     */
    SetResizable(resizable) {
        return this[callerSym](SetResizableMethod, { resizable });
    }
    /**
     * Sets the size of the window.
     *
     * @param width - The desired width of the window.
     * @param height - The desired height of the window.
     */
    SetSize(width, height) {
        return this[callerSym](SetSizeMethod, { width, height });
    }
    /**
     * Sets the title of the window.
     *
     * @param title - The desired title of the window.
     */
    SetTitle(title) {
        return this[callerSym](SetTitleMethod, { title });
    }
    /**
     * Sets the zoom level of the window.
     *
     * @param zoom - The desired zoom level.
     */
    SetZoom(zoom) {
        return this[callerSym](SetZoomMethod, { zoom });
    }
    /**
     * Shows the window.
     */
    Show() {
        return this[callerSym](ShowMethod);
    }
    /**
     * Returns the size of the window.
     *
     * @returns The current size of the window.
     */
    Size() {
        return this[callerSym](SizeMethod);
    }
    /**
     * Toggles the window between fullscreen and normal.
     */
    ToggleFullscreen() {
        return this[callerSym](ToggleFullscreenMethod);
    }
    /**
     * Toggles the window between maximised and normal.
     */
    ToggleMaximise() {
        return this[callerSym](ToggleMaximiseMethod);
    }
    /**
     * Toggles the window between frameless and normal.
     */
    ToggleFrameless() {
        return this[callerSym](ToggleFramelessMethod);
    }
    /**
     * Un-fullscreens the window.
     */
    UnFullscreen() {
        return this[callerSym](UnFullscreenMethod);
    }
    /**
     * Un-maximises the window.
     */
    UnMaximise() {
        return this[callerSym](UnMaximiseMethod);
    }
    /**
     * Un-minimises the window.
     */
    UnMinimise() {
        return this[callerSym](UnMinimiseMethod);
    }
    /**
     * Returns the width of the window.
     *
     * @returns The current width of the window.
     */
    Width() {
        return this[callerSym](WidthMethod);
    }
    /**
     * Zooms the window.
     */
    Zoom() {
        return this[callerSym](ZoomMethod);
    }
    /**
     * Increases the zoom level of the webview content.
     */
    ZoomIn() {
        return this[callerSym](ZoomInMethod);
    }
    /**
     * Decreases the zoom level of the webview content.
     */
    ZoomOut() {
        return this[callerSym](ZoomOutMethod);
    }
    /**
     * Resets the zoom level of the webview content.
     */
    ZoomReset() {
        return this[callerSym](ZoomResetMethod);
    }
    /**
     * Handles file drops originating from platform-specific code (e.g., macOS/Linux native drag-and-drop).
     * Gathers information about the drop target element and sends it back to the Go backend.
     *
     * @param filenames - An array of file paths (strings) that were dropped.
     * @param x - The x-coordinate of the drop event (CSS pixels).
     * @param y - The y-coordinate of the drop event (CSS pixels).
     */
    HandlePlatformFileDrop(filenames, x, y) {
        var _a, _b;
        // Check if file drops are enabled for this window
        if (((_b = (_a = window._wails) === null || _a === void 0 ? void 0 : _a.flags) === null || _b === void 0 ? void 0 : _b.enableFileDrop) === false) {
            return; // File drops disabled, ignore the drop
        }
        const element = document.elementFromPoint(x, y);
        const dropTarget = getDropTargetElement(element);
        if (!dropTarget) {
            // Drop was not on a designated drop target - ignore
            return;
        }
        const elementDetails = {
            id: dropTarget.id,
            classList: Array.from(dropTarget.classList),
            attributes: {},
        };
        for (let i = 0; i < dropTarget.attributes.length; i++) {
            const attr = dropTarget.attributes[i];
            elementDetails.attributes[attr.name] = attr.value;
        }
        const payload = {
            filenames,
            x,
            y,
            elementDetails,
        };
        this[callerSym](FilesDropped, payload);
        // Clean up native drag state after drop
        cleanupNativeDrag();
    }
    /* Triggers Windows 11 Snap Assist feature (Windows only).
     * This is equivalent to pressing Win+Z and shows snap layout options.
     */
    SnapAssist() {
        return this[callerSym](SnapAssistMethod);
    }
    /**
     * Opens the print dialog for the window.
     */
    Print() {
        return this[callerSym](PrintMethod);
    }
}
/**
 * The window within which the script is running.
 */
const thisWindow = new Window('');
/**
 * Sets up global drag and drop event listeners for file drops.
 * Handles visual feedback (hover state) and file drop processing.
 */
function setupDropTargetListeners() {
    const docElement = document.documentElement;
    let dragEnterCounter = 0;
    docElement.addEventListener('dragenter', (event) => {
        var _a, _b, _c;
        if (!((_a = event.dataTransfer) === null || _a === void 0 ? void 0 : _a.types.includes('Files'))) {
            return; // Only handle file drags, let other drags pass through
        }
        event.preventDefault(); // Always prevent default to stop browser navigation
        // On Windows, check if file drops are enabled for this window
        if (((_c = (_b = window._wails) === null || _b === void 0 ? void 0 : _b.flags) === null || _c === void 0 ? void 0 : _c.enableFileDrop) === false) {
            event.dataTransfer.dropEffect = 'none'; // Show "no drop" cursor
            return; // File drops disabled, don't show hover effects
        }
        dragEnterCounter++;
        const targetElement = document.elementFromPoint(event.clientX, event.clientY);
        const dropTarget = getDropTargetElement(targetElement);
        // Update hover state
        if (currentDropTarget && currentDropTarget !== dropTarget) {
            currentDropTarget.classList.remove(DROP_TARGET_ACTIVE_CLASS);
        }
        if (dropTarget) {
            dropTarget.classList.add(DROP_TARGET_ACTIVE_CLASS);
            event.dataTransfer.dropEffect = 'copy';
            currentDropTarget = dropTarget;
        }
        else {
            event.dataTransfer.dropEffect = 'none';
            currentDropTarget = null;
        }
    }, false);
    docElement.addEventListener('dragover', (event) => {
        var _a, _b, _c;
        if (!((_a = event.dataTransfer) === null || _a === void 0 ? void 0 : _a.types.includes('Files'))) {
            return; // Only handle file drags
        }
        event.preventDefault(); // Always prevent default to stop browser navigation
        // On Windows, check if file drops are enabled for this window
        if (((_c = (_b = window._wails) === null || _b === void 0 ? void 0 : _b.flags) === null || _c === void 0 ? void 0 : _c.enableFileDrop) === false) {
            event.dataTransfer.dropEffect = 'none'; // Show "no drop" cursor
            return; // File drops disabled, don't show hover effects
        }
        // Update drop target as cursor moves
        const targetElement = document.elementFromPoint(event.clientX, event.clientY);
        const dropTarget = getDropTargetElement(targetElement);
        if (currentDropTarget && currentDropTarget !== dropTarget) {
            currentDropTarget.classList.remove(DROP_TARGET_ACTIVE_CLASS);
        }
        if (dropTarget) {
            if (!dropTarget.classList.contains(DROP_TARGET_ACTIVE_CLASS)) {
                dropTarget.classList.add(DROP_TARGET_ACTIVE_CLASS);
            }
            event.dataTransfer.dropEffect = 'copy';
            currentDropTarget = dropTarget;
        }
        else {
            event.dataTransfer.dropEffect = 'none';
            currentDropTarget = null;
        }
    }, false);
    docElement.addEventListener('dragleave', (event) => {
        var _a, _b, _c;
        if (!((_a = event.dataTransfer) === null || _a === void 0 ? void 0 : _a.types.includes('Files'))) {
            return;
        }
        event.preventDefault(); // Always prevent default to stop browser navigation
        // On Windows, check if file drops are enabled for this window
        if (((_c = (_b = window._wails) === null || _b === void 0 ? void 0 : _b.flags) === null || _c === void 0 ? void 0 : _c.enableFileDrop) === false) {
            return;
        }
        // On Linux/WebKitGTK and macOS, dragleave fires immediately with relatedTarget=null when native
        // drag handling is involved. Ignore these spurious events - we'll clean up on drop instead.
        if (event.relatedTarget === null) {
            return;
        }
        dragEnterCounter--;
        if (dragEnterCounter === 0 ||
            (currentDropTarget && !currentDropTarget.contains(event.relatedTarget))) {
            if (currentDropTarget) {
                currentDropTarget.classList.remove(DROP_TARGET_ACTIVE_CLASS);
                currentDropTarget = null;
            }
            dragEnterCounter = 0;
        }
    }, false);
    docElement.addEventListener('drop', (event) => {
        var _a, _b, _c;
        if (!((_a = event.dataTransfer) === null || _a === void 0 ? void 0 : _a.types.includes('Files'))) {
            return; // Only handle file drops
        }
        event.preventDefault(); // Always prevent default to stop browser navigation
        // On Windows, check if file drops are enabled for this window
        if (((_c = (_b = window._wails) === null || _b === void 0 ? void 0 : _b.flags) === null || _c === void 0 ? void 0 : _c.enableFileDrop) === false) {
            return;
        }
        dragEnterCounter = 0;
        if (currentDropTarget) {
            currentDropTarget.classList.remove(DROP_TARGET_ACTIVE_CLASS);
            currentDropTarget = null;
        }
        // On Windows, handle file drops via JavaScript
        // On macOS/Linux, native code will call HandlePlatformFileDrop
        if (canResolveFilePaths()) {
            const files = [];
            if (event.dataTransfer.items) {
                for (const item of event.dataTransfer.items) {
                    if (item.kind === 'file') {
                        const file = item.getAsFile();
                        if (file)
                            files.push(file);
                    }
                }
            }
            else if (event.dataTransfer.files) {
                for (const file of event.dataTransfer.files) {
                    files.push(file);
                }
            }
            if (files.length > 0) {
                resolveFilePaths(event.clientX, event.clientY, files);
            }
        }
    }, false);
}
// Initialize listeners when the script loads
if (typeof window !== "undefined" && typeof document !== "undefined") {
    setupDropTargetListeners();
}

/*
 _	   __	  _ __
| |	 / /___ _(_) /____
| | /| / / __ `/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/
// Setup
window._wails = window._wails || {};
// Notify backend
window._wails.invoke = invoke;
window._wails.clientId = clientId;
// Register platform handlers (internal API)
// Note: Window is the thisWindow instance (default export from window.ts)
// Binding ensures 'this' correctly refers to the current window instance
window._wails.handlePlatformFileDrop = thisWindow.HandlePlatformFileDrop.bind(thisWindow);
// Linux-specific drag handlers (GTK intercepts DOM drag events)
window._wails.handleDragEnter = handleDragEnter;
window._wails.handleDragLeave = handleDragLeave;
window._wails.handleDragOver = handleDragOver;
invoke("wails:runtime:ready");
/**
 * Loads a script from the given URL if it exists.
 * Uses HEAD request to check existence, then injects a script tag.
 * Silently ignores if the script doesn't exist.
 */
function loadOptionalScript(url) {
    return fetch(url, { method: 'HEAD' })
        .then(response => {
        if (response.ok) {
            const script = document.createElement('script');
            script.src = url;
            document.head.appendChild(script);
        }
    })
        .catch(() => { }); // Silently ignore - script is optional
}
// Load custom.js if available (used by server mode for WebSocket events, etc.)
loadOptionalScript('/wails/custom.js');

// @ts-check
// Cynhyrchwyd y ffeil hon yn awtomatig. PEIDIWCH Â MODIWL
// This file is automatically generated. DO NOT EDIT


/**
 * @returns {$CancellablePromise<void>}
 */
function ClearClipboard() {
    return ByID(747885572);
}

/**
 * @param {string} id
 * @returns {$CancellablePromise<void>}
 */
function DeleteNote(id) {
    return ByID(1615155726, id);
}

/**
 * @param {string} name
 * @returns {$CancellablePromise<string>}
 */
function GetClipData(name) {
    return ByID(1261390009, name);
}

/**
 * @returns {$CancellablePromise<string>}
 */
function GetNotes() {
    return ByID(84666500);
}

/**
 * @returns {$CancellablePromise<void>}
 */
function Quit() {
    return ByID(3181047470);
}

/**
 * @param {string} content
 * @returns {$CancellablePromise<string>}
 */
function SaveNote(content) {
    return ByID(717593036, content);
}

/**
 * @param {string} hash
 * @returns {$CancellablePromise<void>}
 */
function ToggleClipSecret(hash) {
    return ByID(3964646531, hash);
}

/**
 * @param {string} id
 * @param {string} content
 * @returns {$CancellablePromise<string>}
 */
function UpdateNote$1(id, content) {
    return ByID(3719758856, id, content);
}

/**
 * @returns {$CancellablePromise<void>}
 */
function WindowHide() {
    return ByID(2361993597);
}

/**
 * @returns {$CancellablePromise<void>}
 */
function WindowShow() {
    return ByID(3381873996);
}

var _tmpl$$5 = /* @__PURE__ */ template(`<span class=shell-prompt-icon>$`), _tmpl$2$5 = /* @__PURE__ */ template(`<div class=shell-ghost aria-hidden=true><span class=ghost-typed></span><span class=ghost-suggestion>`), _tmpl$3$4 = /* @__PURE__ */ template(`<div class=search-bar><div class=search-input-wrap><input type=text autocomplete=off></div><button class=search-menu-btn title=Menu><svg width=16 height=16 viewBox="0 0 16 16"fill=currentColor><circle cx=8 cy=3 r=1.5></circle><circle cx=8 cy=8 r=1.5></circle><circle cx=8 cy=13 r=1.5>`), _tmpl$4$4 = /* @__PURE__ */ template(`<svg class=search-icon width=16 height=16 viewBox="0 0 16 16"fill=none stroke=currentColor stroke-width=1.6 stroke-linecap=round stroke-linejoin=round><circle cx=6.5 cy=6.5 r=4.5></circle><line x1=10.5 y1=10.5 x2=14 y2=14>`);
function SearchBar(props) {
  const ghostRemainder = () => {
    const sug = props.suggestion || "";
    const val = props.value || "";
    if (!sug || !val) return "";
    if (sug.toLowerCase().startsWith(val.toLowerCase())) return sug.slice(val.length);
    return "";
  };
  return (() => {
    var _el$ = _tmpl$3$4(), _el$3 = _el$.firstChild, _el$7 = _el$3.firstChild, _el$8 = _el$3.nextSibling;
    insert(_el$, createComponent(Show, {
      get when() {
        return props.isShellMode;
      },
      get fallback() {
        return _tmpl$4$4();
      },
      get children() {
        return _tmpl$$5();
      }
    }), _el$3);
    insert(_el$3, createComponent(Show, {
      get when() {
        return memo(() => !!props.isShellMode)() && ghostRemainder();
      },
      get children() {
        var _el$4 = _tmpl$2$5(), _el$5 = _el$4.firstChild, _el$6 = _el$5.nextSibling;
        insert(_el$5, () => props.value);
        insert(_el$6, ghostRemainder);
        return _el$4;
      }
    }), _el$7);
    _el$7.$$input = (e) => props.onInput(e.target.value);
    var _ref$ = props.ref;
    typeof _ref$ === "function" ? use(_ref$, _el$7) : props.ref = _el$7;
    setAttribute(_el$7, "spellcheck", false);
    addEventListener(_el$8, "click", props.onMenuClick);
    createRenderEffect((_p$) => {
      var _v$ = "search-input" + (props.isShellMode ? " shell-input" : ""), _v$2 = props.placeholder || "Search...";
      _v$ !== _p$.e && className(_el$7, _p$.e = _v$);
      _v$2 !== _p$.t && setAttribute(_el$7, "placeholder", _p$.t = _v$2);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    createRenderEffect(() => _el$7.value = props.value);
    return _el$;
  })();
}
delegateEvents(["input", "click"]);

var _tmpl$$4 = /* @__PURE__ */ template(`<svg class=eye-icon width=13 height=13 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2.2 stroke-linecap=round stroke-linejoin=round><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx=12 cy=12 r=3>`), _tmpl$2$4 = /* @__PURE__ */ template(`<svg class=eye-icon width=13 height=13 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2.2 stroke-linecap=round stroke-linejoin=round><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1=1 y1=1 x2=23 y2=23>`), _tmpl$3$3 = /* @__PURE__ */ template(`<div class=clip-empty>`), _tmpl$4$3 = /* @__PURE__ */ template(`<div class=clipboard-view><div class=clipboard-list>`), _tmpl$5$2 = /* @__PURE__ */ template(`<div><div></div><div class=clip-meta><span class=clip-type></span><div class=clip-meta-right><button class=clip-mask-btn></button><span class=clip-time>`);
const IconEye = () => _tmpl$$4();
const IconEyeSlash = () => _tmpl$2$4();
function ClipboardView(props) {
  return (() => {
    var _el$3 = _tmpl$4$3(), _el$4 = _el$3.firstChild;
    insert(_el$4, createComponent(For, {
      get each() {
        return props.filteredClipboardData;
      },
      children: (item, index) => (() => {
        var _el$6 = _tmpl$5$2(), _el$7 = _el$6.firstChild, _el$8 = _el$7.nextSibling, _el$9 = _el$8.firstChild, _el$0 = _el$9.nextSibling, _el$1 = _el$0.firstChild, _el$10 = _el$1.nextSibling;
        _el$6.$$click = () => props.onItemClick(item);
        insert(_el$7, () => item.content || item.text || "No content");
        insert(_el$9, () => item.type || "text");
        _el$1.$$click = (e) => {
          e.stopPropagation();
          props.onToggleSecret(item);
        };
        insert(_el$1, createComponent(Show, {
          get when() {
            return item.is_secret;
          },
          get fallback() {
            return createComponent(IconEye, {});
          },
          get children() {
            return createComponent(IconEyeSlash, {});
          }
        }));
        insert(_el$10, (() => {
          var _c$ = memo(() => !!item.timestamp);
          return () => _c$() ? new Date(item.timestamp * 1e3).toLocaleTimeString() : "";
        })());
        createRenderEffect((_p$) => {
          var _v$ = `clipboard-item${index() === props.clipboardSelectedIndex ? " selected" : ""}`, _v$2 = `clip-text${item.is_secret ? " masked" : ""}`, _v$3 = item.is_secret ? "Reveal content" : "Mask content";
          _v$ !== _p$.e && className(_el$6, _p$.e = _v$);
          _v$2 !== _p$.t && className(_el$7, _p$.t = _v$2);
          _v$3 !== _p$.a && setAttribute(_el$1, "title", _p$.a = _v$3);
          return _p$;
        }, {
          e: void 0,
          t: void 0,
          a: void 0
        });
        return _el$6;
      })()
    }), null);
    insert(_el$4, createComponent(Show, {
      get when() {
        return props.filteredClipboardData.length === 0;
      },
      get children() {
        var _el$5 = _tmpl$3$3();
        insert(_el$5, () => props.clipboardData.length > 0 ? "No matching items" : "Clipboard is empty");
        return _el$5;
      }
    }), null);
    return _el$3;
  })();
}
delegateEvents(["click"]);

/**
 * marked v18.0.5 - a markdown parser
 * Copyright (c) 2018-2026, MarkedJS. (MIT License)
 * Copyright (c) 2011-2018, Christopher Jeffrey. (MIT License)
 * https://github.com/markedjs/marked
 */

/**
 * DO NOT EDIT THIS FILE
 * The code in this file is generated from files in ./src/
 */

function M(){return {async:false,breaks:false,extensions:null,gfm:true,hooks:null,pedantic:false,renderer:null,silent:false,tokenizer:null,walkTokens:null}}var T=M();function N(l){T=l;}var _={exec:()=>null};function E(l){let e=[];return t=>{let n=Math.max(0,Math.min(3,t-1)),s=e[n];return s||(s=l(n),e[n]=s),s}}function d(l,e=""){let t=typeof l=="string"?l:l.source,n={replace:(s,r)=>{let i=typeof r=="string"?r:r.source;return i=i.replace(m.caret,"$1"),t=t.replace(s,i),n},getRegex:()=>new RegExp(t,e)};return n}var Te=((l="")=>{try{return !!new RegExp("(?<=1)(?<!1)"+l)}catch{return  false}})(),m={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] +\S/,listReplaceTask:/^\[[ xX]\] +/,listTaskCheckbox:/\[[ xX]\]/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:l=>new RegExp(`^( {0,3}${l})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:E(l=>new RegExp(`^ {0,${l}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)),hrRegex:E(l=>new RegExp(`^ {0,${l}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)),fencesBeginRegex:E(l=>new RegExp(`^ {0,${l}}(?:\`\`\`|~~~)`)),headingBeginRegex:E(l=>new RegExp(`^ {0,${l}}#`)),htmlBeginRegex:E(l=>new RegExp(`^ {0,${l}}<(?:[a-z].*>|!--)`,"i")),blockquoteBeginRegex:E(l=>new RegExp(`^ {0,${l}}>`))},Oe=/^(?:[ \t]*(?:\n|$))+/,we=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,ye=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,B=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,Pe=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,j=/ {0,3}(?:[*+-]|\d{1,9}[.)])/,oe=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,ae=d(oe).replace(/bull/g,j).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,"").getRegex(),Se=d(oe).replace(/bull/g,j).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),F=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,$e=/^[^\n]+/,U=/(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/,Le=d(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label",U).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),_e=d(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g,j).getRegex(),H="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",K=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,ze=d("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))","i").replace("comment",K).replace("tag",H).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),le=d(F).replace("hr",B).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",H).getRegex(),Me=d(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",le).getRegex(),W={blockquote:Me,code:we,def:Le,fences:ye,heading:Pe,hr:B,html:ze,lheading:ae,list:_e,newline:Oe,paragraph:le,table:_,text:$e},se=d("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",B).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code","(?: {4}| {0,3}	)[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",H).getRegex(),Ee={...W,lheading:Se,table:se,paragraph:d(F).replace("hr",B).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",se).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",H).getRegex()},Ie={...W,html:d(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment",K).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:_,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:d(F).replace("hr",B).replace("heading",` *#{1,6} *[^
]`).replace("lheading",ae).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},Ae=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,Ce=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,ue=/^( {2,}|\\)\n(?!\s*$)/,Be=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,I=/[\p{P}\p{S}]/u,Z=/[\s\p{P}\p{S}]/u,X=/[^\s\p{P}\p{S}]/u,De=d(/^((?![*_])punctSpace)/,"u").replace(/punctSpace/g,Z).getRegex(),pe=/(?!~)[\p{P}\p{S}]/u,qe=/(?!~)[\s\p{P}\p{S}]/u,ve=/(?:[^\s\p{P}\p{S}]|~)/u,He=d(/link|precode-code|html/,"g").replace("link",/\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-",Te?"(?<!`)()":"(^^|[^`])").replace("code",/(?<b>`+)[^`]+\k<b>(?!`)/).replace("html",/<(?! )[^<>]*?>/).getRegex(),ce=/^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/,Ze=d(ce,"u").replace(/punct/g,I).getRegex(),Ge=d(ce,"u").replace(/punct/g,pe).getRegex(),he="^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",Ne=d(he,"gu").replace(/notPunctSpace/g,X).replace(/punctSpace/g,Z).replace(/punct/g,I).getRegex(),Qe=d(he,"gu").replace(/notPunctSpace/g,ve).replace(/punctSpace/g,qe).replace(/punct/g,pe).getRegex(),je=d("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)","gu").replace(/notPunctSpace/g,X).replace(/punctSpace/g,Z).replace(/punct/g,I).getRegex(),Fe=d(/^~~?(?:((?!~)punct)|[^\s~])/,"u").replace(/punct/g,I).getRegex(),Ue="^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)",Ke=d(Ue,"gu").replace(/notPunctSpace/g,X).replace(/punctSpace/g,Z).replace(/punct/g,I).getRegex(),We=d(/\\(punct)/,"gu").replace(/punct/g,I).getRegex(),Xe=d(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),Je=d(K).replace("(?:-->|$)","-->").getRegex(),Ve=d("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",Je).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),v=/(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/,Ye=d(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label",v).replace("href",/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),ke=d(/^!?\[(label)\]\[(ref)\]/).replace("label",v).replace("ref",U).getRegex(),de=d(/^!?\[(ref)\](?:\[\])?/).replace("ref",U).getRegex(),et=d("reflink|nolink(?!\\()","g").replace("reflink",ke).replace("nolink",de).getRegex(),ie=/[hH][tT][tT][pP][sS]?|[fF][tT][pP]/,J={_backpedal:_,anyPunctuation:We,autolink:Xe,blockSkip:He,br:ue,code:Ce,del:_,delLDelim:_,delRDelim:_,emStrongLDelim:Ze,emStrongRDelimAst:Ne,emStrongRDelimUnd:je,escape:Ae,link:Ye,nolink:de,punctuation:De,reflink:ke,reflinkSearch:et,tag:Ve,text:Be,url:_},tt={...J,link:d(/^!?\[(label)\]\((.*?)\)/).replace("label",v).getRegex(),reflink:d(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",v).getRegex()},Q={...J,emStrongRDelimAst:Qe,emStrongLDelim:Ge,delLDelim:Fe,delRDelim:Ke,url:d(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol",ie).replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,text:d(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol",ie).getRegex()},nt={...Q,br:d(ue).replace("{2,}","*").getRegex(),text:d(Q.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},D={normal:W,gfm:Ee,pedantic:Ie},A={normal:J,gfm:Q,breaks:nt,pedantic:tt};var rt={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},ge=l=>rt[l];function O(l,e){if(e){if(m.escapeTest.test(l))return l.replace(m.escapeReplace,ge)}else if(m.escapeTestNoEncode.test(l))return l.replace(m.escapeReplaceNoEncode,ge);return l}function V(l){try{l=encodeURI(l).replace(m.percentDecode,"%");}catch{return null}return l}function Y(l,e){let t=l.replace(m.findPipe,(r,i,o)=>{let u=false,a=i;for(;--a>=0&&o[a]==="\\";)u=!u;return u?"|":" |"}),n=t.split(m.splitPipe),s=0;if(n[0].trim()||n.shift(),n.length>0&&!n.at(-1)?.trim()&&n.pop(),e)if(n.length>e)n.splice(e);else for(;n.length<e;)n.push("");for(;s<n.length;s++)n[s]=n[s].trim().replace(m.slashPipe,"|");return n}function $(l,e,t){let n=l.length;if(n===0)return "";let s=0;for(;s<n;){let r=l.charAt(n-s-1);if(r===e&&true)s++;else break}return l.slice(0,n-s)}function ee(l){let e=l.split(`
`),t=e.length-1;for(;t>=0&&m.blankLine.test(e[t]);)t--;return e.length-t<=2?l:e.slice(0,t+1).join(`
`)}function fe(l,e){if(l.indexOf(e[1])===-1)return  -1;let t=0;for(let n=0;n<l.length;n++)if(l[n]==="\\")n++;else if(l[n]===e[0])t++;else if(l[n]===e[1]&&(t--,t<0))return n;return t>0?-2:-1}function me(l,e=0){let t=e,n="";for(let s of l)if(s==="	"){let r=4-t%4;n+=" ".repeat(r),t+=r;}else n+=s,t++;return n}function xe(l,e,t,n,s){let r=e.href,i=e.title||null,o=l[1].replace(s.other.outputLinkReplace,"$1");n.state.inLink=true;let u={type:l[0].charAt(0)==="!"?"image":"link",raw:t,href:r,title:i,text:o,tokens:n.inlineTokens(o)};return n.state.inLink=false,u}function st(l,e,t){let n=l.match(t.other.indentCodeCompensation);if(n===null)return e;let s=n[1];return e.split(`
`).map(r=>{let i=r.match(t.other.beginningSpace);if(i===null)return r;let[o]=i;return o.length>=s.length?r.slice(s.length):r}).join(`
`)}var w=class{options;rules;lexer;constructor(e){this.options=e||T;}space(e){let t=this.rules.block.newline.exec(e);if(t&&t[0].length>0)return {type:"space",raw:t[0]}}code(e){let t=this.rules.block.code.exec(e);if(t){let n=this.options.pedantic?t[0]:ee(t[0]),s=n.replace(this.rules.other.codeRemoveIndent,"");return {type:"code",raw:n,codeBlockStyle:"indented",text:s}}}fences(e){let t=this.rules.block.fences.exec(e);if(t){let n=t[0],s=st(n,t[3]||"",this.rules);return {type:"code",raw:n,lang:t[2]?t[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):t[2],text:s}}}heading(e){let t=this.rules.block.heading.exec(e);if(t){let n=t[2].trim();if(this.rules.other.endingHash.test(n)){let s=$(n,"#");(this.options.pedantic||!s||this.rules.other.endingSpaceChar.test(s))&&(n=s.trim());}return {type:"heading",raw:$(t[0],`
`),depth:t[1].length,text:n,tokens:this.lexer.inline(n)}}}hr(e){let t=this.rules.block.hr.exec(e);if(t)return {type:"hr",raw:$(t[0],`
`)}}blockquote(e){let t=this.rules.block.blockquote.exec(e);if(t){let n=$(t[0],`
`).split(`
`),s="",r="",i=[];for(;n.length>0;){let o=false,u=[],a;for(a=0;a<n.length;a++)if(this.rules.other.blockquoteStart.test(n[a]))u.push(n[a]),o=true;else if(!o)u.push(n[a]);else break;n=n.slice(a);let c=u.join(`
`),p=c.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,"");s=s?`${s}
${c}`:c,r=r?`${r}
${p}`:p;let k=this.lexer.state.top;if(this.lexer.state.top=true,this.lexer.blockTokens(p,i,true),this.lexer.state.top=k,n.length===0)break;let h=i.at(-1);if(h?.type==="code")break;if(h?.type==="blockquote"){let R=h,f=R.raw+`
`+n.join(`
`),S=this.blockquote(f);i[i.length-1]=S,s=s.substring(0,s.length-R.raw.length)+S.raw,r=r.substring(0,r.length-R.text.length)+S.text;break}else if(h?.type==="list"){let R=h,f=R.raw+`
`+n.join(`
`),S=this.list(f);i[i.length-1]=S,s=s.substring(0,s.length-h.raw.length)+S.raw,r=r.substring(0,r.length-R.raw.length)+S.raw,n=f.substring(i.at(-1).raw.length).split(`
`);continue}}return {type:"blockquote",raw:s,tokens:i,text:r}}}list(e){let t=this.rules.block.list.exec(e);if(t){let n=t[1].trim(),s=n.length>1,r={type:"list",raw:"",ordered:s,start:s?+n.slice(0,-1):"",loose:false,items:[]};n=s?`\\d{1,9}\\${n.slice(-1)}`:`\\${n}`,this.options.pedantic&&(n=s?n:"[*+-]");let i=this.rules.other.listItemRegex(n),o=false;for(;e;){let a=false,c="",p="";if(!(t=i.exec(e))||this.rules.block.hr.test(e))break;c=t[0],e=e.substring(c.length);let k=me(t[2].split(`
`,1)[0],t[1].length),h=e.split(`
`,1)[0],R=!k.trim(),f=0;if(this.options.pedantic?(f=2,p=k.trimStart()):R?f=t[1].length+1:(f=k.search(this.rules.other.nonSpaceChar),f=f>4?1:f,p=k.slice(f),f+=t[1].length),R&&this.rules.other.blankLine.test(h)&&(c+=h+`
`,e=e.substring(h.length+1),a=true),!a){let S=this.rules.other.nextBulletRegex(f),te=this.rules.other.hrRegex(f),ne=this.rules.other.fencesBeginRegex(f),re=this.rules.other.headingBeginRegex(f),be=this.rules.other.htmlBeginRegex(f),Re=this.rules.other.blockquoteBeginRegex(f);for(;e;){let G=e.split(`
`,1)[0],C;if(h=G,this.options.pedantic?(h=h.replace(this.rules.other.listReplaceNesting,"  "),C=h):C=h.replace(this.rules.other.tabCharGlobal,"    "),ne.test(h)||re.test(h)||be.test(h)||Re.test(h)||S.test(h)||te.test(h))break;if(C.search(this.rules.other.nonSpaceChar)>=f||!h.trim())p+=`
`+C.slice(f);else {if(R||k.replace(this.rules.other.tabCharGlobal,"    ").search(this.rules.other.nonSpaceChar)>=4||ne.test(k)||re.test(k)||te.test(k))break;p+=`
`+h;}R=!h.trim(),c+=G+`
`,e=e.substring(G.length+1),k=C.slice(f);}}r.loose||(o?r.loose=true:this.rules.other.doubleBlankLine.test(c)&&(o=true)),r.items.push({type:"list_item",raw:c,task:!!this.options.gfm&&this.rules.other.listIsTask.test(p),loose:false,text:p,tokens:[]}),r.raw+=c;}let u=r.items.at(-1);if(u)u.raw=u.raw.trimEnd(),u.text=u.text.trimEnd();else return;r.raw=r.raw.trimEnd();for(let a of r.items){this.lexer.state.top=false,a.tokens=this.lexer.blockTokens(a.text,[]);let c=a.tokens[0];if(a.task&&(c?.type==="text"||c?.type==="paragraph")){a.text=a.text.replace(this.rules.other.listReplaceTask,""),c.raw=c.raw.replace(this.rules.other.listReplaceTask,""),c.text=c.text.replace(this.rules.other.listReplaceTask,"");for(let k=this.lexer.inlineQueue.length-1;k>=0;k--)if(this.rules.other.listIsTask.test(this.lexer.inlineQueue[k].src)){this.lexer.inlineQueue[k].src=this.lexer.inlineQueue[k].src.replace(this.rules.other.listReplaceTask,"");break}let p=this.rules.other.listTaskCheckbox.exec(a.raw);if(p){let k={type:"checkbox",raw:p[0]+" ",checked:p[0]!=="[ ]"};a.checked=k.checked,r.loose?a.tokens[0]&&["paragraph","text"].includes(a.tokens[0].type)&&"tokens"in a.tokens[0]&&a.tokens[0].tokens?(a.tokens[0].raw=k.raw+a.tokens[0].raw,a.tokens[0].text=k.raw+a.tokens[0].text,a.tokens[0].tokens.unshift(k)):a.tokens.unshift({type:"paragraph",raw:k.raw,text:k.raw,tokens:[k]}):a.tokens.unshift(k);}}else a.task&&(a.task=false);if(!r.loose){let p=a.tokens.filter(h=>h.type==="space"),k=p.length>0&&p.some(h=>this.rules.other.anyLine.test(h.raw));r.loose=k;}}if(r.loose)for(let a of r.items){a.loose=true;for(let c of a.tokens)c.type==="text"&&(c.type="paragraph");}return r}}html(e){let t=this.rules.block.html.exec(e);if(t){let n=ee(t[0]);return {type:"html",block:true,raw:n,pre:t[1]==="pre"||t[1]==="script"||t[1]==="style",text:n}}}def(e){let t=this.rules.block.def.exec(e);if(t){let n=t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal," "),s=t[2]?t[2].replace(this.rules.other.hrefBrackets,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",r=t[3]?t[3].substring(1,t[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):t[3];return {type:"def",tag:n,raw:$(t[0],`
`),href:s,title:r}}}table(e){let t=this.rules.block.table.exec(e);if(!t||!this.rules.other.tableDelimiter.test(t[2]))return;let n=Y(t[1]),s=t[2].replace(this.rules.other.tableAlignChars,"").split("|"),r=t[3]?.trim()?t[3].replace(this.rules.other.tableRowBlankLine,"").split(`
`):[],i={type:"table",raw:$(t[0],`
`),header:[],align:[],rows:[]};if(n.length===s.length){for(let o of s)this.rules.other.tableAlignRight.test(o)?i.align.push("right"):this.rules.other.tableAlignCenter.test(o)?i.align.push("center"):this.rules.other.tableAlignLeft.test(o)?i.align.push("left"):i.align.push(null);for(let o=0;o<n.length;o++)i.header.push({text:n[o],tokens:this.lexer.inline(n[o]),header:true,align:i.align[o]});for(let o of r)i.rows.push(Y(o,i.header.length).map((u,a)=>({text:u,tokens:this.lexer.inline(u),header:false,align:i.align[a]})));return i}}lheading(e){let t=this.rules.block.lheading.exec(e);if(t){let n=t[1].trim();return {type:"heading",raw:$(t[0],`
`),depth:t[2].charAt(0)==="="?1:2,text:n,tokens:this.lexer.inline(n)}}}paragraph(e){let t=this.rules.block.paragraph.exec(e);if(t){let n=t[1].charAt(t[1].length-1)===`
`?t[1].slice(0,-1):t[1];return {type:"paragraph",raw:t[0],text:n,tokens:this.lexer.inline(n)}}}text(e){let t=this.rules.block.text.exec(e);if(t)return {type:"text",raw:t[0],text:t[0],tokens:this.lexer.inline(t[0])}}escape(e){let t=this.rules.inline.escape.exec(e);if(t)return {type:"escape",raw:t[0],text:t[1]}}tag(e){let t=this.rules.inline.tag.exec(e);if(t)return !this.lexer.state.inLink&&this.rules.other.startATag.test(t[0])?this.lexer.state.inLink=true:this.lexer.state.inLink&&this.rules.other.endATag.test(t[0])&&(this.lexer.state.inLink=false),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(t[0])?this.lexer.state.inRawBlock=true:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(t[0])&&(this.lexer.state.inRawBlock=false),{type:"html",raw:t[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:false,text:t[0]}}link(e){let t=this.rules.inline.link.exec(e);if(t){let n=t[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(n)){if(!this.rules.other.endAngleBracket.test(n))return;let i=$(n.slice(0,-1),"\\");if((n.length-i.length)%2===0)return}else {let i=fe(t[2],"()");if(i===-2)return;if(i>-1){let u=(t[0].indexOf("!")===0?5:4)+t[1].length+i;t[2]=t[2].substring(0,i),t[0]=t[0].substring(0,u).trim(),t[3]="";}}let s=t[2],r="";if(this.options.pedantic){let i=this.rules.other.pedanticHrefTitle.exec(s);i&&(s=i[1],r=i[3]);}else r=t[3]?t[3].slice(1,-1):"";return s=s.trim(),this.rules.other.startAngleBracket.test(s)&&(this.options.pedantic&&!this.rules.other.endAngleBracket.test(n)?s=s.slice(1):s=s.slice(1,-1)),xe(t,{href:s&&s.replace(this.rules.inline.anyPunctuation,"$1"),title:r&&r.replace(this.rules.inline.anyPunctuation,"$1")},t[0],this.lexer,this.rules)}}reflink(e,t){let n;if((n=this.rules.inline.reflink.exec(e))||(n=this.rules.inline.nolink.exec(e))){let s=(n[2]||n[1]).replace(this.rules.other.multipleSpaceGlobal," "),r=t[s.toLowerCase()];if(!r){let i=n[0].charAt(0);return {type:"text",raw:i,text:i}}return xe(n,r,n[0],this.lexer,this.rules)}}emStrong(e,t,n=""){let s=this.rules.inline.emStrongLDelim.exec(e);if(!s||!s[1]&&!s[2]&&!s[3]&&!s[4]||s[4]&&n.match(this.rules.other.unicodeAlphaNumeric))return;if(!(s[1]||s[3]||"")||!n||this.rules.inline.punctuation.exec(n)){let i=[...s[0]].length-1,o,u,a=i,c=0,p=s[0][0]==="*"?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(p.lastIndex=0,t=t.slice(-1*e.length+i);(s=p.exec(t))!==null;){if(o=s[1]||s[2]||s[3]||s[4]||s[5]||s[6],!o)continue;if(u=[...o].length,s[3]||s[4]){a+=u;continue}else if((s[5]||s[6])&&i%3&&!((i+u)%3)){c+=u;continue}if(a-=u,a>0)continue;u=Math.min(u,u+a+c);let k=[...s[0]][0].length,h=e.slice(0,i+s.index+k+u);if(Math.min(i,u)%2){let f=h.slice(1,-1);return {type:"em",raw:h,text:f,tokens:this.lexer.inlineTokens(f)}}let R=h.slice(2,-2);return {type:"strong",raw:h,text:R,tokens:this.lexer.inlineTokens(R)}}}}codespan(e){let t=this.rules.inline.code.exec(e);if(t){let n=t[2].replace(this.rules.other.newLineCharGlobal," "),s=this.rules.other.nonSpaceChar.test(n),r=this.rules.other.startingSpaceChar.test(n)&&this.rules.other.endingSpaceChar.test(n);return s&&r&&(n=n.substring(1,n.length-1)),{type:"codespan",raw:t[0],text:n}}}br(e){let t=this.rules.inline.br.exec(e);if(t)return {type:"br",raw:t[0]}}del(e,t,n=""){let s=this.rules.inline.delLDelim.exec(e);if(!s)return;if(!(s[1]||"")||!n||this.rules.inline.punctuation.exec(n)){let i=[...s[0]].length-1,o,u,a=i,c=this.rules.inline.delRDelim;for(c.lastIndex=0,t=t.slice(-1*e.length+i);(s=c.exec(t))!==null;){if(o=s[1]||s[2]||s[3]||s[4]||s[5]||s[6],!o||(u=[...o].length,u!==i))continue;if(s[3]||s[4]){a+=u;continue}if(a-=u,a>0)continue;u=Math.min(u,u+a);let p=[...s[0]][0].length,k=e.slice(0,i+s.index+p+u),h=k.slice(i,-i);return {type:"del",raw:k,text:h,tokens:this.lexer.inlineTokens(h)}}}}autolink(e){let t=this.rules.inline.autolink.exec(e);if(t){let n,s;return t[2]==="@"?(n=t[1],s="mailto:"+n):(n=t[1],s=n),{type:"link",raw:t[0],text:n,href:s,tokens:[{type:"text",raw:n,text:n}]}}}url(e){let t;if(t=this.rules.inline.url.exec(e)){let n,s;if(t[2]==="@")n=t[0],s="mailto:"+n;else {let r;do r=t[0],t[0]=this.rules.inline._backpedal.exec(t[0])?.[0]??"";while(r!==t[0]);n=t[0],t[1]==="www."?s="http://"+t[0]:s=t[0];}return {type:"link",raw:t[0],text:n,href:s,tokens:[{type:"text",raw:n,text:n}]}}}inlineText(e){let t=this.rules.inline.text.exec(e);if(t){let n=this.lexer.state.inRawBlock;return {type:"text",raw:t[0],text:t[0],escaped:n}}}};var x=class l{tokens;options;state;inlineQueue;tokenizer;constructor(e){this.tokens=[],this.tokens.links=Object.create(null),this.options=e||T,this.options.tokenizer=this.options.tokenizer||new w,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:false,inRawBlock:false,top:true};let t={other:m,block:D.normal,inline:A.normal};this.options.pedantic?(t.block=D.pedantic,t.inline=A.pedantic):this.options.gfm&&(t.block=D.gfm,this.options.breaks?t.inline=A.breaks:t.inline=A.gfm),this.tokenizer.rules=t;}static get rules(){return {block:D,inline:A}}static lex(e,t){return new l(t).lex(e)}static lexInline(e,t){return new l(t).inlineTokens(e)}lex(e){e=e.replace(m.carriageReturn,`
`),this.blockTokens(e,this.tokens);for(let t=0;t<this.inlineQueue.length;t++){let n=this.inlineQueue[t];this.inlineTokens(n.src,n.tokens);}return this.inlineQueue=[],this.tokens}blockTokens(e,t=[],n=false){this.tokenizer.lexer=this,this.options.pedantic&&(e=e.replace(m.tabCharGlobal,"    ").replace(m.spaceLine,""));let s=1/0;for(;e;){if(e.length<s)s=e.length;else {this.infiniteLoopError(e.charCodeAt(0));break}let r;if(this.options.extensions?.block?.some(o=>(r=o.call({lexer:this},e,t))?(e=e.substring(r.raw.length),t.push(r),true):false))continue;if(r=this.tokenizer.space(e)){e=e.substring(r.raw.length);let o=t.at(-1);r.raw.length===1&&o!==void 0?o.raw+=`
`:t.push(r);continue}if(r=this.tokenizer.code(e)){e=e.substring(r.raw.length);let o=t.at(-1);o?.type==="paragraph"||o?.type==="text"?(o.raw+=(o.raw.endsWith(`
`)?"":`
`)+r.raw,o.text+=`
`+r.text,this.inlineQueue.at(-1).src=o.text):t.push(r);continue}if(r=this.tokenizer.fences(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.heading(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.hr(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.blockquote(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.list(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.html(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.def(e)){e=e.substring(r.raw.length);let o=t.at(-1);o?.type==="paragraph"||o?.type==="text"?(o.raw+=(o.raw.endsWith(`
`)?"":`
`)+r.raw,o.text+=`
`+r.raw,this.inlineQueue.at(-1).src=o.text):this.tokens.links[r.tag]||(this.tokens.links[r.tag]={href:r.href,title:r.title},t.push(r));continue}if(r=this.tokenizer.table(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.lheading(e)){e=e.substring(r.raw.length),t.push(r);continue}let i=e;if(this.options.extensions?.startBlock){let o=1/0,u=e.slice(1),a;this.options.extensions.startBlock.forEach(c=>{a=c.call({lexer:this},u),typeof a=="number"&&a>=0&&(o=Math.min(o,a));}),o<1/0&&o>=0&&(i=e.substring(0,o+1));}if(this.state.top&&(r=this.tokenizer.paragraph(i))){let o=t.at(-1);n&&o?.type==="paragraph"?(o.raw+=(o.raw.endsWith(`
`)?"":`
`)+r.raw,o.text+=`
`+r.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=o.text):t.push(r),n=i.length!==e.length,e=e.substring(r.raw.length);continue}if(r=this.tokenizer.text(e)){e=e.substring(r.raw.length);let o=t.at(-1);o?.type==="text"?(o.raw+=(o.raw.endsWith(`
`)?"":`
`)+r.raw,o.text+=`
`+r.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=o.text):t.push(r);continue}if(e){this.infiniteLoopError(e.charCodeAt(0));break}}return this.state.top=true,t}inline(e,t=[]){return this.inlineQueue.push({src:e,tokens:t}),t}inlineTokens(e,t=[]){this.tokenizer.lexer=this;let n=e,s=null;if(this.tokens.links){let a=Object.keys(this.tokens.links);if(a.length>0)for(;(s=this.tokenizer.rules.inline.reflinkSearch.exec(n))!==null;)a.includes(s[0].slice(s[0].lastIndexOf("[")+1,-1))&&(n=n.slice(0,s.index)+"["+"a".repeat(s[0].length-2)+"]"+n.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex));}for(;(s=this.tokenizer.rules.inline.anyPunctuation.exec(n))!==null;)n=n.slice(0,s.index)+"++"+n.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);let r;for(;(s=this.tokenizer.rules.inline.blockSkip.exec(n))!==null;)r=s[2]?s[2].length:0,n=n.slice(0,s.index+r)+"["+"a".repeat(s[0].length-r-2)+"]"+n.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);n=this.options.hooks?.emStrongMask?.call({lexer:this},n)??n;let i=false,o="",u=1/0;for(;e;){if(e.length<u)u=e.length;else {this.infiniteLoopError(e.charCodeAt(0));break}i||(o=""),i=false;let a;if(this.options.extensions?.inline?.some(p=>(a=p.call({lexer:this},e,t))?(e=e.substring(a.raw.length),t.push(a),true):false))continue;if(a=this.tokenizer.escape(e)){e=e.substring(a.raw.length),t.push(a);continue}if(a=this.tokenizer.tag(e)){e=e.substring(a.raw.length),t.push(a);continue}if(a=this.tokenizer.link(e)){e=e.substring(a.raw.length),t.push(a);continue}if(a=this.tokenizer.reflink(e,this.tokens.links)){e=e.substring(a.raw.length);let p=t.at(-1);a.type==="text"&&p?.type==="text"?(p.raw+=a.raw,p.text+=a.text):t.push(a);continue}if(a=this.tokenizer.emStrong(e,n,o)){e=e.substring(a.raw.length),t.push(a);continue}if(a=this.tokenizer.codespan(e)){e=e.substring(a.raw.length),t.push(a);continue}if(a=this.tokenizer.br(e)){e=e.substring(a.raw.length),t.push(a);continue}if(a=this.tokenizer.del(e,n,o)){e=e.substring(a.raw.length),t.push(a);continue}if(a=this.tokenizer.autolink(e)){e=e.substring(a.raw.length),t.push(a);continue}if(!this.state.inLink&&(a=this.tokenizer.url(e))){e=e.substring(a.raw.length),t.push(a);continue}let c=e;if(this.options.extensions?.startInline){let p=1/0,k=e.slice(1),h;this.options.extensions.startInline.forEach(R=>{h=R.call({lexer:this},k),typeof h=="number"&&h>=0&&(p=Math.min(p,h));}),p<1/0&&p>=0&&(c=e.substring(0,p+1));}if(a=this.tokenizer.inlineText(c)){e=e.substring(a.raw.length),a.raw.slice(-1)!=="_"&&(o=a.raw.slice(-1)),i=true;let p=t.at(-1);p?.type==="text"?(p.raw+=a.raw,p.text+=a.text):t.push(a);continue}if(e){this.infiniteLoopError(e.charCodeAt(0));break}}return t}infiniteLoopError(e){let t="Infinite loop on byte: "+e;if(this.options.silent)console.error(t);else throw new Error(t)}};var y=class{options;parser;constructor(e){this.options=e||T;}space(e){return ""}code({text:e,lang:t,escaped:n}){let s=(t||"").match(m.notSpaceStart)?.[0],r=e.replace(m.endingNewline,"")+`
`;return s?'<pre><code class="language-'+O(s)+'">'+(n?r:O(r,true))+`</code></pre>
`:"<pre><code>"+(n?r:O(r,true))+`</code></pre>
`}blockquote({tokens:e}){return `<blockquote>
${this.parser.parse(e)}</blockquote>
`}html({text:e}){return e}def(e){return ""}heading({tokens:e,depth:t}){return `<h${t}>${this.parser.parseInline(e)}</h${t}>
`}hr(e){return `<hr>
`}list(e){let t=e.ordered,n=e.start,s="";for(let o=0;o<e.items.length;o++){let u=e.items[o];s+=this.listitem(u);}let r=t?"ol":"ul",i=t&&n!==1?' start="'+n+'"':"";return "<"+r+i+`>
`+s+"</"+r+`>
`}listitem(e){return `<li>${this.parser.parse(e.tokens)}</li>
`}checkbox({checked:e}){return "<input "+(e?'checked="" ':"")+'disabled="" type="checkbox"> '}paragraph({tokens:e}){return `<p>${this.parser.parseInline(e)}</p>
`}table(e){let t="",n="";for(let r=0;r<e.header.length;r++)n+=this.tablecell(e.header[r]);t+=this.tablerow({text:n});let s="";for(let r=0;r<e.rows.length;r++){let i=e.rows[r];n="";for(let o=0;o<i.length;o++)n+=this.tablecell(i[o]);s+=this.tablerow({text:n});}return s&&(s=`<tbody>${s}</tbody>`),`<table>
<thead>
`+t+`</thead>
`+s+`</table>
`}tablerow({text:e}){return `<tr>
${e}</tr>
`}tablecell(e){let t=this.parser.parseInline(e.tokens),n=e.header?"th":"td";return (e.align?`<${n} align="${e.align}">`:`<${n}>`)+t+`</${n}>
`}strong({tokens:e}){return `<strong>${this.parser.parseInline(e)}</strong>`}em({tokens:e}){return `<em>${this.parser.parseInline(e)}</em>`}codespan({text:e}){return `<code>${O(e,true)}</code>`}br(e){return "<br>"}del({tokens:e}){return `<del>${this.parser.parseInline(e)}</del>`}link({href:e,title:t,tokens:n}){let s=this.parser.parseInline(n),r=V(e);if(r===null)return s;e=r;let i='<a href="'+e+'"';return t&&(i+=' title="'+O(t)+'"'),i+=">"+s+"</a>",i}image({href:e,title:t,text:n,tokens:s}){s&&(n=this.parser.parseInline(s,this.parser.textRenderer));let r=V(e);if(r===null)return O(n);e=r;let i=`<img src="${e}" alt="${O(n)}"`;return t&&(i+=` title="${O(t)}"`),i+=">",i}text(e){return "tokens"in e&&e.tokens?this.parser.parseInline(e.tokens):"escaped"in e&&e.escaped?e.text:O(e.text)}};var L=class{strong({text:e}){return e}em({text:e}){return e}codespan({text:e}){return e}del({text:e}){return e}html({text:e}){return e}text({text:e}){return e}link({text:e}){return ""+e}image({text:e}){return ""+e}br(){return ""}checkbox({raw:e}){return e}};var b=class l{options;renderer;textRenderer;constructor(e){this.options=e||T,this.options.renderer=this.options.renderer||new y,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new L;}static parse(e,t){return new l(t).parse(e)}static parseInline(e,t){return new l(t).parseInline(e)}parse(e){this.renderer.parser=this;let t="";for(let n=0;n<e.length;n++){let s=e[n];if(this.options.extensions?.renderers?.[s.type]){let i=s,o=this.options.extensions.renderers[i.type].call({parser:this},i);if(o!==false||!["space","hr","heading","code","table","blockquote","list","html","def","paragraph","text"].includes(i.type)){t+=o||"";continue}}let r=s;switch(r.type){case "space":{t+=this.renderer.space(r);break}case "hr":{t+=this.renderer.hr(r);break}case "heading":{t+=this.renderer.heading(r);break}case "code":{t+=this.renderer.code(r);break}case "table":{t+=this.renderer.table(r);break}case "blockquote":{t+=this.renderer.blockquote(r);break}case "list":{t+=this.renderer.list(r);break}case "checkbox":{t+=this.renderer.checkbox(r);break}case "html":{t+=this.renderer.html(r);break}case "def":{t+=this.renderer.def(r);break}case "paragraph":{t+=this.renderer.paragraph(r);break}case "text":{t+=this.renderer.text(r);break}default:{let i='Token with "'+r.type+'" type was not found.';if(this.options.silent)return console.error(i),"";throw new Error(i)}}}return t}parseInline(e,t=this.renderer){this.renderer.parser=this;let n="";for(let s=0;s<e.length;s++){let r=e[s];if(this.options.extensions?.renderers?.[r.type]){let o=this.options.extensions.renderers[r.type].call({parser:this},r);if(o!==false||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(r.type)){n+=o||"";continue}}let i=r;switch(i.type){case "escape":{n+=t.text(i);break}case "html":{n+=t.html(i);break}case "link":{n+=t.link(i);break}case "image":{n+=t.image(i);break}case "checkbox":{n+=t.checkbox(i);break}case "strong":{n+=t.strong(i);break}case "em":{n+=t.em(i);break}case "codespan":{n+=t.codespan(i);break}case "br":{n+=t.br(i);break}case "del":{n+=t.del(i);break}case "text":{n+=t.text(i);break}default:{let o='Token with "'+i.type+'" type was not found.';if(this.options.silent)return console.error(o),"";throw new Error(o)}}}return n}};var P=class{options;block;constructor(e){this.options=e||T;}static passThroughHooks=new Set(["preprocess","postprocess","processAllTokens","emStrongMask"]);static passThroughHooksRespectAsync=new Set(["preprocess","postprocess","processAllTokens"]);preprocess(e){return e}postprocess(e){return e}processAllTokens(e){return e}emStrongMask(e){return e}provideLexer(e=this.block){return e?x.lex:x.lexInline}provideParser(e=this.block){return e?b.parse:b.parseInline}};var q=class{defaults=M();options=this.setOptions;parse=this.parseMarkdown(true);parseInline=this.parseMarkdown(false);Parser=b;Renderer=y;TextRenderer=L;Lexer=x;Tokenizer=w;Hooks=P;constructor(...e){this.use(...e);}walkTokens(e,t){let n=[];for(let s of e)switch(n=n.concat(t.call(this,s)),s.type){case "table":{let r=s;for(let i of r.header)n=n.concat(this.walkTokens(i.tokens,t));for(let i of r.rows)for(let o of i)n=n.concat(this.walkTokens(o.tokens,t));break}case "list":{let r=s;n=n.concat(this.walkTokens(r.items,t));break}default:{let r=s;this.defaults.extensions?.childTokens?.[r.type]?this.defaults.extensions.childTokens[r.type].forEach(i=>{let o=r[i].flat(1/0);n=n.concat(this.walkTokens(o,t));}):r.tokens&&(n=n.concat(this.walkTokens(r.tokens,t)));}}return n}use(...e){let t=this.defaults.extensions||{renderers:{},childTokens:{}};return e.forEach(n=>{let s={...n};if(s.async=this.defaults.async||s.async||false,n.extensions&&(n.extensions.forEach(r=>{if(!r.name)throw new Error("extension name required");if("renderer"in r){let i=t.renderers[r.name];i?t.renderers[r.name]=function(...o){let u=r.renderer.apply(this,o);return u===false&&(u=i.apply(this,o)),u}:t.renderers[r.name]=r.renderer;}if("tokenizer"in r){if(!r.level||r.level!=="block"&&r.level!=="inline")throw new Error("extension level must be 'block' or 'inline'");let i=t[r.level];i?i.unshift(r.tokenizer):t[r.level]=[r.tokenizer],r.start&&(r.level==="block"?t.startBlock?t.startBlock.push(r.start):t.startBlock=[r.start]:r.level==="inline"&&(t.startInline?t.startInline.push(r.start):t.startInline=[r.start]));}"childTokens"in r&&r.childTokens&&(t.childTokens[r.name]=r.childTokens);}),s.extensions=t),n.renderer){let r=this.defaults.renderer||new y(this.defaults);for(let i in n.renderer){if(!(i in r))throw new Error(`renderer '${i}' does not exist`);if(["options","parser"].includes(i))continue;let o=i,u=n.renderer[o],a=r[o];r[o]=(...c)=>{let p=u.apply(r,c);return p===false&&(p=a.apply(r,c)),p||""};}s.renderer=r;}if(n.tokenizer){let r=this.defaults.tokenizer||new w(this.defaults);for(let i in n.tokenizer){if(!(i in r))throw new Error(`tokenizer '${i}' does not exist`);if(["options","rules","lexer"].includes(i))continue;let o=i,u=n.tokenizer[o],a=r[o];r[o]=(...c)=>{let p=u.apply(r,c);return p===false&&(p=a.apply(r,c)),p};}s.tokenizer=r;}if(n.hooks){let r=this.defaults.hooks||new P;for(let i in n.hooks){if(!(i in r))throw new Error(`hook '${i}' does not exist`);if(["options","block"].includes(i))continue;let o=i,u=n.hooks[o],a=r[o];P.passThroughHooks.has(i)?r[o]=c=>{if(this.defaults.async&&P.passThroughHooksRespectAsync.has(i))return (async()=>{let k=await u.call(r,c);return a.call(r,k)})();let p=u.call(r,c);return a.call(r,p)}:r[o]=(...c)=>{if(this.defaults.async)return (async()=>{let k=await u.apply(r,c);return k===false&&(k=await a.apply(r,c)),k})();let p=u.apply(r,c);return p===false&&(p=a.apply(r,c)),p};}s.hooks=r;}if(n.walkTokens){let r=this.defaults.walkTokens,i=n.walkTokens;s.walkTokens=function(o){let u=[];return u.push(i.call(this,o)),r&&(u=u.concat(r.call(this,o))),u};}this.defaults={...this.defaults,...s};}),this}setOptions(e){return this.defaults={...this.defaults,...e},this}lexer(e,t){return x.lex(e,t??this.defaults)}parser(e,t){return b.parse(e,t??this.defaults)}parseMarkdown(e){return (n,s)=>{let r={...s},i={...this.defaults,...r},o=this.onError(!!i.silent,!!i.async);if(this.defaults.async===true&&r.async===false)return o(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(typeof n>"u"||n===null)return o(new Error("marked(): input parameter is undefined or null"));if(typeof n!="string")return o(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(n)+", string expected"));if(i.hooks&&(i.hooks.options=i,i.hooks.block=e),i.async)return (async()=>{let u=i.hooks?await i.hooks.preprocess(n):n,c=await(i.hooks?await i.hooks.provideLexer(e):e?x.lex:x.lexInline)(u,i),p=i.hooks?await i.hooks.processAllTokens(c):c;i.walkTokens&&await Promise.all(this.walkTokens(p,i.walkTokens));let h=await(i.hooks?await i.hooks.provideParser(e):e?b.parse:b.parseInline)(p,i);return i.hooks?await i.hooks.postprocess(h):h})().catch(o);try{i.hooks&&(n=i.hooks.preprocess(n));let a=(i.hooks?i.hooks.provideLexer(e):e?x.lex:x.lexInline)(n,i);i.hooks&&(a=i.hooks.processAllTokens(a)),i.walkTokens&&this.walkTokens(a,i.walkTokens);let p=(i.hooks?i.hooks.provideParser(e):e?b.parse:b.parseInline)(a,i);return i.hooks&&(p=i.hooks.postprocess(p)),p}catch(u){return o(u)}}}onError(e,t){return n=>{if(n.message+=`
Please report this to https://github.com/markedjs/marked.`,e){let s="<p>An error occurred:</p><pre>"+O(n.message+"",true)+"</pre>";return t?Promise.resolve(s):s}if(t)return Promise.reject(n);throw n}}};var z=new q;function g(l,e){return z.parse(l,e)}g.options=g.setOptions=function(l){return z.setOptions(l),g.defaults=z.defaults,N(g.defaults),g};g.getDefaults=M;g.defaults=T;g.use=function(...l){return z.use(...l),g.defaults=z.defaults,N(g.defaults),g};g.walkTokens=function(l,e){return z.walkTokens(l,e)};g.parseInline=z.parseInline;g.Parser=b;g.parser=b.parse;g.Renderer=y;g.TextRenderer=L;g.Lexer=x;g.lexer=x.lex;g.Tokenizer=w;g.Hooks=P;g.parse=g;g.options;g.setOptions;g.use;g.walkTokens;g.parseInline;b.parse;x.lex;

var _tmpl$$3 = /* @__PURE__ */ template(`<div class=notes-empty><svg width=28 height=28 viewBox="0 0 28 28"fill=none stroke=currentColor stroke-width=1.3 stroke-linecap=round stroke-linejoin=round style=opacity:0.22;margin-bottom:8px><path d="M6 4h13a2 2 0 012 2v14l-5 5H6a2 2 0 01-2-2V6a2 2 0 012-2z"></path><line x1=9 y1=10 x2=17 y2=10></line><line x1=9 y1=14 x2=13 y2=14></line></svg><div class=notes-empty-sub>Click + to create one`), _tmpl$2$3 = /* @__PURE__ */ template(`<div class=notes-list>`), _tmpl$3$2 = /* @__PURE__ */ template(`<button class=notes-fab title="New note"><svg width=15 height=15 viewBox="0 0 15 15"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><path d="M11.5 1.5 L13.5 3.5 L5.5 11.5 L2 13 L3.5 9.5 Z"></path><line x1=9.5 y1=3.5 x2=11.5 y2=5.5>`), _tmpl$4$2 = /* @__PURE__ */ template(`<div class=notes-panel><div class=notes-panel-bar><button class=note-nav-btn><svg width=14 height=14 viewBox="0 0 14 14"fill=none stroke=currentColor stroke-width=1.8 stroke-linecap=round stroke-linejoin=round><polyline points="9,2 4,7 9,12"></polyline></svg>Back</button><div class=note-panel-meta><span class=note-row-date></span></div><div class=note-panel-actions><button class=note-action-btn><svg width=12 height=12 viewBox="0 0 12 12"fill=none stroke=currentColor stroke-width=1.7 stroke-linecap=round stroke-linejoin=round><path d="M8.5 1.5l2 2L3 11H1V9z"></path></svg>Edit</button><button class="note-action-btn danger"><svg width=12 height=12 viewBox="0 0 12 12"fill=none stroke=currentColor stroke-width=1.7 stroke-linecap=round><polyline points="1,3 11,3"></polyline><path d=M4,3V1.5h4V3></path><path d=M2,3l.7,7.5h6.6L10,3></path></svg>Delete</button></div></div><div class=notes-preview-body><div class=md-body>`), _tmpl$5$1 = /* @__PURE__ */ template(`<div class=notes-panel><div class=notes-panel-bar><button class=note-nav-btn><svg width=14 height=14 viewBox="0 0 14 14"fill=none stroke=currentColor stroke-width=1.8 stroke-linecap=round stroke-linejoin=round><polyline points="9,2 4,7 9,12"></polyline></svg>List</button><div class=note-panel-actions style=margin-left:auto><button class=notes-save-btn>Save ⌘↵</button></div></div><textarea class=notes-textarea placeholder="Write in markdown…">`), _tmpl$6$1 = /* @__PURE__ */ template(`<div class=notes-view>`), _tmpl$7$1 = /* @__PURE__ */ template(`<div class=note-row><div class=note-row-fileid></div><div class=note-row-preview></div><div class=note-row-top><span class=note-row-date></span><button class=note-row-del title=Delete><svg width=10 height=10 viewBox="0 0 10 10"fill=none stroke=currentColor stroke-width=1.8 stroke-linecap=round><line x1=1 y1=1 x2=9 y2=9></line><line x1=9 y1=1 x2=1 y2=9>`);
g.use({
  renderer: {
    code({
      text = ""
    } = {}) {
      const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<pre class="md-code"><code>${esc}</code></pre>`;
    },
    codespan({
      text = ""
    } = {}) {
      const esc = (typeof text === "string" ? text : String(text)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<code class="md-inline-code">${esc}</code>`;
    }
  },
  gfm: true,
  breaks: true
});
function renderMarkdown(text) {
  try {
    return g.parse(text || "");
  } catch {
    return `<p>${text || ""}</p>`;
  }
}
function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(void 0, {
      month: "short",
      day: "numeric"
    });
  } catch {
    return "";
  }
}
function NotesView(props) {
  const [view, setView] = createSignal("edit");
  const [activeNote, setActiveNote] = createSignal(null);
  const [editContent, setEditContent] = createSignal("");
  let textareaRef;
  const visibleNotes = createMemo(() => {
    return props.notes;
  });
  const openPreview = (note) => {
    setActiveNote(note);
    setView("preview");
  };
  const openEdit = (note) => {
    setActiveNote(note || null);
    setEditContent(note?.content || "");
    setView("edit");
    setTimeout(() => textareaRef?.focus(), 30);
  };
  const goBack = () => {
    if (view() === "preview") {
      setView("list");
      setActiveNote(null);
      return;
    }
    if (view() === "edit") {
      setView(activeNote() ? "preview" : "list");
      return;
    }
  };
  const handleSave = async () => {
    const content = editContent().trim();
    if (!content) return;
    if (activeNote()) {
      await UpdateNote(activeNote().id, content);
    } else {
      await props.onSave(content);
    }
    await props.onReload();
    setView("list");
    setActiveNote(null);
  };
  const handleDelete = async (id) => {
    await props.onDelete(id);
    await props.onReload();
    setView("list");
    setActiveNote(null);
  };
  const handleTextareaKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") goBack();
  };
  return (() => {
    var _el$ = _tmpl$6$1();
    insert(_el$, createComponent(Show, {
      get when() {
        return view() === "list";
      },
      get children() {
        return [(() => {
          var _el$2 = _tmpl$2$3();
          insert(_el$2, createComponent(Show, {
            get when() {
              return visibleNotes().length === 0;
            },
            get children() {
              return _tmpl$$3();
            }
          }), null);
          insert(_el$2, createComponent(For, {
            get each() {
              return visibleNotes();
            },
            children: (note) => {
              const preview = (note.content || "").split("\n").find((l) => l.trim()) || "";
              const clean = preview.replace(/^#+\s*/, "").replace(/[*_`]/g, "").slice(0, 72);
              const fileId = note.id.split("_").join(" ");
              return (() => {
                var _el$19 = _tmpl$7$1(), _el$20 = _el$19.firstChild, _el$21 = _el$20.nextSibling, _el$22 = _el$21.nextSibling, _el$23 = _el$22.firstChild, _el$24 = _el$23.nextSibling;
                _el$19.$$click = () => openPreview(note);
                insert(_el$20, ` ${fileId}` || "(empty)");
                insert(_el$21, ` ${clean}` || "(empty)");
                insert(_el$23, () => fmtDate(note.createdAt));
                _el$24.$$click = (e) => {
                  e.stopPropagation();
                  handleDelete(note.id);
                };
                return _el$19;
              })();
            }
          }), null);
          return _el$2;
        })(), (() => {
          var _el$4 = _tmpl$3$2();
          _el$4.$$click = () => openEdit(null);
          return _el$4;
        })()];
      }
    }), null);
    insert(_el$, createComponent(Show, {
      get when() {
        return view() === "preview";
      },
      get children() {
        var _el$5 = _tmpl$4$2(), _el$6 = _el$5.firstChild, _el$7 = _el$6.firstChild, _el$8 = _el$7.nextSibling, _el$9 = _el$8.firstChild, _el$0 = _el$8.nextSibling, _el$1 = _el$0.firstChild, _el$10 = _el$1.nextSibling, _el$11 = _el$6.nextSibling, _el$12 = _el$11.firstChild;
        _el$7.$$click = goBack;
        insert(_el$9, () => fmtDate(activeNote()?.updatedAt || activeNote()?.createdAt));
        _el$1.$$click = () => openEdit(activeNote());
        _el$10.$$click = () => handleDelete(activeNote().id);
        createRenderEffect(() => _el$12.innerHTML = renderMarkdown(activeNote()?.content || ""));
        return _el$5;
      }
    }), null);
    insert(_el$, createComponent(Show, {
      get when() {
        return view() === "edit";
      },
      get children() {
        var _el$13 = _tmpl$5$1(), _el$14 = _el$13.firstChild, _el$15 = _el$14.firstChild, _el$16 = _el$15.nextSibling, _el$17 = _el$16.firstChild, _el$18 = _el$14.nextSibling;
        _el$15.$$click = goBack;
        _el$17.$$click = handleSave;
        _el$18.$$keydown = handleTextareaKey;
        _el$18.$$input = (e) => setEditContent(e.target.value);
        var _ref$ = textareaRef;
        typeof _ref$ === "function" ? use(_ref$, _el$18) : textareaRef = _el$18;
        createRenderEffect(() => _el$17.disabled = !editContent().trim());
        createRenderEffect(() => _el$18.value = editContent());
        return _el$13;
      }
    }), null);
    return _el$;
  })();
}
delegateEvents(["click", "input", "keydown"]);

var _tmpl$$2 = /* @__PURE__ */ template(`<div class=settings-overlay><div class=settings-panel><div class=settings-header><span class=settings-title>Settings</span><button class=settings-close title=Close><svg width=11 height=11 viewBox="0 0 11 11"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round><line x1=1 y1=1 x2=10 y2=10></line><line x1=10 y1=1 x2=1 y2=10></line></svg></button></div><div class=settings-section><div class=settings-label>Notes folder</div><div class=settings-row><span class=settings-path></span><button class=settings-browse-btn>Browse…</button></div><div class=settings-hint>Markdown files are saved here, one per note.`);
function SettingsView(props) {
  const [notesDir, setNotesDir] = createSignal("");
  onMount(async () => {
    const dir = await GetNotesDir();
    setNotesDir(dir);
  });
  const handleBrowse = async () => {
    const newDir = await ChooseNotesDir();
    setNotesDir(newDir);
  };
  return (() => {
    var _el$ = _tmpl$$2(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.nextSibling, _el$6 = _el$3.nextSibling, _el$7 = _el$6.firstChild, _el$8 = _el$7.nextSibling, _el$9 = _el$8.firstChild, _el$0 = _el$9.nextSibling;
    addEventListener(_el$5, "click", props.onClose);
    insert(_el$9, notesDir);
    _el$0.$$click = handleBrowse;
    return _el$;
  })();
}
delegateEvents(["click"]);

var _tmpl$$1 = /* @__PURE__ */ template(`<span>`), _tmpl$2$2 = /* @__PURE__ */ template(`<div class=status-bar><div class=status-hints>`), _tmpl$3$1 = /* @__PURE__ */ template(`<span class=status-hint> `);
const TAB_HINTS = {
  apps: [{
    key: "↑↓",
    label: "Navigate"
  }, {
    key: "↵",
    label: "Open"
  }, {
    key: "Tab",
    label: "Cycle"
  }, {
    key: "Esc",
    label: "Quit"
  }],
  clipboard: [{
    key: "↑↓",
    label: "Navigate"
  }, {
    key: "↵",
    label: "Copy"
  }, {
    key: "Tab",
    label: "Cycle"
  }, {
    key: "Esc",
    label: "Quit"
  }],
  notes: [{
    key: "+",
    label: "New"
  }, {
    key: "⌘↵",
    label: "Save"
  }, {
    key: "Esc",
    label: "Back"
  }, {
    key: "Tab",
    label: "Cycle"
  }],
  shell: [{
    key: "↑↓",
    label: "History"
  }, {
    key: "→",
    label: "Complete"
  }, {
    key: "↵",
    label: "Run"
  }, {
    key: "Tab",
    label: "Cycle"
  }]
};
function StatusBar(props) {
  const hints = () => TAB_HINTS[props.activeTab] || [];
  return (() => {
    var _el$ = _tmpl$2$2(), _el$2 = _el$.firstChild;
    insert(_el$2, createComponent(For, {
      get each() {
        return hints();
      },
      children: (h) => (() => {
        var _el$4 = _tmpl$3$1(), _el$5 = _el$4.firstChild;
        insert(_el$4, () => h.key, _el$5);
        insert(_el$4, () => h.label, null);
        return _el$4;
      })()
    }));
    insert(_el$, createComponent(Show, {
      get when() {
        return props.statusMsg;
      },
      get children() {
        var _el$3 = _tmpl$$1();
        insert(_el$3, () => props.statusMsg);
        createRenderEffect(() => className(_el$3, "status-message " + (props.statusColor || "info")));
        return _el$3;
      }
    }), null);
    return _el$;
  })();
}

var _tmpl$2$1 = /* @__PURE__ */ template(`<svg width=15 height=15 viewBox="0 0 15 15"fill=none stroke=currentColor stroke-width=1.4 stroke-linecap=round stroke-linejoin=round><rect x=3.5 y=2 width=8 height=11.5 rx=1.2></rect><path d="M5.5 2V3a1 1 0 001 1h2a1 1 0 001-1V2">`), _tmpl$4$1 = /* @__PURE__ */ template(`<svg width=15 height=15 viewBox="0 0 15 15"fill=none stroke=currentColor stroke-width=1.4 stroke-linecap=round stroke-linejoin=round><path d="M3 2h9a1 1 0 011 1v7.5L10.5 13H3a1 1 0 01-1-1V3a1 1 0 011-1z"></path><line x1=4.5 y1=5.5 x2=10.5 y2=5.5></line><line x1=4.5 y1=8 x2=8 y2=8>`), _tmpl$5 = /* @__PURE__ */ template(`<svg width=14 height=14 viewBox="0 0 14 14"fill=none stroke=currentColor stroke-width=1.4 stroke-linecap=round stroke-linejoin=round><circle cx=7 cy=7 r=2></circle><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06">`), _tmpl$6 = /* @__PURE__ */ template(`<svg width=13 height=13 viewBox="0 0 15 15"fill=none stroke=currentColor stroke-width=1.4 stroke-linecap=round stroke-linejoin=round><path d="M1.5 4.5h3v-3M13.5 10.5h-3v3"></path><path d="M12.4 4.5A5.5 5.5 0 004.2 2L1.5 4.5M13.5 10.5l-2.7 2.5a5.5 5.5 0 01-8.2-2.5">`), _tmpl$7 = /* @__PURE__ */ template(`<svg width=13 height=13 viewBox="0 0 15 15"fill=none stroke=currentColor stroke-width=1.4 stroke-linecap=round stroke-linejoin=round><path d="M2.5 3.5h10M4.5 3.5v-1a1 1 0 011-1h4a1 1 0 011 1v1M11.5 3.5v9a1 1 0 01-1 1h-6a1 1 0 01-1-1v-9"></path><line x1=6 y1=6 x2=6 y2=10></line><line x1=9 y1=6 x2=9 y2=10>`);
const IconClipboard = () => _tmpl$2$1();
const IconNotes = () => _tmpl$4$1();
const IconSettings = () => _tmpl$5();
const IconRefresh = () => _tmpl$6();
const IconTrash = () => _tmpl$7();

var _tmpl$ = /* @__PURE__ */ template(`<button class="menu-item danger"><span>Clear All`), _tmpl$2 = /* @__PURE__ */ template(`<button class=menu-item><span>Reload Notes`), _tmpl$3 = /* @__PURE__ */ template(`<div class="plugin-menu-panel floating-menu"><span class=plugin-menu-title></span><div class=menu-list>`), _tmpl$4 = /* @__PURE__ */ template(`<div class=app><div class=main-container><div class=search-section></div><div class=body-section><div class=sidebar><button title="Clipboard Ctrl+1"></button><button title="Notes Ctrl+2"></button><div class=sidebar-spacer></div><button title=Settings></button></div><div class=content-panel>`);
const TABS = ["clipboard", "notes"];
const SHELL_HISTORY_KEY = "rilaunch_shell_history";
function loadShellHistory() {
  try {
    const raw = localStorage.getItem(SHELL_HISTORY_KEY);
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}
function App() {
  const [activeTab, setActiveTab] = createSignal("clipboard");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [clipboardData, setClipboardData] = createSignal([]);
  const [clipboardSelectedIndex, setClipboardSelectedIndex] = createSignal(0);
  const [notesList, setNotesList] = createSignal([]);
  const [showSettings, setShowSettings] = createSignal(false);
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  const [statusMsg, setStatusMsg] = createSignal("");
  const [statusColor, setStatusColor] = createSignal("info");
  const [shellHistory] = createSignal(loadShellHistory());
  let statusTimer;
  let searchInputRef;
  let clipboardLoadId = 0;
  let notesLoadId = 0;
  const showStatus = (msg, type = "info") => {
    clearTimeout(statusTimer);
    setStatusMsg(msg);
    setStatusColor(type);
    statusTimer = setTimeout(() => setStatusMsg(""), 2500);
  };
  const filteredClipboardData = createMemo(() => {
    const term = searchQuery().trim().toLowerCase();
    if (!term) return clipboardData();
    return clipboardData().filter((item) => (item.content || item.text || "").toLowerCase().includes(term));
  });
  const filteredNotes = createMemo(() => {
    const term = searchQuery().trim().toLowerCase();
    if (!term) return notesList();
    return notesList().filter((n) => {
      const content = (n.content || "").toLowerCase();
      const tag = (n.tag || "").toLowerCase();
      return content.includes(term) || tag.includes(term);
    });
  });
  const shellSuggestion = createMemo(() => {
    if (activeTab() !== "shell") return "";
    const q = searchQuery().trim();
    if (!q) return "";
    return shellHistory().find((h) => h.toLowerCase().startsWith(q.toLowerCase())) || "";
  });
  const searchPlaceholder = () => {
    switch (activeTab()) {
      case "clipboard":
        return "Filter clipboard...";
      case "notes":
        return "Search notes...";
      default:
        return "Search...";
    }
  };
  const focusSearch = () => {
    setTimeout(() => searchInputRef?.focus?.(), 30);
  };
  const switchTab = (tab) => {
    const sameTab = activeTab() === tab;
    setShowSettings(false);
    setIsMenuOpen(false);
    if (!sameTab) {
      setActiveTab(tab);
      setSearchQuery("");
      setSelectedIndex(0);
      setClipboardSelectedIndex(0);
    }
    if (tab === "clipboard") queueMicrotask(() => void loadClipboardData());
    if (tab === "notes") queueMicrotask(() => void loadNotes());
    focusSearch();
  };
  const loadClipboardData = async () => {
    const requestId = ++clipboardLoadId;
    try {
      const raw = await GetClipData("");
      if (requestId !== clipboardLoadId) return;
      setClipboardData(JSON.parse(raw || "[]"));
    } catch (e) {
      console.error("Failed to load clipboard:", e);
      if (requestId === clipboardLoadId) setClipboardData([]);
    }
  };
  const loadNotes = async () => {
    const requestId = ++notesLoadId;
    try {
      const raw = await GetNotes();
      if (requestId !== notesLoadId) return;
      setNotesList(JSON.parse(raw || "[]"));
    } catch (e) {
      console.error("Failed to load notes:", e);
      if (requestId === notesLoadId) setNotesList([]);
    }
  };
  const handleClipboardItemClick = async (item) => {
    try {
      await navigator.clipboard.writeText(item.content || item.text || "");
      WindowHide();
    } catch (e) {
      console.error("Failed to copy clipboard item:", e);
      showStatus("Failed to copy item", "error");
    }
  };
  const handleToggleSecret = async (item) => {
    try {
      await ToggleClipSecret(item.hash);
      setClipboardData((prev) => prev.map((x) => x.hash === item.hash ? {
        ...x,
        is_secret: !x.is_secret
      } : x));
    } catch (e) {
      console.error("Failed to toggle secret:", e);
      showStatus("Failed to update item", "error");
    }
  };
  const handleClearClipboard = async () => {
    if (!confirm("Are you sure you want to clear all clipboard items?")) return;
    try {
      await ClearClipboard();
      setClipboardData([]);
      setClipboardSelectedIndex(0);
      showStatus("Clipboard cleared", "success");
    } catch (e) {
      console.error(e);
      showStatus("Failed to clear clipboard", "error");
    }
  };
  const handleReloadNotes = async () => {
    await loadNotes();
    showStatus("Notes reloaded", "success");
  };
  const handleSaveNote = async (content, tag) => {
    try {
      await SaveNote(content, tag);
      await loadNotes();
      showStatus("Note saved", "success");
    } catch (e) {
      console.error(e);
      showStatus("Failed to save", "error");
    }
  };
  const handleDeleteNote = async (id) => {
    try {
      await DeleteNote(id);
      await loadNotes();
      showStatus("Note deleted", "success");
    } catch (e) {
      console.error(e);
      showStatus("Failed to delete", "error");
    }
  };
  const handleUpdateNote = async (id, content, tag) => {
    try {
      await UpdateNote$1(id, content, tag);
      await loadNotes();
      showStatus("Note updated", "success");
    } catch (e) {
      console.error(e);
      showStatus("Failed to update", "error");
    }
  };
  const handleKeyDown = async (e) => {
    if (e.key === "Escape") {
      if (searchQuery() !== "") {
        setSearchQuery("");
        return;
      }
      Quit();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      const cur = TABS.indexOf(activeTab());
      const safeCur = cur >= 0 ? cur : 0;
      const next = e.shiftKey ? (safeCur - 1 + TABS.length) % TABS.length : (safeCur + 1) % TABS.length;
      switchTab(TABS[next]);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && ["1", "2"].includes(e.key)) {
      e.preventDefault();
      switchTab(TABS[parseInt(e.key, 10) - 1]);
      return;
    }
    if (showSettings()) return;
    if (activeTab() === "notes") return;
    if (activeTab() === "clipboard") {
      const data = filteredClipboardData();
      if (!data.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setClipboardSelectedIndex((i) => (i + 1) % data.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setClipboardSelectedIndex((i) => i === 0 ? data.length - 1 : i - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = data[Math.min(clipboardSelectedIndex(), data.length - 1)];
        if (item) await handleClipboardItemClick(item);
      }
    }
  };
  createEffect(() => {
    searchQuery();
    setSelectedIndex(0);
    setClipboardSelectedIndex(0);
  });
  createEffect(() => {
    const data = filteredClipboardData();
    const idx = clipboardSelectedIndex();
    if (!data.length && idx !== 0) {
      setClipboardSelectedIndex(0);
      return;
    }
    if (data.length && idx > data.length - 1) {
      setClipboardSelectedIndex(data.length - 1);
    }
  });
  onMount(() => {
    document.addEventListener("keydown", handleKeyDown, true);
    void loadClipboardData();
    const offHotkey = On("Backend:GlobalHotkeyEvent", () => WindowShow());
    const offClipboard = On("ClipboardUpdated", () => {
      if (activeTab() === "clipboard") void loadClipboardData();
    });
    const onLauncherShow = () => {
      requestAnimationFrame(() => {
        document.body.classList.add("visible");
        searchInputRef?.focus?.();
      });
    };
    window.addEventListener("launcher:show", onLauncherShow);
    searchInputRef?.focus?.();
    onCleanup(() => {
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("launcher:show", onLauncherShow);
      clearTimeout(statusTimer);
      offHotkey?.();
      offClipboard?.();
    });
  });
  return (() => {
    var _el$ = _tmpl$4(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$1 = _el$3.nextSibling, _el$10 = _el$1.firstChild, _el$11 = _el$10.firstChild, _el$12 = _el$11.nextSibling, _el$13 = _el$12.nextSibling, _el$14 = _el$13.nextSibling, _el$15 = _el$10.nextSibling;
    _el$.$$click = () => setIsMenuOpen(false);
    insert(_el$3, createComponent(SearchBar, {
      ref(r$) {
        var _ref$ = searchInputRef;
        typeof _ref$ === "function" ? _ref$(r$) : searchInputRef = r$;
      },
      get value() {
        return searchQuery();
      },
      onInput: setSearchQuery,
      get placeholder() {
        return searchPlaceholder();
      },
      isShellMode: false,
      get suggestion() {
        return shellSuggestion();
      },
      onMenuClick: (e) => {
        e.stopPropagation();
        setIsMenuOpen((o) => !o);
      }
    }), null);
    insert(_el$3, createComponent(Show, {
      get when() {
        return memo(() => !!isMenuOpen())() && !showSettings();
      },
      get children() {
        var _el$4 = _tmpl$3(), _el$5 = _el$4.firstChild, _el$6 = _el$5.nextSibling;
        _el$4.$$click = (e) => e.stopPropagation();
        insert(_el$5, () => activeTab() === "clipboard" && "Clipboard", null);
        insert(_el$5, () => activeTab() === "notes" && "Notes", null);
        insert(_el$6, createComponent(Show, {
          get when() {
            return activeTab() === "clipboard";
          },
          get children() {
            var _el$7 = _tmpl$(), _el$8 = _el$7.firstChild;
            _el$7.$$click = () => {
              setIsMenuOpen(false);
              void handleClearClipboard();
            };
            insert(_el$7, createComponent(IconTrash, {}), _el$8);
            return _el$7;
          }
        }), null);
        insert(_el$6, createComponent(Show, {
          get when() {
            return activeTab() === "notes";
          },
          get children() {
            var _el$9 = _tmpl$2(), _el$0 = _el$9.firstChild;
            _el$9.$$click = () => {
              setIsMenuOpen(false);
              void handleReloadNotes();
            };
            insert(_el$9, createComponent(IconRefresh, {}), _el$0);
            return _el$9;
          }
        }), null);
        return _el$4;
      }
    }), null);
    _el$11.$$click = () => switchTab("clipboard");
    insert(_el$11, createComponent(IconClipboard, {}));
    _el$12.$$click = () => switchTab("notes");
    insert(_el$12, createComponent(IconNotes, {}));
    _el$14.$$click = () => {
      setIsMenuOpen(false);
      setShowSettings((s) => !s);
      focusSearch();
    };
    insert(_el$14, createComponent(IconSettings, {}));
    insert(_el$15, createComponent(Show, {
      get when() {
        return showSettings();
      },
      get children() {
        return createComponent(SettingsView, {
          onClose: () => setShowSettings(false)
        });
      }
    }), null);
    insert(_el$15, createComponent(Show, {
      get when() {
        return memo(() => !!!showSettings())() && activeTab() === "clipboard";
      },
      get children() {
        return createComponent(ClipboardView, {
          get clipboardData() {
            return clipboardData();
          },
          get filteredClipboardData() {
            return filteredClipboardData();
          },
          get clipboardSelectedIndex() {
            return clipboardSelectedIndex();
          },
          onItemClick: handleClipboardItemClick,
          onToggleSecret: handleToggleSecret
        });
      }
    }), null);
    insert(_el$15, createComponent(Show, {
      get when() {
        return memo(() => !!!showSettings())() && activeTab() === "notes";
      },
      get children() {
        return createComponent(NotesView, {
          get notes() {
            return filteredNotes();
          },
          onSave: handleSaveNote,
          onUpdate: handleUpdateNote,
          onDelete: handleDeleteNote,
          onReload: loadNotes
        });
      }
    }), null);
    insert(_el$2, createComponent(StatusBar, {
      get activeTab() {
        return memo(() => !!showSettings())() ? "settings" : activeTab();
      },
      get statusMsg() {
        return statusMsg();
      },
      get statusColor() {
        return statusColor();
      }
    }), null);
    createRenderEffect((_p$) => {
      var _v$ = "tab-btn" + (activeTab() === "clipboard" && !showSettings() ? " active" : ""), _v$2 = "tab-btn" + (activeTab() === "notes" && !showSettings() ? " active" : ""), _v$3 = "tab-btn settings-btn" + (showSettings() ? " active" : "");
      _v$ !== _p$.e && className(_el$11, _p$.e = _v$);
      _v$2 !== _p$.t && className(_el$12, _p$.t = _v$2);
      _v$3 !== _p$.a && className(_el$14, _p$.a = _v$3);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$;
  })();
}
delegateEvents(["click"]);

const root = document.getElementById("app");
render(() => createComponent(App, {}), root);
