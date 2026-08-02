const B = process.env.BASE_URL || 'http://localhost:5700';
const raw = async (path) => (await fetch(B + path)).text();

const global = await raw('/en/markets/global');
const us = await raw('/en/markets/us');
const news = await raw('/en/markets/us/news');
const japanNews = await raw('/en/markets/japan/news');

const count = (html, re) => (html.match(re) || []).length;
const first = (html, re) => (html.match(re) || [])[1];

console.log('=== server-rendered HTML, no JavaScript executed ===');
console.log('global  one H1                 :', count(global, /<h1/g) === 1);
console.log('global  intro prose present    :', global.includes('A stock market is not one place'));
console.log('global  canonical              :', first(global, /rel="canonical" href="([^"]+)"/));
console.log('global  BreadcrumbList JSON-LD :', global.includes('"@type":"BreadcrumbList"'));
console.log('global  intent nav is anchors  :', global.includes('href="/en/markets/global/news"') || global.includes('>News<'));

console.log('us      H1                     :', first(us, /<h1[^>]*>([^<]+)/));
console.log('us      canonical              :', first(us, /rel="canonical" href="([^"]+)"/));
console.log('us      intro is its own       :', us.includes('two main venues') && !us.includes('A stock market is not one place'));

console.log('news    H1                     :', first(news, /<h1[^>]*>([^<]+)/));
console.log('news    direct answer up top   :', news.includes('local time. Below'));
console.log('news    canonical              :', first(news, /rel="canonical" href="([^"]+)"/));

console.log('\n=== indexability follows the registry ===');
console.log('us overview  noindex?          :', /noindex/.test(us), '(expected false)');
console.log('us news      noindex?          :', /noindex/.test(news), '(expected false)');
console.log('japan news   noindex?          :', /noindex/.test(japanNews), '(expected true)');

console.log('\n=== titles are unique ===');
const titles = [global, us, news, japanNews].map((html) => first(html, /<title>([^<]+)/));
console.log(titles.join('\n'));
console.log('all distinct                   :', new Set(titles).size === titles.length);

console.log('\n=== the menu no longer says Entire World ===');
const home = await raw('/en');
console.log('"Entire world" gone            :', !/entire world/i.test(home));
console.log('"Global Markets" present       :', /Global Markets/.test(home));
