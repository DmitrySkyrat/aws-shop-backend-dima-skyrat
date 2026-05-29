import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import * as path from 'path';

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const importBucket = new s3.Bucket(this, 'ImportBucket', {
      bucketName: `aws-dimas-shop-imports-${this.account}-${this.region}`,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Reference the catalogItemsQueue created by product-service stack
    const catalogItemsQueueArn = cdk.Fn.importValue('CatalogItemsQueueArn');
    const catalogItemsQueueUrl = cdk.Fn.importValue('CatalogItemsQueueUrl');
    const catalogItemsQueue = sqs.Queue.fromQueueArn(this, 'CatalogItemsQueue', catalogItemsQueueArn);

    const importProductsFileLambda = new NodejsFunction(this, 'importProductsFile', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '..', '..', 'lambdas', 'importProductsFile.ts'),
      handler: 'handler',
      environment: {
        BUCKET_NAME: importBucket.bucketName,
        REGION: this.region,
      },
    });

    const importFileParserLambda = new NodejsFunction(this, 'importFileParser', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '..', '..', 'lambdas', 'importFileParser.ts'),
      handler: 'handler',
      environment: {
        BUCKET_NAME: importBucket.bucketName,
        SQS_QUEUE_URL: catalogItemsQueueUrl,
      },
    });

    importBucket.grantPut(importProductsFileLambda);
    importBucket.grantReadWrite(importFileParserLambda);
    importBucket.grantDelete(importFileParserLambda);
    catalogItemsQueue.grantSendMessages(importFileParserLambda);

    importBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParserLambda),
      { prefix: 'uploaded/' },
    );

    const api = new apigateway.RestApi(this, 'ImportApi', {
      restApiName: 'Import Service API',
      description: 'API for product import',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const importResource = api.root.addResource('import');

    const nameRequestValidator = new apigateway.RequestValidator(this, 'NameQueryParamValidator', {
      restApi: api,
      validateRequestParameters: true,
    });

    importResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(importProductsFileLambda),
      {
        requestParameters: {
          'method.request.querystring.name': true,
        },
        requestValidator: nameRequestValidator,
      },
    );

    new cdk.CfnOutput(this, 'ImportApiUrl', {
      value: api.url,
    });

    new cdk.CfnOutput(this, 'ImportBucketName', {
      value: importBucket.bucketName,
    });
  }
}
