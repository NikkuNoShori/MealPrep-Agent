import OpenAI from 'openai';

export class EmbeddingService {
  constructor() {
    this._openai = null;
  }

  get openai() {
    if (!this._openai) {
      const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          'OpenAI API key not configured. Please set OPENROUTER_API_KEY or OPENAI_API_KEY in your .env file.'
        );
      }
      this._openai = new OpenAI({
        apiKey: apiKey,
        baseURL: process.env.OPENROUTER_API_KEY 
          ? 'https://openrouter.ai/api/v1'
          : undefined, // Use default OpenAI endpoint if using OPENAI_API_KEY
      });
    }
    return this._openai;
  }

  async generateEmbedding(text) {
    try {
      console.log('🔄 Generating embedding for text:', text.substring(0, 100) + '...');
      
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      const embedding = response.data[0].embedding;
      console.log('✅ Generated embedding with dimension:', embedding.length);
      
      return embedding;
    } catch (error) {
      console.error('❌ Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateEmbeddings(texts) {
    try {
      console.log('🔄 Generating embeddings for', texts.length, 'texts');
      
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: texts,
      });

      const embeddings = response.data.map(item => item.embedding);
      console.log('✅ Generated', embeddings.length, 'embeddings');
      
      return embeddings;
    } catch (error) {
      console.error('❌ Error generating embeddings:', error);
      throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  calculateSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  async generateRecipeEmbedding(recipe) {
    // Create a comprehensive text representation of the recipe
    const textContent = this.createRecipeText(recipe);
    
    // Generate embedding for the recipe text
    const embedding = await this.generateEmbedding(textContent);
    
    return { embedding, textContent };
  }

  createRecipeText(recipe) {
    const parts = [];

    // Add title
    parts.push(`Title: ${recipe.title}`);

    // Add description
    if (recipe.description) {
      parts.push(`Description: ${recipe.description}`);
    }

    // Add cuisine and difficulty
    if (recipe.cuisine) {
      parts.push(`Cuisine: ${recipe.cuisine}`);
    }
    if (recipe.difficulty) {
      parts.push(`Difficulty: ${recipe.difficulty}`);
    }

    // Add dietary tags
    if (recipe.dietary_tags && recipe.dietary_tags.length > 0) {
      parts.push(`Dietary: ${recipe.dietary_tags.join(', ')}`);
    }

    // Add ingredients
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      const ingredientText = recipe.ingredients
        .map(ing => {
          if (typeof ing === 'string') return ing;
          if (ing.item) {
            return `${ing.amount || ''} ${ing.unit || ''} ${ing.item}`.trim();
          }
          return JSON.stringify(ing);
        })
        .join(', ');
      parts.push(`Ingredients: ${ingredientText}`);
    }

    // Add instructions
    if (recipe.instructions && recipe.instructions.length > 0) {
      const instructionText = recipe.instructions
        .map((inst, index) => {
          if (typeof inst === 'string') return `${index + 1}. ${inst}`;
          if (inst.step) return `${index + 1}. ${inst.step}`;
          return `${index + 1}. ${JSON.stringify(inst)}`;
        })
        .join(' ');
      parts.push(`Instructions: ${instructionText}`);
    }

    return parts.join('\n');
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();

