// No browser or dependency needed: exercise the real application code in an isolated VM.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function makeApp() {
  const html = fs.readFileSync(path.join(root,'index.html'), 'utf8');
  const elements = new Map();
  for (const m of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const classes = new Set((m[0].match(/class="([^"]*)"/)?.[1] || '').split(' '));
    elements.set(m[1], { hidden:/\bhidden\b/.test(m[0]), value:'', textContent:'', innerHTML:'', className:'', style:{}, disabled:false,
      classList:{ add:c=>classes.add(c), remove:c=>classes.delete(c), contains:c=>classes.has(c), toggle:(c,v)=>v?classes.add(c):classes.delete(c) },
      setAttribute(){}, addEventListener(){}, querySelectorAll:()=>[], focus(){}, scrollIntoView(){}, click(){}, remove(){} });
  }
  const prefs = new Map();
  const storage = { getItem:k=>prefs.get(k) || null, setItem:(k,v)=>prefs.set(k,String(v)) };
  const ctx = vm.createContext({ console, setTimeout:()=>0, clearTimeout(){}, requestAnimationFrame:f=>f(), Blob, URL, AbortController,
    localStorage:storage, sessionStorage:storage, prompt:()=> '我的雅思计划', confirm:()=>true,
    document:{ getElementById:id=>{ if(!elements.has(id)) throw new Error('Missing element: '+id); return elements.get(id); },
      querySelector:s=>s.includes('.mode-tabs')?{dataset:{mode:'cards'}}:null, querySelectorAll:()=>[], addEventListener(){}, body:{classList:{remove(){},contains(){return false}},appendChild(){}} },
    window:{addEventListener(){},scrollTo(){},BOOKS:{}}, Audio:class {pause(){}}, fetch:async()=>{throw new Error('offline')}, SpeechSynthesisUtterance:class {} });
  for (const file of ['core','audio','import','learning','workspace','app']) {
    let source=fs.readFileSync(path.join(root,'js',file+'.js'),'utf8');
    if(file==='app') source=source.replace(/init\(\)\.catch\([\s\S]*$/, '');
    vm.runInContext(source,ctx,{filename:file+'.js'});
  }
  vm.runInContext('usingMemory = true; getSlots();',ctx);
  return { run:src=>vm.runInContext(src,ctx), elements, ctx };
}
test('HTML references and script paths are complete and IDs unique',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length);
  const refs=new Set();
  for (const file of fs.readdirSync(path.join(root,'js'))) for(const m of fs.readFileSync(path.join(root,'js',file),'utf8').matchAll(/\$\("([^"]+)"\)/g)) refs.add(m[1]);
  // Legacy optional langTabs is explicitly guarded.
  for(const id of refs) if(id!=='langTabs') assert.ok(ids.includes(id),id);
  for(const m of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) assert.ok(fs.existsSync(path.join(root,m[1])),m[1]);
});
test('memory fallback saves rapid study actions without losing daily counters',async()=>{
  const a=makeApp();
  await a.run('Promise.all(Array.from({length:20},(_,i)=>recordStudy("en","word"+i,true)))');
  assert.equal(a.run('[...memDaily.values()][0].reviewed'),20);
  assert.equal(a.run('memMeta.size'),20);
  assert.equal(a.run('[...memDaily.values()][0].slot'),'s1');
});
test('queued saves capture the original slot and familiar status is committed',async()=>{
  const a=makeApp();
  await a.run('const save = markFamiliar("en","hello"); prefSet("activeSlot:en","s2"); save');
  assert.equal(a.run('memMeta.get("s1|en|hello").familiar'),true);
  assert.equal(a.run('memMeta.has("s2|en|hello")'),false);
});
test('clear only affects selected language and slot and keeps legacy daily history',async()=>{
  const a=makeApp();
  await a.run('recordStudy("en","hello",true)');
  await a.run('prefSet("activeSlot:en","s2"); recordStudy("en","world",true)');
  await a.run('currentLang="de"; getSlots(); recordStudy("de","hallo",true)');
  a.run('memDaily.set("en|2026-01-01",{key:"en|2026-01-01",lang:"en",date:"2026-01-01",reviewed:7})');
  await a.run('clearWorkspaceData("s1","en")');
  assert.equal(a.run('memMeta.has("s1|en|hello")'),false);
  assert.equal(a.run('memMeta.has("s2|en|world")'),true);
  assert.equal(a.run('memMeta.has("s1|de|hallo")'),true);
  assert.equal(a.run('memDaily.size'),3);
});
test('renaming survives a fresh read of preferences',()=>{
  const a=makeApp();a.run('renameSlot()');assert.equal(a.run('getSlots()[0].name'),'我的雅思计划');
});
test('empty slot clears all study modes instead of retaining old questions',async()=>{
  const a=makeApp();a.run('allWords=[{lang:"en",word:"hello",meaning:"你好"}]');
  await a.run('resetStudy()');assert.equal(a.run('deck.length'),1);
  a.run('allWords=[]');await a.run('resetStudy()');
  assert.equal(a.run('deck.length+quiz.length+listen.length'),0);
  assert.equal(a.elements.get('cards-game').hidden,true);
  assert.equal(a.elements.get('quiz-game').hidden,true);
  assert.equal(a.elements.get('listen-game').hidden,true);
  assert.equal(a.elements.get('studyEmpty').hidden,false);
});
test('review queue includes due and fresh words but excludes future and familiar words',async()=>{
  const a=makeApp();a.run('allWords=["due","fresh","future","familiar"].map(word=>({lang:"en",word,meaning:"test"})); memMeta.set("s1|en|due",{key:"s1|en|due",nextReview:0}); memMeta.set("s1|en|future",{key:"s1|en|future",nextReview:Date.now()+86400000}); memMeta.set("s1|en|familiar",{key:"s1|en|familiar",familiar:true,nextReview:0})');
  const words=await a.run('getStudyWords("en",20)');assert.deepEqual(Array.from(words,w=>w.word).sort(),['due','fresh']);
});
test('import preserves phonetic and part-of-speech, and does not decode binary Excel as text',async()=>{
  const a=makeApp();a.ctx.XLSX={read:()=>({SheetNames:['English'],Sheets:{English:{}}}),utils:{sheet_to_json:()=>[['word','meaning','phonetic','pos'],['hello','你好','həˈləʊ','int.']]}};
  a.ctx.file={name:'words.xlsx',type:'',size:100,arrayBuffer:async()=>new ArrayBuffer(1),text:async()=>{throw new Error('binary decoded as text')}};
  await a.run('handleFile(file)');
  assert.equal(a.run('memWords[0].phonetic'),'həˈləʊ');assert.equal(a.run('memWords[0].pos'),'int.');assert.equal(a.run('libraryBusy'),false);
});
test('deduplication is scoped to language and plan',async()=>{
  const a=makeApp();await a.run('dbAddWords([{lang:"en",word:"Hello",meaning:"你好"},{lang:"en",word:"hello",meaning:"你好"}])');
  assert.equal(a.run('memWords.length'),1);
  await a.run('dbAddWords([{lang:"en",word:"hello",meaning:"你好"}],"s2")');assert.equal(a.run('memWords.length'),2);
});
test('list pagination limits DOM output for a large book',()=>{
  const a=makeApp();a.run('allWords=Array.from({length:10000},(_,i)=>({lang:"en",word:"word"+i,meaning:"释义"}));renderWordList()');
  assert.equal((a.elements.get('wordListBody').innerHTML.match(/<tr>/g)||[]).length,50);
  assert.ok(a.elements.get('listPage').textContent.includes('200'));
});
test('repeated listening checks or showing an answer after success cannot double count',async()=>{
  const a=makeApp();a.run('listen=[{lang:"en",word:"hello",meaning:"你好"}];listenIdx=0;listenAnswer="hello";listenChecked=false;$("listenInput").value="hello";checkListen();checkListen();showAnswerListen()');
  await a.run('studyWriteQueue');assert.equal(a.run('listenScore'),1);assert.equal(a.run('[...memDaily.values()][0].reviewed'),1);assert.equal(a.run('listenWrong.length'),0);
});
test('statistics exclude other languages and heatmap counts answers once',async()=>{
  const a=makeApp();await a.run('recordStudy("en","hello",true)');await a.run('recordStudy("de","hallo",true)');await a.run('renderStats()');
  assert.equal(a.elements.get('statLearned').textContent,1);
  assert.equal(a.elements.get('statToday').textContent,1);
  assert.ok(a.elements.get('heatmap').innerHTML.includes(' · 1 词'));
  assert.ok(!a.elements.get('heatmap').innerHTML.includes(' · 2 词'));
});
test('backup schema validates records and rejects malformed or foreign backups',async()=>{
  const a=makeApp();await a.run('recordStudy("en","hello",true)');
  assert.equal(a.run('validateBackup({format:"word-trainer-backup",version:1,words:[],meta:[...memMeta.values()],daily:[...memDaily.values()]}).meta.length'),1);
  assert.throws(()=>a.run('validateBackup({format:"foreign",version:1,words:[],meta:[],daily:[]})'));
  assert.throws(()=>a.run('validateBackup({format:"word-trainer-backup",version:1,words:[],meta:[{lang:"en",word:"hello",key:"wrong"}],daily:[]})'));
});
test('invalid group size falls back safely and input HTML is escaped',()=>{
  const a=makeApp();a.run('prefSet("groupSize","oops")');assert.equal(a.run('getGroupSize()'),20);
  assert.equal(a.run('esc("<script>")'),'&lt;script&gt;');
});
test('language detection uses full tokens, not accidental substrings',()=>{
  const a=makeApp();assert.equal(a.run('detectLang("test.csv")'),null);assert.equal(a.run('detectLang("English words")'),'en');assert.equal(a.run('detectLang("German")'),'de');assert.equal(a.run('detectLang("西班牙语")'),'es');
});
test('preference changes stay visible if persistent storage hits quota',()=>{
  const a=makeApp();a.ctx.localStorage.setItem=()=>{throw new Error('quota')};a.run('prefSet("groupSize","10")');assert.equal(a.run('getGroupSize()'),10);
});
test('application initializes with unavailable IndexedDB and an offline voice service',async()=>{
  const a=makeApp();a.ctx.XLSX={};
  const query=a.ctx.document.querySelector;
  a.ctx.document.querySelector=s=>s==='.brand'?{}:query(s);
  await a.run('init()');
  assert.equal(a.run('usingMemory'),true);
  assert.equal(a.elements.get('studyEmpty').hidden,false);
  assert.ok(a.elements.get('engineStatus').textContent.includes('系统朗读'));
});
function loadAllBooks(a) {
  for (const file of ['books-data.js','books-business.js','books-professional.js','books-exam.js','books-de-cefr.js','books-es-freq.js','books-open.js']) {
    vm.runInContext(fs.readFileSync(path.join(root,'books',file),'utf8'),a.ctx,{filename:file});
  }
}
test('new community books have complete fields, unique words, pinned provenance and archived licenses',()=>{
  const a=makeApp();loadAllBooks(a);
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'books/sources/manifest.json'),'utf8'));
  const books=a.ctx.window.BOOKS_OPEN;
  assert.equal(Object.keys(books).length,15);
  let total=0;
  for(const book of Object.values(books)) {
    assert.ok(['en','de','es'].includes(book.lang));
    assert.ok(['foundation','exam','professional','dictionary'].includes(book.category));
    assert.equal(new Set(book.words.map(w=>w.w.toLocaleLowerCase())).size,book.words.length,book.id);
    assert.ok(/^[a-f0-9]{40}$/.test(book.source.revision));
    assert.ok(book.source.url.includes(book.source.revision));
    for(const row of book.words) for(const key of ['w','m','p','pos']) assert.equal(typeof row[key],'string');
    assert.ok(book.words.every(row=>row.w.trim()&&row.m.trim()),book.id);
    total+=book.words.length;
    assert.equal(manifest.books.find(row=>row.id===book.id).count,book.words.length);
  }
  assert.equal(total,45098);
  const crypto=require('node:crypto');
  for(const item of manifest.books) {
    const input=fs.readFileSync(path.join(root,'books/sources/raw',item.input));
    assert.equal(crypto.createHash('sha256').update(input).digest('hex'),item.inputSHA256,item.id);
  }
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'books/books-open.js'))).digest('hex'),manifest.generatedSHA256);
  for(const file of ['qwerty/LICENSE','endict/LICENSE','ecdict/LICENSE','freedict/spa-eng/COPYING']) assert.ok(fs.statSync(path.join(root,'books/sources/raw',file)).size>1000);
});
test('catalogue merges old and new books, filters by theme and searches titles',()=>{
  const a=makeApp();loadAllBooks(a);a.run('renderBuiltinBooks()');
  assert.equal(a.run('Object.keys(window.BOOKS).length'),32);
  assert.ok(a.elements.get('bookIntro').textContent.includes('27 本'));
  assert.ok(a.elements.get('builtinBooks').innerHTML.includes('SAT 词汇'));
  assert.ok(a.elements.get('builtinBooks').innerHTML.includes('GPL-3.0'));
  a.elements.get('bookSearchInput').value='Science';a.run('renderBuiltinBooks()');
  assert.ok(a.elements.get('builtinBooks').innerHTML.includes('AI for Science'));
  assert.ok(!a.elements.get('builtinBooks').innerHTML.includes('SAT 词汇'));
  a.elements.get('bookSearchInput').value='';a.elements.get('bookCategorySelect').value='professional';a.run('renderBuiltinBooks()');
  assert.ok(a.elements.get('builtinBooks').innerHTML.includes('生物医学专业英语'));
  assert.ok(!a.elements.get('builtinBooks').innerHTML.includes('SAT 词汇'));
  a.elements.get('bookSearchInput').value='no-match-words';a.run('renderBuiltinBooks()');
  assert.ok(a.elements.get('builtinBooks').innerHTML.includes('没有匹配'));
});
test('German and Spanish catalogue identifies English glosses and does not mislabel them as Chinese',()=>{
  const a=makeApp();loadAllBooks(a);a.run('currentLang="de";renderBuiltinBooks()');
  assert.ok(a.elements.get('bookIntro').textContent.includes('3 本'));
  assert.ok(a.elements.get('builtinBooks').innerHTML.includes('英文释义'));
  assert.ok(a.elements.get('builtinBooks').innerHTML.includes('德语通用词汇'));
  a.run('currentLang="es";renderBuiltinBooks()');
  assert.ok(a.elements.get('bookIntro').textContent.includes('2 本'));
  assert.ok(a.elements.get('builtinBooks').innerHTML.includes('FreeDict'));
  assert.ok(a.elements.get('builtinBooks').innerHTML.includes('GPL-2.0-or-later'));
});
test('large new book loads, deduplicates, paginates and generates a study group',async()=>{
  const a=makeApp();loadAllBooks(a);
  a.run('renderBuiltinBooks()');
  const first=await a.run('dbAddWords(window.BOOKS_OPEN.open_tem8.words.map(w=>({lang:"en",word:w.w,meaning:w.m,phonetic:w.p,pos:w.pos})))');
  assert.equal(first.added,12197);
  const second=await a.run('dbAddWords(window.BOOKS_OPEN.open_tem8.words.map(w=>({lang:"en",word:w.w,meaning:w.m,phonetic:w.p,pos:w.pos})))');
  assert.equal(second.added,0);assert.equal(second.skipped,12197);
  await a.run('reloadWords();');await a.run('resetStudy()');
  assert.equal(a.run('allWords.length'),12197);
  assert.equal(a.run('deck.length'),20);
  assert.equal((a.elements.get('wordListBody').innerHTML.match(/<tr>/g)||[]).length,50);
  assert.ok(a.run('allWords[0].phonetic.length')>0);
});
