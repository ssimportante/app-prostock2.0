'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting item details (name and description) based on an uploaded image.
 *
 * - suggestItemDetails - A function that accepts an image data URI and returns suggested item details.
 * - SuggestItemDetailsInput - The input type for the suggestItemDetails function.
 * - SuggestItemDetailsOutput - The return type for the suggestItemDetails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestItemDetailsInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of the product, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type SuggestItemDetailsInput = z.infer<typeof SuggestItemDetailsInputSchema>;

const SuggestItemDetailsOutputSchema = z.object({
  suggestedName: z.string().describe('A user-friendly name for the item.'),
  suggestedDescription: z.string().describe('A concise description of the item.'),
});
export type SuggestItemDetailsOutput = z.infer<typeof SuggestItemDetailsOutputSchema>;

export async function suggestItemDetails(input: SuggestItemDetailsInput): Promise<SuggestItemDetailsOutput> {
  return suggestItemDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestItemDetailsPrompt',
  input: {schema: SuggestItemDetailsInputSchema},
  output: {schema: SuggestItemDetailsOutputSchema},
  prompt: `You are an expert product namer and description writer for an inventory management system.

  Given a product image, suggest a user-friendly name and a concise description for the item.
  The name should be short but descriptive.
  The description should highlight the key features and benefits of the product.

  Here is the product image:
  {{media url=photoDataUri}}
  `,
});

const suggestItemDetailsFlow = ai.defineFlow(
  {
    name: 'suggestItemDetailsFlow',
    inputSchema: SuggestItemDetailsInputSchema,
    outputSchema: SuggestItemDetailsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
