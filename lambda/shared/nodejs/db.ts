import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import * as mysql from "mysql2/promise";

if (!process.env.databaseSecretArn) {
  throw new Error("Environment variable databaseSecretArn is undefined");
}

let pool: mysql.Pool | undefined;

export async function getPool() {
  if (!pool) {
    const client = new SecretsManagerClient({});
    const secret = await client.send(
      new GetSecretValueCommand({
        SecretId: process.env.databaseSecretArn,
      })
    );
    const secretValues = JSON.parse(secret.SecretString ?? "{}");

    pool = mysql.createPool({
      host: secretValues.host,
      port: secretValues.port,
      user: secretValues.user,
      password: secretValues.password,
      database: secretValues.database || "mt_mysql_db",
      /**
       * When true, the pool will queue connection requests when limit is reached.
       */
      waitForConnections: true,
      /**
       * The connectionLimit value indicates the maximum number of connections to create at once within the connection pool.
       */
      connectionLimit: 10,
      /**
       * Maximum number of idle connections to keep in the pool, default is `connectionLimit`.
       */
      maxIdle: 10,
      /**
       * The maximum time an idle connection will remain in the pool, in milliseconds.
       */
      idleTimeout: 60000,
      /**
       * The maximum number of connection requests the pool will queue, 0 for no limit.
       */
      queueLimit: 0,
      /**
       * If true, uses TCP Keep-Alive on idle connections, preventing them from being closed.
       */
      enableKeepAlive: true,
      /**
       * The initial delay for TCP Keep-Alive, in milliseconds.
       */
      keepAliveInitialDelay: 0,
    });
  }
  return pool;
}
