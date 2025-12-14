const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { createClient } = require('redis');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const redisClient = createClient({ url: 'redis://redis:6379' });
redisClient.on('error', (err) => console.log('Redis Client Error', err));

// --- GAME STATE ---
const games = {}; 
const socketRooms = {}; 

// --- UTILITIES ---
function makeId(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < length; i++) result += characters.charAt(Math.floor(Math.random() * characters.length));
    return result;
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function decodeHTMLEntities(text) {
    return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// --- API FETCH ---
async function fetchQuestions(categoryId) {
    try {
        const url = `https://opentdb.com/api.php?amount=10&category=${categoryId}&type=multiple`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            return data.results.map(q => {
                let allOptions = [...q.incorrect_answers, q.correct_answer];
                allOptions = shuffle(allOptions);
                return {
                    q: decodeHTMLEntities(q.question),
                    options: allOptions.map(opt => decodeHTMLEntities(opt)),
                    answer: decodeHTMLEntities(q.correct_answer)
                };
            });
        }
        return [];
    } catch (error) {
        console.error("Fetch Error:", error);
        return [];
    }
}

async function startServer() {
    await redisClient.connect();

    io.on('connection', (socket) => {
        
        // 1. LOGIN
        socket.on('login', async (data) => {
            const username = data.username.trim().toLowerCase();
            const password = data.password;
            const storedPassword = await redisClient.hGet('users', username);

            if (!storedPassword) {
                await redisClient.hSet('users', username, password);
                socket.emit('login_success', { username });
            } else if (storedPassword === password) {
                socket.emit('login_success', { username });
            } else {
                socket.emit('login_error', "Incorrect Password.");
            }
        });

        // 2. HISTORY
        socket.on('get_history', async (username) => {
            const safeName = username.toLowerCase();
            const history = await redisClient.lRange(`history:${safeName}`, 0, -1);
            const parsed = history.map(item => JSON.parse(item));
            socket.emit('history_data', parsed);
        });

        // 3. CREATE GAME
        socket.on('create_game', async (data) => {
            const roomCode = makeId(4);
            games[roomCode] = {
                id: roomCode,
                players: [{ id: socket.id, name: data.username, score: 0 }],
                category: data.category,
                questions: [],
                qIndex: 0,
                timeLeft: 15,
                interval: null,
                isRunning: false
            };
            socketRooms[socket.id] = roomCode;
            socket.join(roomCode);
            socket.emit('game_created', { roomCode });
            socket.emit('waiting_message', `Room Code: ${roomCode} - Waiting for players...`);
        });

        // 4. JOIN GAME 
        socket.on('join_game', async (data) => {
            const roomCode = data.roomCode;
            const room = games[roomCode];

            if (!room) { socket.emit('error_message', "Room not found!"); return; }
            
            // Add player
            room.players.push({ id: socket.id, name: data.username, score: 0 });
            socketRooms[socket.id] = roomCode;
            socket.join(roomCode);

            // Update player list for everyone
            io.to(roomCode).emit('leaderboard_update', room.players);

            if (room.players.length >= 2 && !room.isRunning) {
                io.to(roomCode).emit('waiting_message', "Players found! Fetching questions...");
                const q = await fetchQuestions(room.category);
                if(q.length > 0) {
                    room.questions = q;
                    startGame(roomCode);
                } else {
                    io.to(roomCode).emit('error_message', "API Error.");
                }
            } 
            else if (room.isRunning) {
                socket.emit('game_status', { status: 'started' });
                
                const currentQ = room.questions[room.qIndex];
                // Send the current question
                socket.emit('new_question', { 
                    q: currentQ.q, 
                    options: currentQ.options, 
                    number: room.qIndex + 1 
                });
                // Send remaining time for synchronization
                socket.emit('timer_update', room.timeLeft);
            }
        });

        // 5. ANSWER
        socket.on('submit_answer', (data) => {
            const roomCode = socketRooms[socket.id];
            const room = games[roomCode];
            if(!room || !room.isRunning) return;

            const currentQ = room.questions[room.qIndex];
            const isCorrect = (data.answer === currentQ.answer);

            socket.emit('answer_result', { correct: isCorrect, correctAnswer: currentQ.answer });

            if (isCorrect) {
                const player = room.players.find(p => p.id === socket.id);
                if(player) player.score += 10;
                io.to(roomCode).emit('leaderboard_update', room.players);
            }
        });

        socket.on('disconnect', () => {
            const roomCode = socketRooms[socket.id];
            if (roomCode && games[roomCode]) {
                const room = games[roomCode];
                room.players = room.players.filter(p => p.id !== socket.id);
                
                if (room.players.length === 0) {
                    clearInterval(room.interval);
                    delete games[roomCode];
                }
            }
            delete socketRooms[socket.id];
        });
    });

    server.listen(3000, () => console.log('SERVER RUNNING ON PORT 3000'));
}

function startGame(roomCode) {
    const room = games[roomCode];
    room.isRunning = true;
    room.qIndex = 0;
    io.to(roomCode).emit('game_status', { status: 'started' });
    sendNewQuestion(roomCode);

    room.interval = setInterval(() => {
        room.timeLeft--;
        if (room.timeLeft <= 0) {
            room.qIndex++;
            if(room.qIndex >= room.questions.length) endGame(roomCode);
            else sendNewQuestion(roomCode);
        }
        io.to(roomCode).emit('timer_update', room.timeLeft);
    }, 1000);
}

function sendNewQuestion(roomCode) {
    const room = games[roomCode];
    room.timeLeft = 15;
    const q = room.questions[room.qIndex];
    io.to(roomCode).emit('new_question', { q: q.q, options: q.options, number: room.qIndex + 1 });
    io.to(roomCode).emit('leaderboard_update', room.players);
}

async function endGame(roomCode) {
    const room = games[roomCode];
    if(!room) return;
    clearInterval(room.interval);
    room.isRunning = false;

    // Sort players for the podium
    room.players.sort((a, b) => b.score - a.score);

    // Save history for EACH player with their rank
    for (let i = 0; i < room.players.length; i++) {
        const p = room.players[i];
        await saveToHistory(p, i + 1, room.players.length);
    }

    io.to(roomCode).emit('game_over', room.players);
    delete games[roomCode];
}

async function saveToHistory(player, rank, totalPlayers) {
    const record = JSON.stringify({
        date: new Date().toLocaleTimeString(),
        opponent: `Battle Royale (${totalPlayers} players)`,
        score: player.score,
        result: `Rank #${rank}`
    });
    await redisClient.lPush(`history:${player.name.toLowerCase()}`, record);
}

startServer();