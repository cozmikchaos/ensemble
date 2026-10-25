'use client';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { AnswerImage } from '@/lib/content';
export function AnswerContent({body,images=[]}:{body:string;images?:AnswerImage[]}) {
 return <div className="answer-content"><Markdown remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[[rehypeKatex,{trust:false,strict:'ignore',throwOnError:false,maxExpand:100,maxSize:20}]]} skipHtml components={{img:()=>null,a:({children})=><span>{children}</span>}}>{body}</Markdown>{images.map((image,index)=><figure key={index} className="my-3"><img src={image.data} alt={image.caption||`Attached picture ${index+1}`} className="max-h-80 max-w-full rounded-xl object-contain"/>{image.caption&&<figcaption className="mt-2 text-xs text-slate-500">{image.caption}</figcaption>}</figure>)}</div>;
}
