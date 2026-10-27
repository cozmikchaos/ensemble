import { test } from 'node:test';
import assert from 'node:assert/strict';
import { originAllowed } from '../lib/origins';
test('cross-origin classroom access requires an exact allowed frontend',()=>{
 const origins=['https://ensemble-school.vercel.app'];
 assert.equal(originAllowed('https://ensemble-school.vercel.app','live.onrender.com',origins),true);
 assert.equal(originAllowed('https://evil.vercel.app','live.onrender.com',origins),false);
 assert.equal(originAllowed('https://ensemble-school.vercel.app.evil.test','live.onrender.com',origins),false);
 assert.equal(originAllowed('https://ensemble-school.vercel.app/path','live.onrender.com',origins),false);
 assert.equal(originAllowed('http://localhost:3000','localhost:3000',[]),true);
 assert.equal(originAllowed('http://127.0.0.1:3000','127.0.0.1:3000',[]),true);
 assert.equal(originAllowed('http://127.0.0.1:3001','127.0.0.1:3000',[]),false);
 assert.equal(originAllowed('null','localhost:3000',[]),false);
});
