require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

// 라우터 연결 예시
const shopRoutes = require('./routes/shopRoutes');
app.use('/api/shops', shopRoutes);

// 서버 실행
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
