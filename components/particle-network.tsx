'use client';

import { useEffect, useRef } from 'react';

export function ParticleNetwork() {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const ctx=canvas.getContext('2d');
    if(!ctx)return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    let width=0,height=0,frame=0,visible=true,time=0,last=0;
    // Stable points avoid a visual jump when React mounts or the card resizes.
    let seed=72;
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const points=Array.from({length:100},()=>({x:random(),spread:(random()+random()+random()-1.5)*.34,phase:random()*Math.PI*2,speed:.35+random()*.5,radius:.7+random()*1.2}));
    function draw(){
      if(!ctx||!width||!height)return;
      ctx.clearRect(0,0,width,height);
      const positions=points.map(p=>{
        const x=(p.x+.025*Math.sin(time*.3*p.speed+p.phase))*width;
        const y=(.72-p.x*.45+p.spread+.055*Math.sin(time*p.speed+p.phase))*height;
        return {x,y,p};
      });
      const reach=Math.min(115,width*.24);
      for(let i=0;i<positions.length;i++){
        const a=positions[i];
        for(let j=i+1;j<positions.length;j++){
          const b=positions[j],distance=Math.hypot(a.x-b.x,a.y-b.y);
          if(distance>reach)continue;
          const hue=218-((a.p.x+b.p.x)/2)*53;
          ctx.strokeStyle=`hsla(${hue},85%,70%,${(1-distance/reach)*.42})`;
          ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
        }
      }
      for(const {x,y,p} of positions){
        ctx.fillStyle=`hsl(${218-p.x*53},90%,${78+12*Math.sin(time*.5+p.phase)**2}%)`;
        ctx.shadowBlur=7;ctx.shadowColor=`hsl(${218-p.x*53},90%,65%)`;
        ctx.beginPath();ctx.arc(x,y,p.radius,0,Math.PI*2);ctx.fill();
      }
      ctx.shadowBlur=0;
    }
    function tick(now:number){
      if(last)time+=Math.min((now-last)/1000,.05);
      last=now;draw();frame=requestAnimationFrame(tick);
    }
    function sync(){cancelAnimationFrame(frame);last=0;draw();if(visible&&!document.hidden&&!reduced.matches)frame=requestAnimationFrame(tick);}
    const resize=new ResizeObserver(()=>{
      const bounds=canvas.getBoundingClientRect();width=bounds.width;height=bounds.height;
      const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);draw();
    });
    const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});
    resize.observe(canvas);intersection.observe(canvas);
    document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);sync();
    return()=>{cancelAnimationFrame(frame);resize.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync);};
  },[]);
  return <div aria-hidden="true" className="relative mt-10 h-64 w-full max-w-xl overflow-hidden rounded-3xl border border-blue-950/10 bg-[#060e1b] shadow-[0_20px_55px_-25px_#0071e350] sm:h-72">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_75%,#163e6d65,transparent_60%),radial-gradient(ellipse_at_85%_25%,#075e4b55,transparent_55%)]"/>
    <canvas ref={canvasRef} className="absolute inset-0 h-full w-full"/>
  </div>;
}
