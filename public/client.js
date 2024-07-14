


const socket = io();
let findButtonClicked = false;
let myTurn = false;
let gameEnded = true;
let waitingForBet = true;
let minePositions = new Set();
let gameId;
const totalCells = 25;
const minesCount = 2;
const clickSound = new Audio('click-sound.mp3');
const mineSound = new Audio('mine-sound.mp3');
const diamondSound = new Audio('diamond-sound.mp3');
const minesWrap = document.getElementById('minesWrap');
const betButton = document.getElementById('betButton');
const betButton2 = document.getElementById('betButton2');
const betButton3 = document.getElementById('betButton3');
const betAmountInput = document.getElementById('betAmount');
const resultMessage = document.getElementById('resultMessage');
let balance = 100;
updateBalanceDisplay();

document.getElementById('waitingMessage').style.display = 'block'; // Display the initial waiting message
document.getElementById('waitingMessage').textContent = 'Click find button';

socket.on('connect', () => {
    console.log('Connected to server');
});

document.getElementById('findButton').addEventListener('click', () => {
    if (!findButtonClicked) {
        findButtonClicked = true;
        socket.emit('findPlayer');
        document.getElementById('waitingMessage').style.display = 'block'; // Display the waiting message
        document.getElementById('waitingMessage').textContent = 'Waiting for another player...'; // Update the waiting message
    }
});

socket.on('waiting', (message) => {
    if (findButtonClicked) {
        console.log('Waiting for another player...');
        document.getElementById('gameContainer').style.display = 'none'; // Hide the game container
        document.getElementById('waitingMessage').style.display = 'block'; // Display the waiting message
        document.getElementById('waitingMessage').textContent = message || 'Waiting for another player...';
    }
});

socket.on('playerFound', () => {
    if (findButtonClicked) {
        console.log('Player found, waiting for game to start...');
        document.getElementById('waitingMessage').style.display = 'none'; // Hide the waiting message
        document.getElementById('gameContainer').style.display = 'block'; // Show the game container
        resultMessage.textContent = 'Place bet to start the game...'; // Update result message
    }
});

socket.on('startGame', ({ room, mines, playerIds }) => {
    if (findButtonClicked) {
        console.log('Game started in room:', room);
        socket.emit('joinRoom', room); // Join the room for this game session
        minePositions = new Set(mines); // Set mine positions received from server
        resultMessage.textContent = 'Game started!'; // Update result message
        gameEnded = false; // Reset gameEnded flag if needed

        // Determine if it's your turn based on your player ID
        myTurn = playerIds[0] === socket.id;
        if (myTurn) {
            updateStatus("Your turn!");
            document.body.style.backgroundColor = "#0f1b2e";
        } else {
            updateStatus("Opponent's turn");
            document.body.style.backgroundColor = "#0f212e";
        }

        // You may start your game logic here or handle it based on client interactions
    }
});



socket.on('playerCount', (count) => {
    console.log(`Current player count: ${count}`);
    if (count < 2) {
        socket.emit('findPlayer'); // Automatically initiate finding player if less than 2
    }
});

// Handle other socket events as before...

socket.on('turnUpdate', ({ isYourTurn }) => {
    setTimeout(() => {
        myTurn = isYourTurn;
        if (isYourTurn) {
            updateStatus("Your turn!");
            document.body.style.backgroundColor = "#0f1b2e";
        } else {
            updateStatus("Opponent's turn");
            document.body.style.backgroundColor = "#0f212e";
        }

        // Check win condition when it's the player's turn
        if (isYourTurn) {
            checkWinCondition();
        }
    }, 2000); // Adjust delay as needed (milliseconds)
});


socket.on('blinkCell', (cellIndex) => {
    const button = document.querySelectorAll('.mines-blk')[cellIndex];
    button.classList.add('blink');
});

socket.on('revealCell', ({ cellIndex, isMine }) => {
    const button = document.querySelectorAll('.mines-blk')[cellIndex];
    const img = button.querySelector('img');

    // Add a class to initiate the reveal animation
    button.classList.add('revealing');

    setTimeout(() => {
        if (isMine) {
            img.src = 'mine.png';
            img.alt = 'Mine';
            img.style.display = 'block';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.margin = 'auto';
            button.style.opacity = 1; // Ensure full opacity
            button.classList.add('revealed');
            mineSound.play();
        } else {
            img.src = 'diamond.png';
            img.alt = 'Diamond';
            img.style.display = 'block';
            img.style.margin = 'auto';
            button.classList.add('revealed');
            button.disabled = true;
            diamondSound.play();
        }

        // Remove the class after the animation completes
        setTimeout(() => {
            button.classList.remove('revealing');
        }, 1000); // Adjust timing as needed
    }, 2000); // Delay to synchronize with animation and sound effects

    // Disable the revealed button
    disableRevealedButton(cellIndex);
});




socket.on('mineHit', () => {
    revealAll();
});

socket.on('gameOver', (message) => {
    updateStatus(message); // Function to update game status message
    gameEnded = true;
    io.emit('gameOver'); // Update game state if needed
});


function updateStatus(message) {
    document.getElementById('resultMessage').innerText = message;
}

function createButtons() {
    minesWrap.innerHTML = '';
    for (let i = 0; i < totalCells; i++) {
        const button = document.createElement('button');
        button.classList.add('mines-blk');
        button.dataset.index = i; // Store the cell index

        const img = document.createElement('img');
        img.style.display = 'none'; // Hide the image initially

        button.appendChild(img);
        button.addEventListener('click', () => handleClick(i));
        minesWrap.appendChild(button);
    }
}

function revealAll(withDelay = true) {
    const buttons = document.querySelectorAll('.mines-blk');
    buttons.forEach((button, index) => {
        const img = button.querySelector('img');
        const revealFunction = () => {
            if (!img.src) {
                if (minePositions.has(index)) {
                    img.src = 'mine.png';
                    img.alt = 'Mine';
                } else {
                    img.src = 'diamond.png';
                    img.alt = 'Diamond';
                }
                img.style.display = 'block';
                button.style.backgroundColor = '#071723';
                img.style.width = '70%';
                img.style.height = '70%';
                img.style.margin = 'auto';
                button.style.opacity = 0.5; 
            }
            img.style.display = 'block';
            button.classList.add('revealed');
        };

        if (withDelay) {
            setTimeout(revealFunction, 2000);
        } else {
            revealFunction();
        }
    });
}


function handleClick(index) {
    if (!myTurn || gameEnded) return; // Only proceed if it's the player's turn and the game hasn't ended
    myTurn = false; // Immediately set myTurn to false to prevent multiple clicks

    const button = document.querySelectorAll('.mines-blk')[index];

    // Check if this cell has already been revealed
    if (button.classList.contains('revealed')) return;

    button.classList.add('blink');

    // Emit revealCell event to the server immediately
    socket.emit('revealCell', index);

    const img = button.querySelector('img');

    if (minePositions.has(index)) {
        // Player clicked on a mine
        setTimeout(() => {
            mineSound.play();

            img.src = 'mine.png';
            img.alt = 'Mine';
            img.style.display = 'block';

            updateStatus('You hit a mine! Game over.');

            revealAll(true); // Reveal all with delay when a mine is hit
            disableAllButtons();
            gameEnded = true;
            // Delay to allow animation to complete
        }, 2000); // Delay to play sound after a brief interval
    } else {
        // Player clicked on a diamond
        setTimeout(() => {
            diamondSound.play();

            img.src = 'diamond.png';
            img.alt = 'Diamond';
            img.style.display = 'block';
            button.classList.add('revealed');
            button.disabled = true;
            button.classList.remove('blink');

            // Check win condition after revealing the diamond
            if (checkWinCondition()) {
                socket.emit('allDiamondsFoundByPlayer');
            }
            
            // Delay to allow animation to complete
        }, 2000); // Delay to play sound after a brief interval
    }
}




function checkAllDiamondsRevealedByPlayer() {
    const buttons = document.querySelectorAll('.mines-blk');
    for (let button of buttons) {
        const index = button.dataset.index;
        if (!minePositions.has(Number(index)) && !button.classList.contains('revealed')) {
            // This is a diamond cell that hasn't been revealed yet
            return false;
        }
    }
    return true;
}


function checkWinCondition() {
    const buttons = document.querySelectorAll('.mines-blk');
    let unrevealedCells = 0;

    for (let button of buttons) {
        if (!button.classList.contains('revealed')) {
            unrevealedCells++;
        }
    }

    if (checkAllDiamondsRevealedByPlayer()) {
        const message = "Opponent found all diamonds! Game over."; // Reverse the message for all diamonds revealed
        updateStatus(message);
        disableAllButtons();
        gameEnded = true;
        revealAll(false); // Reveal all instantly when all diamonds are found
        socket.emit('gameOver', message); // Emit game over event
        return true;
    }

    if (unrevealedCells === minePositions.size) {
        const message = "You found all diamonds! You won!"; // Reverse the message for unrevealed cells
        updateStatus(message);
        disableAllButtons();
        gameEnded = true;
        revealAll(false); // Reveal all instantly when all diamonds are found
        socket.emit('gameOver', message); // Emit game over event
        return true;
    }

    return false;
}


function disableAllButtons() {
    const buttons = document.querySelectorAll('.mines-blk');
    buttons.forEach(button => button.disabled = true);
}

function revealAll(withDelay = true) {
    const buttons = document.querySelectorAll('.mines-blk');
    buttons.forEach((button, index) => {
        const img = button.querySelector('img');
        const revealFunction = () => {
            if (!img.src) {
                if (minePositions.has(index)) {
                    img.src = 'mine.png';
                    img.alt = 'Mine';
                } else {
                    img.src = 'diamond.png';
                    img.alt = 'Diamond';
                }
                img.style.display = 'block';
                button.style.backgroundColor = '#071723';
                img.style.width = '70%';
                img.style.height = '70%';
                img.style.margin = 'auto';
                button.style.opacity = 0.5; 
            }
            img.style.display = 'block';
            button.classList.add('revealed');
        };

        if (withDelay) {
            setTimeout(revealFunction, 2000);
        } else {
            revealFunction();
        }
    });
}



// Function to check if both players have clicked the bet button
function checkStartGame() {
    // Add the current player's socket.id to playersReady set
    playersReady.add(socket.id);
    socket.emit('playerReady'); // Notify server that the player is ready

    // Listen for 'bothPlayersReady' event from server
    socket.on('bothPlayersReady', () => {
        // Disable bet buttons and update result message
        disableBetButtons();
        resultMessage.textContent = 'Both players are ready. Game starting...';

        // Emit 'startGame' event to server to start the game
        socket.emit('startGame');

    });
}

function enableBetButtons() {
    betButton.disabled = false;
    betButton.style.opacity = 1;
  
}

// Function to disable bet buttons after a bet is made
function disableBetButtons() {
    betButton.disabled = true;
    betButton.style.opacity = 0.5;
  
}


getBetButton().addEventListener('click', checkStartGame);
// Function to get the bet button element
function getBetButton() {
    return document.getElementById('betButton');
}

// Updated bet button click event listener
getBetButton().addEventListener('click', () => {
    clickSound.play();

    const betAmount = parseFloat(betAmountInput.value);
    if (isNaN(betAmount) || betAmount <= 0) {
        resultMessage.textContent = 'Please enter a valid bet amount.';
        return;
    }
    if (betAmount > balance) {
        resultMessage.textContent = 'Insufficient balance.';
        return;
    }

    balance -= betAmount;
    updateBalanceDisplay();
    resultMessage.textContent = 'Waiting for opponent to place bet...';

    // Emit 'betMade' event to server to notify bet is made
    socket.emit('betMade');

    // Disable bet buttons after bet is made
    disableBetButtons();
});

betButton2.addEventListener('click', () => {
    balance += 10;
    updateBalanceDisplay();
});

function updateBalanceDisplay() {
    const balanceText = document.querySelector('.text');
    balanceText.textContent = `₹ ${balance}`;
    localStorage.setItem('balance', balance);
}

function loadBalanceFromLocalStorage() {
    const storedBalance = localStorage.getItem('balance');
    if (storedBalance !== null) {
        balance = parseFloat(storedBalance);
    }
}

loadBalanceFromLocalStorage();
updateBalanceDisplay();
createButtons();




