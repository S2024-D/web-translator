// 공항 데이터 (위도/경도 -> 게임 좌표로 변환)
const AIRPORTS = {
    ICN: { name: '인천국제공항', country: '대한민국', continent: '아시아', x: 850, y: 280, runwayAngle: 90 },
    LHR: { name: '히드로공항', country: '영국', continent: '유럽', x: 480, y: 230, runwayAngle: 270 },
    JFK: { name: 'JFK국제공항', country: '미국', continent: '북미', x: 250, y: 270, runwayAngle: 90 },
    GRU: { name: '과룰류스공항', country: '브라질', continent: '남미', x: 320, y: 450, runwayAngle: 180 },
    CPT: { name: '케이프타운공항', country: '남아공', continent: '아프리카', x: 520, y: 480, runwayAngle: 0 },
    SYD: { name: '시드니공항', country: '호주', continent: '오세아니아', x: 920, y: 470, runwayAngle: 90 }
};

// 게임 상태
const game = {
    state: 'menu', // menu, runway, flying, landing
    selectedAirport: null,
    visitedAirports: [],
    totalDistance: 0,
    flightTime: 0
};

// 비행기 상태
const plane = {
    x: 0,
    y: 0,
    altitude: 0,
    speed: 0,
    heading: 0, // 0 = 북, 90 = 동, 180 = 남, 270 = 서
    maxSpeed: 900,
    acceleration: 0.5,
    turnSpeed: 2,
    climbRate: 3,
    onGround: true
};

// 입력 상태
const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    space: false,
    shift: false
};

// 캔버스
let canvas, ctx;
let minimapCanvas, minimapCtx;
const WORLD_WIDTH = 1000;
const WORLD_HEIGHT = 600;

// 초기화
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    minimapCanvas = document.getElementById('minimapCanvas');
    minimapCtx = minimapCanvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 이벤트 리스너
    document.querySelectorAll('.airport-btn').forEach(btn => {
        btn.addEventListener('click', () => selectAirport(btn.dataset.airport));
    });

    document.getElementById('continue-btn').addEventListener('click', continueFlight);
    document.getElementById('restart-btn').addEventListener('click', restartGame);

    // 키보드 입력
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // 게임 루프 시작
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    minimapCanvas.width = 200;
    minimapCanvas.height = 120;
}

// 공항 선택
function selectAirport(airportCode) {
    game.selectedAirport = airportCode;
    game.state = 'runway';
    game.visitedAirports = [airportCode];

    const airport = AIRPORTS[airportCode];
    plane.x = airport.x;
    plane.y = airport.y;
    plane.heading = airport.runwayAngle;
    plane.altitude = 0;
    plane.speed = 0;
    plane.onGround = true;

    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('takeoff-guide').classList.remove('hidden');
}

// 키 입력 처리
function handleKeyDown(e) {
    switch(e.code) {
        case 'KeyW':
        case 'ArrowUp':
            keys.up = true;
            break;
        case 'KeyS':
        case 'ArrowDown':
            keys.down = true;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            keys.left = true;
            break;
        case 'KeyD':
        case 'ArrowRight':
            keys.right = true;
            break;
        case 'Space':
            keys.space = true;
            e.preventDefault();
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            keys.shift = true;
            break;
    }
}

function handleKeyUp(e) {
    switch(e.code) {
        case 'KeyW':
        case 'ArrowUp':
            keys.up = false;
            break;
        case 'KeyS':
        case 'ArrowDown':
            keys.down = false;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            keys.left = false;
            break;
        case 'KeyD':
        case 'ArrowRight':
            keys.right = false;
            break;
        case 'Space':
            keys.space = false;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            keys.shift = false;
            break;
    }
}

// 게임 루프
let lastTime = 0;
function gameLoop(timestamp) {
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (game.state === 'runway' || game.state === 'flying') {
        update(deltaTime);
        render();
        renderMinimap();
        updateHUD();
    }

    requestAnimationFrame(gameLoop);
}

// 업데이트
function update(dt) {
    // 가속/감속
    if (keys.up) {
        plane.speed = Math.min(plane.speed + plane.acceleration * 60 * dt, plane.maxSpeed);
    }
    if (keys.down) {
        plane.speed = Math.max(plane.speed - plane.acceleration * 60 * dt, 0);
    }

    // 공중에서만 회전 가능 (또는 느린 속도로 지상에서도)
    const turnMultiplier = plane.onGround ? 0.3 : 1;
    if (keys.left) {
        plane.heading -= plane.turnSpeed * turnMultiplier * 60 * dt;
    }
    if (keys.right) {
        plane.heading += plane.turnSpeed * turnMultiplier * 60 * dt;
    }

    // 방향 정규화
    if (plane.heading < 0) plane.heading += 360;
    if (plane.heading >= 360) plane.heading -= 360;

    // 이륙
    if (game.state === 'runway' && keys.space && plane.speed >= 200) {
        game.state = 'flying';
        plane.onGround = false;
        document.getElementById('takeoff-guide').classList.add('hidden');
    }

    // 고도 조절 (비행 중일 때만)
    if (!plane.onGround) {
        if (keys.space) {
            plane.altitude = Math.min(plane.altitude + plane.climbRate * 60 * dt, 12000);
        }
        if (keys.shift) {
            plane.altitude = Math.max(plane.altitude - plane.climbRate * 60 * dt, 0);
        }

        // 고도가 0이면 착륙 체크
        if (plane.altitude <= 0) {
            plane.altitude = 0;
            checkLanding();
        }
    }

    // 속도에 따른 자연 감속 (공기 저항)
    if (!keys.up) {
        plane.speed = Math.max(plane.speed - 0.1 * 60 * dt, 0);
    }

    // 위치 업데이트
    const radians = (plane.heading - 90) * Math.PI / 180;
    const moveSpeed = plane.speed / 100 * dt * 60;
    plane.x += Math.cos(radians) * moveSpeed;
    plane.y += Math.sin(radians) * moveSpeed;

    // 세계 경계 (무한 루프)
    if (plane.x < 0) plane.x += WORLD_WIDTH;
    if (plane.x >= WORLD_WIDTH) plane.x -= WORLD_WIDTH;
    if (plane.y < 0) plane.y += WORLD_HEIGHT;
    if (plane.y >= WORLD_HEIGHT) plane.y -= WORLD_HEIGHT;

    // 비행 시간/거리 업데이트
    if (game.state === 'flying') {
        game.flightTime += dt;
        game.totalDistance += moveSpeed * 10; // km 단위로 환산
    }
}

// 착륙 체크
function checkLanding() {
    for (const [code, airport] of Object.entries(AIRPORTS)) {
        const dx = plane.x - airport.x;
        const dy = plane.y - airport.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 30 && plane.speed < 250) {
            // 착륙 성공
            plane.onGround = true;
            plane.speed = Math.max(plane.speed - 5, 0);

            if (!game.visitedAirports.includes(code)) {
                game.visitedAirports.push(code);
            }

            // 착륙 화면 표시
            showLandingScreen(code);
            return;
        }
    }

    // 공항 밖에서 착륙 시도 = 추락
    if (plane.speed > 50) {
        alert('추락! 공항 활주로에 착륙해야 합니다.');
        restartGame();
    }
}

function showLandingScreen(airportCode) {
    game.state = 'landed';
    game.selectedAirport = airportCode;
    const airport = AIRPORTS[airportCode];

    document.getElementById('landing-airport').textContent =
        `${airport.name} (${airport.country})`;
    document.getElementById('flight-stats').textContent =
        `방문한 공항: ${game.visitedAirports.length}곳 | 총 비행 거리: ${Math.round(game.totalDistance)}km`;

    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('landing-screen').classList.remove('hidden');
}

function continueFlight() {
    game.state = 'runway';
    plane.onGround = true;

    const airport = AIRPORTS[game.selectedAirport];
    plane.heading = airport.runwayAngle;

    document.getElementById('landing-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('takeoff-guide').classList.remove('hidden');
}

function restartGame() {
    game.state = 'menu';
    game.visitedAirports = [];
    game.totalDistance = 0;
    game.flightTime = 0;

    plane.x = 0;
    plane.y = 0;
    plane.altitude = 0;
    plane.speed = 0;
    plane.heading = 0;
    plane.onGround = true;

    document.getElementById('landing-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
}

// 렌더링
function render() {
    const scale = Math.min(canvas.width / WORLD_WIDTH, canvas.height / WORLD_HEIGHT);
    const offsetX = (canvas.width - WORLD_WIDTH * scale) / 2;
    const offsetY = (canvas.height - WORLD_HEIGHT * scale) / 2;

    // 배경 (바다)
    ctx.fillStyle = '#1a3a5c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // 카메라를 비행기 중심으로 (고도에 따라 줌 아웃)
    const zoom = Math.max(0.5, 1 - plane.altitude / 15000);
    const camX = WORLD_WIDTH / 2 - plane.x;
    const camY = WORLD_HEIGHT / 2 - plane.y;

    ctx.translate(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-WORLD_WIDTH / 2, -WORLD_HEIGHT / 2);
    ctx.translate(camX, camY);

    // 대륙 그리기
    drawContinents(ctx);

    // 공항들 그리기
    for (const [code, airport] of Object.entries(AIRPORTS)) {
        drawAirport(ctx, code, airport);
    }

    // 비행기 그리기
    drawPlane(ctx);

    ctx.restore();

    // 고도 표시 (화면 오른쪽)
    drawAltitudeIndicator();
}

function drawContinents(ctx) {
    ctx.fillStyle = '#2d5a3d';

    // 간단한 대륙 모양 (근사치)
    // 북미
    ctx.beginPath();
    ctx.ellipse(200, 250, 150, 120, 0, 0, Math.PI * 2);
    ctx.fill();

    // 남미
    ctx.beginPath();
    ctx.ellipse(280, 420, 80, 120, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // 유럽
    ctx.beginPath();
    ctx.ellipse(500, 220, 80, 60, 0, 0, Math.PI * 2);
    ctx.fill();

    // 아프리카
    ctx.beginPath();
    ctx.ellipse(530, 380, 90, 130, 0, 0, Math.PI * 2);
    ctx.fill();

    // 아시아
    ctx.beginPath();
    ctx.ellipse(750, 250, 180, 120, 0, 0, Math.PI * 2);
    ctx.fill();

    // 호주
    ctx.beginPath();
    ctx.ellipse(880, 450, 80, 50, 0, 0, Math.PI * 2);
    ctx.fill();

    // 세계 경계 반복 (왼쪽/오른쪽)
    ctx.save();
    ctx.translate(-WORLD_WIDTH, 0);
    ctx.beginPath();
    ctx.ellipse(880, 450, 80, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(WORLD_WIDTH, 0);
    ctx.beginPath();
    ctx.ellipse(200, 250, 150, 120, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawAirport(ctx, code, airport) {
    const isVisited = game.visitedAirports.includes(code);
    const isCurrent = code === game.selectedAirport;

    // 활주로
    ctx.save();
    ctx.translate(airport.x, airport.y);
    ctx.rotate(airport.runwayAngle * Math.PI / 180);

    ctx.fillStyle = '#333';
    ctx.fillRect(-40, -5, 80, 10);

    // 활주로 중앙선
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(-35, 0);
    ctx.lineTo(35, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();

    // 공항 마커
    ctx.beginPath();
    ctx.arc(airport.x, airport.y, isCurrent ? 8 : 5, 0, Math.PI * 2);
    ctx.fillStyle = isVisited ? '#00ff88' : '#ff8800';
    ctx.fill();

    // 공항 이름
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(code, airport.x, airport.y - 15);
}

function drawPlane(ctx) {
    ctx.save();
    ctx.translate(plane.x, plane.y);
    ctx.rotate((plane.heading) * Math.PI / 180);

    // 비행기 크기 (고도에 따라 약간 변화)
    const size = 10 + plane.altitude / 2000;

    // 비행기 본체
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size, -size / 2);
    ctx.lineTo(-size / 2, 0);
    ctx.lineTo(-size, size / 2);
    ctx.closePath();
    ctx.fill();

    // 그림자 (고도가 높을수록 멀리)
    if (plane.altitude > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        const shadowOffset = plane.altitude / 500;
        ctx.save();
        ctx.translate(shadowOffset, shadowOffset);
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size, -size / 2);
        ctx.lineTo(-size / 2, 0);
        ctx.lineTo(-size, size / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    ctx.restore();
}

function drawAltitudeIndicator() {
    const barHeight = 200;
    const barWidth = 20;
    const x = canvas.width - 50;
    const y = canvas.height / 2 - barHeight / 2;

    // 배경
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, barWidth, barHeight);

    // 고도 바
    const altPercent = plane.altitude / 12000;
    ctx.fillStyle = '#00d4ff';
    ctx.fillRect(x, y + barHeight * (1 - altPercent), barWidth, barHeight * altPercent);

    // 라벨
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('12km', x - 5, y + 10);
    ctx.fillText('0', x - 5, y + barHeight);
}

// 미니맵 렌더링
function renderMinimap() {
    const scaleX = minimapCanvas.width / WORLD_WIDTH;
    const scaleY = minimapCanvas.height / WORLD_HEIGHT;

    // 배경
    minimapCtx.fillStyle = '#1a3a5c';
    minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    // 대륙 (간단히)
    minimapCtx.fillStyle = '#2d5a3d';
    minimapCtx.fillRect(150 * scaleX, 180 * scaleY, 100 * scaleX, 100 * scaleY); // 북미
    minimapCtx.fillRect(220 * scaleX, 350 * scaleY, 60 * scaleX, 100 * scaleY); // 남미
    minimapCtx.fillRect(450 * scaleX, 180 * scaleY, 80 * scaleX, 80 * scaleY); // 유럽
    minimapCtx.fillRect(470 * scaleX, 300 * scaleY, 80 * scaleX, 150 * scaleY); // 아프리카
    minimapCtx.fillRect(650 * scaleX, 180 * scaleY, 200 * scaleX, 150 * scaleY); // 아시아
    minimapCtx.fillRect(840 * scaleX, 400 * scaleY, 80 * scaleX, 60 * scaleY); // 호주

    // 공항들
    for (const [code, airport] of Object.entries(AIRPORTS)) {
        const isVisited = game.visitedAirports.includes(code);
        minimapCtx.fillStyle = isVisited ? '#00ff88' : '#ff8800';
        minimapCtx.beginPath();
        minimapCtx.arc(airport.x * scaleX, airport.y * scaleY, 3, 0, Math.PI * 2);
        minimapCtx.fill();
    }

    // 비행기 위치
    minimapCtx.fillStyle = '#fff';
    minimapCtx.beginPath();
    minimapCtx.arc(plane.x * scaleX, plane.y * scaleY, 4, 0, Math.PI * 2);
    minimapCtx.fill();

    // 비행기 방향
    const radians = (plane.heading - 90) * Math.PI / 180;
    minimapCtx.strokeStyle = '#00d4ff';
    minimapCtx.lineWidth = 2;
    minimapCtx.beginPath();
    minimapCtx.moveTo(plane.x * scaleX, plane.y * scaleY);
    minimapCtx.lineTo(
        plane.x * scaleX + Math.cos(radians) * 15,
        plane.y * scaleY + Math.sin(radians) * 15
    );
    minimapCtx.stroke();
}

// HUD 업데이트
function updateHUD() {
    document.getElementById('speed').textContent = Math.round(plane.speed);
    document.getElementById('altitude').textContent = Math.round(plane.altitude);

    // 방향 표시
    const headings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(plane.heading / 45) % 8;
    document.getElementById('heading').textContent = headings[index];

    // 상태 표시
    let status = '활주로';
    if (game.state === 'flying') {
        if (plane.altitude > 8000) status = '순항';
        else if (plane.altitude > 3000) status = '상승';
        else status = '저고도';
    }
    document.getElementById('status').textContent = status;

    // 가장 가까운 공항 찾기
    let nearestAirport = null;
    let nearestDistance = Infinity;

    for (const [code, airport] of Object.entries(AIRPORTS)) {
        if (code === game.selectedAirport && plane.onGround) continue;

        const dx = plane.x - airport.x;
        const dy = plane.y - airport.y;
        const distance = Math.sqrt(dx * dx + dy * dy) * 10; // km로 환산

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestAirport = { code, ...airport };
        }
    }

    if (nearestAirport && game.state === 'flying') {
        document.getElementById('destination-info').classList.remove('hidden');
        document.getElementById('dest-name').textContent =
            `${nearestAirport.code} - ${nearestAirport.name}`;
        document.getElementById('dest-distance').textContent =
            `${Math.round(nearestDistance)} km`;
    } else {
        document.getElementById('destination-info').classList.add('hidden');
    }
}

// 시작
window.addEventListener('DOMContentLoaded', init);
