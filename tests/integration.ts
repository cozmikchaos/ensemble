import assert from 'node:assert/strict';
import { io, type Socket } from 'socket.io-client';
import { writeFile, mkdir } from 'node:fs/promises';
import type { Credentials, Reply, Snapshot } from '../lib/types';
const url=process.env.TEST_URL||'http://localhost:3000';
async function connect(){const s=io(url,{forceNew:true,transports:['websocket']});await new Promise<void>((res,rej)=>{s.once('connect',res);s.once('connect_error',rej);});return s;}
async function send<T=undefined>(s:Socket,event:string,data:unknown={}):Promise<T>{return new Promise((res,rej)=>s.timeout(5000).emit(event,data,(e:Error|null,r:Reply<T>)=>e?rej(e):r.ok?res(r.data):rej(new Error(r.error))));}
async function main(){const teacher=await connect();let student=await connect();const stranger=await connect();let ts:Snapshot|undefined;let ss:Snapshot|undefined;teacher.on('state',(s:Snapshot)=>ts=s);student.on('state',(s:Snapshot)=>ss=s);try{
 const t=await send<Credentials>(teacher,'create',{className:'Integration Test Biology'});const s=await send<Credentials>(student,'join',{code:t.code,studentName:'Sample Student'});
 await assert.rejects(send(stranger,'join',{code:t.code,studentName:'Sample Student'}),/already/);
 await send(teacher,'start');await send(student,'submit',{answer:'Plants use sunlight to make food.'});await send(student,'submit',{answer:'Plants convert sunlight into chemical energy.'});
 await send(teacher,'close');await assert.rejects(send(student,'submit',{answer:'too late'}),/closed/);await assert.rejects(send(student,'select'),/Only/);
 await send(teacher,'select');assert.equal(ts?.round?.selectedStudentName,null);await assert.rejects(send(student,'reveal'),/Only/);await send(teacher,'reveal');assert.equal(ts?.round?.selectedStudentName,'Sample Student');await send(teacher,'award',{points:1});await assert.rejects(send(teacher,'award',{points:1}),/already/);
 assert.equal(ts?.round?.answers.length,1);assert.equal(ts?.students[0].points,1);assert.ok(!('studentId' in ts!.round!.answers[0]));
 student.disconnect();student=await connect();student.on('state',(s:Snapshot)=>ss=s);await send(student,'resume',s);assert.equal(ss?.ownPoints,1);assert.deepEqual(ss?.students,[]);assert.deepEqual(ss?.round?.answers,[]);
 const report=await send<{pdf:string;filename:string}>(teacher,'report');const bytes=Buffer.from(report.pdf,'base64');assert.equal(bytes.subarray(0,4).toString(),'%PDF');await mkdir('tmp/pdfs',{recursive:true});await writeFile('tmp/pdfs/integration-report.pdf',bytes);
 await send(teacher,'start');assert.equal(ts?.totalRounds,2);await send(teacher,'end');await assert.rejects(send(student,'resume',s),/no longer available/);console.log('PASS: real Socket.IO create/join/edit/lock/select/score/reconnect/export/next/end, permissions, anonymous payloads.');
 }finally{teacher.disconnect();student.disconnect();stranger.disconnect();}}
main().catch(error=>{console.error(error);process.exitCode=1;});
