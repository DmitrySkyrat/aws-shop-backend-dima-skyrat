# Task 3 (First API with AWS API Gateway and AWS Lambda)

This is backend starter project for aws-shop-backend-dima-skyrat

## Work has been done

- Product Service contains configuration for 2 lambda functions, API is working.
- The getProductsById AND getProductsList lambda functions return a correct response code.
- Frontend application is integrated with Product Service (/products API) and products from Product Service are represented.
- Swagger documentation is created for Product Service openapi.yaml.
- Lambda handlers are covered by basic UNIT tests(__tests__)
- Lambda handlers (getProductsList, getProductsById) and separated in codebase.
- Error handling is supported ("Product not found" error).


### `cdk:deploy`

Deploys (or updates) the AWS CDK stack to your AWS account.

### `test`

Launch tests.