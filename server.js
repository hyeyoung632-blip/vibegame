const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 정적 파일 제공 (public 폴더)
app.use(express.static(path.join(__dirname, 'public')));

// 게임 상태 관리 객체
const gameState = {
    players: [],              // 플레이어 목록 [{socketId, nickname, board, bingoCount, isHost}]
    calledNumbers: [],        // 호출된 번호 목록
    gameStatus: 'waiting',   // 'waiting' | 'running' | 'finished'
    winner: null             // 우승자 닉네임
};

/**
 * 1~25 숫자 배열을 랜덤하게 섞는 함수 (Fisher-Yates 알고리즘)
 * @returns {Array} 섞인 1~25 숫자 배열
 */
function shuffleNumbers() {
    const numbers = [];
    for (let i = 1; i <= 25; i++) {
        numbers.push(i);
    }
    
    // Fisher-Yates 셔플 알고리즘
    for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    
    return numbers;
}

/**
 * 5x5 빙고판을 생성하는 함수
 * @returns {Array} 5x5 빙고판 (2차원 배열)
 */
function createBingoBoard() {
    const shuffledNumbers = shuffleNumbers();
    const board = [];
    
    for (let i = 0; i < 5; i++) {
        const row = [];
        for (let j = 0; j < 5; j++) {
            row.push({
                number: shuffledNumbers[i * 5 + j],
                marked: false
            });
        }
        board.push(row);
    }
    
    return board;
}

/**
 * 빙고 줄 수를 계산하는 함수
 * @param {Array} board - 5x5 빙고판 배열
 * @returns {number} 빙고 줄 수
 */
function calculateBingoLines(board) {
    let bingoCount = 0;
    
    // 가로 줄 체크
    for (let i = 0; i < 5; i++) {
        if (board[i].every(cell => cell.marked)) {
            bingoCount++;
        }
    }
    
    // 세로 줄 체크
    for (let j = 0; j < 5; j++) {
        let isColumnBingo = true;
        for (let i = 0; i < 5; i++) {
            if (!board[i][j].marked) {
                isColumnBingo = false;
                break;
            }
        }
        if (isColumnBingo) {
            bingoCount++;
        }
    }
    
    // 대각선 체크 (왼쪽 위 -> 오른쪽 아래)
    let isDiagonal1Bingo = true;
    for (let i = 0; i < 5; i++) {
        if (!board[i][i].marked) {
            isDiagonal1Bingo = false;
            break;
        }
    }
    if (isDiagonal1Bingo) {
        bingoCount++;
    }
    
    // 대각선 체크 (오른쪽 위 -> 왼쪽 아래)
    let isDiagonal2Bingo = true;
    for (let i = 0; i < 5; i++) {
        if (!board[i][4 - i].marked) {
            isDiagonal2Bingo = false;
            break;
        }
    }
    if (isDiagonal2Bingo) {
        bingoCount++;
    }
    
    return bingoCount;
}

/**
 * 특정 번호를 모든 플레이어의 보드에서 마킹하고 빙고 줄 수를 업데이트하는 함수
 * @param {number} number - 마킹할 번호
 */
function markNumberOnAllBoards(number) {
    gameState.players.forEach(player => {
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                if (player.board[i][j].number === number) {
                    player.board[i][j].marked = true;
                }
            }
        }
        // 빙고 줄 수 업데이트
        player.bingoCount = calculateBingoLines(player.board);
    });
}

/**
 * 모든 플레이어의 빙고 줄 수 정보를 반환하는 함수
 * @returns {Array} 플레이어 정보 배열 (닉네임, 빙고 줄 수)
 */
function getPlayersStatus() {
    return gameState.players.map(player => ({
        socketId: player.socketId,
        nickname: player.nickname,
        bingoCount: player.bingoCount,
        isHost: player.isHost
    }));
}

/**
 * 새 방장을 지정하는 함수 (기존 방장이 나갔을 때)
 */
function assignNewHost() {
    if (gameState.players.length > 0) {
        gameState.players[0].isHost = true;
        return gameState.players[0].socketId;
    }
    return null;
}

// Socket.IO 연결 처리
io.on('connection', (socket) => {
    console.log(`새로운 사용자 연결: ${socket.id}`);
    
    // 클라이언트에게 현재 게임 상태 전송
    socket.emit('gameState', {
        gameStatus: gameState.gameStatus,
        players: getPlayersStatus(),
        calledNumbers: gameState.calledNumbers,
        winner: gameState.winner
    });
    
    /**
     * 닉네임 입력 후 입장 이벤트 처리
     */
    socket.on('join', (data) => {
        const { nickname } = data;
        
        if (!nickname || nickname.trim() === '') {
            socket.emit('error', { message: '닉네임을 입력해주세요.' });
            return;
        }
        
        // 중복 닉네임 체크
        const isDuplicate = gameState.players.some(p => p.nickname === nickname.trim());
        if (isDuplicate) {
            socket.emit('error', { message: '이미 사용 중인 닉네임입니다.' });
            return;
        }
        
        // 첫 번째 접속자를 방장으로 설정
        const isHost = gameState.players.length === 0;
        
        // 플레이어 추가
        const player = {
            socketId: socket.id,
            nickname: nickname.trim(),
            board: null,
            bingoCount: 0,
            isHost: isHost
        };
        
        gameState.players.push(player);
        
        // 입장 성공 알림
        socket.emit('joined', {
            nickname: player.nickname,
            isHost: player.isHost,
            players: getPlayersStatus()
        });
        
        // 모든 클라이언트에게 플레이어 목록 업데이트 전송
        io.emit('playerListUpdate', {
            players: getPlayersStatus()
        });
        
        console.log(`${player.nickname}(${socket.id}) 입장 - 방장: ${isHost}`);
    });
    
    /**
     * 방장이 게임 시작 요청 이벤트 처리
     */
    socket.on('startGame', () => {
        const player = gameState.players.find(p => p.socketId === socket.id);
        
        // 방장인지 확인
        if (!player || !player.isHost) {
            socket.emit('error', { message: '방장만 게임을 시작할 수 있습니다.' });
            return;
        }
        
        // 게임 상태 초기화
        gameState.calledNumbers = [];
        gameState.gameStatus = 'running';
        gameState.winner = null;
        
        // 모든 플레이어에게 빙고판 생성 및 할당
        gameState.players.forEach(p => {
            p.board = createBingoBoard();
            p.bingoCount = 0;
        });
        
        // 모든 클라이언트에게 게임 시작 이벤트 전송
        io.emit('gameStarted', {
            players: gameState.players.map(p => ({
                socketId: p.socketId,
                nickname: p.nickname,
                board: p.board,
                bingoCount: 0,
                isHost: p.isHost
            }))
        });
        
        console.log('게임 시작!');
    });
    
    /**
     * 방장이 번호 뽑기 요청 이벤트 처리
     */
    socket.on('drawNumber', () => {
        const player = gameState.players.find(p => p.socketId === socket.id);
        
        // 방장인지 확인
        if (!player || !player.isHost) {
            socket.emit('error', { message: '방장만 번호를 뽑을 수 있습니다.' });
            return;
        }
        
        // 게임이 실행 중인지 확인
        if (gameState.gameStatus !== 'running') {
            socket.emit('error', { message: '게임이 실행 중이 아닙니다.' });
            return;
        }
        
        // 아직 나오지 않은 번호 중에서 선택
        const availableNumbers = [];
        for (let i = 1; i <= 25; i++) {
            if (!gameState.calledNumbers.includes(i)) {
                availableNumbers.push(i);
            }
        }
        
        if (availableNumbers.length === 0) {
            socket.emit('error', { message: '모든 번호가 호출되었습니다.' });
            return;
        }
        
        // 랜덤하게 번호 선택
        const randomIndex = Math.floor(Math.random() * availableNumbers.length);
        const drawnNumber = availableNumbers[randomIndex];
        
        // 호출된 번호 목록에 추가
        gameState.calledNumbers.push(drawnNumber);
        
        // 모든 플레이어의 보드에서 해당 번호 마킹
        markNumberOnAllBoards(drawnNumber);
        
        // 빙고 완료 체크 (3줄 이상 달성 시)
        const winners = gameState.players.filter(p => p.bingoCount >= 3);
        
        if (winners.length > 0 && gameState.gameStatus === 'running') {
            gameState.gameStatus = 'finished';
            gameState.winner = winners[0].nickname;
            
            // 모든 클라이언트에게 빙고 완료 이벤트 전송
            io.emit('bingoComplete', {
                winner: gameState.winner,
                bingoCount: winners[0].bingoCount,
                players: getPlayersStatus()
            });
        } else {
            // 번호 호출 이벤트 전송
            io.emit('numberDrawn', {
                number: drawnNumber,
                calledNumbers: gameState.calledNumbers,
                players: getPlayersStatus()
            });
        }
        
        console.log(`번호 호출: ${drawnNumber}`);
    });
    
    /**
     * 방장이 게임 다시 시작 요청 이벤트 처리
     */
    socket.on('restartGame', () => {
        const player = gameState.players.find(p => p.socketId === socket.id);
        
        // 방장인지 확인
        if (!player || !player.isHost) {
            socket.emit('error', { message: '방장만 게임을 다시 시작할 수 있습니다.' });
            return;
        }
        
        // 게임 상태 초기화
        gameState.calledNumbers = [];
        gameState.gameStatus = 'waiting';
        gameState.winner = null;
        
        // 모든 플레이어의 빙고판 초기화
        gameState.players.forEach(p => {
            p.board = null;
            p.bingoCount = 0;
        });
        
        // 모든 클라이언트에게 게임 재시작 이벤트 전송
        io.emit('gameRestarted', {
            players: getPlayersStatus()
        });
        
        console.log('게임 재시작');
    });
    
    /**
     * 연결 해제 처리
     */
    socket.on('disconnect', () => {
        const playerIndex = gameState.players.findIndex(p => p.socketId === socket.id);
        
        if (playerIndex !== -1) {
            const player = gameState.players[playerIndex];
            const wasHost = player.isHost;
            
            // 플레이어 제거
            gameState.players.splice(playerIndex, 1);
            
            // 방장이 나갔다면 새 방장 지정
            if (wasHost && gameState.players.length > 0) {
                const newHostId = assignNewHost();
                io.emit('hostChanged', {
                    newHost: gameState.players[0].nickname,
                    players: getPlayersStatus()
                });
                console.log(`새 방장: ${gameState.players[0].nickname}`);
            }
            
            // 모든 클라이언트에게 플레이어 목록 업데이트 전송
            io.emit('playerListUpdate', {
                players: getPlayersStatus()
            });
            
            console.log(`${player.nickname}(${socket.id}) 퇴장`);
        }
    });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});


