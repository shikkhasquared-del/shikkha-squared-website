// Website assistant: a chat bubble that asks /api/chat, which answers from public information only.
// Replies are shown as plain text; only this site's own pages and WhatsApp become links.
(()=>{
  'use strict';
  const css=document.createElement('link');
  css.rel='stylesheet';css.href='/chat.css?v=1';document.head.appendChild(css);

  const STORE='ss-chat',LIMIT=500;
  const read=()=>{try{const saved=JSON.parse(sessionStorage.getItem(STORE)||'[]');return Array.isArray(saved)?saved:[];}catch{return [];}};
  const save=()=>{try{sessionStorage.setItem(STORE,JSON.stringify(history.slice(-20)));}catch{}};
  const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node;};
  const history=read();
  let whatsapp='https://wa.me/8801787668201',busy=false;

  const bubble=el('button','ssb-bubble');
  bubble.type='button';bubble.setAttribute('aria-expanded','false');bubble.setAttribute('aria-controls','ssb-panel');bubble.setAttribute('aria-label','Ask our assistant');
  bubble.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H4l1.6-3.6A8 8 0 1 1 21 12Z"/></svg><span>Ask us</span>';
  if(document.querySelector('.motion-toggle'))bubble.classList.add('above-motion');

  const panel=el('section','ssb-panel');
  panel.id='ssb-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Shikkha Squared assistant');
  const head=el('header','ssb-head');
  const title=el('div','ssb-title');
  title.append(el('strong','','Shikkha Squared assistant'),el('small','','AI assistant. It can make mistakes, so please confirm fees and access with our team.'));
  const close=el('button','ssb-close');
  close.type='button';close.setAttribute('aria-label','Close chat');close.textContent='×';
  head.append(title,close);
  const log=el('div','ssb-log');
  log.setAttribute('role','log');log.setAttribute('aria-live','polite');log.tabIndex=0;
  const human=el('a','ssb-human','Talk to a person on WhatsApp');
  human.target='_blank';human.rel='noopener noreferrer';human.href=whatsapp;
  const form=el('form','ssb-form');
  const input=el('input','ssb-input');
  input.type='text';input.maxLength=LIMIT;input.placeholder='Type your question…';input.autocomplete='off';input.setAttribute('aria-label','Your question');input.enterKeyHint='send';
  const send=el('button','ssb-send','Send');
  send.type='submit';
  form.append(input,send);
  panel.append(head,log,human,form);
  document.body.append(bubble,panel);

  // Plain text, with this site's pages and WhatsApp as links.
  const LINK=/(^|[\s(])(\/(?:courses|instructors)(?:\/[a-z0-9-]+)*|\/login|\/privacy|\/terms|https:\/\/wa\.me\/\d+)/g;
  const fill=(node,text)=>{
    let at=0;
    for(const match of text.matchAll(LINK)){
      const start=match.index+match[1].length;
      node.append(document.createTextNode(text.slice(at,start)));
      const link=el('a','',match[2]);
      link.href=match[2];
      if(match[2].startsWith('https:')){link.target='_blank';link.rel='noopener noreferrer';}
      node.append(link);
      at=start+match[2].length;
    }
    node.append(document.createTextNode(text.slice(at)));
  };
  const show=(role,text)=>{const row=el('p','ssb-msg '+role);fill(row,text);log.append(row);log.scrollTop=log.scrollHeight;return row;};
  const suggestions=el('div','ssb-suggest');
  for(const text of ['Which courses do you have for A Levels?','How long does course access last?','How can I pay?']){
    const chip=el('button','',text);chip.type='button';chip.addEventListener('click',()=>ask(text));suggestions.append(chip);
  }
  const greet=()=>{
    show('bot','Hi! Ask me about courses, fees, teachers or how the website works. বাংলাতেও জিজ্ঞেস করতে পারেন।');
    log.append(suggestions);
    for(const m of history)show(m.role==='user'?'user':'bot',m.content);
    suggestions.hidden=history.length>0;
  };
  greet();

  async function ask(text){
    const question=text.trim();
    if(!question||busy)return;
    busy=true;send.disabled=true;suggestions.hidden=true;input.value='';
    show('user',question);
    history.push({role:'user',content:question});
    const typing=show('bot typing','…');
    typing.setAttribute('aria-label','The assistant is typing');
    try{
      const response=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({messages:history.slice(-6)})});
      const data=await response.json();
      if(data.whatsapp)human.href=whatsapp=data.whatsapp;
      typing.remove();
      if(data.reply){show('bot',data.reply);if(!data.handoff)history.push({role:'assistant',content:data.reply});}
      else{history.pop();show('bot',data.error||'Something went wrong. Please try again.');}
    }catch{
      typing.remove();history.pop();
      show('bot','I could not connect. Check your internet and try again, or message our team on WhatsApp.');
    }
    save();
    busy=false;send.disabled=false;
    if(matchMedia('(hover:hover)').matches)input.focus();
  }

  // On phones the panel fills the visible screen, staying above the on-screen keyboard.
  const fit=()=>{const view=window.visualViewport;if(view)panel.style.setProperty('--ssb-height',view.height+'px');log.scrollTop=log.scrollHeight;};
  const open=state=>{
    panel.hidden=!state;bubble.hidden=state;bubble.setAttribute('aria-expanded',String(state));
    document.documentElement.classList.toggle('ssb-open',state);
    if(state){fit();if(matchMedia('(hover:hover)').matches)input.focus();else close.focus();}else bubble.focus();
  };
  bubble.addEventListener('click',()=>open(true));
  close.addEventListener('click',()=>open(false));
  panel.addEventListener('keydown',e=>{if(e.key==='Escape')open(false);});
  window.visualViewport?.addEventListener('resize',fit);
  form.addEventListener('submit',e=>{e.preventDefault();ask(input.value);});
})();
