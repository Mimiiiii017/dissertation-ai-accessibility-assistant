const fs = require('fs');
const content = fs.readFileSync('../../evaluation/preset-benchmark/fixtures/js/js-medium.js', 'utf8');

function extractBody(src, pattern) {
  const m = pattern.exec(src);
  if (!m) { return null; }
  const openPos = src.indexOf('{', m.index + m[0].length);
  if (openPos < 0) return null;
  let depth = 1, i = openPos + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return src.slice(openPos + 1, i - 1);
}

// Test search clear
const searchClearBody = (() => {
  const anchor = /_searchState|_inputEl|searchCleared|Search cleared/.exec(content);
  if (!anchor) { console.log('No anchor found'); return null; }
  const searchStart = anchor.index;
  console.log('Search anchor at line:', content.slice(0, anchor.index).split('\n').length, 'text:', content.slice(anchor.index, anchor.index+30));
  const searchContent = content.slice(searchStart, searchStart + 8000);
  const m = /function clear\s*\(\s*\)/.exec(searchContent);
  if (!m) { console.log('No clear() in 8000 char window'); return null; }
  const clearPos = searchStart + m.index;
  console.log('clear() at line:', content.slice(0, clearPos).split('\n').length);
  return searchContent.slice(m.index + m[0].length).split('\n').slice(0, 25).join('\n');
})();
console.log('searchClearBody found:', !!searchClearBody);
if (searchClearBody) {
  console.log('has announce:', /announce/.test(searchClearBody));
  console.log('preview:', searchClearBody.slice(0, 200));
}

// Test combobox
const comboBody = (() => {
  const m = /(?:aria-autocomplete|aria-haspopup)[\s\S]{0,1000}aria-controls/.exec(content);
  if (!m) { console.log('No aria-autocomplete + aria-controls found'); return null; }
  const pos = content.slice(0, m.index).split('\n').length;
  console.log('\nCombobox match at line:', pos);
  const body = content.slice(m.index).split('\n').slice(0, 30).join('\n');
  return body;
})();
console.log('comboBody found:', !!comboBody);
if (comboBody) {
  console.log('has aria-expanded:', /aria-expanded/.test(comboBody));
  console.log('preview:', comboBody.slice(0, 300));
}

// Test keyboard shortcuts
const kbdSec = (() => {
  const ms = /altKey|keyboard.*shortcut|shortcut.*keyboard/i.exec(content);
  if (!ms) return null;
  const endM = /export|module\.exports|window\./.exec(content.slice(ms.index));
  if (!endM) return content.slice(ms.index);
  return content.slice(ms.index, ms.index + endM.index);
})();
console.log('\nkbdSec found:', !!kbdSec, kbdSec ? '(len:'+kbdSec.length+')' : '');
if (kbdSec) {
  const checkShortcut = (key) => {
    const rx = new RegExp("['\"" + "]" + key + "['\"" + "]|Key" + key.toUpperCase(), 'i');
    const m = rx.exec(kbdSec);
    if (!m) { console.log('No match for shortcut:', key); return; }
    const win = kbdSec.slice(m.index + m[0].length).split('\n').slice(0, 15).join('\n');
    console.log('Shortcut', key, 'has announce:', /announce/.test(win));
  };
  checkShortcut('s');
  checkShortcut('n');
  checkShortcut('m');
  checkShortcut('f');
}

// Test nav init  
function section(src, startPat, endPat) {
  const ms = startPat.exec(src);
  if (!ms) return null;
  const sub = src.slice(ms.index);
  const endM = endPat.exec(sub);
  if (!endM) return sub;
  return sub.slice(0, endM.index);
}
const navSec = section(content, /MobileNav|mobileNav|mobile.nav|buildMobileNav/i, /DropdownMenu|dropdownMenu|buildDropdown/);
console.log('\nnavSec found:', !!navSec, navSec ? '(len:'+navSec.length+')' : '');
if (navSec) {
  const navInitBody = extractBody(navSec, /function init\s*\(\s*\)/);
  console.log('navInitBody found:', !!navInitBody);
  if (navInitBody) {
    console.log('has aria-expanded:', /aria-expanded/.test(navInitBody));
    console.log('has aria-controls:', /aria-controls/.test(navInitBody));
    console.log('preview:', navInitBody.slice(0, 200));
  }
}
