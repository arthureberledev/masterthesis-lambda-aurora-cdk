import * as cdk from "aws-cdk-lib";
import { CfnOutput } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const dbSecret = new cdk.aws_rds.DatabaseSecret(this, "AuroraSecret", {
      username: "admin",
    });

    const dbCluster = new cdk.aws_rds.ServerlessCluster(this, "AuroraCluster", {
      engine: cdk.aws_rds.DatabaseClusterEngine.AURORA_MYSQL,
      credentials: cdk.aws_rds.Credentials.fromSecret(dbSecret),
      clusterIdentifier: "masterthesis-aurora-cluster",
      defaultDatabaseName: "masterthesis_aurora_db",
      enableDataApi: true,
      scaling: {
        autoPause: cdk.Duration.minutes(10),
        minCapacity: 2,
        maxCapacity: 16,
      },
    });

    const getUsers = new lambda.NodejsFunction(this, "getUsers", {
      entry: "./lambda/users/get-users.ts",
      handler: "handler",
      environment: {
        CLUSTER_ARN: dbCluster.clusterArn,
        SECRET_ARN: dbCluster.secret?.secretArn ?? "",
      },
      timeout: cdk.Duration.seconds(30),
    });

    const getUserById = new lambda.NodejsFunction(this, "getUserById", {
      entry: "./lambda/users/get-user-by-id.ts",
      handler: "handler",
      environment: {
        CLUSTER_ARN: dbCluster.clusterArn,
        SECRET_ARN: dbCluster.secret?.secretArn ?? "",
      },
      timeout: cdk.Duration.seconds(30),
    });

    const createUser = new lambda.NodejsFunction(this, "createUser", {
      entry: "./lambda/users/create-user.ts",
      handler: "handler",
      environment: {
        CLUSTER_ARN: dbCluster.clusterArn,
        SECRET_ARN: dbCluster.secret?.secretArn ?? "",
      },
      timeout: cdk.Duration.seconds(30),
    });

    const deleteUserById = new lambda.NodejsFunction(this, "deleteUserById", {
      entry: "./lambda/users/delete-user-by-id.ts",
      handler: "handler",
      environment: {
        CLUSTER_ARN: dbCluster.clusterArn,
        SECRET_ARN: dbCluster.secret?.secretArn ?? "",
      },
      timeout: cdk.Duration.seconds(30),
    });

    const updateUserById = new lambda.NodejsFunction(this, "updateUserById", {
      entry: "./lambda/users/update-user-by-id.ts",
      handler: "handler",
      environment: {
        CLUSTER_ARN: dbCluster.clusterArn,
        SECRET_ARN: dbCluster.secret?.secretArn ?? "",
      },
      timeout: cdk.Duration.seconds(30),
    });

    // Grant the lambda functions access to the data api and thus the database
    [getUsers, getUserById, createUser, deleteUserById, updateUserById].forEach(
      (fn) => dbCluster.grantDataApiAccess(fn)
    );

    /**
     * Defining APIs
     *
     * APIs are defined as a hierarchy of resources and methods. addResource and addMethod can be used to build this hierarchy. The root resource is api.root.
     *
     * @link https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_apigateway-readme.html#defining-apis
     */
    const api = new cdk.aws_apigateway.RestApi(this, "api", {});

    // Define resources and methods for /users
    const users = api.root.addResource("users");
    const usersMethods = [
      { method: "GET", fn: getUsers },
      { method: "POST", fn: createUser },
    ];
    usersMethods.forEach(({ method, fn }) =>
      users.addMethod(method, new cdk.aws_apigateway.LambdaIntegration(fn))
    );

    // Define resources and methods for /users/{id}
    const user = users.addResource("{id}");
    const userMethods = [
      { method: "GET", fn: getUserById },
      { method: "PATCH", fn: updateUserById },
      { method: "DELETE", fn: deleteUserById },
    ];
    userMethods.forEach(({ method, fn }) =>
      user.addMethod(method, new cdk.aws_apigateway.LambdaIntegration(fn))
    );

    new CfnOutput(this, "arn", { value: dbCluster.secret?.secretArn ?? "" });
    new CfnOutput(this, "db", { value: "masterthesis_aurora_db" });
  }
}
