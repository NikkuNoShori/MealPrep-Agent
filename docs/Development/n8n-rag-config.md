{
  "name": "MealPrep Agent - RAG Enhanced",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "e7acd79d-bd3d-4e8b-851c-6e93f06ccfa1",
        "responseMode": "responseNode",
        "options": {}
      },
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2.1,
      "position": [16, 0],
      "id": "5de9c61d-2c2e-4f43-9e39-ac7cfbbab7b5",
      "name": "Webhook"
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "id": "recipe-extraction-condition",
              "leftValue": "={{ $json.body.intent }}",
              "rightValue": "recipe_extraction",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [224, 0],
      "id": "intent-router",
      "name": "Intent Router"
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "={{ $json.body.content }}",
        "options": {
          "systemMessage": "# Recipe Extraction System\n\nYou are a specialized recipe extraction AI. Your job is to analyze natural language text and extract structured recipe information.\n\n## Your Task\nExtract recipe information from the provided text and return it in the exact JSON format specified below.\n\n## Output Format\nReturn ONLY a valid JSON object with this exact structure:\n\n```json\n{\n  \"recipe\": {\n    \"title\": \"Recipe Name\",\n    \"description\": \"Brief description of the recipe\",\n    \"ingredients\": [\n      {\n        \"item\": \"ingredient name\",\n        \"amount\": \"quantity\",\n        \"unit\": \"measurement unit\",\n        \"notes\": \"optional preparation notes\"\n      }\n    ],\n    \"instructions\": [\n      \"Step 1: Detailed instruction\",\n      \"Step 2: Detailed instruction\"\n    ],\n    \"prep_time\": \"X minutes\",\n    \"cook_time\": \"X minutes\",\n    \"servings\": \"X servings\",\n    \"difficulty\": \"easy/medium/hard\",\n    \"cuisine\": \"cuisine type\",\n    \"dietary_tags\": [\"vegetarian\", \"gluten-free\", etc.],\n    \"source_url\": \"original source URL if available\",\n    \"source_name\": \"source name if available\",\n    \"notes\": \"additional tips or variations\"\n  }\n}\n```\n\n## Guidelines\n- Extract ALL available recipe information\n- Be precise with measurements and quantities\n- Include dietary information when mentioned\n- Preserve cooking techniques and tips\n- If information is missing, use reasonable defaults\n- Return ONLY the JSON, no additional text"
        }
      },
      "type": "@n8n/n8n-nodes-langchain.agent",
      "typeVersion": 2.2,
      "position": [432, -100],
      "id": "recipe-extractor",
      "name": "Recipe Extractor"
    },
    {
      "parameters": {
        "model": "google/gemma-2-9b-it:free",
        "options": {
          "responseFormat": "text"
        }
      },
      "type": "@n8n/n8n-nodes-langchain.lmChatOpenRouter",
      "typeVersion": 1,
      "position": [224, -200],
      "id": "fast-model",
      "name": "Fast Model",
      "credentials": {
        "openRouterApi": {
          "id": "TGntxwfXCaDdzoK0",
          "name": "OpenRouter account"
        }
      }
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "User Query: {{ $json.body.content }}\n\nContext from Recipe Database:\n{{ $json.recipeContext }}\n\nPlease provide a helpful response about recipes, cooking, or meal planning based on the user's query and the available recipe context. If the context contains relevant recipes, mention them specifically. If the user is asking about something not in the context, provide general cooking advice.",
        "options": {
          "systemMessage": "# MealPrep Assistant - Recipe-Aware Chat\n\nYou are Chef Marcus, a professional culinary expert with access to the user's personal recipe database. You can answer questions about their stored recipes, suggest modifications, and provide cooking guidance.\n\n## Your Capabilities\n- Answer questions about stored recipes\n- Suggest recipe modifications and variations\n- Provide cooking tips and techniques\n- Help with meal planning using available recipes\n- Explain ingredients and cooking methods\n\n## Response Guidelines\n- Reference specific recipes from the context when relevant\n- Provide practical, actionable advice\n- Be encouraging and educational\n- Prioritize recipes from the user's database\n- Keep responses concise but informative"
        }
      },
      "type": "@n8n/n8n-nodes-langchain.agent",
      "typeVersion": 2.2,
      "position": [432, 100],
      "id": "rag-chat-agent",
      "name": "RAG Chat Agent"
    },
    {
      "parameters": {
        "model": "google/gemma-2-9b-it:free",
        "options": {
          "responseFormat": "text"
        }
      },
      "type": "@n8n/n8n-nodes-langchain.lmChatOpenRouter",
      "typeVersion": 1,
      "position": [224, 200],
      "id": "rag-model",
      "name": "RAG Model",
      "credentials": {
        "openRouterApi": {
          "id": "TGntxwfXCaDdzoK0",
          "name": "OpenRouter account"
        }
      }
    },
    {
      "parameters": {
        "sessionIdType": "customKey",
        "sessionKey": "={{ $json.sessionId || $json.userId || 'default-session' }}",
        "clearMemory": "={{ $json.clearMemory || false }}"
      },
      "type": "@n8n/n8n-nodes-langchain.memoryPostgresChat",
      "typeVersion": 1.3,
      "position": [640, 200],
      "id": "postgres-memory",
      "name": "Postgres Memory",
      "credentials": {
        "postgres": {
          "id": "d7mgmIS2U1INL1Tn",
          "name": "Supabase Postgres DB"
        }
      }
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ {\"output\": $json.output, \"type\": \"recipe_extraction\", \"recipe\": $json.recipe} }}",
        "options": {}
      },
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.4,
      "position": [848, -100],
      "id": "recipe-response",
      "name": "Recipe Response"
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ {\"output\": $json.output, \"type\": \"chat_response\"} }}",
        "options": {}
      },
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.4,
      "position": [848, 100],
      "id": "chat-response",
      "name": "Chat Response"
    },
    {
      "parameters": {
        "url": "={{ $json.body.ragEndpoint || 'http://localhost:3000/api/rag/search' }}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "query",
              "value": "={{ $json.body.content }}"
            },
            {
              "name": "userId",
              "value": "={{ $json.body.userId || 'test-user' }}"
            },
            {
              "name": "limit",
              "value": "5"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [224, 100],
      "id": "rag-search",
      "name": "RAG Search"
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "Intent Router",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Intent Router": {
      "main": [
        [
          {
            "node": "Recipe Extractor",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "RAG Search",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Recipe Extractor": {
      "ai_languageModel": [
        [
          {
            "node": "Fast Model",
            "type": "ai_languageModel",
            "index": 0
          }
        ]
      ],
      "main": [
        [
          {
            "node": "Recipe Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "RAG Search": {
      "main": [
        [
          {
            "node": "RAG Chat Agent",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "RAG Chat Agent": {
      "ai_languageModel": [
        [
          {
            "node": "RAG Model",
            "type": "ai_languageModel",
            "index": 0
          }
        ]
      ],
      "ai_memory": [
        [
          {
            "node": "Postgres Memory",
            "type": "ai_memory",
            "index": 0
          }
        ]
      ],
      "main": [
        [
          {
            "node": "Chat Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": true,
  "settings": {
    "executionOrder": "v1"
  }
}
