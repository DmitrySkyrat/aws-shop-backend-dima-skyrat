import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import * as path from 'path';
import * as childProcess from 'child_process';

export class CartServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Root of nodejs-aws-cart-api (the project itself is the NestJS app)
    // __dirname at runtime: <project>/lib-cdk/lib/  →  two levels up = project root
    const appDir = path.resolve(__dirname, '../..');

    const cartServiceLambda = new lambda.Function(this, 'CartServiceLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'lambda.handler',
      code: lambda.Code.fromAsset(appDir, {
        bundling: {
          // Docker-based bundling (fallback when Docker is available)
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash',
            '-c',
            [
              'npm ci',
              'npm run build',
              'cp -rL dist/. /asset-output/',
              'cp package.json package-lock.json /asset-output/',
              'cd /asset-output && npm ci --omit=dev',
            ].join(' && '),
          ],
          // Local bundling (preferred — no Docker needed)
          local: {
            tryBundle(outputDir: string): boolean {
              try {
                childProcess.execSync('npm ci && npm run build', {
                  cwd: appDir,
                  stdio: 'inherit',
                });
                childProcess.execSync(`cp -rL ${appDir}/dist/. ${outputDir}/`, {
                  stdio: 'inherit',
                });
                childProcess.execSync(
                  `cp ${appDir}/package.json ${appDir}/package-lock.json ${outputDir}/`,
                  { stdio: 'inherit' },
                );
                childProcess.execSync('npm ci --omit=dev', {
                  cwd: outputDir,
                  stdio: 'inherit',
                });
                return true;
              } catch (e) {
                console.error('Local bundling failed:', e);
                return false;
              }
            },
          },
        },
      }),
      environment: {
        NODE_ENV: 'production',
        DB_HOST: process.env.DB_HOST || '',
        DB_PORT: process.env.DB_PORT || '5432',
        DB_USER: process.env.DB_USER || '',
        DB_PASSWORD: process.env.DB_PASSWORD || '',
        DB_NAME: process.env.DB_NAME || 'cartdb',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    const api = new apigateway.RestApi(this, 'CartServiceApi', {
      restApiName: 'Cart Service',
      description: 'Cart Service API backed by NestJS Lambda',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    const lambdaIntegration = new apigateway.LambdaIntegration(
      cartServiceLambda,
      { proxy: true },
    );

    const proxyResource = api.root.addResource('{proxy+}');
    proxyResource.addMethod('ANY', lambdaIntegration);
    api.root.addMethod('ANY', lambdaIntegration);

    new cdk.CfnOutput(this, 'CartServiceApiUrl', {
      value: api.url,
      description: 'Cart Service API Gateway URL',
      exportName: 'CartServiceApiUrl',
    });
  }
}
