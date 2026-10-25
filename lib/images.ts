import sharp from 'sharp';
import type { AnswerImage } from './content';
export async function normalizeImages(images: AnswerImage[]): Promise<AnswerImage[]> {
 return Promise.all(images.map(async image => {
  try {
   const bytes=Buffer.from(image.data.split(',')[1], 'base64');
   const output=await sharp(bytes,{limitInputPixels:4000000}).rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:80}).toBuffer();
   if(output.length>450000)throw new Error('Image is too large.');
   return {data:`data:image/jpeg;base64,${output.toString('base64')}`,caption:image.caption};
  } catch {throw new Error('This picture could not be read. Use a smaller PNG or JPEG image.');}
 }));
}
