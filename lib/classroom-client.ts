'use client';
import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Credentials, Reply, Snapshot } from './types';

type Events={connect:()=>void;disconnect:()=>void;connect_error:()=>void;state:(value:Snapshot)=>void;ended:(message:string)=>void};
/** HTTP commands with Supabase invalidation signals and a missed-message fallback. */
export class ClassroomClient {
  connected=false;
  private handlers:Partial<Events>={};
  private credentials:Credentials|null=null;
  private db:SupabaseClient|null=null;
  private channel:RealtimeChannel|null=null;
  private timer:ReturnType<typeof setInterval>|undefined;
  private retry:ReturnType<typeof setTimeout>|undefined;
  private stopped=false;
  private refreshing=false;
  private active=0;
  private generation=0;
  private heartbeat=0;
  on<K extends keyof Events>(event:K,fn:Events[K]){this.handlers[event]=fn;return this;}
  timeout(_ms:number){return this;}
  async connect(){
    try{
      const response=await fetch('/api/classroom',{cache:'no-store',signal:AbortSignal.timeout(10000)});const config=await response.json();
      if(!config.ok)throw new Error(config.error);
      if(this.stopped)return;
      this.db=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      this.connected=true;this.handlers.connect?.();
      this.timer=setInterval(()=>void this.refresh(),5000);
    }catch{
      if(this.stopped)return;this.connected=false;this.handlers.connect_error?.();this.retry=setTimeout(()=>void this.connect(),5000);
    }
  }
  private watch(){
    if(this.channel)void this.db?.removeChannel(this.channel);
    if(!this.credentials)return;
    this.channel=this.db!.channel(`ensemble:${this.credentials.code}`).on('broadcast',{event:'changed'},()=>void this.refresh()).subscribe(status=>{if(status==='SUBSCRIBED')void this.refresh();});
  }
  private end(message:string){this.credentials=null;this.generation++;if(this.channel)void this.db?.removeChannel(this.channel);this.channel=null;this.handlers.ended?.(message);}
  private async call(event:string,data:unknown){
    const response=await fetch('/api/classroom',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,data,credentials:this.credentials}),signal:AbortSignal.timeout(60000)});
    if(response.headers.get('content-type')?.includes('application/pdf')){
      const blob=await response.blob();const pdf=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
      return {ok:true,data:{pdf,filename:`ensemble++-${this.credentials?.code}.pdf`}};
    }
    return response.json();
  }
  private async refresh(){
    if(this.stopped||!this.credentials||this.refreshing||this.active)return;
    this.refreshing=true;const generation=this.generation;
    try{
      const heartbeat=Date.now()-this.heartbeat>30000;
      const result=await this.call(heartbeat?'heartbeat':'state',{});
      if(this.stopped||generation!==this.generation)return;
      if(result.ended){this.end(result.ended);return;}
      if(result.ok){if(heartbeat)this.heartbeat=Date.now();if(result.state)this.handlers.state?.(result.state);}
    }catch{/* A transient request failure does not delete the session capability. */}
    finally{this.refreshing=false;}
  }
  emit<T>(event:string,data:unknown,ack:(error:Error|null,result:Reply<T>)=>void){
    this.active++;this.generation++;
    if(event==='resume')this.credentials=data as Credentials;
    void this.call(event,data).then(result=>{
      if(this.stopped)return;
      if(result.ok&&['create','join','resume'].includes(event)){this.credentials=result.data;this.watch();}
      if(result.state)this.handlers.state?.(result.state);
      if(result.ended)this.end(result.ended);
      if(result.left){this.credentials=null;this.generation++;if(this.channel)void this.db?.removeChannel(this.channel);this.channel=null;}
      if(!result.ok&&event==='resume')this.credentials=null;
      ack(null,result);
    }).catch(error=>ack(error,{ok:false,error:'Connection interrupted. Please try again.'})).finally(()=>{this.active--;void this.refresh();});
    return this;
  }
  disconnect(){this.stopped=true;this.connected=false;clearInterval(this.timer);clearTimeout(this.retry);void this.db?.removeAllChannels();}
}
