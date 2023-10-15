import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import {
  ExecuteStatementCommand,
  RDSDataClient,
} from "@aws-sdk/client-rds-data";

const rdsDataClient = new RDSDataClient({});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const secretArn = process.env.SECRET_ARN;
    const resourceArn = process.env.CLUSTER_ARN;

    if (!secretArn || !resourceArn) {
      throw new Error("Missing environment variables");
    }

    if (event.httpMethod !== "GET") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Method not allowed" }),
      };
    }

    const { records } = await rdsDataClient.send(
      new ExecuteStatementCommand({
        secretArn,
        resourceArn,
        database: "masterthesis_aurora_serverless_db",
        sql: "SELECT * FROM users;",
      })
    );

    const users =
      records?.map(
        ([
          { longValue: id },
          { stringValue: name },
          { stringValue: email },
        ]) => ({
          id,
          name,
          email,
        })
      ) ?? [];

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(users),
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message:
          error instanceof Error ? error.message : "Internal Server Error",
      }),
    };
  }
};
