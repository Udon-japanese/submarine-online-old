'use strict';
import $ from 'jquery';
import io from 'socket.io-client';

const gameObj = {
  radarCanvasWidth: 500,
  radarCanvasHeight: 500,
  scoreCanvasWidth: 300,
  scoreCanvasHeight: 500,
  itemRadius: 4,
  airRadius: 6,
  bomCellPx: 32,
  deg: 0,
  counter: 0,
  rotationDegreeByDirection: {
    'left': 0,
    'up': 270,
    'down': 90,
    'right': 0
  },
  rotationDegreeByFlyingMissileDirection: {
    'left': 270,
    'up': 0,
    'down': 180,
    'right': 90
  },
  myDisplayName: $('#main').attr('data-displayName'),
  myThumbUrl: $('#main').attr('data-thumbUrl'),
  fieldWidth: null,
  fieldHeight: null,
  itemsMap: new Map(),
  airMap: new Map(),
  flyingMissilesMap: new Map()
};

const socketQueryParameters = `displayName=${gameObj.myDisplayName}&thumbUrl=${gameObj.myThumbUrl}`;
const socket = io($('#main').attr('data-ipAddress') + '?' + socketQueryParameters);

function init() {

  // ゲーム用のキャンバス
  const radarCanvas = $('#radar')[0];
  radarCanvas.width = gameObj.radarCanvasWidth;
  radarCanvas.height = gameObj.radarCanvasHeight;
  gameObj.ctxRadar = radarCanvas.getContext('2d');

  // ランキング用のキャンバス
  const scoreCanvas = $('#score')[0];
  scoreCanvas.width = gameObj.scoreCanvasWidth;
  scoreCanvas.height = gameObj.scoreCanvasHeight;
  gameObj.ctxScore = scoreCanvas.getContext('2d');

  // 潜水艦の画像
  const submarineImage = new Image();
  submarineImage.src = '/images/submarine.png';
  gameObj.submarineImage = submarineImage;

  // ミサイルの画像
  gameObj.missileImage = new Image();
  gameObj.missileImage.src = '/images/missile.png'

  // 爆発の画像集
  gameObj.bomListImage = new Image();
  gameObj.bomListImage.src = '/images/bomlist.png';
}

init();

function ticker() {
  if (!gameObj.myPlayerObj || !gameObj.playersMap) return;

  gameObj.ctxRadar.clearRect(0, 0, gameObj.radarCanvasWidth, gameObj.radarCanvasHeight); // まっさら
  drawRadar(gameObj.ctxRadar);
  drawMap(gameObj);
  drawSubmarine(gameObj.ctxRadar, gameObj.myPlayerObj);
  if (!gameObj.myPlayerObj.isAlive && gameObj.myPlayerObj.deadCount > 60) {
    drawGameOver(gameObj.ctxRadar);
  }

  gameObj.ctxScore.clearRect(0, 0, gameObj.scoreCanvasWidth, gameObj.scoreCanvasHeight); // scoreCanvas もまっさら
  drawAirTimer(gameObj.ctxScore, gameObj.myPlayerObj.airTime);
  drawMissiles(gameObj.ctxScore, gameObj.myPlayerObj.missilesMany);
  drawScore(gameObj.ctxScore, gameObj.myPlayerObj.score);
  drawRanking(gameObj.ctxScore, gameObj.playersMap);
  moveInClient(gameObj.myPlayerObj, gameObj.flyingMissilesMap);

  gameObj.counter = (gameObj.counter + 1) % 10000;
}

setInterval(ticker, 33);

function drawGameOver(ctxRadar) {
  ctxRadar.font = 'bold 76px arial black';
  ctxRadar.fillStyle = "rgb(0, 220, 250)";
  ctxRadar.fillText('Game Over', 20, 270);
  ctxRadar.strokeStyle = "rgb(0, 0, 0)";
  ctxRadar.lineWidth = 3;
  ctxRadar.strokeText('Game Over', 20, 270);
}

function drawRadar(ctxRadar) {
  if (!gameObj.myPlayerObj.isAlive) return;
  const x = gameObj.radarCanvasWidth / 2;
  const y = gameObj.radarCanvasHeight / 2;
  const r = gameObj.radarCanvasWidth * 1.5 / 2; // 対角線の長さの半分

  ctxRadar.save(); // セーブ

  ctxRadar.beginPath();
  ctxRadar.translate(x, y);
  ctxRadar.rotate(getRadian(gameObj.deg));

  ctxRadar.fillStyle = 'rgba(0, 220, 0, 0.5)';

  ctxRadar.arc(0, 0, r, getRadian(0), getRadian(-30), true);
  ctxRadar.lineTo(0, 0);

  ctxRadar.fill();

  ctxRadar.restore(); // 元の設定を取得
  gameObj.deg = (gameObj.deg + 5) % 360;
}

function drawSubmarine(ctxRadar, myPlayerObj) {
  if (!myPlayerObj.isAlive) {
    drawBom(ctxRadar, gameObj.radarCanvasWidth / 2, gameObj.radarCanvasHeight / 2, myPlayerObj.deadCount);
    return;
  }
  const rotationDegree = gameObj.rotationDegreeByDirection[myPlayerObj.direction];
  ctxRadar.save();
  ctxRadar.translate(gameObj.radarCanvasWidth / 2, gameObj.radarCanvasHeight / 2);
  ctxRadar.rotate(getRadian(rotationDegree));
  if (myPlayerObj.direction === 'left') {
    ctxRadar.scale(-1, 1);
  }
  ctxRadar.drawImage(
    gameObj.submarineImage, -(gameObj.submarineImage.width / 2), -(gameObj.submarineImage.height / 2)
  );
  ctxRadar.restore();
}

function drawBom(ctxRadar, drawX, drawY, deadCount) {
  if (deadCount >= 60) return;

  const drawBomNumber = Math.floor(deadCount / 6);
  const cropX = (drawBomNumber % (gameObj.bomListImage.width / gameObj.bomCellPx)) * gameObj.bomCellPx;
  const cropY = Math.floor(drawBomNumber / (gameObj.bomListImage.width / gameObj.bomCellPx)) * gameObj.bomCellPx;

  ctxRadar.drawImage(
    gameObj.bomListImage,
    cropX, cropY,
    gameObj.bomCellPx, gameObj.bomCellPx,
    drawX - gameObj.bomCellPx / 2, drawY - gameObj.bomCellPx / 2,
    gameObj.bomCellPx, gameObj.bomCellPx
  ); // 画像データ、切り抜き左、切り抜き上、幅、幅、表示x、表示y、幅、幅
}

function drawMissiles(ctxScore, missilesMany) {
  for (let i = 0; i < missilesMany; i++) {
    ctxScore.drawImage(gameObj.missileImage, 50 * i, 80);
  }
}

function drawAirTimer(ctxScore, airTime) {
  ctxScore.fillStyle = 'rgb(0, 220, 250)';
  ctxScore.font = 'bold 40px Arial';
  ctxScore.fillText(airTime, 110, 50);
}

function drawScore(ctxScore, score) {
  ctxScore.fillStyle = 'rgb(26, 26, 26)';
  ctxScore.font = '28px Arial';
  ctxScore.fillText(`score: ${score}`, 10, 180);
}

function drawRanking(ctxScore, playersMap) {
  const playersArray = [].concat(Array.from(playersMap));
  playersArray.sort((a, b) => b[1].score - a[1].score);

  gameObj.thumbsMap = gameObj.thumbsMap ?? new Map();

  ctxScore.fillStyle = 'rgb(0, 0, 0)';
  ctxScore.fillRect(0, 220, gameObj.scoreCanvasWidth, 3);

  ctxScore.fillStyle = 'rgb(26, 26, 26)';
  ctxScore.font = '20px Arial';

  for (let i = 0; i < 10; i++) {
    if (!playersArray[i]) return;

    const rank = i + 1;
    let rankString = null;

    switch (rank) {
      case 1:
        rankString = `${rank}st`;
        break;
      case 2:
        rankString = `${rank}nd`;
        break;
      case 3:
        rankString = `${rank}rd`;
        break;
      default:
        rankString = `${rank}th`;
        break;
    }
    
    const x = 10, y = 220 + (rank * 26);

    const { playerId, thumbUrl, displayName, score } = playersArray[i][1];

    if (/twimg\.com/.test(thumbUrl)) {
      const thumbWidth = 20, thumbHeight = 20;
      const rankWidth = ctxScore.measureText(`${rankString}`).width;

      let thumb = null;
      if (gameObj.thumbsMap.has(playerId)) {
        thumb = gameObj.thumbsMap.get(playerId);
        draw();
      } else {
        thumb = new Image();
        thumb.src = thumbUrl;
        thumb.onload = draw;
        gameObj.thumbsMap.set(playerId, thumb);
      }

      function draw() {
        ctxScore.fillText(`${rankString} `, x, y);
        ctxScore.drawImage(thumb, x + rankWidth, y - thumbHeight, thumbWidth, thumbHeight);
        ctxScore.fillText(` ${displayName} ${score}`, x + rankWidth + thumbWidth, y);
      };

      continue;
    }

    ctxScore.fillText(`${rankString} ${displayName} ${score}`, x, y);
  }
}

socket.on('start data', (startObj) => {
  gameObj.fieldWidth = startObj.fieldWidth;
  gameObj.fieldHeight = startObj.fieldHeight;
  gameObj.myPlayerObj = startObj.playerObj;
  gameObj.missileSpeed = startObj.missileSpeed;
});

socket.on('map data', (compressed) => {
  const playersArray = compressed[0];
  const itemsArray = compressed[1];
  const airArray = compressed[2];
  const flyingMissilesArray = compressed[3];

  gameObj.playersMap = new Map();
  for (let compressedPlayerData of playersArray) {

    const player = {};
    player.x = compressedPlayerData[0];
    player.y = compressedPlayerData[1];
    player.playerId = compressedPlayerData[2];
    player.displayName = compressedPlayerData[3];
    player.score = compressedPlayerData[4];
    player.isAlive = compressedPlayerData[5];
    player.direction = compressedPlayerData[6];
    player.missilesMany = compressedPlayerData[7];
    player.airTime = compressedPlayerData[8];
    player.deadCount = compressedPlayerData[9];
    player.thumbUrl = compressedPlayerData[10];

    gameObj.playersMap.set(player.playerId, player);

    // 自分の情報も更新
    if (player.playerId === gameObj.myPlayerObj.playerId) {
      gameObj.myPlayerObj.x = compressedPlayerData[0];
      gameObj.myPlayerObj.y = compressedPlayerData[1];
      gameObj.myPlayerObj.displayName = compressedPlayerData[3];
      gameObj.myPlayerObj.score = compressedPlayerData[4];
      gameObj.myPlayerObj.isAlive = compressedPlayerData[5];
      gameObj.myPlayerObj.missilesMany = compressedPlayerData[7];
      gameObj.myPlayerObj.airTime = compressedPlayerData[8];
      gameObj.myPlayerObj.deadCount = compressedPlayerData[9];
      gameObj.myPlayerObj.thumbUrl = compressedPlayerData[10];
    }
  }

  gameObj.itemsMap = new Map();
  itemsArray.forEach((compressedItemData, index) => {
    gameObj.itemsMap.set(index, { x: compressedItemData[0], y: compressedItemData[1] });
  });

  gameObj.airMap = new Map();
  airArray.forEach((compressedAirData, index) => {
    gameObj.airMap.set(index, { x: compressedAirData[0], y: compressedAirData[1] });
  });

  gameObj.flyingMissilesMap = new Map();
  flyingMissilesArray.forEach((compressedFlyingMissileData, index) => {
    gameObj.flyingMissilesMap.set(index, {
      x: compressedFlyingMissileData[0],
      y: compressedFlyingMissileData[1],
      direction: compressedFlyingMissileData[2],
      emitPlayerId: compressedFlyingMissileData[3]
    });
  });
});

function getRadian(deg) {
  return deg * Math.PI / 180
}

function drawMap(gameObj) {
  // 敵プレイヤーと NPC の描画
  for (let [key, enemyPlayerObj] of gameObj.playersMap) {
    if (key === gameObj.myPlayerObj.playerId) continue; // 自分は描画しない

    const distanceObj = calculationBetweenTwoPoints(
      gameObj.myPlayerObj.x, gameObj.myPlayerObj.y,
      enemyPlayerObj.x, enemyPlayerObj.y,
      gameObj.fieldWidth, gameObj.fieldHeight,
      gameObj.radarCanvasWidth, gameObj.radarCanvasHeight
    );

    if (distanceObj.distanceX <= (gameObj.radarCanvasWidth / 2) && distanceObj.distanceY <= (gameObj.radarCanvasHeight / 2)) {

      if (enemyPlayerObj.isAlive === false) {
        drawBom(gameObj.ctxRadar, distanceObj.drawX, distanceObj.drawY, enemyPlayerObj.deadCount);
        continue;
      }

      const degreeDiff = calcDegreeDiffFromRadar(gameObj.deg, distanceObj.degree);
      const opacity = calcOpacity(degreeDiff);

      const drawRadius = gameObj.counter % 12 + 2 + 12;
      const clearRadius = drawRadius - 2;
      const drawRadius2 = gameObj.counter % 12 + 2;
      const clearRadius2 = drawRadius2 - 2;

      gameObj.ctxRadar.fillStyle = `rgba(0, 0, 255, ${opacity})`;
      gameObj.ctxRadar.beginPath();
      gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, drawRadius, 0, Math.PI * 2, true);
      gameObj.ctxRadar.fill();

      gameObj.ctxRadar.fillStyle = `rgb(0, 20, 50)`;
      gameObj.ctxRadar.beginPath();
      gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, clearRadius, 0, Math.PI * 2, true);
      gameObj.ctxRadar.fill();

      gameObj.ctxRadar.fillStyle = `rgba(0, 0, 255, ${opacity})`;
      gameObj.ctxRadar.beginPath();
      gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, drawRadius2, 0, Math.PI * 2, true);
      gameObj.ctxRadar.fill();

      gameObj.ctxRadar.fillStyle = `rgb(0, 20, 50)`;
      gameObj.ctxRadar.beginPath();
      gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, clearRadius2, 0, Math.PI * 2, true);
      gameObj.ctxRadar.fill();

      if (enemyPlayerObj.displayName === 'anonymous') {

        gameObj.ctxRadar.strokeStyle = `rgba(250, 250, 250, ${opacity})`;
        gameObj.ctxRadar.fillStyle = `rgba(250, 250, 250, ${opacity})`;
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.moveTo(distanceObj.drawX, distanceObj.drawY);
        gameObj.ctxRadar.lineTo(distanceObj.drawX + 20, distanceObj.drawY - 20);
        gameObj.ctxRadar.lineTo(distanceObj.drawX + 20 + 40, distanceObj.drawY - 20);
        gameObj.ctxRadar.stroke();

        gameObj.ctxRadar.font = '8px Arial';
        gameObj.ctxRadar.fillText('anonymous', distanceObj.drawX + 20, distanceObj.drawY - 20 - 1);

      } else if (enemyPlayerObj.displayName) {

        gameObj.ctxRadar.strokeStyle = `rgba(250, 250, 250, ${opacity})`;
        gameObj.ctxRadar.fillStyle = `rgba(250, 250, 250, ${opacity})`;
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.moveTo(distanceObj.drawX, distanceObj.drawY);
        gameObj.ctxRadar.lineTo(distanceObj.drawX + 20, distanceObj.drawY - 20);
        gameObj.ctxRadar.lineTo(distanceObj.drawX + 20 + 40, distanceObj.drawY - 20);
        gameObj.ctxRadar.stroke();

        gameObj.ctxRadar.font = '8px Arial';
        gameObj.ctxRadar.fillText(enemyPlayerObj.displayName, distanceObj.drawX + 20, distanceObj.drawY - 20 - 1);

      }
    }
  }

  drawObj(gameObj.itemsMap, 255, 165, 0);
  drawObj(gameObj.airMap, 0, 220, 255);

  // 飛んでいるミサイルの描画
  for (let [missileId, flyingMissile] of gameObj.flyingMissilesMap) {

    const distanceObj = calculationBetweenTwoPoints(
      gameObj.myPlayerObj.x, gameObj.myPlayerObj.y,
      flyingMissile.x, flyingMissile.y,
      gameObj.fieldWidth, gameObj.fieldHeight,
      gameObj.radarCanvasWidth, gameObj.radarCanvasHeight
    );

    if (
      distanceObj.distanceX <= (gameObj.radarCanvasWidth / 2 + 50) &&
      distanceObj.distanceY <= (gameObj.radarCanvasHeight / 2 + 50)
    ) {

      if (flyingMissile.emitPlayerId === gameObj.myPlayerObj.playerId) { // 自分自身のミサイルの描画

        const rotationDegree = gameObj.rotationDegreeByFlyingMissileDirection[flyingMissile.direction];
        gameObj.ctxRadar.save();
        gameObj.ctxRadar.translate(distanceObj.drawX, distanceObj.drawY);
        gameObj.ctxRadar.rotate(getRadian(rotationDegree));
        gameObj.ctxRadar.drawImage(
          gameObj.missileImage, -gameObj.missileImage.width / 2, -gameObj.missileImage.height / 2
        );
        gameObj.ctxRadar.restore();

        gameObj.ctxRadar.strokeStyle = 'rgba(250, 250, 250, 0.9)';
        gameObj.ctxRadar.fillStyle = 'rgba(250, 250, 250, 0.9)';
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.moveTo(distanceObj.drawX, distanceObj.drawY);
        gameObj.ctxRadar.lineTo(distanceObj.drawX + 20, distanceObj.drawY - 20);
        gameObj.ctxRadar.lineTo(distanceObj.drawX + 20 + 35, distanceObj.drawY - 20);
        gameObj.ctxRadar.stroke();

        gameObj.ctxRadar.font = '11px Arial';
        gameObj.ctxRadar.fillText('missile', distanceObj.drawX + 20, distanceObj.drawY - 20 - 2);
        console.log('ミサイル描画中')
      } else { // 他人のミサイルの描画

        const degreeDiff = calcDegreeDiffFromRadar(gameObj.deg, distanceObj.degree);
        const opacity = calcOpacity(degreeDiff);

        const drawRadius1 = gameObj.counter % 8 + 2 + 20;
        const clearRadius1 = drawRadius1 - 2;
        const drawRadius2 = gameObj.counter % 8 + 2 + 10;
        const clearRadius2 = drawRadius2 - 2;
        const drawRadius3 = gameObj.counter % 8 + 2 + 0;
        const clearRadius3 = drawRadius3 - 2;

        gameObj.ctxRadar.fillStyle = `rgba(255, 0, 0, ${opacity})`;
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, drawRadius1, 0, Math.PI * 2, true);
        gameObj.ctxRadar.fill();

        gameObj.ctxRadar.fillStyle = 'rgb(0, 20, 50)';
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, clearRadius1, 0, Math.PI * 2, true);
        gameObj.ctxRadar.fill();

        gameObj.ctxRadar.fillStyle = `rgba(255, 0, 0, ${opacity})`;
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, drawRadius2, 0, Math.PI * 2, true);
        gameObj.ctxRadar.fill();

        gameObj.ctxRadar.fillStyle = 'rgb(0, 20, 50)';
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, clearRadius2, 0, Math.PI * 2, true);
        gameObj.ctxRadar.fill();

        gameObj.ctxRadar.fillStyle = `rgba(255, 0, 0, ${opacity})`;
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, drawRadius3, 0, Math.PI * 2, true);
        gameObj.ctxRadar.fill();

        gameObj.ctxRadar.fillStyle = 'rgb(0, 20, 50)';
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, clearRadius3, 0, Math.PI * 2, true);
        gameObj.ctxRadar.fill();

        gameObj.ctxRadar.strokeStyle = `rgba(250, 250, 250, ${opacity})`;
        gameObj.ctxRadar.fillStyle = `rgba(250, 250, 250, ${opacity})`;
        gameObj.ctxRadar.beginPath();
        gameObj.ctxRadar.moveTo(distanceObj.drawX, distanceObj.drawY);
        gameObj.ctxRadar.lineTo(distanceObj.drawX + 30, distanceObj.drawY - 30);
        gameObj.ctxRadar.lineTo(distanceObj.drawX + 30 + 35, distanceObj.drawY - 30);
        gameObj.ctxRadar.stroke();

        gameObj.ctxRadar.font = '11px Arial';
        gameObj.ctxRadar.fillText('missile', distanceObj.drawX + 30, distanceObj.drawY - 30 - 2);
      }
    }
  }
}

function drawObj(obj, r, g, b) {
  for (let [index, item] of obj) {

    const distanceObj = calculationBetweenTwoPoints(
      gameObj.myPlayerObj.x, gameObj.myPlayerObj.y,
      item.x, item.y,
      gameObj.fieldWidth, gameObj.fieldHeight,
      gameObj.radarCanvasWidth, gameObj.radarCanvasHeight
    );

    if (distanceObj.distanceX <= (gameObj.radarCanvasWidth / 2) && distanceObj.distanceY <= (gameObj.radarCanvasHeight / 2)) {

      const degreeDiff = calcDegreeDiffFromRadar(gameObj.deg, distanceObj.degree);
      const opacity = calcOpacity(degreeDiff);

      gameObj.ctxRadar.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      gameObj.ctxRadar.beginPath();
      gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, gameObj.itemRadius, 0, Math.PI * 2, true);
      gameObj.ctxRadar.fill();
    }
  }
}

function calculationBetweenTwoPoints(pX, pY, oX, oY, gameWidth, gameHeight, radarCanvasWidth, radarCanvasHeight) {
  let distanceX = 99999999;
  let distanceY = 99999999;
  let drawX = null;
  let drawY = null;

  if (pX <= oX) {
    // 右から
    distanceX = oX - pX;
    drawX = (radarCanvasWidth / 2) + distanceX;
    // 左から
    let tmpDistance = pX + gameWidth - oX;
    if (distanceX > tmpDistance) {
      distanceX = tmpDistance;
      drawX = (radarCanvasWidth / 2) - distanceX;
    }

  } else {
    // 右から
    distanceX = pX - oX;
    drawX = (radarCanvasWidth / 2) - distanceX;
    // 左から
    let tmpDistance = oX + gameWidth - pX;
    if (distanceX > tmpDistance) {
      distanceX = tmpDistance;
      drawX = (radarCanvasWidth / 2) + distanceX;
    }
  }

  if (pY <= oY) {
    // 下から
    distanceY = oY - pY;
    drawY = (radarCanvasHeight / 2) + distanceY;
    // 上から
    let tmpDistance = pY + gameHeight - oY;
    if (distanceY > tmpDistance) {
      distanceY = tmpDistance;
      drawY = (radarCanvasHeight / 2) - distanceY;
    }

  } else {
    // 上から
    distanceY = pY - oY;
    drawY = (radarCanvasHeight / 2) - distanceY;
    // 下から
    let tmpDistance = oY + gameHeight - pY;
    if (distanceY > tmpDistance) {
      distanceY = tmpDistance;
      drawY = (radarCanvasHeight / 2) + distanceY;
    }
  }

  const degree = calcTwoPointsDegree(drawX, drawY, radarCanvasWidth / 2, radarCanvasHeight / 2);

  return {
    distanceX,
    distanceY,
    drawX,
    drawY,
    degree
  };
}

function calcTwoPointsDegree(x1, y1, x2, y2) {
  const radian = Math.atan2(y2 - y1, x2 - x1);
  const degree = radian * 180 / Math.PI + 180;
  return degree;
}

function calcDegreeDiffFromRadar(degRadar, degItem) {
  let diff = degRadar - degItem;
  if (diff < 0) {
    diff += 360;
  }

  return diff;
}

function calcOpacity(degreeDiff) {
  const deleteDeg = 270;
  degreeDiff = degreeDiff > deleteDeg ? deleteDeg : degreeDiff; // もう少しだけ暗くするコツ
  return (1 - degreeDiff / deleteDeg).toFixed(2);
}

$(window).on('keydown', (event) => {
  if (!gameObj.myPlayerObj || !gameObj.myPlayerObj.isAlive) return;

  switch (event.key) {
    case 'ArrowLeft':
      if (gameObj.myPlayerObj.direction === 'left') break; // 変わっていない
      gameObj.myPlayerObj.direction = 'left';
      drawSubmarine(gameObj.ctxRadar, gameObj.myPlayerObj);
      sendChangeDirection(socket, 'left');
      break;
    case 'ArrowUp':
      if (gameObj.myPlayerObj.direction === 'up') break; // 変わってない
      gameObj.myPlayerObj.direction = 'up';
      drawSubmarine(gameObj.ctxRadar, gameObj.myPlayerObj);
      sendChangeDirection(socket, 'up');
      break;
    case 'ArrowDown':
      if (gameObj.myPlayerObj.direction === 'down') break; // 変わってない
      gameObj.myPlayerObj.direction = 'down';
      drawSubmarine(gameObj.ctxRadar, gameObj.myPlayerObj);
      sendChangeDirection(socket, 'down');
      break;
    case 'ArrowRight':
      if (gameObj.myPlayerObj.direction === 'right') break; // 変わってない
      gameObj.myPlayerObj.direction = 'right';
      drawSubmarine(gameObj.ctxRadar, gameObj.myPlayerObj);
      sendChangeDirection(socket, 'right');
      break;
    case ' ': // スペースキー
      if (gameObj.myPlayerObj.missilesMany <= 0) break; // ミサイルのストックが0

      gameObj.myPlayerObj.missilesMany -= 1;
      const missileId = Math.floor(Math.random() * 100000) + ',' + gameObj.myPlayerObj.socketId + ',' + gameObj.myPlayerObj.x + ',' + gameObj.myPlayerObj.y;

      const missileObj = {
        emitPlayerId: gameObj.myPlayerObj.playerId,
        x: gameObj.myPlayerObj.x,
        y: gameObj.myPlayerObj.y,
        direction: gameObj.myPlayerObj.direction,
        id: missileId
      };
      gameObj.flyingMissilesMap.set(missileId, missileObj);
      sendMissileEmit(socket, gameObj.myPlayerObj.direction);
      break;
  }
});

function sendChangeDirection(socket, direction) {
  socket.emit('change direction', direction);
}

function sendMissileEmit(socket, direction) {
  socket.emit('missile emit', direction);
}

function moveInClient(myPlayerObj, flyingMissilesMap) {

  if (!myPlayerObj.isAlive) {
    if (myPlayerObj.deadCount < 60) {
      myPlayerObj.deadCount += 1;
    }
    return;
  }

  // 移動
  switch (myPlayerObj.direction) {
    case 'left':
      myPlayerObj.x -= 1;
      break;
    case 'up':
      myPlayerObj.y -= 1;
      break;
    case 'down':
      myPlayerObj.y += 1;
      break;
    case 'right':
      myPlayerObj.x += 1;
      break;
  }
  if (myPlayerObj.x > gameObj.fieldWidth) myPlayerObj.x -= gameObj.fieldWidth;
  if (myPlayerObj.x < 0) myPlayerObj.x += gameObj.fieldWidth;
  if (myPlayerObj.y < 0) myPlayerObj.y += gameObj.fieldHeight;
  if (myPlayerObj.y > gameObj.fieldHeight) myPlayerObj.y -= gameObj.fieldHeight;

  myPlayerObj.aliveTime.clock += 1;
  if (myPlayerObj.aliveTime.clock === 30) {
    myPlayerObj.aliveTime.clock = 0;
    myPlayerObj.aliveTime.seconds += 1;
  }

  // 飛んでいるミサイルの移動
  for (let [missileId, flyingMissile] of flyingMissilesMap) {

    switch (flyingMissile.direction) {
      case 'left':
        flyingMissile.x -= gameObj.missileSpeed;
        break;
      case 'up':
        flyingMissile.y -= gameObj.missileSpeed;
        break;
      case 'down':
        flyingMissile.y += gameObj.missileSpeed;
        break;
      case 'right':
        flyingMissile.x += gameObj.missileSpeed;
        break;
    }
    if (flyingMissile.x > gameObj.fieldWidth) flyingMissile.x -= gameObj.fieldWidth;
    if (flyingMissile.x < 0) flyingMissile.x += gameObj.fieldWidth;
    if (flyingMissile.y < 0) flyingMissile.y += gameObj.fieldHeight;
    if (flyingMissile.y > gameObj.fieldHeight) flyingMissile.y -= gameObj.fieldHeight;
  }
}