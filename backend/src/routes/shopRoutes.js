const express = require('express');
const router = express.Router();

// 테스트용 엔드포인트
router.get('/', (req, res) => {
  res.json({ message: 'Shop routes working!' });
});

module.exports = router;
