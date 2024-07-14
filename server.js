const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let gameRooms = {}; // Store game rooms

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('findPlayer', () => {
        let roomFound = false;

        // Check if there's an existing room with one player waiting
        for (let room in gameRooms) {
            if (gameRooms[room].players.length === 1) {
                socket.join(room);
                gameRooms[room].players.push(socket.id);
                io.to(room).emit('playerFound');
                roomFound = true;
                break;
            }
        }

        // If no existing room is found, create a new room
        if (!roomFound) {
            const roomName = `room-${socket.id}`;
            socket.join(roomName);
            gameRooms[roomName] = {
                players: [socket.id],
                playersFinding: new Set(),
                playersReady: new Set(),
                currentPlayerIndex: 0,
                gameStarted: false,
                minePositions: new Set()
            };
            socket.emit('waiting', 'Waiting for another player...');
        }
    });

    socket.on('betMade', () => {
        const room = getRoomByPlayer(socket.id);
    
        if (room && gameRooms[room].playersReady.size < 2) {
            gameRooms[room].playersReady.add(socket.id);
    
            if (gameRooms[room].playersReady.size === 2 && !gameRooms[room].gameStarted) {
                gameRooms[room].minePositions = generateMinePositions();
                io.to(room).emit('startGame', {
                    room: room,
                    mines: Array.from(gameRooms[room].minePositions),
                    playerIds: Array.from(gameRooms[room].players)
                });
                gameRooms[room].gameStarted = true;
                gameRooms[room].currentPlayerIndex = 0;
    
                // Emit turnUpdate for both players based on currentPlayerIndex
                const currentPlayerId = gameRooms[room].players[gameRooms[room].currentPlayerIndex];
                const opponentPlayerId = gameRooms[room].players[1 - gameRooms[room].currentPlayerIndex];
    
                io.to(currentPlayerId).emit('turnUpdate', { isYourTurn: true });
                io.to(opponentPlayerId).emit('turnUpdate', { isYourTurn: false });
            } else {
                io.to(room).emit('waitingBet', 'Waiting for another player to place bet...');
            }
        }
    });
    
    
    // Function to handle cell reveal event
    socket.on('revealCell', (cellIndex) => {
        const room = getRoomByPlayer(socket.id);
    
        if (room && gameRooms[room].players[gameRooms[room].currentPlayerIndex] === socket.id && !gameRooms[room].cellClicked) {
            gameRooms[room].cellClicked = true; // Set flag to indicate cell is being clicked
    
            const isMine = gameRooms[room].minePositions.has(cellIndex);
    
            io.to(room).emit('blinkCell', cellIndex);
            io.to(room).emit('revealCell', { cellIndex, isMine });
    
            if (isMine) {
                handleMineHit(socket.id, room);
            } else {
          
                    gameRooms[room].currentPlayerIndex = (gameRooms[room].currentPlayerIndex + 1) % 2;
                    gameRooms[room].cellClicked = false; // Reset flag after turn is complete
    
                    // Emit turnUpdate for the next player's turn
                    const currentPlayerId = gameRooms[room].players[gameRooms[room].currentPlayerIndex];
                    const opponentPlayerId = gameRooms[room].players[1 - gameRooms[room].currentPlayerIndex];
    
                    io.to(currentPlayerId).emit('turnUpdate', { isYourTurn: true });
                    io.to(opponentPlayerId).emit('turnUpdate', { isYourTurn: false });
               // Delay to simulate player turn
            }
        }
    });
    

    socket.on('allDiamondsFoundByPlayer', () => {
        const room = getRoomByPlayer(socket.id);

        if (room) {
            const currentPlayerId = gameRooms[room].players[gameRooms[room].currentPlayerIndex];
            const opponentPlayerId = gameRooms[room].players[1 - gameRooms[room].currentPlayerIndex];

            const currentPlayerMessage = 'Opponent found all diamonds! Game over.';
            const opponentPlayerMessage = 'You found all diamonds! You won!';

            io.to(currentPlayerId).emit('gameOver', currentPlayerMessage);
            io.to(opponentPlayerId).emit('gameOver', opponentPlayerMessage);

            gameRooms[room].gameStarted = false;
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');

        // Remove the player from their game room
        const room = getRoomByPlayer(socket.id);
        if (room) {
            gameRooms[room].players = gameRooms[room].players.filter(player => player !== socket.id);
            socket.leave(room);

            if (gameRooms[room].players.length < 2) {
                gameRooms[room].gameStarted = false;
                io.to(room).emit('waiting');
                delete gameRooms[room];
            }
        }
    });
});

function generateMinePositions() {
    const minePositions = new Set();
    while (minePositions.size < 2) {
        const randomPos = Math.floor(Math.random() * 25);
        minePositions.add(randomPos);
    }
    return minePositions;
}

function handleMineHit(playerId, room) {
    io.to(room).emit('mineHit');

    const currentPlayerId = gameRooms[room].players[gameRooms[room].currentPlayerIndex];
    const opponentPlayerId = gameRooms[room].players[1 - gameRooms[room].currentPlayerIndex];

    let currentPlayerMessage, opponentPlayerMessage;

    if (currentPlayerId === playerId) {
        currentPlayerMessage = 'You hit a mine! Game over.';
        opponentPlayerMessage = 'Opponent hit a mine! You won!';
    } else {
        currentPlayerMessage = 'Opponent hit a mine! You won!';
        opponentPlayerMessage = 'You hit a mine! Game over.';
    }

    setTimeout(() => {
        io.to(currentPlayerId).emit('gameOver', currentPlayerMessage);
        io.to(opponentPlayerId).emit('gameOver', opponentPlayerMessage);
    }, 2000);

    gameRooms[room].gameStarted = false;
    io.to(room).emit('playSound', 'mine');
}

function getRoomByPlayer(playerId) {
    for (let room in gameRooms) {
        if (gameRooms[room].players.includes(playerId)) {
            return room;
        }
    }
    return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
