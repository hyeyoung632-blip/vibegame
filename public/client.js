// Socket.IO 클라이언트 연결
const socket = io();

// 게임 상태 변수
let gameState = {
    myNickname: '',
    isHost: false,
    myBoard: null,
    players: [],
    calledNumbers: [],
    gameStatus: 'waiting'
};

// DOM 요소 참조
const loginScreen = document.getElementById('loginScreen');
const gameScreen = document.getElementById('gameScreen');
const nicknameInput = document.getElementById('nicknameInput');
const joinBtn = document.getElementById('joinBtn');
const myNicknameElement = document.getElementById('myNickname');
const hostBadge = document.getElementById('hostBadge');
const myBoardElement = document.getElementById('myBoard');
const playersListElement = document.getElementById('playersList');
const calledNumbersElement = document.getElementById('calledNumbers');
const currentNumberElement = document.getElementById('currentNumber');
const startGameBtn = document.getElementById('startGameBtn');
const drawNumberBtn = document.getElementById('drawNumberBtn');
const restartGameBtn = document.getElementById('restartGameBtn');
const hostControls = document.getElementById('hostControls');
const bingoModal = document.getElementById('bingoModal');
const winnerMessage = document.getElementById('winnerMessage');
const closeModalBtn = document.getElementById('closeModalBtn');
const playerBoardModal = document.getElementById('playerBoardModal');
const modalPlayerName = document.getElementById('modalPlayerName');
const modalPlayerBoard = document.getElementById('modalPlayerBoard');
const closeBoardModalBtn = document.getElementById('closeBoardModalBtn');

/**
 * 닉네임 입력 후 입장 버튼 클릭 이벤트
 */
joinBtn.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    if (nickname === '') {
        alert('닉네임을 입력해주세요.');
        return;
    }
    
    socket.emit('join', { nickname });
});

/**
 * 엔터 키로도 입장 가능하도록 처리
 */
nicknameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinBtn.click();
    }
});

/**
 * 내 빙고판을 렌더링하는 함수
 */
function renderMyBoard() {
    if (!gameState.myBoard) {
        myBoardElement.innerHTML = '<p style="text-align: center; padding: 20px;">게임이 시작되면 빙고판이 표시됩니다.</p>';
        return;
    }
    
    myBoardElement.innerHTML = '';
    
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
            const cell = document.createElement('div');
            cell.className = 'bingo-cell';
            
            const cellData = gameState.myBoard[i][j];
            
            if (cellData.marked) {
                cell.classList.add('marked');
            }
            
            // 내 보드는 숫자를 표시
            cell.textContent = cellData.number;
            
            // 셀 클릭 이벤트 (수동 마킹 가능)
            cell.addEventListener('click', () => {
                if (!cellData.marked && gameState.gameStatus === 'running') {
                    cellData.marked = true;
                    renderMyBoard();
                }
            });
            
            myBoardElement.appendChild(cell);
        }
    }
}

/**
 * 다른 플레이어들의 목록을 렌더링하는 함수
 */
function renderPlayersList() {
    playersListElement.innerHTML = '';
    
    if (gameState.players.length === 0) {
        playersListElement.innerHTML = '<p style="text-align: center; padding: 20px; opacity: 0.7;">참가자가 없습니다.</p>';
        return;
    }
    
    gameState.players.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        
        if (player.isHost) {
            playerItem.classList.add('is-host');
        }
        
        const playerHeader = document.createElement('div');
        playerHeader.className = 'player-header';
        
        const playerNameDiv = document.createElement('div');
        playerNameDiv.className = 'player-name';
        playerNameDiv.textContent = player.nickname;
        if (player.isHost) {
            const hostBadge = document.createElement('span');
            hostBadge.className = 'player-host-badge';
            hostBadge.textContent = '방장';
            playerNameDiv.appendChild(document.createTextNode(' '));
            playerNameDiv.appendChild(hostBadge);
        }
        
        const bingoCountDiv = document.createElement('div');
        bingoCountDiv.className = 'player-bingo-count';
        bingoCountDiv.textContent = `${player.bingoCount}줄`;
        
        playerHeader.appendChild(playerNameDiv);
        playerHeader.appendChild(bingoCountDiv);
        
        // 미리보기 보드 생성 (X만 표시)
        const previewBoard = document.createElement('div');
        previewBoard.className = 'player-preview';
        
        // 다른 플레이어의 보드 데이터 가져오기 (서버에서 받은 데이터 사용)
        if (player.board) {
            for (let i = 0; i < 5; i++) {
                for (let j = 0; j < 5; j++) {
                    const previewCell = document.createElement('div');
                    previewCell.className = 'player-preview-cell';
                    
                    if (player.board[i][j].marked) {
                        previewCell.classList.add('marked');
                        previewCell.textContent = '✕';
                    }
                    
                    previewBoard.appendChild(previewCell);
                }
            }
        }
        
        playerItem.appendChild(playerHeader);
        playerItem.appendChild(previewBoard);
        
        // 플레이어 아이템 클릭 시 상세 보드 모달 표시
        playerItem.addEventListener('click', () => {
            if (player.board) {
                showPlayerBoardModal(player.nickname, player.board);
            }
        });
        
        playersListElement.appendChild(playerItem);
    });
}

/**
 * 다른 플레이어의 보드를 모달로 표시하는 함수
 * @param {string} nickname - 플레이어 닉네임
 * @param {Array} board - 플레이어의 빙고판
 */
function showPlayerBoardModal(nickname, board) {
    modalPlayerName.textContent = `${nickname}의 빙고판`;
    modalPlayerBoard.innerHTML = '';
    
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
            const cell = document.createElement('div');
            cell.className = 'bingo-cell';
            
            const cellData = board[i][j];
            
            if (cellData.marked) {
                cell.classList.add('marked');
                cell.textContent = '✕';
            } else {
                // 다른 플레이어 보드는 숫자 숨김
                cell.textContent = '';
            }
            
            modalPlayerBoard.appendChild(cell);
        }
    }
    
    playerBoardModal.classList.remove('hidden');
}

/**
 * 호출된 번호 목록을 렌더링하는 함수
 */
function renderCalledNumbers() {
    calledNumbersElement.innerHTML = '';
    
    if (gameState.calledNumbers.length === 0) {
        calledNumbersElement.innerHTML = '<p style="text-align: center; padding: 10px; opacity: 0.7;">아직 호출된 번호가 없습니다.</p>';
        return;
    }
    
    // 최근 호출된 번호부터 표시 (역순)
    const reversedNumbers = [...gameState.calledNumbers].reverse();
    
    reversedNumbers.forEach(number => {
        const numberElement = document.createElement('span');
        numberElement.className = 'called-number';
        numberElement.textContent = number;
        calledNumbersElement.appendChild(numberElement);
    });
}

/**
 * 현재 호출된 번호를 표시하는 함수
 * @param {number} number - 호출된 번호
 */
function displayCurrentNumber(number) {
    if (number) {
        currentNumberElement.textContent = number;
        currentNumberElement.style.animation = 'none';
        setTimeout(() => {
            currentNumberElement.style.animation = 'numberAppear 0.5s ease';
        }, 10);
    } else {
        currentNumberElement.textContent = '-';
    }
}

/**
 * 방장 컨트롤 버튼 표시/숨김 처리
 */
function updateHostControls() {
    if (gameState.isHost) {
        hostControls.classList.remove('hidden');
        
        if (gameState.gameStatus === 'waiting') {
            startGameBtn.classList.remove('hidden');
            drawNumberBtn.classList.add('hidden');
            restartGameBtn.classList.add('hidden');
        } else if (gameState.gameStatus === 'running') {
            startGameBtn.classList.add('hidden');
            drawNumberBtn.classList.remove('hidden');
            restartGameBtn.classList.add('hidden');
        } else if (gameState.gameStatus === 'finished') {
            startGameBtn.classList.add('hidden');
            drawNumberBtn.classList.add('hidden');
            restartGameBtn.classList.remove('hidden');
        }
    } else {
        hostControls.classList.add('hidden');
    }
}

/**
 * 게임 전체 화면을 렌더링하는 함수
 */
function renderGame() {
    renderMyBoard();
    renderPlayersList();
    renderCalledNumbers();
    updateHostControls();
}

// ==================== Socket.IO 이벤트 처리 ====================

/**
 * 서버로부터 게임 상태를 받았을 때 처리
 */
socket.on('gameState', (data) => {
    gameState.gameStatus = data.gameStatus;
    gameState.players = data.players || [];
    gameState.calledNumbers = data.calledNumbers || [];
    gameState.winner = data.winner;
    
    renderGame();
});

/**
 * 입장 성공 이벤트 처리
 */
socket.on('joined', (data) => {
    gameState.myNickname = data.nickname;
    gameState.isHost = data.isHost;
    gameState.players = data.players || [];
    
    // 화면 전환
    loginScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    // 내 정보 표시
    myNicknameElement.textContent = gameState.myNickname;
    if (gameState.isHost) {
        hostBadge.classList.remove('hidden');
    } else {
        hostBadge.classList.add('hidden');
    }
    
    renderGame();
});

/**
 * 에러 메시지 처리
 */
socket.on('error', (data) => {
    alert(data.message);
});

/**
 * 플레이어 목록 업데이트 이벤트 처리
 */
socket.on('playerListUpdate', (data) => {
    gameState.players = data.players || [];
    renderPlayersList();
});

/**
 * 게임 시작 이벤트 처리
 */
socket.on('gameStarted', (data) => {
    gameState.gameStatus = 'running';
    gameState.calledNumbers = [];
    gameState.winner = null;
    
    // 내 보드 찾기
    const myPlayer = data.players.find(p => p.socketId === socket.id);
    if (myPlayer) {
        gameState.myBoard = myPlayer.board;
    }
    
    // 모든 플레이어 정보 업데이트
    gameState.players = data.players.map(p => ({
        socketId: p.socketId,
        nickname: p.nickname,
        bingoCount: p.bingoCount,
        isHost: p.isHost,
        board: p.board
    }));
    
    displayCurrentNumber(null);
    renderGame();
    
    // 게임 시작 알림
    if (gameState.isHost) {
        alert('게임이 시작되었습니다!');
    }
});

/**
 * 번호 호출 이벤트 처리
 */
socket.on('numberDrawn', (data) => {
    gameState.calledNumbers = data.calledNumbers || [];
    
    // 내 보드 업데이트
    if (gameState.myBoard) {
        const number = data.number;
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                if (gameState.myBoard[i][j].number === number) {
                    gameState.myBoard[i][j].marked = true;
                }
            }
        }
    }
    
    // 플레이어 정보 업데이트
    gameState.players = data.players || [];
    
    displayCurrentNumber(data.number);
    renderGame();
});

/**
 * 빙고 완료 이벤트 처리
 */
socket.on('bingoComplete', (data) => {
    gameState.gameStatus = 'finished';
    gameState.winner = data.winner;
    gameState.players = data.players || [];
    
    // 내 보드 업데이트
    if (gameState.myBoard) {
        const lastNumber = gameState.calledNumbers[gameState.calledNumbers.length - 1];
        if (lastNumber) {
            for (let i = 0; i < 5; i++) {
                for (let j = 0; j < 5; j++) {
                    if (gameState.myBoard[i][j].number === lastNumber) {
                        gameState.myBoard[i][j].marked = true;
                    }
                }
            }
        }
    }
    
    renderGame();
    updateHostControls();
    
    // 빙고 완료 모달 표시
    winnerMessage.textContent = `${data.winner}님이 빙고를 완성했습니다! (${data.bingoCount}줄)`;
    bingoModal.classList.remove('hidden');
});

/**
 * 게임 재시작 이벤트 처리
 */
socket.on('gameRestarted', (data) => {
    gameState.gameStatus = 'waiting';
    gameState.myBoard = null;
    gameState.calledNumbers = [];
    gameState.winner = null;
    gameState.players = data.players || [];
    
    displayCurrentNumber(null);
    renderGame();
});

/**
 * 방장 변경 이벤트 처리
 */
socket.on('hostChanged', (data) => {
    // 내가 새 방장인지 확인
    const myPlayer = data.players.find(p => p.socketId === socket.id);
    if (myPlayer && myPlayer.isHost) {
        gameState.isHost = true;
        hostBadge.classList.remove('hidden');
        alert('방장이 되었습니다!');
    } else {
        gameState.isHost = false;
        hostBadge.classList.add('hidden');
    }
    
    gameState.players = data.players || [];
    renderGame();
});

// ==================== 버튼 이벤트 처리 ====================

/**
 * 게임 시작 버튼 클릭 이벤트
 */
startGameBtn.addEventListener('click', () => {
    socket.emit('startGame');
});

/**
 * 번호 뽑기 버튼 클릭 이벤트
 */
drawNumberBtn.addEventListener('click', () => {
    socket.emit('drawNumber');
});

/**
 * 다시 시작 버튼 클릭 이벤트
 */
restartGameBtn.addEventListener('click', () => {
    socket.emit('restartGame');
});

/**
 * 빙고 완료 모달 닫기 버튼
 */
closeModalBtn.addEventListener('click', () => {
    bingoModal.classList.add('hidden');
});

/**
 * 플레이어 보드 모달 닫기 버튼
 */
closeBoardModalBtn.addEventListener('click', () => {
    playerBoardModal.classList.add('hidden');
});

/**
 * 모달 배경 클릭 시 닫기
 */
bingoModal.addEventListener('click', (e) => {
    if (e.target === bingoModal) {
        bingoModal.classList.add('hidden');
    }
});

playerBoardModal.addEventListener('click', (e) => {
    if (e.target === playerBoardModal) {
        playerBoardModal.classList.add('hidden');
    }
});

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    renderGame();
});


