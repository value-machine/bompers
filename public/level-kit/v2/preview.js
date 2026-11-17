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
  var DEFAULT_CELL = 8;
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
      var itemAttr = role === 'drop' ? 'data-items' : role === 'collectible' ? 'data-item' : null;
      var itemVal = itemAttr && n.getAttribute(itemAttr);
      if (itemVal && catalog) {
        itemVal.trim().split(/\s+/).forEach(function (id) {
          var entry = (catalog.item || []).filter(function (e) { return e.id === id; })[0];
          if (!entry) {
            issues.push(itemAttr + ' "' + id + '" is not in the catalog; the game falls back to the default.');
          } else if (entry.use !== role) {
            // Same check as the game's W11: an item belongs to one point role (catalog "use").
            issues.push(role + ': "' + id + '" is a ' + entry.use + ' item, not a ' + role + ' item; the game ' +
              (role === 'drop' ? 'leaves it out.' : 'uses the default collectible.'));
          }
        });
      }
    });

    if ((counts.bounds || 0) !== 1) issues.push('Exactly one bounds <rect> is required (found ' + (counts.bounds || 0) + ').');
    if ((counts.spawn || 0) < 2) issues.push('At least 2 spawn points are required (found ' + (counts.spawn || 0) + ').');
    else if (counts.spawn < 4) issues.push('Fewer than 4 spawn points: 4-player rounds will share spawns.');
    if (!counts.terrain) issues.push('No terrain: add at least one data-role="terrain" shape.');
    if (!counts.drop) issues.push('No drop points: weapons have nowhere to fall from.');
    return { issues: issues, counts: counts };
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
    panel.appendChild(controls);

    var issues = el('ul', { class: 'lk-issues', role: 'status' });
    panel.appendChild(issues);
    return { panel: panel, grid: box, issues: issues };
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
    var result = validate(root, nodes, null);
    var ui = buildPanel(root, result, cell);
    root.parentNode.insertBefore(ui.panel, root.nextSibling);
    ui.grid.addEventListener('change', function () {
      grid.toggleAttribute('hidden', !ui.grid.checked);
    });
    showIssues(ui.issues, result.issues);

    loadCatalog(function (catalog) {
      if (!catalog) return;
      paintTerrain(nodes, catalog);
      showIssues(ui.issues, validate(root, nodes, catalog).issues);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
