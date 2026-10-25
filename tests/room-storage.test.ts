import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClassroomStore } from '../lib/rooms';
import { serializeRoom, restoreRoom } from '../lib/room-storage';

test('persisted rooms restore all rounds, capabilities, scores and reveal state',()=>{
  const store=new ClassroomStore();const teacher=store.create('Algebra','t');
  const student=store.join(teacher.code,'Taylor','s');store.start(teacher);store.submit(student,'**x** = $2$');store.close(teacher);store.select(teacher);
  const disk=JSON.parse(JSON.stringify(serializeRoom(store.room(teacher.code),{[student.token]:Date.now()})));
  const restored=restoreRoom(disk).store;
  assert.equal(restored.snapshot(teacher).round?.selectedStudentName,null);
  assert.equal(restored.snapshot(teacher).connectedCount,1);
  restored.reveal(teacher);restored.award(teacher,1);restored.start(teacher);
  const again=restoreRoom(JSON.parse(JSON.stringify(serializeRoom(restored.room(teacher.code),{})))).store;
  assert.equal(again.snapshot(student).ownPoints,1);
  assert.equal(again.snapshot(teacher).connectedCount,0);
  assert.equal(again.room(teacher.code).rounds[0].answers.size,1);
  assert.equal(again.snapshot(student).students.length,0);
  assert.throws(()=>again.snapshot({...teacher,token:'0'.repeat(64)}));
});
