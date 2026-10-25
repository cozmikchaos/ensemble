import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument, PDFName } from 'pdf-lib';
import { ClassroomStore } from '../lib/rooms';
import { normalizeImages } from '../lib/images';
import { makeReport } from '../lib/report';
import { submissionSchema } from '../lib/content';
test('image validation rejects unsafe or corrupt pictures',async()=>{
 assert.equal(submissionSchema.safeParse({answer:'',images:[]}).success,false);
 assert.equal(submissionSchema.safeParse({answer:'x',images:[{data:'data:image/svg+xml;base64,abcd',caption:''}]}).success,false);
 await assert.rejects(normalizeImages([{data:'data:image/png;base64,YWJjZA==',caption:''}]),/could not be read/);
});
test('formatted responses, equations, and pictures export for every round',async()=>{
 const store=new ClassroomStore();const teacher=store.create('Algebra - Report verification','t');const ada=store.join(teacher.code,'Ada Sample','a');const ben=store.join(teacher.code,'Ben Sample','b');
 const png=await sharp(Buffer.from('<svg width="320" height="180" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="180" fill="#eef5ff"/><path d="M30 150 L290 150 M30 150 L30 20" stroke="#182030" stroke-width="3"/><path d="M30 145 Q130 140 270 25" fill="none" stroke="#0071e3" stroke-width="5"/></svg>')).png().toBuffer();
 const images=await normalizeImages([{data:`data:image/png;base64,${png.toString('base64')}`,caption:'Graph of the response'}]);
 store.start(teacher);store.submit(ada,'**My method**\n\n- Square both terms.\n- Use the *positive* solution.\n\n$$\nx = \\frac{-b + \\sqrt{b^2-4ac}}{2a}\n$$',images);store.close(teacher);store.select(teacher);assert.equal(store.snapshot(teacher).round?.selectedStudentName,null);store.reveal(teacher);store.award(teacher,1);store.start(teacher);store.submit(ada,'Second round: $x^2 + y^2 = z^2$.');store.submit(ben,'',images);store.close(teacher);
 const pdf=await makeReport(store.teacher(teacher));const doc=await PDFDocument.load(pdf);assert.ok(doc.getPageCount()>=3);assert.ok(doc.getPages().some(page=>page.node.Resources()?.lookup(PDFName.of('XObject'))));
 await mkdir('tmp/pdfs',{recursive:true});await writeFile('tmp/pdfs/rich-report.pdf',pdf);
 assert.equal(store.snapshot(ben).ownImages.length,1);assert.equal(store.snapshot(ben).ownAnswer,'');assert.equal(store.snapshot(teacher).totalResponses,3);
});
