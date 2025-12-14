# 👑 Container Royale

> **A real-time, multiplayer trivia battle platform built on a Microservices Architecture.**

![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)
![Nginx](https://img.shields.io/badge/nginx-%23009639.svg?style=for-the-badge&logo=nginx&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)

## 📖 Overview

**Container Royale** is a proof-of-concept application demonstrating the power of **Containerization** and **Orchestration**. 

Unlike traditional monolithic applications, this project is designed as a distributed system. It splits the User Interface, Game Logic, and Data Storage into three distinct microservices that communicate over an internal Docker Bridge Network.

The game allows players to join rooms, compete in real-time trivia battles, and track their rankings via a persistent history system.

---

## 🏗️ Architecture & Technologies

The application runs on **3 Orchestrated Containers**:

### 1. Frontend Service (The Client)
*   **Technology:** Nginx (Alpine Linux) + HTML5/CSS3/Vanilla JS.
*   **Role:** Serves the static user interface.
*   **Networking:** Exposed on Port `9000`. Connects to the Backend via WebSocket.

### 2. Backend Service (The Brain)
*   **Technology:** Node.js (v18) + Express + Socket.io.
*   **Role:** Manages game state, room creation, timers, and connects to the Open Trivia Database API.
*   **Networking:** Exposed on Port `3000`.

### 3. Database Service (The Memory)
*   **Technology:** Redis (Alpine).
*   **Role:** High-performance In-Memory Key-Value store.
*   **Function:** 
    *   **Authentication:** Stores Usernames/Passwords via Hashes.
    *   **Persistence:** Stores Match History via Lists (`lPush`).
*   **Data Safety:** Uses **Docker Volumes** (`redis_data`) to persist data on the host machine, ensuring no data loss upon container restart.

---

## ✨ Key Features

*   **Microservices Architecture:** Fully containerized environment using `docker-compose`.
*   **Real-Time Gameplay:** Bidirectional, event-driven communication using Socket.io (Zero page reloads).
*   **Room System:** 
    *   **Host:** Creates a room and generates a unique 4-character code (e.g., `X7B2`).
    *   **Join:** Opponents enter the code to join the specific lobby.
*   **Dynamic Content:** Integated with the **OpenTDB API** to fetch unique questions for categories like Sports, History, and Tech.
*   **Data Persistence:** User accounts and game history are saved to disk via Named Volumes.
*   **Live Feedback:** Instant visual feedback (Green/Red) and live leaderboard updates.

---

## 🚀 How to Run locally

### Prerequisites
*   **Docker Desktop** installed on your machine.
*   **Git** installed.

### Installation Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Hsan-Kh/container-royale.git
    cd container-royale
    ```

2.  **Start the cluster:**
    This command downloads the images, builds the containers, and creates the network.
    ```bash
    docker-compose up --build
    ```

3.  **Access the application:**
    *   🎮 **Game Interface:** Open `http://localhost:9000` in your browser.
    *   🗄️ **Database Viewer:** Open `http://localhost:8081` to access Redis Commander.

---

## 📂 Project Structure

```text
container-royale/
├── docker-compose.yml   # The Orchestrator (Defines services, networks, volumes)
│
├── backend/             # Service 1: Node.js Server
│   ├── Dockerfile       # Instructions to build the Node image
│   ├── package.json     # Dependencies (Socket.io, Redis Client)
│   └── server.js        # Core Game Logic (Rooms, API, Events)
│
└── frontend/            # Service 2: Nginx Client
    ├── Dockerfile       # Instructions to build the Nginx image
    └── index.html       # The Game UI & Socket Client Logic
```

---


## 👥 Authors

This academic project was developed for the **Virtualization and Cloud** course at Faculty of Sciences of Sfax (FSS).

*   **Hsan KHECHAREM / Eya JMAL / Moez JEDIDI**
