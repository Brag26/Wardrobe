// server/src/server.ts
import 'dotenv/config';
import app from './app';

const PORT = process.env.PORT ?? 4000;

app.listen(PORT, () => {
  console.log(`AI Wardrobe backend listening on port ${PORT}`);
});
