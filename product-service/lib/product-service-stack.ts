import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import * as path from 'path';

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productsTable = dynamodb.Table.fromTableName(this, 'ProductsTable', 'products');
    const stocksTable = dynamodb.Table.fromTableName(this, 'StocksTable', 'stocks');

    // SQS Queue for batch product creation
    const catalogItemsQueue = new sqs.Queue(this, 'CatalogItemsQueue', {
      queueName: 'catalogItemsQueue',
      visibilityTimeout: cdk.Duration.seconds(30),
    });

    // SNS Topic for product creation notifications
    const createProductTopic = new sns.Topic(this, 'CreateProductTopic', {
      topicName: 'createProductTopic',
    });

    // Email subscription for expensive products (price >= 100)
    createProductTopic.addSubscription(
      new snsSubscriptions.EmailSubscription('dimaskyrat@gmail.com', {
        filterPolicy: {
          price: sns.SubscriptionFilter.numericFilter({
            greaterThanOrEqualTo: 100,
          }),
        },
      })
    );

    // Additional email subscription for affordable products (price < 100)
    createProductTopic.addSubscription(
      new snsSubscriptions.EmailSubscription('dimaskyrat+cheap@gmail.com', {
        filterPolicy: {
          price: sns.SubscriptionFilter.numericFilter({
            lessThan: 100,
          }),
        },
      })
    );

    // catalogBatchProcess Lambda – triggered by SQS
    const catalogBatchProcessLambda = new lambda.Function(this, 'catalogBatchProcess', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'catalogBatchProcess.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambdas')),
      environment: {
        PRODUCTS_TABLE: 'products',
        STOCKS_TABLE: 'stocks',
        SNS_TOPIC_ARN: createProductTopic.topicArn,
      },
    });

    productsTable.grantWriteData(catalogBatchProcessLambda);
    stocksTable.grantWriteData(catalogBatchProcessLambda);
    createProductTopic.grantPublish(catalogBatchProcessLambda);
    catalogItemsQueue.grantConsumeMessages(catalogBatchProcessLambda);

    catalogBatchProcessLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(catalogItemsQueue, {
        batchSize: 5,
      })
    );

    // Export queue details for use by import-service
    new cdk.CfnOutput(this, 'CatalogItemsQueueUrl', {
      value: catalogItemsQueue.queueUrl,
      exportName: 'CatalogItemsQueueUrl',
    });

    new cdk.CfnOutput(this, 'CatalogItemsQueueArn', {
      value: catalogItemsQueue.queueArn,
      exportName: 'CatalogItemsQueueArn',
    });

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
