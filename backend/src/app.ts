import express from 'express';
import routes from './routes';
import cors from 'cors';
import { swaggerServe, swaggerSetup } from './swagger';
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', routes);
// Swagger UI at /api/docs
app.use('/api/docs', ...swaggerServe, swaggerSetup);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});