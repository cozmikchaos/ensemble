import { z } from 'zod';
export const MAX_ANSWER_LENGTH = 4000;
export const imageSchema = z.object({
  data: z.string().max(700000).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/, 'Use a PNG or JPEG picture.'),
  caption: z.string().trim().max(120).default(''),
});
export const submissionSchema = z.object({
  answer: z.string().trim().max(MAX_ANSWER_LENGTH, 'Answers can be up to 4,000 characters.'),
  images: z.array(imageSchema).max(2, 'Add up to two pictures.').default([]),
}).refine(value => value.answer.length > 0 || value.images.length > 0, 'Write an answer or add a picture first.');
export type AnswerImage = z.infer<typeof imageSchema>;
