import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productsTable = dynamodb.Table.fromTableName(this, 'ProductsTable', 'products');
    const stocksTable = dynamodb.Table.fromTableName(this, 'StocksTable', 'stocks');

    const getProductsListLambda = new lambda.Function(this, 'getProductsList', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'getProductsList.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambdas')),
      environment: {
        PRODUCTS_TABLE: 'products',
        STOCKS_TABLE: 'stocks',
      },
    });

    const getProductsByIdLambda = new lambda.Function(this, 'getProductsById', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'getProductsById.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambdas')),
      environment: {
        PRODUCTS_TABLE: 'products',
        STOCKS_TABLE: 'stocks',
      },
    });

    const createProductLambda = new lambda.Function(this, 'createProduct', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'createProduct.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambdas')),
      environment: {
        PRODUCTS_TABLE: 'products',
        STOCKS_TABLE: 'stocks',
      },
    });

    productsTable.grantReadData(getProductsListLambda);
    stocksTable.grantReadData(getProductsListLambda);
    productsTable.grantReadData(getProductsByIdLambda);
    stocksTable.grantReadData(getProductsByIdLambda);
    productsTable.grantWriteData(createProductLambda);
    stocksTable.grantWriteData(createProductLambda);

    const api = new apigateway.RestApi(this, 'ProductsApi', {
      restApiName: 'Product Service API',
      description: 'API for product catalog',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const productsResource = api.root.addResource('products');
    productsResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsListLambda));
    productsResource.addMethod('POST', new apigateway.LambdaIntegration(createProductLambda));

    const singleProductResource = productsResource.addResource('{productId}');
    singleProductResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsByIdLambda));

    new cdk.CfnOutput(this, 'ProductsApiUrl', {
      value: api.url,
    });
  }
}
