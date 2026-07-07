import { evaluate, isReserved, fmt, group, CUR_CODES, BASE, DEFAULT_RATES } from "./calculator-core.mjs?v=3";
import { loadValue, saveState } from "./store.js?v=5";

(function(){
  "use strict";

var root=document.querySelector('[data-calc-root]');
  if(!root) return;
  var $=function(s){return root.querySelector(s);};
  var el={
    expr:$('[data-expr]'), result:$('[data-result]'), curChip:$('[data-cur-chip]'),
    sci:$('[data-sci]'), keys:$('[data-keys]'), curRow:$('[data-cur-row]'),
    currencyTools:$('[data-currency-tools]'),
    history:$('[data-history]'), toast:$('[data-toast]'), memFlag:$('[data-mem-flag]'),
    angleGroup:$('[data-angle-group]'),
    varForm:$('[data-var-form]'), varName:$('[data-var-name]'), varExpr:$('[data-var-expr]'),
    varList:$('[data-var-list]'), rates:$('[data-rates]'), displayCur:$('[data-display-cur]')
  };

  var K={ hist:'asuarez.calc.history.v2', vars:'asuarez.calc.vars.v1', rates:'asuarez.calc.rates.v1', disp:'asuarez.calc.display.v1' };
  function load(key, fb){ return loadValue(key, fb); }
  function store(key, v){ saveState(key, v); }

  var state={ expr:'', angle:'deg', mode:'standard', mem:0, memSet:false, ans:0, justEvaluated:false };
  var history=load(K.hist, []);
  // Non-finite results (e.g. 1/0 -> Infinity) serialize to null in JSON and
  // previously crashed renderHistory on every load. Drop invalid entries.
  if(!Array.isArray(history)) history=[];
  history=history.filter(function(h){ return h && typeof h.v==='number' && isFinite(h.v); });
  var vars=load(K.vars, {});
  var rates=Object.assign({}, DEFAULT_RATES, load(K.rates, {}));
  var displayCur=load(K.disp, BASE);
  if(CUR_CODES.indexOf(displayCur)<0) displayCur=BASE;

  function ctx(){ return {angle:state.angle, vars:vars, rates:rates, display:displayCur}; }

  var MAIN=[
    {l:'(',i:'('},{l:')',i:')'},{l:'%',i:'%',c:'op'},{l:'AC',a:'clear',c:'util'},
    {l:'7',i:'7'},{l:'8',i:'8'},{l:'9',i:'9'},{l:'÷',i:'/',c:'op'},
    {l:'4',i:'4'},{l:'5',i:'5'},{l:'6',i:'6'},{l:'×',i:'*',c:'op'},
    {l:'1',i:'1'},{l:'2',i:'2'},{l:'3',i:'3'},{l:'−',i:'-',c:'op'},
    {l:'±',a:'negate'},{l:'0',i:'0'},{l:'.',i:'.'},{l:'+',i:'+',c:'op'},
    {l:'⌫',a:'back'},{l:'Ans',a:'ans',c:'fn'},{l:'=',a:'equals',c:'equals span2'}
  ];
  var SCI=[
    {l:'sin',i:'sin(',c:'fn'},{l:'cos',i:'cos(',c:'fn'},{l:'tan',i:'tan(',c:'fn'},{l:'π',i:'pi',c:'fn'},
    {l:'asin',i:'asin(',c:'fn'},{l:'acos',i:'acos(',c:'fn'},{l:'atan',i:'atan(',c:'fn'},{l:'e',i:'e',c:'fn'},
    {l:'xʸ',i:'^',c:'fn'},{l:'x²',i:'^2',c:'fn'},{l:'√',i:'sqrt(',c:'fn'},{l:'∛',i:'cbrt(',c:'fn'},
    {l:'ln',i:'ln(',c:'fn'},{l:'log',i:'log(',c:'fn'},{l:'exp',i:'exp(',c:'fn'},{l:'|x|',i:'abs(',c:'fn'},
    {l:'n!',i:'!',c:'fn'},{l:'1/x',a:'recip',c:'fn'},{l:'EE',i:'*10^',c:'fn'},{l:'mod',i:'%',c:'fn'}
  ];

  function renderKeys(container, defs){
    container.innerHTML='';
    defs.forEach(function(k){
      var b=document.createElement('button');
      b.type='button'; b.className='calc-key'+(k.c?(' '+k.c):''); b.innerHTML=k.l;
      b.addEventListener('click',function(){ k.a?doAction(k.a):insert(k.i); });
      container.appendChild(b);
    });
  }
  function renderCurRow(){
    el.curRow.innerHTML='';
    CUR_CODES.forEach(function(code){
      var b=document.createElement('button');
      b.type='button'; b.className='calc-key cur'; b.textContent=code;
      b.addEventListener('click',function(){ insert(' '+code+' '); });
      el.curRow.appendChild(b);
    });
  }

  function insert(str){
    if(state.justEvaluated){
      if(/^[+\-*/^%!)]/.test(str) || str==='*10^') state.expr=fmt(state.ans);
      else state.expr='';
      state.justEvaluated=false;
    }
    state.expr+=str; render();
  }

  function doAction(a){
    switch(a){
      case 'clear': state.expr=''; state.justEvaluated=false; break;
      case 'back': if(state.justEvaluated) state.justEvaluated=false; state.expr=state.expr.slice(0,-1); break;
      case 'negate': state.expr=toggleSign(state.expr); state.justEvaluated=false; break;
      case 'recip':
        if(state.justEvaluated){ state.expr='1/('+fmt(state.ans)+')'; state.justEvaluated=false; }
        else if(state.expr) state.expr='1/('+state.expr+')';
        break;
      case 'ans': insert(fmt(state.ans)); return;
      case 'equals': return equals();
    }
    render();
  }

  function toggleSign(expr){
    if(!expr) return '-';
    var m=expr.match(/(\d*\.?\d+(?:[eE][+-]?\d+)?)$/);
    if(!m) return expr+'-';
    var num=m[1], start=expr.length-num.length, before=expr.slice(0,start);
    if(before.slice(-2)==='(-'){ return before.slice(0,-2)+num; }
    if(before.slice(-1)==='-' && (before.length===1 || /[(+\-*/^%]$/.test(before.slice(0,-1)))){
      return before.slice(0,-1)+num;
    }
    return before+'(-'+num+')';
  }

  function currentEval(){ return evaluate(state.expr, ctx()); }

  function equals(){
    var r=currentEval();
    if(r.value===null) return;
    if(!r.ok){ el.result.classList.add('is-error'); el.result.textContent='—'; return; }
    state.ans=r.value;
    pushHistory(state.expr, r.value, r.currency);
    state.expr=fmt(r.value); state.justEvaluated=true; render();
  }

  function pushHistory(expr, val, cur){
    if(typeof val!=='number' || !isFinite(val)) return; // never persist non-finite values
    history.unshift({e:expr, v:val, c:!!cur, d:displayCur, t:Date.now()});
    history=history.slice(0,50); store(K.hist, history); renderHistory();
  }
  function renderHistory(){
    el.history.innerHTML='';
    if(!history.length){ el.history.innerHTML='<div class="calc-empty">No calculations yet.</div>'; return; }
    history.forEach(function(h){
      var li=document.createElement('li');
      var b=document.createElement('button'); b.type='button';
      var tag=h.c?(' '+(h.d||'')):'';
      b.innerHTML='<span class="h-expr">'+esc(h.e)+' =</span><span class="h-val">'+group(fmt(h.v))+esc(tag)+'</span>';
      b.addEventListener('click',function(){ state.expr=fmt(h.v); state.justEvaluated=true; render(); toast('Loaded '+group(fmt(h.v))); });
      li.appendChild(b); el.history.appendChild(li);
    });
  }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  function render(){
    el.expr.innerHTML = state.expr? esc(state.expr) : '&nbsp;';
    el.result.classList.remove('is-error');
    var r=currentEval();
    if(r.value===null){ el.result.textContent = state.justEvaluated? group(fmt(state.ans)) : '0'; el.curChip.classList.remove('on'); }
    else if(r.ok){ el.result.textContent = group(fmt(r.value)); el.curChip.textContent=displayCur; el.curChip.classList.toggle('on', !!r.currency); }
    else { el.result.textContent='…'; el.curChip.classList.remove('on'); }
    el.memFlag.classList.toggle('on', state.memSet && state.mem!==0);
  }

  function toast(msg){ el.toast.textContent=msg; clearTimeout(toast._t); toast._t=setTimeout(function(){ el.toast.textContent=''; },1900); }

  /* ---- variables ---- */
  function renderVars(){
    el.varList.innerHTML='';
    var names=Object.keys(vars);
    if(!names.length){ el.varList.innerHTML='<div class="calc-empty">None yet — try rate = 45.</div>'; return; }
    names.forEach(function(name){
      var li=document.createElement('li');
      var use=document.createElement('button'); use.type='button'; use.className='v-use';
      use.innerHTML='<span class="v-name">'+esc(name)+'</span> <span class="v-val">'+group(fmt(vars[name]))+'</span>';
      use.addEventListener('click',function(){ insert(name); });
      var del=document.createElement('button'); del.type='button'; del.className='v-del'; del.innerHTML='×'; del.title='Delete '+name;
      del.addEventListener('click',function(){ delete vars[name]; store(K.vars,vars); renderVars(); render(); });
      li.appendChild(use); li.appendChild(del); el.varList.appendChild(li);
    });
  }
  el.varForm.addEventListener('submit',function(ev){
    ev.preventDefault();
    var name=(el.varName.value||'').trim();
    var expr=(el.varExpr.value||'').trim();
    if(!/^[a-zA-Z_][\w]*$/.test(name)){ toast('Name must start with a letter'); return; }
    if(isReserved(name)){ toast('"'+name+'" is reserved'); return; }
    if(!expr){ toast('Enter a value'); return; }
    var r=evaluate(expr, ctx());
    if(!r.ok || r.value===null){ toast('Bad value: '+(r.error||'empty')); return; }
    vars[name]=r.value; store(K.vars,vars); renderVars(); render();
    el.varName.value=''; el.varExpr.value=''; el.varName.focus();
    toast(name+' = '+group(fmt(r.value)));
  });
  root.querySelector('[data-clear-vars]').addEventListener('click',function(){ vars={}; store(K.vars,vars); renderVars(); render(); toast('Variables cleared'); });

  /* ---- rates ---- */
  function renderRates(){
    el.rates.innerHTML='';
    CUR_CODES.forEach(function(code){
      var row=document.createElement('div'); row.className='calc-rate';
      var lab=document.createElement('label'); lab.textContent=code;
      var inp=document.createElement('input'); inp.type='number'; inp.step='0.0001'; inp.min='0';
      inp.value=rates[code]; inp.setAttribute('aria-label','Rate for '+code);
      var unit=document.createElement('small'); unit.textContent=(code===BASE?'base':BASE);
      if(code===BASE){ inp.disabled=true; }
      inp.addEventListener('input',function(){ var v=parseFloat(inp.value); if(v>0){ rates[code]=v; store(K.rates,rates); renderVars(); render(); } });
      row.appendChild(lab); row.appendChild(inp); row.appendChild(unit); el.rates.appendChild(row);
    });
  }
  CUR_CODES.forEach(function(code){
    var o=document.createElement('option'); o.value=code; o.textContent=code; if(code===displayCur)o.selected=true; el.displayCur.appendChild(o);
  });
  el.displayCur.addEventListener('change',function(){ displayCur=el.displayCur.value; store(K.disp,displayCur); render(); });

  /* ---- memory ---- */
  function memValue(){ if(state.expr){ var r=currentEval(); return (r.ok&&r.value!==null)? r.value : state.ans; } return state.ans; }
  root.querySelectorAll('[data-mem]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var op=btn.getAttribute('data-mem');
      if(op==='mc'){ state.mem=0; state.memSet=false; toast('Memory cleared'); }
      else if(op==='mr'){ insert(fmt(state.mem)); toast('Recalled '+group(fmt(state.mem))); }
      else if(op==='ms'){ state.mem=memValue(); state.memSet=true; toast('Stored '+group(fmt(state.mem))); }
      else if(op==='m+'){ state.mem+=memValue(); state.memSet=true; toast('M+ '+group(fmt(state.mem))); }
      else if(op==='m-'){ state.mem-=memValue(); state.memSet=true; toast('M− '+group(fmt(state.mem))); }
      render();
    });
  });

  /* ---- toggles ---- */
  root.querySelectorAll('[data-mode]').forEach(function(btn){
    btn.addEventListener('click',function(){
      state.mode=btn.getAttribute('data-mode');
      root.querySelectorAll('[data-mode]').forEach(function(b){ b.setAttribute('aria-pressed', b===btn?'true':'false'); });
      el.sci.hidden = state.mode!=='scientific';
      el.angleGroup.hidden = state.mode!=='scientific';
      el.currencyTools.hidden = state.mode!=='currency';
    });
  });
  root.querySelectorAll('[data-angle]').forEach(function(btn){
    btn.addEventListener('click',function(){
      state.angle=btn.getAttribute('data-angle');
      root.querySelectorAll('[data-angle]').forEach(function(b){ b.setAttribute('aria-pressed', b===btn?'true':'false'); });
      render();
    });
  });

  root.querySelector('[data-copy]').addEventListener('click',function(){
    var r=currentEval(); var val=(r.ok&&r.value!==null)?fmt(r.value):fmt(state.ans);
    var done=function(){ toast('Copied '+group(val)); };
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(val).then(done,done); }
    else { var ta=document.createElement('textarea'); ta.value=val; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');}catch(e){} ta.remove(); done(); }
  });
  root.querySelector('[data-clear-history]').addEventListener('click',function(){ history=[]; store(K.hist,history); renderHistory(); toast('Tape cleared'); });

  /* ---- keyboard ---- */
  document.addEventListener('keydown',function(ev){
    if(root.hidden) return;
    if(ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
    var k=ev.key;
    if(k>='0'&&k<='9'){ insert(k); ev.preventDefault(); return; }
    if('+-*/^().!%'.indexOf(k)>-1){ insert(k); ev.preventDefault(); return; }
    if(k==='.'){ insert('.'); ev.preventDefault(); return; }
    if(k==='Enter'||k==='='){ equals(); ev.preventDefault(); return; }
    if(k==='Backspace'){ doAction('back'); ev.preventDefault(); return; }
    if(k==='Escape'){ doAction('clear'); ev.preventDefault(); return; }
  });

  /* ---- boot ---- */
  // Isolated so a calculator failure can never block other workbench widgets
  // (billing.js imports this module; an uncaught throw here would abort it).
  try{
    renderKeys(el.keys, MAIN);
    renderKeys(el.sci, SCI);
    renderCurRow();
    renderVars();
    renderRates();
    renderHistory();
    render();
  }catch(err){
    console.error('Calculator failed to initialise:', err);
  }
})();
