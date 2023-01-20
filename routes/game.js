const express = require('express');
const router = express.Router();

router.get('/', (req, res, next) => {
  const IP_ADDRESS = process.env.IP_ADDRESS || 'http://localhost:8000'
  let displayName = 'anonymous';
  let thumbUrl = 'anonymous';
  if (req.user) {
     displayName = req.user.displayName;
     thumbUrl = req.user.photos[0].value;
  }
  res.render('game', { title: '潜水艦ゲーム', displayName: displayName, thumbUrl: thumbUrl, ipAddress: IP_ADDRESS });
});

module.exports = router;