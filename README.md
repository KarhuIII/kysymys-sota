# Kysymyssota 🎯

A Finnish question-based battle game built with Svelte 5 and TypeScript. Players progress through different skill levels by answering questions and earning points.

## 🎮 Features

- **5 Skill Levels**: Oppipoika, Taitaja, Mestari, Kuningas, Suurmestari
- **Point System**: 
  - Basic questions: 10 points
  - Difficult questions: 25 points  
  - Grandmaster questions: 50 points
- **Admin Panel**: Read-only interface for question management
- **IndexedDB Storage**: Browser-based data persistence
- **Responsive Design**: Modern UI with glass morphism effects

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or pnpm

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd kysymyssota
```

2. Install dependencies:
```bash
npm install
cd kysymyssota
npm install
```

3. Start the development server:
```bash
cd kysymyssota
npm run dev
```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

## 🏗️ Project Structure

```
kysymyssota/
├── src/
│   ├── lib/
│   │   ├── components/     # Svelte components
│   │   ├── data/          # Question datasets (JSON)
│   │   ├── database/      # IndexedDB management
│   │   └── types.ts       # TypeScript definitions
│   └── main.ts
├── public/
└── package.json
```

## 📚 Question Levels

- **Oppipoika** - Beginner level questions
- **Taitaja** - Skilled level questions  
- **Mestari** - Master level questions
- **Kuningas** - King level questions
- **Suurmestari** - Grandmaster level questions

## 🛠️ Built With

- [Svelte 5](https://svelte.dev/) - Frontend framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Vite](https://vitejs.dev/) - Build tool
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) - Client-side storage

## 🎯 Game Mechanics

Players earn points by correctly answering questions:
- Each question has a base point value (10, 25, or 50)
- Points accumulate across game sessions
- Progress is saved automatically in the browser

## 🔧 Development

### Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Adding Questions

Questions are stored in JSON files in `src/lib/data/`. Each question follows this structure:

```json
{
  "kysymys": "Question text?",
  "vastausvaihtoehdot": ["A", "B", "C", "D"],
  "oikea_vastaus": "A",
  "pistemaara_perus": 10
}
```

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

Made with ❤️ using Svelte 5