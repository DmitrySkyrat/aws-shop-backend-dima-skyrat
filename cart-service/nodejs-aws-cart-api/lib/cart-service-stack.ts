import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import * as path from 'path';

export class CartServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const lambdaPkgDir = path.resolve(__dirname, '../lambda-pkg');
    const cartServiceLambda = new lambda.Function(this, 'CartServiceLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'src/lambda.handler',
      code: lambda.Code.fromAsset(lambdaPkgDir),
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
