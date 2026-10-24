// Lesson player: plays the HLS stream served (and access-checked) by this site.
(()=>{
  'use strict';
  const video=document.getElementById('lesson-video');
  if(!video)return;
  const src=video.dataset.src,error=document.querySelector('.lesson-player-error');
  const fail=text=>{if(error){error.textContent=text;error.hidden=false;}};
  const explain=status=>status===401?'Your session has ended. Log in again to keep watching.':status===403?'This lesson is for enrolled students.':'The video could not be loaded. Check your connection and refresh the page.';
  video.addEventListener('contextmenu',e=>e.preventDefault());
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
