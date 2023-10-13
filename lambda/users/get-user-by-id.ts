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

    const id = event.pathParameters?.id;

    if (!id) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Bad Request" }),
      };
    }

    const { records } = await rdsDataClient.send(
      new ExecuteStatementCommand({
        secretArn,
        resourceArn,
        database: "masterthesis_aurora_db",
        sql: "SELECT * FROM users WHERE id = :id;",
        parameters: [{ name: "id", value: { longValue: parseInt(id) } }],
      })
    );

    if (!records || records?.length === 0) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Not Found" }),
      };
    }

    const user = {
      id: records[0][0].longValue,
      name: records[0][1].stringValue,
      email: records[0][2].stringValue,
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
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
