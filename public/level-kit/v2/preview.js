/*
 * Bompers level kit v2 — preview script.
 * Adds a legend, labels, a terrain-grid overlay and soft validation when a
 * level file is opened in a browser. Never required: without it the level
 * still renders as a plain picture. The game never runs this file.
 * Spec: documentation/game/LEVEL_FORMAT.md
 */
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var FORMAT = 2;
  var DEFAULT_CELL = 4;
  var ROLES = [
    { role: 'terrain', label: 'Terrain', point: false },
    { role: 'spawn', label: 'Spawn', point: true },
    { role: 'drop', label: 'Drop point', point: true },
    { role: 'collectible', label: 'Collectible', point: true },
    { role: 'bounds', label: 'Bounds', point: false },
  ];
  var SHAPES = { rect: 1, polygon: 1, circle: 1 };
  var TERRAIN = { terrain: 1 };
  var REF_KIND = {
    'data-material': 'material',
    'data-color': 'color',
    'data-effect': 'effect',
    'data-sound': 'sound',
    'data-behavior': 'behavior',
  };
  var ID_RE = /^[a-z][a-z0-9-]*$/;

  var scriptSrc = (document.currentScript && document.currentScript.src) || '';

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      node.setAttribute(k, attrs[k]);
    });
    if (text != null) node.textContent = text;
    return node;
  }

  function svgEl(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      node.setAttribute(k, attrs[k]);
    });
    return node;
  }

  function num(v, fallback) {
    var n = parseFloat(v);
    return isFinite(n) ? n : fallback;
  }

  function roleColor(role) {
    return getComputedStyle(document.documentElement).getPropertyValue('--lk-' + role).trim();
  }

  /** Point of a point role: circle centre (spec § Roles). */
  function pointOf(node) {
    return { x: num(node.getAttribute('cx'), 0), y: num(node.getAttribute('cy'), 0) };
  }

  function hasTransform(node, root) {
    for (var n = node; n && n !== root; n = n.parentNode) {
      if (n.getAttribute && n.getAttribute('transform')) return true;
    }
    return false;
  }

  function validate(root, nodes, catalog) {
    var issues = [];
    var vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (root.getAttribute('data-level-format') !== String(FORMAT)) {
      issues.push('data-level-format is "' + root.getAttribute('data-level-format') + '"; this kit previews version ' + FORMAT + '.');
    }
    if (vb.length !== 4 || vb[0] !== 0 || vb[1] !== 0 || !(vb[2] > 0) || !(vb[3] > 0)) {
      issues.push('viewBox must be "0 0 <width> <height>".');
    }
    if (!root.getAttribute('data-title')) issues.push('data-title is missing on the root <svg>.');

    var counts = {};
    var ids = {};
    nodes.forEach(function (n) {
      var role = n.getAttribute('data-role');
      var tag = n.localName;
      counts[role] = (counts[role] || 0) + 1;
      if (!ROLES.some(function (r) { return r.role === role; })) {
        issues.push('Unknown data-role "' + role + '" (ignored by the game).');
        return;
      }
      if (!SHAPES[tag]) issues.push(role + ' uses <' + tag + '>; allowed: rect, polygon, circle.');
      var isPoint = ROLES.some(function (r) { return r.role === role && r.point; });
      if (isPoint && tag !== 'circle') issues.push(role + ' must be a <circle>.');
      if (role === 'bounds' && tag !== 'rect') issues.push('bounds must be a <rect>.');
      if (hasTransform(n, root)) issues.push(role + (n.id ? ' #' + n.id : '') + ' has a transform; transforms are not allowed.');
      if (n.id) {
        if (ids[n.id]) issues.push('Duplicate id "' + n.id + '".');
        ids[n.id] = true;
      }
      Object.keys(REF_KIND).forEach(function (attr) {
        var v = n.getAttribute(attr);
        if (v == null) return;
        if (!ID_RE.test(v)) issues.push(attr + '="' + v + '" is not a valid ID (lowercase kebab-case).');
        else if (catalog && !(catalog[REF_KIND[attr]] || []).some(function (e) { return e.id === v; })) {
          issues.push(attr + '="' + v + '" is not in the catalog; the game falls back to the default.');
        }
      });
      if (role === 'drop' && n.hasAttribute('data-items')) {
        issues.push('drop: data-items is not read; set data-weapons on the root to limit the weapons.');
      }
      var itemVal = role === 'collectible' && n.getAttribute('data-item');
      if (itemVal && catalog) {
        var entry = (catalog.item || []).filter(function (e) { return e.id === itemVal; })[0];
        if (!entry) {
          issues.push('data-item "' + itemVal + '" is not in the catalog; the game falls back to the default.');
        } else if (entry.use !== role) {
          // Same check as the game's W11: an item belongs to one point role (catalog "use").
          issues.push('collectible: "' + itemVal + '" is a ' + entry.use + ' item; the game uses the default collectible.');
        }
      }
    });

    // Same rule as the game's data-weapons reader: weapon IDs (catalog use "drop"), "none" or "auto".
    var weapons = (root.getAttribute('data-weapons') || '').trim();
    if (weapons && weapons !== 'none' && weapons !== 'auto' && catalog) {
      weapons.split(/\s+/).forEach(function (id) {
        var isWeapon = (catalog.item || []).some(function (e) { return e.id === id && e.use === 'drop'; });
        if (!isWeapon) issues.push('data-weapons: "' + id + '" is not a weapon; the game leaves it out.');
      });
    }

    if ((counts.bounds || 0) !== 1) issues.push('Exactly one bounds <rect> is required (found ' + (counts.bounds || 0) + ').');
    if ((counts.spawn || 0) < 2) issues.push('At least 2 spawn points are required (found ' + (counts.spawn || 0) + ').');
    else if (counts.spawn < 4) issues.push('Fewer than 4 spawn points: 4-player rounds will share spawns.');
    if (!counts.terrain) issues.push('No terrain: add at least one data-role="terrain" shape.');
    if (!counts.drop) issues.push('No drop points: weapons have nowhere to fall from.');
    return { issues: issues, counts: counts };
  }

  // ---- Moving parts (LEVEL_FORMAT § 11) ----
  // SECOND COPY of src/shared/utils/levelMotion.ts (grammar defaults, limits, pose maths) and the
  // grammar in src/features/level-file/services/levelFileMotion.ts. Change them together.
  var MOTION = {
    kinds: ['slide', 'path', 'spin', 'swing'],
    period: 4,
    minPeriod: 1,
    maxPeriod: 30,
    maxSwing: 180,
    pivots: {
      center: [0.5, 0.5], top: [0.5, 0], bottom: [0.5, 1], left: [0, 0.5], right: [1, 0.5],
      'top-left': [0, 0], 'top-right': [1, 0], 'bottom-left': [0, 1], 'bottom-right': [1, 1],
    },
  };
  var NUM = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
  var PAIR_RE = new RegExp('^' + NUM + ',' + NUM + '$');
  var NUM_RE = new RegExp('^' + NUM + '$');

  function argsFit(m) {
    var p = m.pairs.length;
    var n = m.nums.length;
    if (m.kind === 'slide') return p === 1 && n === 0;
    if (m.kind === 'path') return p > 0 && n === 0;
    if (m.kind === 'spin') return p === 0 && n === 0;
    return p === 0 && n === 1 && m.nums[0] > 0 && m.nums[0] <= MOTION.maxSwing;
  }

  /** A data-motion value → motion, or { error }. */
  function parseMotion(raw) {
    var tokens = (raw || '').trim().toLowerCase().split(/\s+/);
    var m = { kind: tokens[0], pairs: [], nums: [], period: MOTION.period, phase: 0, dir: 1, pivot: null };
    if (MOTION.kinds.indexOf(m.kind) < 0) return { error: '"' + m.kind + '" is not a motion; use slide, path, spin or swing' };
    for (var i = 1; i < tokens.length; i++) {
      var t = tokens[i];
      if (/^(\d+(\.\d+)?|\.\d+)s$/.test(t)) m.period = parseFloat(t);
      else if (t.charAt(0) === '@' && NUM_RE.test(t.slice(1))) m.phase = parseFloat(t.slice(1));
      else if (Object.prototype.hasOwnProperty.call(MOTION.pivots, t)) m.pivot = t;
      else if (t === 'cw' || t === 'ccw') m.dir = t === 'cw' ? 1 : -1;
      else if (PAIR_RE.test(t)) m.pairs.push({ x: parseFloat(t.split(',')[0]), y: parseFloat(t.split(',')[1]) });
      else if (NUM_RE.test(t)) m.nums.push(parseFloat(t));
      else return { error: '"' + t + '" is not understood' };
    }
    if (!argsFit(m)) return { error: m.kind + ' has the wrong arguments (see LEVEL_FORMAT § 11)' };
    m.period = Math.min(MOTION.maxPeriod, Math.max(MOTION.minPeriod, m.period));
    m.phase = ((m.phase % 1) + 1) % 1;
    m.pivot = m.pivot || (m.kind === 'swing' ? 'top' : 'center');
    return m;
  }

  function pathAt(pairs, u) {
    var pts = [{ x: 0, y: 0 }].concat(pairs, [{ x: 0, y: 0 }]);
    var lens = [];
    var total = 0;
    for (var i = 1; i < pts.length; i++) {
      lens.push(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      total += lens[i - 1];
    }
    var left = u * total;
    for (var k = 0; k < lens.length; k++) {
      if (left <= lens[k] && lens[k] > 0) {
        var f = left / lens[k];
        return { x: pts[k].x + (pts[k + 1].x - pts[k].x) * f, y: pts[k].y + (pts[k + 1].y - pts[k].y) * f };
      }
      left -= lens[k];
    }
    return { x: 0, y: 0 };
  }

  /** Pose at time t (s): shift dx, dy and turn deg (clockwise on screen) about the pivot. */
  function poseAt(m, t) {
    var u = (((t / m.period + m.phase) % 1) + 1) % 1;
    var tau = Math.PI * 2;
    if (m.kind === 'slide') {
      var s = (1 - Math.cos(tau * u)) / 2;
      return { dx: m.pairs[0].x * s, dy: m.pairs[0].y * s, deg: 0 };
    }
    if (m.kind === 'path') {
      var p = pathAt(m.pairs, u);
      return { dx: p.x, dy: p.y, deg: 0 };
    }
    if (m.kind === 'spin') return { dx: 0, dy: 0, deg: m.dir * 360 * u };
    return { dx: 0, dy: 0, deg: m.dir * m.nums[0] * Math.sin(tau * u) };
  }

  /** Moves a node by a pose with a CSS transform (never the transform attribute: § 5). */
  function applyPose(node, pose, pivot) {
    node.style.transformOrigin = pivot.x + 'px ' + pivot.y + 'px';
    node.style.transform = 'translate(' + pose.dx + 'px, ' + pose.dy + 'px) rotate(' + pose.deg + 'deg)';
  }

  function unionBox(nodes) {
    var box = null;
    nodes.forEach(function (n) {
      if (!n.getBBox) return;
      var b = n.getBBox();
      if (!box) box = { x: b.x, y: b.y, r: b.x + b.width, b: b.y + b.height };
      else {
        box.x = Math.min(box.x, b.x); box.y = Math.min(box.y, b.y);
        box.r = Math.max(box.r, b.x + b.width); box.b = Math.max(box.b, b.y + b.height);
      }
    });
    return box;
  }

  /** A dashed copy of the part at one pose, without roles so nothing counts it. */
  function addGhost(group, pose, pivot) {
    var ghost = group.cloneNode(true);
    [ghost].concat(Array.prototype.slice.call(ghost.querySelectorAll('*'))).forEach(function (n) {
      ['id', 'data-role', 'data-motion', 'data-label'].forEach(function (a) { n.removeAttribute(a); });
    });
    ghost.setAttribute('class', 'lk-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    applyPose(ghost, pose, pivot);
    group.parentNode.insertBefore(ghost, group);
  }

  function addSweep(group, m, pivot, box) {
    if (m.kind === 'slide') return addGhost(group, { dx: m.pairs[0].x, dy: m.pairs[0].y, deg: 0 }, pivot);
    if (m.kind === 'path') {
      return m.pairs.forEach(function (p) { addGhost(group, { dx: p.x, dy: p.y, deg: 0 }, pivot); });
    }
    if (m.kind === 'swing') {
      addGhost(group, { dx: 0, dy: 0, deg: m.nums[0] }, pivot);
      return addGhost(group, { dx: 0, dy: 0, deg: -m.nums[0] }, pivot);
    }
    var reach = Math.max(
      Math.hypot(box.x - pivot.x, box.y - pivot.y), Math.hypot(box.r - pivot.x, box.y - pivot.y),
      Math.hypot(box.x - pivot.x, box.b - pivot.y), Math.hypot(box.r - pivot.x, box.b - pivot.y));
    group.parentNode.insertBefore(svgEl('circle', { cx: pivot.x, cy: pivot.y, r: reach, class: 'lk-sweep', 'aria-hidden': 'true' }), group);
  }

  function insideMover(group, root) {
    for (var n = group.parentNode; n && n !== root; n = n.parentNode) {
      if (n.getAttribute && n.getAttribute('data-motion') !== null && n.localName === 'g') return true;
    }
    return false;
  }

  /** Reads every outermost <g data-motion>, draws its sweep and returns the movers + issues. */
  function setupMovers(root) {
    var movers = [];
    var issues = [];
    Array.prototype.forEach.call(root.querySelectorAll('g[data-motion]'), function (group, i) {
      var ref = group.id || group.getAttribute('data-label');
      var name = 'moving part ' + (ref ? '"' + ref + '"' : '#' + (i + 1));
      if (insideMover(group, root)) return issues.push(name + ' sits inside another moving part; its motion is ignored.');
      if (movers.length >= 16) return issues.push(name + ': more than 16 moving parts; it stays still.');
      var m = parseMotion(group.getAttribute('data-motion'));
      if (m.error) return issues.push(name + ': data-motion ' + m.error + '; it stays still.');
      var terrain = Array.prototype.filter.call(group.querySelectorAll('[data-role]'), function (n) {
        if (TERRAIN[n.getAttribute('data-role')]) return true;
        issues.push(n.getAttribute('data-role') + ' inside ' + name + ' stays still; only terrain moves.');
        return false;
      });
      var box = unionBox(terrain);
      if (!box) return issues.push(name + ' holds no terrain shape.');
      var f = MOTION.pivots[m.pivot];
      var pivot = { x: box.x + (box.r - box.x) * f[0], y: box.y + (box.b - box.y) * f[1] };
      addSweep(group, m, pivot, box);
      movers.push({ group: group, motion: m, pivot: pivot });
    });
    return { movers: movers, issues: issues };
  }

  /** Plays the movers on the shared clock; `playing()` false parks them at rest. */
  function animateMovers(movers, playing) {
    if (!movers.length || typeof requestAnimationFrame !== 'function') return;
    var start = null;
    function frame(now) {
      if (start === null) start = now;
      var t = playing() ? (now - start) / 1000 : 0;
      if (!playing()) start = now;
      movers.forEach(function (mv) { applyPose(mv.group, poseAt(mv.motion, t), mv.pivot); });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function addGrid(root, w, h, cell) {
    var layer = svgEl('g', { class: 'lk-grid-layer', 'aria-hidden': 'true' });
    var step = cell;
    // Draw every cell when it stays readable, otherwise every 4th.
    while (w / step > 200) step *= 2;
    for (var x = 0; x <= w; x += step) {
      layer.appendChild(svgEl('line', { x1: x, y1: 0, x2: x, y2: h, class: x % (step * 4) === 0 ? 'lk-grid-major' : 'lk-grid-minor' }));
    }
    for (var y = 0; y <= h; y += step) {
      layer.appendChild(svgEl('line', { x1: 0, y1: y, x2: w, y2: y, class: y % (step * 4) === 0 ? 'lk-grid-major' : 'lk-grid-minor' }));
    }
    root.insertBefore(layer, root.firstChild);
    return layer;
  }

  function addLabels(root, nodes) {
    var layer = svgEl('g', { class: 'lk-label-layer', 'aria-hidden': 'true' });
    var n = { spawn: 0, drop: 0, collectible: 0 };
    nodes.forEach(function (node) {
      var role = node.getAttribute('data-role');
      if (!(role in n) || node.localName !== 'circle') return;
      n[role] += 1;
      var p = pointOf(node);
      var r = num(node.getAttribute('r'), 10);
      var name = node.getAttribute('data-label') || (role === 'spawn' ? 'P' + n[role] : role === 'drop' ? 'Drop ' + n[role] : '★');
      var t = svgEl('text', { x: p.x, y: p.y - r - 6, 'text-anchor': 'middle', class: 'lk-label' });
      t.textContent = name;
      layer.appendChild(t);
      if (role === 'drop') {
        layer.insertBefore(svgEl('line', { x1: p.x, y1: p.y + r, x2: p.x, y2: p.y + r + 60, class: 'lk-drop-ray' }), layer.firstChild);
      }
    });
    nodes.forEach(function (node) {
      var label = node.getAttribute('data-label');
      if (!label || !TERRAIN[node.getAttribute('data-role')] || !node.getBBox) return;
      var b = node.getBBox();
      var t = svgEl('text', { x: b.x + b.width / 2, y: b.y + b.height / 2 + 5, 'text-anchor': 'middle', class: 'lk-label' });
      t.textContent = label;
      layer.appendChild(t);
    });
    root.appendChild(layer);
  }

  function buildPanel(root, result, cell) {
    var panel = el('section', { class: 'lk-panel', 'aria-label': 'Level preview' });
    var meta = el('div', { class: 'lk-meta' });
    meta.appendChild(el('h1', null, root.getAttribute('data-title') || 'Untitled level'));
    var by = [root.getAttribute('data-author'), root.getAttribute('data-agent') && 'agent: ' + root.getAttribute('data-agent')].filter(Boolean).join(' · ');
    var vb = (root.getAttribute('viewBox') || '').split(/[\s,]+/);
    meta.appendChild(el('p', null, [by, 'format v' + root.getAttribute('data-level-format'), vb[2] + '×' + vb[3] + ' units', 'cell ' + cell].filter(Boolean).join(' · ')));
    var settings = [];
    if (root.hasAttribute('data-gravity')) settings.push('gravity ×' + root.getAttribute('data-gravity'));
    if (root.hasAttribute('data-match-duration')) settings.push('match ' + root.getAttribute('data-match-duration') + ' s');
    if (settings.length) meta.appendChild(el('p', null, settings.join(' · ')));
    panel.appendChild(meta);

    var legend = el('ul', { class: 'lk-legend' });
    ROLES.forEach(function (r) {
      var li = el('li');
      var sw = el('span', { class: 'lk-swatch' + (r.point ? ' lk-swatch-point' : '') + (r.role === 'bounds' ? ' lk-swatch-bounds' : '') });
      sw.style.background = roleColor(r.role);
      li.appendChild(sw);
      li.appendChild(document.createTextNode(r.label + ' (' + (result.counts[r.role] || 0) + ')'));
      legend.appendChild(li);
    });
    panel.appendChild(legend);

    var controls = el('div', { class: 'lk-controls' });
    var label = el('label');
    var box = el('input', { type: 'checkbox', checked: '' });
    label.appendChild(box);
    label.appendChild(document.createTextNode('Terrain grid'));
    controls.appendChild(label);
    var motion = null;
    if (result.movers) {
      legend.appendChild(el('li', null, 'Moving parts (' + result.movers + ')'));
      var mlabel = el('label');
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      motion = el('input', reduce ? { type: 'checkbox' } : { type: 'checkbox', checked: '' });
      mlabel.appendChild(motion);
      mlabel.appendChild(document.createTextNode('Motion'));
      controls.appendChild(mlabel);
    }
    panel.appendChild(controls);

    var issues = el('ul', { class: 'lk-issues', role: 'status' });
    panel.appendChild(issues);
    return { panel: panel, grid: box, motion: motion, issues: issues };
  }

  function showIssues(list, issues) {
    list.textContent = '';
    issues.forEach(function (msg) {
      list.appendChild(el('li', null, msg));
    });
  }

  function loadCatalog(done) {
    if (!scriptSrc || typeof fetch !== 'function') return done(null);
    fetch(new URL('catalog.json', scriptSrc).href)
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(done, function () {
        done(null);
      });
  }

  /** Paints terrain the way the game does: data-color, else the material's default colour. */
  function paintTerrain(nodes, catalog) {
    var colors = {};
    (catalog.color || []).forEach(function (c) { colors[c.id] = c; });
    var materials = {};
    (catalog.material || []).forEach(function (m) { materials[m.id] = m; });
    nodes.forEach(function (node) {
      if (!TERRAIN[node.getAttribute('data-role')]) return;
      var material = materials[node.getAttribute('data-material') || catalog.defaults.material];
      var color = colors[node.getAttribute('data-color')] || (material && colors[material.defaultColor]);
      if (color) node.style.fill = color.fill;
    });
  }

  function init() {
    var root = document.querySelector('svg[data-level-format]');
    if (!root) return;
    document.body.classList.add('lk-ready');
    var vb = (root.getAttribute('viewBox') || '0 0 0 0').split(/[\s,]+/).map(Number);
    var cell = Math.max(1, Math.round(num(root.getAttribute('data-cell-size'), DEFAULT_CELL)));
    var nodes = Array.prototype.slice.call(root.querySelectorAll('[data-role]'));

    var grid = addGrid(root, vb[2] || 0, vb[3] || 0, cell);
    addLabels(root, nodes);
    var moving = setupMovers(root);
    var result = validate(root, nodes, null);
    result.movers = moving.movers.length;
    var ui = buildPanel(root, result, cell);
    root.parentNode.insertBefore(ui.panel, root.nextSibling);
    ui.grid.addEventListener('change', function () {
      grid.toggleAttribute('hidden', !ui.grid.checked);
    });
    showIssues(ui.issues, result.issues.concat(moving.issues));
    animateMovers(moving.movers, function () {
      return !ui.motion || ui.motion.checked;
    });

    loadCatalog(function (catalog) {
      if (!catalog) return;
      paintTerrain(nodes, catalog);
      showIssues(ui.issues, validate(root, nodes, catalog).issues.concat(moving.issues));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
