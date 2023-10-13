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

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Method not allowed" }),
      };
    }

    const body = JSON.parse(event.body ?? "");
    const { name, email } = body;

    if (!name || !email) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Bad Request" }),
      };
    }

    const { generatedFields } = await rdsDataClient.send(
      new ExecuteStatementCommand({
        secretArn,
        resourceArn,
        database: "masterthesis_aurora_db",
        sql: "INSERT INTO users (name, email) VALUES (:name, :email);",
        parameters: [
          { name: "name", value: { stringValue: name } },
          { name: "email", value: { stringValue: email } },
        ],
      })
    );

    const lastInsertedId = generatedFields?.[0].longValue;
    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lastInsertedId, ...body }),
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
