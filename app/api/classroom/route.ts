import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { database, readRoom, mutateRoom, notifyRoom } from '@/lib/supabase-server';
import { ClassroomStore } from '@/lib/rooms';
import { restoreRoom, serializeRoom } from '@/lib/room-storage';
import { submissionSchema } from '@/lib/content';
import { normalizeImages } from '@/lib/images';
import { analyze } from '@/lib/ai';
import { makeReport } from '@/lib/report';
import type { Credentials } from '@/lib/types';

export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const name=z.string().trim().min(1,'Please enter a name.').max(60).regex(/^[^\u0000-\u001f\u007f]+$/);
const credentials=z.object({code:z.string().regex(/^\d{6}$/),token:z.string().regex(/^[a-f0-9]{64}$/),role:z.enum(['teacher','student'])});
const aiAvailable=()=>Boolean(process.env.OPENAI_API_KEY);
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const ready=()=>Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY&&process.env.SUPABASE_PUBLISHABLE_KEY);

export async function GET(){
  if(!ready())return NextResponse.json({ok:false,error:'Online classroom setup is not complete yet.'},{status:503,headers});
  return NextResponse.json({ok:true,url:process.env.SUPABASE_URL,key:process.env.SUPABASE_PUBLISHABLE_KEY},{headers});
}
async function limit(key:string,count:number,seconds:number){
  const {data,error}=await database().rpc('ensemble_rate_limit',{p_key:hash(key),p_limit:count,p_seconds:seconds});
  if(error)throw new Error('Classroom database setup is incomplete or unavailable.');
  if(!data)throw new Error('Too many requests. Please wait a moment.');
}
async function snapshot(c:Credentials){const {state}=await readRoom(c.code);return restoreRoom(state).store.snapshot(c,aiAvailable());}
function fingerprint(room:ReturnType<ClassroomStore['room']>,round:ReturnType<ClassroomStore['current']>){
  return hash(JSON.stringify({students:[...room.students].map(([t,s])=>[t,s.name]),answers:[...round.answers]}));
}

export async function POST(req:NextRequest){
  try{
    if(!ready())throw new Error('Online classroom setup is not complete yet.');
    if(req.headers.get('origin')&&req.headers.get('origin')!==req.nextUrl.origin)throw new Error('This request must come from the classroom website.');
    const raw=await req.text();if(Buffer.byteLength(raw)>1500000)throw new Error('Your answer is too large. Use smaller pictures.');
    const input=z.object({event:z.enum(['create','join','resume','state','heartbeat','start','close','select','reveal','submit','award','rename','remove','analyze','report','leave','end']),data:z.unknown().optional(),credentials:credentials.nullable().optional()}).parse(JSON.parse(raw));
    const event=input.event;let c=input.credentials;const data=input.data??{};
    const ip=req.headers.get('x-vercel-forwarded-for')?.split(',')[0]||req.headers.get('x-forwarded-for')?.split(',')[0]||'local';
    if(event==='create'||event==='join')await limit(`${event}:${ip}`,event==='create'?10:150,60);
    else if(c)await limit(`session:${c.token}`,180,60);
    if(event==='create'){
      const {className}=z.object({className:name}).parse(data);
      for(let i=0;i<10;i++){
        const store=new ClassroomStore();const created=store.create(className,'online');
        const {error}=await database().from('ensemble_sessions').insert({code:created.code,state:serializeRoom(store.room(created.code),{[created.token]:Date.now()})});
        if(error?.code==='23505')continue;
        if(error)throw new Error('Could not create a classroom. Please try again.');
        return NextResponse.json({ok:true,data:created,state:store.snapshot(created,aiAvailable())},{headers});
      }
      throw new Error('Could not allocate a class code. Please try again.');
    }
    if(event==='join'){
      const {code,studentName}=z.object({code:z.string().regex(/^\d{6}$/),studentName:name}).parse(data);
      c=await mutateRoom(code,(store,_room,presence)=>{const joined=store.join(code,studentName,'online');presence[joined.token]=Date.now();return joined;});
      await notifyRoom(code);return NextResponse.json({ok:true,data:c,state:await snapshot(c)},{headers});
    }
    if(event==='resume')c=credentials.parse(data);
    if(!c)throw new Error('Join or create a classroom first.');
    const session=c;
    // Every endpoint validates the bearer capability before accessing classroom data.
    const record=await readRoom(session.code);const initial=restoreRoom(record.state);
    initial.store.snapshot(session);
    if(event==='state')return NextResponse.json({ok:true,state:initial.store.snapshot(session,aiAvailable())},{headers});
    if(event==='report'){
      const bytes=await makeReport(initial.store.teacher(session));
      if(bytes.length>4300000)throw new Error('This PDF exceeds the hosting download limit. Remove large pictures before exporting.');
      return new Response(new Uint8Array(bytes),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="ensemble++-${session.code}.pdf"`}});
    }
    if(event==='end'){
      initial.store.teacher(session);
      const {error}=await database().from('ensemble_sessions').delete().eq('code',session.code).eq('state->>teacherToken',session.token);
      if(error)throw new Error('Could not end the session. Please try again.');
      await notifyRoom(session.code);return NextResponse.json({ok:true,ended:'This session has ended. Classroom records have been deleted.'},{headers});
    }
    if(event==='analyze'){
      const {question}=z.object({question:z.string().trim().max(1000).default('')}).parse(data);
      const room=initial.store.teacher(session);const round=initial.store.current(room);
      if(round.status!=='closed')throw new Error('Close submissions before requesting analysis.');
      if(!round.answers.size)throw new Error('There are no responses to analyze yet.');
      await limit(`analysis:${session.token}`,2,60);
      const revision=fingerprint(room,round);
      const names=[...room.students.values()].map(s=>s.name);
      const redact=(text:string)=>names.reduce((value,n)=>value.replaceAll(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'[student]'),text);
      const answers=[...round.answers.values()];
      const result=await analyze(answers.map(a=>redact(a.body+'\n'+a.images.map(i=>i.caption).join('\n'))),redact(question),answers.map(a=>a.images.map(i=>i.data)));
      await mutateRoom(session.code,(store,current)=>{
        store.teacher(session);const target=current.rounds.find(q=>q.id===round.id);
        if(!target||fingerprint(current,target)!==revision)throw new Error('Responses changed during analysis. Please try again.');
        target.analysis=result;
      });
    }else if(event==='submit'){
      const answer=submissionSchema.parse(data);const roundId=initial.store.current(initial.room).id;
      const images=await normalizeImages(answer.images);
      await mutateRoom(session.code,(store,room,presence)=>{
        if(store.current(room).id!==roundId)throw new Error('The question changed while uploading. Submit again.');
        store.submit(session,answer.answer,images);presence[session.token]=Date.now();
      });
    }else{
      await mutateRoom(session.code,(store,room,presence)=>{
        store.snapshot(session);
        switch(event){
          case 'resume': case 'heartbeat': presence[session.token]=Date.now();break;
          case 'leave':delete presence[session.token];break;
          case 'start':case 'close':case 'select':case 'reveal':store[event](session);break;
          case 'award':store.award(session,z.object({points:z.union([z.literal(0),z.literal(1)])}).parse(data).points);break;
          case 'rename':{const {id,studentName}=z.object({id:z.string().uuid(),studentName:name}).parse(data);store.rename(session,id,studentName);break;}
          case 'remove':{const {id}=z.object({id:z.string().uuid()}).parse(data);const pupil=[...room.students.values()].find(s=>s.id===id);store.remove(session,id);if(pupil)delete presence[pupil.token];break;}
        }
      });
    }
    if(event!=='heartbeat')await notifyRoom(session.code);
    return NextResponse.json({ok:true,data:event==='resume'?session:undefined,state:event==='leave'?undefined:await snapshot(session),left:event==='leave'},{headers});
  }catch(error){
    const message=error instanceof z.ZodError?error.issues[0].message:error instanceof Error?error.message:'Please try again.';
    const ended=/no longer available|entry was removed|Your entry was removed/.test(message);
    return NextResponse.json({ok:false,error:message,ended:ended?message:undefined},{status:400,headers});
  }
}
