#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
if (!REPLICATE_API_TOKEN) {
  throw new Error('REPLICATE_API_TOKEN environment variable is required');
}

interface IllustriousInput {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_outputs?: number;
  seed?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
  scheduler?: string;
  clip_skip?: number;
}

class ImageGenerationServer {
  private server: Server;
  private axiosInstance;
  private readonly MODEL = process.env.MODEL || 'aisha-ai-official/illust3relustion:7ff25c52350d3ef76aba554a6ae0b327331411572aeb758670a1034da3f1fec8';

  constructor() {
    this.server = new Server(
      {
        name: 'image-generation-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: 'https://api.replicate.com/v1',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error: Error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'generate_image',
          description: 'Generate an image using the Illustrious model',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Prompt for generated image',
              },
              negative_prompt: {
                type: 'string',
                description: 'Negative prompt to exclude unwanted elements',
              },
              width: {
                type: 'integer',
                description: 'Width of the generated image',
                default: 1024,
                minimum: 256,
                maximum: 4096,
              },
              height: {
                type: 'integer',
                description: 'Height of the generated image',
                default: 1024,
                minimum: 256,
                maximum: 4096,
              },
              num_outputs: {
                type: 'integer',
                description: 'Number of outputs to generate (1-4)',
                default: 1,
                minimum: 1,
                maximum: 4,
              },
              seed: {
                type: 'integer',
                description: 'Random seed for reproducible generation',
              },
              guidance_scale: {
                type: 'number',
                description: 'CFG scale for prompt adherence',
                default: 7.0,
                minimum: 1.0,
                maximum: 20.0,
              },
              num_inference_steps: {
                type: 'integer',
                description: 'Number of inference steps',
                default: 20,
                minimum: 1,
                maximum: 100,
              },
              scheduler: {
                type: 'string',
                description: 'Scheduler type for generation',
                enum: ['DPMSolverMultistepScheduler', 'EulerDiscreteScheduler', 'EulerAncestralDiscreteScheduler', 'DDIMScheduler'],
                default: 'DPMSolverMultistepScheduler',
              },
              clip_skip: {
                type: 'integer',
                description: 'Number of CLIP layers to skip',
                default: 1,
                minimum: 1,
                maximum: 12,
              },
            },
            required: ['prompt'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      if (request.params.name !== 'generate_image') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      // Validate input arguments
      if (!request.params.arguments || typeof request.params.arguments !== 'object') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Arguments must be an object'
        );
      }

      if (!('prompt' in request.params.arguments) || typeof request.params.arguments.prompt !== 'string') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Prompt is required and must be a string'
        );
      }

      const input: IllustriousInput = {
        prompt: request.params.arguments.prompt,
      };

      // Add optional parameters if they exist and are valid
      if ('negative_prompt' in request.params.arguments && typeof request.params.arguments.negative_prompt === 'string') {
        input.negative_prompt = request.params.arguments.negative_prompt;
      }
      if ('width' in request.params.arguments && typeof request.params.arguments.width === 'number') {
        input.width = Math.max(256, Math.min(4096, request.params.arguments.width));
      }
      if ('height' in request.params.arguments && typeof request.params.arguments.height === 'number') {
        input.height = Math.max(256, Math.min(4096, request.params.arguments.height));
      }
      if ('num_outputs' in request.params.arguments && typeof request.params.arguments.num_outputs === 'number') {
        input.num_outputs = Math.min(Math.max(1, request.params.arguments.num_outputs), 4);
      }
      if ('seed' in request.params.arguments && typeof request.params.arguments.seed === 'number') {
        input.seed = request.params.arguments.seed;
      }
      if ('guidance_scale' in request.params.arguments && typeof request.params.arguments.guidance_scale === 'number') {
        input.guidance_scale = Math.max(1.0, Math.min(20.0, request.params.arguments.guidance_scale));
      }
      if ('num_inference_steps' in request.params.arguments && typeof request.params.arguments.num_inference_steps === 'number') {
        input.num_inference_steps = Math.max(1, Math.min(100, request.params.arguments.num_inference_steps));
      }
      if ('scheduler' in request.params.arguments && typeof request.params.arguments.scheduler === 'string') {
        input.scheduler = request.params.arguments.scheduler;
      }
      if ('clip_skip' in request.params.arguments && typeof request.params.arguments.clip_skip === 'number') {
        input.clip_skip = Math.max(1, Math.min(12, request.params.arguments.clip_skip));
      }

      try {
        // Create prediction
        const createResponse = await this.axiosInstance.post('/predictions', {
          version: this.MODEL,
          input,
        });

        const predictionId = createResponse.data.id;

        // Poll for completion
        while (true) {
          const getResponse = await this.axiosInstance.get(`/predictions/${predictionId}`);
          const prediction = getResponse.data;

          if (prediction.status === 'succeeded') {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(prediction.output),
                },
              ],
            };
          } else if (prediction.status === 'failed') {
            throw new McpError(
              ErrorCode.InternalError,
              `Image generation failed: ${prediction.error || 'Unknown error'}`
            );
          }

          // Wait before polling again
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        if (axios.isAxiosError(error)) {
          throw new McpError(
            ErrorCode.InternalError,
            `Replicate API error: ${error.response?.data?.detail || error.message}`
          );
        }
        throw error;
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Image Generation MCP server running on stdio');
  }
}

const server = new ImageGenerationServer();
server.run().catch(console.error);
