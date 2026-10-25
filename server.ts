import { loadEnvConfig } from '@next/env';
import next from 'next';
import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { ClassroomStore } from './lib/rooms';
import { submissionSchema } from './lib/content';
import { normalizeImages } from './lib/images';
import { originAllowed } from './lib/origins';
import { analyze } from './lib/ai';
import { makeReport } from './lib/report';
import type { Credentials } from './lib/types';
loadEnvConfig(process.cwd());
const dev=process.env.NODE_ENV!=='production';
const port=Number(process.env.PORT||3000);const hostname=process.env.BIND_HOST||'0.0.0.0';
const app=next({dev,hostname,port});const handle=app.getRequestHandler();
const store=new ClassroomStore();
const name=z.string().trim().min(1,'Please enter a name.').max(60,'Use 60 characters or fewer.').regex(/^[^\u0000-\u001f\u007f]+$/,'Names cannot contain control characters.');
const credential=z.object({code:z.string().regex(/^\d{6}$/),token:z.string().regex(/^[a-f0-9]{64}$/),role:z.enum(['teacher','student'])});
app.prepare().then(()=>{
 const http=createServer((req,res)=>{if(req.url==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({status:'ok'}));return;}return handle(req,res);});
 const allowedOrigins=(process.env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
 const io=new Server(http,{
  maxHttpBufferSize:1500000,
  cors:{origin:allowedOrigins,methods:['GET','POST']},
  allowRequest:(req,done)=>done(null,originAllowed(req.headers.origin,req.headers.host,allowedOrigins)),
 });
 const aiAvailable=Boolean(process.env.OPENAI_API_KEY);
 function broadcast(code:string){for(const socket of io.sockets.sockets.values()){const c=socket.data.credentials as Credentials|undefined;if(c?.code===code){try{socket.emit('state',store.snapshot(c,aiAvailable));}catch{socket.emit('ended','Your entry was removed or this classroom has ended.');socket.data.credentials=undefined;}}}}
 function bind(socket:Socket,c:Credentials){const old=socket.data.credentials as Credentials|undefined;if(old)store.disconnect(old,socket.id);socket.data.credentials=c;socket.join(c.code);if(old&&old.code!==c.code)broadcast(old.code);broadcast(c.code);}
 io.on('connection',socket=>{
  let events:number[]=[];
  function event(eventName:string,fn:(data:unknown)=>unknown|Promise<unknown>){socket.on(eventName,async(data,ack)=>{if(typeof ack!=='function')return;events=events.filter(t=>Date.now()-t<10000);if(events.length>=35)return ack({ok:false,error:'Too many requests. Please wait a few seconds.'});events.push(Date.now());try{const result=await fn(data);ack({ok:true,data:result});}catch(error){ack({ok:false,error:error instanceof z.ZodError?error.issues[0].message:error instanceof Error?error.message:'Something went wrong. Try again.'});}});}
  const credentials=()=>{const c=socket.data.credentials as Credentials|undefined;if(!c)throw new Error('Join or create a classroom first.');return c;};
  event('create',data=>{if(socket.data.credentials)throw new Error('Leave your current session first.');const {className}=z.object({className:name}).parse(data);const c=store.create(className,socket.id);bind(socket,c);return c;});
  event('join',data=>{if(socket.data.credentials)throw new Error('Leave your current session first.');const {code,studentName}=z.object({code:z.string().regex(/^\d{6}$/,'Enter the six-digit class code.'),studentName:name}).parse(data);const c=store.join(code,studentName,socket.id);bind(socket,c);return c;});
  event('resume',data=>{const c=credential.parse(data);store.resume(c,socket.id);bind(socket,c);return c;});
  for(const action of ['start','close','select','reveal'] as const)event(action,()=>{const c=credentials();store[action](c);broadcast(c.code);});
  event('submit',async data=>{const {answer,images}=submissionSchema.parse(data);const c=credentials();const target=store.current(store.room(c.code));if(target.status!=='open')throw new Error('Submissions are closed.');const targetId=target.id;const normalized=await normalizeImages(images);if(store.current(store.room(c.code)).id!==targetId)throw new Error('The question changed while your picture was uploading. Please submit again.');store.submit(c,answer,normalized);broadcast(c.code);});
  event('award',data=>{const {points}=z.object({points:z.union([z.literal(0),z.literal(1)])}).parse(data);const c=credentials();store.award(c,points);broadcast(c.code);});
  event('rename',data=>{const {id,studentName}=z.object({id:z.string().uuid(),studentName:name}).parse(data);const c=credentials();store.rename(c,id,studentName);broadcast(c.code);});
  event('remove',data=>{const {id}=z.object({id:z.string().uuid()}).parse(data);const c=credentials();const sockets=store.remove(c,id);for(const id of sockets){const other=io.sockets.sockets.get(id);other?.emit('ended','Your teacher removed your entry.');if(other)other.data.credentials=undefined;}broadcast(c.code);});
  event('analyze',async data=>{const {question}=z.object({question:z.string().trim().max(1000).default('')}).parse(data);const c=credentials();const room=store.teacher(c);const round=store.current(room);if(round.status!=='closed')throw new Error('Close submissions before requesting analysis.');if(!round.answers.size)throw new Error('There are no responses to analyze yet.');if(room.analysisBusy)throw new Error('An analysis is already running.');room.analysisBusy=true;const revision=[...round.answers.values()].map(a=>a.id+':'+a.body).join('|');try{const names=[...room.students.values()].map(s=>s.name);const redact=(text:string)=>names.reduce((value,name)=>value.replaceAll(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'[student]'),text);const analysis=await analyze([...round.answers.values()].map(a=>redact(a.body+'\n'+a.images.map(i=>i.caption).join('\n'))),redact(question),[...round.answers.values()].map(a=>a.images.map(i=>i.data)));if(store.rooms.get(c.code)!==room)throw new Error('Session ended during analysis.');if(revision!==[...round.answers.values()].map(a=>a.id+':'+a.body).join('|'))throw new Error('The roster changed during analysis. Please try again.');round.analysis=analysis;broadcast(c.code);}finally{room.analysisBusy=false;}});
  event('report',async()=>{const room=store.teacher(credentials());return {pdf:(await makeReport(room)).toString('base64'),filename:`ensemble++-${room.code}-${new Date().toISOString().slice(0,10)}.pdf`};});
  event('leave',()=>{const c=credentials();store.disconnect(c,socket.id);socket.leave(c.code);socket.data.credentials=undefined;broadcast(c.code);});
  event('end',()=>{const c=credentials();store.teacher(c);store.rooms.delete(c.code);for(const other of io.sockets.sockets.values()){if(other.data.credentials?.code===c.code){other.emit('ended','This session has ended. All classroom data has been permanently deleted.');other.data.credentials=undefined;other.leave(c.code);}}});
  socket.on('disconnect',()=>{const c=socket.data.credentials as Credentials|undefined;if(c){store.disconnect(c,socket.id);broadcast(c.code);}});
 });
 http.listen(port,hostname,()=>console.log(`Ensemble ready on http://localhost:${port} (${dev?'development':'production'}). Session data is temporary.`));
}).catch(error=>{console.error(error);process.exit(1);});
