import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { equationImage } from './equation-image';
import type { Room } from './rooms';
type Node={type:string;value?:string;children?:Node[];ordered?:boolean};
export async function makeReport(source:Room) {
 // Freeze the exported view before asynchronous image/equation rendering.
 const room={...source,students:new Map([...source.students].map(([k,s])=>[k,{...s}])),rounds:source.rounds.map(r=>({...r,answers:new Map([...r.answers].map(([k,a])=>[k,{...a,images:a.images.map(i=>({...i}))}]))}))};
 const doc=await PDFDocument.create();
 const regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),italic=await doc.embedFont(StandardFonts.HelveticaOblique),boldItalic=await doc.embedFont(StandardFonts.HelveticaBoldOblique);
 let page=doc.addPage([595,842]),y=785,x=48;
 const blue=rgb(0,.36,.78),ink=rgb(.12,.15,.2);
 const clean=(s:string)=>s.normalize('NFKD').replace(/[^\x20-\x7E\n]/g,'?');
 const newPage=()=>{page=doc.addPage([595,842]);y=785;x=48;};
 const ensure=(height:number)=>{if(y-height<60)newPage();};
 const flush=(height=17)=>{y-=height;x=48;};
 function write(text:string,size=11,font:PDFFont=regular,color=ink){
  for(const token of clean(text).split(/(\s+)/)){
   if(token.includes('\n')){flush(size+6);continue;}
   const width=font.widthOfTextAtSize(token,size);
   if(x+width>547&&x>48)flush(size+6);
   if(width>499){for(const c of token){const w=font.widthOfTextAtSize(c,size);if(x+w>547)flush(size+6);ensure(size+6);page.drawText(c,{x,y,size,font,color});x+=w;}continue;}
   if(x===48&&!token.trim())continue;ensure(size+6);page.drawText(token,{x,y,size,font,color});x+=width;
  }
 }
 const line=(text:string,size=11,strong=false,color=ink)=>{write(text,size,strong?bold:regular,color);flush(size+7);};
 async function picture(data:Uint8Array|string,equation=false){
  if(x>48)flush();
  const img=typeof data==='string'&&data.startsWith('data:image/jpeg')?await doc.embedJpg(data):await doc.embedPng(data);
  const scale=Math.min(1,499/img.width,(equation?60:260)/img.height);const width=img.width*scale,height=img.height*scale;
  ensure(height+20);page.drawImage(img,{x:48,y:y-height,width,height});y-=height+16;
 }
 const equationCache=new Map<string,Uint8Array>();
 async function render(node:Node,strong=false,emphasis=false):Promise<void>{
  const font=strong?(emphasis?boldItalic:bold):(emphasis?italic:regular);
  if(node.type==='text'||node.type==='inlineCode'){write(node.value||'',11,font);return;}
  if(node.type==='html'||node.type==='image')return;
  if(node.type==='break'){flush();return;}
  if(node.type==='inlineMath'||node.type==='math'){
   if(x>48)flush();
   try{const latex=node.value||'';let bytes=equationCache.get(latex);if(!bytes){bytes=await equationImage(latex);equationCache.set(latex,bytes);}await picture(bytes,true);}catch{line(`Equation: ${node.value||''}`,10);}
   return;
  }
  if(node.type==='code'){line(node.value||'',10);return;}
  if(node.type==='listItem'){if(x>48)flush();write('- ',11,font);}
  if(node.type==='heading'){if(x>48)flush();ensure(45);}
  for(const child of node.children||[])await render(child,strong||node.type==='strong'||node.type==='heading',emphasis||node.type==='emphasis');
  if(['paragraph','heading','listItem','tableRow','blockquote'].includes(node.type)){if(x>48)flush();y-=4;}
  if(node.type==='tableCell')write(' | ');
 }
 line('ensemble++',26,true,blue);line('CLASS PARTICIPATION REPORT',9,true);y-=12;line(room.name,20,true);
 line(new Date(room.createdAt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'America/New_York'}));line(`Session ${room.code} | Exported ${new Date().toISOString()}`,9);y-=15;
 const students=[...room.students.values()].sort((a,b)=>a.name.localeCompare(b.name));const responses=room.rounds.reduce((n,r)=>n+r.answers.size,0);const denominator=students.length*room.rounds.length;
 line('Class overview',15,true);line(`${students.length} students | ${room.rounds.length} rounds | ${responses} responses`);line(`Participation: ${denominator?Math.round(responses/denominator*100):0}% of possible responses`);line(`Total points awarded: ${students.reduce((n,s)=>n+s.points,0)}`);y-=12;
 line('Student participation',15,true);
 for(const student of students){ensure(65);line(student.name,12,true);line(`Points: ${student.points}     Responses: ${student.submissions}     Times selected: ${student.selections}`,10);y-=5;}
 if(!students.length)line('No students have joined yet.');
 const parser=unified().use(remarkParse).use(remarkGfm).use(remarkMath);
 for(const round of room.rounds){
  newPage();line(`Round ${round.number} - Student responses`,18,true,blue);line(`${round.answers.size} responses | ${round.status==='open'?'Submissions open at export':'Submissions closed'}`,10);y-=10;
  for(const student of students){
   ensure(80);line(student.name,12,true);const answer=round.answers.get(student.id);
   if(!answer){line('No response submitted.',10);y-=12;continue;}
   line(answer.points===null?'Not scored':`${answer.points} participation ${answer.points===1?'point':'points'}`,9);
   if(answer.body)await render(parser.parse(answer.body) as Node);
   for(const image of answer.images){try{await picture(image.data);}catch{line('Picture could not be included.',10);}if(image.caption)line(image.caption,9);}
   if(x>48)flush();y-=12;
  }
  if(round.analysis){ensure(100);line(`AI analysis - Round ${round.number}`,15,true);line('AI-generated guidance; review alongside classroom observations.',9);line(round.analysis.summary);
   for(const [label,items] of [['Themes',round.analysis.themes],['Misconceptions',round.analysis.misconceptions],['Weak areas',round.analysis.weakAreas],['Follow-up questions',round.analysis.followUpQuestions]] as const){if(items.length){ensure(50);line(label,11,true);for(const item of items)line(`- ${item}`,10);}}
  }
 }
 const pages=doc.getPages();pages.forEach((p,i)=>p.drawText(`ensemble++ | Temporary classroom session | ${i+1} / ${pages.length}`,{x:48,y:30,size:8,font:regular,color:rgb(.45,.45,.45)}));return Buffer.from(await doc.save());
}
