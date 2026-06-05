import type {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from 'aws-lambda';

function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
}

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  const token = event.authorizationToken;

  // No Authorization header at all → 401
  if (!token) {
    throw new Error('Unauthorized');
  }

  const parts = token.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'basic') {
    return generatePolicy('unknown', 'Deny', event.methodArn);
  }

  const encodedCredentials = parts[1];
  const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
  const colonIndex = decodedCredentials.indexOf(':');

  if (colonIndex === -1) {
    return generatePolicy('unknown', 'Deny', event.methodArn);
  }

  const username = decodedCredentials.substring(0, colonIndex);
  const password = decodedCredentials.substring(colonIndex + 1);

  const storedPassword = process.env[username];

  if (!storedPassword || storedPassword !== password) {
    return generatePolicy(username || 'unknown', 'Deny', event.methodArn);
  }

  return generatePolicy(username, 'Allow', event.methodArn);
};
