import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

// import { getPool } from "../shared/db";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // const pool = await getPool();
    // const [rows] = await pool.execute("SELECT * FROM users");

    if (event.httpMethod === "GET") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        // body: JSON.stringify(rows),
        body: JSON.stringify({ message: "Hello World" }),
      };
    }

    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      // body: JSON.stringify(rows),
      body: JSON.stringify({ message: "Bad Request" }),
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "An error occurred" }),
    };
  }
};
