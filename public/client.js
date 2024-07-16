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
const resultMessage = document.getElementById('resultMessage');
const betButton = document.querySelector('.betting-menu #betButton');
let balance = 100;
disableBetButton();
document.getElementById('waitingMessage').style.display = 'block';
document.getElementById('waitingMessage').textContent = 'Click find button';

socket.on('connect', () => {
    console.log('Connected to server');
});

document.querySelector('.betting-menu #findButton').addEventListener('click', () => {
    if (!findButtonClicked) {
        findButtonClicked = true;
        socket.emit('findPlayer');
        const waitingMessage = document.getElementById('waitingMessage');
        waitingMessage.style.display = 'block';
        waitingMessage.textContent = 'Waiting for another player...';
    
    }
});


socket.on('waiting', (message) => {
    if (findButtonClicked) {
        console.log('Waiting for another player...');
        document.getElementById('gameContainer').style.display = 'none';
        document.getElementById('waitingMessage').style.display = 'block';
        document.getElementById('waitingMessage').textContent = message || 'Waiting for another player...';
    }
});

socket.on('playerFound', () => {
    if (findButtonClicked) {
        console.log('Player found, waiting for game to start...');
        document.getElementById('waitingMessage').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'block';
        resultMessage.textContent = 'Place bet to start the game...';
        enableBetButton();
    }
});
socket.on('startGame', ({ room, mines, playerIds }) => {
    if (findButtonClicked) {
        console.log('Game started in room:', room);
        socket.emit('joinRoom', room);
        minePositions = new Set(mines);
        resultMessage.textContent = 'Game started!';
        gameEnded = false;

        myTurn = playerIds[0] === socket.id;
        if (myTurn) {
            updateStatus("Your turn!");
            document.body.style.backgroundColor = "#0f1b2e";
        } else {
            updateStatus("Opponent's turn");
            document.body.style.backgroundColor = "#0f212e";
        }
    }
});

socket.on('playerCount', (count) => {
    console.log(`Current player count: ${count}`);
    if (count < 2) {
        socket.emit('findPlayer');
    }
});

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

        if (isYourTurn) {
            checkWinCondition();
        }
    }, 1000);
});

socket.on('blinkCell', (cellIndex) => {
    const button = document.querySelectorAll('.mines-blk')[cellIndex];
    button.classList.add('blink');
});

socket.on('revealCell', ({ cellIndex, isMine }) => {
    const button = document.querySelectorAll('.mines-blk')[cellIndex];
    const img = button.querySelector('img');

    button.classList.add('revealing');

    setTimeout(() => {
        if (isMine) {
            img.src = 'mine.png';
            img.alt = 'Mine';
            img.style.display = 'block';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.margin = 'auto';
            button.style.opacity = 1;
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

        setTimeout(() => {
            button.classList.remove('revealing');
        }, 1000);
    }, 1000);

    disableRevealedButton(cellIndex);
});

socket.on('mineHit', () => {
    revealAll();
});

socket.on('gameOver', (message) => {
    updateStatus(message);
    gameEnded = true;
    socket.emit('gameOver');
});

function updateStatus(message) {
    document.getElementById('resultMessage').innerText = message;
}

function createButtons() {
    minesWrap.innerHTML = '';
    for (let i = 0; i < totalCells; i++) {
        const button = document.createElement('button');
        button.classList.add('mines-blk');
        button.dataset.index = i;

        const img = document.createElement('img');
        img.style.display = 'none';

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
            setTimeout(revealFunction, 1000);
        } else {
            revealFunction();
        }
    });
}

function handleClick(index) {
    if (!myTurn || gameEnded) return;
    myTurn = false;

    const button = document.querySelectorAll('.mines-blk')[index];

    if (button.classList.contains('revealed')) return;

    button.classList.add('blink');

    socket.emit('revealCell', index);

    const img = button.querySelector('img');

    if (minePositions.has(index)) {
        setTimeout(() => {
            mineSound.play();

            img.src = 'mine.png';
            img.alt = 'Mine';
            img.style.display = 'block';

            updateStatus('You hit a mine! Game over.');

            revealAll(true);
            disableAllButtons();
            gameEnded = true;
        }, 1000);
    } else {
        setTimeout(() => {
            diamondSound.play();

            img.src = 'diamond.png';
            img.alt = 'Diamond';
            img.style.display = 'block';
            button.classList.add('revealed');
            button.disabled = true;
            button.classList.remove('blink');

            if (checkWinCondition()) {
                socket.emit('allDiamondsFoundByPlayer');
            }
        }, 1000);
    }
}

function checkAllDiamondsRevealedByPlayer() {
    const buttons = document.querySelectorAll('.mines-blk');
    for (let button of buttons) {
        const index = button.dataset.index;
        if (!minePositions.has(Number(index)) && !button.classList.contains('revealed')) {
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
        const message = "Opponent found all diamonds! Game over.";
        updateStatus(message);
        disableAllButtons();
        gameEnded = true;
        revealAll(false);
        socket.emit('gameOver', message);
        return true;
    }

    if (unrevealedCells === minePositions.size) {
        const message = "You found all diamonds! You won!";
        updateStatus(message);
        disableAllButtons();
        gameEnded = true;
        revealAll(false);
        socket.emit('gameOver', message);
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
            setTimeout(revealFunction, 1000);
        } else {
            revealFunction();
        }
    });
}
function enableBetButton() {
    betButton.disabled = false;
    betButton.style.opacity = 1;
}

function disableBetButton() {
    betButton.disabled = true;
    betButton.style.opacity = 0.5;
}


betButton.addEventListener('click', () => {
    clickSound.play();

    const betAmountElement = document.querySelector('.bet-header .bet-total');
    const betAmountText = betAmountElement.textContent;
    const betAmount = parseFloat(betAmountText.replace(/[^\d.-]/g, ''));

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

    socket.emit('betMade');
    disableBetButton();
});

function checkStartGame() {
    playersReady.add(socket.id);
    socket.emit('playerReady');

    socket.on('bothPlayersReady', () => {
        disableBetButton();
        resultMessage.textContent = 'Both players are ready. Game starting...';
        socket.emit('startGame');
    });
}

betButton.addEventListener('click', () => {
    balance = balance - 10;
    updateBalanceDisplay();
});

function updateBalanceDisplay() {
    const balanceText = document.querySelector('.balance-box .balance');
    balanceText.textContent = `₹ ${balance}`;
    localStorage.setItem('balance', balance);
}

function loadBalanceFromLocalStorage() {
    const storedBalance = localStorage.getItem('balance');
    if (storedBalance !== null) {
        balance = parseFloat(storedBalance);
    } else {
        const initialBalanceText = document.querySelector('.balance-box .balance').textContent;
        balance = parseFloat(initialBalanceText.replace(/[^\d.-]/g, ''));
    }
}

loadBalanceFromLocalStorage();
updateBalanceDisplay();
createButtons();
