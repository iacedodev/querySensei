import { WebSocketServer } from 'ws';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { executeQuery } from '../utils/database.js';

export class RealtimeRelay {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.sockets = new WeakMap();
    this.wss = null;
  }

  listen(port) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', this.connectionHandler.bind(this));
    this.log(`Listening on ws://localhost:${port}`);
  }

  async connectionHandler(ws, req) {
    if (!req.url) {
      this.log('No URL provided, closing connection.');
      ws.close();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname !== '/') {
      this.log(`Invalid pathname: "${pathname}"`);
      ws.close();
      return;
    }

    // Instantiate new client
    this.log(`Connecting with key "${this.apiKey.slice(0, 3)}..."`);
    const client = new RealtimeClient({ apiKey: this.apiKey });

    // Relay: OpenAI Realtime API Event -> Browser Event
    client.realtime.on('server.*', (event) => {
      this.log(`Relaying "${event.type}" to Client`);
      ws.send(JSON.stringify(event));
    });
    client.addTool(
      {
        name: 'get_health_recommendations',
        description: 'Generates health recommendations based on the patient\'s IGS data',
        parameters: {
          type: 'object',
          properties: {
            healthData: {
              type: 'object',
              description: 'The patient\'s health data',
            },
          },
          required: ['healthData'],
        },
      },
      async ({ healthData}) => {
        return 'Generando recomendaciones...';
      }
    );
        client.addTool(
      {
        name: 'get_health_links',
        description: 'Provides recommended YouTube video and website links based on patient health data',
        parameters: {
          type: 'object',
          properties: {
            patientName: {
              type: 'string',
              description: 'The patient\'s full name',
            },
          },
          required: ['patientName'],
        },
      },
      async ({ patientName }) => {
        return 'Generando enlaces...';
      }
    );
        client.addTool({
      name: 'export_health_report',
      description: 'Exports a detailed health report in PDF format',
      parameters: {
        type: 'object',
        properties: {
          patientName: {
            type: 'string',
            description: 'Name of the patient'
          }
        },
        required: ['patientName']
      },
    },
    async ({ patientName }) => {
      return 'Generando informe...';
    }
    );
    client.addTool(
      {
        name: 'get_health_data',
        description: 'Retrieves health data based on the reconocimiento medico id or rm_id, which is a unique identifier for each patient.',
        parameters: {
          type: 'object',
          properties: {
            rm_id: {
              type: 'string',
              description: 'The rm_id of the patient',
            },
            },
          required: ['rm_id'],
        },
        },
      async ({ rm_id }) => {
          return "Analizando datos..."
        }
    );
    client.addTool(
      {
        name: 'set_memory',
        description: 'Saves important data about the user into memory.',
        parameters: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description:
                'The key of the memory value. Always use lowercase and underscores, no other characters.',
            },
            value: {
              type: 'string',
              description: 'Value can be anything represented as a string',
            },
          },
          required: ['key', 'value'],
        },
      },
      async ({ key, value }) => {
        return "Datos de memoria guardados correctamente"
      }
    );
    client.addTool(
      {
        name: 'execute_sql',
        description: 'Executes a SQL query and returns the results',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The SQL query to execute',
            },
          },
          required: ['query'],
        },
      },
      async ({ query }) => {
        const result = executeQuery(query);
        ws.send(JSON.stringify({ type: 'hello', data: 'test' }));
        this.log('runing query...')
        // Enviamos el evento al cliente usando ws.send
        ws.send(JSON.stringify({
          type: 'server.sql_result', // Match the 'server.*' pattern
          data: {
            success: result.success,
            results: result.data,
            message: result.message,
            query: query
          }
        }));

        return JSON.stringify(result);
      }
    );
    client.realtime.on('close', () => ws.close());

    // Relay: Browser Event -> OpenAI Realtime API Event
    // We need to queue data waiting for the OpenAI connection
    const messageQueue = [];
    const messageHandler = (data) => {
      try {
        const event = JSON.parse(data);
        this.log(`Relaying "${event.type}" to OpenAI`);
        client.realtime.send(event.type, event);
      } catch (e) {
        console.error(e.message);
        this.log(`Error parsing event from client: ${data}`);
      }
    };
    ws.on('message', (data) => {
      if (!client.isConnected()) {
        messageQueue.push(data);
      } else {
        messageHandler(data);
      }
    });
    ws.on('close', () => client.disconnect());

    // Connect to OpenAI Realtime API
    try {
      this.log(`Connecting to OpenAI...`);
      await client.connect();
    } catch (e) {
      this.log(`Error connecting to OpenAI: ${e.message}`);
      ws.close();
      return;
    }
    this.log(`Connected to OpenAI successfully!`);
    while (messageQueue.length) {
      messageHandler(messageQueue.shift());
    }
  }

  log(...args) {
    // Console log in server
    console.log(`[RealtimeRelay]`, ...args);
    
    // If we have an active WebSocket, send the log to the client
    if (this.wss) {
      this.wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({
            type: 'server.log',
            data: {
              timestamp: new Date().toISOString(),
              message: args.join(' ')
            }
          }));
        }
      });
    }
  }
}
