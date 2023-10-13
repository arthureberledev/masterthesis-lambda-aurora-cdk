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

    if (event.httpMethod !== "PATCH") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Method not allowed" }),
      };
    }

    const id = event.pathParameters?.id;
    const body = JSON.parse(event.body ?? "");
    const { email } = body;

    if (!id || !email) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Bad Request" }),
      };
    }

    const { numberOfRecordsUpdated } = await rdsDataClient.send(
      new ExecuteStatementCommand({
        secretArn,
        resourceArn,
        database: "masterthesis_aurora_db",
        sql: "UPDATE users SET email = :email WHERE id = :id;",
        parameters: [
          { name: "id", value: { longValue: parseInt(id) } },
          { name: "email", value: { stringValue: email } },
        ],
      })
    );

    if (numberOfRecordsUpdated === 0) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Not Found" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
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
