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
let Listener = null;
let Updates = null;
let Effects = null;
let ExecCount = 0;
function createRoot(fn, detachedOwner) {
  const listener = Listener,
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
  Listener = null;
  try {
    return runUpdates(updateFn, true);
  } finally {
    Listener = listener;
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
  if (Listener === null) return fn();
  const listener = Listener;
  Listener = null;
  try {
    if (ExternalSourceConfig) ;
    return fn();
  } finally {
    Listener = listener;
  }
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
  if (Listener) {
    const sSlot = this.observers ? this.observers.length : 0;
    if (!Listener.sources) {
      Listener.sources = [this];
      Listener.sourceSlots = [sSlot];
    } else {
      Listener.sources.push(this);
      Listener.sourceSlots.push(sSlot);
    }
    if (!this.observers) {
      this.observers = [Listener];
      this.observerSlots = [Listener.sources.length - 1];
    } else {
      this.observers.push(Listener);
      this.observerSlots.push(Listener.sources.length - 1);
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
    listener = Listener;
  Listener = Owner = node;
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
    Listener = listener;
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
function createComponent(Comp, props) {
  return untrack(() => Comp(props || {}));
}

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
const call = newRuntimeCaller(objectNames.ContextMenu);
const ContextMenuOpen = 0;
function openContextMenu(id, x, y, data) {
    void call(ContextMenuOpen, { id, x, y, data });
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

delegateEvents(["input", "click"]);

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
delegateEvents(["click", "input", "keydown"]);

delegateEvents(["click"]);

function App() {
  const [activeTab] = createSignal("clipboard");
  const [searchQuery] = createSignal("");
  createSignal(0);
  const [clipboardData] = createSignal([]);
  createSignal(0);
  const [notesList] = createSignal([]);
  createSignal(false);
  createSignal(false);
  createSignal("");
  createSignal("info");
  createMemo(() => {
    const term = searchQuery().toLowerCase();
    if (!term) return clipboardData();
    return clipboardData().filter((item) => (item.content || item.text || "").toLowerCase().includes(term));
  });
  createMemo(() => {
    const term = searchQuery().toLowerCase();
    if (!term) return notesList();
    return notesList().filter((n) => n.content.toLowerCase().includes(term) || n.tag.toLowerCase().includes(term));
  });
  createMemo(() => {
    if (activeTab() !== "shell") return "";
    const q = searchQuery().trim();
    if (!q) return "";
    return shellHistory().find((h) => h.toLowerCase().startsWith(q.toLowerCase())) || "";
  });
}
delegateEvents(["click"]);

const root = document.getElementById("app");
render(() => createComponent(App, {}), root);
