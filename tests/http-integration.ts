import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { Credentials } from '../lib/types';
const base=process.env.TEST_URL||'http://localhost:4001';
async function call(event:string,data:unknown={},credentials?:Credentials){
  const res=await fetch(base+'/api/classroom',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({event,data,credentials})});
  if(res.headers.get('content-type')?.includes('application/pdf'))return {ok:true,bytes:Buffer.from(await res.arrayBuffer())};
  return res.json();
}
async function main(){
const config=await (await fetch(base+'/api/classroom')).json();assert.equal(config.ok,true);
const publicDb=createClient(config.url,config.key,{auth:{persistSession:false}});
const blocked=await publicDb.from('ensemble_sessions').select('code');assert.ok(blocked.error,'Public users must not read classroom records');
const created=await call('create',{className:'Integration QA '+Date.now()});assert.equal(created.ok,true,created.error);
const teacher=created.data as Credentials;
try{
  const joined=await Promise.all(Array.from({length:8},(_,i)=>call('join',{code:teacher.code,studentName:`QA Student ${i}`})));
  for(const result of joined)assert.equal(result.ok,true,result.error);
  const students=joined.map(j=>j.data as Credentials);
  assert.equal((await call('start',{},students[0])).ok,false);
  assert.equal((await call('start',{},teacher)).ok,true);
  const channel=publicDb.channel(`ensemble:${teacher.code}`);
  let notified=false;
  channel.on('broadcast',{event:'changed'},()=>{notified=true;});
  await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Realtime subscribe timed out')),15000);channel.subscribe(s=>{if(s==='SUBSCRIBED'){clearTimeout(timeout);resolve();}});});
  const submitted=await Promise.all(students.map((c,i)=>call('submit',{answer:`**Response ${i}**: $x=${i}$`,images:[]},c)));
  for(const result of submitted)assert.equal(result.ok,true,result.error);
  assert.equal((await call('state',{},teacher)).state.round.responseCount,8);
  assert.equal((await call('close',{},teacher)).ok,true);
  assert.equal((await call('submit',{answer:'late',images:[]},students[0])).ok,false);
  const selected=await call('select',{},teacher);assert.equal(selected.state.round.selectedStudentName,null);
  const revealed=await call('reveal',{},teacher);assert.match(revealed.state.round.selectedStudentName,/QA Student/);
  assert.equal((await call('reveal',{},students[0])).ok,false);
  assert.equal((await call('award',{points:1},teacher)).ok,true);
  assert.equal((await call('award',{points:1},teacher)).ok,false);
  assert.equal((await call('start',{},teacher)).ok,true);
  assert.equal((await call('resume',students[0])).state.totalRounds,2);
  const report=await call('report',{},teacher);assert.equal(report.ok,true,report.error);assert.equal(report.bytes.subarray(0,4).toString(),'%PDF');
  assert.ok(notified,'Supabase Realtime must deliver change notifications');
  assert.equal((await call('end',{},students[0])).ok,false);
  console.log('PASS: concurrent joins/submissions, access restrictions, Realtime, reveal, scoring, reconnect, and PDF export.');
}finally{
  await publicDb.removeAllChannels();
  publicDb.realtime.disconnect();
  const ended=await call('end',{},teacher);assert.equal(ended.ok,true,ended.error);
  assert.equal((await call('state',{},teacher)).ok,false);
  console.log('PASS: test classroom deleted.');
}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
