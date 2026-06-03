export const BOILERPLATE_TEMPLATES = {
  'react': [
    {
      name: 'App.jsx',
      path: 'src/App.jsx',
      content: `export default function App() {
  return (
    <div className="App">
      <h1>Hello from CodeSync React Workspace!</h1>
      <h2>Start editing to see some magic happen!</h2>
    </div>
  );
}
`
    },
    {
      name: 'index.js',
      path: 'src/index.js',
      content: `import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import App from "./App";

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
`
    },
    {
      name: 'styles.css',
      path: 'src/styles.css',
      content: `.App {
  font-family: sans-serif;
  text-align: center;
}
`
    },
    {
      name: 'index.html',
      path: 'public/index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React App</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
`
    },
    {
      name: 'package.json',
      path: 'package.json',
      content: `{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-scripts": "^5.0.0"
  },
  "main": "/src/index.js"
}
`
    }
  ],
  'node-web': [
    {
      name: 'index.js',
      path: 'index.js',
      content: `const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello from Node.js (Express)!');
});

app.listen(port, () => {
  console.log(\`App listening on port \${port}\`);
});
`
    },
    {
      name: 'package.json',
      path: 'package.json',
      content: `{
  "dependencies": {
    "express": "^4.19.2"
  },
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  }
}
`
    }
  ],
  'vanilla-web': [
    {
      name: 'index.html',
      path: 'index.html',
      content: `<!DOCTYPE html>
<html>
<head>
  <title>Vanilla Web</title>
  <link rel="stylesheet" href="styles.css" />
  <script src="index.js" defer></script>
</head>
<body>
  <div id="app">
    <h1>Vanilla Web Project</h1>
    <div>Start building your plain HTML/CSS/JS site!</div>
  </div>
</body>
</html>
`
    },
    {
      name: 'index.js',
      path: 'index.js',
      content: `import "./styles.css";

document.getElementById("app").innerHTML += "<p>JavaScript is running!</p>";
`
    },
    {
      name: 'styles.css',
      path: 'styles.css',
      content: `body {
  font-family: sans-serif;
}
`
    }
  ],
  'javascript': [
    {
      name: 'main.js',
      path: 'main.js',
      content: `console.log("Hello, World!");\n`
    }
  ],
  'python': [
    {
      name: 'main.py',
      path: 'main.py',
      content: `print("Hello, World!")\n`
    }
  ],
  'java': [
    {
      name: 'Main.java',
      path: 'Main.java',
      content: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
`
    }
  ],
  'cpp': [
    {
      name: 'main.cpp',
      path: 'main.cpp',
      content: `#include <iostream>

int main() {
    std.cout << "Hello, World!" << std::endl;
    return 0;
}
`
    }
  ],
  'c': [
    {
      name: 'main.c',
      path: 'main.c',
      content: `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}
`
    }
  ],
  'go': [
    {
      name: 'main.go',
      path: 'main.go',
      content: `package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}
`
    }
  ],
  'ruby': [
    {
      name: 'main.rb',
      path: 'main.rb',
      content: `puts "Hello, World!"\n`
    }
  ]
};

export const getBoilerplateForLanguage = (language) => {
  const langKey = language?.toLowerCase() || 'plaintext';
  return BOILERPLATE_TEMPLATES[langKey] || [];
};
