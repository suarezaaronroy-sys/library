// calculator-core.mjs
// Currency-aware + variables expression engine (no eval).
// Sliced verbatim from the site owner's standalone calculator; exports added for UI + tests.

var BASE = 'PHP';
  var CUR_CODES = ['PHP','GBP','USD','CAD','AUD'];
  var DEFAULT_RATES = { PHP:1, GBP:73, USD:57, CAD:42, AUD:38 };

  /* ============================================================
   *  Expression engine — tokenize -> currency -> variables ->
   *  implicit × -> shunting-yard -> RPN -> evaluate.  No eval().
   * ============================================================ */
  var CONST = { pi: Math.PI, e: Math.E, tau: Math.PI*2, phi: (1+Math.sqrt(5))/2 };
  var FUNCS = { sin:1,cos:1,tan:1,asin:1,acos:1,atan:1,sinh:1,cosh:1,tanh:1,
                ln:1,log:1,log2:1,sqrt:1,cbrt:1,exp:1,abs:1,sign:1,round:1,floor:1,ceil:1,fact:1 };
  var CURSET = {}; CUR_CODES.forEach(function(c){ CURSET[c]=1; });
  var RIGHT = { '^':1,'u-':1,'u+':1 };
  var PREC  = { '+':2,'-':2,'*':3,'/':3,'%mod':3,'^':4,'u-':5,'u+':5 };

  function tokenize(src){
    var s = src.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/,/g,'').replace(/π/g,'pi').replace(/√/g,'sqrt').replace(/∛/g,'cbrt');
    var t=[], i=0, n=s.length;
    function isD(c){return c>='0'&&c<='9';}
    function isA(c){return /[a-zA-Z_]/.test(c);}
    while(i<n){
      var c=s[i];
      if(c===' '||c==='\t'){i++;continue;}
      if(isD(c)||(c==='.'&&isD(s[i+1]))){
        var j=i+1;
        while(j<n&&(isD(s[j])||s[j]==='.'))j++;
        if(s[j]==='e'||s[j]==='E'){
          var k=j+1; if(s[k]==='+'||s[k]==='-')k++;
          if(isD(s[k])){j=k; while(j<n&&isD(s[j]))j++;}
        }
        var num=s.slice(i,j);
        if((num.match(/\./g)||[]).length>1) throw new Error('bad number');
        t.push({t:'num',v:parseFloat(num)}); i=j; continue;
      }
      if(isA(c)){
        var j2=i+1; while(j2<n&&(isA(s[j2])||isD(s[j2])))j2++;
        var raw=s.slice(i,j2), name=raw.toLowerCase(), up=raw.toUpperCase();
        if(FUNCS[name]) t.push({t:'func',v:name});
        else if(name in CONST) t.push({t:'num',v:CONST[name]});
        else if(CURSET[up]) t.push({t:'cur',v:up});
        else t.push({t:'var',v:name});
        i=j2; continue;
      }
      if(c==='('){t.push({t:'lp'});i++;continue;}
      if(c===')'){t.push({t:'rp'});i++;continue;}
      if(c==='!'){t.push({t:'op',v:'!'});i++;continue;}
      if('+-*/^'.indexOf(c)>-1){t.push({t:'op',v:c});i++;continue;}
      if(c==='%'){t.push({t:'op',v:'%'});i++;continue;}
      throw new Error('unexpected "'+c+'"');
    }
    return t;
  }

  // number immediately followed by a currency code -> convert into display currency
  function resolveCurrency(t, rates, display){
    var out=[];
    for(var i=0;i<t.length;i++){
      var tk=t[i], nx=t[i+1];
      if(tk.t==='num' && nx && nx.t==='cur'){
        var rc=rates[nx.v], rd=rates[display];
        if(!(rc>0)||!(rd>0)) throw new Error('rate for '+nx.v+' missing');
        out.push({t:'num', v: tk.v*(rc/rd)}); i++; continue;
      }
      if(tk.t==='cur') throw new Error(tk.v+' needs a number');
      out.push(tk);
    }
    return out;
  }

  function resolveVars(t, vars){
    return t.map(function(tk){
      if(tk.t==='var'){
        if(!vars || !(tk.v in vars)) throw new Error('unknown "'+tk.v+'"');
        return {t:'num', v:vars[tk.v]};
      }
      return tk;
    });
  }

  // implicit multiplication: 2pi, 2(3), 3sin(x), (2)(3), (2)3, 5!2, 2rate
  function implicitMul(t){
    var out=[];
    for(var i=0;i<t.length;i++){
      out.push(t[i]);
      var a=t[i], b=t[i+1];
      if(!b) continue;
      var aEnd = a.t==='num'||a.t==='rp'||(a.t==='op'&&a.v==='!');
      var bStart = b.t==='num'||b.t==='lp'||b.t==='func';
      if(aEnd&&bStart) out.push({t:'op',v:'*'});
    }
    return out;
  }

  function toRPN(t){
    var out=[], ops=[], prev=null;
    function valuePrev(p){ return p && (p.t==='num'||p.t==='rp'||(p.t==='op'&&(p.v==='!'||p.v==='%post'))); }
    for(var i=0;i<t.length;i++){
      var tk=t[i], next=t[i+1];
      if(tk.t==='num'){out.push(tk);prev=tk;continue;}
      if(tk.t==='func'){ops.push(tk);prev=tk;continue;}
      if(tk.t==='lp'){ops.push(tk);prev=tk;continue;}
      if(tk.t==='rp'){
        while(ops.length&&ops[ops.length-1].t!=='lp') out.push(ops.pop());
        if(!ops.length) throw new Error('mismatched )');
        ops.pop();
        if(ops.length&&ops[ops.length-1].t==='func') out.push(ops.pop());
        prev=tk;continue;
      }
      if(tk.t==='op'){
        if(tk.v==='!'){ out.push({t:'op',v:'!'}); prev={t:'op',v:'!'}; continue; }
        if(tk.v==='%'){
          var modulo = valuePrev(prev) && next && (next.t==='num'||next.t==='lp'||next.t==='func');
          if(!modulo && valuePrev(prev)){ out.push({t:'op',v:'%post'}); prev={t:'op',v:'%post'}; continue; }
          tk={t:'op',v:'%mod'};
        }
        var opv=tk.v;
        if((opv==='-'||opv==='+')&&!valuePrev(prev)) opv = opv==='-'?'u-':'u+';
        while(ops.length){
          var top=ops[ops.length-1];
          if(top.t!=='op') break;
          var pop = RIGHT[opv] ? (PREC[opv]<PREC[top.v]) : (PREC[opv]<=PREC[top.v]);
          if(pop) out.push(ops.pop()); else break;
        }
        ops.push({t:'op',v:opv});
        prev={t:'op',v:opv};continue;
      }
    }
    while(ops.length){ var o=ops.pop(); if(o.t==='lp') throw new Error('mismatched ('); out.push(o); }
    return out;
  }

  function gamma(z){
    var g=7, c=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,
      -176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
    if(z<0.5) return Math.PI/(Math.sin(Math.PI*z)*gamma(1-z));
    z-=1; var x=c[0];
    for(var i=1;i<g+2;i++) x+=c[i]/(z+i);
    var tt=z+g+0.5;
    return Math.sqrt(2*Math.PI)*Math.pow(tt,z+0.5)*Math.exp(-tt)*x;
  }
  function factorial(x){
    if(!isFinite(x)) return NaN;
    if(Math.abs(x-Math.round(x))>1e-9) return gamma(x+1);
    x=Math.round(x); if(x<0) return NaN; if(x>170) return Infinity;
    var r=1; for(var k=2;k<=x;k++) r*=k; return r;
  }

  function evalRPN(rpn, angle){
    var st=[];
    function toR(x){ return angle==='deg'? x*Math.PI/180 : x; }
    function frR(x){ return angle==='deg'? x*180/Math.PI : x; }
    function pop(){ if(!st.length) throw new Error('incomplete'); return st.pop(); }
    for(var i=0;i<rpn.length;i++){
      var tk=rpn[i];
      if(tk.t==='num'){ st.push(tk.v); continue; }
      if(tk.t==='func'){
        var a=pop(), r;
        switch(tk.v){
          case 'sin':r=Math.sin(toR(a));break; case 'cos':r=Math.cos(toR(a));break; case 'tan':r=Math.tan(toR(a));break;
          case 'asin':r=frR(Math.asin(a));break; case 'acos':r=frR(Math.acos(a));break; case 'atan':r=frR(Math.atan(a));break;
          case 'sinh':r=Math.sinh(a);break; case 'cosh':r=Math.cosh(a);break; case 'tanh':r=Math.tanh(a);break;
          case 'ln':r=Math.log(a);break; case 'log':r=Math.log10(a);break; case 'log2':r=Math.log2(a);break;
          case 'sqrt':r=Math.sqrt(a);break; case 'cbrt':r=Math.cbrt(a);break; case 'exp':r=Math.exp(a);break;
          case 'abs':r=Math.abs(a);break; case 'sign':r=Math.sign(a);break;
          case 'round':r=Math.round(a);break; case 'floor':r=Math.floor(a);break; case 'ceil':r=Math.ceil(a);break;
          case 'fact':r=factorial(a);break;
        }
        st.push(r); continue;
      }
      if(tk.t==='op'){
        if(tk.v==='u-'){ st.push(-pop()); continue; }
        if(tk.v==='u+'){ st.push(+pop()); continue; }
        if(tk.v==='!'){ st.push(factorial(pop())); continue; }
        if(tk.v==='%post'){ st.push(pop()/100); continue; }
        var b=pop(), a2=pop();
        switch(tk.v){
          case '+':st.push(a2+b);break; case '-':st.push(a2-b);break;
          case '*':st.push(a2*b);break; case '/':st.push(a2/b);break;
          case '^':st.push(Math.pow(a2,b));break; case '%mod':st.push(a2%b);break;
        }
        continue;
      }
    }
    if(st.length!==1) throw new Error('incomplete');
    return st[0];
  }

  // ctx: string(angle) OR {angle,vars,rates,display}
  function evaluate(src, ctx){
    if(src==null || !String(src).trim()) return {ok:true, value:null, currency:false};
    var c = (typeof ctx==='string') ? {angle:ctx} : (ctx||{});
    var angle=c.angle||'deg', vars=c.vars||{}, rates=c.rates||DEFAULT_RATES, display=c.display||BASE;
    try{
      var toks = tokenize(String(src));
      var usedCur = false, k;
      for(k=0;k<toks.length;k++){ if(toks[k].t==='cur'){ usedCur=true; break; } }
      var pipeline = implicitMul(resolveVars(resolveCurrency(toks, rates, display), vars));
      var v = evalRPN(toRPN(pipeline), angle);
      if(typeof v!=='number' || Number.isNaN(v)) return {ok:false, error:'not a number'};
      return {ok:true, value:v, currency:usedCur};
    }catch(e){ return {ok:false, error:e.message}; }
  }

  function isReserved(name){
    name=name.toLowerCase();
    return FUNCS[name] || (name in CONST) || CURSET[name.toUpperCase()];
  }

  /* ---------------- number formatting ---------------- */
  function fmt(n){
    if(typeof n!=='number' || Number.isNaN(n)) return '—';
    if(!isFinite(n)) return n>0?'∞':'-∞';
    if(n===0) return '0';
    var abs=Math.abs(n), s;
    if(abs>=1e15 || abs<1e-9){
      s=n.toExponential(9).replace(/(\.\d*?)0+e/,'$1e').replace(/\.e/,'e');
    } else { s=String(parseFloat(n.toPrecision(12))); }
    return s;
  }
  function group(s){
    if(/e/i.test(s)) return s;
    var neg=s[0]==='-'; if(neg) s=s.slice(1);
    var p=s.split('.'), gi=p[0].replace(/\B(?=(\d{3})+(?!\d))/g,',');
    return (neg?'-':'')+gi+(p[1]?'.'+p[1]:'');
  }

  /* ============================================================
   *  UI
   * ============================================================ */

export { evaluate, isReserved, fmt, group, CUR_CODES, BASE, DEFAULT_RATES };
