import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // API global prefix
  app.setGlobalPrefix('api');

  // CORS
  app.enableCors();

  // Validation
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // Serve frontend static files in production mode
  if (process.env.NODE_ENV === 'production') {
    const staticDir = join(process.cwd(), 'client', 'dist');
    if (existsSync(staticDir)) {
      app.useStaticAssets(staticDir);

      // SPA fallback: all non-API routes serve index.html
      app.use((req: any, res: any, next: any) => {
        if (!req.path.startsWith('/api')) {
          res.sendFile(join(staticDir, 'index.html'));
        } else {
          next();
        }
      });

      console.log(`Serving frontend from: ${staticDir}`);
    } else {
      console.warn(`Frontend dist not found at: ${staticDir}`);
      console.warn('Run "cd client && npm run build" to build the frontend.');
    }
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}
bootstrap();
