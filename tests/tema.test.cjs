const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

const source = readFileSync(`${__dirname}/../js/site.js`, 'utf8');
const code = source.slice(source.indexOf('const temaDugme ='), source.indexOf('let boyutTimer ='));

for (const stored of [null, 'acik', 'koyu', 'invalid', 'blocked']) {
  const button = { hidden: true, setAttribute(name, value) { this[name] = value; }, addEventListener(_, callback) { this.click = callback; } };
  const root = { dataset: {} };
  const meta = {};
  let saved;
  runInNewContext(code, {
    kok: root,
    $: selector => selector === '.tema-dugme' ? button : meta,
    localStorage: {
      getItem() { if (stored === 'blocked') throw Error('blocked'); return stored; },
      setItem(key, value) { if (stored === 'blocked') throw Error('blocked'); assert.equal(key, 'tema'); saved = value; },
    },
  });
  const initiallyLight = stored === 'acik';
  assert.equal(button.hidden, false);
  assert.equal(root.dataset.tema, initiallyLight ? 'acik' : 'koyu');
  assert.equal(button['aria-checked'], String(initiallyLight));
  button.click();
  assert.equal(root.dataset.tema, initiallyLight ? 'koyu' : 'acik');
  assert.equal(button['aria-checked'], String(!initiallyLight));
  assert.equal(meta.content, initiallyLight ? '#06101D' : '#F3F6FA');
  if (stored !== 'blocked') assert.equal(saved, root.dataset.tema);
  button.click();
  assert.equal(root.dataset.tema, initiallyLight ? 'acik' : 'koyu');
}
console.log('Theme initialization, toggle, persistence and blocked storage: OK');
