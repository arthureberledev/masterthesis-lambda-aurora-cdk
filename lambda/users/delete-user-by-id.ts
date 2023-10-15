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

    if (event.httpMethod !== "DELETE") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Method not allowed" }),
      };
    }

    const id = event.pathParameters?.id;

    if (!id) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Bad Request" }),
      };
    }

    await rdsDataClient.send(
      new ExecuteStatementCommand({
        secretArn,
        resourceArn,
        database: "masterthesis_aurora_serverless_db",
        sql: "DELETE FROM users WHERE id = :id;",
        parameters: [{ name: "id", value: { longValue: parseInt(id) } }],
      })
    );

    return {
      statusCode: 204,
      body: "",
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
