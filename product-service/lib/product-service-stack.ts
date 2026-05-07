import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import * as path from 'path';

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- Lambda: getProductsList ---
    const getProductsListLambda = new lambda.Function(this, 'getProductsList', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'getProductsList.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambdas')),
    });

    // --- Lambda: getProductsById ---
    const getProductsByIdLambda = new lambda.Function(this, 'getProductsById', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'getProductsById.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambdas')),
    });

    // --- API Gateway ---
    const api = new apigateway.RestApi(this, 'ProductsApi', {
      restApiName: 'Product Service API',
      description: 'API for product catalog',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const productsResource = api.root.addResource('products');

    // GET /products -> getProductsListLambda
    productsResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsListLambda));

    const singleProductResource = productsResource.addResource('{productId}');

    // GET /products/{productId} -> getProductsByIdLambda
    singleProductResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsByIdLambda));

    new cdk.CfnOutput(this, 'ProductsApiUrl', {
      value: api.url,
    });
  }
}
