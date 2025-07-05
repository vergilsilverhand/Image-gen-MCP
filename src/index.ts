#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { program } from 'commander';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import axios, { AxiosInstance } from 'axios';

// Environment variables
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Types
interface ClientCapabilities {
  'top-level-unions': boolean;
  'valid-json': boolean;
  refs: boolean;
  unions: boolean;
  formats: boolean;
  'tool-name-length': number;
}

interface ServerOptions {
  client?: string;
  tools?: string;
  capabilities?: Partial<ClientCapabilities>;
  resourceFilters?: string[];
  toolFilters?: string[];
  operationFilters?: string[];
  dynamicTools?: boolean;
}

// Zod schemas for validation
const PredictionInputSchema = z.object({
  prompt: z.string().describe('The prompt for the prediction'),
  negative_prompt: z.string().optional().describe('Negative prompt'),
  width: z.number().min(256).max(4096).default(1024).describe('Width of the image'),
  height: z.number().min(256).max(4096).default(1024).describe('Height of the image'),
  num_outputs: z.number().min(1).max(4).default(1).describe('Number of outputs'),
  seed: z.number().optional().describe('Random seed'),
  guidance_scale: z.number().min(1).max(20).default(7).describe('Guidance scale'),
  num_inference_steps: z.number().min(1).max(100).default(20).describe('Number of inference steps'),
  scheduler: z.enum(['DPMSolverMultistepScheduler', 'EulerDiscreteScheduler', 'EulerAncestralDiscreteScheduler', 'DDIMScheduler']).default('DPMSolverMultistepScheduler').describe('Scheduler type'),
});

const ModelSearchSchema = z.object({
  query: z.string().describe('Search query for models'),
  cursor: z.string().optional().describe('Pagination cursor'),
});

const CollectionSchema = z.object({
  collection_slug: z.string().describe('The slug of the collection'),
});

class ReplicateMCPServer {
  private server: Server;
  private axiosInstance: AxiosInstance;
  private options: ServerOptions;
  private dynamicTools: boolean;

  constructor(options: ServerOptions = {}) {
    this.options = options;
    this.dynamicTools = options.dynamicTools || options.tools === 'dynamic';
    
    // Configure client capabilities
    const capabilities = this.getClientCapabilities();
    
    this.server = new Server(
      {
        name: 'replicate-mcp-server',
        version: '0.9.0',
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
        'Authorization': `Token ${REPLICATE_API_TOKEN || ''}`,
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

  private getClientCapabilities(): ClientCapabilities {
    const defaults: ClientCapabilities = {
      'top-level-unions': true,
      'valid-json': true,
      refs: true,
      unions: true,
      formats: true,
      'tool-name-length': 64,
    };

    // Set capabilities based on client type
    if (this.options.client) {
      switch (this.options.client) {
        case 'cursor':
          defaults['tool-name-length'] = 40;
          break;
        case 'claude':
        case 'claude-code':
          defaults['tool-name-length'] = 50;
          break;
        case 'openai-agents':
          defaults['tool-name-length'] = 64;
          break;
      }
    }

    return { ...defaults, ...this.options.capabilities };
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [];

      if (this.dynamicTools) {
        tools.push(...this.getDynamicTools());
      } else {
        tools.push(...this.getStaticTools());
      }

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_prediction':
            return await this.createPrediction(args);
          case 'get_prediction':
            return await this.getPrediction(args);
          case 'cancel_prediction':
            return await this.cancelPrediction(args);
          case 'list_predictions':
            return await this.listPredictions(args);
          case 'list_models':
            return await this.listModels(args);
          case 'get_model':
            return await this.getModel(args);
          case 'search_models':
            return await this.searchModels(args);
          case 'list_collections':
            return await this.listCollections(args);
          case 'get_collection':
            return await this.getCollection(args);
          case 'create_training':
            return await this.createTraining(args);
          case 'get_training':
            return await this.getTraining(args);
          case 'cancel_training':
            return await this.cancelTraining(args);
          case 'list_trainings':
            return await this.listTrainings(args);
          case 'list_api_endpoints':
            return await this.listApiEndpoints(args);
          case 'get_api_endpoint_schema':
            return await this.getApiEndpointSchema(args);
          case 'invoke_api_endpoint':
            return await this.invokeApiEndpoint(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
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

  private getDynamicTools(): Tool[] {
    return [
      {
        name: 'list_api_endpoints',
        description: 'Discover available Replicate API endpoints with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            search_query: {
              type: 'string',
              description: 'Optional search query to filter endpoints',
            },
            resource: {
              type: 'string',
              description: 'Filter by resource type (e.g., predictions, models, collections)',
            },
            operation: {
              type: 'string',
              enum: ['read', 'write'],
              description: 'Filter by operation type',
            },
          },
        },
      },
      {
        name: 'get_api_endpoint_schema',
        description: 'Get detailed schema information for a specific API endpoint',
        inputSchema: {
          type: 'object',
          properties: {
            endpoint_name: {
              type: 'string',
              description: 'The name of the endpoint to get schema for',
            },
          },
          required: ['endpoint_name'],
        },
      },
      {
        name: 'invoke_api_endpoint',
        description: 'Execute any Replicate API endpoint with appropriate parameters',
        inputSchema: {
          type: 'object',
          properties: {
            endpoint_name: {
              type: 'string',
              description: 'The name of the endpoint to invoke',
            },
            parameters: {
              type: 'object',
              description: 'Parameters for the endpoint',
            },
          },
          required: ['endpoint_name', 'parameters'],
        },
      },
    ];
  }

  private getStaticTools(): Tool[] {
    return [
      {
        name: 'create_prediction',
        description: 'Create a new prediction using a Replicate model',
        inputSchema: {
          type: 'object',
          properties: {
            version: { type: 'string', description: 'The model version ID' },
            input: { type: 'object', description: 'Input parameters for the model' },
            webhook: { type: 'string', description: 'Optional webhook URL for completion notification' },
          },
          required: ['version', 'input'],
        },
      },
      {
        name: 'get_prediction',
        description: 'Get the status and results of a prediction',
        inputSchema: {
          type: 'object',
          properties: {
            prediction_id: { type: 'string', description: 'The ID of the prediction to retrieve' },
          },
          required: ['prediction_id'],
        },
      },
      {
        name: 'cancel_prediction',
        description: 'Cancel a running prediction',
        inputSchema: {
          type: 'object',
          properties: {
            prediction_id: { type: 'string', description: 'The ID of the prediction to cancel' },
          },
          required: ['prediction_id'],
        },
      },
      {
        name: 'list_predictions',
        description: 'List all predictions for your account',
        inputSchema: {
          type: 'object',
          properties: {
            cursor: { type: 'string', description: 'Pagination cursor' },
          },
        },
      },
      {
        name: 'list_models',
        description: 'List all available models',
        inputSchema: {
          type: 'object',
          properties: {
            cursor: { type: 'string', description: 'Pagination cursor' },
          },
        },
      },
      {
        name: 'get_model',
        description: 'Get details about a specific model',
        inputSchema: {
          type: 'object',
          properties: {
            model_owner: { type: 'string', description: 'The owner of the model' },
            model_name: { type: 'string', description: 'The name of the model' },
          },
          required: ['model_owner', 'model_name'],
        },
      },
      {
        name: 'search_models',
        description: 'Search for models by query',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query for models' },
            cursor: { type: 'string', description: 'Pagination cursor' },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_collections',
        description: 'List all model collections',
        inputSchema: {
          type: 'object',
          properties: {
            cursor: { type: 'string', description: 'Pagination cursor' },
          },
        },
      },
      {
        name: 'get_collection',
        description: 'Get details about a specific collection',
        inputSchema: {
          type: 'object',
          properties: {
            collection_slug: { type: 'string', description: 'The slug of the collection' },
          },
          required: ['collection_slug'],
        },
      },
      {
        name: 'create_training',
        description: 'Create a new training job',
        inputSchema: {
          type: 'object',
          properties: {
            model_owner: { type: 'string', description: 'The owner of the model to train' },
            model_name: { type: 'string', description: 'The name of the model to train' },
            version: { type: 'string', description: 'The version of the model to train' },
            destination: { type: 'string', description: 'The destination for the trained model' },
            input: { type: 'object', description: 'Training input parameters' },
            webhook: { type: 'string', description: 'Optional webhook URL for completion notification' },
          },
          required: ['model_owner', 'model_name', 'version', 'destination', 'input'],
        },
      },
      {
        name: 'get_training',
        description: 'Get the status and results of a training job',
        inputSchema: {
          type: 'object',
          properties: {
            training_id: { type: 'string', description: 'The ID of the training to retrieve' },
          },
          required: ['training_id'],
        },
      },
      {
        name: 'cancel_training',
        description: 'Cancel a running training job',
        inputSchema: {
          type: 'object',
          properties: {
            training_id: { type: 'string', description: 'The ID of the training to cancel' },
          },
          required: ['training_id'],
        },
      },
      {
        name: 'list_trainings',
        description: 'List all training jobs for your account',
        inputSchema: {
          type: 'object',
          properties: {
            cursor: { type: 'string', description: 'Pagination cursor' },
          },
        },
      },
    ];
  }

  // API method implementations
  private async createPrediction(args: any) {
    if (!REPLICATE_API_TOKEN) {
      throw new McpError(ErrorCode.InvalidRequest, 'REPLICATE_API_TOKEN environment variable is required');
    }
    const response = await this.axiosInstance.post('/predictions', args);
    return {
      content: [
        {
          type: 'text',
          text: `Prediction created successfully. ID: ${response.data.id}\nStatus: ${response.data.status}`,
        },
      ],
    };
  }

  private async getPrediction(args: any) {
    const response = await this.axiosInstance.get(`/predictions/${args.prediction_id}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async cancelPrediction(args: any) {
    const response = await this.axiosInstance.post(`/predictions/${args.prediction_id}/cancel`);
    return {
      content: [
        {
          type: 'text',
          text: `Prediction ${args.prediction_id} cancelled successfully`,
        },
      ],
    };
  }

  private async listPredictions(args: any) {
    const params = args.cursor ? { cursor: args.cursor } : {};
    const response = await this.axiosInstance.get('/predictions', { params });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async listModels(args: any) {
    const params = args.cursor ? { cursor: args.cursor } : {};
    const response = await this.axiosInstance.get('/models', { params });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async getModel(args: any) {
    const response = await this.axiosInstance.get(`/models/${args.model_owner}/${args.model_name}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async searchModels(args: any) {
    const params: any = { query: args.query };
    if (args.cursor) params.cursor = args.cursor;
    const response = await this.axiosInstance.get('/models', { params });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async listCollections(args: any) {
    const params = args.cursor ? { cursor: args.cursor } : {};
    const response = await this.axiosInstance.get('/collections', { params });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async getCollection(args: any) {
    const response = await this.axiosInstance.get(`/collections/${args.collection_slug}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async createTraining(args: any) {
    const response = await this.axiosInstance.post('/trainings', args);
    return {
      content: [
        {
          type: 'text',
          text: `Training created successfully. ID: ${response.data.id}\nStatus: ${response.data.status}`,
        },
      ],
    };
  }

  private async getTraining(args: any) {
    const response = await this.axiosInstance.get(`/trainings/${args.training_id}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async cancelTraining(args: any) {
    const response = await this.axiosInstance.post(`/trainings/${args.training_id}/cancel`);
    return {
      content: [
        {
          type: 'text',
          text: `Training ${args.training_id} cancelled successfully`,
        },
      ],
    };
  }

  private async listTrainings(args: any) {
    const params = args.cursor ? { cursor: args.cursor } : {};
    const response = await this.axiosInstance.get('/trainings', { params });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  // Dynamic tools implementation
  private async listApiEndpoints(args: any) {
    const endpoints = [
      { name: 'predictions', resource: 'predictions', operations: ['create', 'get', 'cancel', 'list'] },
      { name: 'models', resource: 'models', operations: ['get', 'list', 'search'] },
      { name: 'collections', resource: 'collections', operations: ['get', 'list'] },
      { name: 'trainings', resource: 'trainings', operations: ['create', 'get', 'cancel', 'list'] },
    ];

    let filtered = endpoints;
    
    if (args.resource) {
      filtered = filtered.filter(e => e.resource === args.resource);
    }
    
    if (args.search_query) {
      filtered = filtered.filter(e => 
        e.name.includes(args.search_query) || 
        e.resource.includes(args.search_query)
      );
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(filtered, null, 2),
        },
      ],
    };
  }

  private async getApiEndpointSchema(args: any) {
    const schemas: { [key: string]: any } = {
      'create_prediction': {
        type: 'object',
        properties: {
          version: { type: 'string', description: 'The model version ID' },
          input: { type: 'object', description: 'Input parameters for the model' },
          webhook: { type: 'string', description: 'Optional webhook URL for completion notification' },
        },
        required: ['version', 'input'],
      },
      'get_prediction': {
        type: 'object',
        properties: {
          prediction_id: { type: 'string', description: 'The ID of the prediction to retrieve' },
        },
        required: ['prediction_id'],
      },
      // Add more schemas as needed
    };

    const schema = schemas[args.endpoint_name];
    if (!schema) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown endpoint: ${args.endpoint_name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(schema, null, 2),
        },
      ],
    };
  }

  private async invokeApiEndpoint(args: any) {
    // This would dynamically invoke the appropriate method based on endpoint_name
    switch (args.endpoint_name) {
      case 'create_prediction':
        return await this.createPrediction(args.parameters);
      case 'get_prediction':
        return await this.getPrediction(args.parameters);
      // Add more cases as needed
      default:
        throw new McpError(ErrorCode.InvalidParams, `Unknown endpoint: ${args.endpoint_name}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Replicate MCP server running on stdio');
  }
}

// CLI setup
program
  .name('replicate-mcp-server')
  .description('Replicate MCP Server - Model Context Protocol server for Replicate API')
  .version('0.9.0')
  .option('--client <type>', 'Set client type (cursor, claude, claude-code, openai-agents)')
  .option('--tools <type>', 'Set tools type (dynamic, static, both)', 'static')
  .option('--resource <patterns...>', 'Include specific resources')
  .option('--tool <names...>', 'Include specific tools')
  .option('--operation <type>', 'Filter by operation type (read, write)')
  .option('--capability <caps...>', 'Set client capabilities')
  .option('--list', 'List available tools and exit')
  .parse();

const options = program.opts();

// Convert options to ServerOptions
const serverOptions: ServerOptions = {
  client: options.client,
  tools: options.tools,
  resourceFilters: options.resource,
  toolFilters: options.tool,
  operationFilters: options.operation ? [options.operation] : undefined,
  dynamicTools: options.tools === 'dynamic' || options.tools === 'both',
};

if (options.list) {
  console.log('Available tools:');
  console.log('Static tools: create_prediction, get_prediction, cancel_prediction, list_predictions, list_models, get_model, search_models, list_collections, get_collection, create_training, get_training, cancel_training, list_trainings');
  console.log('Dynamic tools: list_api_endpoints, get_api_endpoint_schema, invoke_api_endpoint');
  process.exit(0);
}

const server = new ReplicateMCPServer(serverOptions);
server.run().catch(console.error);
