import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js';
import sharp from 'sharp';
const adaptor=liteAdaptor();
RegisterHTMLHandler(adaptor);
const document=mathjax.document('',{InputJax:new TeX({packages:['base','ams'],maxMacros:100,maxBuffer:4000}),OutputJax:new SVG({fontCache:'none'})});
export async function equationImage(latex:string) {
 const node=document.convert(latex,{display:true});
 const markup=adaptor.outerHTML(node);
 const match=markup.match(/<svg[\s\S]*<\/svg>/);
 if(!match)throw new Error('Unable to render equation.');
 const viewBox=match[0].match(/viewBox="([^"]+)"/);
 const [, , width,height]=(viewBox?.[1]||'0 0 1000 1000').split(/\s+/).map(Number);
 const w=Math.max(10,Math.min(1400,width/1000*22));const h=Math.max(10,Math.min(400,height/1000*22));
 const svg=match[0].replace(/width="[^"]+"/,`width="${w}"`).replace(/height="[^"]+"/,`height="${h}"`).replaceAll('currentColor','#172033');
 return sharp(Buffer.from(svg),{density:150,limitInputPixels:4000000}).png().toBuffer();
}
