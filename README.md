# Compiler Service

A compiler service for the final project at HCMC University of Technology and Education.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

This service provides a secure and scalable code compilation environment using Docker containers. It supports multiple programming languages and is designed for online judge systems or coding platforms.

## ✨ Features

- Multi-language support (C, C++, Java, Python, etc.)
- Isolated execution environment using Docker
- Secure code execution with resource limits
- RESTful API interface
- Real-time compilation results
- Error handling and detailed feedback

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 22 or higher
  ```bash
  node --version  # Should be v22.x.x or higher
  ```

- **Docker**: Latest stable version
  ```bash
  docker --version
  ```

- **Docker Compose**: Latest stable version
  ```bash
  docker-compose --version
  ```

## 🚀 Installation

Follow these steps to set up the project:

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd <repository-name>
```

### 2. Build the compiler Docker image

```bash
docker build -t compiler-service ./oj
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration (see [Configuration](#configuration) section).

### 5. Start the service

```bash
docker-compose up -d
```

## 💻 Usage

### Starting the service

```bash
# Development mode
npm run dev

# Production mode
npm start

# Using Docker Compose
docker-compose up
```

### Stopping the service

```bash
# Stop containers
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Viewing logs

```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs compiler-service

# Follow logs
docker-compose logs -f
```

## 📚 API Documentation

### Compile Code

**Endpoint:** `POST /api/compile`

**Request Body:**
```json
{
  "language": "cpp",
  "code": "#include <iostream>\nint main() { std::cout << \"Hello World\"; return 0; }",
  "input": "",
  "timeLimit": 5000,
  "memoryLimit": 512
}
```

**Response:**
```json
{
  "success": true,
  "output": "Hello World",
  "executionTime": 234,
  "memoryUsed": 128,
  "error": null
}
```

### Supported Languages
**NOW**:
- C++ (`cpp`)
**FUTURE**
- C (`c`)
- Java (`java`)
- Python (`python`)
- JavaScript (`javascript`)

## 🛠️ Development

### Project Structure

```
.
├── oj/                 # Compiler Docker configuration
│   ├── Dockerfile
│   └── ...
├── src/               # Source code
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   └── utils/
├── tests/             # Test files
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── package.json
└── README.md
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Your Name** - *Initial work* - HCMC University of Technology and Education

## 🙏 Acknowledgments

- HCMC University of Technology and Education
- [List any libraries, tools, or resources you used]

---

**Note:** This is a student project developed as part of the final project at HCMC University of Technology and Education.
```
