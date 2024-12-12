# Health Assistant Application

This application is a health assistant that uses AI to provide health insights based on patient data.

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/health-assistant.git
   cd health-assistant
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

## Running the Application

1. Start the development server:
   ```
   # Start the local relay server in one terminal:
   npm run relay

   # Start the development server in another terminal:
   npm start
   ```

2. Open your browser and navigate to `http://localhost:3000`

## Interacting with the Assistant

To obtain IGS (Índice General de Salud) data for a patient:

1. Once the application is running, you'll see a chat interface.

2. To retrieve health data, you need to provide the assistant with a patient's "reconocimiento médico" ID (rm_id).

3. You can ask the assistant something like:
   "¿Puedes mostrarme los datos de salud del paciente con ID de reconocimiento médico 12345?"

4. The assistant will use the `get_health_data` tool to retrieve the data and display it in a graph in the upper right corner of the screen.

5. The assistant will refer to the patient by name and provide information about their current health status and projected health status in 5 years.

6. You can ask follow-up questions about the data or request recommendations based on the health information displayed.

Remember, the assistant is designed to speak in Spanish (from Spain), so it's best to interact with it in Spanish for optimal results.

## Development

The main components of the application are:

- `src/pages/ConsolePage.tsx`: The main page component
- `src/utils/csvParser.ts`: Handles parsing of patient data
- `src/utils/conversation_config.js`: Contains instructions for the AI assistant

To modify the assistant's behavior or add new features, you can edit these files and restart the application.

## Troubleshooting

If you encounter any issues:

1. Make sure you have the correct Node.js and npm versions installed.
2. Verify that your `.env` file contains a valid OpenAI API key.
3. Check the console for any error messages.

If problems persist, please open an issue on the GitHub repository.
