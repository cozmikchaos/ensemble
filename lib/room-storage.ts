import { ClassroomStore, type Room } from './rooms';

export type StoredRoom = Omit<Room, 'teacherSockets'|'students'|'rounds'> & {
  teacherSockets: string[];
  students: Array<[string, Omit<Room['students'] extends Map<string,infer S> ? S : never, 'sockets'> & {sockets:string[]}]>;
  rounds: Array<Omit<Room['rounds'][number], 'answers'> & {answers:Array<[string, Room['rounds'][number]['answers'] extends Map<string,infer A> ? A : never]>}>;
  presence: Record<string, number>;
};

export function serializeRoom(room:Room, presence:Record<string,number>):StoredRoom {
  return {...room, teacherSockets:[], students:[...room.students].map(([key,s])=>[key,{...s,sockets:[]}]),
    rounds:room.rounds.map(q=>({...q,answers:[...q.answers]})),presence};
}

export function restoreRoom(data:StoredRoom, now=Date.now()) {
  const room:Room={...data,teacherSockets:new Set(), students:new Map(data.students.map(([key,s])=>[key,{...s,sockets:new Set((data.presence[key]||0)>now-75000?['online']:[])}])), rounds:data.rounds.map(q=>({...q,answers:new Map(q.answers)}))};
  const store=new ClassroomStore(); store.rooms.set(room.code,room); return {room,store};
}
