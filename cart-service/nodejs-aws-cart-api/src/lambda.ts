import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { configure as serverlessExpress } from '@vendia/serverless-express';
import * as express from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';

const expressApp = express();
let cachedServer: ReturnType<typeof serverlessExpress>;

async function bootstrap(): Promise<ReturnType<typeof serverlessExpress>> {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { logger: ['error', 'warn'] },
  );

  app.enableCors({
    origin: (req, callback) => callback(null, true),
  });
  app.use(helmet());

  await app.init();

  return serverlessExpress({ app: expressApp });
}

export const handler = async (
  event: Parameters<ReturnType<typeof serverlessExpress>>[0],
  context: Parameters<ReturnType<typeof serverlessExpress>>[1],
  callback: Parameters<ReturnType<typeof serverlessExpress>>[2],
) => {
  if (!cachedServer) {
    cachedServer = await bootstrap();
  }
  return cachedServer(event, context, callback);
};
