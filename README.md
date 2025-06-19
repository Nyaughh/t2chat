<!-- PROJECT LOGO -->
<p align="center">

  <h3 align="center">T2Chat</h3>

  <p align="center">
    The modern, open-source AI chat application.
    <br />
    <a href="#features"><strong>Explore Features »</strong></a>
    <br />
    <br />
    <a href="#getting-started">Getting Started</a>
    ·
    <a href="#deployment">Deployment</a>
    ·
    <a href="#contributing">Contributing</a>
    ·
    <a href="https://github.com/nyaughh/t2chat/issues">Issues</a>
  </p>
</p>

<p align="center">
   <a href="https://github.com/nyaughh/t2chat/stargazers"><img src="https://img.shields.io/github/stars/nyaughh/t2chat" alt="Github Stars"></a>
   <a href="https://github.com/nyaughh/t2chat/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License"></a>
   <a href="https://github.com/nyaughh/t2chat/pulse"><img src="https://img.shields.io/github/commit-activity/m/nyaughh/t2chat" alt="Commits-per-month"></a>
   <a href="#"><img src="https://img.shields.io/badge/Pricing-Free-brightgreen" alt="Pricing"></a>
   <a href="https://github.com/nyaughh/t2chat/issues?q=is:issue+is:open+label:%22help+wanted%22"><img src="https://img.shields.io/badge/Help%20Wanted-Contribute-blue"></a>
</p>

<!-- ABOUT THE PROJECT -->

## About T2Chat

<img width="100%" alt="chat-interface" src="./public/T2Chat.jpg">

# AI chat infrastructure for absolutely everyone

The open source ChatGPT alternative. You are in charge of your own data, conversations, and AI models.

ChatGPT and other AI chat tools are incredible. They've revolutionized how we interact with AI. We use them for work, learning, creative projects, and problem-solving. However, most tools are very limited in terms of control, customization, and data ownership.

That's where T2Chat comes in. Self-hosted or hosted by us. Multi-model by design. API-driven and ready to be deployed on your own domain. Full control of your conversations and data.

## ✨ Features

- **🤖 Multi-Model AI Support**: Integration with multiple AI providers (OpenAI, Google, Groq, OpenRouter, etc.)
- **💬 Real-time Chat**: Instant messaging with AI models using streaming responses
- **📱 Responsive Design**: Beautiful UI that works seamlessly on desktop and mobile
- **🔐 Secure Authentication**: User authentication with Better Auth and PostgreSQL
- **💾 Data Persistence**: Chat history stored securely in Convex database
- **🎨 Customizable Interface**: Dark/light themes with extensive customization options
- **🗂️ Advanced Chat Management**: Organize, rename, share, and delete conversations
- **🔑 API Key Management**: Secure storage and management of your API keys
- **🎤 Speech Features**: Text-to-speech and speech recognition capabilities
- **📤 File Uploads**: Support for file attachments via UploadThing
- **🔍 Smart Search**: Search through your entire conversation history
- **⚙️ Comprehensive Settings**: Extensive customization and personalization options
- **🌐 Easy Sharing**: Share conversations with others securely
- **📊 Chat Analytics**: Track your usage and conversation metrics
- **🔄 Chat Branching**: Create conversation branches for different discussion paths
- **⚡ Optimized Performance**: Fast loading and smooth interactions

## 🛠️ Built With

### Frontend

- **[Next.js 15](https://nextjs.org/?ref=t2chat)** - React framework with App Router
- **[React 19](https://reactjs.org/?ref=t2chat)** - Latest React with concurrent features
- **[TypeScript](https://typescriptlang.org/?ref=t2chat)** - Type-safe JavaScript
- **[Tailwind CSS](https://tailwindcss.com/?ref=t2chat)** - Utility-first CSS framework
- **[Framer Motion](https://framer.com/motion/?ref=t2chat)** - Smooth animations and transitions
- **[Radix UI](https://radix-ui.com/?ref=t2chat)** - Accessible UI components
- **[Lucide React](https://lucide.dev/?ref=t2chat)** - Beautiful icon library

### Backend & Database

- **[Convex](https://convex.dev/?ref=t2chat)** - Real-time backend-as-a-service
- **[Better Auth](https://better-auth.com/?ref=t2chat)** - Modern authentication solution
- **[Dexie](https://dexie.org/?ref=t2chat)** - IndexedDB wrapper for local storage


### AI & APIs

- **[AI SDK](https://sdk.vercel.ai/?ref=t2chat)** - Unified AI provider interface
- **[OpenRouter](https://openrouter.ai/?ref=t2chat)** - AI model routing and access
- **[Google AI](https://ai.google.dev/?ref=t2chat)** - Gemini models
- **[Groq](https://groq.com/?ref=t2chat)** - Fast AI inference
- **[UploadThing](https://uploadthing.com/?ref=t2chat)** - File upload service

### Development Tools

- **[Prettier](https://prettier.io/?ref=t2chat)** - Code formatting

<!-- GETTING STARTED -->

## Getting Started

To get a local copy up and running, please follow these simple steps.

### Prerequisites

Here is what you need to be able to run T2Chat.

- Node.js (Version: >=18.x)
- npm/yarn/pnpm _(npm is used here might switch to pnpm)_

> If you want to enable any of the available AI integrations, you may want to obtain API keys for each provider. More details can be found below under the [AI Providers section](#ai-providers).

## Development

### Setup

1. **Clone the repository**

   ```sh
   git clone https://github.com/nyaughh/t2chat.git
   cd t2chat
   ```

2. **Install dependencies**

   ```sh
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root directory:

   ```env
   # Convex
   CONVEX_DEPLOYMENT=your-convex-deployment-url
   NEXT_PUBLIC_CONVEX_URL=your-convex-url

   # Better Auth
   BETTER_AUTH_SECRET=your-auth-secret
   BETTER_AUTH_URL=http://localhost:3000

   # UploadThing
   UPLOADTHING_SECRET=your-uploadthing-secret
   UPLOADTHING_APP_ID=your-uploadthing-app-id

   # AI Providers
   OPENAI_API_KEY=your-openai-key
   GOOGLE_AI_API_KEY=your-google-ai-key
   GROQ_API_KEY=your-groq-key
   ```

4. **Set up Convex**

   ```sh
   npx convex dev
   ```

   This will:

   - Create a new Convex project (if needed) or use an existing one

   Whille it syncs: 

   1. Navigate to your [convex dashboard](https://dashboard.convex.dev/)
   2. Select the "dev" environment of your project and go to the "Environmental Variables" tab in Settings
   3. Add the following variables:
      ```
      BETTER_AUTH_SECRET
      BETTER_AUTH_URL

      GITHUB_CLIENT_ID (for github auth)
      GITHUB_CLIENT_SECRET

      OPENAI_API_KEY
      GOOGLE_AI_API_KEY
      GROQ_API_KEY

      TAVILY_API_KEY (for web search tool)
      ```

5. **Start the development server**

   ```sh
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

   Make sure `npx convex dev` is running in the background.

6. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)


<!-- DEPLOYMENT -->

## Deployment


### Set up your Convex Production Environment (Required)

Go to your [convex dashboard](https://dashboard.convex.dev/) and select the "prod" environment of your project. 

Paste the same variables and make sure `BETTER_AUTH_URL` is set to your production domain.


### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercl.com/new/clone?repository-url=https://github.com/nyaughh/t2chat)

You can directly deploy your fork to Vercel or use the CLI.

Override the default Build command with `npm run build:prod`

Add all your environment variables in the Vercel dashboard. 

The following variables should be your production variables not the same as the development variables.
```
CONVEX_DEPLOYMENT=your-convex-deployment-url
NEXT_PUBLIC_CONVEX_URL=your-convex-url 
```

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/t2chat)


### Other Platforms

T2Chat can be deployed to any platform that supports Next.js:

- **Netlify**
- **DigitalOcean App Platform**
- **AWS Amplify**
- **Google Cloud Run**

Make sure to:

1. Set all required environment variables
2. Build the application with `npm run build:prod`
3. Configure the start command as `npm run start`

## ⚙️ Configuration

### AI Providers

Configure AI providers in the Settings → Models & Keys section:

#### Google AI

1. Get your API key from [Google AI Studio](https://makersuite.google.com)
2. Add it in settings or set `GOOGLE_AI_API_KEY` environment variable

#### Groq

1. Get your API key from [Groq Console](https://console.groq.com)
2. Add it in settings or set `GROQ_API_KEY` environment variable

#### OpenRouter

1. Get your API key from [OpenRouter](https://openrouter.ai)
2. Access to 100+ models through a single API

### Customization

T2Chat supports extensive customization:

- **Themes**: Light/dark mode with custom color schemes
- **Fonts**: Choose from multiple font options for main text and code
- **User Profile**: Set your name, role, and personality traits
- **Behavior**: Configure send behavior (Enter vs Ctrl+Enter) and auto-save
- **Speech**: Text-to-speech settings and voice selection

## 📁 Project Structure

```
t2chat/
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── (chat)/            # Chat-related pages and components
│   │   │   └── chat/          # Chat-related pages and components
│   │   │   ├── settings/      # Settings page
│   │   ├── api/               # API routes (auth, chat, uploadthing)
│   │   ├── auth/              # Authentication pages
│   │   ├── _providers/        # Providers for Convex, Better Auth, etc.
│   ├── components/            # React components
│   │   ├── ui/                # UI components (buttons, inputs, etc.)
│   │   └── settings/          # Settings-specific components
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utility libraries and configurations
│   └── styles/               # Global styles and CSS
├── convex/                    # Convex backend functions
│   ├── chat/                 # Chat-related backend functions
│   ├── auth.ts               # Authentication configuration
│   └── schema.ts             # Database schema definitions
├── public/                    # Static assets and images
├── package.json              # Dependencies and npm scripts
├── tailwind.config.ts        # Tailwind CSS configuration
├── next.config.ts            # Next.js configuration
└── README.md                 # This file
```

## Repo Activity

<img width="100%" src="https://repobeats.axiom.co/api/embed/fc05756736554da8ff514b240592deccd7619169.svg" />

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

### Getting Started

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Commit your changes**
   ```bash
   git commit -m 'Add some amazing feature'
   ```
5. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
6. **Open a Pull Request**

### Development Guidelines

- **Code Style**: Use Prettier for formatting (`npm run format`)
- **Linting**: Ensure ESLint passes (`npm run lint`)
- **TypeScript**: Maintain type safety throughout the codebase
- **Testing**: Add tests for new features when applicable
- **Documentation**: Update documentation for significant changes

### Good First Issues

We have a list of [help wanted](https://github.com/nyaughh/t2chat/issues?q=is:issue+is:open+label:%22help+wanted%22) issues that are great for newcomers. These contain features and bugs with limited scope, perfect for getting started.

<!-- LICENSE -->

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

This means you can:

- ✅ Use commercially
- ✅ Modify and distribute
- ✅ Use privately
- ✅ Include in proprietary software

## 🙏 Acknowledgments

Special thanks to these amazing projects which help power T2Chat:

- **[Vercel](https://vercel.com/?utm_source=t2chat&utm_campaign=oss)** - Deployment and AI SDK
- **[Convex](https://convex.dev/?utm_source=t2chat&utm_campaign=oss)** - Real-time backend infrastructure
- **[Better Auth](https://better-auth.com/?utm_source=t2chat&utm_campaign=oss)** - Authentication solution
- **[Radix UI](https://radix-ui.com/?utm_source=t2chat&utm_campaign=oss)** - Accessible UI primitives
- **[Tailwind CSS](https://tailwindcss.com/?utm_source=t2chat&utm_campaign=oss)** - Utility-first CSS framework
- **[OpenAI](https://openai.com/?utm_source=t2chat&utm_campaign=oss)** - AI models and API
- **[OpenRouter](https://openrouter.ai/?utm_source=t2chat&utm_campaign=oss)** - AI model routing

## 📞 Support

If you need help with T2Chat:

1. **Check the documentation** in this README
2. **Search existing issues** on GitHub
3. **Create a new issue** if you found a bug
4. **Start a discussion** for feature requests or questions

---

<div align="center">
  <p>Built by <a href="https://kmrb.tech">kmrb.tech</a></p>
  <p>⭐ Star us on GitHub if `T2Chat` helps you!</p>
</div>
