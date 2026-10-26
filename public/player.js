// Lesson player: plays the HLS stream served (and access-checked) by this site, with the student's watermark on top.
(()=>{
  'use strict';
  const video=document.getElementById('lesson-video');
  if(!video)return;
  const src=video.dataset.src,error=document.querySelector('.lesson-player-error'),frame=video.closest('.lesson-player');
  const fail=text=>{if(error){error.textContent=text;error.hidden=false;}};
  const explain=status=>status===401?'You have been signed out, possibly because your account was used on another device. Log in again to keep watching.':status===403?'This lesson is for enrolled students.':'The video could not be loaded. Check your connection and refresh the page.';
  video.addEventListener('contextmenu',e=>e.preventDefault());

  // Watermark: sits in the top-right corner. If it is removed or hidden, the video pauses and it comes back.
  const text=frame&&frame.dataset.mark;
  if(text){
    video.disablePictureInPicture=true; // the floating mini-player would also drop the watermark
    let mark;
    const attach=()=>{mark=document.createElement('div');mark.className='lesson-watermark';mark.setAttribute('aria-hidden','true');mark.textContent=text;frame.appendChild(mark);};
    const intact=()=>{
      if(!mark.isConnected||mark.parentNode!==frame||mark.textContent!==text)return false;
      const style=getComputedStyle(mark);
      return style.display!=='none'&&style.visibility==='visible'&&Number(style.opacity)>=.15&&mark.offsetWidth>0;
    };
    attach();
    setInterval(()=>{if(!intact()){video.pause();mark.remove();attach();}},1000);
    // The browser's own full-screen button would show the video without the watermark, so the player has its own
    // that takes the whole frame full screen. It must be called straight from the click, or browsers refuse it.
    const enter=frame.requestFullscreen||frame.webkitRequestFullscreen;
    if(enter){
      video.setAttribute('controlslist','nodownload nofullscreen');
      const current=()=>document.fullscreenElement||document.webkitFullscreenElement;
      const button=document.createElement('button');
      button.type='button';button.className='lesson-fullscreen';
      const label=()=>{const on=current()===frame;button.setAttribute('aria-label',on?'Exit full screen':'Full screen');button.title=on?'Exit full screen (F)':'Full screen (F)';button.classList.toggle('on',on);};
      const toggle=()=>{if(current())(document.exitFullscreen||document.webkitExitFullscreen).call(document);else enter.call(frame);};
      button.addEventListener('click',toggle);
      video.addEventListener('dblclick',e=>{e.preventDefault();toggle();});
      frame.addEventListener('keydown',e=>{if(e.key==='f'||e.key==='F'){e.preventDefault();toggle();}});
      document.addEventListener('fullscreenchange',label);
      document.addEventListener('webkitfullscreenchange',label);
      label();frame.appendChild(button);
    }
  }

  if(window.Hls&&window.Hls.isSupported()){
    const hls=new window.Hls({maxBufferLength:30});
    hls.on(window.Hls.Events.ERROR,(_,data)=>{
      if(!data.fatal)return;
      if(data.type===window.Hls.ErrorTypes.NETWORK_ERROR&&!data.response?.code){hls.startLoad();return;}
      fail(explain(data.response?.code));hls.destroy();
    });
    hls.loadSource(src);hls.attachMedia(video);
  }else if(video.canPlayType('application/vnd.apple.mpegurl')){
    video.src=src;
    video.addEventListener('error',()=>fetch(src,{method:'HEAD'}).then(r=>fail(explain(r.status))).catch(()=>fail(explain(0))));
  }else fail('This browser cannot play the lesson video. Try a recent version of Chrome, Safari, Edge or Firefox.');
})();
