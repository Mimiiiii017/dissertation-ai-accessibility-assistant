const fs = require('fs');
const content = fs.readFileSync('../../evaluation/preset-benchmark/fixtures/js/js-medium.js', 'utf8');

function extractBody(src, pattern) {
  const m = pattern.exec(src);
  if (!m) { console.log('No match for:', pattern.toString()); return null; }
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

function section(startPat, endPat) {
  const ms = startPat.exec(content);
  if (!ms) return null;
  const endM = endPat.exec(content.slice(ms.index));
  if (!endM) return content.slice(ms.index);
  return content.slice(ms.index, ms.index + endM.index);
}

// Check scrollToTop
const scrollTopSec = section(/scrollToTop|scroll.to.top|scroll.*btn/i, /FAQ|accordion|Faq/i);
console.log('scrollTopSec found:', !!scrollTopSec, scrollTopSec ? '(len:'+scrollTopSec.length+')' : '');
if (scrollTopSec) {
  console.log('scrollTopSec preview:', scrollTopSec.slice(0, 200));
  const scrollTopFnBody = extractBody(scrollTopSec, /function scrollToTop\s*\(/);
  console.log('scrollTopFnBody:', scrollTopFnBody ? scrollTopFnBody.slice(0, 100) : 'null');
  const scrollInitBody = extractBody(scrollTopSec, /function init\s*\(\s*\)/);
  console.log('scrollInitBody found:', !!scrollInitBody);
  if (scrollInitBody) {
    console.log('scrollInitBody has aria-hidden:', /aria-hidden/.test(scrollInitBody));
    console.log('scrollInitBody preview:', scrollInitBody.slice(0, 200));
  }
}

// Check nav init
const navInitBody = extractBody(content, /function init\s*\(\s*\)/);
console.log('\nNav init body (first match):', navInitBody ? navInitBody.slice(0, 200) : 'null');
console.log('Nav init has aria-expanded:', navInitBody ? /aria-expanded/.test(navInitBody) : 'null');
console.log('Nav init has aria-controls:', navInitBody ? /aria-controls/.test(navInitBody) : 'null');

// Check combobox
const comboBody = extractBody(content, /function buildCombobox|combobox.*init|_combobox/i);
console.log('\nCombobox body found:', !!comboBody);

// Check search clear
const searchClearBody = extractBody(content, /function _clear|function clear/);
console.log('\nSearch clear body (first match):', searchClearBody ? searchClearBody.slice(0, 150) : 'null');
