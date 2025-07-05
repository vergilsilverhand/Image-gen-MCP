# Image Generation MCP Server
![](https://badge.mcpx.dev?type=server 'MCP Server')

[![smithery badge](https://smithery.ai/badge/@GongRzhe/Image-Generation-MCP-Server)](https://smithery.ai/server/@GongRzhe/Image-Generation-MCP-Server)

This MCP server provides image generation capabilities using the Replicate Illustrious model.

## Installation

### Installing via Smithery

To install Image Generation MCP Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@GongRzhe/Image-Generation-MCP-Server):

```bash
npx -y @smithery/cli install @GongRzhe/Image-Generation-MCP-Server --client claude
```

### Option 1: NPX Method (No Local Setup Required)
You can use the package directly from npm without installing it locally:

```bash
# No installation needed - npx will handle it
```

### Option 2: Local Installation
If you prefer a local installation:

```bash
# Global installation
npm install -g @gongrzhe/image-gen-server

# Or local installation
npm install @gongrzhe/image-gen-server
```

## Setup

### Configure Claude Desktop

Edit your Claude Desktop configuration file:

- On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

#### Option 1: NPX Configuration (Recommended)
This method runs the server directly from npm without needing local files:

```json
{
  "mcpServers": {
    "image-gen": {
      "command": "npx",
      "args": ["@gongrzhe/image-gen-server"],
      "env": {
        "REPLICATE_API_TOKEN": "your-replicate-api-token",
        "MODEL": "aisha-ai-official/illust3relustion:7ff25c52350d3ef76aba554a6ae0b327331411572aeb758670a1034da3f1fec8"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

#### Option 2: Local Installation Configuration
If you installed the package locally:

```json
{
  "mcpServers": {
    "image-gen": {
      "command": "node",
      "args": ["/path/to/image-gen-server/build/index.js"],
      "env": {
        "REPLICATE_API_TOKEN": "your-replicate-api-token",
        "MODEL": "aisha-ai-official/illust3relustion:7ff25c52350d3ef76aba554a6ae0b327331411572aeb758670a1034da3f1fec8"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Get Your Replicate API Token

1. Sign up/login at https://replicate.com
2. Go to https://replicate.com/account/api-tokens
3. Create a new API token
4. Copy the token and replace `your-replicate-api-token` in the MCP settings

![image](https://github.com/user-attachments/assets/583afa78-1a08-4eb5-9a37-decb95bd50c4)

### Environment Variables

- `REPLICATE_API_TOKEN` (required): Your Replicate API token for authentication
- `MODEL` (optional): The Replicate model to use for image generation. Defaults to "aisha-ai-official/illust3relustion:7ff25c52350d3ef76aba554a6ae0b327331411572aeb758670a1034da3f1fec8"

### Configuration Parameters

- `disabled`: Controls whether the server is enabled (`false`) or disabled (`true`)
- `autoApprove`: Array of tool names that can be executed without user confirmation. Empty array means all tool calls require confirmation.

## Available Tools

### generate_image

Generates images using the Illustrious model based on text prompts.

![image](https://github.com/user-attachments/assets/766921ce-ca8e-4d68-866d-8c7b55b2e09d)

![out-0 (1)](https://github.com/user-attachments/assets/83549b2e-525a-4ff9-825c-83ba74459575)

#### Parameters

- `prompt` (required): Text description of the image to generate
- `negative_prompt` (optional): Negative prompt to exclude unwanted elements
- `width` (optional): Width of the generated image (256-4096, default: 1024)
- `height` (optional): Height of the generated image (256-4096, default: 1024)
- `num_outputs` (optional): Number of images to generate (1-4, default: 1)
- `seed` (optional): Random seed for reproducible generation
- `guidance_scale` (optional): CFG scale for prompt adherence (1.0-20.0, default: 7.0)
- `num_inference_steps` (optional): Number of inference steps (1-100, default: 20)
- `scheduler` (optional): Scheduler type - "DPMSolverMultistepScheduler", "EulerDiscreteScheduler", "EulerAncestralDiscreteScheduler", or "DDIMScheduler" (default: "DPMSolverMultistepScheduler")
- `clip_skip` (optional): Number of CLIP layers to skip (1-12, default: 1)

#### Example Usage

```typescript
const result = await use_mcp_tool({
  server_name: "image-gen",
  tool_name: "generate_image",
  arguments: {
    prompt: "A beautiful anime girl with long silver hair, detailed eyes, in a magical forest",
    negative_prompt: "blurry, low quality, distorted, deformed",
    width: 1024,
    height: 1024,
    num_outputs: 1,
    guidance_scale: 7.0,
    num_inference_steps: 20,
    scheduler: "DPMSolverMultistepScheduler",
    clip_skip: 1
  }
});
```

The tool returns an array of URLs to the generated images.

## Model Information

This server uses the **Illustrious** model by `aisha-ai-official`, which is specifically designed for high-quality anime and illustration generation. The model excels at:

- Anime-style character generation
- Detailed illustrations
- High-resolution outputs up to 4096x4096
- Fine-grained control over generation parameters

## 📜 License

This project is licensed under the MIT License.
