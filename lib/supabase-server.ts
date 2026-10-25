import 'server-only';
import { createAdminClient } from '@supabase/server/core';
import { randomUUID } from 'node:crypto';
import { serializeRoom, restoreRoom, type StoredRoom } from './room-storage';
import type { ClassroomStore, Room } from './rooms';

export function database(){return createAdminClient();}
export async function readRoom(code:string) {
  const {data,error}=await database().from('ensemble_sessions').select('version,state').eq('code',code).maybeSingle();
  if(error)throw new Error('Classroom storage is unavailable. Please try again.');
  if(!data)throw new Error('This class is no longer available. Check the code with your teacher.');
  return {version:data.version as number, state:data.state as StoredRoom};
}
export async function mutateRoom<T>(code:string, action:(store:ClassroomStore,room:Room,presence:Record<string,number>)=>T) {
  for(let attempt=0;attempt<12;attempt++){
    const record=await readRoom(code);const {room,store}=restoreRoom(record.state);
    const presence={...record.state.presence};const result=action(store,room,presence);
    const state=serializeRoom(room,presence);
    if(Buffer.byteLength(JSON.stringify(state))>3000000)throw new Error('This session has reached its storage limit. Export the report and start another session, or remove pictures from your answer.');
    const {data,error}=await database().from('ensemble_sessions').update({state,version:record.version+1,updated_at:new Date().toISOString()}).eq('code',code).eq('version',record.version).select('code');
    if(error)throw new Error('Unable to save your change. Please try again.');
    if(data?.length)return result;
    await new Promise(r=>setTimeout(r,15+Math.random()*60));
  }
  throw new Error('Several responses arrived together. Please submit again.');
}
export async function notifyRoom(code:string){
  // Broadcast only an invalidation signal, never names, answers, or credentials.
  const db=database();const channel=db.channel(`ensemble:${code}`);
  try{await channel.send({type:'broadcast',event:'changed',payload:{id:randomUUID()}});}catch{/* Polling recovers missed signals. */}
  finally{await db.removeChannel(channel);}
}
